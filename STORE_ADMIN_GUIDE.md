# Guía de Administración del Store MOVI

## 🎯 Acceso a la Administración

**Solo Administradores** pueden acceder a la administración del Store.

### Formas de acceder:

1. **Desde el catálogo del Store:**
   - Ir a Store en el menú principal
   - Click en el botón "Administrar" (aparece solo para admins)

2. **Directamente:**
   - Navegar a `/store/admin`

---

## 📦 Gestión de Productos

### Crear un Nuevo Producto

1. Click en la pestaña "Productos"
2. Click en "Nuevo Producto"
3. Completar el formulario:
   - **Título:** Nombre del producto (obligatorio)
   - **Descripción:** Descripción detallada (obligatorio)
   - **Precio:** Precio en pesos (obligatorio)
   - **Categoría:** Seleccionar de la lista (obligatorio)
   - **Imagen:** Subir imagen del producto (obligatorio)
   - **Activo:** Marcar si estará visible en el catálogo
4. Click en "Crear"

### Editar un Producto

1. En la tabla de productos, click en el ícono de lápiz (Editar)
2. Modificar los campos deseados
3. Opcionalmente cambiar la imagen
4. Click en "Actualizar"

### Eliminar un Producto

1. En la tabla de productos, click en el ícono de basurero (Eliminar)
2. Confirmar la eliminación

**Nota:** Si el producto tiene pedidos asociados, NO se podrá eliminar. En ese caso, desactívalo.

### Activar/Desactivar un Producto

1. Click en el badge de estado (Activo/Inactivo) en la tabla
2. El producto se activará o desactivará automáticamente
3. Los productos inactivos NO aparecen en el catálogo para usuarios

---

## 📁 Gestión de Categorías

### Crear una Nueva Categoría

1. Click en la pestaña "Categorías"
2. Click en "Nueva Categoría"
3. Completar el formulario:
   - **Nombre:** Nombre de la categoría (obligatorio)
   - **Descripción:** Descripción opcional
   - **Activo:** Marcar si estará visible
4. Click en "Crear"

### Editar una Categoría

1. En la tarjeta de la categoría, click en "Editar"
2. Modificar los campos deseados
3. Click en "Actualizar"

### Eliminar una Categoría

1. En la tarjeta de la categoría, click en "Eliminar"
2. Confirmar la eliminación

**Nota:** Si la categoría tiene productos asociados, NO se podrá eliminar. Primero debes reasignar o eliminar los productos.

### Activar/Desactivar una Categoría

1. Click en el badge de estado (Activo/Inactivo) en la tarjeta
2. La categoría se activará o desactivará automáticamente
3. Las categorías inactivas NO aparecen en los filtros

---

## 🖼️ Subida de Imágenes

### Requisitos de Imágenes:

- **Formato:** JPG, PNG, WebP, GIF
- **Tamaño recomendado:** 800x800 px (cuadrada)
- **Peso recomendado:** Menor a 2MB
- **Aspecto:** La imagen se mostrará como cuadrada en el catálogo

### Proceso de Subida:

1. Al crear/editar un producto, click en el campo "Imagen"
2. Seleccionar archivo de tu computadora
3. Se mostrará una vista previa
4. Al guardar, la imagen se sube automáticamente

**Nota:** Las imágenes se almacenan en Supabase Storage en el bucket `store-productos`.

---

## 📊 Vista de Tabla de Productos

La tabla muestra:

| Columna | Descripción |
|---------|-------------|
| Imagen | Miniatura del producto |
| Producto | Título y descripción corta |
| Categoría | Categoría asignada |
| Precio | Precio formateado en pesos mexicanos |
| Estado | Badge activo/inactivo (clickeable) |
| Acciones | Botones de editar y eliminar |

---

## ✅ Buenas Prácticas

### Para Productos:

1. **Títulos claros:** Usa nombres descriptivos y profesionales
2. **Descripciones completas:** Incluye características, dimensiones, etc.
3. **Precios correctos:** Verifica que el precio sea el correcto antes de publicar
4. **Imágenes de calidad:** Usa fotos profesionales con fondo limpio
5. **Categorización:** Asigna la categoría correcta para facilitar la búsqueda
6. **Estados:** Usa "Inactivo" para productos temporalmente no disponibles

### Para Categorías:

1. **Nombres concisos:** Máximo 2-3 palabras
2. **Evita duplicados:** Verifica que no exista una categoría similar
3. **Organización lógica:** Agrupa productos de forma coherente
4. **Descripciones útiles:** Explica qué tipo de productos incluye

---

## 🔒 Seguridad

- Solo los Administradores pueden acceder a `/store/admin`
- Otros roles serán redirigidos al catálogo
- Todas las operaciones están protegidas con RLS (Row Level Security)
- Las imágenes subidas son públicas pero solo los admins pueden subirlas

---

## 🚀 Flujo de Trabajo Recomendado

### Al agregar productos nuevos:

1. ✅ Crear las categorías necesarias primero
2. ✅ Preparar las imágenes (cuadradas, buena calidad)
3. ✅ Crear los productos con toda su información
4. ✅ Revisar en el catálogo que se vean correctamente
5. ✅ Activar los productos para que estén disponibles

### Al actualizar productos:

1. ✅ Desactivar temporalmente si necesitas hacer cambios grandes
2. ✅ Actualizar la información
3. ✅ Verificar la vista previa
4. ✅ Reactivar el producto

### Al discontinuar productos:

1. ✅ NO eliminar directamente (puede tener pedidos)
2. ✅ Desactivar el producto
3. ✅ Considerar agregar "(Descontinuado)" al título si es necesario

---

## 🐛 Solución de Problemas

### No puedo eliminar un producto:
- **Causa:** El producto tiene pedidos asociados
- **Solución:** Desactívalo en lugar de eliminarlo

### No puedo eliminar una categoría:
- **Causa:** La categoría tiene productos asociados
- **Solución:** Reasigna los productos a otra categoría o desactívala

### La imagen no se sube:
- **Causa:** Archivo muy pesado o formato incorrecto
- **Solución:** Reduce el tamaño del archivo y verifica que sea JPG, PNG o WebP

### No veo el botón "Administrar":
- **Causa:** No tienes rol de Administrador
- **Solución:** Contacta a otro administrador para que te asigne el rol

---

## 📱 Interfaz Responsive

La administración funciona en:
- 💻 Desktop (experiencia óptima)
- 📱 Tablet (funcional)
- 📱 Móvil (funcional pero recomendado usar desktop)

---

## 🎨 Estados Visuales

### Productos:
- **Activo:** Badge verde con ícono de ojo
- **Inactivo:** Badge gris con ícono de ojo tachado

### Categorías:
- **Activo:** Badge verde con ícono de ojo
- **Inactivo:** Badge gris con ícono de ojo tachado

---

## 📞 Soporte

Para soporte técnico o dudas sobre la administración del Store, contacta al equipo de desarrollo.

---

**Última actualización:** 2025-11-23
