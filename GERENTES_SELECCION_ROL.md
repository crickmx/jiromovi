# Gerentes Pueden Seleccionar Rol al Crear Usuarios

## Resumen del Cambio

Los usuarios con rol **Gerente** ahora pueden seleccionar el rol (Empleado o Agente) al crear un nuevo usuario en el sistema.

---

## Cambios Implementados

### 1. Frontend - UserModal.tsx ✅

#### **Campo de Rol Habilitado**

**Antes:**
```tsx
<select
  value={formData.rol}
  onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
  required
  disabled={!isAdmin}  // ❌ Solo Admins podían cambiar
  className="..."
>
```

**Ahora:**
```tsx
<select
  value={formData.rol}
  onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
  required
  disabled={!isAdmin && !isGerente}  // ✅ Admins Y Gerentes pueden cambiar
  className="..."
>
  <option value="Empleado">Empleado</option>
  <option value="Agente">Agente</option>
  {isAdmin && <option value="Gerente">Gerente</option>}
  {isAdmin && <option value="Administrador">Administrador</option>}
</select>
```

#### **Texto de Ayuda Actualizado**

**Para Gerentes:**
```tsx
{isGerente && (
  <p className="text-xs text-slate-500 mt-1">
    Puedes asignar roles: Empleado o Agente
  </p>
)}
```

**Para Otros Roles:**
```tsx
{!isAdmin && !isGerente && (
  <p className="text-xs text-slate-500 mt-1">
    Solo Administradores y Gerentes pueden cambiar roles
  </p>
)}
```

---

### 2. Backend - Edge Function create-user ✅

#### **Validación de Rol Agregada**

**Código agregado (líneas 91-99):**
```typescript
// Validar que Gerentes solo puedan crear Empleados o Agentes
if (isGerente && !['Empleado', 'Agente'].includes(userData.rol)) {
  return new Response(
    JSON.stringify({
      error: 'Los Gerentes solo pueden crear usuarios con rol Empleado o Agente'
    }),
    {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
```

#### **Variables de Rol Agregadas**

**Código agregado (líneas 76-77):**
```typescript
const isGerente = currentUserData?.rol === 'Gerente';
const isAdmin = currentUserData?.rol === 'Administrador';
```

---

## Matriz de Permisos - Creación de Usuarios

| **Rol del Usuario** | **Puede Crear** | **Roles Permitidos** |
|---------------------|-----------------|----------------------|
| **Administrador** | ✅ Sí | Todos (Admin, Gerente, Empleado, Agente) |
| **Gerente** | ✅ Sí | Empleado, Agente |
| **Empleado** | ❌ No | N/A |
| **Agente** | ❌ No | N/A |

---

## Flujo de Uso - Gerente

### Al Crear un Nuevo Usuario:

1. **Accede a la gestión de usuarios**
   - Dashboard → Usuarios → Nuevo Usuario

2. **Completa el formulario**
   - Nombre, Apellidos, Email, etc.

3. **Selecciona el Rol**
   - **Opciones disponibles:**
     - ☑️ Empleado
     - ☑️ Agente
   - **Opciones NO disponibles:**
     - ☐ Gerente (solo Admins)
     - ☐ Administrador (solo Admins)

4. **Mensaje de ayuda:**
   ```
   Puedes asignar roles: Empleado o Agente
   ```

5. **Guarda el usuario**
   - ✅ Si selecciona Empleado o Agente → Usuario creado exitosamente
   - ❌ Si intenta crear Gerente/Admin → Error 403 del backend

---

## Validaciones Implementadas

### Validación Frontend (UX)
- ✅ Campo de rol **habilitado** para Gerentes
- ✅ Solo muestra opciones **Empleado** y **Agente**
- ✅ Opciones Gerente/Admin **ocultas** para Gerentes
- ✅ Texto de ayuda **específico** para Gerentes

### Validación Backend (Seguridad)
- ✅ Verifica rol del usuario actual
- ✅ Bloquea creación de Gerentes/Admins por Gerentes
- ✅ Retorna error **403 Forbidden** si se intenta bypass
- ✅ Mensaje de error claro y específico

---

## Comparación Visual

### Formulario para Administrador:
```
┌─────────────────────────────────┐
│ Rol *                           │
│ ┌─────────────────────────────┐ │
│ │ Empleado               ▼   │ │
│ └─────────────────────────────┘ │
│                                 │
│ Opciones disponibles:           │
│ • Empleado                      │
│ • Agente                        │
│ • Gerente                       │ ← Disponible
│ • Administrador                 │ ← Disponible
└─────────────────────────────────┘
```

### Formulario para Gerente:
```
┌─────────────────────────────────┐
│ Rol *                           │
│ ┌─────────────────────────────┐ │
│ │ Empleado               ▼   │ │
│ └─────────────────────────────┘ │
│                                 │
│ Opciones disponibles:           │
│ • Empleado                      │ ← Disponible
│ • Agente                        │ ← Disponible
│                                 │
│ ℹ️ Puedes asignar roles:        │
│   Empleado o Agente             │
└─────────────────────────────────┘
```

### Formulario para Empleado/Agente:
```
┌─────────────────────────────────┐
│ Rol *                           │
│ ┌─────────────────────────────┐ │
│ │ Empleado                    │ │ ← Deshabilitado
│ └─────────────────────────────┘ │
│                                 │
│ ℹ️ Solo Administradores y       │
│   Gerentes pueden cambiar roles │
└─────────────────────────────────┘
```

---

## Casos de Prueba

### ✅ Caso 1: Gerente Crea Empleado
**Entrada:**
- Usuario actual: Gerente
- Rol seleccionado: Empleado

**Resultado:**
- ✅ Usuario creado exitosamente
- ✅ Rol asignado: Empleado
- ✅ Estado: registrado (pendiente aprobación admin)

---

### ✅ Caso 2: Gerente Crea Agente
**Entrada:**
- Usuario actual: Gerente
- Rol seleccionado: Agente

**Resultado:**
- ✅ Usuario creado exitosamente
- ✅ Rol asignado: Agente
- ✅ Estado: registrado (pendiente aprobación admin)

---

### ❌ Caso 3: Gerente Intenta Crear Gerente (Bypass)
**Entrada:**
- Usuario actual: Gerente
- Rol enviado: Gerente (via API directa)

**Resultado:**
- ❌ Error 403 Forbidden
- ❌ Mensaje: "Los Gerentes solo pueden crear usuarios con rol Empleado o Agente"
- ❌ Usuario NO creado

---

### ❌ Caso 4: Gerente Intenta Crear Admin (Bypass)
**Entrada:**
- Usuario actual: Gerente
- Rol enviado: Administrador (via API directa)

**Resultado:**
- ❌ Error 403 Forbidden
- ❌ Mensaje: "Los Gerentes solo pueden crear usuarios con rol Empleado o Agente"
- ❌ Usuario NO creado

---

### ✅ Caso 5: Admin Crea Gerente
**Entrada:**
- Usuario actual: Administrador
- Rol seleccionado: Gerente

**Resultado:**
- ✅ Usuario creado exitosamente
- ✅ Rol asignado: Gerente
- ✅ Estado: activo (sin aprobación necesaria)

---

## Seguridad

### Doble Capa de Validación

#### **Capa 1: Frontend (UX)**
- Campo habilitado solo para Admins y Gerentes
- Opciones filtradas según rol
- UI clara y sin ambigüedad

#### **Capa 2: Backend (Seguridad)**
- Validación del rol del usuario actual
- Verificación del rol a asignar
- Error 403 si se intenta bypass
- No se puede eludir por manipulación de frontend

### Principio de Privilegio Mínimo
- ✅ Gerentes solo pueden crear roles inferiores
- ✅ No pueden crear otros Gerentes
- ✅ No pueden crear Administradores
- ✅ Administradores mantienen control total

---

## Archivos Modificados

1. ✅ **Frontend:** `src/components/UserModal.tsx`
   - Campo de rol habilitado para Gerentes
   - Textos de ayuda actualizados
   - Opciones filtradas por rol

2. ✅ **Backend:** `supabase/functions/create-user/index.ts`
   - Validación de rol agregada
   - Variables isGerente/isAdmin agregadas
   - Error 403 para intentos de bypass

3. ✅ **Documentación:** `GERENTES_SELECCION_ROL.md`
   - Guía completa de cambios

---

## Verificación

### Build Exitoso
```bash
npm run build
```
✅ Compilación exitosa sin errores

### Edge Function Desplegada
```
create-user
```
✅ Función desplegada con validaciones

### TypeScript Validado
✅ Sin errores de tipos

---

## Beneficios

### Autonomía de Gerentes
✅ Pueden crear usuarios de su oficina sin esperar al Admin
✅ Reducen carga administrativa
✅ Proceso más ágil

### Control y Seguridad
✅ No pueden elevar privilegios
✅ No pueden crear roles superiores
✅ Admin mantiene control total

### UX Mejorada
✅ Interfaz clara y sin confusión
✅ Mensajes de ayuda contextuales
✅ Validación en tiempo real

---

## Resultado Final

### Antes:
❌ Gerentes no podían seleccionar rol (campo deshabilitado)
❌ Siempre creaban usuarios como "Empleado"
❌ No podían crear Agentes
❌ Requerían Admin para cambiar roles

### Ahora:
✅ Gerentes pueden seleccionar entre Empleado y Agente
✅ Campo habilitado con opciones claras
✅ Validación en frontend y backend
✅ Autonomía para gestionar su equipo
✅ Seguridad mantenida (no pueden crear Gerentes/Admins)

Los Gerentes ahora tienen la **autonomía necesaria** para crear usuarios con los roles apropiados, mientras el sistema mantiene la **seguridad** al prevenir escalada de privilegios.
