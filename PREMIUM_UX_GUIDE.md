# 🎨 Guía de Componentes Premium UX

Esta guía documenta todos los componentes y mejoras de diseño premium implementados en MOVI Digital.

## 🌓 Sistema de Temas

### ThemeToggle
Selector de modo claro/oscuro/automático con diseño iOS.

```tsx
import { ThemeToggle } from '@/components/ThemeToggle';

// Ubicado en el header junto a notificaciones
<ThemeToggle />
```

**Características:**
- 3 modos: Claro, Oscuro, Automático (sistema)
- Persistencia en localStorage
- Detección automática de cambios del sistema
- Script anti-flash en index.html

---

## 🎴 Componentes Base Mejorados

### 1. Skeleton con Shimmer Effect

Loader animado con efecto shimmer profesional.

```tsx
import { Skeleton } from '@/components/ui/skeleton';

// Loading state profesional
<div className="space-y-4">
  <Skeleton className="h-12 w-3/4" />
  <Skeleton className="h-24 w-full" />
  <Skeleton className="h-8 w-1/2" />
</div>
```

**Características:**
- Animación shimmer suave (2s)
- Soporte dark mode
- Más profesional que spinners

---

### 2. EmptyState Premium

Estados vacíos con glassmorphism y gradientes sutiles.

```tsx
import { EmptyState } from '@/components/ui/empty-state';
import { FolderOpen } from 'lucide-react';

<EmptyState
  icon={FolderOpen}
  title="No hay documentos aún"
  description="Comienza subiendo tu primer documento. Es rápido y sencillo."
  action={{
    label: "Subir documento",
    onClick: () => handleUpload(),
    variant: "default"
  }}
  secondaryAction={{
    label: "Ver guía",
    onClick: () => navigate('/guia')
  }}
/>
```

**Características:**
- Icono con efecto glow y glassmorphism
- Acción principal y secundaria
- Animación fade-in
- Dark mode completo

---

### 3. StatsCard con Glass Effect

Tarjetas de estadísticas con efecto vidrio y hover premium.

```tsx
import { StatsCard } from '@/components/ui/stats-card';
import { DollarSign, TrendingUp } from 'lucide-react';

<StatsCard
  title="Comisiones del Mes"
  value="$125,430"
  description="Total acumulado"
  icon={DollarSign}
  color="success"
  trend={{
    value: 12,
    label: "vs mes anterior",
    direction: "up"
  }}
  onClick={() => navigate('/comisiones')}
/>
```

**Características:**
- Glass effect con backdrop-blur
- Hover con elevación (-translate-y)
- Gradientes en iconos
- 5 variantes de color
- Soporte dark mode

---

### 4. GlassCard

Tarjeta base con efecto vidrio esmerilado.

```tsx
import { GlassCard } from '@/components/ui/glass-card';

<GlassCard hover onClick={() => handleClick()}>
  <h3 className="text-lg font-semibold mb-2">Título</h3>
  <p className="text-sm text-neutral-600 dark:text-white/60">
    Contenido de la tarjeta con glassmorphism
  </p>
</GlassCard>
```

**Características:**
- `bg-white/70 dark:bg-white/5`
- `backdrop-blur-md`
- Prop `hover` para efecto elevación
- Bordes sutiles con transparencia

---

### 5. SavedIndicator

Feedback visual de guardado automático.

```tsx
import { SavedIndicator } from '@/components/ui/saved-indicator';

function MyForm() {
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await saveData();
    setSaved(true);
  };

  return (
    <>
      <form onSubmit={handleSave}>
        {/* form fields */}
      </form>
      <SavedIndicator
        show={saved}
        message="Cambios guardados"
        duration={2000}
      />
    </>
  );
}
```

**Características:**
- Aparece fixed bottom-right
- Auto-desaparece después de duration
- Glass effect con borde verde
- Checkmark animado

---

### 6. ContextMessage

Mensajes contextuales inteligentes tipo banner.

```tsx
import { ContextMessage } from '@/components/ui/context-message';
import { TrendingUp, Lightbulb, AlertCircle } from 'lucide-react';

// Mensaje de rendimiento
<ContextMessage
  icon={TrendingUp}
  type="success"
  message={
    <>
      <strong>¡Excelente trabajo!</strong> Este mes vas un 12% arriba del promedio.
      Sigue así y alcanzarás tu meta.
    </>
  }
/>

// Tip inteligente
<ContextMessage
  icon={Lightbulb}
  type="tip"
  message="Te sugerimos contactar a María López. Su póliza vence en 15 días."
/>

// Advertencia
<ContextMessage
  icon={AlertCircle}
  type="warning"
  message="Tienes 3 tareas pendientes por vencer hoy."
/>
```

**Tipos:**
- `info` → Azul
- `success` → Verde
- `warning` → Naranja
- `tip` → Púrpura

---

## 🎨 Componentes Mejorados

### Button con Gradientes

```tsx
import { Button } from '@/components/ui/button';

// Primary con gradiente
<Button variant="default">
  Guardar cambios
</Button>

// Destructive
<Button variant="destructive">
  Eliminar
</Button>

// Outline
<Button variant="outline">
  Cancelar
</Button>

// Secondary con hover
<Button variant="secondary">
  Ver detalles
</Button>
```

**Mejoras:**
- Gradientes sutiles en default y destructive
- Hover con elevación (-translate-y-0.5)
- Shadow que crece en hover
- Transiciones 200ms ease-ios-smooth
- Dark mode completo

---

### Card con Glass Effect

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

<Card hover>
  <CardHeader>
    <CardTitle>Panel de Control</CardTitle>
    <CardDescription>
      Vista general de tu actividad
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenido */}
  </CardContent>
</Card>
```

**Mejoras:**
- Glass effect automático
- Prop `hover` opcional
- Bordes rounded-2xl
- Dark mode en títulos y descripciones

---

## 🎯 Principios de Diseño

### 1. Glass Cards (Frosted Effect)

```css
bg-white/70 dark:bg-white/5
backdrop-blur-md
border border-neutral-200/50 dark:border-white/10
```

### 2. Hover States Inteligentes

```css
hover:shadow-ios-lg
hover:border-primary-300
hover:-translate-y-0.5
transition-all duration-250 ease-ios-smooth
```

### 3. Gradientes Funcionales

Solo en elementos importantes:
- Botones principales (CTA)
- Iconos de stats cards
- Fondos de estados empty

### 4. Animaciones Rápidas

- **150-250ms** → Interacciones (hover, click)
- **2s** → Shimmer effect
- **cubic-bezier(0.32, 0.72, 0, 1)** → iOS easing

### 5. Dark Mode Consistente

Todos los componentes soportan:
- `dark:bg-*` → Fondos oscuros
- `dark:text-white/*` → Textos adaptados
- `dark:border-white/*` → Bordes translúcidos

---

## 📊 Ejemplo Completo: Dashboard Premium

```tsx
import { StatsCard } from '@/components/ui/stats-card';
import { ContextMessage } from '@/components/ui/context-message';
import { GlassCard } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { TrendingUp, Users, DollarSign, Lightbulb } from 'lucide-react';

export function DashboardPremium() {
  return (
    <div className="space-y-6">
      {/* Mensaje contextual inteligente */}
      <ContextMessage
        icon={TrendingUp}
        type="success"
        message={
          <>
            <strong>¡Gran mes!</strong> Superaste tu meta en un 15%.
            Sigue así para el bono trimestral.
          </>
        }
      />

      {/* Stats con glass effect */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Comisiones"
          value="$45,230"
          icon={DollarSign}
          color="success"
          trend={{ value: 12, label: "vs mes anterior", direction: "up" }}
          onClick={() => navigate('/comisiones')}
        />

        <StatsCard
          title="Clientes Activos"
          value="127"
          icon={Users}
          color="primary"
          description="8 nuevos esta semana"
        />

        <StatsCard
          title="Pólizas Próximas"
          value="12"
          icon={TrendingUp}
          color="warning"
          description="Vencen en 30 días"
        />
      </div>

      {/* Glass card con contenido */}
      <GlassCard hover>
        <h3 className="text-lg font-semibold mb-4">Actividad Reciente</h3>
        {/* Lista de actividades */}
      </GlassCard>

      {/* Empty state si no hay datos */}
      {!hasData && (
        <EmptyState
          icon={Lightbulb}
          title="Comienza tu día"
          description="No tienes tareas pendientes. Revisa tus clientes próximos a renovar."
          action={{
            label: "Ver renovaciones",
            onClick: () => navigate('/renovaciones')
          }}
        />
      )}
    </div>
  );
}
```

---

## 🎨 Paleta de Colores Dark Mode

### Fondos
```css
/* Light */
bg-white
bg-neutral-50

/* Dark */
dark:bg-slate-900  /* Sidebar, cards */
dark:bg-slate-950  /* Background principal */
dark:bg-white/5    /* Glass cards */
```

### Textos
```css
/* Light */
text-neutral-900   /* Títulos */
text-neutral-600   /* Subtítulos */
text-neutral-500   /* Descripción */

/* Dark */
dark:text-white           /* Títulos */
dark:text-white/80        /* Subtítulos */
dark:text-white/60        /* Descripción */
```

### Bordes
```css
border-neutral-200      /* Light */
dark:border-white/10    /* Dark translúcido */
```

---

## 🚀 Checklist de Implementación

Al usar estos componentes, asegúrate de:

- [ ] Usar `Skeleton` en lugar de spinners genéricos
- [ ] `EmptyState` con mensajes humanos y CTAs claros
- [ ] `GlassCard` o `StatsCard` para tarjetas importantes
- [ ] `ContextMessage` para insights inteligentes
- [ ] `SavedIndicator` en formularios con auto-guardado
- [ ] Prop `hover` en cards clickeables
- [ ] Dark mode testado en todos los componentes
- [ ] Transiciones suaves (200-250ms)
- [ ] No usar gradientes decorativos, solo funcionales

---

## 📈 Impacto en UX

Con estos componentes, MOVI Digital tiene:

✅ **Velocidad percibida** → Skeletons animados
✅ **Sensación premium** → Glass effect + gradientes
✅ **Feedback inmediato** → SavedIndicator
✅ **App inteligente** → ContextMessages
✅ **Diseño moderno** → iOS-style con dark mode
✅ **Microinteracciones** → Hover states suaves

---

**Última actualización:** 2026-01-13
