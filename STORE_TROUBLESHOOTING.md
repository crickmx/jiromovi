# Solución de Problemas - Store MOVI

## 🐛 Error: "Error al guardar producto"

### Diagnóstico Paso a Paso

Cuando aparece el error "Error al guardar producto", sigue estos pasos:

---

## 📋 1. Verificar Consola del Navegador

**Abre la consola del navegador** (F12 → Console) y busca mensajes detallados:

```
✅ "Subiendo imagen:" - Verifica que el archivo se está procesando
✅ "Imagen subida exitosamente:" - La imagen se subió correctamente
✅ "URL pública generada:" - Se generó la URL
✅ "Creando producto con datos:" - Los datos del producto están correctos
✅ "Producto creado exitosamente:" - Todo funcionó
```

Si ves un error en rojo, copia el mensaje completo.

---

## 🔍 2. Errores Comunes y Soluciones

### Error: "new row violates row-level security policy"

**Causa:** El usuario no es reconocido como Administrador

**Solución:**
1. Verifica que estás logueado con un usuario Administrador
2. Cierra sesión y vuelve a entrar
3. Verifica en la base de datos:

```sql
-- Ejecutar en Supabase SQL Editor
SELECT id, nombre, rol
FROM usuarios
WHERE id = auth.uid();
```

Si el resultado no muestra `rol = 'Administrador'`, necesitas actualizar tu usuario:

```sql
-- Actualizar tu rol (reemplaza con tu usuario)
UPDATE usuarios
SET rol = 'Administrador'
WHERE nombre = 'TU_NOMBRE';
```

---

### Error: "Failed to upload file"

**Causa:** Problema con el bucket de storage

**Solución:**
1. Verifica que el bucket existe:

```sql
SELECT id, name, public
FROM storage.buckets
WHERE id = 'store-productos';
```

Si no existe, créalo:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-productos', 'store-productos', true)
ON CONFLICT (id) DO NOTHING;
```

2. Verifica las políticas de storage:

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname LIKE '%productos%';
```

---

### Error: "column does not exist"

**Causa:** Falta una columna en la tabla

**Solución:**
Verifica la estructura de la tabla:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'store_productos';
```

Debería tener:
- `id` (uuid)
- `categoria_id` (uuid)
- `titulo` (text)
- `descripcion` (text)
- `precio` (numeric)
- `imagen_url` (text)
- `activo` (boolean)
- `created_at` (timestamptz)

---

### Error: "violates foreign key constraint"

**Causa:** La categoría seleccionada no existe

**Solución:**
1. Verifica que tienes categorías activas:

```sql
SELECT id, nombre, activo
FROM store_categorias
WHERE activo = true;
```

2. Si no hay categorías, crea una:

```sql
INSERT INTO store_categorias (nombre, descripcion, activo)
VALUES ('General', 'Categoría general', true);
```

---

## 🔧 3. Verificación Completa del Sistema

Ejecuta este script de diagnóstico en Supabase SQL Editor:

```sql
-- Script de diagnóstico completo
DO $$
DECLARE
  v_user_id uuid;
  v_user_rol text;
  v_bucket_exists boolean;
  v_categorias_count int;
BEGIN
  -- Verificar usuario actual
  v_user_id := auth.uid();
  SELECT rol INTO v_user_rol FROM usuarios WHERE id = v_user_id;

  RAISE NOTICE '=== DIAGNÓSTICO ===';
  RAISE NOTICE 'Usuario ID: %', v_user_id;
  RAISE NOTICE 'Rol: %', COALESCE(v_user_rol, 'NO ENCONTRADO');

  -- Verificar bucket
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'store-productos') INTO v_bucket_exists;
  RAISE NOTICE 'Bucket existe: %', v_bucket_exists;

  -- Verificar categorías
  SELECT COUNT(*) INTO v_categorias_count FROM store_categorias WHERE activo = true;
  RAISE NOTICE 'Categorías activas: %', v_categorias_count;

  -- Verificar políticas
  RAISE NOTICE 'Políticas de productos:';
  FOR rec IN SELECT policyname, cmd FROM pg_policies WHERE tablename = 'store_productos' LOOP
    RAISE NOTICE '  - % (%)', rec.policyname, rec.cmd;
  END LOOP;
END $$;
```

---

## 🎯 4. Solución Rápida

Si todo falla, ejecuta este script para resetear el sistema:

```sql
-- ⚠️ CUIDADO: Esto eliminará todos los productos existentes

-- 1. Eliminar productos existentes
DELETE FROM store_productos;

-- 2. Verificar/crear bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-productos', 'store-productos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Crear categoría de prueba
INSERT INTO store_categorias (nombre, descripcion, activo)
VALUES ('Prueba', 'Categoría de prueba', true)
ON CONFLICT DO NOTHING;

-- 4. Verificar tu rol
UPDATE usuarios
SET rol = 'Administrador'
WHERE id = auth.uid();
```

---

## 📸 5. Problemas Específicos con Imágenes

### Imagen muy grande

**Error:** "Payload too large"

**Solución:**
- Reduce el tamaño de la imagen a menos de 5MB
- Usa herramientas como TinyPNG o compressjpeg.com
- Cambia el formato a WebP

### Formato no soportado

**Error:** "Invalid file type"

**Solución:**
- Usa solo JPG, PNG, WebP o GIF
- Verifica que el archivo no esté corrupto
- Intenta con otra imagen

---

## 🆘 6. Contactar Soporte

Si ninguna solución funciona, proporciona esta información:

1. **Mensaje de error completo** (de la consola del navegador)
2. **Usuario con el que estás logueado**
3. **Resultado del script de diagnóstico**
4. **Captura de pantalla del error**

---

## ✅ Checklist de Verificación

Antes de reportar un error, verifica:

- [ ] Estás logueado como Administrador
- [ ] El bucket 'store-productos' existe
- [ ] Tienes al menos una categoría activa
- [ ] La imagen es menor a 5MB
- [ ] La imagen es JPG, PNG, WebP o GIF
- [ ] Has limpiado caché del navegador
- [ ] Has cerrado sesión y vuelto a entrar
- [ ] La consola del navegador muestra los logs detallados

---

## 🔍 Logs del Sistema

Los logs ahora incluyen información detallada:

**Al subir imagen:**
```
Subiendo imagen: { path, fileName, fileSize, fileType }
Imagen subida exitosamente: { data }
URL pública generada: { url }
```

**Al crear producto:**
```
Creando producto con datos: { titulo, descripcion, precio, ... }
Producto creado exitosamente: { id, ... }
```

**Si hay error:**
```
Error al crear producto: [mensaje detallado] ([código])
Error subiendo imagen: [mensaje detallado]
```

---

## 📞 Comandos SQL Útiles

```sql
-- Ver todos los productos
SELECT id, titulo, precio, activo FROM store_productos;

-- Ver todas las categorías
SELECT id, nombre, activo FROM store_categorias;

-- Ver políticas de productos
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'store_productos';

-- Ver políticas de storage
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Ver mi usuario actual
SELECT id, nombre, rol FROM usuarios WHERE id = auth.uid();

-- Contar productos por categoría
SELECT c.nombre, COUNT(p.id)
FROM store_categorias c
LEFT JOIN store_productos p ON p.categoria_id = c.id
GROUP BY c.nombre;
```

---

**Última actualización:** 2025-11-23
