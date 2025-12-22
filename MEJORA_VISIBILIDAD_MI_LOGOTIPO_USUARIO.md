# Mejora de Visibilidad: Mi Logotipo en Modal y Página de Usuario

## Problema Identificado

El usuario reportó: **"sigo sin ver 'mi logotipo' al querer crear o editar usuario desde usuarios"**

Análisis del problema:
1. **Al crear usuario nuevo (Modal):** La sección existía pero estaba oculta al final del formulario
2. **Al editar usuario (Directorio → Ver/Editar):** La sección NO existía en absoluto en la página de perfil completa
3. Solo había funcionalidad de logo en el modal, pero cuando se hace clic en "Ver / Editar" desde el Directorio, se abre una página completa diferente (PerfilUsuario.tsx) que no tenía el editor de logo

**Root Cause:**
- Había **dos interfaces diferentes** para editar usuarios:
  - `UserModal.tsx` - Modal usado desde algunos lugares (tenía el editor)
  - `PerfilUsuario.tsx` - Página completa usada desde Directorio (NO tenía el editor)
- La página de Directorio usa `PerfilUsuario.tsx`, no `UserModal.tsx`
- Por eso el usuario no veía "Mi Logotipo" al dar clic en editar desde usuarios

## Solución Implementada

### Enfoque Dual: Arreglar Ambas Interfaces

#### Solución 1: UserModal.tsx (Reorganización)

**Antes:**
```
1. Información de Acceso
2. Información Personal
3. Información de Contacto
4. Campos de Pago
5. Mi Logotipo (último, difícil de ver)
6. Gestión de Vacaciones
```

**Ahora:**
```
1. Información de Acceso
2. Información Personal
3. Información de Contacto
4. 📸 Mi Logotipo Personal (más visible)
5. Campos de Pago
6. Gestión de Vacaciones
```

#### Solución 2: PerfilUsuario.tsx (Agregar Funcionalidad)

**Antes:**
- NO existía la sección "Mi Logotipo" en absoluto
- Usuarios no podían subir logo desde la página de edición principal

**Ahora:**
- Agregada sección completa "📸 Mi Logotipo Personal"
- Ubicada en pestaña "Información General"
- Después de "Campos Personalizados"
- Con separador visual y descripción clara
- Funcionalidad completa de subir/cambiar/eliminar logo

### 2. Mejoras Visuales

#### A) Título Destacado con Icono
```tsx
<h3 className="text-base font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
  <span className="text-blue-600">📸</span>
  Mi Logotipo Personal
</h3>
```

#### B) Banner Informativo (Al Editar)
Cuando se está **editando un usuario existente**, aparece:
- Banner azul destacado
- Explicación clara del propósito del logotipo
- Información sobre la jerarquía de logos

```tsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
  <p className="text-sm text-blue-800 mb-2">
    <strong>Importante:</strong> Tu logotipo personal aparecerá en tus PDFs
    de comisiones y materiales oficiales.
  </p>
  <p className="text-xs text-blue-700">
    Si no subes un logo personal, se usará el logo de tu oficina o el logo
    JIRO por defecto.
  </p>
</div>
```

#### C) Mensaje Informativo (Al Crear)
Cuando se está **creando un usuario nuevo**, aparece:
- Banner gris informativo
- Icono de información
- Explicación del proceso en dos pasos

```tsx
<div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
  <div className="flex items-start gap-3">
    <div className="flex-shrink-0 mt-0.5">
      <svg className="w-5 h-5 text-gray-400">...</svg>
    </div>
    <div>
      <p className="text-sm text-gray-700 font-medium mb-1">
        Subir Logotipo Personal
      </p>
      <p className="text-xs text-gray-600">
        Primero crea el usuario. Luego podrás editarlo para subir su logotipo
        personal. El logotipo se usará en PDFs de comisiones y materiales oficiales.
      </p>
    </div>
  </div>
</div>
```

### 3. Comportamiento

#### Crear Nuevo Usuario
1. Se muestra la sección "Mi Logotipo Personal" con icono 📸
2. Aparece mensaje informativo explicando que el logo se sube después
3. El usuario entiende el proceso: Crear → Editar → Subir Logo

#### Editar Usuario Existente
1. Se muestra la sección "Mi Logotipo Personal" con icono 📸
2. Aparece banner azul con información importante
3. Se muestra el componente `MiLogotipoEditor` completo:
   - Vista previa del logo actual
   - Botón "Subir logotipo" o "Cambiar logotipo"
   - Botón "Eliminar" (si tiene logo)
   - Indicaciones de formatos y tamaño

### 4. Jerarquía de Logos

El sistema mantiene la siguiente jerarquía automática:

1. **Mi Logotipo** → Logo personal del usuario (`mi_logotipo_url`)
2. **Logo de Oficina** → Logo de la oficina a la que pertenece
3. **Logo JIRO** → Logo por defecto del sistema

Esta jerarquía se aplica automáticamente en:
- PDFs de comisiones (Comprobante y Orden de Pago)
- Materiales de marketing
- Cualquier documento personalizado

## Ubicación en la Interfaz

### Método 1: Crear Nuevo Usuario (Modal)

**Ruta:** https://app.movi.digital/directorio

**Acciones:**
1. Click en botón "Nuevo Usuario"
2. Se abre modal de creación
3. Ver sección "📸 Mi Logotipo Personal" con mensaje informativo
4. El mensaje explica que se debe crear el usuario primero y luego editar para subir el logo

### Método 2: Editar Usuario Existente (Página Completa)

**Ruta:** https://app.movi.digital/directorio → Click en "Ver / Editar" en cualquier usuario

**Acciones:**
1. Click en botón "Ver / Editar" de cualquier usuario
2. Se abre página completa de perfil de usuario
3. Ir a pestaña "Información General" (activa por defecto)
4. Hacer scroll hacia abajo después de "Campos Personalizados"
5. Ver sección "📸 Mi Logotipo Personal" con:
   - Título destacado con icono
   - Descripción del propósito
   - Componente completo de carga de logo
   - Vista previa del logo actual
   - Botones para subir/cambiar/eliminar

## Flujo de Trabajo Recomendado

### Para Administradores - Crear y Configurar Usuario Nuevo

**Opción A: Usando Modal (Directorio)**
1. Ir a Directorio y click en "Nuevo Usuario"
2. Llenar todos los datos del usuario
3. Guardar usuario
4. Click en "Ver / Editar" del usuario recién creado
5. Ir a pestaña "Información General"
6. Scroll a "Mi Logotipo Personal"
7. Subir logotipo personal

**Opción B: Editar Usuario Existente**
1. Ir a Directorio
2. Click en "Ver / Editar" del usuario
3. Ir a pestaña "Información General"
4. Scroll a "Mi Logotipo Personal"
5. Subir/cambiar/eliminar logotipo

### Para Usuarios (Editar su propio perfil)
1. Ir a su perfil personal desde el menú
2. Buscar pestaña "Información General"
3. Scroll a "Mi Logotipo Personal"
4. Subir su logo usando el botón "Subir logotipo"
5. Ver vista previa inmediata
6. El logo se aplicará a todos sus documentos

**Nota:** Los usuarios también pueden tener acceso a su perfil desde diferentes rutas según los permisos configurados.

## Integración con PDFs

Los cambios en este modal se integran perfectamente con la corrección de distorsión de logos en PDFs:

### Comprobante de Comisiones
- Logo sin distorsión: ✅
- Máximo: 40mm x 20mm
- Mantiene proporción original

### Orden de Pago
- Logo sin distorsión: ✅
- Máximo: 35mm x 18mm
- Mantiene proporción original

## Testing Recomendado

### Test 1: Crear Usuario Sin Logo (Modal)
1. Ir a Directorio → Click "Nuevo Usuario"
2. Verificar que se muestre sección "📸 Mi Logotipo Personal"
3. Verificar mensaje informativo gris
4. Guardar usuario
5. Verificar que se pueda editar después

### Test 2: Editar Usuario en Página Completa
1. Ir a Directorio → Click "Ver / Editar" en cualquier usuario
2. Verificar que se abra página completa (no modal)
3. Verificar pestaña "Información General" activa por defecto
4. Scroll hacia abajo después de campos personalizados
5. Verificar sección "📸 Mi Logotipo Personal" visible

### Test 3: Subir Logo en Página de Perfil
1. Abrir usuario en página completa (Ver / Editar)
2. Ir a "Información General"
3. Verificar que aparezca la sección "Mi Logotipo Personal"
4. Verificar descripción: "Tu logotipo personal aparecerá..."
5. Subir un logo (PNG/JPG)
6. Verificar vista previa inmediata
7. Click "Guardar Cambios" en la parte superior
8. Verificar mensaje de éxito

### Test 4: Cambiar Logo Existente
1. Editar usuario que ya tiene logo (Ver / Editar)
2. Ir a "Información General" → "Mi Logotipo Personal"
3. Verificar que se muestre el logo actual
4. Usar botón "Cambiar logotipo"
5. Subir nuevo logo
6. Verificar que se actualice la vista previa
7. Guardar cambios

### Test 5: Eliminar Logo
1. Editar usuario con logo (Ver / Editar)
2. Ir a "Mi Logotipo Personal"
3. Usar botón "Eliminar"
4. Confirmar eliminación
5. Verificar que desaparezca el logo personal
6. El sistema debe usar logo de oficina o JIRO
7. Guardar cambios

### Test 6: Visibilidad en Ambas Interfaces
**Modal (Crear):**
- Sección visible con mensaje informativo
- No oculta al final del formulario
- Icono 📸 fácil de identificar

**Página Completa (Editar):**
- Sección en pestaña "Información General"
- Después de "Campos Personalizados"
- Separador visual claro (border-top)
- Título destacado con descripción
- Editor completo funcional

### Test 7: Integración con PDFs
1. Usuario con logo personal
2. Generar PDF de comisiones
3. Verificar que aparezca su logo (no distorsionado)
4. Usuario sin logo personal
5. Verificar que use logo de oficina o JIRO

## Archivos Modificados

1. **src/components/UserModal.tsx**
   - Reorganización de secciones
   - Banner informativo azul (editar)
   - Mensaje informativo gris (crear)
   - Título con icono 📸

2. **src/pages/PerfilUsuario.tsx**
   - Agregado import de `MiLogotipoEditor`
   - Nueva sección "Mi Logotipo Personal" en pestaña "Información General"
   - Ubicada después de "Campos Personalizados"
   - Con separador visual (border-top) y descripción clara

## Estado del Build

✅ **Compilación exitosa**
- Build completado sin errores
- Todos los componentes integrados correctamente
- Listo para despliegue

## Notas Importantes

1. **No se puede subir logo al crear:** Esto es por diseño, necesitamos el ID del usuario primero
2. **Siempre visible:** La sección siempre aparece, con mensaje apropiado según el contexto
3. **Educativo:** Los mensajes educan al usuario sobre el proceso correcto
4. **Sin fricción:** Proceso claro y simple para subir/cambiar logos
