# Sistema de Notificaciones de Comisiones

## Descripción General

Cuando un administrador cierra un lote de comisiones, el sistema automáticamente envía notificaciones a todos los agentes que generaron comisiones en ese lote mediante **3 canales simultáneos**:

1. **Campanita (In-App)** - Notificación dentro de la aplicación
2. **Email** - Correo electrónico via Resend
3. **WhatsApp** - Mensaje via Wazzup24

## Flujo de Trabajo

### 1. Cierre de Lote
- **Archivo**: `src/pages/ComisionesLote.tsx` (líneas 124-274)
- **Acción**: Al hacer clic en "Cerrar Lote"
- El sistema:
  1. Valida los detalles del lote
  2. Calcula los valores fiscales
  3. Actualiza el status a `closed`
  4. Llama a la Edge Function de notificaciones

### 2. Edge Function Principal
- **Archivo**: `supabase/functions/send-commission-batch-notifications/index.ts`
- **Endpoint**: `/functions/v1/send-commission-batch-notifications`

#### Proceso:
1. **Obtiene datos del lote** (líneas 80-89)
2. **Obtiene detalles de comisiones** con información de agentes (líneas 93-115)
3. **Agrupa comisiones por agente** (líneas 119-144)
4. **Carga plantilla de notificación** (líneas 148-163)
   - Busca: `commission_batch_closed_agent`
   - Debe estar activa (`is_active = true`)
5. **Por cada agente** (líneas 173-292):
   - Renderiza las plantillas con variables
   - Envía notificación in-app (campanita)
   - Envía email
   - Envía WhatsApp

### 3. Variables Disponibles en Plantillas

Todas las plantillas tienen acceso a estas variables:

```typescript
{
  agent_name: "Nombre del Agente",
  office_name: "Nombre de la Oficina",
  week_number: 42,
  period_start: "1 de enero de 2025",
  period_end: "7 de enero de 2025",
  net_commission_total: "$12,345.00 MXN",
  orden_de_pago_url: "/mis-comisiones"
}
```

## Plantilla de Notificación

**Event Key**: `commission_batch_closed_agent`
**Archivo**: `supabase/migrations/20251211162910_create_transactional_notifications.sql`

### Email Subject
```
Tus comisiones de la semana {{week_number}} ya están listas
```

### Email Body (HTML)
```html
<p>Hola <strong>{{agent_name}}</strong>,</p>
<br>
<p>Te informamos que tus comisiones de la <strong>semana {{week_number}}</strong>
(periodo del <strong>{{period_start}}</strong> al <strong>{{period_end}}</strong>)
han sido calculadas.</p>
<br>
<p><strong>Total de comisiones netas:</strong> ${{net_commission_total}} MXN</p>
<br>
<p>Puedes consultar el detalle y descargar tu Orden de Pago en el siguiente enlace:</p>
<p><a href="{{orden_de_pago_url}}" style="background-color: #0066cc; color: white;
padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
Descargar Orden de Pago</a></p>
<br>
<p>Atentamente,<br>Equipo de Comisiones</p>
```

### WhatsApp Body
```
Hola {{agent_name}} 👋

Tus comisiones de la semana {{week_number}} ({{period_start}} a {{period_end}})
ya están listas.

Total neto: ${{net_commission_total}} MXN

Puedes ver el detalle y descargar tu Orden de Pago aquí:
{{orden_de_pago_url}}
```

### In-App Notification
- **Título**: `Comisiones semana {{week_number}} listas`
- **Cuerpo**: `Tus comisiones del periodo {{period_start}} al {{period_end}} ya están disponibles. Total neto: ${{net_commission_total}} MXN. Haz clic para ver tu Orden de Pago.`
- **Link**: `/mis-comisiones`

## Configuración Requerida

### Email (Resend)
- **Tabla**: `correo_configuracion`
- **Campos requeridos**:
  - `resend_api_key`: API key de Resend
  - `remitente_email`: Email verificado en Resend
  - `remitente_nombre`: Nombre del remitente
  - `activo`: true

### WhatsApp (Wazzup24)
- **Tabla**: `whatsapp_configuracion`
- **Campos requeridos**:
  - `api_key`: API key de Wazzup24
  - `channel_id_uuid`: UUID del canal de WhatsApp
  - `activo`: true

### Datos del Agente
Para que las notificaciones se envíen correctamente, cada agente debe tener:

1. **Para campanita**:
   - `usuario_id` en tabla `commission_agents`

2. **Para email**:
   - `email_laboral` o `email_personal` en tabla `usuarios`

3. **Para WhatsApp**:
   - `celular_laboral` o `celular_personal` en tabla `usuarios`
   - Formato: 10 dígitos (se normaliza automáticamente a 521+número)

## Funciones Auxiliares

### send-direct-email
- **Archivo**: `supabase/functions/send-direct-email/index.ts`
- **Provider**: Resend
- **Registra**: Historial en `notificaciones_enviadas_log`

### send-direct-whatsapp
- **Archivo**: `supabase/functions/send-direct-whatsapp/index.ts`
- **Provider**: Wazzup24
- **Normalización**: Convierte 10 dígitos a formato 521+número
- **Registra**: Historial en `notificaciones_enviadas_log`

## Respuesta de la API

Cuando se cierran correctamente el lote y se envían las notificaciones:

```json
{
  "success": true,
  "batch_id": "uuid-del-lote",
  "agents_notified": 5,
  "results": [
    {
      "agent_id": "uuid",
      "agent_name": "Juan Pérez",
      "notifications_sent": {
        "in_app": true,
        "email": true,
        "whatsapp": true
      }
    }
  ]
}
```

## Logs y Debugging

Los logs están disponibles en:
- **Edge Function logs**: Ver en Supabase Dashboard > Edge Functions
- **Historial de envíos**: Tabla `notificaciones_enviadas_log`
- **Console logs**: La función imprime logs detallados de cada paso

### Ejemplo de logs:
```
=== START: Commission Batch Notifications ===
Batch ID: xxx
Batch found: Semana 42
Found 15 commission details
Processing 5 unique agents

Processing agent: Juan Pérez
  Email: juan@example.com
  Phone: 5512345678
  Usuario ID: xxx
  Total commission: 12345.67
  Templates rendered:
    - Email subject: Tus comisiones de la semana 42...
    - WhatsApp: Hola Juan Pérez...
    - InApp title: Comisiones semana 42 listas
  → Sending in-app notification...
  ✓ In-app notification sent
  → Sending email to juan@example.com...
  ✓ Email sent. Resend ID: xxx
  → Sending WhatsApp to 5512345678...
  ✓ WhatsApp sent to 5215512345678

=== SUMMARY ===
Total agents processed: 5
Batch ID: xxx
=== END ===
```

## Solución de Problemas

### No se envían notificaciones
1. Verificar que la plantilla esté activa:
   ```sql
   SELECT * FROM transactional_notification_templates
   WHERE event_key = 'commission_batch_closed_agent';
   ```

2. Verificar configuración de email:
   ```sql
   SELECT * FROM correo_configuracion WHERE activo = true;
   ```

3. Verificar configuración de WhatsApp:
   ```sql
   SELECT * FROM whatsapp_configuracion WHERE activo = true;
   ```

4. Verificar datos del agente:
   ```sql
   SELECT u.email_laboral, u.email_personal, u.celular_laboral, u.celular_personal
   FROM usuarios u
   JOIN commission_agents ca ON ca.usuario_id = u.id
   WHERE ca.id = 'agent-id';
   ```

### Email falla
- Verificar que el dominio esté verificado en Resend
- Verificar que la API key sea válida
- Revisar logs de Resend para más detalles

### WhatsApp falla
- Verificar que el canal esté conectado en Wazzup24
- Verificar formato del teléfono (debe ser 10 dígitos)
- Revisar logs de Wazzup24 para más detalles

## Editar Plantillas

Para editar las plantillas, actualizar directamente en la base de datos:

```sql
UPDATE transactional_notification_templates
SET
  email_subject_template = 'Nuevo asunto...',
  email_body_template = '<p>Nuevo cuerpo...</p>',
  whatsapp_body_template = 'Nuevo mensaje...',
  inapp_title_template = 'Nuevo título...',
  inapp_body_template = 'Nuevo cuerpo...'
WHERE event_key = 'commission_batch_closed_agent';
```

## Importante

- ✅ Las notificaciones se envían **automáticamente** al cerrar el lote
- ✅ No requiere acción manual del usuario
- ✅ Todos los canales se intentan enviar, incluso si uno falla
- ✅ Los envíos se registran en el historial para auditoría
- ✅ Las variables se reemplazan automáticamente en tiempo real
