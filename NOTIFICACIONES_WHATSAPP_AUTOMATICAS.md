# Notificaciones WhatsApp Automáticas

## Resumen de Implementación

**TODAS** las notificaciones internas (campanita) del sistema ahora envían **automáticamente** un mensaje de WhatsApp al **teléfono laboral** del usuario destinatario.

---

## Cambios Implementados

### 1. Función RPC: `enviar_notificacion_individual` ✅

**Ubicación:** Base de datos (PostgreSQL)

**Funcionalidad:**
- Inserta notificación en tabla `notificaciones` (campanita)
- Envía WhatsApp automáticamente usando `pg_net.http_post`
- Prioriza `celular_laboral`, fallback a `celular_personal`
- Llamada HTTP asíncrona (no bloquea transacción)
- Manejo de errores sin fallar notificación principal

**Parámetros:**
```sql
enviar_notificacion_individual(
  p_user_id uuid,              -- ID del usuario
  p_titulo text,               -- Título de la notificación
  p_mensaje text,              -- Mensaje
  p_modulo text,               -- Módulo origen
  p_accion_url text,           -- URL opcional
  p_enviar_whatsapp boolean    -- Default: true
)
```

**Retorna:** UUID de la notificación creada

---

### 2. Helper Actualizado: `crearNotificacion` ✅

**Archivo:** `src/lib/notificationHelpers.ts`

**Antes:**
```typescript
// Insertaba directamente en tabla notificaciones
await supabase.from('notificaciones').insert({...});
```

**Ahora:**
```typescript
// Usa función RPC que incluye WhatsApp
await supabase.rpc('enviar_notificacion_individual', {
  p_user_id: params.user_id,
  p_titulo: params.titulo,
  p_mensaje: params.mensaje,
  p_modulo: params.modulo,
  p_accion_url: params.accion_url || null,
  p_enviar_whatsapp: params.enviar_whatsapp !== false, // Default true
});
```

**Nuevo parámetro opcional:**
```typescript
interface NotificationParams {
  // ... parámetros existentes
  enviar_whatsapp?: boolean; // Nuevo: default true
}
```

---

### 3. Context Actualizado: `NotificationContext` ✅

**Archivo:** `src/contexts/NotificationContext.tsx`

**Función:** `createNotification`

**Cambio:**
```typescript
// Antes: INSERT directo
await supabase.from('notificaciones').insert({...});

// Ahora: RPC con WhatsApp
await supabase.rpc('enviar_notificacion_individual', {
  p_user_id: usuario.id,
  p_titulo: notification.titulo,
  p_mensaje: notification.mensaje,
  p_modulo: notification.modulo,
  p_accion_url: notification.accion_url || null,
  p_enviar_whatsapp: true, // Siempre enviar WhatsApp
});
```

---

### 4. Función Global Actualizada: `crearNotificacionGlobal` ✅

**Archivo:** `src/lib/notificationHelpers.ts`

**Cambio en default:**
```typescript
// Antes: enviar_whatsapp: boolean = false
// Ahora: enviar_whatsapp: boolean = true

export async function crearNotificacionGlobal(
  // ... parámetros
  enviar_whatsapp: boolean = true // ✅ Ahora default TRUE
)
```

**Resultado:**
- Notificaciones globales también envían WhatsApp por defecto
- Se puede desactivar explícitamente si se requiere

---

### 5. Tipo de Notificación: `notificacion_individual` ✅

**Tabla:** `correo_tipos_notificacion`

**Registro creado:**
```sql
{
  codigo: 'notificacion_individual',
  nombre: 'Notificación Individual del Sistema',
  activo: true,
  enviar_por_whatsapp: true
}
```

---

### 6. Plantilla WhatsApp ✅

**Tabla:** `correo_plantillas`

**Plantilla para notificaciones individuales:**
```
🔔 *{{titulo}}*

{{mensaje}}

📂 Módulo: {{modulo}}

---
_Mensaje automático de MOVI Digital_
```

**Variables disponibles:**
- `{{titulo}}` - Título de la notificación
- `{{mensaje}}` - Mensaje de la notificación
- `{{modulo}}` - Módulo que generó la notificación
- `{{nombre}}` - Nombre del usuario
- `{{apellidos}}` - Apellidos del usuario

---

## Módulos Afectados

Todos los módulos que usan `NotificationTemplates` ahora envían WhatsApp automáticamente:

### ✅ Correos
- `nuevoCorreo` - Nuevo correo recibido
- `correoEnviado` - Correo programado enviado

### ✅ Chat
- `nuevoMensaje` - Nuevo mensaje en chat
- `agregadoAGrupo` - Agregado a grupo

### ✅ Vacaciones
- `solicitudEnviada` - Solicitud enviada
- `solicitudPendiente` - Solicitud pendiente (gerente)
- `solicitudAprobada` - Solicitud aprobada
- `solicitudRechazada` - Solicitud rechazada

### ✅ Seguros Education
- `nuevaSesion` - Nueva sesión programada
- `transmisionIniciada` - Transmisión en vivo iniciada
- `grabacionDisponible` - Grabación disponible
- `cursoCompletado` - Curso completado

### ✅ Espacio JIRO
- `reservaSolicitada` - Reserva solicitada
- `reservaAprobada` - Reserva aprobada
- `reservaRechazada` - Reserva rechazada
- `recordatorioReserva` - Recordatorio 15 min antes

### ✅ Publicidad
- `nuevaPlantilla` - Nueva plantilla disponible
- `disenoGuardado` - Diseño guardado

### ✅ Accesos Nacional
- `nuevoAcceso` - Nuevo acceso agregado
- `accesoActualizado` - Acceso actualizado

### ✅ Firma Email
- `firmaActualizada` - Firma actualizada
- `nuevaPlantillaAsignada` - Nueva plantilla asignada

### ✅ Contactos
- `nuevoContacto` - Nuevo contacto agregado

---

## Flujo de Notificación

### 1. Usuario ejecuta acción que genera notificación

Ejemplo: Se aprueba una solicitud de vacaciones

### 2. Sistema llama a `crearNotificacion` o template

```typescript
NotificationTemplates.solicitudAprobada(user_id);
```

### 3. Helper llama a función RPC

```typescript
supabase.rpc('enviar_notificacion_individual', {
  p_user_id: user_id,
  p_titulo: 'Solicitud aprobada',
  p_mensaje: 'Tu solicitud de vacaciones fue aprobada.',
  p_modulo: 'Vacaciones',
  p_accion_url: '/vacaciones',
  p_enviar_whatsapp: true,
});
```

### 4. Función RPC ejecuta dos acciones

**A. Insertar notificación (campanita):**
```sql
INSERT INTO notificaciones (
  usuario_id, titulo, mensaje, modulo, accion_url
) VALUES (...);
```

**B. Enviar WhatsApp (asíncrono):**
```sql
SELECT extensions.http_post(
  url := 'https://[...]/functions/v1/enviar-whatsapp',
  body := {
    tipo: 'notificacion_individual',
    numero: celular_laboral,
    datos: {titulo, mensaje, modulo, nombre, apellidos}
  }
);
```

### 5. Edge Function procesa WhatsApp

**Archivo:** `supabase/functions/enviar-whatsapp/index.ts`

- Busca configuración de WhatsApp activa
- Busca plantilla para tipo `notificacion_individual`
- Reemplaza variables en plantilla
- Normaliza número de teléfono
- Envía a Wazzup24 API
- Registra en historial de envíos

### 6. Usuario recibe dos notificaciones

- 🔔 **Campanita** en la plataforma
- 📱 **WhatsApp** en su teléfono laboral

---

## Prioridad de Teléfonos

El sistema prioriza los números de teléfono en este orden:

1. **celular_laboral** (prioritario) ✅
2. **celular_personal** (fallback)

**Código:**
```sql
v_telefono := COALESCE(
  NULLIF(v_user_record.celular_laboral, ''),
  NULLIF(v_user_record.celular_personal, '')
);
```

**Validación:**
- Solo envía si hay número válido
- Número debe tener mínimo 10 dígitos
- Normalización automática (agrega +521 si es necesario)

---

## Manejo de Errores

### Si falla envío de WhatsApp:

**NO afecta la notificación principal:**
```sql
EXCEPTION WHEN OTHERS THEN
  -- No fallar la transacción
  RAISE WARNING 'Error enviando WhatsApp: %', SQLERRM;
END;
```

**Resultado:**
- ✅ Notificación (campanita) se crea exitosamente
- ❌ WhatsApp no se envía pero NO bloquea el proceso
- ⚠️ Error se registra en logs para debugging

### Si no hay configuración WhatsApp:

- Edge function retorna error
- No afecta la notificación principal
- Usuario recibe solo la campanita

---

## Configuración Necesaria

### 1. WhatsApp Configuration (Tabla: `whatsapp_configuracion`)

**Campos requeridos:**
- `activo: true`
- `api_key` - Token de Wazzup24
- `channel_id_uuid` - UUID del canal de Wazzup24
- `numero_remitente` - Número del remitente

### 2. Tipo de Notificación (Tabla: `correo_tipos_notificacion`)

**Registro:** `notificacion_individual`
- `activo: true`
- `enviar_por_whatsapp: true`

### 3. Plantilla WhatsApp (Tabla: `correo_plantillas`)

**Plantilla para tipo:** `notificacion_individual`
- Campo `whatsapp_plantilla` con texto del mensaje
- Variables: `{{titulo}}`, `{{mensaje}}`, `{{modulo}}`

---

## Ventajas del Sistema

### Automatización Total
✅ No requiere llamadas manuales adicionales
✅ Un solo helper para campanita + WhatsApp
✅ Consistencia en todos los módulos

### Desacoplamiento
✅ Llamada HTTP asíncrona (no bloquea)
✅ Fallo de WhatsApp no afecta notificación
✅ Edge function independiente

### Flexibilidad
✅ Se puede desactivar WhatsApp por notificación
✅ Plantillas personalizables por tipo
✅ Priorización de números configurable

### Escalabilidad
✅ Usa `pg_net` (optimizado por Supabase)
✅ Procesamiento asíncrono
✅ No impacta performance de transacciones

---

## Ejemplo de Uso

### Crear notificación individual:

```typescript
import { NotificationTemplates } from '@/lib/notificationHelpers';

// Envía campanita + WhatsApp automáticamente
await NotificationTemplates.solicitudAprobada(userId);
```

### Crear notificación custom:

```typescript
import { crearNotificacion } from '@/lib/notificationHelpers';

await crearNotificacion({
  user_id: userId,
  titulo: 'Nuevo pedido',
  mensaje: 'Tienes un nuevo pedido en Store',
  modulo: 'Store',
  accion_url: '/store/mis-pedidos',
  // enviar_whatsapp: true por defecto
});
```

### Desactivar WhatsApp (si se requiere):

```typescript
await crearNotificacion({
  user_id: userId,
  titulo: 'Notificación silenciosa',
  mensaje: 'Solo campanita, sin WhatsApp',
  modulo: 'Sistema',
  enviar_whatsapp: false, // ❌ No enviar WhatsApp
});
```

---

## Verificación

### Comprobar que funciona:

1. **Crear notificación de prueba:**
```typescript
await crearNotificacion({
  user_id: 'uuid-del-usuario',
  titulo: 'Prueba WhatsApp',
  mensaje: 'Esta es una notificación de prueba',
  modulo: 'Sistema',
});
```

2. **Verificar campanita:**
- Usuario ve notificación en la plataforma
- Aparece en centro de notificaciones

3. **Verificar WhatsApp:**
- Usuario recibe mensaje en WhatsApp
- Número usado: celular_laboral prioritario

4. **Revisar logs:**
```sql
SELECT * FROM correo_historial_envios
WHERE canal_envio = 'whatsapp'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Archivos Modificados

### Frontend
1. ✅ `src/lib/notificationHelpers.ts`
   - Helper `crearNotificacion` usa RPC
   - Helper `crearNotificacionGlobal` default true
   - Nuevo parámetro `enviar_whatsapp`

2. ✅ `src/contexts/NotificationContext.tsx`
   - Método `createNotification` usa RPC
   - Envía WhatsApp por defecto

### Base de Datos
3. ✅ Migración: `create_individual_notification_with_whatsapp.sql`
   - Función RPC `enviar_notificacion_individual`
   - Permisos para `authenticated` y `service_role`

4. ✅ Migración: `add_individual_notification_type_simple.sql`
   - Tipo `notificacion_individual`
   - Plantilla WhatsApp

### Edge Functions
5. ✅ `supabase/functions/enviar-whatsapp/index.ts`
   - Ya soporta tipo `notificacion_individual`
   - Procesa plantillas correctamente

---

## Resultado Final

### Antes:
❌ Solo notificación interna (campanita)
❌ Sin alertas en tiempo real fuera de la plataforma
❌ Usuarios debían revisar constantemente

### Ahora:
✅ **Notificación interna (campanita)**
✅ **WhatsApp automático al teléfono laboral**
✅ **Alertas en tiempo real**
✅ **Mayor visibilidad de notificaciones importantes**
✅ **Un solo helper, doble canal de comunicación**

---

## Resumen Técnico

| Componente | Estado | Descripción |
|------------|--------|-------------|
| **Función RPC** | ✅ Activa | `enviar_notificacion_individual` |
| **Helper Frontend** | ✅ Actualizado | Usa RPC en lugar de INSERT directo |
| **Context** | ✅ Actualizado | `createNotification` con WhatsApp |
| **Templates** | ✅ Funcionando | 17 templates de notificación |
| **Tipo WhatsApp** | ✅ Creado | `notificacion_individual` |
| **Plantilla** | ✅ Creada | Template genérico para WhatsApp |
| **Edge Function** | ✅ Compatible | Soporta nuevo tipo |
| **Build** | ✅ Exitoso | Sin errores |

---

**TODAS las notificaciones internas del sistema ahora envían WhatsApp automáticamente al teléfono laboral de los usuarios.**
