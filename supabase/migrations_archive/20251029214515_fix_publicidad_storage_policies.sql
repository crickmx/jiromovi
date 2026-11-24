/*
  # Corregir políticas de storage para publicidad-disenos
  
  1. Cambios
    - Eliminar política genérica "Sistema puede crear diseños"
    - Crear política específica que permite a usuarios subir solo en sus carpetas
    - Mantener política de lectura para todos los usuarios autenticados
  
  2. Seguridad
    - Los usuarios solo pueden subir diseños en su propia carpeta (usuario_id/)
    - Todos los usuarios autenticados pueden ver diseños (necesario para compartir)
*/

-- Eliminar política antigua si existe
DROP POLICY IF EXISTS "Sistema puede crear diseños" ON storage.objects;

-- Crear nueva política restrictiva para subir diseños
CREATE POLICY "Usuarios pueden subir sus propios diseños"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'publicidad-disenos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );