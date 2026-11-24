# ✅ Checklist de Verificación - Notificaciones de Comisiones

## Sistema Completamente Implementado

Al cerrar un lote de comisiones, el sistema **automáticamente** envía notificaciones por 3 canales:
- 🔔 **Campanita** (notificación in-app)
- 📧 **Email** (vía Resend)
- 💬 **WhatsApp** (vía Wazzup24)

---

## Pre-requisitos para Funcionamiento

### 1. Plantilla de Notificación ✅

Verificar que existe y está activa:

```sql
SELECT
  event_key,
  name,
  is_active,
  created_at
FROM transactional_notification_templates
WHERE event_key = 'commission_batch_closed_agent';
```

**Resultado esperado:**
- `is_active = true`
- Plantilla con contenido en todos los campos

---

### 2. Configuración de Email ✅

Verificar que existe configuración activa:

```sql
SELECT
  remitente_nombre,
  remitente_email,
  resend_api_key IS NOT NULL as tiene_api_key,
  activo
FROM correo_configuracion
WHERE activo = true;
```

**Resultado esperado:**
- `activo = true`
- `resend_api_key` no nulo
- Dominio del email verificado en Resend

**Configurar en:** Módulo de "Notificaciones Transaccionales" > Configuración SMTP

---

### 3. Configuración de WhatsApp ✅

Verificar que existe configuración activa:

```sql
SELECT
  channel_id_uuid,
  api_key IS NOT NULL as tiene_api_key,
  activo
FROM whatsapp_configuracion
WHERE activo = true;
```

**Resultado esperado:**
- `activo = true`
- `api_key` no nulo
- `channel_id_uuid` configurado

**Configurar en:** Módulo de "Notificaciones Transaccionales" > Configuración WhatsApp

---

### 4. Datos de Agentes ✅

Verificar que los agentes tienen datos de contacto:

```sql
SELECT
  u.nombre_completo,
  u.email_laboral,
  u.email_personal,
  u.celular_laboral,
  u.celular_personal,
  ca.id as agent_id,
  ca.usuario_id
FROM usuarios u
JOIN commission_agents ca ON ca.usuario_id = u.id
WHERE ca.id IN (
  SELECT DISTINCT agent_id
  FROM commission_details
  WHERE batch_id = 'ID_DEL_LOTE'
);
```

**Resultado esperado para cada agente:**
- Al menos un email (laboral o personal)
- Al menos un celular (laboral o personal) - 10 dígitos
- `usuario_id` no nulo

**Configurar en:** Módulo de "Usuarios" > Editar datos del agente

---

## Proceso de Cierre de Lote

### Paso 1: Abrir el Lote
1. Ir a **Comisiones** > Ver lote específico
2. Tab **"Por Póliza"** para ver todas las comisiones

### Paso 2: Cerrar el Lote
1. Clic en botón **"Cerrar Lote"** (verde)
2. Confirmar en el diálogo
3. El sistema:
   - Calcula valores fiscales
   - Marca el lote como cerrado
   - Envía notificaciones automáticamente

### Paso 3: Verificar Resultado

**Mensaje de éxito:**
```
✅ Lote cerrado exitosamente!

📧 Notificaciones enviadas a 5 agentes.

Detalles:
- Juan Pérez: ✓ App, ✓ Email, ✓ WhatsApp
- María García: ✓ App, ✓ Email, ✗ WhatsApp
- Carlos López: ✓ App, ✓ Email, ✓ WhatsApp
```

**Interpretación:**
- ✓ = Canal enviado exitosamente
- ✗ = Canal no enviado (falta dato o configuración)

---

## Verificación Manual

### 1. Verificar Campanita (In-App)

**Agente debe ver:**
- Icono de campana con badge de notificación
- Al hacer clic: Notificación con título "Comisiones semana XX listas"
- Al hacer clic en la notificación: Va a `/mis-comisiones`

**Verificar en base de datos:**
```sql
SELECT
  title,
  body,
  link_url,
  is_read,
  created_at
FROM notifications
WHERE user_id = 'ID_DEL_USUARIO'
ORDER BY created_at DESC
LIMIT 5;
```

---

### 2. Verificar Email

**Agente debe recibir:**
- Asunto: "Tus comisiones de la semana XX ya están listas"
- Cuerpo con detalles de comisiones
- Botón para ver Orden de Pago

**Verificar en base de datos:**
```sql
SELECT
  tipo_notificacion_codigo,
  canal_envio,
  destinatario_email,
  asunto,
  estado,
  error_mensaje,
  created_at
FROM notificaciones_enviadas_log
WHERE canal_envio = 'correo'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Verificar en Resend Dashboard:**
- https://resend.com/emails
- Buscar por email del agente
- Ver estado de entrega

---

### 3. Verificar WhatsApp

**Agente debe recibir:**
- Mensaje en WhatsApp con detalles de comisiones
- Link a la Orden de Pago

**Verificar en base de datos:**
```sql
SELECT
  tipo_notificacion_codigo,
  canal_envio,
  numero_destino,
  cuerpo_html,
  estado,
  error_mensaje,
  created_at
FROM notificaciones_enviadas_log
WHERE canal_envio = 'whatsapp'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Verificar en Wazzup24 Dashboard:**
- https://app.wazzup24.com/
- Ver mensajes enviados
- Verificar entrega

---

## Solución de Problemas

### ❌ "Template not found or inactive"

**Causa:** La plantilla no existe o no está activa

**Solución:**
```sql
-- Verificar plantilla
SELECT * FROM transactional_notification_templates
WHERE event_key = 'commission_batch_closed_agent';

-- Activar si existe
UPDATE transactional_notification_templates
SET is_active = true
WHERE event_key = 'commission_batch_closed_agent';

-- Si no existe, ejecutar migración
-- supabase/migrations/20251211162910_create_transactional_notifications.sql
```

---

### ❌ "No active email configuration found"

**Causa:** No hay configuración de email activa

**Solución:**
1. Ir a **Notificaciones Transaccionales** > **Configuración**
2. Tab **"Configuración SMTP"**
3. Configurar:
   - API Key de Resend
   - Email remitente (debe estar verificado en Resend)
   - Nombre del remitente
4. Activar configuración

---

### ❌ "No active WhatsApp configuration found"

**Causa:** No hay configuración de WhatsApp activa

**Solución:**
1. Ir a **Notificaciones Transaccionales** > **Configuración**
2. Tab **"Configuración WhatsApp"**
3. Configurar:
   - API Key de Wazzup24
   - Channel ID (UUID del canal conectado)
4. Activar configuración

---

### ⚠️ Algunas notificaciones no se envían

**Causa:** Falta información de contacto del agente

**Solución:**
1. Identificar qué agente tiene ✗ en el mensaje de cierre
2. Ir a **Usuarios** > Buscar agente
3. Editar y agregar:
   - Email laboral o personal
   - Celular laboral o personal (10 dígitos)
4. Guardar cambios

**Nota:** Si el agente no tiene `usuario_id` en `commission_agents`, no recibirá notificación in-app

---

### 🔍 Ver Logs Detallados

**En Supabase Dashboard:**
1. Ir a **Edge Functions**
2. Buscar `send-commission-batch-notifications`
3. Ver **Logs** en tiempo real
4. Buscar logs del momento en que se cerró el lote

**Logs incluyen:**
- Batch ID
- Número de agentes procesados
- Estado de cada canal por agente
- Errores específicos si los hay

---

## Prueba Completa

### Escenario de Prueba

1. **Preparar datos:**
   - Crear un lote de comisiones de prueba
   - Asignar comisiones a un agente de prueba
   - Verificar que el agente tenga email y celular

2. **Ejecutar cierre:**
   - Abrir el lote
   - Clic en "Cerrar Lote"
   - Confirmar

3. **Verificar resultado:**
   - Ver mensaje de éxito con 3 checkmarks
   - Iniciar sesión como el agente
   - Verificar campanita con notificación
   - Verificar email en bandeja de entrada
   - Verificar WhatsApp en teléfono

4. **Verificar historial:**
   ```sql
   SELECT * FROM notificaciones_enviadas_log
   WHERE created_at > NOW() - INTERVAL '5 minutes'
   ORDER BY created_at DESC;
   ```

---

## Resumen de Implementación

✅ **Edge Function principal:** `send-commission-batch-notifications`
✅ **Edge Function email:** `send-direct-email`
✅ **Edge Function WhatsApp:** `send-direct-whatsapp`
✅ **Plantilla:** `commission_batch_closed_agent`
✅ **Frontend:** Llama automáticamente al cerrar lote
✅ **Logging:** Registra todos los envíos
✅ **Variables:** Todas disponibles y renderizadas
✅ **Canales:** 3 canales simultáneos (campanita, email, WhatsApp)

---

## Contacto y Soporte

Si después de verificar todos los puntos anteriores sigues teniendo problemas:

1. Revisar logs de Edge Functions en Supabase
2. Verificar logs de Resend (para emails)
3. Verificar logs de Wazzup24 (para WhatsApp)
4. Revisar tabla `notificaciones_enviadas_log` para errores específicos

**Documentación completa:** Ver `SISTEMA_NOTIFICACIONES_COMISIONES.md`
