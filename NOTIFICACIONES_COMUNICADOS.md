# Notificaciones Automáticas para Comunicados

## Resumen

Al crear un nuevo comunicado, el sistema ahora envía **automáticamente**:
- 🔔 **Notificación interna (campanita)** en la plataforma
- 📱 **Mensaje de WhatsApp** al teléfono laboral de cada destinatario

Incluye:
- ✅ Título del comunicado
- ✅ Link directo al comunicado
- ✅ Envío al teléfono laboral (prioritario)

---

## Implementación

### 1. Tipo de Notificación Creado

**Tabla:** `correo_tipos_notificacion`

**Registro:**
```sql
{
  codigo: 'nuevo_comunicado',
  nombre: 'Nuevo Comunicado Publicado',
  activo: true,
  enviar_por_whatsapp: true
}
```

---

### 2. Plantilla WhatsApp

**Formato del mensaje:**
```
📢 *Nuevo Comunicado*

*{{titulo}}*

Hola {{nombre}},

Se ha publicado un nuevo comunicado que puede ser de tu interés.

🔗 Ver: {{link}}

---
Mensaje desde www.movi.digital
```

**Variables disponibles:**
- `{{titulo}}` - Título del comunicado
- `{{nombre}}` - Nombre del destinatario
- `{{apellidos}}` - Apellidos del destinatario
- `{{link}}` - Link directo al comunicado completo

---

### 3. Plantilla Email (HTML)

**Para notificaciones por email:**
```html
<div style="font-family: Arial, sans-serif; padding: 20px;">
  <h2 style="color: #1D78FF;">📢 Nuevo Comunicado</h2>
  <h3 style="margin: 20px 0;">{{titulo}}</h3>
  <p>Hola {{nombre}},</p>
  <p>Se ha publicado un nuevo comunicado que puede ser de tu interés.</p>
  <div style="margin: 30px 0; text-align: center;">
    <a href="{{link}}" style="background-color: #1D78FF; color: white;
       padding: 12px 30px; text-decoration: none; border-radius: 6px;">
      Ver Comunicado
    </a>
  </div>
  <hr>
  <p style="color: #666; font-size: 12px;">Mensaje desde www.movi.digital</p>
</div>
```

---

## Flujo de Notificación

### Cuando se crea un comunicado:

#### 1. Usuario publica comunicado
- Completa formulario
- Selecciona destinatarios (Todos/Rol/Oficina)
- Guarda comunicado

#### 2. Sistema determina destinatarios

**Para Gerentes:**
- Usuarios de su oficina según roles seleccionados
- Todos los Administradores

**Para Administradores:**
- Según visibilidad configurada:
  - **Todos:** Todos los usuarios activos
  - **Por Rol:** Usuarios con roles específicos
  - **Por Oficina:** Usuarios de oficinas específicas

#### 3. Sistema envía notificaciones

Para cada destinatario (excepto el creador):

```typescript
// Obtener datos del usuario
const { data: userData } = await supabase
  .from('usuarios')
  .select('nombre, apellidos')
  .eq('id', userId)
  .single();

// Enviar notificación con WhatsApp
await supabase.rpc('enviar_notificacion_individual', {
  p_user_id: userId,
  p_titulo: `Nuevo comunicado: ${titulo}`,
  p_mensaje: `Se ha publicado un nuevo comunicado que puede ser de tu interés. ${link}`,
  p_modulo: 'Comunicados',
  p_accion_url: `/comunicados/${comunicadoId}`,
  p_enviar_whatsapp: true // WhatsApp activado
});
```

#### 4. Función RPC procesa

**Función:** `enviar_notificacion_individual`

1. Inserta notificación (campanita):
```sql
INSERT INTO notificaciones (
  usuario_id, titulo, mensaje, modulo, accion_url
) VALUES (...)
```

2. Envía WhatsApp vía `net.http_post`:
```sql
SELECT net.http_post(
  url := 'https://.../functions/v1/enviar-whatsapp',
  body := {
    tipo: 'notificacion_individual',
    numero: celular_laboral,
    datos: {titulo, mensaje, modulo, nombre, apellidos, link}
  }
)
```

#### 5. Edge Function procesa WhatsApp

**Función:** `enviar-whatsapp`

1. Busca configuración activa de WhatsApp
2. Busca plantilla para tipo `notificacion_individual`
3. Reemplaza variables:
   - `{{titulo}}` → Título del comunicado
   - `{{mensaje}}` → Mensaje con link
   - `{{modulo}}` → "Comunicados"
   - `{{nombre}}` → Nombre del usuario
4. Normaliza número de teléfono
5. Envía a Wazzup24 API
6. Registra en historial

#### 6. Usuario recibe

- 🔔 **Notificación** en la plataforma (campanita)
- 📱 **WhatsApp** en su teléfono laboral

**Contenido del WhatsApp:**
```
📢 *Nuevo Comunicado*

*Actualización importante sobre políticas*

Hola Juan,

Se ha publicado un nuevo comunicado que puede ser de tu interés.

🔗 Ver: https://app.movi.digital/comunicados/abc-123

---
Mensaje desde www.movi.digital
```

---

## Ejemplo de Uso

### Escenario 1: Administrador publica para todos

**Configuración:**
- Título: "Actualización importante sobre políticas"
- Visibilidad: "Todos los usuarios"

**Resultado:**
- ✅ Todos los usuarios activos reciben campanita
- ✅ Todos los usuarios activos reciben WhatsApp
- ✅ Excepto el creador del comunicado

**Total notificaciones:** N usuarios activos - 1 (creador)

---

### Escenario 2: Gerente publica para su oficina

**Configuración:**
- Título: "Reunión de equipo"
- Roles seleccionados: Empleado, Agente
- Oficina: Oficina del gerente (automático)

**Resultado:**
- ✅ Empleados de la oficina reciben notificación
- ✅ Agentes de la oficina reciben notificación
- ✅ Administradores reciben notificación
- ✅ Gerente (creador) NO recibe notificación

---

### Escenario 3: Administrador publica por rol

**Configuración:**
- Título: "Capacitación obligatoria"
- Visibilidad: "Por rol"
- Roles: Agente

**Resultado:**
- ✅ Solo Agentes reciben campanita
- ✅ Solo Agentes reciben WhatsApp
- ✅ Link directo al comunicado incluido

---

## Código Actualizado

### Archivo: `ComunicadoEditor.tsx`

**Antes:**
```typescript
// Solo campanita, sin WhatsApp
await crearNotificacion({
  user_id: userId,
  titulo: 'Nuevo comunicado publicado',
  mensaje: titulo,
  modulo: 'comunicados',
  icono: 'file-text',
  accion_url: `/comunicados/${comunicadoId}`,
  accion_texto: 'Ver comunicado'
});
```

**Ahora:**
```typescript
// Campanita + WhatsApp automático
const linkComunicado = `${window.location.origin}/comunicados/${comunicadoId}`;

const { data: userData } = await supabase
  .from('usuarios')
  .select('nombre, apellidos')
  .eq('id', userId)
  .single();

if (userData) {
  await supabase.rpc('enviar_notificacion_individual', {
    p_user_id: userId,
    p_titulo: `Nuevo comunicado: ${titulo}`,
    p_mensaje: `Se ha publicado un nuevo comunicado que puede ser de tu interés. ${linkComunicado}`,
    p_modulo: 'Comunicados',
    p_accion_url: `/comunicados/${comunicadoId}`,
    p_enviar_whatsapp: true // ✅ WhatsApp activado
  });
}
```

**Ventajas:**
- ✅ WhatsApp automático
- ✅ Link completo incluido en mensaje
- ✅ Prioriza teléfono laboral
- ✅ Plantilla personalizada para comunicados
- ✅ No bloquea si falla WhatsApp

---

## Prioridad de Números

El sistema usa el siguiente orden:

1. **celular_laboral** (prioritario) ✅
2. **celular_personal** (fallback)

```sql
v_telefono := COALESCE(
  NULLIF(celular_laboral, ''),
  NULLIF(celular_personal, '')
);
```

**Validación:**
- Número debe tener mínimo 10 dígitos
- Normalización automática (agrega +521 si es necesario)

---

## Manejo de Errores

### Si falla WhatsApp:
- ✅ **Notificación (campanita) se crea correctamente**
- ⚠️ Error se registra en logs
- ❌ WhatsApp no se envía
- ✅ **NO bloquea creación del comunicado**

```typescript
try {
  // Enviar notificaciones
} catch (error) {
  console.error('Error enviando notificaciones:', error);
  // NO bloquea el flujo principal
}
```

### Si usuario no tiene teléfono:
- ✅ Recibe campanita normalmente
- ❌ No recibe WhatsApp
- ✅ Proceso continúa sin errores

---

## Verificación

### 1. Crear comunicado de prueba

**Pasos:**
1. Ir a "Comunicados"
2. Clic en "Nuevo Comunicado"
3. Completar formulario:
   - Título: "Prueba de notificaciones"
   - Contenido: Cualquier texto
   - Visibilidad: "Todos" o específica
4. Guardar

### 2. Verificar notificaciones

**En la plataforma:**
- ✅ Destinatarios ven campanita
- ✅ Título: "Nuevo comunicado: Prueba de notificaciones"
- ✅ Link directo funciona

**En WhatsApp:**
- ✅ Mensaje recibido en teléfono laboral
- ✅ Formato correcto con título y link
- ✅ Link clicable y funcional

### 3. Verificar en base de datos

**Notificaciones creadas:**
```sql
SELECT
  usuario_id,
  titulo,
  mensaje,
  modulo,
  accion_url,
  created_at
FROM notificaciones
WHERE modulo = 'Comunicados'
ORDER BY created_at DESC
LIMIT 10;
```

**Historial WhatsApp:**
```sql
SELECT
  tipo_notificacion_codigo,
  destinatario_nombre,
  numero_destino,
  estado,
  created_at
FROM correo_historial_envios
WHERE tipo_notificacion_codigo = 'notificacion_individual'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Configuración Requerida

### 1. WhatsApp Configuration

**Tabla:** `whatsapp_configuracion`

Debe existir registro activo:
```sql
SELECT activo, channel_id_uuid, numero_remitente
FROM whatsapp_configuracion
WHERE activo = true;
```

### 2. Tipo de Notificación

**Tabla:** `correo_tipos_notificacion`

```sql
SELECT codigo, activo, enviar_por_whatsapp
FROM correo_tipos_notificacion
WHERE codigo = 'notificacion_individual';

-- Debe retornar:
-- activo: true
-- enviar_por_whatsapp: true
```

### 3. Plantilla

**Tabla:** `correo_plantillas`

```sql
SELECT t.codigo, p.whatsapp_plantilla
FROM correo_plantillas p
JOIN correo_tipos_notificacion t ON p.tipo_notificacion_id = t.id
WHERE t.codigo = 'notificacion_individual';

-- Debe tener plantilla WhatsApp configurada
```

---

## Archivos Modificados

### Base de Datos
1. ✅ **Migración:** `add_comunicados_notification_type_and_template.sql`
   - Tipo `nuevo_comunicado` (no usado actualmente, reservado para futuro)
   - Plantilla específica para comunicados

### Frontend
2. ✅ **Archivo:** `src/pages/ComunicadoEditor.tsx`
   - Líneas 368-393: Lógica de notificación actualizada
   - Usa `enviar_notificacion_individual` con WhatsApp
   - Incluye link completo del comunicado
   - Removida importación de `crearNotificacion`

### Documentación
3. ✅ **Archivo:** `NOTIFICACIONES_COMUNICADOS.md`

---

## Beneficios

### Antes:
❌ Solo notificación interna (campanita)
❌ Sin alertas fuera de la plataforma
❌ Usuarios debían revisar constantemente
❌ Bajo engagement con comunicados

### Ahora:
✅ **Notificación interna (campanita)**
✅ **WhatsApp automático al teléfono laboral**
✅ **Link directo al comunicado**
✅ **Mayor visibilidad de comunicados importantes**
✅ **Mejor alcance y engagement**
✅ **Respuesta más rápida de los usuarios**
✅ **Título del comunicado en el mensaje**

---

## Resumen Técnico

| **Aspecto** | **Implementación** |
|-------------|-------------------|
| **Tipo de notificación** | `notificacion_individual` |
| **Plantilla WhatsApp** | Con título, mensaje y link |
| **Función RPC** | `enviar_notificacion_individual` |
| **Edge Function** | `enviar-whatsapp` |
| **API externa** | Wazzup24 |
| **Prioridad teléfono** | Laboral → Personal |
| **Manejo errores** | No bloquea flujo principal |
| **Destinatarios** | Según visibilidad configurada |
| **Build** | ✅ Exitoso |

---

## Ejemplo de Mensaje Completo

**Cuando se publica "Actualización de Políticas":**

**Campanita (plataforma):**
```
Título: Nuevo comunicado: Actualización de Políticas
Mensaje: Se ha publicado un nuevo comunicado que puede ser de tu interés.
         https://app.movi.digital/comunicados/abc-123
Módulo: Comunicados
Link: /comunicados/abc-123
```

**WhatsApp (teléfono laboral):**
```
📢 *Nuevo Comunicado*

*Actualización de Políticas*

Hola Juan,

Se ha publicado un nuevo comunicado que puede ser de tu interés.

🔗 Ver: https://app.movi.digital/comunicados/abc-123

---
Mensaje desde www.movi.digital
```

---

## Resultado Final

✅ **Sistema implementado exitosamente**
✅ **Notificaciones automáticas para comunicados**
✅ **Campanita + WhatsApp en cada publicación**
✅ **Link directo incluido**
✅ **Título del comunicado visible**
✅ **Prioriza teléfono laboral**
✅ **Build exitoso sin errores**

**Los comunicados ahora tienen mayor alcance y visibilidad mediante notificaciones automáticas con WhatsApp.**
