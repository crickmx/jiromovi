# Cómo Probar la Funcionalidad de Adjuntar Documentos

## ✅ Verificación Rápida

### 1. Verificar Migración de Base de Datos
```sql
-- En Supabase SQL Editor
SELECT * FROM information_schema.tables
WHERE table_name = 'assistant_attachments';

-- Verificar columnas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'assistant_attachments';
```

### 2. Verificar Storage Bucket
```sql
-- Verificar que existe el bucket
SELECT id, name, public FROM storage.buckets
WHERE id = 'assistant-files';

-- Resultado esperado:
-- id: assistant-files
-- name: assistant-files
-- public: false
```

---

## 🧪 Pruebas Funcionales

### Prueba 1: Adjuntar Un Archivo

**Pasos:**
1. Abrir el asistente (botón flotante o modal)
2. Click en el botón 📎 (Paperclip) a la izquierda del input
3. Seleccionar un archivo PDF de prueba
4. Verificar que aparece en la lista arriba del input
5. Escribir: "Resume este documento"
6. Click en enviar

**Resultado esperado:**
- ✅ Archivo aparece en lista con nombre y tamaño
- ✅ Mensaje del usuario muestra "📎 Archivos adjuntos: documento.pdf"
- ✅ Asistente responde (puede indicar que necesita capacidad de leer PDF)

### Prueba 2: Adjuntar Múltiples Archivos

**Pasos:**
1. Abrir el asistente
2. Click en 📎 y seleccionar 2-3 archivos (Ctrl+Click o Cmd+Click)
3. Verificar que todos aparecen en la lista
4. Enviar con o sin mensaje

**Resultado esperado:**
- ✅ Todos los archivos se muestran
- ✅ Cada uno con su nombre y tamaño
- ✅ Mensaje lista todos los archivos

### Prueba 3: Eliminar Archivos Antes de Enviar

**Pasos:**
1. Adjuntar 2-3 archivos
2. Click en X para eliminar uno
3. Verificar que se elimina de la lista
4. Enviar los archivos restantes

**Resultado esperado:**
- ✅ Archivo eliminado desaparece de la lista
- ✅ Solo los archivos restantes se envían
- ✅ Solo aparecen en el mensaje los no eliminados

### Prueba 4: Enviar Solo Archivos (Sin Texto)

**Pasos:**
1. Adjuntar archivo(s)
2. NO escribir texto
3. Click en enviar

**Resultado esperado:**
- ✅ Botón de enviar se habilita con archivos
- ✅ Mensaje solo contiene lista de archivos
- ✅ Asistente puede preguntar qué hacer con los archivos

### Prueba 5: Límite de Tamaño

**Pasos:**
1. Intentar adjuntar un archivo > 10MB
2. Verificar mensaje de error

**Resultado esperado:**
- ✅ Alert: "El archivo {nombre} excede el tamaño máximo de 10MB"
- ✅ Archivo NO se agrega a la lista

### Prueba 6: Tipos de Archivo Aceptados

**Probar con:**
- ✅ `.pdf` - Aceptado
- ✅ `.doc/.docx` - Aceptado
- ✅ `.txt` - Aceptado
- ✅ `.xlsx/.xls` - Aceptado
- ✅ `.csv` - Aceptado
- ✅ `.png/.jpg/.jpeg` - Aceptado
- ❌ `.exe/.zip/.rar` - Rechazado por el filtro de input

### Prueba 7: Nuevo Chat Limpia Archivos

**Pasos:**
1. Adjuntar archivos
2. Click en botón + (nuevo chat)
3. Verificar que archivos se limpian

**Resultado esperado:**
- ✅ Lista de archivos adjuntos se vacía
- ✅ Nuevo chat comienza limpio

---

## 🔍 Verificar en Storage

### Ver Archivos Subidos
```sql
-- En Supabase SQL Editor
SELECT
  name,
  size,
  created_at,
  owner
FROM storage.objects
WHERE bucket_id = 'assistant-files'
ORDER BY created_at DESC
LIMIT 10;
```

### Ver en Supabase Dashboard
1. Ir a Storage
2. Seleccionar bucket `assistant-files`
3. Ver carpetas por usuario (UUID)
4. Ver archivos subidos

---

## 🎯 Casos de Uso Reales

### Caso 1: Analizar un PDF de Póliza
```
Usuario:
- Adjunta: poliza_seguro.pdf
- Escribe: "¿Cuál es el monto de la prima?"

Asistente:
- Recibe archivo adjunto
- Puede indicar que necesita capacidad de leer PDF
- O responder basado en contexto general de pólizas
```

### Caso 2: Revisar Excel de Comisiones
```
Usuario:
- Adjunta: comisiones_enero.xlsx
- Escribe: "Analiza estas comisiones y dame un resumen"

Asistente:
- Recibe archivo
- Puede sugerir usar el módulo de comisiones
- O dar tips generales sobre análisis
```

### Caso 3: Compartir Imagen de Error
```
Usuario:
- Adjunta: screenshot_error.png
- Escribe: "¿Qué significa este error?"

Asistente:
- Recibe imagen
- Puede pedir descripción del error
- O ayudar basado en contexto
```

---

## 🐛 Debugging

### Logs en Consola del Navegador

Cuando subes archivo, deberías ver:
```
Uploading file to storage...
File uploaded: {user_id}/{filename}
Message sent with attachments
```

### Logs en Supabase Edge Function

En la función `assistant-send-message`:
```
User message saved successfully
Routing decision: { mode: "movi", ... }
```

### Errores Comunes

**Error: "Error al subir archivo"**
- Verificar RLS policies en storage
- Verificar que bucket existe
- Verificar autenticación del usuario

**Error: "No se pudo crear la conversación"**
- Verificar que usuario tiene conversación activa
- Verificar RLS en conversaciones_chatgpt

---

## 📊 Métricas de Éxito

Después de 10+ pruebas, deberías tener:

✅ **Upload rate:** 100% (todos los archivos válidos suben)
✅ **Storage organization:** Archivos en carpetas por usuario
✅ **UI responsive:** Lista de archivos se actualiza correctamente
✅ **Error handling:** Archivos grandes son rechazados
✅ **Cleanup:** Nuevo chat limpia archivos adjuntos

---

## 🚀 Próximos Pasos

Una vez que la funcionalidad básica funciona, considera:

1. **Procesamiento de Documentos:**
   - Integrar OCR para extraer texto de PDFs
   - Parsear Excel/CSV para análisis
   - Extraer metadatos de imágenes

2. **Mejoras de UX:**
   - Progress bar durante upload
   - Preview de imágenes
   - Vista previa de PDFs

3. **Gestión:**
   - Ver historial de archivos adjuntos
   - Descargar archivos anteriores
   - Eliminar archivos del storage

---

## ✅ Checklist Final

- [ ] Migración aplicada sin errores
- [ ] Bucket `assistant-files` creado
- [ ] RLS policies funcionando
- [ ] Botón 📎 visible en el asistente
- [ ] Puedo adjuntar 1 archivo
- [ ] Puedo adjuntar múltiples archivos
- [ ] Puedo eliminar archivos antes de enviar
- [ ] Archivos > 10MB son rechazados
- [ ] Solo tipos permitidos son aceptados
- [ ] Mensaje muestra lista de archivos
- [ ] Archivos aparecen en Storage
- [ ] Nuevo chat limpia archivos adjuntos

**Cuando todos estén ✅, la funcionalidad está lista!**
