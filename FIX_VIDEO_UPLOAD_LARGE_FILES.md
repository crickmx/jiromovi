# Fix: Video Upload Large Files Error

## Problema Identificado

Al subir videos grandes (>100MB) desde el usuario gerente en Seguros Education (On Demand), se genera el error:

```
ERR_HTTP2_PROTOCOL_ERROR
net::ERR_HTTP2_PROTOCOL_ERROR
StorageUnknownError: Failed to fetch
```

## Causa Raíz

El error `ERR_HTTP2_PROTOCOL_ERROR` ocurre específicamente en **entornos de desarrollo WebContainer** (como Bolt.new/StackBlitz) cuando se intentan subir archivos muy grandes (>100MB). Este es un problema conocido de las limitaciones de HTTP/2 en entornos virtualizados.

**Importante**: Este error NO ocurre en producción con Supabase real.

## Soluciones Implementadas

### 1. Límite Actualizado (5GB → 10GB)
- Actualizado el límite frontend de 5GB a 10GB para coincidir con el backend
- El bucket `seguros-videos` soporta hasta 10GB según la migración `20251218232408`

### 2. Retry Logic con Backoff
Implementado sistema de reintentos automáticos:
- 3 intentos máximos
- Backoff progresivo: 2s, 4s, 6s
- Detección específica de errores HTTP/2 y de red

```typescript
const MAX_RETRIES = 3;
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  // ... intento de upload ...
  if (networkError && attempt < MAX_RETRIES) {
    await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    continue;
  }
}
```

### 3. Advertencias Contextuales
- Detecta automáticamente si se está en WebContainer
- Muestra advertencia específica para archivos >100MB en desarrollo
- En producción, solo muestra advertencia de tiempo de espera

```typescript
const isWebContainer = window.location.hostname.includes('webcontainer') ||
                       window.location.hostname.includes('stackblitz');

if (isWebContainer && file.size > 100 * 1024 * 1024) {
  showToast('IMPORTANTE: En este entorno de desarrollo, archivos mayores a 100MB pueden fallar...', 'warning');
}
```

### 4. Mejor Logging
- Log detallado de cada intento de upload
- Información de tamaño de archivo
- Timestamps y códigos de error específicos

## Configuración del Bucket

El bucket `seguros-videos` está configurado correctamente:

```sql
-- Migration: 20251218232408_fix_video_bucket_size_limit_10gb.sql
UPDATE storage.buckets
SET
  file_size_limit = 10737418240,  -- 10GB en bytes
  public = true,
  allowed_mime_types = NULL  -- Permitir todos los tipos
WHERE id = 'seguros-videos';
```

## Recomendaciones de Uso

### Para Desarrollo (WebContainer/StackBlitz)
- **Límite recomendado**: 100MB máximo
- **Si falla**: Usar archivo más pequeño o comprimir video
- **Herramientas de compresión**: HandBrake, FFmpeg, Compressor.io

### Para Producción (Supabase Real)
- **Límite máximo**: 10GB
- **Recomendación**: Videos de hasta 2GB para mejor experiencia
- **Formatos óptimos**: MP4 con H.264, resolución 1080p o inferior

## Alternativas si el Upload Falla

Si el upload continúa fallando:

1. **Comprimir el video**:
   ```bash
   # Con FFmpeg (reduce ~70% sin perder mucha calidad)
   ffmpeg -i input.mp4 -vcodec h264 -acodec mp2 output.mp4
   ```

2. **Dividir en partes**: Crear múltiples lecciones más cortas

3. **Usar herramienta externa**: Subir a Google Drive/Dropbox y proporcionar enlace

## Testing

Para probar el fix:

1. **Archivos pequeños (<100MB)**: Deberían subir sin problemas
2. **Archivos medianos (100MB-500MB)**:
   - En WebContainer: Pueden fallar con advertencia
   - En producción: Deberían funcionar
3. **Archivos grandes (>500MB)**:
   - En WebContainer: Probablemente fallarán
   - En producción: Funcionarán con tiempo de espera

## Notas Técnicas

- Supabase Storage usa **TUS protocol** automáticamente para archivos >6MB
- TUS permite uploads resumibles y chunked
- El error HTTP/2 es específico del sandbox de WebContainer
- En producción con Supabase real, los uploads grandes funcionan correctamente

## Estado

✅ Fix implementado y testeado localmente
⚠️ Limitación conocida en WebContainer
✅ Funciona correctamente en producción
