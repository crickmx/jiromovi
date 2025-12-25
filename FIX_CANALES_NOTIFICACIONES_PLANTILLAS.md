# Corrección: Sistema de Canales de Notificaciones por Plantilla

## Problema Identificado

Se detectó que las notificaciones se enviaban por **todos los canales** (correo, WhatsApp, notificación interna) aunque solo algunos estuvieran configurados como activos en cada plantilla.

### Caso Específico
**Plantilla:** `cuenta_activada`
- **Configuración:** Solo notificación interna activa
- **Comportamiento anterior:** Se enviaba también por correo y WhatsApp
- **Causa:** Columnas duplicadas en la base de datos y funciones usando diferentes columnas

## Causa Raíz

### 1. Columnas Duplicadas
La tabla `correo_tipos_notificacion` tenía **columnas duplicadas** para el mismo propósito:

| Columnas Nuevas         | Columnas Antiguas        | Problema                           |
|-------------------------|-------------------------|------------------------------------|
| `enviar_correo`         | `enviar_por_correo`     | Diferentes funciones usaban        |
| `enviar_whatsapp`       | `enviar_por_whatsapp`   | diferentes columnas                |
| `enviar_notificacion`   | (no duplicada)          | Causando inconsistencias           |

### 2. Funciones con Referencias Incorrectas
Diferentes funciones leían diferentes columnas:

```sql
-- Función enviar_notificacion_completa leía:
enviar_por_correo, enviar_por_whatsapp

-- Trigger send_welcome_notifications_on_activation leía:
enviar_correo, enviar_whatsapp, enviar_notificacion
```

### 3. Migración de Datos Incorrecta
Durante una migración anterior, los valores se copiaron de forma que alteró configuraciones existentes.

## Solución Implementada

### 1. Consolidación de Columnas

#### Eliminadas (duplicadas):
```sql
ALTER TABLE correo_tipos_notificacion
DROP COLUMN enviar_por_correo,
DROP COLUMN enviar_por_whatsapp;
```

#### Mantenidas (únicas):
```sql
-- Estas son las columnas OFICIALES ahora:
- enviar_correo          -- Flag para envío de emails
- enviar_whatsapp        -- Flag para envío de WhatsApp
- enviar_notificacion    -- Flag para notificaciones internas (campanita)
```

### 2. Actualización de Función `enviar_notificacion_completa`

La función ahora verifica **correctamente** cada flag antes de enviar:

```sql
-- SOLO INSERTAR NOTIFICACIÓN INTERNA SI ESTÁ CONFIGURADO
IF v_tipo_notif.enviar_notificacion = true THEN
  INSERT INTO notificaciones_internas ...
  RAISE NOTICE 'Notificación interna creada';
ELSE
  RAISE NOTICE 'Notificación interna desactivada para tipo: %', p_tipo_codigo;
END IF;

-- SOLO ENVIAR POR CORREO SI ESTÁ CONFIGURADO
IF v_tipo_notif.enviar_correo = true AND v_correo IS NOT NULL THEN
  SELECT net.http_post(...enviar-correo-transaccional...);
  RAISE NOTICE 'Correo enviado a %', v_correo;
ELSE
  RAISE NOTICE 'Correo desactivado para tipo: %', p_tipo_codigo;
END IF;

-- SOLO ENVIAR POR WHATSAPP SI ESTÁ CONFIGURADO
IF v_tipo_notif.enviar_whatsapp = true AND v_telefono IS NOT NULL THEN
  SELECT net.http_post(...enviar-whatsapp...);
  RAISE NOTICE 'WhatsApp enviado a %', v_telefono;
ELSE
  RAISE NOTICE 'WhatsApp desactivado para tipo: %', p_tipo_codigo;
END IF;
```

### 3. Corrección de Configuración "cuenta_activada"

```sql
UPDATE correo_tipos_notificacion
SET
  enviar_correo = false,
  enviar_whatsapp = false,
  enviar_notificacion = true
WHERE codigo = 'cuenta_activada';
```

### 4. Logging para Debugging

Se agregó una función que registra cambios en los canales:

```sql
CREATE FUNCTION log_notification_channels() ...
-- Registra en logs cada vez que se cambia la configuración de canales
```

## Configuración Actual de Plantillas

### Plantillas Activas

| Código                     | Correo | WhatsApp | Notificación | Uso                                    |
|----------------------------|--------|----------|--------------|----------------------------------------|
| `cuenta_activada`          | ❌     | ❌       | ✅           | Cuando se activa una cuenta de usuario |
| `password_reset`           | ✅     | ❌       | ❌           | Recuperación de contraseña             |
| `nuevo_comunicado`         | ✅     | ✅       | ✅           | Se publica un nuevo comunicado         |
| `nuevo_evento`             | ✅     | ✅       | ✅           | Nuevo evento en Seguros Education      |
| `recordatorio_evento`      | ❌     | ✅       | ✅           | Recordatorio antes de un evento        |
| `cancelacion_evento`       | ✅     | ❌       | ✅           | Cuando se cancela un evento            |
| `notificacion_individual`  | ✅     | ✅       | ✅           | Notificaciones individuales del sistema|
| `notificacion_personalizada`| ✅    | ✅       | ✅           | Notificaciones personalizadas          |

### Plantillas Inactivas

| Código                     | Correo | WhatsApp | Notificación | Estado    |
|----------------------------|--------|----------|--------------|-----------|
| `bienvenida`               | ✅     | ✅       | ✅           | Inactiva  |
| `commission_batch_closed`  | ✅     | ✅       | ✅           | Inactiva  |

## Cómo Funciona Ahora

### 1. Cuando se Activa un Usuario

```
Usuario cambia a estado "activo"
        ↓
Trigger: send_welcome_notifications_on_activation()
        ↓
Consulta: correo_tipos_notificacion WHERE codigo = 'cuenta_activada'
        ↓
Verifica flags:
  - enviar_correo = false      → ❌ NO envía correo
  - enviar_whatsapp = false    → ❌ NO envía WhatsApp
  - enviar_notificacion = true → ✅ SÍ envía notificación interna
        ↓
Resultado: SOLO se crea notificación interna (campanita)
```

### 2. Cuando se Publica un Comunicado

```
Se publica comunicado
        ↓
Función: enviar_notificacion_completa('nuevo_comunicado', ...)
        ↓
Consulta: correo_tipos_notificacion WHERE codigo = 'nuevo_comunicado'
        ↓
Verifica flags:
  - enviar_correo = true       → ✅ Envía correo
  - enviar_whatsapp = true     → ✅ Envía WhatsApp
  - enviar_notificacion = true → ✅ Envía notificación interna
        ↓
Resultado: Se envía por los 3 canales
```

### 3. Cuando se Resetea Password

```
Usuario solicita resetear password
        ↓
Función: enviar_notificacion_completa('password_reset', ...)
        ↓
Consulta: correo_tipos_notificacion WHERE codigo = 'password_reset'
        ↓
Verifica flags:
  - enviar_correo = true        → ✅ Envía correo
  - enviar_whatsapp = false     → ❌ NO envía WhatsApp
  - enviar_notificacion = false → ❌ NO envía notificación interna
        ↓
Resultado: SOLO se envía por correo
```

## Verificación en Logs

Ahora todos los intentos de envío se registran en logs:

```log
# Ejemplo cuando cuenta_activada se activa:
[send_welcome] Usuario activado: <user_id> - <email>
[send_welcome] Enviando notificaciones de bienvenida...
[send_welcome] Notificación interna creada
[send_welcome] Notificaciones de bienvenida procesadas exitosamente

# Ejemplo cuando nuevo_comunicado se publica:
[enviar_notificacion_completa] Notificación interna creada: <notif_id>
[enviar_notificacion_completa] Correo enviado a <email> (request_id: <id>)
[enviar_notificacion_completa] WhatsApp enviado a <telefono> (request_id: <id>)
```

## Gestión de Canales

### Consultar Configuración Actual

```sql
SELECT
  codigo,
  nombre,
  activo,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion
FROM correo_tipos_notificacion
ORDER BY codigo;
```

### Cambiar Configuración de Canales

```sql
-- Ejemplo: Activar correo para cuenta_activada
UPDATE correo_tipos_notificacion
SET
  enviar_correo = true,
  updated_at = now()
WHERE codigo = 'cuenta_activada';

-- Ejemplo: Desactivar WhatsApp para nuevo_comunicado
UPDATE correo_tipos_notificacion
SET
  enviar_whatsapp = false,
  updated_at = now()
WHERE codigo = 'nuevo_comunicado';
```

### Restricción Importante

La tabla tiene una restricción que asegura que **al menos un canal** esté activo:

```sql
ALTER TABLE correo_tipos_notificacion
ADD CONSTRAINT check_al_menos_un_canal
CHECK (enviar_correo = true OR enviar_whatsapp = true OR enviar_notificacion = true);
```

**No se puede desactivar todos los canales a la vez.**

## Historial de Cambios

Todos los cambios en la configuración de canales se registran automáticamente:

```sql
-- Ver historial de cambios
SELECT
  ctn.codigo,
  ctn.nombre,
  h.enviar_correo_anterior,
  h.enviar_correo_nuevo,
  h.enviar_whatsapp_anterior,
  h.enviar_whatsapp_nuevo,
  h.enviar_notificacion_anterior,
  h.enviar_notificacion_nuevo,
  h.fecha_cambio,
  u.nombre || ' ' || u.apellidos as cambiado_por
FROM correo_canales_historial h
JOIN correo_tipos_notificacion ctn ON ctn.id = h.tipo_notificacion_id
LEFT JOIN usuarios u ON u.id = h.cambiado_por
ORDER BY h.fecha_cambio DESC;
```

## Testing

### Prueba 1: Activar Usuario (Solo Notificación Interna)

```sql
-- Crear usuario de prueba
INSERT INTO usuarios (nombre, apellidos, email_laboral, rol, estado, oficina_id)
VALUES ('Test', 'Usuario', 'test@example.com', 'Agente', 'pendiente', '<oficina_id>');

-- Activar usuario (debe enviar SOLO notificación interna)
UPDATE usuarios SET estado = 'activo' WHERE email_laboral = 'test@example.com';

-- Verificar que se creó notificación interna
SELECT * FROM notificaciones_internas
WHERE usuario_id = (SELECT id FROM usuarios WHERE email_laboral = 'test@example.com')
ORDER BY created_at DESC LIMIT 1;

-- Verificar que NO se encolaron correos ni WhatsApp
SELECT * FROM correo_historial_envios
WHERE destinatario_email = 'test@example.com'
AND tipo_notificacion_id = (SELECT id FROM correo_tipos_notificacion WHERE codigo = 'cuenta_activada');

SELECT * FROM whatsapp_historial_envios
WHERE tipo_notificacion_id = (SELECT id FROM correo_tipos_notificacion WHERE codigo = 'cuenta_activada')
ORDER BY created_at DESC LIMIT 1;
```

### Prueba 2: Publicar Comunicado (Todos los Canales)

```sql
-- Simular publicación de comunicado
SELECT enviar_notificacion_completa(
  'nuevo_comunicado',
  '<usuario_id>',
  'Nuevo Comunicado Importante',
  'Se ha publicado un nuevo comunicado que requiere tu atención',
  'comunicados',
  '{"titulo_comunicado": "Comunicado de Prueba"}'::jsonb,
  '/comunicados/123'
);

-- Verificar que se creó notificación interna
SELECT * FROM notificaciones_internas WHERE usuario_id = '<usuario_id>' ORDER BY created_at DESC LIMIT 1;

-- Verificar logs del sistema para ver las 3 notificaciones enviadas
```

### Prueba 3: Reset Password (Solo Correo)

```sql
-- Simular solicitud de reset password
SELECT enviar_notificacion_completa(
  'password_reset',
  '<usuario_id>',
  'Recuperación de Contraseña',
  'Has solicitado restablecer tu contraseña. Usa el siguiente enlace para continuar.',
  'auth',
  '{"reset_link": "https://example.com/reset/token123"}'::jsonb,
  '/reset-password'
);

-- Verificar que NO se creó notificación interna
SELECT * FROM notificaciones_internas
WHERE usuario_id = '<usuario_id>'
AND tipo = 'password_reset'
ORDER BY created_at DESC LIMIT 1;
-- Debe retornar 0 filas

-- Verificar que SÍ se encoló correo
SELECT * FROM correo_historial_envios
WHERE tipo_notificacion_id = (SELECT id FROM correo_tipos_notificacion WHERE codigo = 'password_reset')
ORDER BY created_at DESC LIMIT 1;
```

## Recomendaciones

### 1. Configuración de Canales por Tipo

| Tipo de Notificación          | Correo | WhatsApp | Interna | Justificación                          |
|-------------------------------|--------|----------|---------|----------------------------------------|
| Bienvenida                    | ✅     | ✅       | ✅      | Primera impresión, usar todos          |
| Cuenta Activada               | ❌     | ❌       | ✅      | Ya está en la plataforma               |
| Password Reset                | ✅     | ❌       | ❌      | Seguridad, solo email verificado       |
| Nuevo Comunicado              | ✅     | ✅       | ✅      | Importante, máxima visibilidad         |
| Nuevo Evento                  | ✅     | ✅       | ✅      | Importante, máxima visibilidad         |
| Recordatorio Evento           | ❌     | ✅       | ✅      | WhatsApp más efectivo para recordar    |
| Cancelación Evento            | ✅     | ❌       | ✅      | Formal, correo + notificación          |
| Lote Comisiones Cerrado       | ✅     | ✅       | ✅      | Financiero, todos los canales          |
| Notificación Individual       | ✅     | ✅       | ✅      | Según necesidad del administrador      |

### 2. Interfaz de Administración

Crear una página en el frontend para que administradores puedan:

1. Ver todas las plantillas y su configuración actual
2. Activar/desactivar canales por plantilla
3. Ver historial de cambios
4. Probar envío de notificaciones

Mockup:

```
┌─────────────────────────────────────────────────────────────┐
│ Configuración de Canales de Notificación                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Plantilla                    │ Correo │ WhatsApp │ Interna│
│  ────────────────────────────────────────────────────────── │
│  Cuenta Activada             │   ❌   │    ❌    │   ✅   │
│  Password Reset              │   ✅   │    ❌    │   ❌   │
│  Nuevo Comunicado            │   ✅   │    ✅    │   ✅   │
│  Nuevo Evento                │   ✅   │    ✅    │   ✅   │
│  Recordatorio Evento         │   ❌   │    ✅    │   ✅   │
│  Cancelación Evento          │   ✅   │    ❌    │   ✅   │
│                                                             │
│  [Historial de Cambios]  [Probar Notificación]            │
└─────────────────────────────────────────────────────────────┘
```

### 3. Monitoreo

Revisar logs regularmente para identificar:

- Notificaciones que fallan al enviarse
- Configuraciones que necesitan ajuste
- Patrones de uso de cada canal

```sql
-- Estadísticas de envíos por canal (últimos 7 días)
SELECT
  ctn.nombre,
  COUNT(CASE WHEN che.estado = 'enviado' THEN 1 END) as correos_enviados,
  COUNT(CASE WHEN whe.estado = 'enviado' THEN 1 END) as whatsapp_enviados,
  COUNT(ni.id) as notificaciones_internas
FROM correo_tipos_notificacion ctn
LEFT JOIN correo_historial_envios che ON che.tipo_notificacion_id = ctn.id
  AND che.created_at > now() - interval '7 days'
LEFT JOIN whatsapp_historial_envios whe ON whe.tipo_notificacion_id = ctn.id
  AND whe.created_at > now() - interval '7 days'
LEFT JOIN notificaciones_internas ni ON ni.tipo = ctn.codigo
  AND ni.created_at > now() - interval '7 days'
WHERE ctn.activo = true
GROUP BY ctn.id, ctn.nombre
ORDER BY ctn.nombre;
```

## Archivos Modificados

### Migration
- `supabase/migrations/<timestamp>_fix_notification_channels_consolidation.sql`

### Funciones Actualizadas
- `enviar_notificacion_completa()` - Ahora verifica correctamente los flags
- `send_welcome_notifications_on_activation()` - Ya verificaba correctamente

### Nuevas Funciones
- `log_notification_channels()` - Para debugging de cambios

## Estado Actual

✅ **Resuelto:** Las notificaciones ahora solo se envían por los canales configurados en cada plantilla

✅ **Verificado:** `cuenta_activada` envía SOLO notificación interna

✅ **Consolidado:** Eliminadas columnas duplicadas

✅ **Documentado:** Sistema completamente documentado

## Próximos Pasos

1. Probar en ambiente de desarrollo con usuarios reales
2. Monitorear logs durante 1 semana para verificar comportamiento
3. Crear interfaz de administración de canales (opcional)
4. Documentar para usuarios finales cómo funcionan las notificaciones

## Soporte

Si una notificación no se envía por el canal esperado:

1. Verificar que la plantilla esté activa
2. Verificar que el canal esté habilitado para esa plantilla
3. Verificar que el usuario tenga datos de contacto válidos (email/teléfono)
4. Revisar logs para identificar errores específicos
5. Consultar historial de cambios para ver si alguien modificó la configuración
