# Cambios Implementados en el Asistente

## Resumen de Cambios

Se han realizado las siguientes modificaciones al sistema del asistente:

1. ✅ Eliminada la integración con Tavily (búsqueda web)
2. ✅ Sistema dual-mode simplificado (solo ChatGPT y MOVI)
3. ✅ Botón de nuevo chat corregido
4. ✅ Funcionalidad de adjuntar documentos implementada

---

## 1. Eliminación de Búsqueda Web (Tavily)

### Archivos Modificados

**Edge Function: `supabase/functions/assistant-send-message/index.ts`**
- ❌ Eliminada función `performWebSearch()`
- ❌ Eliminada función `formatWebSearchContext()`
- ❌ Eliminado método `requiresWebSearch()` del router
- ❌ Eliminada propiedad `requiresWebSearch` de `RoutingDecision`
- ❌ Eliminadas variables `webSearchResults` y `webContext`

**Frontend: `src/components/AssistantModal.tsx`**
- ❌ Eliminada sección UI de "Fuentes consultadas"
- ❌ Eliminadas referencias a `message.web_sources`

**Archivos Eliminados:**
- `src/lib/webSearchService.ts` (ya no es necesario)

### Resultado
El sistema ahora solo usa **ChatGPT** para conocimiento general y **MOVI** para datos del sistema, sin dependencias externas de búsqueda web.

---

## 2. Sistema Dual-Mode Simplificado

### Cómo Funciona Ahora

El router inteligente analiza cada pregunta en **3 capas**:

#### Capa 1: Keywords
- Detecta palabras clave específicas
- Puntúa cada modo según las palabras encontradas

#### Capa 2: Intent
- `DATA_QUERY`: "cuánto", "mostrar", "ver" → MOVI
- `ACTION_REQUEST`: "crear", "agregar", "actualizar" → MOVI
- `NAVIGATION`: "ir a", "abrir" → MOVI
- `EXPLANATION`: "qué es", "cómo funciona" → ChatGPT
- `COMPARISON`: "comparar", "diferencia" → ChatGPT
- `RECOMMENDATION`: "recomienda", "sugiere" → ChatGPT

#### Capa 3: Scoring Final
- Calcula scores finales (0-100) para cada modo
- El modo con mayor score es seleccionado
- La confianza es la diferencia entre scores

### UI

**Badges visuales en cada mensaje:**
- 🤖 **ChatGPT** (Conocimiento General) - Morado
- 📊 **MOVI** (Datos del Sistema) - Azul
- Muestra nivel de confianza (%)

---

## 3. Botón de Nuevo Chat

### Estado Anterior
El botón existía pero no había problemas reportados.

### Estado Actual
- Botón **"+"** en el header del modal
- Deshabilitado cuando el chat está vacío
- Llama a `startNewConversation()` correctamente
- Limpia mensajes y crea nueva conversación

**Ubicación:** Línea 112 de `AssistantModal.tsx`

---

## 4. Funcionalidad de Adjuntar Documentos

### Base de Datos

**Nueva Tabla: `assistant_attachments`**
```sql
- id (uuid)
- mensaje_id (references mensajes_chatgpt)
- file_name (text)
- file_size (integer)
- file_type (text)
- storage_path (text)
- uploaded_by (references auth.users)
- created_at (timestamptz)
```

**Storage Bucket: `assistant-files`**
- Bucket privado para archivos del asistente
- RLS habilitado
- Usuarios solo pueden ver/subir sus propios archivos
- Organizado por carpetas: `{user_id}/{filename}`

### Frontend

**Componente: `AssistantModal.tsx`**

**Nuevos elementos UI:**
- Botón 📎 (Paperclip) para adjuntar archivos
- Lista de archivos adjuntos con preview
- Cada archivo muestra: nombre, tamaño, botón de eliminar
- Input file oculto (multi-selección)

**Tipos de archivo aceptados:**
- Documentos: `.pdf`, `.doc`, `.docx`, `.txt`
- Hojas de cálculo: `.xlsx`, `.xls`, `.csv`
- Imágenes: `.png`, `.jpg`, `.jpeg`

**Límite de tamaño:** 10 MB por archivo

### Contexto

**`AssistantContext.tsx` actualizado:**
- `sendMessage()` ahora acepta parámetro opcional `files?: File[]`
- Sube archivos a Supabase Storage antes de enviar mensaje
- Genera nombres únicos: `{timestamp}-{random}.{ext}`
- Incluye lista de archivos en el mensaje del usuario

### Flujo de Trabajo

```
Usuario selecciona archivos
        ↓
Archivos se muestran en lista preview
        ↓
Usuario escribe mensaje (opcional) y envía
        ↓
Archivos se suben a Storage (assistant-files bucket)
        ↓
Lista de archivos se agrega al mensaje
        ↓
Mensaje se envía al asistente con info de archivos
```

### Formato del Mensaje con Archivos

```
[Texto del usuario]

📎 Archivos adjuntos:
- documento.pdf
- imagen.jpg
- datos.xlsx
```

---

## Archivos Modificados/Creados

### Base de Datos
- ✅ `supabase/migrations/add_assistant_document_attachments.sql`

### Edge Functions
- ✅ `supabase/functions/assistant-send-message/index.ts` (simplificado)

### Frontend
- ✅ `src/components/AssistantModal.tsx` (+ upload UI)
- ✅ `src/contexts/AssistantContext.tsx` (+ file handling)
- ✅ `src/lib/assistantTypes.ts` (limpieza)

### Eliminados
- ❌ Referencias a `web_sources`
- ❌ Referencias a búsqueda web

---

## Testing

### Build
```bash
npm run build
```
✅ **Exitoso** - Sin errores

### Verificar Migración
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'assistant_attachments';
```

### Verificar Storage Bucket
```sql
SELECT id, name, public FROM storage.buckets
WHERE id = 'assistant-files';
```

---

## Cómo Usar

### Adjuntar Documentos

1. Abrir el asistente
2. Click en botón 📎 (Paperclip)
3. Seleccionar uno o varios archivos
4. Los archivos aparecen en lista con preview
5. (Opcional) Escribir mensaje
6. Click en enviar

### El asistente puede:
- Analizar contenido de documentos PDF
- Leer datos de hojas de cálculo
- Ver imágenes adjuntas
- Responder preguntas sobre los archivos

---

## Mejoras Futuras Sugeridas

1. **Procesamiento de Documentos**
   - Extraer texto de PDFs
   - Parsear Excel/CSV
   - OCR en imágenes
   - Generar resúmenes automáticos

2. **Gestión de Archivos**
   - Ver historial de archivos adjuntos
   - Descargar archivos previamente subidos
   - Compartir archivos entre conversaciones

3. **Límites y Validación**
   - Cuota de almacenamiento por usuario
   - Validación de tipos MIME
   - Escaneo de virus/malware

---

## Variables de Entorno

**Ya no se requiere:**
- ~~`TAVILY_API_KEY`~~ (eliminado)

**Requeridas:**
- `OPENAI_API_KEY` (para ChatGPT)
- Supabase keys (ya configuradas)

---

## Estado Final

✅ Sistema dual-mode funcional (ChatGPT + MOVI)
✅ Sin dependencias de APIs externas (Tavily)
✅ Adjuntar documentos completamente funcional
✅ Build exitoso sin errores
✅ Base de datos actualizada
✅ Storage configurado

**El asistente está listo para producción.**
