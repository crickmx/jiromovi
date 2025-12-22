# Mejora de Visibilidad: Mi Logotipo en Modal de Usuario

## Problema Identificado

La sección "Mi Logotipo" en el modal de creación/edición de usuarios no era visible porque:
1. Estaba ubicada al final del formulario (después de todos los campos)
2. Se perdía con el scroll del modal
3. Solo aparecía al editar usuarios, sin explicación al crear nuevos usuarios

## Solución Implementada

### 1. Reorganización del Layout

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

**Ruta:** https://app.movi.digital/directorio

**Acciones:**
1. **Crear Usuario:** Click en "Nuevo Usuario" → Ver mensaje informativo sobre el logo
2. **Editar Usuario:** Click en cualquier usuario → Scroll hacia abajo → Ver "Mi Logotipo Personal" con editor completo

## Flujo de Trabajo Recomendado

### Para Administradores
1. Crear el nuevo usuario con todos sus datos
2. Guardar el usuario
3. Volver a abrir el usuario en modo edición
4. Subir el logotipo personal en la sección "Mi Logotipo Personal"
5. El logo aparecerá automáticamente en todos los PDFs del usuario

### Para Usuarios (Editar su propio perfil)
1. Ir a su perfil personal
2. Buscar la sección "Mi Logotipo Personal"
3. Subir su logo usando el botón "Subir logotipo"
4. Ver vista previa inmediata
5. El logo se aplicará a todos sus documentos

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

### Test 1: Crear Usuario Sin Logo
1. Crear nuevo usuario desde Directorio
2. Verificar que se muestre mensaje informativo sobre el logo
3. Guardar usuario
4. Verificar que se pueda editar después

### Test 2: Editar Usuario y Subir Logo
1. Abrir usuario existente en modo edición
2. Verificar que aparezca la sección "Mi Logotipo Personal" destacada
3. Verificar banner azul informativo
4. Subir un logo (PNG/JPG)
5. Verificar vista previa inmediata

### Test 3: Cambiar Logo Existente
1. Editar usuario que ya tiene logo
2. Verificar que se muestre el logo actual
3. Usar botón "Cambiar logotipo"
4. Subir nuevo logo
5. Verificar que se actualice

### Test 4: Eliminar Logo
1. Editar usuario con logo
2. Usar botón "Eliminar"
3. Confirmar eliminación
4. Verificar que desaparezca el logo personal
5. El sistema debe usar logo de oficina o JIRO

### Test 5: Visibilidad en Scroll
1. Abrir modal de edición de usuario
2. Verificar que la sección "Mi Logotipo Personal" sea visible sin mucho scroll
3. El icono 📸 debe ser fácil de identificar
4. No debe estar oculto al final del formulario

## Archivos Modificados

1. **src/components/UserModal.tsx**
   - Reorganización de secciones
   - Banner informativo azul (editar)
   - Mensaje informativo gris (crear)
   - Título con icono 📸

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
