/*
  # Helper: Función para enviar correos con adjuntos

  1. Nueva Función
    - send_email_with_attachments: Envía correo con soporte para adjuntos
    - Acepta URLs de Supabase Storage o rutas de storage
    
  2. Uso
    - Simplifica el envío de correos desde triggers y funciones
    - Automáticamente descarga y adjunta archivos
*/

CREATE OR REPLACE FUNCTION send_email_with_attachments(
  p_to_email text,
  p_subject text,
  p_html_body text,
  p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_response jsonb;
  v_request_payload jsonb;
BEGIN
  -- Construir payload
  v_request_payload := jsonb_build_object(
    'to_email', p_to_email,
    'subject', p_subject,
    'html_body', p_html_body
  );

  -- Agregar adjuntos si existen
  IF p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0 THEN
    v_request_payload := v_request_payload || jsonb_build_object('attachments', p_attachments);
  END IF;

  -- Llamar a la edge function
  SELECT content::jsonb INTO v_response
  FROM http((
    'POST',
    current_setting('app.settings.supabase_url') || '/functions/v1/enviar-correo-transaccional',
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key'))
    ],
    'application/json',
    v_request_payload::text
  )::http_request);

  RETURN v_response;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error enviando correo con adjuntos: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION send_email_with_attachments IS 
  'Envía correo electrónico con soporte para adjuntos desde Supabase Storage';

-- Ejemplo de uso:
-- SELECT send_email_with_attachments(
--   'usuario@ejemplo.com',
--   'Documento adjunto',
--   '<p>Hola, te enviamos el documento solicitado.</p>',
--   '[{"filename": "documento.pdf", "storage_path": "documentos/archivo.pdf"}]'::jsonb
-- );
