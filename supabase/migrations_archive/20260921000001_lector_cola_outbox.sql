/*
  # Cola del lector como bandeja de salida (outbox)

  `lector_cola_entrenamiento` ya guardaba los PDFs que el extractor no pudo leer,
  pero nadie los mandaba a ningún lado: el supuesto era que el equipo del lector
  leería la tabla directamente, cosa que su RLS nunca permitió (no hay política
  para `anon`). Ahora existe un endpoint HTTP y la tabla pasa a ser la bandeja de
  salida que alimenta a `enviar-cola-lector`.

  `estado` ('pendiente'|'procesado') NO se toca: describe si el equipo del lector
  ya catalogó el PDF de su lado. Lo que se agrega aquí es el estado de ENVÍO, que
  es un concepto distinto — un PDF puede estar enviado y todavía sin catalogar.
*/

ALTER TABLE public.lector_cola_entrenamiento
  ADD COLUMN IF NOT EXISTS enviado_en         timestamptz,
  -- ticket_id exacto que se mandó al lector (folio, o folio-N en envíos posteriores
  -- del mismo trámite). Se guarda para trazabilidad y para calcular el sufijo siguiente.
  ADD COLUMN IF NOT EXISTS ticket_id_enviado  text,
  ADD COLUMN IF NOT EXISTS intentos           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_envio        text;

-- Índice de la consulta que drena la cola: solo filas sin enviar.
CREATE INDEX IF NOT EXISTS idx_lector_cola_pendiente_envio
  ON public.lector_cola_entrenamiento(ticket_id)
  WHERE enviado_en IS NULL;

/*
  Cron cada 5 minutos → edge function `enviar-cola-lector`.

  IMPORTANTE — el JWT service_role NO se versiona (lo detecta gitleaks). Esta
  migración lo toma de una GUC de sesión que hay que definir ANTES de correrla:

      set local app.lector_cron_service_key = '<JWT_service_role>';
      -- y luego corre este archivo

  Si la GUC no está definida, el cron NO se programa (no-op con NOTICE) para no
  dejar una tarea corriendo con un token inválido.
*/
DO $$
DECLARE
  v_key text := current_setting('app.lector_cron_service_key', true);
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-cola-lector') THEN
    PERFORM cron.unschedule('enviar-cola-lector');
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'app.lector_cron_service_key no definida; el cron enviar-cola-lector NO se programó. Para programarlo: set local app.lector_cron_service_key = ''<JWT_service_role>''; y re-corre este archivo.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'enviar-cola-lector',
    '*/5 * * * *',
    format(
      $q$SELECT net.http_post(
        url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/enviar-cola-lector',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || %L),
        body := '{"source": "cron"}'::jsonb
      ) as request_id;$q$,
      v_key
    )
  );
END $$;
