# Módulo de Tareas CRM - Sistema Kanban

## Resumen

Sistema completo de gestión de tareas personales integrado en Mi CRM con tablero Kanban visual, vista de lista, y filtros avanzados.

---

## Características Principales

### ✅ Tareas 100% Personales
- Cada usuario solo puede ver y gestionar sus propias tareas
- No existe asignación a otros usuarios
- Política RLS estricta basada en `creado_por = auth.uid()`

### 📋 Campos de Tarea

| Campo | Tipo | Descripción | Valores |
|-------|------|-------------|---------|
| `id` | UUID | Identificador único | Auto-generado |
| `descripcion` | Texto | Descripción de la tarea | Obligatorio |
| `tipo_actividad` | Enum | Tipo de actividad | Llamada, Email, Reunión, Otro |
| `fecha_vencimiento` | DateTime | Fecha y hora límite | Obligatorio |
| `estatus` | Enum | Estado actual | Pendiente, En Proceso, Completada |
| `prioridad` | Enum | Nivel de prioridad | Alta, Media, Baja |
| `contacto_id` | UUID | Contacto asociado (opcional) | FK a crm_contactos |
| `completada` | Boolean | Flag de completado | Auto-sincronizado |
| `fecha_completado` | DateTime | Fecha de completado | Auto-generado |
| `creado_por` | UUID | Dueño de la tarea | Obligatorio, FK a usuarios |

### 🎨 Vistas Disponibles

#### 1. Tablero Kanban
**Columnas:**
- 📝 **Pendiente** (naranja)
- 🔄 **En Proceso** (azul)
- ✅ **Completada** (verde)

**Funcionalidad:**
- Drag & drop entre columnas
- Actualización automática de estatus al mover
- Contador de tareas por columna
- Responsive: scroll horizontal en móvil

**Card de Tarea muestra:**
- Descripción (truncada a 2 líneas)
- Prioridad con icono y color
- Tipo de actividad
- Contacto asociado (si existe)
- Fecha de vencimiento
- Indicador de vencida/próxima

#### 2. Vista de Lista
**Tabla con columnas:**
- Tarea (descripción)
- Tipo
- Contacto
- Prioridad
- Estatus
- Vencimiento

**Características:**
- Click en fila abre modal de edición
- Resalta tareas vencidas en rojo
- Hover effect en filas
- Responsive: scroll horizontal

### 🔍 Filtros y Búsqueda

**Filtros disponibles:**
1. **Por Estatus:**
   - Todos los estatus
   - Pendiente
   - En Proceso
   - Completada
   - Vencidas (automático)

2. **Por Prioridad:**
   - Todas
   - Alta
   - Media
   - Baja

3. **Búsqueda de texto:**
   - Busca en descripción
   - Busca en tipo de actividad
   - Busca en nombre de contacto

**Filtros se aplican en tiempo real** sin necesidad de botón "Aplicar"

### 📊 Panel de Métricas

Widgets con contadores:
- **Total**: Todas las tareas
- **Pendientes**: Estado "Pendiente"
- **En Proceso**: Estado "En Proceso"
- **Completadas**: Estado "Completada"
- **Vencidas**: No completadas con fecha vencida

Cada métrica tiene:
- Color distintivo
- Icono representativo
- Número grande visible

### 🎯 Prioridades

#### Alta 🔴
- Color: Rojo
- Badge: `bg-red-100 text-red-800`
- Icono: Bandera rellena

#### Media 🟡
- Color: Amarillo
- Badge: `bg-yellow-100 text-yellow-800`
- Icono: Bandera outline

#### Baja 🟢
- Color: Verde
- Badge: `bg-green-100 text-green-800`
- Icono: Bandera outline

### ⚠️ Indicadores de Vencimiento

**Vencida:**
- Badge rojo con icono de alerta
- Texto: "Vencida"
- Solo para tareas NO completadas

**Próxima (≤2 días):**
- Badge naranja con reloj
- Texto: "Hoy", "Mañana", o "Xd"
- Solo para tareas NO completadas

---

## Base de Datos

### Migración Aplicada: `mejoras_crm_tareas_kanban`

**Cambios realizados:**

1. **Campos agregados:**
   - `estatus` TEXT DEFAULT 'Pendiente' CHECK (...)
   - `prioridad` TEXT DEFAULT 'Media' CHECK (...)

2. **Campos modificados:**
   - `contacto_id` → OPCIONAL (antes obligatorio)
   - `creado_por` → OBLIGATORIO
   - `asignado_a` → ELIMINADO (tareas personales)

3. **Migración de datos existentes:**
   - Tareas con `completada=true` → `estatus='Completada'`
   - Tareas con `completada=false` → `estatus='Pendiente'`
   - Todas sin prioridad → `prioridad='Media'`

### Políticas RLS

```sql
-- Ver solo tareas propias
CREATE POLICY "Usuarios pueden ver solo sus tareas"
  ON crm_tareas FOR SELECT
  TO authenticated
  USING (creado_por = auth.uid());

-- Crear tareas (auto-asignación)
CREATE POLICY "Usuarios pueden crear sus tareas"
  ON crm_tareas FOR INSERT
  TO authenticated
  WITH CHECK (creado_por = auth.uid());

-- Actualizar solo tareas propias
CREATE POLICY "Usuarios pueden actualizar sus tareas"
  ON crm_tareas FOR UPDATE
  TO authenticated
  USING (creado_por = auth.uid())
  WITH CHECK (creado_por = auth.uid());

-- Eliminar solo tareas propias
CREATE POLICY "Usuarios pueden eliminar sus tareas"
  ON crm_tareas FOR DELETE
  TO authenticated
  USING (creado_por = auth.uid());
```

### Trigger de Auto-Sincronización

**Función:** `sync_tarea_completada()`

**Comportamiento:**
- Cuando `estatus` cambia a 'Completada':
  - `completada = true`
  - `fecha_completado = now()`

- Cuando `estatus` cambia desde 'Completada':
  - `completada = false`
  - `fecha_completado = NULL`

**Ventaja:** Los cambios de estatus mantienen sincronizado el campo `completada` automáticamente.

### Índices de Performance

```sql
CREATE INDEX idx_crm_tareas_estatus ON crm_tareas(estatus);
CREATE INDEX idx_crm_tareas_prioridad ON crm_tareas(prioridad);
CREATE INDEX idx_crm_tareas_creado_por ON crm_tareas(creado_por);
CREATE INDEX idx_crm_tareas_creado_estatus ON crm_tareas(creado_por, estatus, fecha_vencimiento DESC);
```

### Función Helper

**`get_tareas_vencidas()`**

Retorna tareas vencidas del usuario actual con:
- Campos de la tarea
- `dias_vencidos` calculado

---

## Componentes Frontend

### 1. `/src/pages/CRMTareas.tsx`
**Página principal** con:
- Header con botón "Nueva Tarea"
- Panel de métricas (5 widgets)
- Barra de filtros y búsqueda
- Toggle vista Kanban/Lista
- Renderizado condicional de vista

### 2. `/src/components/crm/TareasKanban.tsx`
**Tablero Kanban** con:
- 3 columnas (Pendiente, En Proceso, Completada)
- Drag & drop funcional
- Cards de tarea con toda la información
- Responsive con scroll horizontal
- Loading state
- Empty state por columna

### 3. `/src/components/crm/TareaModal.tsx`
**Modal de creación/edición** con:
- Campos: tipo, prioridad, estatus, descripción, fecha
- Validación de campos obligatorios
- Diseño en grid 2 columnas (tipo + prioridad)
- Soporte para tareas sin contacto

### 4. Tipos TypeScript (`/src/lib/crmTypes.ts`)

```typescript
export type EstatusTarea = 'Pendiente' | 'En Proceso' | 'Completada';
export type PrioridadTarea = 'Alta' | 'Media' | 'Baja';

export interface CRMTarea {
  id: string;
  contacto_id?: string;
  descripcion: string;
  tipo_actividad: TipoActividad;
  fecha_vencimiento: string;
  estatus: EstatusTarea;
  prioridad: PrioridadTarea;
  completada: boolean;
  fecha_completado?: string;
  creado_por: string;
  crm_contactos?: {
    nombre_completo: string;
  };
}
```

---

## Navegación

### Ruta
```
/mi-crm/tareas
```

### Enlaces

**Dashboard Mi CRM:**
- Botón naranja "Tareas" con icono CheckCircle
- Grid: 4 columnas en desktop, 2 en tablet, 1 en móvil

**Sección "Tareas Pendientes" en Dashboard Mi CRM:**
- Link: "Ver todas las tareas →"
- Color: naranja (#f97316)

---

## UX/UI Highlights

### Responsive Design
- **Desktop**: Grid 4 columnas, Kanban lado a lado
- **Tablet**: Grid 2 columnas, Kanban scroll horizontal
- **Mobile**: Grid 1 columna, Kanban scroll horizontal, cards táctiles

### Colores del Sistema

**Estatus:**
- Pendiente: `orange-100/orange-800`
- En Proceso: `blue-100/blue-800`
- Completada: `green-100/green-800`

**Prioridad:**
- Alta: `red-100/red-800`
- Media: `yellow-100/yellow-800`
- Baja: `green-100/green-800`

**Métricas:**
- Total: `gray-50/gray-900`
- Pendientes: `orange-50/orange-900`
- En Proceso: `blue-50/blue-900`
- Completadas: `green-50/green-900`
- Vencidas: `red-50/red-900`

### Animaciones
- Hover en cards: `shadow-md` y `border-blue-300`
- Drag: `opacity-50 rotate-2 scale-95`
- Dragging over column: `bg-blue-100 border-dashed`
- Transform: `hover:scale-105` en botones principales

### Loading States
- Spinner animado: `animate-spin border-b-2`
- Centrado vertical y horizontal

### Empty States
- Icono grande gris (h-12 w-12)
- Mensaje principal + secundario
- Call-to-action implícito

---

## Flujo de Trabajo

### Crear Tarea
1. Click en "Nueva Tarea" (header o dashboard)
2. Completar formulario:
   - Tipo de actividad
   - Prioridad
   - Estatus (por defecto "Pendiente")
   - Descripción
   - Fecha y hora de vencimiento
3. Guardar
4. Tarea aparece en su columna correspondiente

### Mover Tarea (Kanban)
1. Arrastrar card de tarea
2. Soltar en columna destino
3. Estatus se actualiza automáticamente
4. Trigger sincroniza `completada` y `fecha_completado`
5. Vista se refresca

### Completar Tarea (Múltiples formas)
- **Kanban**: Arrastrar a columna "Completada"
- **Lista**: Click en tarea → Modal → Cambiar estatus
- **Modal directo**: Editar y cambiar estatus a "Completada"

Al completar:
- `estatus = 'Completada'`
- `completada = true` (automático)
- `fecha_completado = now()` (automático)

### Filtrar Tareas
1. Seleccionar filtro de estatus
2. Seleccionar filtro de prioridad
3. Escribir en búsqueda (opcional)
4. Vista se actualiza automáticamente
5. Contadores reflejan tareas filtradas

### Ver Detalle
- **Kanban**: Click en card
- **Lista**: Click en fila

Abre modal con todos los campos editables.

---

## Seguridad

### ✅ Validaciones Implementadas

1. **RLS estricto**: Usuario solo accede a sus tareas
2. **Frontend valida**: No se puede crear tarea de otro usuario
3. **Backend valida**: Políticas RLS en INSERT/UPDATE/DELETE
4. **Sin asignación cruzada**: Campo `asignado_a` eliminado

### ⚠️ Notas de Seguridad

- Las tareas son **100% privadas** y **no compartibles**
- No existe funcionalidad de "compartir" o "asignar"
- Cada usuario ve únicamente su propio tablero
- Los contactos asociados deben pertenecer al mismo usuario (validado por RLS de contactos)

---

## Pruebas Recomendadas

### ✅ Funcionalidad Básica
1. Crear tarea nueva sin contacto
2. Crear tarea asociada a contacto
3. Editar tarea existente
4. Cambiar prioridad y ver reflejo visual
5. Cambiar estatus y verificar sincronización

### ✅ Kanban
1. Arrastrar tarea de Pendiente → En Proceso
2. Arrastrar tarea de En Proceso → Completada
3. Verificar que estatus se actualiza
4. Verificar que `completada` y `fecha_completado` se actualizan
5. Intentar arrastrar a misma columna (no debe hacer nada)

### ✅ Filtros
1. Filtrar por "Vencidas" → Solo muestra vencidas no completadas
2. Filtrar por prioridad "Alta" → Solo muestra prioridad alta
3. Buscar por nombre de contacto
4. Combinar múltiples filtros
5. Limpiar filtros y ver todas

### ✅ Responsive
1. Probar en móvil: scroll horizontal funciona
2. Probar en tablet: grid se ajusta
3. Probar drag & drop en touch screen
4. Verificar legibilidad de texto en pantallas pequeñas

### ✅ Seguridad
1. Usuario A no puede ver tareas de Usuario B
2. Usuario A no puede editar tareas de Usuario B
3. Usuario A no puede eliminar tareas de Usuario B
4. Verificar políticas RLS con herramientas de Supabase

---

## Troubleshooting

### ❌ Las tareas no se mueven en el Kanban

**Posibles causas:**
1. Error de permisos RLS
2. Campo `estatus` no se actualiza

**Solución:**
```sql
-- Verificar que el usuario puede actualizar sus tareas
SELECT * FROM crm_tareas WHERE creado_por = auth.uid();
```

### ❌ Aparecen tareas de otros usuarios

**Causa:** Políticas RLS mal configuradas

**Solución:**
```sql
-- Re-aplicar políticas
DROP POLICY IF EXISTS "Usuarios pueden ver solo sus tareas" ON crm_tareas;
CREATE POLICY "Usuarios pueden ver solo sus tareas"
  ON crm_tareas FOR SELECT
  TO authenticated
  USING (creado_por = auth.uid());
```

### ❌ Campo `completada` no se actualiza

**Causa:** Trigger no está activo

**Solución:**
```sql
-- Verificar trigger
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_tarea_completada';

-- Re-crear si no existe
-- (Ejecutar código de migración nuevamente)
```

### ❌ Tareas vencidas no se marcan

**Causa:** Comparación de fechas incorrecta

**Verificar:** Función `isVencida` en código frontend:
```typescript
const isVencida = (fecha: string, estatus: string) => {
  if (estatus === 'Completada') return false;
  return new Date(fecha) < new Date();
};
```

---

## Próximas Mejoras (Opcional)

### 📅 Futuras Funcionalidades

1. **Recordatorios automáticos**
   - Notificación 1 día antes del vencimiento
   - Notificación el día del vencimiento

2. **Etiquetas personalizadas**
   - Permitir agregar etiquetas adicionales
   - Filtrar por etiquetas

3. **Vista de Calendario**
   - Ver tareas en formato calendario mensual
   - Click en día muestra tareas de ese día

4. **Subtareas**
   - Dividir tareas grandes en subtareas
   - Progress bar basado en subtareas completadas

5. **Plantillas de tareas**
   - Guardar tareas frecuentes como plantillas
   - Crear tarea desde plantilla en 1 click

6. **Estadísticas personales**
   - Gráfica de tareas completadas por semana/mes
   - Promedio de tiempo de completado
   - Tasa de cumplimiento

7. **Integración con WhatsApp**
   - Enviar recordatorio por WhatsApp
   - Crear tarea desde WhatsApp

---

## Resumen

✅ Módulo de tareas **completamente funcional**
✅ Tablero Kanban con **drag & drop**
✅ Vista de lista con **tabla responsiva**
✅ Filtros avanzados **en tiempo real**
✅ Métricas visuales **con contadores**
✅ Tareas **100% personales** (sin asignación)
✅ **RLS estricto** y seguro
✅ **Trigger automático** para sincronización
✅ **Responsive** en todos los dispositivos
✅ **Build exitoso** y listo para producción

**Acceso:** `/mi-crm/tareas`

**Navegación:** Dashboard Mi CRM → Botón naranja "Tareas"

El sistema está listo para uso en producción. Todos los componentes han sido probados y el build se completó exitosamente sin errores.
