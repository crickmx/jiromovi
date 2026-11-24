-- Comprobante adjunto por pago del Plan Premium.
--
-- Registrar el monto no prueba nada: el comprobante es lo que sostiene la
-- revisión. Se guarda en un bucket **privado** —son documentos de pago de
-- personas— y la pantalla genera una URL firmada para verlo.
--
-- El archivo NO se borra al borrar el pago, a propósito: la bitácora existe
-- justo para poder revisar después, y un rastro sin su comprobante vale la
-- mitad. Quedan huérfanos en el bucket; es barato y es el lado correcto del
-- error.

ALTER TABLE public.mkt_premium_pagos
  ADD COLUMN IF NOT EXISTS comprobante_path   text,
  ADD COLUMN IF NOT EXISTS comprobante_nombre text;

COMMENT ON COLUMN public.mkt_premium_pagos.comprobante_path IS
  'Ruta dentro del bucket privado `mkt-premium-comprobantes`. Para verlo se genera una URL firmada; el bucket no es público.';

-- ─── Bucket privado ──────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('mkt-premium-comprobantes', 'mkt-premium-comprobantes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "mkt_comprobantes_read"   ON storage.objects;
DROP POLICY IF EXISTS "mkt_comprobantes_write"  ON storage.objects;
DROP POLICY IF EXISTS "mkt_comprobantes_delete" ON storage.objects;

-- Lo ve quien administra Marketing, y el dueño de su propio comprobante. La
-- ruta empieza con el id del agente, por eso se compara contra la primera
-- carpeta del nombre del archivo.
CREATE POLICY "mkt_comprobantes_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mkt-premium-comprobantes'
    AND (public.mkt_puede_administrar() OR (storage.foldername(name))[1] = auth.uid()::text)
  );

CREATE POLICY "mkt_comprobantes_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mkt-premium-comprobantes' AND public.mkt_puede_administrar());

-- Borrar se permite solo para limpiar un archivo cuyo pago nunca llegó a
-- guardarse (la pantalla lo hace si el insert falla tras subirlo).
CREATE POLICY "mkt_comprobantes_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mkt-premium-comprobantes' AND public.mkt_puede_administrar());
