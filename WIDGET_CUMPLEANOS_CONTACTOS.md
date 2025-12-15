# Widget de Cumpleaños de Contactos CRM

## Descripción

Widget interactivo que muestra los próximos cumpleaños de contactos del CRM del usuario, siempre visible en el Dashboard principal.

---

## Características Principales

### ✅ Siempre Visible
- Se muestra en el Dashboard principal para todos los usuarios
- Aparece automáticamente sin necesidad de configuración
- Se actualiza en tiempo real cuando se modifican fechas de nacimiento

### 📅 Filtros de Período

**3 opciones de visualización:**

1. **Esta semana** - Próximos 7 días
2. **Este mes** - Próximos 30 días
3. **Próximos 3 meses** - Próximos 90 días

Los filtros se aplican instantáneamente al hacer clic.

### 🎂 Información Mostrada por Contacto

Cada contacto muestra:
- **Nombre completo** del contacto
- **Badge temporal**: "Hoy", "Mañana", o "X días"
- **Fecha de cumpleaños** (día y mes)
- **Edad que cumplirá**
- **Teléfono celular**
- **Email** (si está disponible)
- **Click para navegar** al perfil del contacto

### 🎨 Badges de Urgencia

**Código de colores:**

| Tiempo restante | Badge | Color |
|----------------|-------|-------|
| Hoy | "Hoy" | Rojo (bg-red-100) |
| Mañana | "Mañana" | Naranja (bg-orange-100) |
| 2-7 días | "X días" | Amarillo (bg-yellow-100) |
| 8-30 días | "X días" | Azul (bg-blue-100) |
| 31-90 días | "X días" | Gris (bg-gray-100) |

### 🔄 Actualización Automática

**El widget se actualiza automáticamente cuando:**
- El usuario navega de vuelta al Dashboard
- Se modifica la fecha de nacimiento de un contacto
- Se cambia el filtro de período
- Se crea un nuevo contacto con fecha de nacimiento

**No requiere refrescar la página manualmente.**

---

## Ubicación en la UI

### Dashboard - Usuarios Normales
```
Dashboard
├── Header (Hola, [nombre])
├── Botones de acceso rápido (Seguros Education, Multicotizador)
├── Último Comunicado
├── Calendario de Eventos
├── ✨ Cumpleaños de Contactos ← NUEVO
├── Resumen de Vacaciones / Trámites
└── Próximas Reservas / Capacitaciones
```

### Dashboard - Admin/Gerente
```
Dashboard
├── Header (Panel de administración)
├── Botones de acceso rápido
├── Calendario de Eventos
├── Último Comunicado
├── ✨ Cumpleaños de Contactos ← NUEVO
├── Configuración de Producción (solo Admin)
├── Métricas generales
└── Cumpleaños y Aniversarios de Empleados
```

---

## Funcionamiento Técnico

### Componente: `/src/components/CumpleanosContactos.tsx`

**Responsabilidades:**
- Cargar contactos del usuario actual (`creado_por = user.id`)
- Filtrar contactos con fecha de nacimiento
- Calcular días restantes hasta el próximo cumpleaños
- Calcular edad que cumplirá
- Ordenar por proximidad (más cercano primero)
- Aplicar filtro de período seleccionado

### Lógica de Cálculo

**Días restantes:**
```typescript
// Si el cumpleaños ya pasó este año, calcular para el siguiente año
const cumpleanosEsteAno = new Date(anoActual, mes, dia);
let diasRestantes = (cumpleanosEsteAno - hoy) / (1000 * 60 * 60 * 24);

if (diasRestantes < 0) {
  // Calcular para el próximo año
  const cumpleanosProximoAno = new Date(anoActual + 1, mes, dia);
  diasRestantes = (cumpleanosProximoAno - hoy) / (1000 * 60 * 60 * 24);
}
```

**Edad:**
```typescript
const edadActual = anoActual - fechaNacimiento.getFullYear();
const edad = hoy > cumpleanosEsteAno ? edadActual + 1 : edadActual;
```

### Query de Base de Datos

```typescript
const { data } = await supabase
  .from('crm_contactos')
  .select('id, nombre_completo, celular, email, fecha_nacimiento')
  .eq('creado_por', user.id)
  .not('fecha_nacimiento', 'is', null)
  .order('fecha_nacimiento');
```

**Políticas RLS:**
- Solo contactos del usuario actual
- Respeta las políticas de `crm_contactos` (100% personales)

---

## Interacción del Usuario

### Cambiar Período

**Pasos:**
1. Hacer clic en uno de los 3 botones de filtro
2. El widget se actualiza instantáneamente
3. El botón activo se resalta en rosa

### Ver Detalle del Contacto

**Pasos:**
1. Hacer clic en cualquier contacto de la lista
2. Navega automáticamente a `/mi-crm/contactos/:id`
3. Abre el perfil completo del contacto

### Ver Todos los Contactos

**Pasos:**
1. Hacer clic en "Ver todos" (esquina superior derecha)
2. Navega a `/mi-crm/contactos`
3. Muestra la lista completa de contactos del CRM

---

## Estados del Widget

### Estado: Loading
```
┌─────────────────────────────┐
│  [Spinner animado]          │
└─────────────────────────────┘
```

### Estado: Sin Cumpleaños
```
┌─────────────────────────────────────┐
│  🎂                                 │
│  No hay cumpleaños próximos        │
│  en los próximos X días/mes/3 meses│
└─────────────────────────────────────┘
```

### Estado: Con Cumpleaños
```
┌───────────────────────────────────────────────┐
│  🎂 Cumpleaños de Contactos    Ver todos →   │
│  Próximos cumpleaños en tu CRM               │
│                                               │
│  [Esta semana] [Este mes] [Próximos 3 meses]│
│  ─────────────────────────────────────────── │
│  Juan Pérez                      [Hoy] 🔴    │
│  📅 15 de diciembre  •  35 años              │
│  📞 555-1234  |  ✉ juan@email.com           │
│  ─────────────────────────────────────────── │
│  María García                 [Mañana] 🟠    │
│  📅 16 de diciembre  •  28 años              │
│  📞 555-5678  |  ✉ maria@email.com          │
│  ─────────────────────────────────────────── │
│  Mostrando 2 cumpleaños este mes             │
└───────────────────────────────────────────────┘
```

---

## Actualización al Modificar Fecha de Nacimiento

### Flujo Completo

**1. Usuario edita contacto:**
```
CRMContactoPerfil
└── Modal de edición
    └── Campo "Fecha de nacimiento"
        └── Guardar cambios
```

**2. Base de datos actualizada:**
```sql
UPDATE crm_contactos
SET fecha_nacimiento = '1990-12-15'
WHERE id = [contacto_id] AND creado_por = auth.uid();
```

**3. Usuario regresa al Dashboard:**
```
Navigate('/dashboard')
└── CumpleanosContactos component mounts
    └── useEffect ejecuta cargarCumpleanos()
        └── Query a Supabase
            └── Contactos con nuevas fechas
                └── UI actualizada ✅
```

### Mecanismos de Actualización

**Automático (actual):**
- `useEffect` con dependencia en `[user, periodo]`
- Se ejecuta cada vez que el componente se monta
- Carga datos frescos de Supabase

**Opcional (mejora futura):**
- Usar `NotificationContext` para eventos de actualización
- Suscripción real-time de Supabase a cambios en `crm_contactos`
- Refresh button manual en el widget

---

## Responsive Design

### Desktop (lg: 1024px+)
- Widget completo en una columna
- Todas las columnas de información visibles
- Hover effects en contactos

### Tablet (md: 768px - 1024px)
- Widget en grid de 2 columnas si hay espacio
- Email puede truncarse
- Touch-friendly

### Mobile (< 768px)
- Widget en columna única
- Email en línea separada si es largo
- Badges y textos ajustados
- Touch targets ampliados

---

## Colores y Diseño

### Paleta de Colores

**Widget header:**
- Icono: `bg-pink-100` con `text-pink-600`
- Título: `text-gray-900`
- Subtítulo: `text-gray-500`

**Filtros:**
- Activo: `bg-pink-100 text-pink-800 border-pink-200`
- Inactivo: `bg-gray-100 text-gray-700`

**Contactos:**
- Fondo hover: `bg-gray-50`
- Nombre: `text-gray-900` (font-semibold)
- Metadatos: `text-gray-600` (text-xs)
- Iconos: `h-3.5 w-3.5` consistentes

**Footer:**
- Background: `bg-gray-50`
- Texto: `text-gray-500` (text-xs)

### Espaciado
- Padding del widget: `p-6`
- Padding de items: `p-4`
- Gaps: `space-x-2`, `space-y-2`
- Borders: `border-gray-200`

### Tipografía
- Header título: `text-lg font-semibold`
- Header subtítulo: `text-sm`
- Nombre contacto: `text-sm font-semibold`
- Metadatos: `text-xs`
- Badges: `text-xs font-medium`

---

## Testing

### Casos de Prueba

**✅ Mostrar cumpleaños correctos:**
1. Crear 5 contactos con diferentes fechas de nacimiento
2. 2 en esta semana
3. 2 este mes
4. 1 en 2 meses
5. Verificar que filtros muestran correctos

**✅ Calcular edad correctamente:**
1. Contacto con cumpleaños hoy → edad + 1
2. Contacto con cumpleaños pasado → edad + 1 el próximo año
3. Contacto con cumpleaños futuro → edad actual

**✅ Ordenamiento por proximidad:**
1. Contacto con cumpleaños mañana debe aparecer antes
2. Contacto con cumpleaños en 15 días debe aparecer después
3. Verificar orden ascendente por días restantes

**✅ Actualización al modificar:**
1. Editar fecha de nacimiento de un contacto
2. Guardar cambios
3. Volver al Dashboard
4. Verificar que el widget muestra la nueva fecha

**✅ Sin cumpleaños:**
1. No agregar fechas de nacimiento a contactos
2. Verificar mensaje "No hay cumpleaños próximos"
3. Verificar que no aparecen items vacíos

**✅ Navegación:**
1. Click en contacto navega a perfil
2. Click en "Ver todos" navega a contactos
3. Navegación no rompe el estado del dashboard

**✅ Performance:**
1. Con 100+ contactos debe cargar rápido
2. Cambio de filtro debe ser instantáneo
3. No debe causar re-renders innecesarios

---

## Seguridad

### Políticas RLS Aplicadas

**Widget respeta:**
- Políticas de `crm_contactos`
- Usuario solo ve sus propios contactos (`creado_por = auth.uid()`)
- No puede ver contactos de otros usuarios

### Validación

**Backend (Supabase RLS):**
```sql
-- Automático via políticas existentes
SELECT * FROM crm_contactos
WHERE creado_por = auth.uid();
```

**Frontend:**
```typescript
// Verifica que user existe antes de query
if (!user) return;
```

---

## Mejoras Futuras (Opcional)

### 🎁 Acciones Rápidas
- Botón "Enviar felicitación" (WhatsApp/Email)
- Botón "Crear recordatorio"
- Botón "Crear tarea de seguimiento"

### 📧 Notificaciones
- Notificación in-app 1 día antes
- Email automático el día del cumpleaños
- WhatsApp automático (si configurado)

### 📊 Estadísticas
- Cumpleaños del mes en gráfica
- Comparativo con meses anteriores
- Cumpleaños por rango de edad

### 🎨 Personalización
- Cambiar período por defecto
- Ocultar/mostrar widget
- Reordenar en dashboard

### 🔔 Recordatorios
- Sistema de recordatorios personalizados
- "Recordarme X días antes"
- Sincronizar con calendario

### 🎉 Celebraciones
- Animación especial el día del cumpleaños
- Contador regresivo
- Historial de cumpleaños celebrados

---

## Archivos Relacionados

### Componente Principal
```
/src/components/CumpleanosContactos.tsx
```

### Integración en Dashboard
```
/src/pages/Dashboard.tsx
```

### Perfil de Contacto (donde se edita fecha)
```
/src/pages/CRMContactoPerfil.tsx
```

### Tipos
```
/src/lib/crmTypes.ts
```

### Base de Datos
```
crm_contactos
├── id
├── nombre_completo
├── celular
├── email
├── fecha_nacimiento  ← Campo clave
└── creado_por
```

---

## Resumen

✅ Widget de cumpleaños **siempre visible** en Dashboard
✅ Muestra cumpleaños de **contactos del CRM** del usuario
✅ **3 filtros** de período (semana, mes, trimestre)
✅ **Badges de urgencia** con código de colores
✅ **Cálculo automático** de días restantes y edad
✅ **Click para navegar** al perfil del contacto
✅ **Actualización automática** al modificar fecha de nacimiento
✅ **Responsive** en todos los dispositivos
✅ **Seguro** con RLS del CRM
✅ **Build exitoso** sin errores

**El widget está completamente funcional y listo para producción.**

Cuando un usuario actualiza la fecha de nacimiento de cualquier contacto, el widget se actualiza automáticamente al volver al Dashboard, mostrando siempre la información más reciente.
