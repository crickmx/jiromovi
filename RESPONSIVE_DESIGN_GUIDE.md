# Guía de Diseño Responsivo - Plataforma MOVI Digital

## Principios Aplicados

Esta plataforma está optimizada para dispositivos móviles, tablets y computadoras siguiendo estos principios:

### 1. **Breakpoints de Tailwind CSS**
- `sm:` → 640px (tablets pequeñas y superiores)
- `md:` → 768px (tablets y superiores)
- `lg:` → 1024px (laptops y superiores)
- `xl:` → 1280px (pantallas grandes)

### 2. **Patrones de Responsividad Implementados**

#### Encabezados de Página
```tsx
// ❌ No Responsivo
<div className="flex justify-between items-center">
  <h1 className="text-3xl font-bold">Título</h1>
  <button>Acción</button>
</div>

// ✅ Responsivo
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Título</h1>
  <button className="w-full sm:w-auto">Acción</button>
</div>
```

#### Grids
```tsx
// ❌ No Responsivo
<div className="grid grid-cols-4 gap-4">

// ✅ Responsivo
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
```

#### Tablas
```tsx
// ✅ Siempre envolver tablas con overflow-x-auto
<div className="overflow-x-auto">
  <table className="w-full min-w-[800px]">
    {/* Contenido de la tabla */}
  </table>
</div>
```

#### Padding y Espaciado
```tsx
// ❌ No Responsivo
<div className="p-8">

// ✅ Responsivo
<div className="p-4 sm:p-6 lg:p-8">
```

#### Botones con Texto
```tsx
// ✅ Ocultar texto en móvil, mostrar en desktop
<button>
  <Icon className="w-5 h-5" />
  <span className="hidden lg:inline">Texto</span>
</button>
```

### 3. **Páginas Corregidas**

#### ✅ Completamente Responsivas
1. **Dashboard** - Layout adaptable para todos los dispositivos
2. **Directorio** - Tablas con scroll horizontal, filtros apilables
3. **StorePedidos** - Cards de estadísticas en grid 2/4 columnas
4. **Layout** - Sidebar colapsable con overlay en móvil

#### ⚠️ En Proceso de Optimización
Las siguientes páginas heredan el Layout responsivo y tienen overflow-x-auto en tablas:
- CRM Contactos
- Store Admin
- Tickets
- Vacaciones
- Espacio JIRO
- Accesos Nacional
- Configuración

### 4. **Layout Principal**

El componente `<Layout>` proporciona:
- **Móvil**: Sidebar deslizante desde la izquierda, header fijo con menú hamburguesa
- **Desktop**: Sidebar toggle con botón hamburguesa, mantiene estado

### 5. **Componentes Compartidos**

Todos los modales (`BaseModal`) son responsivos:
- Ancho máximo adaptable: `max-w-xs sm:max-w-md lg:max-w-2xl`
- Padding ajustable: `p-4 sm:p-6`
- Scroll vertical automático en contenido largo

### 6. **Checklist para Nuevas Páginas**

Al crear una nueva página, asegúrate de:

- [ ] Headers con `flex-col sm:flex-row`
- [ ] Títulos con `text-xl sm:text-2xl lg:text-3xl`
- [ ] Botones con `w-full sm:w-auto` cuando sea apropiado
- [ ] Grids con breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-X`
- [ ] Tablas envueltas en `<div className="overflow-x-auto">`
- [ ] Tablas con `min-w-[800px]` o mínimo apropiado
- [ ] Padding responsive: `p-4 sm:p-6 lg:p-8`
- [ ] Gap responsive: `gap-3 sm:gap-4`
- [ ] Texto oculto/visible según tamaño: `hidden lg:inline`

### 7. **Testing**

Para verificar responsividad:

1. **Chrome DevTools** (F12)
   - Toggle device toolbar (Ctrl+Shift+M)
   - Probar: iPhone SE (375px), iPad (768px), Desktop (1920px)

2. **Verificar**
   - Scroll horizontal solo en tablas, no en página completa
   - Todos los botones accesibles sin zoom
   - Texto legible sin zoom horizontal
   - Modales no se cortan en pantallas pequeñas
   - Forms completables sin problemas

### 8. **Problemas Comunes a Evitar**

❌ **NO hacer**:
```tsx
// Anchos fijos que no se adaptan
<div className="w-[500px]">

// Grid que no cambia en móvil
<div className="grid-cols-4">

// Texto que no se reduce en móvil
<h1 className="text-4xl">

// Tablas sin scroll
<table className="w-full">
```

✅ **SÍ hacer**:
```tsx
// Anchos relativos o con max
<div className="w-full max-w-2xl">

// Grid responsivo
<div className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

// Texto escalable
<h1 className="text-2xl sm:text-3xl lg:text-4xl">

// Tablas con scroll horizontal
<div className="overflow-x-auto">
  <table className="min-w-[800px]">
```

## Estado Actual

✅ **Layout principal**: Completamente responsivo
✅ **Páginas críticas**: Dashboard, Directorio, StorePedidos optimizadas
✅ **Componentes base**: Modales, forms, cards responsivos
✅ **Tablas**: Todas con scroll horizontal donde es necesario

## Próximos Pasos

Para mantener la responsividad en desarrollo futuro:

1. Usar esta guía como referencia al crear nuevas páginas
2. Probar en móvil antes de considerar una página "completa"
3. Usar los patrones establecidos para consistencia
4. Actualizar esta guía si se descubren nuevos patrones útiles
