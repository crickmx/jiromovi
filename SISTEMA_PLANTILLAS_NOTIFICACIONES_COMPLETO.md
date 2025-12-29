# Sistema de Plantillas y Notificaciones - Guía Completa

## Resumen

El sistema de notificaciones está completamente basado en plantillas. **PROHIBIDO** enviar notificaciones con código hardcodeado. Todas las notificaciones deben usar las plantillas transaccionales.

## Ubicación en la UI

**Notificaciones Transaccionales** → **Gestión de Plantillas**

## Tipos de Notificación Activos

### 1. cuenta_activada
**Cuándo se usa:** Usuario activado (nuevo o reactivado)

**Canales disponibles:** ✅ Correo ✅ WhatsApp ✅ Notificación Interna

**Campos disponibles:**
- `{{nombre}}` - Nombre del usuario
- `{{apellidos}}` - Apellidos
- `{{email_laboral}}` - Email laboral
- `{{password}}` - Contraseña (solo cuando se crea directamente)
- `{{rol}}` - Rol asignado
- `{{oficina}}` - Nombre de la oficina
- `{{pagina_web}}` - URL de página web pública
- `{{puesto}}` - Puesto/cargo

**Edge functions que lo usan:**
- `create-user` - Cuando se crea usuario directamente como activo

**Triggers que lo usan:**
- `send_welcome_notifications_on_activation` - Cuando gerente activa usuario pendiente

---

### 2. cumpleanos_contacto
**Cuándo se usa:** Recordatorio diario de cumpleaños de contactos CRM

**Canales disponibles:** ⚪ Correo ✅ WhatsApp ✅ Notificación Interna

**Campos disponibles:**
- `{{nombre_contacto}}` - Nombre del contacto
- `{{edad}}` - Edad actual (opcional)
- `{{contacto_url}}` - URL al perfil del contacto

**Edge functions que lo usan:**
- `process-birthday-reminders` - Cron diario automático

---

### 3. reserva_espacio
**Cuándo se usa:** Confirmación de reserva en Espacio Jiro

**Canales disponibles:** ✅ Correo ⚪ WhatsApp ✅ Notificación Interna

**Campos disponibles:**
- `{{nombre_usuario}}` - Nombre del usuario
- `{{espacio_nombre}}` - Nombre del espacio
- `{{fecha}}` - Fecha de la reserva
- `{{hora_inicio}}` - Hora de inicio
- `{{hora_fin}}` - Hora de fin

**Triggers que lo usan:**
- Trigger pendiente de crear en `reservas_espacio`

---

### 4. usuario_nuevo_pendiente
**Cuándo se usa:** Notificar a administradores cuando se crea usuario pendiente

**Canales disponibles:** ✅ Correo ⚪ WhatsApp ✅ Notificación Interna

**Campos disponibles:**
- `{{nombre_usuario}}` - Nombre del nuevo usuario
- `{{email}}` - Email del usuario
- `{{rol}}` - Rol solicitado
- `{{oficina}}` - Oficina asignada
- `{{url_aprobacion}}` - URL para aprobar

**Edge functions que lo usan:**
- `create-user` - Cuando gerente crea usuario que queda pendiente

---

### 5. nuevo_comunicado
**Cuándo se usa:** Nuevo comunicado publicado

**Canales disponibles:** ✅ Correo ✅ WhatsApp ✅ Notificación Interna

**Campos disponibles:**
- `{{titulo}}` - Título del comunicado
- `{{categoria}}` - Categoría
- `{{url}}` - URL al comunicado
- `{{autor}}` - Nombre del autor

**Triggers que lo usan:**
- Trigger en tabla `comunicados`

---

### 6. nuevo_evento
**Cuándo se usa:** Nuevo evento en Seguros Education

**Canales disponibles:** ✅ Correo ✅ WhatsApp ✅ Notificación Interna

**Campos disponibles:**
- `{{titulo_evento}}` - Título del evento
- `{{fecha_evento}}` - Fecha del evento
- `{{hora_evento}}` - Hora del evento
- `{{descripcion}}` - Descripción
- `{{url}}` - URL al evento

---

### 7. cancelacion_evento
**Cuándo se usa:** Evento cancelado

**Canales disponibles:** ✅ Correo ⚪ WhatsApp ✅ Notificación Interna

**Campos disponibles:** (mismos que nuevo_evento)

---

### 8. recordatorio_evento
**Cuándo se usa:** Recordatorio de evento próximo

**Canales disponibles:** ⚪ Correo ✅ WhatsApp ✅ Notificación Interna

**Campos disponibles:** (mismos que nuevo_evento)

---

### 9. notificacion_individual
**Cuándo se usa:** Notificación personalizada del sistema

**Canales disponibles:** ✅ Correo ✅ WhatsApp ✅ Notificación Interna

**Campos disponibles:**
- `{{titulo}}` - Título de la notificación
- `{{mensaje}}` - Mensaje principal
- `{{url}}` - URL de acción (opcional)

---

### 10. notificacion_personalizada
**Cuándo se usa:** Notificación personalizada (similar a individual)

**Canales disponibles:** ✅ Correo ✅ WhatsApp ✅ Notificación Interna

**Campos disponibles:** (mismos que notificacion_individual)

---

### 11. password_reset
**Cuándo se usa:** Recuperación de contraseña

**Canales disponibles:** ✅ Correo ⚪ WhatsApp ⚪ Notificación Interna

**Campos disponibles:**
- `{{nombre}}` - Nombre del usuario
- `{{reset_link}}` - Link de recuperación
- `{{nombre_plataforma}}` - Nombre de la plataforma

**Edge functions que lo usan:**
- `reset-password-request`

---

## Tipos de Notificación Desactivados

### bienvenida
**Estado:** ❌ OBSOLETO

**Razón:** Reemplazado por `cuenta_activada`. No usar.

---

### commission_batch_closed
**Estado:** ❌ OBSOLETO

**Razón:** Usa `transactional_notification_templates` con `commission_batch_closed_agent`

---

## Cómo Usar las Plantillas desde Código

### Opción 1: Usar `enviar_notificacion_completa` (Recomendado)

```typescript
await supabase.rpc('enviar_notificacion_completa', {
  p_tipo_codigo: 'cuenta_activada',
  p_user_id: userId,
  p_titulo: '¡Bienvenido a MOVI Digital!',
  p_mensaje: 'Tu cuenta ha sido activada',
  p_modulo: 'usuarios',
  p_datos_adicionales: {
    nombre: 'Juan',
    apellidos: 'Pérez',
    email_laboral: 'juan@example.com',
    password: '123456',
    rol: 'Agente',
    oficina: 'CDMX',
    pagina_web: 'https://agentedeseguros.online/juan',
    puesto: 'Asesor'
  },
  p_accion_url: '/dashboard'
});
```

### Opción 2: Usar `send_transactional_notification` (Para web leads)

```typescript
await supabase.rpc('send_transactional_notification', {
  p_event_key: 'web_lead_nuevo',
  p_user_id: agenteId,
  p_variables: {
    agent_name: 'Juan Pérez',
    client_name: 'María López',
    client_phone: '5551234567',
    client_email: 'maria@example.com',
    insurance_type: 'Auto'
  },
  p_link_url: `/mi-crm/contactos/${contactId}`
});
```

### Opción 3: Usar `enviar-correo-transaccional` edge function

```typescript
await fetch(`${supabaseUrl}/functions/v1/enviar-correo-transaccional`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`,
  },
  body: JSON.stringify({
    tipo: 'password_reset',
    destinatario: email,
    datos: {
      nombre: 'Juan',
      reset_link: resetUrl,
      nombre_plataforma: 'MOVI Digital'
    }
  })
});
```

## Configuración de Canales

Cada plantilla puede activar/desactivar canales independientemente:

1. Ve a **Notificaciones Transaccionales** → **Gestión de Plantillas**
2. Selecciona la plantilla
3. En la sección **"Canales de Envío"** verás 3 switches:
   - ✅ **Correo Electrónico**
   - ✅ **WhatsApp**
   - ✅ **Notificación Interna**
4. Activa los canales que desees usar
5. Guarda cambios

## Reglas Importantes

### ✅ HACER

1. Siempre usar plantillas para notificaciones
2. Documentar campos disponibles al crear nueva plantilla
3. Probar con datos reales antes de activar
4. Mantener plantillas actualizadas
5. Usar nombres descriptivos para las variables

### ❌ NO HACER

1. ❌ NUNCA enviar notificaciones con código hardcodeado
2. ❌ NUNCA insertar directamente en `notificaciones_globales` o `notificaciones_internas`
3. ❌ NUNCA llamar directamente a `enviar-whatsapp` sin usar plantillas
4. ❌ NUNCA llamar directamente a `send-direct-email` sin usar plantillas (excepto comisiones)
5. ❌ NUNCA crear edge functions nuevas para notificaciones sin usar el sistema de plantillas

## Crear Nueva Plantilla

1. Crear tipo de notificación en la tabla:
```sql
INSERT INTO correo_tipos_notificacion (codigo, nombre, activo, enviar_correo, enviar_whatsapp, enviar_notificacion)
VALUES ('mi_tipo', 'Mi Tipo de Notificación', true, true, true, true);
```

2. Crear plantilla:
```sql
INSERT INTO correo_plantillas (
  tipo_notificacion_id,
  asunto,
  html_cuerpo,
  whatsapp_plantilla,
  notificacion_titulo,
  notificacion_cuerpo,
  variables_disponibles,
  whatsapp_variables_disponibles,
  notificacion_variables_disponibles,
  enviar_correo,
  enviar_whatsapp,
  enviar_notificacion
) SELECT
  id,
  'Asunto: {{variable}}',
  '<html>...</html>',
  'Mensaje WhatsApp: {{variable}}',
  'Título notificación',
  'Cuerpo notificación',
  ARRAY['variable1', 'variable2'],
  ARRAY['variable1'],
  ARRAY['variable1'],
  true,
  true,
  true
FROM correo_tipos_notificacion WHERE codigo = 'mi_tipo';
```

3. Documentar en esta guía
4. Usar desde código con `enviar_notificacion_completa`

## Monitoreo

Ver historial de envíos en:
- **Notificaciones Transaccionales** → **Historial de Envíos**

## Soporte Técnico

Si tienes dudas sobre cómo usar las plantillas:
1. Revisa esta guía
2. Revisa el código de `enviar_notificacion_completa` en las migraciones
3. Revisa ejemplos en edge functions existentes

## Variables del Sistema

Estas variables están disponibles automáticamente en todas las plantillas:
- `{{nombre_plataforma}}` - "MOVI Digital"
- `{{fecha}}` - Fecha actual formateada
- `{{anio}}` - Año actual

## Ejemplos de Uso Real

Ver implementaciones reales en:
- `/supabase/functions/create-user/index.ts` (línea 248)
- `/supabase/functions/process-birthday-reminders/index.ts` (línea 88)
- `/supabase/functions/reset-password-request/index.ts` (línea 88)
- `/supabase/functions/submit-web-lead/index.ts` (línea 175)
- `/supabase/migrations/*activation_trigger*.sql`
