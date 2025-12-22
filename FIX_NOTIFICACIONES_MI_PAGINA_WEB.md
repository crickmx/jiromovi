# Fix: Notificaciones en Mi Página Web

## Problema Identificado

Al enviar el formulario desde "Mi Página Web", solo se creaba el lead en el CRM pero NO se disparaban las notificaciones por:
- Email
- WhatsApp
- Campanita (notificación interna)

## Causa Raíz

El edge function `submit-web-lead` estaba llamando a la función `enviar_notificacion_completa`, que:
1. Buscaba configuraciones en tablas del sistema legacy
2. No procesaba correctamente las plantillas transaccionales
3. No enviaba las notificaciones por los canales correctos

## Solución Implementada

### 1. Nueva Función de Base de Datos

**Migración:** `create_send_transactional_notification.sql`

Creamos la función `send_transactional_notification` que:

- Busca la plantilla por `event_key` en `transactional_notification_templates`
- Reemplaza variables dinámicas en las plantillas (ej: `{{agent_name}}`, `{{client_name}}`)
- Crea notificación interna (campanita) en tabla `notifications`
- Envía email usando el edge function `enviar-correo-transaccional`
- Envía WhatsApp usando el edge function `enviar-whatsapp`

**Parámetros:**
```sql
send_transactional_notification(
  p_event_key text,        -- 'web_lead_nuevo'
  p_user_id uuid,          -- ID del agente
  p_variables jsonb,       -- Variables para reemplazar en plantillas
  p_link_url text          -- URL de la notificación interna
)
```

**Ejemplo de uso:**
```sql
SELECT send_transactional_notification(
  'web_lead_nuevo',
  '123e4567-e89b-12d3-a456-426614174000',
  '{"agent_name": "Juan Pérez", "client_name": "María García", "client_phone": "5512345678", "client_email": "maria@email.com", "insurance_type": "Seguro de Auto"}'::jsonb,
  '/crm/contactos/abc123'
);
```

### 2. Edge Function Actualizado: submit-web-lead

**Archivo:** `supabase/functions/submit-web-lead/index.ts`

Cambios realizados:
- Cambiamos de `enviar_notificacion_completa` a `send_transactional_notification`
- Pasamos las variables correctamente estructuradas
- Agregamos logging para debugging

**Código actualizado:**
```typescript
const { data: notifId, error: notifError } = await supabase.rpc('send_transactional_notification', {
  p_event_key: 'web_lead_nuevo',
  p_user_id: agente.id,
  p_variables: variables,
  p_link_url: `/crm/contactos/${contactId}`,
});
```

### 3. Edge Function Actualizado: enviar-correo-transaccional

**Archivo:** `supabase/functions/enviar-correo-transaccional/index.ts`

Agregamos soporte para formato directo:

```typescript
interface EmailRequest {
  // Formato directo (nuevo)
  to_email?: string;
  to_name?: string;
  subject?: string;
  html_body?: string;

  // Formato legacy (mantenido)
  tipo?: string;
  destinatario?: string;
  datos?: Record<string, any>;
}
```

**Lógica:**
- Si recibe `to_email`, `subject` y `html_body` → Envía directo
- Si recibe `tipo` y `destinatario` → Busca plantilla (legacy)

**Ventajas:**
- Compatible con ambos sistemas
- No rompe funcionalidad existente
- Más simple y directo para notificaciones transaccionales

### 4. Edge Function Actualizado: enviar-whatsapp

**Archivo:** `supabase/functions/enviar-whatsapp/index.ts`

Agregamos soporte para formato directo:

```typescript
interface WhatsAppRequest {
  // Formato directo (nuevo)
  phone?: string;
  message?: string;

  // Formato legacy (mantenido)
  tipo?: string;
  numero?: string;
  datos?: Record<string, any>;
}
```

**Lógica:**
- Si recibe `phone` y `message` → Envía directo
- Si recibe `tipo` y `numero` → Busca plantilla (legacy)

**Normalización de número:**
- Elimina caracteres no numéricos
- Si tiene 10 dígitos, agrega prefijo `521`
- Ejemplo: `5512345678` → `5215512345678`

## Flujo Completo

1. **Usuario llena formulario** en Mi Página Web
2. **Frontend envía datos** al edge function `submit-web-lead`
3. **Edge function:**
   - Busca al agente por slug
   - Crea/actualiza contacto en CRM
   - Crea tarea de seguimiento
   - **Llama a `send_transactional_notification`**
4. **Función de base de datos:**
   - Busca plantilla `web_lead_nuevo`
   - Reemplaza variables en plantillas
   - **Crea notificación interna (campanita)**
   - **Dispara email vía pg_net → enviar-correo-transaccional**
   - **Dispara WhatsApp vía pg_net → enviar-whatsapp**
5. **Agente recibe 3 notificaciones:**
   - Email con detalles del lead
   - WhatsApp con resumen del lead
   - Campanita en la plataforma con link al contacto

## Plantilla de Notificación

La plantilla `web_lead_nuevo` ya existe en la base de datos:

**Email:**
```
Asunto: 🎯 Nuevo Lead desde Tu Página Web

Hola {{agent_name}},

¡Excelente noticia! Tienes un nuevo prospecto desde tu página web.

📋 Datos del prospecto:
• Nombre: {{client_name}}
• Celular: {{client_phone}}
• Email: {{client_email}}
• Seguro de interés: {{insurance_type}}

✅ Acciones realizadas automáticamente:
• Contacto creado en tu CRM
• Tarea de seguimiento asignada

💡 Siguiente paso: Contacta al cliente lo antes posible para aprovechar su interés.
```

**WhatsApp:**
```
🎯 *Nuevo Lead desde Tu Página Web*

Hola {{agent_name}},

¡Tienes un nuevo prospecto!

📋 *Datos del prospecto:*
• Nombre: {{client_name}}
• Celular: {{client_phone}}
• Email: {{client_email}}
• Seguro: {{insurance_type}}

✅ Ya creamos el contacto en tu CRM y una tarea de seguimiento.

💡 *Acción:* Contacta al cliente lo antes posible.
```

**Campanita:**
```
Título: Nuevo Lead: {{client_name}}

Mensaje: ¡Nuevo prospecto desde tu página web! {{client_name}} está interesado en {{insurance_type}}. Celular: {{client_phone}}, Email: {{client_email}}. Ya creamos el contacto y una tarea en tu CRM.
```

## Variables Disponibles

Las siguientes variables se reemplazan automáticamente en las plantillas:

- `{{agent_name}}` - Nombre completo del agente
- `{{client_name}}` - Nombre del prospecto
- `{{client_phone}}` - Celular del prospecto
- `{{client_email}}` - Email del prospecto
- `{{insurance_type}}` - Tipo de seguro de interés

## Requisitos Previos

Para que las notificaciones funcionen, se debe verificar:

### 1. Extensión pg_net habilitada
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Configuración de correo activa
Debe existir un registro en `correo_configuracion` con:
- `activo = true`
- `tipo_integracion = 'resend'`
- `remitente_email` configurado
- `resend_api_key` configurado (o variable de entorno `RESEND_API_KEY`)

### 3. Configuración de WhatsApp activa
Debe existir un registro en `whatsapp_configuracion` con:
- `activo = true`
- `api_key` de Wazzup24 configurado
- `channel_id_uuid` configurado

### 4. Usuario con datos completos
El agente debe tener:
- `email_laboral` para recibir emails
- `celular_laboral` para recibir WhatsApp

## Testing

Para probar el sistema completo:

1. **Ir a Mi Página Web** (como usuario con rol Agente o Gerente)
2. **Publicar tu página**
3. **Abrir la página pública** (click en "Ver página pública")
4. **Llenar y enviar el formulario**
5. **Verificar que se reciban:**
   - Email en la bandeja del agente
   - WhatsApp en el celular del agente
   - Notificación en la campanita de la plataforma

## Debugging

Si las notificaciones no llegan, revisar:

### 1. Logs del edge function submit-web-lead
```bash
supabase functions logs submit-web-lead
```

Buscar:
- "Notifications sent successfully"
- Errores en la llamada a `send_transactional_notification`

### 2. Logs de la función de base de datos
En Supabase Studio → SQL Editor:
```sql
SELECT * FROM pg_stat_statements
WHERE query LIKE '%send_transactional_notification%'
ORDER BY calls DESC;
```

### 3. Verificar notificación interna
```sql
SELECT * FROM notifications
WHERE user_id = 'UUID_DEL_AGENTE'
ORDER BY created_at DESC
LIMIT 5;
```

### 4. Logs de edge functions de envío
```bash
# Email
supabase functions logs enviar-correo-transaccional

# WhatsApp
supabase functions logs enviar-whatsapp
```

## Archivos Modificados

1. `supabase/migrations/create_send_transactional_notification.sql` (nuevo)
2. `supabase/functions/submit-web-lead/index.ts`
3. `supabase/functions/enviar-correo-transaccional/index.ts`
4. `supabase/functions/enviar-whatsapp/index.ts`

## Build Status

✅ Build completado exitosamente
✅ Sin errores de TypeScript
✅ Listo para desplegar

## Conclusión

El sistema de notificaciones para "Mi Página Web" ahora funciona completamente:

- ✅ Notificación por Email
- ✅ Notificación por WhatsApp
- ✅ Notificación interna (campanita)
- ✅ Lead creado en CRM
- ✅ Tarea de seguimiento creada

El agente recibe notificaciones inmediatas por los 3 canales cuando un prospecto llena el formulario en su página web pública.
