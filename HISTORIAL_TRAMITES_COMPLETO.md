# Sistema de Historial Completo de Trámites

## Resumen

El sistema de historial de trámites ahora registra **TODOS** los movimientos y eventos relacionados con cada trámite, incluyendo fecha y hora exacta de cada acción.

## Eventos Registrados Automáticamente

### ✅ Eventos Implementados

1. **Creación del Trámite**
   - Fecha y hora de creación
   - Usuario que creó el trámite
   - Datos iniciales: folio, agente, estatus, prioridad, póliza, tipo de seguro, descripción

2. **Cambios de Estatus**
   - Estatus anterior y nuevo
   - Usuario que realizó el cambio
   - Fecha y hora exacta

3. **Cambios de Prioridad**
   - Prioridad anterior y nueva
   - Usuario que realizó el cambio
   - Fecha y hora exacta

4. **Reasignación de Agente**
   - Agente anterior y nuevo
   - Usuario que realizó la reasignación
   - Fecha y hora exacta

5. **Asignación de Ejecutivos**
   - Ejecutivo asignado
   - Usuario que realizó la asignación
   - Fecha y hora exacta

6. **Comentarios**
   - Contenido del comentario (preview si es muy largo)
   - Usuario que agregó el comentario
   - Fecha y hora exacta

7. **Archivos Adjuntados**
   - Nombre del archivo
   - Tipo de archivo
   - Tamaño en MB
   - Usuario que subió el archivo
   - Fecha y hora exacta

8. **Archivos Eliminados** 🆕
   - Nombre del archivo eliminado
   - Tipo de archivo
   - Tamaño en MB
   - Usuario que eliminó el archivo
   - Fecha y hora exacta

9. **Cambios en Póliza**
   - Póliza anterior y nueva
   - Usuario que realizó el cambio
   - Fecha y hora exacta

10. **Cambios en Descripción** 🆕
    - Preview de descripción anterior y nueva
    - Usuario que realizó el cambio
    - Fecha y hora exacta

11. **Cambios en Contacto** 🆕
    - Nombre de contacto anterior y nuevo
    - Usuario que realizó el cambio
    - Fecha y hora exacta

12. **Cambios en Tipo de Seguro** 🆕
    - Tipo anterior y nuevo
    - Usuario que realizó el cambio
    - Fecha y hora exacta

13. **Cambios en Resultado** 🆕
    - Resultado anterior y nuevo
    - Usuario que realizó el cambio
    - Fecha y hora exacta

14. **Cierre de Trámite**
    - Usuario que cerró el trámite
    - Fecha y hora de cierre
    - Razón del cierre (si aplica)

15. **Reapertura de Trámite**
    - Usuario que reabrió el trámite
    - Fecha y hora de reapertura
    - Razón de la reapertura (si aplica)

## Estructura de Datos

### Tabla: `ticket_historial`

```sql
CREATE TABLE ticket_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  accion text NOT NULL,
  detalle jsonb DEFAULT '{}'::jsonb,
  tipo_accion text,  -- 🆕 Campo nuevo para filtrado
  fecha_hora timestamptz DEFAULT now()
);
```

### Tipos de Acción

- `creacion` - Creación del trámite
- `estatus` - Cambio de estatus
- `modificacion` - Modificación de datos
- `comentario` - Comentario agregado
- `archivo` - Archivo adjuntado o eliminado
- `asignacion` - Asignación de ejecutivo o agente
- `cierre` - Cierre del trámite
- `reapertura` - Reapertura del trámite

## Triggers Automáticos

### 1. `trigger_log_ticket_cambio`
Registra automáticamente:
- Creación del ticket (INSERT)
- Todos los cambios en campos del ticket (UPDATE)
- Detecta específicamente: estatus, prioridad, agente, póliza, descripción, contacto, tipo de seguro, resultado, cierre, reapertura

### 2. `trigger_log_ticket_comentario`
Registra automáticamente:
- Cada comentario agregado
- Preview del mensaje si es muy largo

### 3. `trigger_log_ticket_archivo`
Registra automáticamente:
- Cada archivo adjuntado
- Nombre, tipo y tamaño del archivo

### 4. `trigger_log_ticket_archivo_eliminado` 🆕
Registra automáticamente:
- Cada archivo eliminado
- Información del archivo antes de eliminarse

### 5. `trigger_log_ticket_asignacion`
Registra automáticamente:
- Cada asignación de ejecutivo
- Quién asignó y a quién fue asignado

## Interfaz de Usuario

### Componente: `TramiteHistorial.tsx`

#### Características:

1. **Vista Cronológica**
   - Línea de tiempo visual
   - Eventos ordenados del más reciente al más antiguo
   - Iconos de reloj para cada evento

2. **Colores por Tipo de Evento**
   - 🟢 Verde: Creación
   - 🔴 Rojo: Cierre
   - 🔵 Azul: Comentarios
   - 🟣 Morado: Archivos
   - 🟡 Amarillo: Cambios de estatus
   - 🟠 Naranja: Asignaciones
   - 🟤 Ámbar: Modificaciones generales
   - 🔷 Primario: Reaperturas

3. **Filtro por Tipo de Evento** 🆕
   - Selector desplegable para filtrar eventos
   - Opciones:
     - Todos los eventos
     - Creación
     - Cambios de estatus
     - Modificaciones
     - Comentarios
     - Archivos
     - Asignaciones
     - Cierres
     - Reaperturas

4. **Contador Dinámico**
   - Muestra cantidad de eventos filtrados vs total
   - Ejemplo: "Historial de Cambios (15 de 47)"

5. **Detalles Expandibles**
   - Cada evento muestra información contextual
   - Valores anteriores y nuevos en cambios
   - Preview de mensajes largos

6. **Actualización en Tiempo Real**
   - Suscripción a cambios en la base de datos
   - Nuevos eventos aparecen automáticamente
   - No requiere recargar la página

## Ejemplo de Uso

### Caso: Usuario modifica un trámite

```javascript
// Usuario actualiza la descripción del trámite
await supabase
  .from('tickets')
  .update({
    descripcion: 'Nueva descripción actualizada',
    modificado_por: usuarioId
  })
  .eq('id', ticketId);

// ✅ Automáticamente se registra en ticket_historial:
{
  ticket_id: 'abc-123',
  usuario_id: 'user-456',
  accion: 'Descripción actualizada',
  tipo_accion: 'modificacion',
  detalle: {
    descripcion_anterior_preview: 'Descripción original...',
    descripcion_nueva_preview: 'Nueva descripción actualizada'
  },
  fecha_hora: '2026-03-31 14:23:45'
}
```

### Caso: Usuario sube un archivo

```javascript
// Usuario adjunta un archivo
await supabase
  .from('ticket_archivos')
  .insert({
    ticket_id: ticketId,
    nombre: 'Cotización.pdf',
    tipo: 'application/pdf',
    tamano: 2048000,
    usuario_id: usuarioId
  });

// ✅ Automáticamente se registra en ticket_historial:
{
  ticket_id: 'abc-123',
  usuario_id: 'user-456',
  accion: 'Archivo adjuntado',
  tipo_accion: 'archivo',
  detalle: {
    usuario: 'Juan Pérez',
    nombre_archivo: 'Cotización.pdf',
    tipo: 'application/pdf',
    tamano_mb: 2.00
  },
  fecha_hora: '2026-03-31 14:25:12'
}
```

### Caso: Usuario cierra un trámite

```javascript
// Usuario cierra el trámite
await supabase
  .from('tickets')
  .update({
    cerrado_en: new Date().toISOString(),
    cerrado_por: usuarioId,
    modificado_por: usuarioId
  })
  .eq('id', ticketId);

// ✅ Automáticamente se registra en ticket_historial:
{
  ticket_id: 'abc-123',
  usuario_id: 'user-456',
  accion: 'Ticket cerrado',
  tipo_accion: 'cierre',
  detalle: {
    cerrado_por: 'María González',
    fecha_cierre: '2026-03-31 16:45:30'
  },
  fecha_hora: '2026-03-31 16:45:30'
}
```

## Beneficios

1. **Auditoría Completa**
   - Rastro completo de todas las acciones
   - Identificación de quién hizo qué y cuándo
   - Útil para cumplimiento y resolución de conflictos

2. **Transparencia**
   - Los usuarios pueden ver todo el historial del trámite
   - Facilita la comunicación entre equipos

3. **Diagnóstico de Problemas**
   - Fácil identificar cuándo se hizo un cambio problemático
   - Rastrear archivos eliminados accidentalmente

4. **Reportes y Analytics**
   - Los datos del historial pueden usarse para:
     - Tiempo promedio de respuesta
     - Cantidad de modificaciones por trámite
     - Usuarios más activos
     - Identificar cuellos de botella

5. **Filtrado Eficiente**
   - El campo `tipo_accion` permite consultas rápidas
   - Índices optimizados para búsquedas

## Índices de Base de Datos

```sql
-- Índices para rendimiento óptimo
CREATE INDEX idx_ticket_historial_ticket ON ticket_historial(ticket_id);
CREATE INDEX idx_ticket_historial_fecha ON ticket_historial(fecha_hora DESC);
CREATE INDEX idx_ticket_historial_tipo_accion ON ticket_historial(tipo_accion);
```

## Notas Técnicas

### Seguridad
- Todos los triggers usan `SECURITY DEFINER`
- Los usuarios no pueden modificar o eliminar registros del historial
- RLS (Row Level Security) protege el acceso a los datos

### Rendimiento
- Los registros de historial se insertan de forma asíncrona
- No afecta el rendimiento de las operaciones principales
- Índices optimizados para consultas frecuentes

### Consistencia
- Todas las fechas usan `timestamptz` (con zona horaria)
- Los cambios se registran en la misma transacción que la acción original
- No es posible perder eventos por fallos parciales

## Próximas Mejoras Sugeridas

- [ ] Exportar historial a PDF o Excel
- [ ] Notificaciones cuando ciertos eventos ocurren
- [ ] Dashboard de métricas basado en historial
- [ ] Comparación lado a lado de cambios (diff view)
- [ ] Búsqueda de texto completo en el historial
