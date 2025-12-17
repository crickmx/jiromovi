# Sistema de Diseño Unificado - MOVI Digital

## Visión General

Este documento describe el sistema de diseño unificado implementado en toda la plataforma MOVI Digital para garantizar consistencia visual, responsividad total y experiencia premium en todos los dispositivos y navegadores.

---

## Principios de Diseño

### 1. Consistencia
- Misma tipografía en toda la plataforma
- Espaciados uniformes usando escala de 8px
- Colores semánticos consistentes
- Componentes reutilizables

### 2. Responsividad
- Mobile-first approach
- Breakpoints definidos y consistentes
- Touch targets mínimo 44x44px
- Sin scroll horizontal nunca

### 3. Rendimiento
- Animaciones suaves tipo iOS (200-300ms)
- Transiciones optimizadas con ease-ios-smooth
- CSS optimizado sin duplicados
- Sin Bootstrap (solo Tailwind)

### 4. Accesibilidad
- Contraste WCAG AA mínimo
- Focus visible en todos los elementos interactivos
- Navegación por teclado completa
- Labels claros en formularios

---

## Tokens de Diseño

### Colores

#### Primarios (MOVI Blue)
```css
--color-primary-50: 230 240 255
--color-primary-100: 204 224 255
--color-primary-200: 153 194 255
--color-primary-300: 102 163 255
--color-primary-400: 51 120 224
--color-primary-500: 0 80 209    /* Color principal */
--color-primary-600: 0 61 168
--color-primary-700: 0 47 127
--color-primary-800: 0 33 87
--color-primary-900: 0 19 46
```

#### Neutros (iOS Style)
```css
--color-neutral-50: 249 249 249   /* Backgrounds */
--color-neutral-100: 242 242 247
--color-neutral-200: 229 229 234  /* Borders */
--color-neutral-300: 209 209 214
--color-neutral-400: 199 199 204
--color-neutral-500: 174 174 178  /* Icons disabled */
--color-neutral-600: 142 142 147  /* Text secondary */
--color-neutral-700: 99 99 102    /* Text primary */
--color-neutral-800: 72 72 74
--color-neutral-900: 58 58 60     /* Headings */
```

#### Semánticos
```css
--color-success: 52 199 89    /* Verde iOS */
--color-warning: 255 149 0    /* Naranja iOS */
--color-danger: 255 59 48     /* Rojo iOS */
--color-info: 0 122 255       /* Azul iOS */
```

### Espaciado

Sistema basado en 8px:

```css
--spacing-xs: 0.5rem   /* 8px */
--spacing-sm: 0.75rem  /* 12px */
--spacing-md: 1rem     /* 16px */
--spacing-lg: 1.5rem   /* 24px */
--spacing-xl: 2rem     /* 32px */
--spacing-2xl: 3rem    /* 48px */
```

### Radios

```css
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px
--radius-xl: 20px
--radius-2xl: 28px
```

### Sombras

```css
--shadow-ios: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-ios-md: 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)
--shadow-ios-lg: 0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04)
--shadow-ios-xl: 0 20px 25px rgba(0,0,0,0.08), 0 10px 10px rgba(0,0,0,0.04)
```

### Tipografía

Familia tipográfica única:
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
             'Helvetica Neue', 'Helvetica', 'Arial', sans-serif
```

Jerarquía de tamaños (responsive con clamp):

```css
h1: clamp(1.75rem, 4vw, 2.25rem)    /* 28-36px */
h2: clamp(1.5rem, 3vw, 1.875rem)    /* 24-30px */
h3: clamp(1.25rem, 2.5vw, 1.5rem)   /* 20-24px */
h4: 1.125rem                          /* 18px */
h5-h6: 1rem                           /* 16px */
body: 1rem                            /* 16px */
small: 0.875rem                       /* 14px */
xs: 0.75rem                           /* 12px */
```

### Transiciones

```css
--transition-base: 200ms cubic-bezier(0.4, 0.0, 0.2, 1)
--transition-smooth: 250ms cubic-bezier(0.4, 0.0, 0.2, 1)
--transition-ios: 280ms cubic-bezier(0.32, 0.72, 0, 1)
```

---

## Componentes Base

### PageHeader

Componente para encabezados de página consistentes.

```tsx
import { PageHeader } from '@/components/ui/page-header';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

<PageHeader
  title="Gestión de Usuarios"
  description="Administra los usuarios de la plataforma"
  icon={Users}
  actions={
    <>
      <Button variant="outline">Exportar</Button>
      <Button>Nuevo Usuario</Button>
    </>
  }
/>
```

### Section

Componente para secciones con estilos consistentes.

```tsx
import { Section } from '@/components/ui/section';
import { Calendar } from 'lucide-react';

<Section
  title="Próximos eventos"
  description="Eventos programados para este mes"
  icon={Calendar}
  variant="card"
  actions={<Button size="sm">Ver todos</Button>}
>
  {/* Contenido */}
</Section>
```

Variantes:
- `default`: Sin fondo especial
- `card`: Con fondo blanco, borde y sombra
- `bordered`: Borde izquierdo de color primario

### Container

Wrapper para mantener anchos consistentes.

```tsx
import { Container } from '@/components/ui/container';

<Container size="xl">
  {/* Contenido con ancho máximo 1600px */}
</Container>
```

Tamaños disponibles:
- `sm`: max-w-3xl (768px)
- `md`: max-w-5xl (1024px)
- `lg`: max-w-7xl (1280px)
- `xl`: max-w-[1600px] (1600px)
- `full`: 100%

### StatsCard

Tarjetas para mostrar métricas y estadísticas.

```tsx
import { StatsCard } from '@/components/ui/stats-card';
import { Users } from 'lucide-react';

<StatsCard
  title="Total Usuarios"
  value="1,234"
  description="Usuarios activos"
  icon={Users}
  color="primary"
  trend={{
    value: 12,
    label: "vs mes anterior",
    direction: "up"
  }}
  onClick={() => navigate('/usuarios')}
/>
```

Colores disponibles:
- `primary`: Azul MOVI
- `success`: Verde
- `warning`: Naranja
- `danger`: Rojo
- `neutral`: Gris

---

## Estructura de Páginas

### Patrón Estándar

Todas las páginas deben seguir esta estructura:

```tsx
import { Layout } from '@/components/Layout';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Icon } from 'lucide-react';

export default function MiPagina() {
  return (
    <Layout>
      <Container size="xl">
        {/* Header de página */}
        <PageHeader
          title="Título de Página"
          description="Descripción breve"
          icon={Icon}
          actions={
            <Button>Acción Principal</Button>
          }
        />

        {/* Contenido principal */}
        <div className="mt-6 space-y-6">
          <Section title="Sección 1" variant="card">
            {/* Contenido */}
          </Section>

          <Section title="Sección 2" variant="card">
            {/* Contenido */}
          </Section>
        </div>
      </Container>
    </Layout>
  );
}
```

---

## Responsividad

### Breakpoints

```css
/* Mobile */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }

/* Tablet */
@media (min-width: 1024px) { /* lg */ }

/* Desktop */
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### Clases Utility Responsive

```tsx
{/* Stack en móvil, row en desktop */}
<div className="flex flex-col lg:flex-row gap-4">

{/* Ocultar en móvil */}
<div className="hidden lg:block">

{/* Mostrar solo en móvil */}
<div className="block lg:hidden">

{/* Padding responsive */}
<div className="p-4 lg:p-6 xl:p-8">

{/* Grid responsive */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

{/* Texto responsive */}
<h1 className="text-2xl lg:text-3xl">
```

### Tablas Responsivas

En móvil, convertir a cards:

```tsx
{/* Desktop: tabla */}
<div className="hidden md:block">
  <table className="w-full">
    {/* ... */}
  </table>
</div>

{/* Móvil: cards */}
<div className="md:hidden space-y-3">
  {items.map(item => (
    <div key={item.id} className="bg-white rounded-lg p-4 border">
      {/* ... */}
    </div>
  ))}
</div>
```

### Forms Responsivos

```tsx
<form className="space-y-4">
  {/* Una columna en móvil, dos en tablet+ */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Input label="Nombre" />
    <Input label="Apellido" />
  </div>

  {/* Botones stack en móvil */}
  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
    <Button variant="outline">Cancelar</Button>
    <Button>Guardar</Button>
  </div>
</form>
```

---

## Compatibilidad Cross-Browser

### Safari iOS

```css
/* Prevenir zoom en inputs */
input, select, textarea {
  font-size: 16px; /* Mínimo para evitar zoom */
}

/* Sticky position */
.sticky {
  position: -webkit-sticky;
  position: sticky;
}

/* Backdrop blur */
.backdrop-blur-ios {
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
}

/* Touch scrolling suave */
.overflow-y-auto {
  -webkit-overflow-scrolling: touch;
}
```

### Firefox

```css
/* Smooth scrolling */
@-moz-document url-prefix() {
  html {
    scroll-behavior: smooth;
  }
}
```

### Edge

- Usar prefijos cuando sea necesario
- Probar flexbox layouts
- Validar sticky headers

---

## Animaciones

### Clases de Animación

```tsx
{/* Fade in */}
<div className="animate-fade-in">

{/* Slide up */}
<div className="animate-slide-up">

{/* Scale in (modales) */}
<div className="animate-scale-in">

{/* Skeleton loading */}
<div className="skeleton h-20 w-full">
```

### Transiciones

```tsx
{/* Transición base (200ms) */}
<button className="transition-base hover:bg-primary-500">

{/* Transición suave (250ms) */}
<div className="transition-smooth hover:shadow-lg">

{/* Transición iOS (280ms) */}
<div className="transition-ios hover:scale-105">

{/* Touch feedback */}
<button className="touch-active">
```

---

## Utilidades CSS

### Scrollbar

```tsx
{/* Scrollbar delgado y estilizado */}
<div className="scrollbar-thin overflow-y-auto">

{/* Ocultar scrollbar */}
<div className="scrollbar-hide overflow-y-auto">
```

### Truncate Text

```tsx
{/* Una línea */}
<p className="truncate">

{/* Dos líneas */}
<p className="truncate-2">

{/* Tres líneas */}
<p className="truncate-3">
```

### Elevations (Sombras)

```tsx
<div className="elevation-1"> {/* Sombra sutil */}
<div className="elevation-2"> {/* Sombra media */}
<div className="elevation-3"> {/* Sombra fuerte */}
<div className="elevation-4"> {/* Sombra máxima */}
```

### Touch-friendly

```tsx
{/* Botón táctil (mínimo 44x44px) */}
<button className="btn-touch">
```

### Grid Responsive

```tsx
{/* Auto-ajuste de columnas */}
<div className="grid grid-auto-fit gap-4">
  {/* Mínimo 280px por columna */}
</div>
```

---

## Estados de Componentes

### Loading

```tsx
{loading ? (
  <div className="space-y-4">
    <div className="skeleton h-12 w-full" />
    <div className="skeleton h-32 w-full" />
  </div>
) : (
  <div>{/* Contenido */}</div>
)}
```

### Empty State

```tsx
import { EmptyState } from '@/components/ui/empty-state';

<EmptyState
  title="No hay datos"
  description="Aún no se han registrado elementos"
  icon={Inbox}
  action={
    <Button onClick={onCreate}>
      Crear Primero
    </Button>
  }
/>
```

### Error State

```tsx
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <p className="text-red-800 text-sm">
    Error al cargar los datos
  </p>
</div>
```

---

## Buttons

### Variantes

```tsx
<Button variant="default">Primario</Button>
<Button variant="outline">Secundario</Button>
<Button variant="ghost">Terciario</Button>
<Button variant="destructive">Peligro</Button>
```

### Tamaños

```tsx
<Button size="sm">Pequeño</Button>
<Button size="default">Normal</Button>
<Button size="lg">Grande</Button>
<Button size="icon">Solo icono</Button>
```

### Estados

```tsx
<Button disabled>Deshabilitado</Button>
<Button loading>Cargando...</Button>
```

---

## Forms

### Input

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="tu@email.com"
    required
  />
</div>
```

### Select

```tsx
<div className="space-y-2">
  <Label htmlFor="rol">Rol</Label>
  <Select value={rol} onValueChange={setRol}>
    <SelectTrigger>
      <SelectValue placeholder="Seleccionar rol" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="admin">Administrador</SelectItem>
      <SelectItem value="user">Usuario</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Textarea

```tsx
<div className="space-y-2">
  <Label htmlFor="description">Descripción</Label>
  <Textarea
    id="description"
    placeholder="Escribe aquí..."
    rows={4}
  />
</div>
```

---

## Modales y Dialogs

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Confirmar acción</DialogTitle>
      <DialogDescription>
        ¿Estás seguro de realizar esta acción?
      </DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
      <Button onClick={handleConfirm}>
        Confirmar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Checklist de Implementación

Al crear/actualizar una página, verificar:

### Estructura
- [ ] Usa `<Layout>` como wrapper
- [ ] Usa `<Container>` para ancho máximo
- [ ] Usa `<PageHeader>` para título de página
- [ ] Usa `<Section>` para agrupar contenido

### Responsividad
- [ ] Funciona en 320px (móvil pequeño)
- [ ] Funciona en 768px (tablet)
- [ ] Funciona en 1024px (tablet horizontal)
- [ ] Funciona en 1280px+ (desktop)
- [ ] Sin scroll horizontal en ningún breakpoint
- [ ] Tablas se convierten a cards en móvil
- [ ] Forms tienen una columna en móvil

### Estilo
- [ ] Usa clases de Tailwind (no Bootstrap)
- [ ] Colores primarios son MOVI Blue
- [ ] Espaciado consistente (4, 6, 8, 12, 16, 24px)
- [ ] Bordes con border-neutral-200
- [ ] Sombras con shadow-ios variants
- [ ] Radios con rounded-lg o rounded-md

### Accesibilidad
- [ ] Todos los inputs tienen label
- [ ] Botones tienen aria-label si solo tienen icono
- [ ] Focus visible en elementos interactivos
- [ ] Contraste suficiente (WCAG AA)

### Rendimiento
- [ ] Animaciones suaves (200-300ms)
- [ ] Imágenes optimizadas y lazy load
- [ ] Sin re-renders innecesarios

### Cross-browser
- [ ] Probado en Chrome
- [ ] Probado en Safari (macOS y iOS)
- [ ] Probado en Edge
- [ ] Sticky headers funcionan en Safari

---

## Próximos Pasos

1. Aplicar este sistema a todas las páginas existentes
2. Crear más componentes reutilizables según se necesite
3. Documentar nuevos patrones que surjan
4. Mantener consistencia en nuevas features

---

## Recursos

- Figma Design System: [Link]
- Documentación Tailwind CSS: https://tailwindcss.com
- Guía de Accesibilidad WCAG: https://www.w3.org/WAI/WCAG21/quickref/
- iOS Human Interface Guidelines: https://developer.apple.com/design/

---

**Última actualización:** Diciembre 2024
**Versión:** 1.0.0
