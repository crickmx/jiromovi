# Migración de Lecciones On Demand - Seguros Education

## 📋 Resumen

Migrar todas las lecciones de la categoría "Academia de Negocios 2025" (On Demand) desde videos de Google Drive a videos alojados en Supabase Storage.

## 📊 Estado Actual

- **Categoría:** Academia de Negocios 2025 (ID: `058c4297-3721-4847-a069-6c03f815bd7c`)
- **Lecciones actuales:** 29 lecciones con videos de Google Drive
- **Buckets de Storage disponibles:**
  - `videos-seguros-education` - Videos de lecciones
  - `thumbnails-seguros-education` - Miniaturas/thumbnails

## 🎯 Objetivo

1. Eliminar las 29 lecciones actuales
2. Crear nuevas lecciones usando:
   - Videos desde `videos-seguros-education`
   - Miniaturas desde `thumbnails-seguros-education`
   - Matching automático por nombre de archivo
   - Logo de Seguros Education como fallback para miniaturas no encontradas

## 🚀 Proceso de Migración

### Opción 1: Script HTML Automatizado (RECOMENDADO)

Abre en tu navegador:
```
http://localhost:5173/migrate-on-demand-lessons-complete.html
```

O en producción:
```
https://tu-dominio.com/migrate-on-demand-lessons-complete.html
```

**Pasos en el script:**

1. **Paso 1: Listar Archivos**
   - Click en "Listar Videos y Miniaturas"
   - Verás una tabla con preview de todas las lecciones que se crearán
   - El script hace matching automático entre videos y thumbnails

2. **Paso 2: Eliminar Lecciones Actuales**
   - Click en "Eliminar 29 Lecciones Actuales"
   - Confirma la operación
   - Se eliminarán las 29 lecciones y todo el progreso asociado

3. **Paso 3: Crear Nuevas Lecciones**
   - Click en "Crear Nuevas Lecciones desde Storage"
   - Confirma la operación
   - Se crearán las nuevas lecciones con los videos de Storage

### Opción 2: SQL Manual

Si prefieres hacerlo manualmente via SQL:

#### Paso 1: Eliminar progreso y lecciones actuales

```sql
-- Eliminar progreso de las lecciones
DELETE FROM seguros_progress
WHERE lesson_id IN (
  SELECT id FROM seguros_lessons
  WHERE categoria_id = '058c4297-3721-4847-a069-6c03f815bd7c'
);

-- Eliminar lecciones
DELETE FROM seguros_lessons
WHERE categoria_id = '058c4297-3721-4847-a069-6c03f815bd7c';
```

#### Paso 2: Insertar nuevas lecciones

Necesitas generar las URLs manualmente listando los archivos en Storage y creando los INSERTs correspondientes.

## 🔍 Lógica de Matching

El script hace matching automático de thumbnails:

```javascript
function findMatchingThumbnail(videoName) {
  // Remove extension from video name
  const videoBase = videoName.replace(/\.[^/.]+$/, '').toLowerCase();

  // Find thumbnail with same base name
  const match = thumbnails.find(thumb => {
    const thumbBase = thumb.name.replace(/\.[^/.]+$/, '').toLowerCase();
    return thumbBase === videoBase ||
           thumbBase.includes(videoBase) ||
           videoBase.includes(thumbBase);
  });

  return match
    ? `${supabaseUrl}/storage/v1/object/public/thumbnails-seguros-education/${match.name}`
    : logoDefault; // Fallback al logo de Seguros Education
}
```

## 📝 Generación de Títulos

Los títulos se generan automáticamente desde los nombres de archivo:

```javascript
function generateTitle(filename) {
  // Remove extension
  let title = filename.replace(/\.[^/.]+$/, '');

  // Replace underscores/hyphens with spaces
  title = title.replace(/[_-]/g, ' ');

  // Capitalize first letter of each word
  title = title.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return title;
}
```

**Ejemplos:**
- `domina_qualitas.mp4` → "Domina Qualitas"
- `control-total-liderazgo.mp4` → "Control Total Liderazgo"
- `gmm_para_jovenes.mp4` → "Gmm Para Jovenes"

## ✅ Verificación Post-Migración

Después de la migración, verifica:

```sql
-- Contar nuevas lecciones
SELECT COUNT(*) as total_lecciones
FROM seguros_lessons
WHERE categoria_id = '058c4297-3721-4847-a069-6c03f815bd7c';

-- Ver todas las lecciones creadas
SELECT orden, titulo, video_url, miniatura_url
FROM seguros_lessons
WHERE categoria_id = '058c4297-3721-4847-a069-6c03f815bd7c'
ORDER BY orden;

-- Verificar que no haya progreso huérfano
SELECT COUNT(*)
FROM seguros_progress p
WHERE NOT EXISTS (
  SELECT 1 FROM seguros_lessons l WHERE l.id = p.lesson_id
);
```

## 🎨 URLs de Ejemplo

**Video:**
```
https://lcsjaejpenwecoitbthb.supabase.co/storage/v1/object/public/videos-seguros-education/nombre_video.mp4
```

**Thumbnail:**
```
https://lcsjaejpenwecoitbthb.supabase.co/storage/v1/object/public/thumbnails-seguros-education/nombre_thumb.jpg
```

**Logo Default:**
```
https://movi.digital/wp-content/uploads/elementor/thumbs/SE_logo-qi2h8gdjgh6jj941hy1ii3ma59is7tbjiuao4t0a2o.png
```

## ⚠️ Notas Importantes

1. **Backup:** El script elimina las lecciones actuales permanentemente. Asegúrate de hacer backup si es necesario.

2. **Progreso de Usuarios:** Al eliminar las lecciones, también se eliminará el progreso de todos los usuarios en esas lecciones.

3. **Orden:** Las lecciones se crearán en orden alfabético según el nombre del archivo del video.

4. **Miniaturas:** Si no se encuentra una miniatura matching, se usa el logo de Seguros Education.

5. **Formato de archivos:**
   - Videos: MP4, MOV, AVI, etc.
   - Thumbnails: JPG, PNG, WEBP, etc.

## 📦 Archivos Creados

- `/public/migrate-on-demand-lessons-complete.html` - Script de migración completo
- `/MIGRACION_LECCIONES_ON_DEMAND.md` - Esta documentación

## 🔗 Próximos Pasos

Después de la migración:

1. Verificar que todas las lecciones estén accesibles en la UI
2. Probar la reproducción de algunos videos
3. Verificar que las miniaturas se muestren correctamente
4. Comunicar a los usuarios sobre el nuevo contenido disponible

---

**Estado:** ✅ Script listo para ejecutar
**Última actualización:** 2025-01-24
