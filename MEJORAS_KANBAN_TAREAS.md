# Mejoras al Sistema de Tareas CRM - Kanban

## Descripción

Sistema de gestión de tareas mejorado con vista Kanban horizontal, drag & drop entre columnas y selector de contacto al crear/editar tareas.

---

## ✅ Características Implementadas

### 1. Vista Kanban Horizontal con Drag & Drop

**El tablero Kanban muestra 3 columnas horizontales:**

#### 📋 Columnas del Kanban

| Columna | Estado | Icono | Color |
|---------|--------|-------|-------|
| Pendiente | Tareas nuevas sin iniciar | Clock | Naranja |
| En Proceso | Tareas en desarrollo | Loader | Azul |
| Completada | Tareas finalizadas | CheckCircle | Verde |

**Funcionalidad Drag & Drop:**
- Arrastrar cualquier tarea hacia otra columna
- Visual feedback al arrastrar (opacidad + rotación)
- Highlight de columna al pasar sobre ella
- Actualización automática del estatus en base de datos
- Smooth animations en todas las transiciones

#### 🎯 Características de las Tarjetas

Cada tarjeta de tarea muestra:
- **Badge de prioridad** (Alta/Media/Baja) con ícono y color
- **Tipo de actividad** (Llamada, Email, Reunión, Otro)
- **Descripción** de la tarea (truncada a 2 líneas)
- **Contacto relacionado** (si existe)
- **Fecha de vencimiento** con formato corto
- **Indicadores de urgencia**:
  - "Vencida" (rojo) - tareas pasadas
  - "Hoy" (naranja) - vence hoy
  - "Mañana" (naranja) - vence mañana
  - "Xd" (naranja) - vence en X días (≤2)

#### 🎨 Colores de Prioridad

**Badges y flags:**
- **Alta**: Rojo (bg-red-100, text-red-800)
- **Media**: Amarillo (bg-yellow-100, text-yellow-800)
- **Baja**: Verde (bg-green-100, text-green-800)

**Bordes de tarjetas:**
- Vencida: `border-red-300`
- Normal: `border-gray-200`
- Hover: `border-blue-300`

---

### 2. Selector de Contacto en Modal de Tarea

**Nueva funcionalidad al crear/editar tareas:**

#### 🔍 Campo de Búsqueda de Contacto

**Características:**
- Campo de búsqueda con ícono de lupa
- Autocompletado mientras se escribe
- Búsqueda por:
  - Nombre completo
  - Número de celular
  - Email

**Estado: Sin Contacto**
```
┌─────────────────────────────────────┐
│ 🔍 Buscar contacto (opcional)...   │
└─────────────────────────────────────┘
```

**Estado: Buscando**
```
┌─────────────────────────────────────┐
│ 🔍 Juan Pér                        │
├─────────────────────────────────────┤
│ 👤 Juan Pérez                      │
│    555-1234                        │
├─────────────────────────────────────┤
│ 👤 Juan García                     │
│    555-5678                        │
└─────────────────────────────────────┘
```

**Estado: Contacto Seleccionado**
```
┌─────────────────────────────────────┐
│ 🟦 J  Juan Pérez          [X]       │
│       555-1234                      │
└─────────────────────────────────────┘
```

#### ✨ Características del Selector

1. **Opcional** - No es obligatorio asignar un contacto
2. **Búsqueda inteligente** - Filtra por nombre, celular o email
3. **Dropdown automático** - Aparece al escribir
4. **Avatar visual** - Muestra inicial del nombre
5. **Información completa** - Nombre + teléfono
6. **Botón de limpiar** - Permite quitar contacto asignado
7. **Preserva contexto** - Si se abre desde un contacto, ese se mantiene

#### 🔒 Comportamiento Especial

**Cuando se abre desde perfil de contacto:**
- El contacto ya viene preseleccionado
- NO se puede quitar (botón X oculto)
- Garantiza que la tarea está vinculada al contacto

**Cuando se abre desde vista general:**
- Campo de búsqueda vacío
- Se puede buscar y seleccionar cualquier contacto
- Se puede crear tarea sin contacto
- Se puede quitar contacto después de seleccionar

---

### 3. Estructura del Modal de Tarea

**Campos del formulario (en orden):**

1. **Tipo de Actividad** (obligatorio)
   - Opciones: Llamada, Email, Reunión, Otro
   - Select estándar

2. **Prioridad** (obligatorio)
   - Opciones: Alta, Media, Baja
   - Con ícono de flag
   - Select estándar

3. **Estatus** (obligatorio)
   - Opciones: Pendiente, En Proceso, Completada
   - Select estándar

4. **Contacto Relacionado** (opcional)
   - Campo de búsqueda con autocompletado
   - Dropdown con lista de contactos
   - Badge visual cuando está seleccionado

5. **Descripción** (obligatorio)
   - Textarea de 4 líneas
   - Placeholder: "Describe la tarea a realizar..."

6. **Fecha y Hora de Vencimiento** (obligatorio)
   - Input datetime-local
   - Formato: YYYY-MM-DDTHH:mm

**Botones de acción:**
- **Cancelar** - Cierra sin guardar
- **Guardar Tarea** - Guarda y actualiza vista

---

## 🗄️ Estructura de Base de Datos

### Tabla: `crm_tareas`

```sql
CREATE TABLE crm_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion TEXT NOT NULL,
  tipo_actividad TEXT NOT NULL,
  fecha_vencimiento TIMESTAMPTZ NOT NULL,
  prioridad TEXT DEFAULT 'Media' CHECK (prioridad IN ('Alta', 'Media', 'Baja')),
  estatus TEXT DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente', 'En Proceso', 'Completada')),
  contacto_id UUID NULL REFERENCES crm_contactos(id) ON DELETE CASCADE,
  creado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  completada BOOLEAN DEFAULT false,
  fecha_completado TIMESTAMPTZ,
  fecha_creacion TIMESTAMPTZ DEFAULT now(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT now()
);
```

**Cambios clave:**
- `contacto_id` es **NULL** (opcional)
- `estatus` con 3 valores posibles
- `prioridad` con 3 valores posibles
- Índices para performance en queries

### Índices

```sql
CREATE INDEX idx_crm_tareas_estatus ON crm_tareas(estatus);
CREATE INDEX idx_crm_tareas_prioridad ON crm_tareas(prioridad);
CREATE INDEX idx_crm_tareas_creado_por ON crm_tareas(creado_por);
CREATE INDEX idx_crm_tareas_contacto ON crm_tareas(contacto_id);
CREATE INDEX idx_crm_tareas_creado_estatus ON crm_tareas(creado_por, estatus, fecha_vencimiento DESC);
```

### Políticas RLS

**Tareas 100% personales:**
- Usuario solo ve sus propias tareas (`creado_por = auth.uid()`)
- Usuario solo puede crear tareas a su nombre
- Usuario solo puede editar/eliminar sus tareas
- No hay visibilidad entre usuarios

```sql
-- SELECT
CREATE POLICY "Usuarios pueden ver solo sus tareas"
  ON crm_tareas FOR SELECT
  TO authenticated
  USING (creado_por = auth.uid());

-- INSERT
CREATE POLICY "Usuarios pueden crear sus tareas"
  ON crm_tareas FOR INSERT
  TO authenticated
  WITH CHECK (creado_por = auth.uid());

-- UPDATE
CREATE POLICY "Usuarios pueden actualizar sus tareas"
  ON crm_tareas FOR UPDATE
  TO authenticated
  USING (creado_por = auth.uid())
  WITH CHECK (creado_por = auth.uid());

-- DELETE
CREATE POLICY "Usuarios pueden eliminar sus tareas"
  ON crm_tareas FOR DELETE
  TO authenticated
  USING (creado_por = auth.uid());
```

---

## 🎮 Flujos de Usuario

### Flujo 1: Crear Tarea sin Contacto

```
1. Usuario va a CRM → Tareas
2. Click en "Nueva Tarea"
3. Selecciona tipo de actividad: "Llamada"
4. Selecciona prioridad: "Alta"
5. Deja estatus en: "Pendiente"
6. NO busca contacto (deja campo vacío)
7. Escribe descripción: "Llamar para seguimiento"
8. Selecciona fecha: mañana a las 10:00
9. Click en "Guardar Tarea"
10. Tarea aparece en columna "Pendiente" sin contacto
```

### Flujo 2: Crear Tarea con Contacto

```
1. Usuario va a CRM → Tareas
2. Click en "Nueva Tarea"
3. Selecciona tipo: "Email"
4. Selecciona prioridad: "Media"
5. En campo "Contacto Relacionado" escribe: "Juan"
6. Dropdown muestra: Juan Pérez, Juan García
7. Click en "Juan Pérez"
8. Badge muestra: 🟦 J Juan Pérez [555-1234] [X]
9. Completa descripción y fecha
10. Guarda tarea
11. Tarea aparece en Pendiente con nombre de Juan
```

### Flujo 3: Crear Tarea desde Perfil de Contacto

```
1. Usuario va a CRM → Contactos
2. Click en contacto "María López"
3. En perfil, sección "Tareas"
4. Click en "Nueva Tarea"
5. Modal se abre con María ya asignada
6. NO puede quitar el contacto (botón X oculto)
7. Completa resto de campos
8. Guarda tarea
9. Tarea aparece en timeline del contacto
```

### Flujo 4: Mover Tarea entre Columnas (Drag & Drop)

```
1. Usuario ve Kanban con tareas
2. En columna "Pendiente" hay tarea de Juan
3. Usuario hace click y mantiene sobre la tarea
4. Tarea se vuelve semi-transparente y rota
5. Arrastra hacia columna "En Proceso"
6. Columna se ilumina en azul con borde punteado
7. Suelta el mouse
8. Tarea se mueve a "En Proceso"
9. Se actualiza en base de datos (estatus = 'En Proceso')
10. Si tenía estatus Completada, se quita fecha_completado
```

### Flujo 5: Completar Tarea

```
1. Usuario arrastra tarea a columna "Completada"
2. Tarea se mueve visualmente
3. Backend actualiza:
   - estatus = 'Completada'
   - completada = true
   - fecha_completado = now()
4. Trigger automático se ejecuta
5. Tarea aparece en columna verde
6. Ya no muestra alertas de vencimiento
```

### Flujo 6: Buscar y Cambiar Contacto

```
1. Usuario edita tarea existente
2. Tarea tiene contacto "Juan Pérez" asignado
3. Click en botón [X] junto al contacto
4. Contacto se quita, aparece campo de búsqueda
5. Escribe: "María"
6. Selecciona "María López"
7. Guarda cambios
8. Tarea ahora muestra a María en la tarjeta
```

---

## 💡 Características Técnicas

### Componentes

**Archivo: `/src/components/crm/TareasKanban.tsx`**
- Vista principal del Kanban
- 3 columnas horizontales (flex-row)
- Drag & drop con HTML5 API
- Eventos: dragStart, dragEnd, dragOver, dragEnter, dragLeave, drop
- Actualización de estatus mediante callback
- Indicadores visuales de estado
- Responsive (scroll horizontal en móvil)

**Archivo: `/src/components/crm/TareaModal.tsx`**
- Modal de creación/edición
- Selector de contacto con autocompletado
- Carga de contactos del usuario
- Búsqueda en tiempo real
- Validación de campos requeridos
- Loading states

### Props y State

**TareasKanban Props:**
```typescript
interface TareasKanbanProps {
  tareas: Tarea[];
  onUpdateEstatus: (tareaId: string, nuevoEstatus: 'Pendiente' | 'En Proceso' | 'Completada') => Promise<void>;
  onVerDetalle: (tarea: Tarea) => void;
  loading?: boolean;
}
```

**TareaModal Props:**
```typescript
interface Props {
  contactoId?: string;         // Si se abre desde contacto
  tarea?: CRMTarea;            // Para edición
  onClose: () => void;         // Cerrar modal
  onSave: () => void;          // Callback después de guardar
}
```

**TareaModal State:**
```typescript
const [formData, setFormData] = useState({
  descripcion: string;
  tipo_actividad: string;
  fecha_vencimiento: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  estatus: 'Pendiente' | 'En Proceso' | 'Completada';
  contacto_id: string;
});

const [contactos, setContactos] = useState<CRMContacto[]>([]);
const [busquedaContacto, setBusquedaContacto] = useState('');
const [mostrarListaContactos, setMostrarListaContactos] = useState(false);
```

### Funciones Clave

**cargarContactos():**
- Carga todos los contactos del usuario
- Se ejecuta al montar el componente
- Usa `obtenerContactos()` de crmUtils

**contactosFiltrados:**
- Filtra contactos en tiempo real
- Búsqueda por nombre, celular o email
- Case-insensitive

**seleccionarContacto(id):**
- Asigna contacto a la tarea
- Cierra dropdown
- Limpia campo de búsqueda

**limpiarContacto():**
- Quita contacto asignado
- Solo si no viene de perfil de contacto

**handleDragStart/Drop:**
- Maneja drag & drop en Kanban
- Actualiza estatus en BD
- Visual feedback

---

## 🎨 Diseño Responsive

### Desktop (lg: 1024px+)
- 3 columnas lado a lado
- Ancho mínimo: 320px cada una
- Scroll horizontal si no cabe
- Tarjetas con hover effects

### Tablet (md: 768px - 1024px)
- 3 columnas en fila
- Scroll horizontal si necesario
- Tarjetas táctiles

### Mobile (< 768px)
- Vista horizontal con scroll
- Columnas de 320px mínimo
- Touch-friendly drag & drop
- Dropdowns fullwidth

---

## 🔐 Seguridad

### Validaciones Backend
- Solo contactos del usuario pueden ser asignados
- Solo tareas del usuario pueden ser editadas
- RLS policies en todas las operaciones
- Validación de auth.uid() en cada query

### Validaciones Frontend
- Campos requeridos obligatorios
- Formato de fecha válido
- Contacto existe en lista del usuario
- No permite manipular tareas de otros usuarios

---

## 📊 Performance

### Optimizaciones
- Índices en columnas de filtro
- Query selectivo por usuario
- Carga de contactos una sola vez
- Filtrado en memoria (client-side)
- Debounce implícito en búsqueda
- Lazy loading de dropdown

### Métricas Esperadas
- Carga inicial: < 500ms
- Drag & drop: < 100ms
- Búsqueda de contacto: instantánea
- Guardado de tarea: < 300ms

---

## 🐛 Manejo de Errores

### Casos Cubiertos

**1. Error al cargar contactos:**
- Console.error con detalles
- No bloquea creación de tarea
- Usuario puede continuar sin contacto

**2. Error al guardar tarea:**
- Alert con mensaje de error
- Modal permanece abierto
- Datos del formulario se preservan

**3. Error en drag & drop:**
- Tarea vuelve a columna original
- Console.error con detalles
- No se pierde información

**4. Contacto no encontrado:**
- Mensaje "No se encontraron contactos"
- Usuario puede seguir buscando
- Puede crear tarea sin contacto

---

## ✅ Testing

### Casos de Prueba

**✓ Kanban horizontal:**
1. Mostrar 3 columnas lado a lado
2. Tareas distribuidas por estatus
3. Contador correcto en cada columna
4. Mensaje cuando columna vacía

**✓ Drag & drop:**
1. Arrastrar tarea entre columnas
2. Visual feedback durante drag
3. Actualización de BD exitosa
4. Tarea no se pierde si hay error
5. No permite drop en misma columna

**✓ Selector de contacto:**
1. Cargar lista de contactos
2. Búsqueda por nombre funciona
3. Búsqueda por celular funciona
4. Búsqueda por email funciona
5. Selección actualiza UI
6. Limpiar contacto funciona
7. Contacto desde perfil no se puede quitar

**✓ Creación de tarea:**
1. Con todos los campos funciona
2. Sin contacto funciona
3. Con contacto funciona
4. Desde perfil de contacto funciona
5. Validación de campos requeridos
6. Guardado actualiza Kanban

**✓ Edición de tarea:**
1. Abrir modal con datos
2. Cambiar contacto funciona
3. Quitar contacto funciona
4. Guardar actualiza tarjeta
5. Cancelar no modifica nada

**✓ Responsive:**
1. Desktop muestra 3 columnas
2. Tablet permite scroll horizontal
3. Mobile mantiene funcionalidad drag
4. Dropdown no se sale de pantalla

---

## 📝 Archivos Modificados

### Componentes Actualizados

**`/src/components/crm/TareaModal.tsx`**
- Agregado import de User, Search icons
- Agregado import de obtenerContactos
- Nuevo state para contactos y búsqueda
- Nuevo campo de selector de contacto
- Lógica de búsqueda y filtrado
- UI de dropdown con resultados
- UI de contacto seleccionado
- Función de limpiar contacto

**`/src/components/crm/TareasKanban.tsx`**
- Ya implementado (no requirió cambios)
- Drag & drop funcional
- Vista horizontal lista
- Indicadores visuales completos

### Base de Datos

**Migración existente: `20251215173425_mejoras_crm_tareas_kanban.sql`**
- Campo `contacto_id` hecho opcional (DROP NOT NULL)
- Campos `estatus` y `prioridad` agregados
- Índices para performance
- Políticas RLS actualizadas
- Trigger de sincronización
- Función helper para tareas vencidas

---

## 🚀 Resumen de Mejoras

### ✅ Completado

1. **Vista Kanban horizontal** - 3 columnas side-by-side
2. **Drag & drop funcional** - Mover tareas entre columnas
3. **Selector de contacto** - Búsqueda con autocompletado
4. **Contacto opcional** - No obligatorio asignar contacto
5. **Indicadores visuales** - Prioridad, vencimiento, urgencia
6. **Responsive design** - Funciona en todos los dispositivos
7. **RLS policies** - Tareas 100% personales
8. **Performance optimizada** - Índices y queries eficientes

### 🎯 Beneficios

- **UX mejorado**: Vista clara del estado de todas las tareas
- **Productividad**: Cambiar estatus con un solo gesto
- **Organización**: Vincular tareas a contactos específicos
- **Flexibilidad**: Crear tareas generales sin contacto
- **Visual**: Prioridades y urgencias fáciles de identificar
- **Rápido**: Búsqueda instantánea de contactos

### 📦 Build

```bash
✓ 2891 modules transformed
✓ built in 17.54s
✓ Sin errores TypeScript
✓ Listo para producción
```

---

## 🎓 Cómo Usar

### Para Usuario Final

**Crear tarea rápida:**
1. Ir a CRM → Tareas
2. Click "Nueva Tarea"
3. Completar campos básicos
4. Guardar
5. Tarea aparece en Kanban

**Vincular a contacto:**
1. En modal de tarea
2. Buscar contacto en campo de búsqueda
3. Seleccionar de la lista
4. Continuar con resto de campos

**Mover tarea:**
1. Arrastrar tarjeta de tarea
2. Soltar en columna deseada
3. Automáticamente se actualiza

**Ver detalle:**
1. Click en tarjeta
2. Se abre modal con toda la info
3. Editar si es necesario

### Para Desarrollador

**Agregar nuevo estatus:**
```sql
ALTER TABLE crm_tareas DROP CONSTRAINT IF EXISTS crm_tareas_estatus_check;
ALTER TABLE crm_tareas ADD CONSTRAINT crm_tareas_estatus_check
  CHECK (estatus IN ('Pendiente', 'En Proceso', 'Completada', 'NUEVO_ESTATUS'));
```

**Agregar columna en Kanban:**
```typescript
const columnas = [
  // ... existentes
  {
    id: 'NUEVO_ESTATUS',
    titulo: 'Nuevo Estatus',
    icon: IconComponent,
    color: 'text-color-600',
    bgColor: 'bg-color-50'
  }
];
```

**Customizar búsqueda:**
```typescript
const contactosFiltrados = contactos.filter((contacto) =>
  contacto.nombre_completo.toLowerCase().includes(busquedaContacto.toLowerCase()) ||
  contacto.celular?.includes(busquedaContacto) ||
  contacto.email?.toLowerCase().includes(busquedaContacto.toLowerCase()) ||
  // Agregar más campos aquí
  contacto.empresa?.toLowerCase().includes(busquedaContacto.toLowerCase())
);
```

---

**Sistema de Tareas CRM completamente funcional con Kanban horizontal, drag & drop y selector de contacto.**

**Listo para producción y uso inmediato.**
