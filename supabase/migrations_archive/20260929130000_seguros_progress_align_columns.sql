/*
  seguros_progress: alinear columnas con el código

  El frontend (On Demand, inicio de Seguros Education) y la edge function
  generate-welcome-message leen y escriben user_id / completado /
  tiempo_reproduccion / ultima_vista, pero la tabla tenía usuario_id /
  completada / tiempo_dedicado_minutos. Todas las lecturas y upserts fallaban
  (la tabla está vacía), así que el progreso de las lecciones nunca se guardó.

  Las políticas RLS y el UNIQUE (usuario_id, lesson_id) siguen a las columnas
  renombradas automáticamente.
*/

ALTER TABLE public.seguros_progress RENAME COLUMN usuario_id TO user_id;
ALTER TABLE public.seguros_progress RENAME COLUMN completada TO completado;

ALTER TABLE public.seguros_progress
  ADD COLUMN IF NOT EXISTS tiempo_reproduccion integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_vista timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.seguros_progress ALTER COLUMN completado SET DEFAULT false;
ALTER TABLE public.seguros_progress ALTER COLUMN progreso SET DEFAULT 0;

ALTER TABLE public.seguros_progress
  RENAME CONSTRAINT seguros_progress_usuario_id_lesson_id_key TO seguros_progress_user_id_lesson_id_key;
ALTER TABLE public.seguros_progress
  RENAME CONSTRAINT seguros_progress_usuario_id_fkey TO seguros_progress_user_id_fkey;
