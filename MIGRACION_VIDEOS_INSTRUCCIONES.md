# 📹 Instrucciones para Migrar Videos a MOVI Digital

## Problema

Actualmente los videos e imágenes de "Academia de Negocios 2025" están alojados en Google Drive. Necesitamos migrarlos a los buckets de Supabase Storage (MOVI Digital) para tener control total sobre los archivos.

## Opciones de Migración

### Opción 1: Script Node.js Automático (Recomendado)

He creado un script que descarga todos los archivos de Google Drive y los sube automáticamente a Supabase.

**Requisitos:**
- Node.js instalado
- Variables de entorno configuradas

**Pasos:**

1. Asegúrate de que las variables de entorno estén en tu archivo `.env`:
   ```bash
   VITE_SUPABASE_URL=tu_url
   SUPABASE_SERVICE_ROLE_KEY=tu_service_key
   ```

2. Ejecuta el script:
   ```bash
   node migrate-videos-script.mjs
   ```

3. El script hará automáticamente:
   - Descargar cada video de Google Drive
   - Descargar cada imagen/miniatura
   - Subir al bucket `seguros-videos` (videos)
   - Subir al bucket `seguros-thumbnails` (imágenes)
   - Actualizar la base de datos con las nuevas URLs

**Progreso:**
- Total de archivos: 29 videos
- Imágenes: 16 (13 videos no tienen imagen)
- Tiempo estimado: 30-60 minutos (dependiendo del tamaño de los archivos)

### Opción 2: Migración Manual con Herramienta Web

Si Google Drive bloquea las descargas automáticas, usa la herramienta HTML:

1. Abre el archivo: `public/migrate-videos-to-movi.html` en tu navegador

2. Pega el contenido CSV en el textarea

3. Haz clic en "Iniciar Migración"

4. La herramienta intentará:
   - Descargar desde Google Drive (puede fallar por CORS)
   - Subir a Supabase Storage
   - Actualizar la base de datos

**Nota:** Esta opción puede fallar debido a restricciones CORS de Google Drive.

### Opción 3: Descarga Manual + Upload

Si las opciones automatizadas fallan:

1. Descarga manualmente todos los archivos de Google Drive a una carpeta local

2. Usa este script modificado que lee desde archivos locales:

```javascript
// Modifica migrate-videos-script.mjs para leer desde ./downloads/
const videoPath = `./downloads/videos/${filename}.mp4`;
const imagePath = `./downloads/images/${filename}.jpg`;
```

3. Ejecuta el script de upload

## Estructura de Destino en Supabase

Los archivos se organizarán así:

```
seguros-videos/
  academia-negocios-2025/
    gestion-de-siniestros-protocolo-de-respuesta-inmediata.mp4
    secretos-del-seguro-de-auto-mapfre.mp4
    inversion-en-salud-gmm-para-jovenes-axa.mp4
    ...

seguros-thumbnails/
  academia-negocios-2025/
    gestion-de-siniestros-protocolo-de-respuesta-inmediata.jpg
    inversion-en-salud-gmm-para-jovenes-axa.jpg
    ...
```

## URLs Resultantes

Después de la migración, las URLs serán:

**Videos:**
```
https://[tu-proyecto].supabase.co/storage/v1/object/public/seguros-videos/academia-negocios-2025/[nombre-archivo].mp4
```

**Imágenes:**
```
https://[tu-proyecto].supabase.co/storage/v1/object/public/seguros-thumbnails/academia-negocios-2025/[nombre-archivo].jpg
```

## Verificación

Después de la migración, verifica que:

1. Los archivos están en Supabase Storage:
   - Ve a tu dashboard de Supabase
   - Storage → seguros-videos → academia-negocios-2025
   - Storage → seguros-thumbnails → academia-negocios-2025

2. La base de datos se actualizó:
   ```sql
   SELECT titulo, video_url, miniatura_url
   FROM seguros_lessons
   WHERE categoria_id IN (
     SELECT id FROM seguros_categories
     WHERE nombre = 'Academia de Negocios 2025'
   );
   ```

3. Las URLs funcionan:
   - Abre algunas URLs en el navegador
   - Verifica que los videos se reproduzcan
   - Verifica que las imágenes se muestren

## Problemas Comunes

### Google Drive bloquea las descargas

**Solución:**
- Asegúrate de que los archivos sean públicos en Google Drive
- Usa la opción de descarga manual
- O contacta al administrador de Google Drive para obtener permisos

### Error "403 Forbidden" en Supabase

**Solución:**
- Verifica que los buckets existen
- Verifica que los buckets son públicos
- Verifica que tienes el `SUPABASE_SERVICE_ROLE_KEY` correcto

### Error "CORS policy"

**Solución:**
- Este error ocurre en el navegador
- Usa el script Node.js en su lugar (Opción 1)

## Limpieza Post-Migración

Una vez verificado que todo funciona:

1. NO elimines los archivos de Google Drive inmediatamente
2. Mantén ambas versiones por 1-2 semanas
3. Monitorea que no haya errores en producción
4. Después de confirmar que todo funciona, puedes limpiar Google Drive

## Soporte

Si encuentras problemas:
1. Revisa los logs del script
2. Verifica las variables de entorno
3. Verifica los permisos de Supabase Storage
4. Verifica que las URLs de Google Drive sean accesibles

## Estado Actual

- ✅ Buckets de Storage creados
- ✅ Script de migración listo
- ✅ Herramienta web creada
- ⏳ Pendiente: Ejecutar migración
- ⏳ Pendiente: Verificar archivos
- ⏳ Pendiente: Actualizar base de datos
