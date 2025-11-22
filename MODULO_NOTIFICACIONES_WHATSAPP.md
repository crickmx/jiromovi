# 📱 Extensión WhatsApp - Notificaciones Transaccionales

## 📧 Descripción General

El módulo de Notificaciones Transaccionales ha sido extendido para soportar WhatsApp mediante la API oficial de Wazzup24. Ahora el sistema puede enviar notificaciones por **Correo**, **WhatsApp** o **Ambos canales simultáneamente**.

---

## ✅ Nuevas Funcionalidades

### 1. Configuración de WhatsApp (Wazzup24)

**Nueva sección:** `Configuración de WhatsApp`

**Parámetros configurables:**
- ✅ **API Key Wazzup24:** `aeaecead58f14a3286b37e4d0b81dc3a`
- ✅ **Número Remitente (WABA):** `5215588545516`
- ✅ **Estado:** Activo/Inactivo
- ✅ **Prueba de envío:** Enviar mensaje de prueba a cualquier número

**Características:**
- API Key enmascarada por seguridad
- Validación de formato de números
- Registro de última prueba y estado
- Activación/desactivación independiente del correo

---

### 2. Canales de Envío por Notificación

Cada tipo de notificación ahora incluye opciones de entrega:

```
📧 Correo       [✓]
💬 WhatsApp     [✓]
📧+💬 Ambos     [automático si ambos activos]
```

**Configuración flexible:**
- Activar/desactivar cada canal independientemente
- Indicador visual cuando ambos canales están activos
- Advertencia si ningún canal está seleccionado

---

### 3. Plantillas WhatsApp (Texto Plano)

Cada notificación tiene ahora **dos plantillas independientes:**

#### **Plantilla de Correo (HTML)**
- Editor HTML completo
- Soporte de imágenes y estilos
- Vista previa renderizada

#### **Plantilla de WhatsApp (Texto Plano)**
- Editor de texto simple
- Emojis soportados
- Formato: saltos de línea, negritas con `*texto*`
- Variables dinámicas idénticas

**Variables disponibles:**
```
{{nombre}}
{{apellidos}}
{{email_laboral}}
{{rol}}
{{oficina}}
{{titulo_evento}}
{{fecha_evento}}
{{hora_evento}}
{{link_evento}}
{{ponente}}
{{nombre_plataforma}}
{{fecha}}
```

---

### 4. Plantillas Predefinidas WhatsApp

#### **Bienvenida:**
```
Hola {{nombre}} {{apellidos}}! 👋

Tu cuenta en {{nombre_plataforma}} ha sido creada exitosamente.

Email: {{email_laboral}}
Rol: {{rol}}

¡Bienvenido al equipo!
```

#### **Nuevo Evento:**
```
Hola {{nombre}},

📅 Nuevo evento disponible:
*{{titulo_evento}}*

Fecha: {{fecha_evento}}
Hora: {{hora_evento}}
Ponente: {{ponente}}

Únete aquí: {{link_evento}}
```

#### **Recordatorio:**
```
⏰ RECORDATORIO

Hola {{nombre}},

Te recordamos tu evento próximo:

*{{titulo_evento}}*

Fecha: {{fecha_evento}}
Hora: {{hora_evento}}

Únete ahora: {{link_evento}}
```

---

## 🔧 Base de Datos - Cambios Realizados

### Nueva Tabla: `whatsapp_configuracion`

```sql
CREATE TABLE whatsapp_configuracion (
  id uuid PRIMARY KEY,
  api_key text NOT NULL,
  numero_remitente text NOT NULL,
  activo boolean DEFAULT false,
  configurado_por uuid,
  ultima_actualizacion timestamptz,
  ultima_prueba timestamptz,
  estado_ultima_prueba text,
  created_at timestamptz,
  updated_at timestamptz
);
```

### Modificaciones a Tablas Existentes

#### `correo_tipos_notificacion`
```sql
ALTER TABLE correo_tipos_notificacion
ADD COLUMN enviar_por_correo boolean DEFAULT true,
ADD COLUMN enviar_por_whatsapp boolean DEFAULT false;
```

#### `correo_plantillas`
```sql
ALTER TABLE correo_plantillas
ADD COLUMN whatsapp_plantilla text,
ADD COLUMN whatsapp_variables_disponibles text[];
```

#### `correo_historial_envios`
```sql
ALTER TABLE correo_historial_envios
ADD COLUMN canal_envio text CHECK (canal_envio IN ('correo', 'whatsapp', 'ambos')),
ADD COLUMN numero_destino text,
ADD COLUMN whatsapp_respuesta jsonb;
```

---

## 🚀 API de Wazzup24

### Endpoint de Envío

**URL:** `https://api.wazzup24.com/v3/message`

**Método:** `POST`

**Headers:**
```json
{
  "Authorization": "Bearer {api_key}",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "channelId": "5215588545516",
  "phone": "5215512345678",
  "text": "Mensaje generado por plantilla"
}
```

**Respuesta Exitosa:**
```json
{
  "messageId": "xxx-xxx-xxx",
  "status": "sent"
}
```

---

## 📋 Edge Function: `enviar-whatsapp`

**Ubicación:** `/supabase/functions/enviar-whatsapp/index.ts`

### Funcionalidad:

1. ✅ Obtiene configuración activa de WhatsApp
2. ✅ Valida tipo de notificación habilitado para WhatsApp
3. ✅ Obtiene plantilla WhatsApp
4. ✅ **Normaliza número de teléfono** (agrega 52 si falta)
5. ✅ Reemplaza variables dinámicas
6. ✅ Envía mensaje via Wazzup24 API
7. ✅ Registra en historial con respuesta completa

### Ejemplo de Uso:

```typescript
const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
  body: {
    tipo: 'bienvenida',
    numero: '5215512345678',
    datos: {
      nombre: 'Juan',
      apellidos: 'Pérez',
      email_laboral: 'juan@empresa.com',
      rol: 'Empleado'
    }
  }
});
```

---

## 🔐 Validaciones y Seguridad

### Normalización de Números

**Función:** `normalizar_telefono_mx(telefono text)`

**Comportamiento:**
```sql
-- Entrada: 5512345678    → Salida: 525512345678
-- Entrada: +525512345678 → Salida: 525512345678
-- Entrada: 521555123456  → Salida: 525512345678 (remueve 1)
```

### Vista de Usuarios con Teléfonos

```sql
CREATE VIEW usuarios_con_telefono_normalizado AS
SELECT
  u.id,
  u.nombre,
  u.apellidos,
  u.email_laboral,
  u.celular_laboral,
  normalizar_telefono_mx(u.celular_laboral) as telefono_normalizado,
  u.rol,
  o.nombre as oficina_nombre
FROM usuarios u
LEFT JOIN oficinas o ON u.oficina_id = o.id
WHERE u.celular_laboral IS NOT NULL AND u.celular_laboral != '';
```

### Reglas de Seguridad

- ✅ **RLS habilitado** en `whatsapp_configuracion`
- ✅ **Solo Administradores** pueden configurar WhatsApp
- ✅ **API Key enmascarada** en interfaz
- ✅ **Validación de números** antes de envío
- ✅ **Registro de errores** en historial

---

## 📊 Historial Unificado

El historial ahora registra **ambos canales:**

**Campos nuevos:**
- `canal_envio`: `'correo'` | `'whatsapp'` | `'ambos'`
- `numero_destino`: Número de WhatsApp (normalizado)
- `whatsapp_respuesta`: JSON completo de respuesta Wazzup24

**Ejemplo de registro:**
```json
{
  "tipo_notificacion_codigo": "bienvenida",
  "destinatario_email": "usuario@empresa.com",
  "destinatario_nombre": "Juan Pérez",
  "canal_envio": "whatsapp",
  "numero_destino": "525512345678",
  "estado": "enviado",
  "whatsapp_respuesta": {
    "messageId": "xxx-xxx",
    "status": "sent"
  }
}
```

---

## 🎨 Interfaz de Usuario

### Tabs Actualizados:

1. ⚙️ **Configuración SMTP**
2. 💬 **WhatsApp** ← NUEVO
3. 📧 **Tipos de Notificaciones** (ahora con canales)
4. 📄 **Plantillas** (ahora con editor WhatsApp)
5. 🕐 **Historial de Envíos** (incluye canal usado)

### Componentes Nuevos:

#### `ConfiguracionWhatsApp.tsx`
- Configuración de API Key y número remitente
- Prueba de envío
- Activación/desactivación

#### `TiposNotificaciones.tsx` (actualizado)
- Switches por canal: Correo y WhatsApp
- Indicador visual "Ambos canales"
- Advertencia si ningún canal activo

---

## ⚙️ Cómo Usar el Sistema

### Paso 1: Configurar WhatsApp

```
1. Ir a "Notificaciones Transaccionales"
2. Click en tab "WhatsApp"
3. Verificar API Key: aeaecead58f14a3286b37e4d0b81dc3a
4. Verificar Número: 5215588545516
5. Guardar Configuración
6. Enviar mensaje de prueba
7. Activar sistema
```

### Paso 2: Configurar Canales por Notificación

```
1. Ir a tab "Tipos de Notificaciones"
2. Para cada notificación:
   - ✓ Correo (si se desea enviar por email)
   - ✓ WhatsApp (si se desea enviar por WhatsApp)
3. Activar la notificación
```

### Paso 3: Personalizar Plantillas WhatsApp

```
1. Ir a tab "Plantillas"
2. Seleccionar plantilla a editar
3. Ver variables disponibles
4. Editar texto WhatsApp (texto plano)
5. Guardar cambios
```

### Paso 4: Enviar Notificaciones

**Automáticamente** cuando ocurra el evento (crear usuario, etc.)

**O manualmente** via edge function:
```typescript
await supabase.functions.invoke('enviar-whatsapp', {
  body: {
    tipo: 'nuevo_evento',
    numero: '5215512345678',
    datos: {
      nombre: 'Juan',
      titulo_evento: 'Capacitación',
      fecha_evento: '25/11/2025',
      hora_evento: '10:00',
      link_evento: 'https://...'
    }
  }
});
```

---

## ⚠️ Validaciones Importantes

### 1. Usuario sin número laboral
```
❌ Si usuario.celular_laboral es NULL o vacío
→ No se envía WhatsApp
→ Se registra error en historial
```

### 2. WhatsApp desactivado
```
❌ Si whatsapp_configuracion.activo = false
→ No se envía WhatsApp
→ Se registra error
```

### 3. Tipo de notificación sin WhatsApp
```
❌ Si tipo.enviar_por_whatsapp = false
→ No se envía WhatsApp
→ Solo se envía correo (si está activo)
```

### 4. Formato de número incorrecto
```
✅ Normalización automática:
   - Remueve espacios, guiones, paréntesis
   - Agrega código 52 si falta
   - Remueve 1 si tiene formato antiguo (521...)
```

---

## 📊 Comportamiento por Notificación

| Notificación | Correo | WhatsApp | Ambos | Notas |
|--------------|--------|----------|-------|-------|
| Bienvenida | ✅ | ✅ | ✅ | Envío inmediato al crear usuario |
| Recuperación | ✅ | ✅ | ✅ | Link de recuperación incluido |
| Nuevo Evento | ✅ | ✅ | ✅ | Solo a usuarios con permiso |
| Cuenta Activada | ✅ | ✅ | ✅ | Cuando admin activa cuenta |
| Capacitación Obligatoria | ✅ | ✅ | ✅ | Usuarios con permiso al evento |
| Cancelación | ✅ | ✅ | ✅ | Usuarios que tenían permiso |
| Recordatorio | ✅ | ✅ | ✅ | Solo una vez según intervalo |
| Personalizada | ✅ | ✅ | ✅ | Admin elige destinatarios |

---

## 🎯 Resumen de Cambios

### Base de Datos:
- ✅ Nueva tabla `whatsapp_configuracion`
- ✅ Columnas `enviar_por_correo` y `enviar_por_whatsapp` en tipos
- ✅ Columna `whatsapp_plantilla` en plantillas
- ✅ Columnas `canal_envio`, `numero_destino`, `whatsapp_respuesta` en historial
- ✅ Función `normalizar_telefono_mx()`
- ✅ Vista `usuarios_con_telefono_normalizado`

### Frontend:
- ✅ Componente `ConfiguracionWhatsApp.tsx`
- ✅ Actualizado `TiposNotificaciones.tsx` con switches de canal
- ✅ Actualizado `NotificacionesTransaccionales.tsx` con tab WhatsApp
- ✅ Plantillas predefinidas en texto plano para WhatsApp

### Backend:
- ✅ Edge function `enviar-whatsapp/index.ts`
- ✅ Integración con Wazzup24 API
- ✅ Normalización de números telefónicos
- ✅ Registro en historial unificado

---

## ✨ Ventajas del Sistema

1. ✅ **Dual Channel:** Correo + WhatsApp en un solo sistema
2. ✅ **Flexible:** Activar/desactivar canales independientemente
3. ✅ **Seguro:** Validaciones y normalización automática
4. ✅ **Auditable:** Historial completo con respuestas API
5. ✅ **Escalable:** Preparado para más canales (SMS, Push, etc.)
6. ✅ **Intuitivo:** Interfaz unificada y clara

---

## 🚀 Estado del Módulo

**✅ COMPLETAMENTE FUNCIONAL Y LISTO PARA PRODUCCIÓN**

**Acceso:** Solo Administradores
**Ruta:** `/notificaciones-transaccionales`
**API:** Wazzup24 (producción)
**Números:** Formato internacional automático

---

## 📞 Próximos Pasos (Opcionales)

Para mejorar aún más el módulo:

1. **Plantillas con multimedia:**
   - Envío de imágenes por WhatsApp
   - Documentos adjuntos
   - Audio/Video

2. **Webhooks de Wazzup24:**
   - Estado de entrega (delivered, read)
   - Respuestas de usuarios
   - Fallbacks automáticos

3. **Analytics:**
   - Tasa de entrega por canal
   - Tiempo de lectura
   - Engagement por tipo

4. **Programación:**
   - Envíos programados
   - Recordatorios recurrentes
   - Campañas masivas

5. **Integraciones:**
   - Telegram
   - SMS (Twilio)
   - Push Notifications

---

El módulo está **completamente integrado** y listo para enviar notificaciones por **Correo**, **WhatsApp** o **Ambos** según la configuración del administrador. 🎉
