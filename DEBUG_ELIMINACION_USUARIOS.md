# Debugging: Eliminación de Usuarios

## Si Recibes "Unexpected error during deletion"

La función ahora retorna información detallada sobre cualquier error. Los logs del edge function contendrán:

```json
{
  "error": "Mensaje de error legible",
  "error_code": "CÓDIGO_ERROR",
  "sqlstate": "Código SQL del error",
  "message": "Mensaje técnico completo",
  "detail": "Detalles adicionales",
  "hint": "Sugerencia de PostgreSQL",
  "context": "Contexto de la excepción"
}
```

## Pasos para Diagnosticar

### 1. Verificar logs del Edge Function

Ve a Supabase Dashboard → Edge Functions → delete-user → Logs

Busca el log más reciente que contenga "Delete function returned error"

### 2. Verificar constraints problemáticas

Ejecuta esta query en el SQL Editor de Supabase:

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  rc.delete_rule,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'usuarios'
  AND rc.delete_rule IN ('RESTRICT', 'NO ACTION')
ORDER BY tc.table_name, kcu.column_name;
```

**Resultado esperado:** 0 filas

Si hay filas, necesitas actualizar esos constraints a `SET NULL` o `CASCADE`.

### 3. Verificar que la función existe

```sql
SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'safe_delete_user'
  AND n.nspname = 'public';
```

**Resultado esperado:** 1 fila con `safe_delete_user(uuid)`

### 4. Probar la función directamente

```sql
SELECT safe_delete_user('USER_ID_AQUI'::uuid);
```

Esto te dará información detallada sobre qué está fallando.

## Errores Comunes

### Error: "User not found"
- El ID del usuario no existe en la tabla usuarios
- Verifica que el UUID sea correcto

### Error: "Cannot delete user due to foreign key constraint"
- Hay una tabla con constraint RESTRICT o NO ACTION que no fue actualizada
- Revisa el paso 2 arriba para identificar la tabla problemática
- Actualiza el constraint a SET NULL

### Error: "User could not be deleted"
- La operación DELETE no afectó ninguna fila
- Puede ser un problema de permisos o RLS
- Verifica que la función tenga SECURITY DEFINER

### Error: Database connection issues
- Verifica que el edge function tenga acceso a las variables de entorno
- SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configuradas

## Testing Manual

Usa el archivo `public/test-delete-user.html` para probar la eliminación:

1. Abre `http://localhost:5173/test-delete-user.html` (en desarrollo)
2. Inicia sesión con un usuario Administrador
3. Ingresa el ID del usuario a eliminar
4. Observa el resultado detallado

## Verificar Integridad del Sistema

Después de aplicar todas las migraciones, ejecuta:

```sql
-- 1. Verificar constraints
SELECT COUNT(*) as "Constraints problemáticas"
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'usuarios'
  AND rc.delete_rule IN ('RESTRICT', 'NO ACTION');

-- 2. Verificar función
SELECT COUNT(*) as "Función existe"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'safe_delete_user'
  AND n.nspname = 'public';

-- 3. Verificar permisos
SELECT
  p.proname,
  array_agg(pr.rolname) as roles_con_permiso
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_proc_acl pa ON p.oid = pa.oid
LEFT JOIN pg_roles pr ON pa.grantee = pr.oid
WHERE p.proname = 'safe_delete_user'
  AND n.nspname = 'public'
GROUP BY p.proname;
```

Resultados esperados:
- Constraints problemáticas: 0
- Función existe: 1
- Roles con permiso: authenticated, service_role

## Soluciones Rápidas

### Recrear la función

Si la función no existe o tiene problemas:

```sql
-- Ejecuta el contenido de:
-- supabase/migrations/improve_safe_delete_user_error_handling.sql
```

### Forzar actualización de constraint específico

Si encuentras un constraint problemático:

```sql
-- Ejemplo para tabla "mi_tabla" columna "usuario_id"
ALTER TABLE mi_tabla
  DROP CONSTRAINT IF EXISTS mi_tabla_usuario_id_fkey;

ALTER TABLE mi_tabla
  ALTER COLUMN usuario_id DROP NOT NULL; -- Si es necesario

ALTER TABLE mi_tabla
  ADD CONSTRAINT mi_tabla_usuario_id_fkey
  FOREIGN KEY (usuario_id)
  REFERENCES usuarios(id)
  ON DELETE SET NULL;
```

## Contacto para Soporte

Si el problema persiste:

1. Captura el error completo del edge function log
2. Ejecuta todas las queries de verificación arriba
3. Documenta qué usuario estás intentando eliminar y si tiene datos relacionados
4. Verifica la versión de las migraciones aplicadas
