-- Revision diaria automatica de Reportes de Bug: bucket privado donde la edge
-- function bug-reports-daily-digest sube el .md generado (con los trámites ya
-- cerrados anotados), + cron que la dispara una vez al día.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bug-reports-digest', 'bug-reports-digest', false, 10485760, ARRAY['text/markdown', 'text/plain'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins pueden leer el digest de reportes de bug" ON storage.objects;
CREATE POLICY "Admins pueden leer el digest de reportes de bug"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bug-reports-digest' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

-- El cron corre con service_role (bypassa RLS) - esta politica es solo por si un
-- admin quisiera subir/reemplazar el archivo a mano desde el Storage de Supabase.
DROP POLICY IF EXISTS "Admins pueden subir el digest de reportes de bug" ON storage.objects;
CREATE POLICY "Admins pueden subir el digest de reportes de bug"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bug-reports-digest' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

DROP POLICY IF EXISTS "Admins pueden actualizar el digest de reportes de bug" ON storage.objects;
CREATE POLICY "Admins pueden actualizar el digest de reportes de bug"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'bug-reports-digest' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

-- Cron diario 6:00am (hora del servidor) que dispara la edge function de digest.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bug-reports-daily-digest') THEN
    PERFORM cron.unschedule('bug-reports-daily-digest');
  END IF;
END $$;

SELECT cron.schedule(
  'bug-reports-daily-digest',
  '0 6 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url' LIMIT 1)
              || '/functions/v1/bug-reports-daily-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'service_role_key' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
