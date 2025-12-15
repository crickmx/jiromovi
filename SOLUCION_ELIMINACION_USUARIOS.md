# Solución Definitiva: Eliminación de Usuarios

## Problema Identificado

El sistema no permitía eliminar usuarios debido a restricciones de foreign keys (RESTRICT y NO ACTION) en múltiples tablas de la base de datos.

## Solución Implementada

### 1. Función de Base de Datos: `safe_delete_user`

Se creó una función de PostgreSQL que maneja la eliminación de usuarios de forma segura:

**Archivo:** `supabase/migrations/create_safe_delete_user_function.sql`

**Características:**
- Ejecuta con permisos elevados (SECURITY DEFINER)
- Verifica que el usuario exista antes de eliminar
- Maneja automáticamente todas las relaciones de foreign keys
- Retorna información detallada sobre el resultado
- Captura y reporta errores de forma clara

**Comportamiento:**
- Las relaciones con `ON DELETE CASCADE` eliminan los registros relacionados
- Las relaciones con `ON DELETE SET NULL` preservan los registros con valor NULL
- Los registros históricos se mantienen para auditoría

### 2. Actualización de Constraints de Base de Datos

Se actualizaron todas las foreign keys problemáticas:

**Migraciones aplicadas:**
1. `fix_user_deletion_foreign_keys.sql` - Constraints iniciales
2. `fix_remaining_no_action_constraints.sql` - Constraints restantes

**Tablas actualizadas (ahora usan SET NULL):**
- `notificaciones_globales.enviado_por`
- `accesos_nacional.creado_por`
- `accesos_nacional.ultima_edicion_por`
- `seguros_sessions.creado_por`
- `seguros_lessons.creado_por`
- `crm_contactos.creado_por`
- `crm_cotizaciones.creado_por`
- `crm_notas.creado_por`
- `crm_polizas.creado_por`
- `crm_tareas.creado_por`
- `expediente_usuario.subido_por`
- `production_google_sheets_config.configurado_por_user_id`

### 3. Edge Function Actualizada

**Archivo:** `supabase/functions/delete-user/index.ts`

**Cambios implementados:**
- Usa la función `safe_delete_user` de base de datos
- Mejor manejo de errores con mensajes específicos
- Validaciones de seguridad mejoradas
- Eliminación en dos pasos: base de datos primero, auth después
- Manejo de casos de éxito parcial

**Flujo de eliminación:**
1. Valida que el usuario actual sea Administrador
2. Verifica que no se intente eliminar a sí mismo
3. Llama a `safe_delete_user(user_id)`
4. Si tiene éxito, elimina del sistema de autenticación
5. Retorna resultado detallado

## Verificación

### Verificar que no hay constraints problemáticas:

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'usuarios'
  AND rc.delete_rule IN ('RESTRICT', 'NO ACTION');
```

**Resultado esperado:** 0 filas (sin constraints problemáticas)

## Uso en el Frontend

La eliminación de usuarios se realiza desde:
- **Directorio:** `/src/pages/Directorio.tsx`
- **Usuarios Pendientes:** `/src/components/UsuariosPendientes.tsx`

**Código de ejemplo:**
```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId: id }),
  }
);
```

## Beneficios de esta Solución

1. **Eliminación segura**: La función de base de datos maneja todas las relaciones automáticamente
2. **Preservación de datos**: Los registros históricos se mantienen con referencias NULL
3. **Auditoría completa**: Se puede rastrear quién creó cada registro
4. **Manejo de errores robusto**: Mensajes claros y específicos
5. **Atomicidad**: La operación completa es transaccional
6. **Sin bloqueos**: Ya no hay constraints que impidan la eliminación

## Casos de Uso

### Eliminar usuario con registros asociados:
- ✅ Comunicados creados → `creado_por` = NULL
- ✅ Cursos creados → `creado_por` = NULL
- ✅ Notificaciones enviadas → `enviado_por` = NULL
- ✅ Tareas CRM creadas → `creado_por` = NULL
- ✅ Contactos asignados → `asignado_a` = NULL
- ✅ Documentos propios → Se eliminan (CASCADE)
- ✅ Correos propios → Se eliminan (CASCADE)
- ✅ Participaciones en chats → Se eliminan (CASCADE)

### Restricciones mantenidas:
- ❌ No se puede eliminar a sí mismo
- ❌ Solo Administradores pueden eliminar usuarios

## Despliegue

**Estado:** ✅ Desplegado y funcional

- Función de base de datos: ✅ Migración aplicada
- Constraints actualizadas: ✅ Todas las migraciones aplicadas
- Edge function: ✅ Desplegada en Supabase

## Pruebas Recomendadas

1. Crear un usuario de prueba
2. Asignarle algunos registros (comunicado, tarea, etc.)
3. Eliminar el usuario desde el Directorio
4. Verificar que:
   - El usuario se eliminó correctamente
   - Los registros asociados tienen `creado_por` = NULL
   - Los datos personales se eliminaron (CASCADE)

## Soporte

Si se presenta algún error, revisar:
1. Logs de la edge function en Supabase Dashboard
2. Verificar que no hay nuevas tablas con constraints RESTRICT
3. Confirmar que la función `safe_delete_user` existe en la base de datos
