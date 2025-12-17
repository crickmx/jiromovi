# Guía de Migración de Páginas al Sistema de Diseño Unificado

## Introducción

Esta guía proporciona ejemplos prácticos de cómo migrar páginas existentes al nuevo sistema de diseño unificado de MOVI Digital.

---

## Patrón General de Migración

### ❌ Antes (Inconsistente)

```tsx
export default function MiPagina() {
  return (
    <Layout>
      <div className="container py-4">
        <h1 className="text-3xl font-bold mb-2">Mi Página</h1>
        <p className="text-gray-600 mb-4">Descripción de la página</p>

        <div className="bg-white p-4 rounded shadow">
          {/* Contenido */}
        </div>
      </div>
    </Layout>
  );
}
```

### ✅ Después (Sistema Unificado)

```tsx
import { Layout } from '@/components/Layout';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { IconName } from 'lucide-react';

export default function MiPagina() {
  return (
    <Layout>
      <Container size="xl">
        <PageHeader
          title="Mi Página"
          description="Descripción de la página"
          icon={IconName}
          actions={
            <Button>Nueva Acción</Button>
          }
        />

        <div className="mt-6 space-y-6">
          <Section title="Sección Principal" variant="card">
            {/* Contenido */}
          </Section>
        </div>
      </Container>
    </Layout>
  );
}
```

---

## Ejemplo 1: Dashboard con Estadísticas

### ❌ Antes

```tsx
export default function Dashboard() {
  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Usuarios</p>
                <p className="text-3xl font-bold">1,234</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          {/* Más cards... */}
        </div>
      </div>
    </Layout>
  );
}
```

### ✅ Después

```tsx
import { Layout } from '@/components/Layout';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/ui/page-header';
import { StatsCard } from '@/components/ui/stats-card';
import { LayoutDashboard, Users, Building2, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  return (
    <Layout>
      <Container size="xl">
        <PageHeader
          title="Dashboard"
          description="Resumen general de la plataforma"
          icon={LayoutDashboard}
        />

        {/* Grid de estadísticas responsive */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
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

          <StatsCard
            title="Oficinas"
            value="42"
            description="En todo el país"
            icon={Building2}
            color="success"
          />

          <StatsCard
            title="Producción"
            value="$2.5M"
            description="Este mes"
            icon={TrendingUp}
            color="primary"
          />
        </div>
      </Container>
    </Layout>
  );
}
```

---

## Ejemplo 2: Lista de Elementos con Tabla

### ❌ Antes

```tsx
export default function Usuarios() {
  return (
    <Layout>
      <div className="p-4">
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded">
            Nuevo Usuario
          </button>
        </div>

        <table className="w-full bg-white rounded shadow">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td>{u.email}</td>
                <td>{u.rol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
```

### ✅ Después

```tsx
import { Layout } from '@/components/Layout';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Users, Plus } from 'lucide-react';

export default function Usuarios() {
  return (
    <Layout>
      <Container size="xl">
        <PageHeader
          title="Gestión de Usuarios"
          description="Administra los usuarios de la plataforma"
          icon={Users}
          actions={
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Usuario
            </Button>
          }
        />

        <div className="mt-6">
          <Section variant="card">
            {/* Desktop: Tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">
                      Rol
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {usuarios.map(u => (
                    <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-neutral-900">{u.nombre}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{u.email}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{u.rol}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Móvil: Cards */}
            <div className="md:hidden space-y-3">
              {usuarios.map(u => (
                <div
                  key={u.id}
                  className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
                >
                  <div className="font-semibold text-neutral-900 mb-1">{u.nombre}</div>
                  <div className="text-sm text-neutral-600 mb-1">{u.email}</div>
                  <div className="text-xs text-neutral-500">{u.rol}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </Container>
    </Layout>
  );
}
```

---

## Ejemplo 3: Formulario de Creación/Edición

### ❌ Antes

```tsx
export default function CrearUsuario() {
  return (
    <Layout>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Nuevo Usuario</h1>

        <div className="bg-white p-6 rounded shadow">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label>Nombre</label>
              <input type="text" className="w-full border rounded px-3 py-2" />
            </div>

            <div className="mb-4">
              <label>Email</label>
              <input type="email" className="w-full border rounded px-3 py-2" />
            </div>

            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
              Guardar
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
```

### ✅ Después

```tsx
import { Layout } from '@/components/Layout';
import { Container } from '@/components/ui/container';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus } from 'lucide-react';

export default function CrearUsuario() {
  return (
    <Layout>
      <Container size="md">
        <PageHeader
          title="Nuevo Usuario"
          description="Registra un nuevo usuario en la plataforma"
          icon={UserPlus}
        />

        <div className="mt-6">
          <Section variant="card">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Grid responsive: 1 columna en móvil, 2 en tablet+ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    type="text"
                    placeholder="Nombre completo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

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

              {/* Botones: stack vertical en móvil, horizontal en tablet+ */}
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-4 border-t border-neutral-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/usuarios')}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Guardando...' : 'Crear Usuario'}
                </Button>
              </div>
            </form>
          </Section>
        </div>
      </Container>
    </Layout>
  );
}
```

---

## Ejemplo 4: Modal/Dialog

### ❌ Antes

```tsx
{showModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-lg p-6 max-w-md w-full">
      <h2 className="text-xl font-bold mb-4">Confirmar Acción</h2>
      <p className="mb-6">¿Estás seguro de realizar esta acción?</p>

      <div className="flex gap-2">
        <button onClick={() => setShowModal(false)} className="bg-gray-200 px-4 py-2 rounded">
          Cancelar
        </button>
        <button onClick={handleConfirm} className="bg-blue-600 text-white px-4 py-2 rounded">
          Confirmar
        </button>
      </div>
    </div>
  </div>
)}
```

### ✅ Después

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

<Dialog open={showModal} onOpenChange={setShowModal}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Confirmar Acción</DialogTitle>
      <DialogDescription>
        ¿Estás seguro de realizar esta acción? Esta operación no se puede deshacer.
      </DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button variant="outline" onClick={() => setShowModal(false)}>
        Cancelar
      </Button>
      <Button onClick={handleConfirm} disabled={loading}>
        {loading ? 'Procesando...' : 'Confirmar'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Ejemplo 5: Estados Vacíos (Empty States)

### ❌ Antes

```tsx
{usuarios.length === 0 && (
  <div className="text-center py-12">
    <p className="text-gray-600">No hay usuarios registrados</p>
    <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">
      Crear Primer Usuario
    </button>
  </div>
)}
```

### ✅ Después

```tsx
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

{usuarios.length === 0 && (
  <EmptyState
    title="No hay usuarios registrados"
    description="Comienza creando tu primer usuario en el sistema"
    icon={Users}
    action={
      <Button onClick={() => setModalOpen(true)}>
        Crear Primer Usuario
      </Button>
    }
  />
)}
```

---

## Ejemplo 6: Estados de Carga (Loading)

### ❌ Antes

```tsx
{loading && (
  <div className="flex justify-center py-12">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
)}
```

### ✅ Después

```tsx
{loading ? (
  <div className="space-y-4">
    {/* Skeleton loaders */}
    <div className="skeleton h-20 w-full" />
    <div className="skeleton h-32 w-full" />
    <div className="skeleton h-32 w-full" />
  </div>
) : (
  <div>{/* Contenido real */}</div>
)}
```

---

## Checklist de Migración por Página

Al migrar una página, verificar:

### Estructura
- [ ] Importa y usa `<Layout>`
- [ ] Usa `<Container size="xl">` (o el tamaño apropiado)
- [ ] Usa `<PageHeader>` con título, descripción e icono
- [ ] Agrupa contenido con `<Section variant="card">`
- [ ] Elimina cualquier referencia a Bootstrap

### Componentes
- [ ] Botones usan `<Button>` con variantes apropiadas
- [ ] Inputs usan `<Input>` con `<Label>`
- [ ] Selects usan `<Select>` y componentes relacionados
- [ ] Modales usan `<Dialog>` y componentes relacionados
- [ ] Tarjetas de estadísticas usan `<StatsCard>`

### Responsividad
- [ ] Grid responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- [ ] Tablas tienen versión móvil (cards)
- [ ] Formularios tienen 1 columna en móvil
- [ ] Botones se apilan verticalmente en móvil
- [ ] Padding responsive: `p-4 md:p-6 lg:p-8`
- [ ] Sin scroll horizontal en ningún breakpoint

### Estilos
- [ ] Colores primarios: `primary-*` (no `blue-*`)
- [ ] Colores neutros: `neutral-*` (no `gray-*`)
- [ ] Espaciado consistente: múltiplos de 4 (4, 8, 12, 16, 24)
- [ ] Bordes: `border-neutral-200`
- [ ] Sombras: `shadow-ios` o `shadow-ios-md`
- [ ] Radios: `rounded-lg` o `rounded-md`

### Estados
- [ ] Loading usa skeleton loaders
- [ ] Empty usa `<EmptyState>`
- [ ] Errores tienen estilos consistentes
- [ ] Validaciones son claras

### Accesibilidad
- [ ] Todos los inputs tienen `<Label>` asociado
- [ ] Botones de solo icono tienen `aria-label`
- [ ] Focus es visible
- [ ] Contraste cumple WCAG AA

---

## Orden Recomendado de Migración

1. **Dashboard** - Página principal, alto impacto
2. **Mi CRM** - Alta frecuencia de uso
3. **Comunicados** - Visible para todos
4. **Comisiones** - Crítico para negocio
5. **Producción** - Dashboards importantes
6. Resto de módulos según prioridad

---

## Recursos de Ayuda

### Documentación
- `SISTEMA_DISENO_UNIFICADO.md` - Guía completa
- `tailwind.config.js` - Tokens configurados
- `src/index.css` - Utilidades CSS

### Componentes Existentes
- `src/components/ui/` - Todos los componentes base
- `src/components/Layout.tsx` - Layout principal

### Herramientas
- **Tailwind CSS IntelliSense** - VS Code extension
- **Chrome DevTools** - Responsive testing
- **Safari iOS Simulator** - Testing real

---

## Preguntas Frecuentes

### ¿Puedo seguir usando algunos estilos inline?
Solo para casos muy específicos. Prefiere siempre clases de Tailwind.

### ¿Qué hacer con componentes Bootstrap existentes?
Reemplazarlos con los nuevos componentes base o componentes de shadcn/ui.

### ¿Cómo manejo breakpoints custom?
Usa los breakpoints definidos en tailwind.config.js. Si necesitas uno nuevo, agrégalo ahí primero.

### ¿Puedo crear nuevos componentes base?
Sí, siguiendo el mismo patrón de los existentes y documentándolos.

### ¿Cómo pruebo responsividad?
- Chrome DevTools (Device Mode)
- Navegador en ventana pequeña (320px)
- Safari iOS en dispositivo real o simulador
- Tablet física si es posible

---

**Última actualización:** Diciembre 2024
**Versión:** 1.0.0
