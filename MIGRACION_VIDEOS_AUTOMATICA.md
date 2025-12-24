# Migración Automática de Videos - Academia de Negocios 2025

## Resumen

Sistema completo para migrar automáticamente todos los videos e imágenes de Google Drive a Supabase Storage.

## Archivos Involucrados

1. **Edge Function**: `supabase/functions/migrate-videos-from-drive/index.ts`
   - Descarga videos desde Google Drive
   - Sube a Supabase Storage
   - Retorna las nuevas URLs

2. **Herramienta Web**: `public/migrate-all-videos-auto.html`
   - Interfaz completa de migración
   - Progreso en tiempo real
   - Actualización automática de base de datos

## Proceso de Migración

### Paso 1: Verificar que el Edge Function esté desplegado

El edge function ya está creado. Si no está desplegado, ejecutar:

```bash
# No es necesario, ya está desplegado en Supabase
```

### Paso 2: Acceder a la herramienta de migración

1. Abrir en el navegador:
   ```
   http://localhost:5173/migrate-all-videos-auto.html
   ```

2. La herramienta mostrará:
   - Total de videos a migrar (29)
   - Estadísticas en tiempo real
   - Progreso visual
   - Log detallado de operaciones

### Paso 3: Ejecutar la migración

1. Hacer clic en **"Iniciar Migración"**
2. El sistema automáticamente:
   - Carga todas las lecciones de "Academia de Negocios 2025"
   - Para cada lección:
     - Descarga el video desde Google Drive
     - Sube el video a `seguros-videos` bucket
     - Descarga la miniatura desde Google Drive
     - Sube la miniatura a `seguros-thumbnails` bucket
     - Actualiza la base de datos con las nuevas URLs
   - Muestra progreso en tiempo real
   - Registra todos los eventos en el log

### Paso 4: Verificar resultados

Al finalizar, la herramienta mostrará:
- ✅ Videos migrados exitosamente
- ❌ Videos con errores (si los hay)
- 📊 Estadísticas finales
- ⏱️ Tiempo total de migración

## Estructura de Almacenamiento en Supabase

### Bucket: `seguros-videos`
- Ruta: `academia-negocios-2025/{slug}.mp4`
- Límite: 10 GB por archivo
- Acceso: Público (lectura)
- Ejemplo: `academia-negocios-2025/gestion-de-siniestros-protocolo-de-respuesta-inmediata.mp4`

### Bucket: `seguros-thumbnails`
- Ruta: `academia-negocios-2025/{slug}.jpg`
- Límite: 500 MB por archivo
- Acceso: Público (lectura)
- Ejemplo: `academia-negocios-2025/gestion-de-siniestros-protocolo-de-respuesta-inmediata.jpg`

## Ventajas de la Migración

### 1. Independencia Total
- ✅ Sin depender de Google Drive
- ✅ Control completo sobre los archivos
- ✅ Sin riesgo de cambios en políticas de Google

### 2. Mejor Rendimiento
- ✅ CDN global de Supabase
- ✅ Entrega más rápida de videos
- ✅ Streaming optimizado

### 3. Tracking Avanzado
- ✅ Próximamente: Progreso de visualización
- ✅ Analytics detallados
- ✅ Métricas de engagement

### 4. Experiencia Premium
- ✅ Controles personalizados
- ✅ UI/UX consistente
- ✅ Sin logos de terceros

## Después de la Migración

### ✅ Puedes Eliminar de Google Drive

Una vez verificado que todos los videos funcionan correctamente en la plataforma, puedes eliminar los archivos de Google Drive para liberar espacio.

### 🎬 Siguiente Fase (Opcional)

Implementar tracking de progreso:
- Tabla `video_progress` para almacenar progreso de cada usuario
- Actualización en tiempo real del progreso
- Reanudar desde el último punto
- Certificados al completar lecciones

## Solución de Problemas

### Error: "Failed to download from Drive"
**Causa**: El archivo de Google Drive es privado o la URL cambió
**Solución**: Verificar que el archivo sea público y accesible

### Error: "Failed to upload to Supabase"
**Causa**: Límite de tamaño excedido o problemas de red
**Solución**: Verificar tamaño del archivo (max 10GB para videos)

### Error: "Failed to update database"
**Causa**: Problemas de permisos o título no coincide
**Solución**: Verificar que el título en BD sea exacto

## Estimaciones

- **Tiempo total**: 15-30 minutos
- **Videos**: 29 lecciones
- **Tamaño estimado**: ~5-10 GB total
- **Intervalo entre videos**: 2 segundos (para evitar sobrecarga)

## Estado Actual

- ✅ Edge function creado y configurado
- ✅ Herramienta web lista y funcional
- ✅ Buckets de storage configurados
- ✅ Políticas de acceso establecidas
- ⏳ Listo para ejecutar migración

## Comando Rápido

Para ejecutar la migración completa:

1. Abrir: `http://localhost:5173/migrate-all-videos-auto.html`
2. Clic en: **"Iniciar Migración"**
3. Esperar a que complete
4. Verificar resultados

¡Listo! El sistema está completamente automatizado.
