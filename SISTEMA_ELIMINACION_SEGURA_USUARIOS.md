# Sistema de Eliminación Segura de Usuarios - MOVI Digital

## Resumen Ejecutivo

Se ha implementado un sistema completo de **Soft Delete** (eliminación segura) para usuarios en MOVI Digital. Este sistema permite a los administradores desactivar usuarios sin perder datos históricos ni generar errores en módulos relacionados.

## Características Principales

### 1. Soft Delete (Eliminación Segura)

En lugar de eliminar físicamente el registro del usuario:
- Se marca como eliminado (`is_deleted = true`)
- Se bloquea el acceso inmediato
- Se conservan todos los datos históricos
- Se mantienen las relaciones con otros módulos

### 2. Permisos y Seguridad

- **Solo Administradores** pueden eliminar usuarios
- No se puede eliminar al último administrador activo
- No se puede auto-eliminar
- Confirmación en dos pasos requerida

### 3. Auditoría Completa

- Registro de quién eliminó
- Cuándo se eliminó
- Motivo opcional
- Log permanente en tabla `audit_logs`

## Arquitectura del Sistema

### Base de Datos

#### Tabla `usuarios` - Nuevos Campos

```sql
-- Campos de soft delete
is_deleted              BOOLEAN DEFAULT false NOT NULL
deleted_at              TIMESTAMPTZ NULL
deleted_by_user_id      UUID NULL (FK a usuarios)
estado                  TEXT CHECK (estado IN ('activo', 'suspendido', 'eliminado'))
```

#### Tabla `audit_logs` (Nueva)

```sql
CREATE TABLE audit_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
  action                TEXT NOT NULL (ej: 'USER_DELETE')
  performed_by          UUID NOT NULL (FK a usuarios)
  target_user_id        UUID NULL (FK a usuarios)
  target_resource_type  TEXT NULL
  target_resource_id    UUID NULL
  details               JSONB DEFAULT '{}'
  ip_address            TEXT NULL
  user_agent            TEXT NULL
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

### Función de Base de Datos: `safe_delete_user`

**Parámetros:**
- `user_id_to_delete` (UUID) - ID del usuario a eliminar
- `deleted_by_admin_id` (UUID) - ID del administrador que elimina
- `deletion_reason` (TEXT, opcional) - Motivo de la eliminación

**Validaciones:**
1. Usuario existe y no está ya eliminado
2. Admin es válido y activo
3. No auto-eliminación
4. No eliminar el último admin

**Acciones:**
1. Marca `is_deleted = true`
2. Establece `deleted_at = now()`
3. Guarda `deleted_by_user_id`
4. Cambia `estado = 'eliminado'`
5. Desactiva `activo = false`
6. Crea registro en `audit_logs`

**Retorno:**
```json
{
  "success": true,
  "message": "Usuario eliminado correctamente",
  "deletion_type": "soft_delete",
  "user": { "id": "...", "nombre": "...", "rol": "..." },
  "deleted_at": "2024-...",
  "deleted_by": { "id": "...", "nombre": "..." }
}
```

### Edge Function: `delete-user`

**Endpoint:** `/functions/v1/delete-user`

**Método:** POST

**Headers:**
- `Authorization`: Bearer token del admin
- `Content-Type`: application/json

**Body:**
```json
{
  "userId": "uuid-del-usuario",
  "reason": "Motivo opcional"
}
```

**Flujo:**
1. Verifica que el usuario actual sea Administrador activo
2. Llama a `safe_delete_user()` en la base de datos
3. Revoca todas las sesiones del usuario eliminado
4. Retorna resultado detallado

**Respuestas:**

Éxito (200):
```json
{
  "success": true,
  "message": "Usuario eliminado correctamente. Acceso revocado.",
  "deletion_type": "soft_delete",
  "info": "El usuario ya no puede iniciar sesión. Sus datos históricos se conservan.",
  "details": { ... }
}
```

Errores comunes:
- `LAST_ADMIN`: No se puede eliminar el último admin
- `CANNOT_DELETE_SELF`: No puede eliminarse a sí mismo
- `USER_ALREADY_DELETED`: Usuario ya eliminado
- `USER_NOT_FOUND`: Usuario no existe

### Frontend

#### Modal de Confirmación (Directorio.tsx)

**Características:**
- Confirmación en 2 pasos
- Muestra información completa del usuario
- Usuario debe escribir "ELIMINAR" para confirmar
- Advierte claramente sobre las consecuencias
- Explica que es soft delete

**Información Mostrada:**
- Nombre completo
- Email laboral
- Rol
- Oficina
- Advertencias claras sobre:
  - Bloqueo de acceso
  - Conservación de datos históricos
  - Registro en auditoría

#### Protección de Login (AuthContext.tsx)

**Validaciones automáticas:**
- Filtra usuarios con `is_deleted = true`
- Filtra usuarios con `activo = false`
- Si un usuario eliminado intenta acceder, se cierra su sesión

#### Filtros en Vistas

**Listados de usuarios:**
- Por defecto, solo muestran usuarios con `is_deleted = false`
- Administradores pueden ver usuarios eliminados (opcional, no implementado aún)

### RLS (Row Level Security)

**Políticas Actualizadas:**

```sql
-- Usuarios pueden ver su propia información (incluso si eliminados)
CREATE POLICY "Users can view own data"
  ON usuarios FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins ven todos (incluyendo eliminados)
CREATE POLICY "Admins can view all users including deleted"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.rol = 'Administrador'
      AND u.is_deleted = false
    )
  );

-- Gerentes ven usuarios de su oficina (excluye eliminados)
CREATE POLICY "Gerentes can view own office users"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios gerente
      WHERE gerente.id = auth.uid()
      AND gerente.rol = 'Gerente'
      AND gerente.is_deleted = false
      AND gerente.oficina_id = usuarios.oficina_id
    )
    AND usuarios.is_deleted = false
  );

-- Usuarios autenticados ven usuarios activos no eliminados
CREATE POLICY "Users can view active users for directory"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    usuarios.activo = true
    AND usuarios.is_deleted = false
  );
```

## Flujo de Eliminación Paso a Paso

### 1. Usuario Administrador Hace Click en "Eliminar"

```
Directorio.tsx → handleDeleteClick(usuario)
```

### 2. Se Abre Modal de Confirmación

- Muestra información del usuario
- Muestra advertencias
- Solicita escribir "ELIMINAR"

### 3. Admin Confirma

```
Directorio.tsx → handleDeleteConfirm()
  ↓
Llama a Edge Function: /functions/v1/delete-user
  ↓
Edge Function valida permisos
  ↓
Llama a función de BD: safe_delete_user()
  ↓
Función de BD realiza validaciones
  ↓
Actualiza registro usuario (soft delete)
  ↓
Crea registro en audit_logs
  ↓
Retorna éxito
  ↓
Edge Function revoca sesiones del usuario
  ↓
Retorna resultado al frontend
  ↓
Frontend muestra mensaje de éxito
  ↓
Recarga lista de usuarios
```

### 4. Resultado

- Usuario ya no aparece en listados normales
- Usuario no puede iniciar sesión
- Datos históricos intactos
- Registro de auditoría creado

## Impacto en Módulos del Sistema

### Módulos que Conservan Referencias

**✅ Sin Impacto Negativo:**

1. **Comisiones**
   - Los registros mantienen referencia al usuario
   - Histórico de comisiones intacto

2. **Store - Pedidos**
   - Pedidos creados por el usuario se conservan
   - Historial de pedidos completo

3. **Comunicados**
   - Comunicados creados se mantienen
   - Autor visible en histórico

4. **CRM**
   - Contactos, tareas, cotizaciones conservadas
   - Se mantiene el creador original

5. **Vacaciones**
   - Solicitudes históricas conservadas

6. **Espacio JIRO - Reservas**
   - Reservas pasadas conservadas

7. **Trámites**
   - Historial completo mantenido

8. **Tickets**
   - Tickets creados conservados

9. **Notificaciones**
   - Historial de envíos conservado

10. **Auditoría**
    - Todas las acciones del usuario registradas

### Foreign Keys Configuradas

Todas las foreign keys a `usuarios.id` usan `ON DELETE SET NULL` o `ON DELETE CASCADE` según corresponda, **NUNCA** `NO ACTION` o `RESTRICT`.

## Casos de Uso

### Caso 1: Empleado Renuncia

**Escenario:** Un empleado renuncia y necesita ser desactivado.

**Acción:**
1. Admin va a Directorio
2. Busca al empleado
3. Click en botón eliminar (ícono basura)
4. Confirma en modal escribiendo "ELIMINAR"
5. Sistema bloquea acceso
6. Datos históricos se conservan

**Resultado:**
- ✅ Empleado no puede acceder
- ✅ Sus comisiones históricas visibles
- ✅ Sus pedidos en Store conservados
- ✅ Trámites que creó siguen ahí
- ✅ Log de auditoría registrado

### Caso 2: Error al Crear Usuario

**Escenario:** Se creó un usuario por error.

**Acción:** Misma que Caso 1

**Resultado:**
- ✅ Usuario eliminado sin errores
- ✅ Si no tiene datos asociados, no hay impacto
- ✅ Si tiene datos, se conservan

### Caso 3: Cambio de Rol/Oficina

**Escenario:** Usuario cambia de rol o oficina.

**Acción:** Editar usuario (no eliminar)

**Resultado:**
- ✅ Se actualiza información
- ✅ No es necesario eliminar

### Caso 4: Intento de Eliminar Último Admin

**Escenario:** Hay solo 1 admin activo y se intenta eliminar.

**Resultado:**
- ❌ Sistema rechaza la operación
- 💬 Mensaje: "No se puede eliminar el último administrador activo"

### Caso 5: Admin Intenta Auto-eliminarse

**Escenario:** Admin intenta eliminarse a sí mismo.

**Resultado:**
- ❌ Sistema rechaza la operación
- 💬 Mensaje: "No puedes eliminarte a ti mismo"

## Verificación y Testing

### Pruebas Obligatorias

1. **Eliminar usuario con datos asociados**
   - ✅ Sin errores
   - ✅ Conserva histórico

2. **Usuario eliminado intenta login**
   - ✅ Bloqueado
   - 💬 Mensaje: "Tu cuenta ha sido desactivada"

3. **Usuario no aparece en listados normales**
   - ✅ Filtrado correctamente

4. **No se puede eliminar a sí mismo**
   - ✅ Validación funciona

5. **No se puede eliminar al último admin**
   - ✅ Validación funciona

6. **Eliminar dos veces el mismo usuario**
   - ✅ Segunda vez retorna error: "Usuario ya está eliminado"

### Queries de Verificación

```sql
-- Ver usuarios eliminados
SELECT
  id,
  nombre,
  apellidos,
  rol,
  is_deleted,
  deleted_at,
  deleted_by_user_id
FROM usuarios
WHERE is_deleted = true;

-- Ver log de auditoría de eliminaciones
SELECT
  a.*,
  performed.nombre as admin_nombre,
  target.nombre as usuario_eliminado
FROM audit_logs a
LEFT JOIN usuarios performed ON a.performed_by = performed.id
LEFT JOIN usuarios target ON a.target_user_id = target.id
WHERE a.action = 'USER_DELETE'
ORDER BY a.created_at DESC;

-- Contar admins activos
SELECT COUNT(*) as total_admins_activos
FROM usuarios
WHERE rol = 'Administrador'
  AND is_deleted = false
  AND activo = true;
```

## Mantenimiento y Administración

### Ver Usuarios Eliminados (Admin)

**Futura Implementación:**
- Agregar toggle en Directorio para ver eliminados
- Filtro "Mostrar eliminados" solo para admins
- Posibilidad de "restaurar" usuario (cambiar is_deleted a false)

### Limpiar Usuarios Antiguos

**Si es necesario hard delete:**

```sql
-- Solo si es absolutamente necesario
-- Eliminar usuarios eliminados hace más de 1 año
-- CON EXTREMO CUIDADO

DELETE FROM usuarios
WHERE is_deleted = true
  AND deleted_at < NOW() - INTERVAL '1 year'
  AND NOT EXISTS (
    -- Verificar que no tenga referencias críticas
    SELECT 1 FROM comisiones WHERE usuario_id = usuarios.id
  );
```

**⚠️ ADVERTENCIA:** No recomendado. Mejor mantener soft delete permanente.

## Recuperación de Usuario Eliminado

Si un usuario fue eliminado por error:

```sql
-- Restaurar usuario (ejecutar en SQL Editor de Supabase)
UPDATE usuarios
SET
  is_deleted = false,
  deleted_at = NULL,
  deleted_by_user_id = NULL,
  estado = 'activo',
  activo = true,
  updated_at = NOW()
WHERE id = 'UUID_DEL_USUARIO';

-- Registrar en auditoría
INSERT INTO audit_logs (action, performed_by, target_user_id, details)
VALUES (
  'USER_RESTORE',
  'UUID_DEL_ADMIN',
  'UUID_DEL_USUARIO',
  '{"reason": "Restaurado por error"}'::jsonb
);
```

## Migraciones Aplicadas

1. `add_soft_delete_to_usuarios.sql`
   - Agrega campos is_deleted, deleted_at, deleted_by_user_id, estado

2. `create_audit_logs_table.sql`
   - Crea tabla de auditoría completa

3. `update_safe_delete_user_to_soft_delete.sql`
   - Actualiza función a soft delete con validaciones

4. `block_deleted_users_from_login.sql`
   - Crea función check_user_can_login

5. `update_rls_exclude_deleted_users.sql`
   - Actualiza políticas RLS para filtrar eliminados

## Soporte y Troubleshooting

### Usuario no puede ser eliminado

**Posibles causas:**
1. Es el último administrador activo
2. Intenta auto-eliminarse
3. Usuario ya está eliminado

**Solución:** Ver mensaje de error específico

### Usuario eliminado sigue apareciendo

**Posible causa:** Caché del navegador

**Solución:**
1. Recargar página (F5)
2. Limpiar caché del navegador

### Error al eliminar

**Verificar:**
1. Usuario actual es Administrador
2. Usuario a eliminar existe
3. Ver logs del edge function en Supabase Dashboard

## Contacto y Documentación Adicional

**Documentos Relacionados:**
- `SOLUCION_ELIMINACION_USUARIOS.md` - Solución anterior (hard delete)
- `DEBUG_ELIMINACION_USUARIOS.md` - Guía de debugging

**Archivos Clave:**
- Base de datos: `supabase/migrations/*soft_delete*.sql`
- Edge Function: `supabase/functions/delete-user/index.ts`
- Frontend: `src/pages/Directorio.tsx`
- Auth: `src/contexts/AuthContext.tsx`

---

**Versión:** 1.0
**Fecha:** Diciembre 2024
**Sistema:** MOVI Digital
**Estado:** ✅ Producción
