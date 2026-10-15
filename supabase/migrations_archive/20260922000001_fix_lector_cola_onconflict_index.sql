/*
  # Fix: ON CONFLICT (archivo_id) no coincidía con el índice parcial

  El índice único de lector_cola_entrenamiento(archivo_id) se creó con
  WHERE archivo_id IS NOT NULL (parcial). Postgres exige que un
  ON CONFLICT (archivo_id) sin cláusula WHERE coincida con un índice
  único NO parcial -- si no, tira 42P10 "no unique or exclusion
  constraint matching the ON CONFLICT specification".

  El upsert de process-poliza-pdf/index.ts nunca revisó ese error (await
  sin capturar {error}), así que cada PDF fallido se perdía en silencio
  sin llegar a la cola de entrenamiento.

  Fix: índice único normal (sin WHERE). Un índice único estándar ya
  trata cada NULL como distinto entre sí, así que sigue permitiendo
  múltiples filas con archivo_id NULL -- mismo comportamiento que el
  parcial, pero compatible con ON CONFLICT (archivo_id).
*/

DROP INDEX IF EXISTS public.idx_lector_cola_archivo;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lector_cola_archivo
  ON public.lector_cola_entrenamiento(archivo_id);
