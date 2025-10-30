# Configurar Storage para Archivos del Chat

## Problema
El bucket `chat-files` existe pero no tiene políticas de RLS configuradas, lo que impide subir archivos.

## Solución

Ejecuta el siguiente SQL en el **SQL Editor** del Dashboard de Supabase:

```sql
-- ============================================
-- POLÍTICAS PARA BUCKET: chat-files
-- ============================================

-- 1. Política: INSERT - Usuarios autenticados pueden subir archivos
CREATE POLICY "Authenticated users can upload chat files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-files');

-- 2. Política: SELECT - Usuarios autenticados pueden ver archivos
CREATE POLICY "Authenticated users can view chat files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-files');

-- 3. Política: DELETE - Usuarios autenticados pueden eliminar archivos
CREATE POLICY "Authenticated users can delete chat files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-files');

-- 4. Política: UPDATE - Usuarios autenticados pueden actualizar archivos
CREATE POLICY "Authenticated users can update chat files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'chat-files')
  WITH CHECK (bucket_id = 'chat-files');
```

## Pasos

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el SQL de arriba
5. Click en **Run** o presiona `Ctrl + Enter`
6. Verifica que diga "Success. No rows returned"

## Verificación

Para verificar que las políticas se crearon correctamente:

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%chat files%'
ORDER BY policyname;
```

Deberías ver 4 políticas:
- Authenticated users can delete chat files (DELETE)
- Authenticated users can update chat files (UPDATE)
- Authenticated users can upload chat files (INSERT)
- Authenticated users can view chat files (SELECT)

## Después de Configurar

Una vez configuradas las políticas, podrás:
- ✅ Adjuntar archivos en el chat (click en 📎)
- ✅ Enviar imágenes, PDFs, documentos
- ✅ Ver archivos adjuntos en mensajes
- ✅ Descargar archivos del chat

## Solución Alternativa (Si lo anterior no funciona)

Si prefieres configurarlo desde la UI:

1. Ve a **Storage** en el Dashboard
2. Busca el bucket `chat-files`
3. Click en **Policies**
4. Click en **New Policy**
5. Crea 4 políticas con estos permisos:
   - **INSERT**: `authenticated` users, bucket_id = 'chat-files'
   - **SELECT**: `authenticated` users, bucket_id = 'chat-files'
   - **UPDATE**: `authenticated` users, bucket_id = 'chat-files'
   - **DELETE**: `authenticated` users, bucket_id = 'chat-files'
