-- Eventos de Marketing Premium configurables de verdad.
--
-- `mkt_premium_eventos` ya era una tabla, pero sus cuatro filas eran las únicas
-- que podían dispararse: el código decidía a mano cuál emitir comparando el
-- antes y el después del Premium de un agente (`detectarEventos`). Una fila
-- nueva creada desde la pantalla habría quedado **inerte** — se podía configurar
-- una regla para ella y no se iba a disparar nunca, sin error ni aviso.
--
-- Para que crear un evento signifique algo, el evento tiene que decir QUÉ
-- observa. Con estas dos columnas, `detectarEventos` deja de tener la lista
-- escrita adentro y pasa a leerla de aquí.

ALTER TABLE public.mkt_premium_eventos
  ADD COLUMN IF NOT EXISTS disparador_tipo text NOT NULL DEFAULT 'cambio_campo',
  ADD COLUMN IF NOT EXISTS campos_observados text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mkt_premium_eventos_disparador_check'
  ) THEN
    ALTER TABLE public.mkt_premium_eventos
      ADD CONSTRAINT mkt_premium_eventos_disparador_check
      CHECK (disparador_tipo IN ('activacion', 'desactivacion', 'cambio_campo'));
  END IF;
END $$;

COMMENT ON COLUMN public.mkt_premium_eventos.disparador_tipo IS
  'Qué momento observa: activacion (el Premium se prende), desactivacion (se apaga) o cambio_campo (cambió alguno de campos_observados estando activo).';

COMMENT ON COLUMN public.mkt_premium_eventos.campos_observados IS
  'Solo para disparador_tipo = cambio_campo. Columnas de `usuarios` que se vigilan; basta que cambie UNA. Vacío = no dispara nunca.';

-- ─── Los cuatro de siempre, descritos con el modelo nuevo ────────────────────
-- Se conserva exactamente el comportamiento que tenían escrito en el código.

UPDATE public.mkt_premium_eventos
SET disparador_tipo = 'activacion', campos_observados = '{}'
WHERE key = 'activacion';

UPDATE public.mkt_premium_eventos
SET disparador_tipo = 'desactivacion', campos_observados = '{}'
WHERE key = 'desactivacion';

UPDATE public.mkt_premium_eventos
SET disparador_tipo = 'cambio_campo', campos_observados = ARRAY['mkt_premium_metodo_pago']
WHERE key = 'cambio_metodo_pago';

-- "Se actualizan plan/fechas/parcialidades" era un cajón de sastre: vigilaba
-- cuatro columnas a la vez. Se conserva igual; si algún día se quiere separar
-- "cambió la fecha de pago" como evento propio, ya se puede crear desde la
-- pantalla y quitarle esa columna a éste.
UPDATE public.mkt_premium_eventos
SET disparador_tipo = 'cambio_campo',
    campos_observados = ARRAY[
      'mkt_premium_plan',
      'mkt_premium_fecha_inicio',
      'mkt_premium_fecha_pago',
      'mkt_premium_parcialidades'
    ]
WHERE key = 'actualizacion';
