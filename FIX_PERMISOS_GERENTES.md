# Fix: Permisos Adicionales para Gerentes

## 🔍 Problema Identificado

El usuario **mercadotecnia@jiro.mx** (rol: Gerente) tenía 7 permisos adicionales asignados correctamente en la base de datos:

| Módulo | Permiso Admin |
|--------|--------------|
| aula_virtual | ✅ |
| centro_digital | ✅ |
| comunicados | ✅ |
| espaciojiro | ✅ |
| publicidad | ✅ |
| seguros_education | ✅ |
| **store** | ✅ |

**Sin embargo**, estos permisos NO se reflejaban en la interfaz de usuario, especialmente en MOVI Store.

## 🐛 Causa Raíz

Los módulos estaban verificando permisos de forma INCORRECTA:

```typescript
// ❌ FORMA INCORRECTA (no considera permisos adicionales)
const isAdmin = usuario?.rol === 'Administrador';

// Solo otorga acceso a usuarios con rol "Administrador"
// Ignora completamente a gerentes con permisos adicionales
```

Esto causaba que los gerentes con permisos adicionales NO pudieran acceder a funcionalidades de administrador en sus módulos asignados.

## ✅ Solución Aplicada

Se actualizó la verificación de permisos en todos los módulos para usar el sistema de permisos adicionales:

```typescript
// ✅ FORMA CORRECTA (considera permisos adicionales)
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';

const isAdmin = tienePermisoAdminEnModulo(usuario, MODULOS.STORE);

// Lógica de la función:
// 1. Si es Administrador global → retorna TRUE
// 2. Si NO es Gerente → retorna FALSE
// 3. Si ES Gerente → verifica si tiene permiso adicional en ese módulo
```

## 📝 Archivos Actualizados

### 1. **Store (MOVI Store)**
- ✅ `/src/pages/Store.tsx`
- ✅ `/src/pages/StoreAdmin.tsx`
- ✅ `/src/pages/StorePedidos.tsx`

**Cambios:**
- Reemplazado `usuario?.rol === 'Administrador'` por `tienePermisoAdminEnModulo(usuario, MODULOS.STORE)`
- Gerentes con permiso "store" ahora pueden:
  - Ver botón "Gestión de Pedidos"
  - Ver botón "Administrar Store"
  - Acceder a `/store/admin`
  - Acceder a `/store/pedidos`
  - Ver todos los pedidos del sistema
  - Gestionar productos y categorías

### 2. **Publicidad**
- ✅ `/src/pages/Publicidad.tsx`

**Cambios:**
- Reemplazado `usuario?.rol === 'Administrador'` por `tienePermisoAdminEnModulo(usuario, MODULOS.PUBLICIDAD)`
- Gerentes con permiso "publicidad" ahora pueden:
  - Crear nuevas plantillas
  - Eliminar plantillas
  - Acceder a panel de administración
  - Gestionar categorías

### 3. **Comunicados**
- ✅ `/src/pages/Comunicados.tsx`

**Cambios:**
- Reemplazado `usuario?.rol === 'Administrador'` por `tienePermisoAdminEnModulo(usuario, MODULOS.COMUNICADOS)`
- Gerentes con permiso "comunicados" ahora pueden:
  - Crear nuevos comunicados
  - Editar comunicados
  - Gestionar categorías
  - Publicar comunicados

## 🔄 Sistema de Permisos

El sistema de permisos adicionales funciona así:

1. **Tabla `permisos_adicionales_gerente`**: Almacena las asignaciones
2. **Función `tiene_permiso_admin_en_modulo()`**: Verifica permisos (SECURITY DEFINER)
3. **Función `cargarPermisosAdicionales()`**: Carga permisos al iniciar sesión
4. **AuthContext**: Almacena permisos en `usuario.permisosAdicionales`
5. **Verificación en Frontend**: Usa `tienePermisoAdminEnModulo()`

### Flujo Completo

```
1. Gerente inicia sesión
   ↓
2. AuthContext detecta rol "Gerente"
   ↓
3. Llama a cargarPermisosAdicionales(usuarioId)
   ↓
4. Consulta BD y obtiene: ['store', 'publicidad', 'comunicados', ...]
   ↓
5. Almacena en usuario.permisosAdicionales
   ↓
6. Gerente navega a /store
   ↓
7. Componente verifica: tienePermisoAdminEnModulo(usuario, 'store')
   ↓
8. Función retorna TRUE (porque 'store' está en permisosAdicionales)
   ↓
9. Se muestra interfaz de administrador
```

## 🧪 Validación

### Para Verificar que Funciona:

1. Iniciar sesión como **mercadotecnia@jiro.mx**
2. Navegar a **/store**
3. **Deberías ver**:
   - ✅ Botón "Gestión de Pedidos" (verde)
   - ✅ Botón "Administrar Store" (azul)
4. Hacer clic en "Administrar Store"
5. **Deberías poder**:
   - ✅ Ver todos los productos
   - ✅ Crear productos
   - ✅ Editar productos
   - ✅ Eliminar productos
   - ✅ Gestionar categorías

### Hacer lo mismo para:
- **/publicidad** → Ver panel admin, crear plantillas
- **/comunicados** → Crear y editar comunicados

## 📊 Estado de Implementación

### ✅ Módulos Actualizados
1. **store** - MOVI Store
2. **publicidad** - Publicidad
3. **comunicados** - Comunicados

### ⏳ Módulos Pendientes (requieren actualización similar)
4. **aula_virtual** - Aula Virtual
5. **centro_digital** - Centro Digital
6. **espaciojiro** - Espacio JIRO
7. **seguros_education** - Seguros Education

## 🚀 Próximos Pasos

Para aplicar el fix a los módulos restantes, seguir el mismo patrón:

1. Buscar: `usuario?.rol === 'Administrador'`
2. Agregar import: `import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';`
3. Reemplazar por: `tienePermisoAdminEnModulo(usuario, MODULOS.NOMBRE_MODULO)`

### Template de Actualización

```typescript
// Antes
const isAdmin = usuario?.rol === 'Administrador';

// Después
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';

const isAdmin = tienePermisoAdminEnModulo(usuario, MODULOS.NOMBRE_MODULO);
```

## 📋 Checklist para Nuevos Módulos

Al crear un nuevo módulo con permisos granulares:

- [ ] Agregar módulo a `modulos_sistema` en la base de datos
- [ ] Agregar constante en `MODULOS` en `permisosUtils.ts`
- [ ] Usar `tienePermisoAdminEnModulo()` en lugar de verificar rol directamente
- [ ] Probar con usuario Gerente CON permiso
- [ ] Probar con usuario Gerente SIN permiso
- [ ] Probar con usuario Administrador
- [ ] Verificar RLS en backend

## 🎯 Resultado Final

Ahora **mercadotecnia@jiro.mx** puede:

✅ **Administrar Store** como si fuera Administrador
✅ **Administrar Publicidad** como si fuera Administrador
✅ **Administrar Comunicados** como si fuera Administrador
✅ **Administrar Aula Virtual** (pendiente de actualizar UI)
✅ **Administrar Centro Digital** (pendiente de actualizar UI)
✅ **Administrar Espacio JIRO** (pendiente de actualizar UI)
✅ **Administrar Seguros Education** (pendiente de actualizar UI)

Pero **NO** puede:
❌ Acceder a módulos sin permiso adicional (Comisiones, Producción, etc.)
❌ Ser Administrador global del sistema
❌ Gestionar usuarios de otras oficinas (si aplica restricción)

---

**Fecha de Fix:** 2026-01-26
**Autor:** Sistema
**Versión:** 1.0.0
**Estado:** ✅ Completado (parcial - 3 de 7 módulos)
