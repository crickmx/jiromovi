# 🔔 Sistema de Notificaciones - Guía Completa

## ✅ Implementación Completa

Se ha implementado un **sistema completo de notificaciones en tiempo real** que incluye:

### **Funcionalidades Implementadas:**

1. ✅ **Centro de Notificaciones en el Dashboard**
   - Icono de campana (🔔) en la barra superior
   - Badge con contador de notificaciones no leídas
   - Panel deslizable con las últimas 50 notificaciones
   - Filtrado por módulo
   - Marcar como leída individual o masivamente
   - Eliminar notificaciones
   - Botones de acción para navegar directamente

2. ✅ **Notificaciones Push del Navegador**
   - Solicitud de permiso al usuario
   - Notificaciones incluso cuando la app no está abierta
   - Botón en el panel para activar push
   - Click en la notificación abre la URL de acción

3. ✅ **Tiempo Real con Supabase Realtime**
   - Las notificaciones aparecen instantáneamente
   - Sin necesidad de recargar la página
   - WebSocket connection automática

4. ✅ **Sonido de Notificación**
   - Sonido breve cuando llega una notificación
   - Volumen moderado (30%)

5. ✅ **Consola de Administración** (`/centro-notificaciones`)
   - Enviar notificaciones globales
   - Destinatarios:
     - Todos los usuarios
     - Una oficina específica
     - Un rol específico (Administrador, Gerente, Empleado, Agente)
     - Usuario específico (pendiente de búsqueda)
   - Historial de notificaciones enviadas
   - Solo accesible para Administradores

6. ✅ **Base de Datos**
   - Tabla `notificaciones` para notificaciones individuales
   - Tabla `notificaciones_globales` para registro de broadcasts
   - RLS policies configuradas correctamente
   - Función SQL `crear_notificacion()` para facilitar inserción
   - Función SQL `enviar_notificacion_global()` para broadcasts
   - Auto-eliminación de notificaciones mayores a 90 días

7. ✅ **Helper Functions**
   - Archivo `notificationHelpers.ts` con templates predefinidos
   - Funciones para cada tipo de notificación por módulo
   - Fácil integración desde cualquier parte del código

---

## 📝 Cómo Usar el Sistema de Notificaciones

### **1. Notificaciones en el Dashboard (Para Usuarios)**

Los usuarios verán el ícono de campana en la esquina superior derecha:

- **Badge rojo animado** muestra el número de notificaciones no leídas
- **Click en la campana** abre el panel de notificaciones
- **Filtro por módulo** para ver solo notificaciones de un área específica
- **Botón "Marcar todo como leído"** para limpiar todas
- **Botones de acción** en cada notificación para ir directamente al contenido

**Activar Notificaciones Push:**
1. Click en campana
2. Click en botón "Activar push"
3. Aceptar permiso del navegador
4. Recibirás notificaciones incluso fuera de la app

---

### **2. Enviar Notificaciones Globales (Administradores)**

Como Administrador, puedes ir a **"Centro de Notificaciones"** en el menú lateral:

#### **Formulario de Envío:**

1. **Título**: Título corto de la notificación
   - Ejemplo: "Nueva política interna"

2. **Mensaje**: Descripción completa
   - Ejemplo: "Se ha actualizado la política de vacaciones. Por favor, revisa los cambios."

3. **Enlace o Acción** (Opcional): URL interna para navegación
   - Ejemplo: `/vacaciones`
   - Ejemplo: `/seguros-education`

4. **Destinatarios**: Selecciona quién recibirá la notificación
   - **Todos**: Todos los usuarios activos
   - **Oficina**: Usuarios de una oficina específica
   - **Rol**: Todos los usuarios con un rol (Admin, Gerente, Empleado, Agente)
   - **Usuario**: Un usuario específico (requiere búsqueda)

5. Click en **"Enviar Notificación"**

La notificación se enviará **inmediatamente** a todos los destinatarios y aparecerá en sus paneles en tiempo real.

---

### **3. Integrar Notificaciones en tus Módulos**

Ya están creados **templates predefinidos** para todos los módulos. Aquí algunos ejemplos:

#### **Ejemplo 1: Notificar nuevo correo**

```typescript
import { NotificationTemplates } from '../lib/notificationHelpers';

// Cuando llega un nuevo correo
await NotificationTemplates.nuevoCorreo(
  'Juan Pérez',        // Nombre del remitente
  usuario.id           // ID del usuario que recibe
);
```

#### **Ejemplo 2: Notificar nuevo mensaje en Chat**

```typescript
await NotificationTemplates.nuevoMensaje(
  'María García',      // Nombre del remitente
  usuario.id,          // ID del destinatario
  'chat-id-123'        // ID del chat
);
```

#### **Ejemplo 3: Notificar solicitud de vacaciones aprobada**

```typescript
await NotificationTemplates.solicitudAprobada(
  usuario.id           // ID del empleado
);
```

#### **Ejemplo 4: Notificar curso completado**

```typescript
await NotificationTemplates.cursoCompletado(
  'Introducción a Seguros',  // Título del curso
  usuario.id                  // ID del usuario
);
```

#### **Ejemplo 5: Notificar reserva en Espacio JIRO**

```typescript
await NotificationTemplates.reservaAprobada(
  'Sala de Juntas',    // Nombre del área
  usuario.id           // ID del usuario
);
```

---

### **4. Crear Notificaciones Personalizadas**

Si necesitas una notificación que no está en los templates:

```typescript
import { crearNotificacion } from '../lib/notificationHelpers';

await crearNotificacion({
  user_id: usuario.id,
  titulo: 'Título personalizado',
  mensaje: 'Mensaje detallado de lo que pasó',
  modulo: 'Mi Módulo',           // Nombre del módulo
  icono: 'star',                 // Icono (opcional, default: 'bell')
  accion_url: '/mi-ruta',        // URL interna (opcional)
  accion_texto: 'Ver detalles'   // Texto del botón (opcional)
});
```

---

### **5. Notificaciones Disponibles por Módulo**

#### **📨 Gestor de E-Mails**
- `nuevoCorreo(remitente, user_id)`
- `correoEnviado(user_id)`

#### **💬 Chat**
- `nuevoMensaje(nombre, user_id, chat_id)`
- `agregadoAGrupo(nombre, grupo, user_id, chat_id)`

#### **🧳 Vacaciones**
- `solicitudEnviada(fechaInicio, fechaFin, user_id)`
- `solicitudPendiente(empleado, user_id)`
- `solicitudAprobada(user_id)`
- `solicitudRechazada(user_id)`

#### **🧠 Seguros Education**
- `nuevaSesion(titulo, fecha, hora, user_id)`
- `transmisionIniciada(titulo, user_id, session_id)`
- `grabacionDisponible(titulo, user_id, lesson_id)`
- `cursoCompletado(titulo, user_id)`

#### **🏢 Espacio JIRO**
- `reservaSolicitada(area, fecha, user_id)`
- `reservaAprobada(area, user_id)`
- `reservaRechazada(area, user_id)`
- `recordatorioReserva(area, user_id)`

#### **🖼️ Publicidad**
- `nuevaPlantilla(categoria, user_id)`
- `disenoGuardado(user_id)`

#### **🔐 Accesos Nacional**
- `nuevoAcceso(aseguradora, user_id)`
- `accesoActualizado(usuario, aseguradora, user_id)`

#### **🖋️ Firma de E-Mail**
- `firmaActualizada(user_id)`
- `nuevaPlantillaAsignada(user_id)`

#### **📇 Contactos**
- `nuevoContacto(nombre, email, user_id)`

---

## 🎯 Ejemplos de Integración por Módulo

### **Módulo: Vacaciones**

Cuando un Gerente aprueba una solicitud:

```typescript
// En el handler de aprobación
const aprobarSolicitud = async (solicitudId: string, empleadoId: string) => {
  // 1. Actualizar solicitud en la BD
  await supabase
    .from('solicitudes_vacaciones')
    .update({ estado: 'aprobada' })
    .eq('id', solicitudId);

  // 2. Enviar notificación al empleado
  await NotificationTemplates.solicitudAprobada(empleadoId);

  // 3. Mostrar mensaje de éxito
  showToast('Solicitud aprobada y notificación enviada', 'success');
};
```

### **Módulo: Seguros Education**

Cuando se completa un curso:

```typescript
const handleVideoComplete = async () => {
  if (!selectedLesson || !usuario) return;

  try {
    // 1. Marcar como completado
    await supabase
      .from('seguros_progress')
      .upsert({
        user_id: usuario.id,
        lesson_id: selectedLesson.id,
        progreso: 100,
        completado: true,
      });

    // 2. Enviar notificación de felicitación
    await NotificationTemplates.cursoCompletado(
      selectedLesson.titulo,
      usuario.id
    );

    // 3. Actualizar UI
    fetchData();
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### **Módulo: Chat**

Cuando llega un mensaje nuevo:

```typescript
const enviarMensaje = async (mensaje: string, chatId: string) => {
  // 1. Guardar mensaje
  const { data: nuevoMensaje } = await supabase
    .from('mensajes')
    .insert({
      chat_id: chatId,
      user_id: usuario.id,
      contenido: mensaje,
    })
    .select()
    .single();

  // 2. Obtener participantes del chat
  const { data: participantes } = await supabase
    .from('chat_participantes')
    .select('user_id')
    .eq('chat_id', chatId)
    .neq('user_id', usuario.id); // Excluir al remitente

  // 3. Notificar a cada participante
  for (const participante of participantes || []) {
    await NotificationTemplates.nuevoMensaje(
      `${usuario.nombre} ${usuario.apellidos}`,
      participante.user_id,
      chatId
    );
  }
};
```

---

## 🔧 Configuración Avanzada

### **Cambiar Tiempo de Expiración de Notificaciones**

Por defecto, las notificaciones se eliminan después de 90 días. Para cambiar esto:

```sql
-- Modificar función en Supabase SQL Editor
CREATE OR REPLACE FUNCTION delete_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notificaciones
  WHERE fecha_creacion < now() - INTERVAL '30 days';  -- Cambiar aquí
END;
$$ LANGUAGE plpgsql;
```

### **Personalizar Sonido de Notificación**

En `NotificationContext.tsx`, línea con `playNotificationSound()`:

```typescript
const playNotificationSound = () => {
  const audio = new Audio('/ruta/a/tu/sonido.mp3'); // Cambiar aquí
  audio.volume = 0.5;  // Volumen (0.0 a 1.0)
  audio.play().catch(() => {});
};
```

### **Cambiar Límite de Notificaciones Mostradas**

En `NotificationContext.tsx`, línea de `fetchNotifications()`:

```typescript
.limit(50)  // Cambiar este número
```

---

## 📊 Consultas SQL Útiles

### **Ver todas las notificaciones de un usuario:**
```sql
SELECT *
FROM notificaciones
WHERE user_id = 'uuid-del-usuario'
ORDER BY fecha_creacion DESC;
```

### **Notificaciones no leídas por usuario:**
```sql
SELECT
  u.nombre,
  u.apellidos,
  COUNT(*) as no_leidas
FROM notificaciones n
JOIN usuarios u ON n.user_id = u.id
WHERE n.leida = false
GROUP BY u.id, u.nombre, u.apellidos
ORDER BY no_leidas DESC;
```

### **Notificaciones más comunes por módulo:**
```sql
SELECT
  modulo,
  COUNT(*) as total
FROM notificaciones
GROUP BY modulo
ORDER BY total DESC;
```

### **Historial de notificaciones globales:**
```sql
SELECT
  ng.titulo,
  ng.mensaje,
  ng.destinatarios,
  u.nombre || ' ' || u.apellidos as enviado_por,
  ng.fecha_envio
FROM notificaciones_globales ng
JOIN usuarios u ON ng.enviado_por = u.id
ORDER BY ng.fecha_envio DESC;
```

---

## 🚨 Troubleshooting

### **Problema: Las notificaciones no aparecen en tiempo real**

**Solución:**
1. Verificar que Realtime esté habilitado en Supabase:
   - Dashboard de Supabase → Settings → API → Realtime
   - Debe estar activado
2. Verificar que la tabla tiene publicación activa:
   ```sql
   SELECT * FROM pg_publication_tables WHERE tablename = 'notificaciones';
   ```

### **Problema: Push notifications no funcionan**

**Solución:**
1. Verificar que el navegador soporta notificaciones (Chrome, Firefox, Edge)
2. Verificar que el sitio está en HTTPS (localhost está OK para pruebas)
3. Verificar que el usuario aceptó el permiso
4. Revisar consola del navegador para errores

### **Problema: El bell icon no se ve**

**Solución:**
1. Verificar que `NotificationProvider` está envolviendo la app en `App.tsx`
2. Verificar que el contexto se importó correctamente
3. Limpiar caché y rebuild: `npm run build`

---

## ✨ Características Adicionales

### **Auto-Marcado como Leída**

Cuando haces click en "Ver más" o en el botón de acción, la notificación se marca automáticamente como leída.

### **Animación del Badge**

El badge rojo tiene una animación de pulso (`animate-pulse`) para llamar la atención.

### **Timestamps Relativos**

Los tiempos se muestran en formato relativo: "hace 5 minutos", "hace 2 horas", etc.

### **Responsive Design**

El panel de notificaciones se adapta perfectamente a móvil, tablet y desktop.

### **Iconos por Módulo**

Cada módulo tiene su propio icono en las notificaciones:
- 📧 Correos: Mail
- 💬 Chat: MessageSquare
- 📅 Vacaciones: Calendar
- 🎓 Educación: GraduationCap
- 📍 Espacio JIRO: MapPin
- 🎨 Publicidad: Palette
- 👥 Contactos: Users
- 📢 Sistema: Megaphone

---

## 🎉 Resumen

El sistema de notificaciones está **100% funcional** e incluye:

✅ Notificaciones en tiempo real
✅ Push notifications del navegador
✅ Panel interactivo con filtros
✅ Consola de administración
✅ Templates predefinidos para todos los módulos
✅ Base de datos con RLS
✅ Fácil integración en cualquier módulo
✅ Sonidos y animaciones
✅ Timestamps relativos
✅ Todo en español

**Para usar el sistema:**
1. Las notificaciones aparecen automáticamente en el bell icon
2. Los administradores pueden enviar notificaciones globales desde `/centro-notificaciones`
3. Cada módulo puede usar los templates de `NotificationTemplates`
4. Los usuarios pueden activar push para recibir fuera de la app

¡El sistema está listo para producción!
