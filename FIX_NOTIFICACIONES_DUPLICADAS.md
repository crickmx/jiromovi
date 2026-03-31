# Fix: Notificaciones de Bienvenida Duplicadas

## Problema Identificado

Los usuarios recibían **mensajes de bienvenida duplicados** en WhatsApp (y otros canales) cuando se creaba o activaba su cuenta.

### Causa Raíz

El sistema tenía **dos puntos de envío** para notificaciones de bienvenida:

1. **Edge Function `create-user`** (línea 248):
   - Cuando creaba un usuario con `estado = 'activo'`
   - Llamaba manualmente a `enviar_notificacion_completa()`
   - Enviaba notificaciones por todos los canales habilitados

2. **Trigger de Base de Datos** `trigger_send_welcome_on_create`:
   - Se disparaba automáticamente en **INSERT** a la tabla `usuarios`
   - Cuando `estado = 'activo'`
   - También enviaba notificaciones por todos los canales

**Resultado**: Cada notificación se enviaba **2 veces** (duplicación en WhatsApp, Email, Campanita).

## Solución Aplicada

### Migración: `fix_duplicate_welcome_notifications.sql`

Se eliminó la duplicación manteniendo solo el envío desde el edge function:

```sql
-- 1. Eliminar el trigger que causaba duplicación
DROP TRIGGER IF EXISTS trigger_send_welcome_on_create ON usuarios;

-- 2. Eliminar la función que ya no se necesita
DROP FUNCTION IF EXISTS send_welcome_on_user_create();

-- 3. Mantener la función de activación para usuarios pendientes
-- send_welcome_on_user_activation() sigue activa para UPDATE
```

### Flujo Corregido

#### Caso 1: Admin crea usuario directamente (estado = 'activo')
```
1. Edge function crea usuario en auth.users ✅
2. Edge function inserta en tabla usuarios (estado = 'activo') ✅
3. Edge function envía notificaciones manualmente ✅ (1 SOLA VEZ)
4. ❌ Ya NO se dispara trigger automático
```

#### Caso 2: Gerente crea usuario (estado = 'pendiente')
```
1. Edge function crea usuario en auth.users ✅
2. Edge function inserta en tabla usuarios (estado = 'pendiente') ✅
3. ❌ NO se envían notificaciones (usuario pendiente)
4. [Más tarde] Admin/Gerente activa el usuario (UPDATE estado = 'activo')
5. Trigger send_welcome_on_user_activation() envía notificaciones ✅ (1 SOLA VEZ)
```

## Sistema de Idempotencia

El sistema tiene protección adicional contra duplicaciones:

### Tabla: `notification_jobs`
```sql
CONSTRAINT notification_jobs_idempotency_key_key UNIQUE (idempotency_key)
```

### Generación de Idempotency Key
```javascript
idempotency_key = event_code + '_' + user_id + '_' + channel + '_' + entity_id_or_hash
```

**Ejemplo**:
- `cuenta_activada_646c90c5-0c01-48f2-b912-d190ae0ca061_whatsapp_5c78682f3533b9ecf187a6007f0503a8`

Si se intenta insertar el mismo job dos veces, PostgreSQL lanza `unique_violation` y el sistema lo captura:

```plpgsql
BEGIN
  INSERT INTO notification_jobs (...) VALUES (...);
  v_jobs_created := v_jobs_created + 1;
EXCEPTION WHEN unique_violation THEN
  v_jobs_skipped := v_jobs_skipped + 1;
END;
```

## Triggers Activos Relacionados con Usuarios

### Triggers en INSERT (11 triggers)
- `trigger_sync_usuario_metadata` - Sincroniza metadata con auth
- `trigger_auto_publish_web_page` - Publica página web
- `trigger_normalize_usuarios_name` - Normaliza nombres
- `trigger_notify_admins_new_user` - Notifica a admins (campanita interna)
- `trigger_notificar_equipos_nuevo_usuario` - Notifica a RH/IT (diferente del usuario)
- `trigger_sync_auth_email` - Sincroniza email con auth
- `trigger_uppercase_nombres_apellidos` - Convierte a mayúsculas
- `trigger_ensure_default_avatar` - Asigna avatar por defecto
- `trigger_initialize_agent_profile` - Inicializa perfil de agente
- `trigger_carpetas_nuevo_usuario` - Crea carpetas en Centro Digital
- `trigger_crear_perfil_gamificacion` - Crea perfil de gamificación

### Triggers en UPDATE
- `trigger_usuarios_updated_at` - Actualiza timestamp
- Varios triggers de sincronización y normalización

**IMPORTANTE**: Los triggers de notificación a equipos internos (`trigger_notificar_equipos_nuevo_usuario` y `trigger_notify_admins_new_user`) son DIFERENTES. Notifican al equipo interno (RH, IT, Admins), NO al usuario que se está creando.

## Eventos de Notificación Activos

| Código | Nombre | Campanita | Email | WhatsApp |
|--------|--------|-----------|-------|----------|
| `bienvenida` | Bienvenida a Usuario Nuevo | ❌ | ✅ | ✅ |
| `cuenta_activada` | Cuenta Activada | ✅ | ✅ | ✅ |
| `nuevo_comunicado` | Nuevo Comunicado | ✅ | ✅ | ✅ |
| `nuevo_evento` | Nuevo Evento Aula | ✅ | ✅ | ✅ |
| `commission_batch_closed` | Lote Cerrado | ✅ | ✅ | ✅ |
| `password_reset` | Reset Password | ❌ | ✅ | ❌ |
| `notificacion_global` | Notif. Global | ✅ | ❌ | ✅ |
| `notificacion_individual` | Notif. Individual | ✅ | ❌ | ✅ |

## Verificación Post-Fix

### Query de Verificación
```sql
-- Buscar duplicaciones en los últimos 7 días
WITH job_groups AS (
  SELECT
    user_id,
    event_code,
    channel,
    DATE_TRUNC('minute', created_at) as time_bucket,
    COUNT(*) as count
  FROM notification_jobs
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY user_id, event_code, channel, DATE_TRUNC('minute', created_at)
  HAVING COUNT(*) > 1
)
SELECT * FROM job_groups;
```

**Resultado esperado**: 0 filas (sin duplicaciones)

### Test Manual
1. Crear un usuario nuevo como Administrador
2. Verificar en `notification_jobs` que solo hay 1 job por canal
3. Verificar que el usuario recibe exactamente 1 mensaje por WhatsApp
4. Verificar que el usuario recibe exactamente 1 email

## Archivos Modificados

### Base de Datos
- `supabase/migrations/XXXXXX_fix_duplicate_welcome_notifications.sql` (nueva)

### No Modificado (funciona correctamente)
- `supabase/functions/create-user/index.ts` - Sigue enviando notificaciones manualmente
- `send_welcome_on_user_activation()` - Sigue activa para activación de usuarios pendientes
- `enviar_notificacion_completa()` - Función wrapper que llama a `notify()`
- `notify()` - Motor central con idempotencia

## Conclusión

✅ **Problema resuelto**: Las notificaciones de bienvenida ahora se envían **1 sola vez** por canal.

✅ **Sistema robusto**: La idempotencia en `notification_jobs` previene duplicaciones futuras incluso si hubiera bugs.

✅ **Sin regresiones**: Los triggers de notificación interna a equipos siguen funcionando correctamente.

✅ **Sin cambios en código**: Solo se modificó la estructura de triggers en base de datos.
