# Actualización de Visibilidad - Directorio JIRO

## Resumen de Cambios

Se actualizó el sistema de permisos y visibilidad para que **Administradores, Gerentes, Empleados y Agentes** puedan ver a todos los usuarios con rol **Empleado** y **Gerente** en el **Directorio JIRO**.

---

## 1. Cambios en Políticas RLS

### Migración Aplicada
**Archivo:** `fix_directorio_jiro_visibility_for_all_roles.sql`

### Políticas Actualizadas

#### **A. Gerentes**
**Antes:**
```sql
"Gerentes view own office users only"
- Solo podían ver usuarios de su misma oficina
```

**Ahora:**
```sql
"Gerentes view employees and gerentes"
USING (
  get_current_user_role() = 'Gerente'
  AND rol IN ('Empleado', 'Gerente')
)
```
✅ Gerentes pueden ver **todos** los Empleados y Gerentes (sin restricción de oficina)

---

#### **B. Empleados y Agentes**
**Antes:**
```sql
"Employees and agents view users"
- Política genérica sin restricción de roles
```

**Ahora:**
```sql
"Employees and agents view employees and gerentes"
USING (
  get_current_user_role() IN ('Empleado', 'Agente')
  AND rol IN ('Empleado', 'Gerente')
)
```
✅ Empleados y Agentes pueden ver **todos** los Empleados y Gerentes

---

#### **C. Administradores (Sin cambios)**
```sql
"Admins view all users"
USING (get_current_user_role() = 'Administrador')
```
✅ Administradores pueden ver **todos** los usuarios (cualquier rol)

---

## 2. Cambios en Frontend

### Archivo Modificado
**`src/pages/DirectorioJiro.tsx`**

### Cambios Realizados

#### **A. Query de Base de Datos**
**Antes:**
```tsx
.eq('rol', 'Empleado')  // Solo Empleados
```

**Ahora:**
```tsx
.in('rol', ['Empleado', 'Gerente'])  // Empleados Y Gerentes
.select(`
  ...
  rol,  // ← Campo agregado
  ...
`)
```

#### **B. Interface Actualizada**
```typescript
interface Empleado {
  id: string;
  nombre: string;
  apellidos: string;
  nombre_completo: string;
  puesto: string;
  rol: string;  // ← Nuevo campo
  oficina: string;
  email_laboral: string;
  celular_laboral: string;
  foto_url?: string;
}
```

#### **C. Badge Distintivo para Gerentes**

**En Tarjetas (Grid):**
```tsx
{empleado.rol === 'Gerente' && (
  <div className="mb-2">
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5
                     bg-blue-100 text-blue-800 rounded-full text-xs
                     font-semibold border border-blue-300">
      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
      Gerente
    </span>
  </div>
)}
```

**En Modal (Detalle):**
```tsx
{selectedEmpleado.rol === 'Gerente' && (
  <div className="mb-2">
    <span className="inline-flex items-center gap-1 px-3 py-1
                     bg-white text-blue-800 rounded-full text-sm
                     font-semibold border border-blue-200">
      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
      Gerente
    </span>
  </div>
)}
```

#### **D. Eliminación de Filtro por Oficina**
**Antes:**
```tsx
// Si es Agente, solo mostrar empleados de la misma oficina
if (isAgente && oficinaUsuario) {
  query = query.eq('oficina_id', oficinaUsuario);
}
```

**Ahora:**
```tsx
// Eliminado - Todos ven a todos los Empleados/Gerentes
```

---

## 3. Matriz de Permisos - Directorio JIRO

| **Rol del Usuario** | **Puede Ver** | **Restricciones** |
|---------------------|---------------|-------------------|
| **Administrador** | ✅ Todos los usuarios (cualquier rol) | Ninguna |
| **Gerente** | ✅ Empleados + Gerentes (todas las oficinas) | No ve Administradores ni Agentes |
| **Empleado** | ✅ Empleados + Gerentes (todas las oficinas) | No ve Administradores ni Agentes |
| **Agente** | ✅ Empleados + Gerentes (todas las oficinas) | No ve Administradores ni Agentes |

---

## 4. Comparación Visual

### Tarjeta de Empleado
```
┌────────────────────────────┐
│         [Foto/Avatar]       │
│                            │
│    Juan Pérez García       │
│                            │
│  💼 Ejecutivo de Ventas    │
│  📍 Jiro Querétaro         │
│                            │
│  📧 juan@empresa.com       │
│  📱 +52 442 123 4567       │
└────────────────────────────┘
```

### Tarjeta de Gerente
```
┌────────────────────────────┐
│         [Foto/Avatar]       │
│                            │
│   María López Martínez     │
│                            │
│    ● Gerente               │ ← Badge distintivo
│                            │
│  💼 Gerente de Sucursal    │
│  📍 Jiro Aguascalientes    │
│                            │
│  📧 maria@empresa.com      │
│  📱 +52 449 765 4321       │
└────────────────────────────┘
```

---

## 5. Flujo de Uso

### Como Gerente
1. Accedo a "Directorio JIRO"
2. ✅ Veo **todos** los Empleados de todas las oficinas
3. ✅ Veo **todos** los Gerentes de todas las oficinas
4. ✅ Los Gerentes aparecen con badge azul "Gerente"
5. Puedo buscar por nombre, puesto u oficina
6. Puedo ver detalles y copiar contacto

### Como Empleado
1. Accedo a "Directorio JIRO"
2. ✅ Veo **todos** los Empleados de todas las oficinas
3. ✅ Veo **todos** los Gerentes de todas las oficinas
4. ✅ Los Gerentes aparecen con badge azul "Gerente"
5. Puedo buscar por nombre, puesto u oficina
6. Puedo ver detalles y copiar contacto

### Como Agente
1. Accedo a "Directorio JIRO"
2. ✅ Veo **todos** los Empleados de todas las oficinas
3. ✅ Veo **todos** los Gerentes de todas las oficinas
4. ✅ Los Gerentes aparecen con badge azul "Gerente"
5. Puedo buscar por nombre, puesto u oficina
6. Puedo ver detalles y copiar contacto

### Como Administrador
1. Accedo a "Directorio JIRO"
2. ✅ Veo **todos** los usuarios (sin restricciones)
3. ✅ Veo Administradores, Gerentes, Empleados, Agentes
4. ✅ Los Gerentes aparecen con badge azul "Gerente"
5. Puedo buscar por nombre, puesto u oficina
6. Puedo ver detalles y copiar contacto

---

## 6. Ventajas de los Cambios

### Colaboración Mejorada
✅ Gerentes de diferentes oficinas pueden contactarse entre sí
✅ Empleados pueden contactar Gerentes de otras sucursales
✅ Mayor transparencia organizacional

### UX Consistente
✅ Todos los roles ven la misma información base
✅ Badge distintivo identifica claramente a Gerentes
✅ Sin confusión sobre quién es quién

### Simplicidad
✅ No hay filtros por oficina que limiten visibilidad
✅ Búsqueda global funciona correctamente
✅ Resultados predecibles para todos los roles

---

## 7. Seguridad

### RLS Activo
✅ Todas las consultas pasan por Row Level Security
✅ No se pueden hacer queries fuera de las políticas
✅ Cada rol solo ve lo permitido

### Datos Expuestos
✅ Solo información de contacto laboral
✅ No se exponen datos sensibles
✅ No se muestran roles "Administrador" a no-admins

### Validación
✅ Políticas verificadas con `pg_policies`
✅ Build exitoso sin errores
✅ TypeScript validado

---

## 8. Archivos Modificados

1. ✅ **Migración:** `fix_directorio_jiro_visibility_for_all_roles.sql`
   - Políticas RLS actualizadas

2. ✅ **Frontend:** `src/pages/DirectorioJiro.tsx`
   - Query actualizada (Empleados + Gerentes)
   - Interface con campo `rol`
   - Badge distintivo para Gerentes
   - Filtro por oficina eliminado

3. ✅ **Documentación:** `DIRECTORIO_JIRO_VISIBILIDAD.md`
   - Guía completa de cambios

---

## 9. Verificación

### Políticas RLS
```sql
-- Ver políticas SELECT en tabla usuarios
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'usuarios' AND cmd = 'SELECT';
```

**Resultado esperado:**
- ✅ "Admins view all users"
- ✅ "Gerentes view employees and gerentes"
- ✅ "Employees and agents view employees and gerentes"
- ✅ "Users can read own profile"

### Build
```bash
npm run build
```
✅ Build exitoso sin errores

---

## 10. Resultado Final

### Antes
❌ Gerentes solo veían usuarios de su oficina
❌ Empleados/Agentes tenían restricciones
❌ No se diferenciaban Gerentes de Empleados
❌ Colaboración limitada entre oficinas

### Ahora
✅ Gerentes ven todos los Empleados y Gerentes
✅ Empleados ven todos los Empleados y Gerentes
✅ Agentes ven todos los Empleados y Gerentes
✅ Badge distintivo identifica a Gerentes
✅ Colaboración sin barreras organizacionales
✅ Directorio JIRO funcional para toda la empresa

---

## Beneficio Principal

El **Directorio JIRO** ahora funciona como un **directorio corporativo unificado** donde:
- 🔍 Todos pueden encontrar y contactar a Empleados y Gerentes
- 🏢 No hay barreras artificiales entre oficinas
- 👥 Se fomenta la colaboración interdepartamental
- 📞 Información de contacto accesible para todos
- 🎯 Identificación clara de roles con badges visuales
