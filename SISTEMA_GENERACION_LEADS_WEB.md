# Sistema de Generación de Leads desde Mi Página Web

## ✅ Implementación Completa

Mi Página Web ahora es una **máquina automática de generación de leads** que conecta Marketing → CRM → Notificaciones → Seguimiento en un solo flujo.

---

## 🎯 Características Implementadas

### 1. **Formulario de Contacto en Hero**

#### Ubicación y Diseño
- Formulario prominente en el **lado derecho del Hero**
- Layout responsive de 2 columnas (desktop) / 1 columna (móvil)
- Nombre del agente más discreto para dar protagonismo al mensaje

#### Campos del Formulario (Obligatorios)
1. **Nombre Completo**
2. **Celular**
3. **Email**
4. **Seguro de Interés** (dropdown)
   - Muestra solo los ramos seleccionados por el agente
   - Solo nombre del ramo, sin descripciones

#### Diseño Visual
- Formulario con sombra y borde personalizado (color primario)
- Estados claros: Normal / Enviando / Éxito / Error
- Mensaje de confirmación profesional
- Validación de campos en el frontend

---

### 2. **Edge Function: submit-web-lead**

#### Ruta
```
POST /functions/v1/submit-web-lead
```

#### Flujo Automático

1. **Identificación del Agente**
   - Busca el usuario por `web_slug`
   - Valida que esté activo y la página publicada

2. **Anti-Duplicados Inteligente**
   - Busca contactos existentes por celular o email
   - Si existe: Actualiza datos + timestamp
   - Si no existe: Crea nuevo contacto

3. **Creación de Contacto en CRM**
   ```sql
   INSERT INTO crm_contactos (
     usuario_id,
     nombre,
     celular,
     email,
     estatus,           -- 'Prospecto'
     tipo_seguro,
     origen,            -- 'Mi Página Web'
     ultima_interaccion
   )
   ```

4. **Creación Automática de Tarea**
   ```sql
   INSERT INTO crm_tareas (
     usuario_id,
     contacto_id,
     titulo,            -- 'Seguimiento: Lead desde Mi Página Web'
     descripcion,       -- Incluye todos los datos del prospecto
     tipo,              -- 'Llamada'
     prioridad,         -- 'Alta'
     estado,            -- 'Pendiente'
     fecha_vencimiento  -- Mañana
   )
   ```

5. **Notificaciones Tri-Canal**
   - Llama a `enviar_notificacion_completa()`
   - Usa plantilla `web_lead_nuevo`
   - Envía por: Campanita + Email + WhatsApp

---

### 3. **Plantillas de Notificación Transaccionales**

#### Tipo: `web_lead_nuevo`

**Variables Disponibles:**
- `{{agent_name}}` - Nombre del agente
- `{{client_name}}` - Nombre del prospecto
- `{{client_phone}}` - Celular del prospecto
- `{{client_email}}` - Email del prospecto
- `{{insurance_type}}` - Tipo de seguro seleccionado

#### Plantilla de Email
```html
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

💡 Siguiente paso: Contacta al cliente lo antes posible.
```

#### Plantilla de WhatsApp
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

#### Plantilla de Campanita (In-App)
```
Título: Nuevo Lead: {{client_name}}

Cuerpo: ¡Nuevo prospecto desde tu página web! {{client_name}} está
interesado en {{insurance_type}}. Celular: {{client_phone}},
Email: {{client_email}}. Ya creamos el contacto y una tarea en tu CRM.
```

---

## 🔄 Flujo Completo Paso a Paso

### Desde el Punto de Vista del Cliente

1. Visita `agentedeseguros.online/slug-agente`
2. Ve el Hero con información del agente + formulario
3. Completa los 4 campos obligatorios
4. Hace clic en "Solicitar Cotización"
5. Ve mensaje de confirmación

### Desde el Punto de Vista del Agente

1. **Notificación Inmediata (Tri-Canal)**
   - 🔔 Campanita en la app
   - 📧 Email en su bandeja
   - 💬 WhatsApp en su celular

2. **Contacto en CRM**
   - Prospecto creado automáticamente
   - Con todos los datos del formulario
   - Etiquetado con origen: "Mi Página Web"

3. **Tarea Lista para Actuar**
   - Aparece en Mi CRM → Tareas
   - Prioridad: Alta
   - Tipo: Llamada
   - Fecha: Mañana
   - Descripción completa con datos del cliente

---

## 🎨 Personalización con Colores del Usuario

Los colores primario y secundario del agente se aplican dinámicamente a:

### Formulario
- Borde del contenedor: Color primario (transparente)
- Botón de envío: Gradiente (primario → secundario)
- Estados hover y focus

### Mensajes
- Iconos y elementos visuales
- Estados de éxito y error

---

## 🔒 Seguridad y Validación

### Frontend
- Validación HTML5 de campos requeridos
- Validación de formato de email
- Estados de carga para evitar doble envío

### Backend (Edge Function)
- Validación de todos los campos obligatorios
- Verificación de que el slug existe y está activo
- Verificación de que la página está publicada
- Manejo de errores graceful

### Base de Datos
- Anti-duplicados automático
- Sanitización de datos
- Registros con timestamps

---

## 📊 Gestión desde Notificaciones Transaccionales

Los administradores pueden:

1. **Editar plantillas** en tiempo real
2. **Activar/desactivar** canales específicos
3. **Modificar textos** sin tocar código
4. **Usar variables** para personalización
5. **Ver historial** de notificaciones enviadas

---

## 🚀 Beneficios del Sistema

### Para el Agente
- ✅ Captación 24/7 de prospectos
- ✅ Notificación inmediata por 3 canales
- ✅ CRM actualizado automáticamente
- ✅ Tarea lista para seguimiento
- ✅ Sin trabajo manual

### Para el Prospecto
- ✅ Proceso simple y rápido
- ✅ Confirmación inmediata
- ✅ Profesionalismo de la página
- ✅ Respuesta rápida del agente

### Para la Organización
- ✅ Lead scoring automático
- ✅ Origen rastreado
- ✅ Conversión medible
- ✅ Plantillas centralizadas
- ✅ Datos estructurados

---

## 📝 Archivos Creados/Modificados

### Migración
- `create_web_lead_notification_template.sql`

### Edge Function
- `supabase/functions/submit-web-lead/index.ts`

### Frontend
- `src/components/webPages/PublicWebPagePreview.tsx` (Vista previa)
- `src/pages/PaginaPublicaAsesor.tsx` (Página pública)

---

## 🧪 Cómo Probar

1. Ve a **Mi Página Web** en el sistema
2. Configura colores, aseguradoras y ramos
3. Publica la página
4. Abre la vista previa o visita `agentedeseguros.online/tu-slug`
5. Completa y envía el formulario
6. Verifica:
   - Campanita de notificación
   - Email recibido
   - WhatsApp recibido
   - Contacto en Mi CRM
   - Tarea en Mi CRM

---

## 🎯 Resultado Final

**Mi Página Web** dejó de ser informativa y se convirtió en una **máquina de generación de leads** que:

- Captura prospectos automáticamente
- Notifica al agente en tiempo real
- Organiza la información en CRM
- Crea tareas de seguimiento
- Mantiene al agente en control total

Todo esto sin intervención manual, con plantillas editables por el corporativo y colores personalizables por cada agente.

---

**Powered by MOVI Digital** 🚀
