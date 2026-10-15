-- Folio único del Premium contratado, como el folio de Orden de Compra de Store.
--
-- En MOVI Store un pedido nace con `folio_oc`, y todos los trámites que ese
-- pedido dispara llevan el mismo folio: es lo que permite reconocer de un
-- vistazo que pertenecen al mismo cobro. En Marketing no había nada equivalente
-- — el comprobante se nombraba con el folio del TRÁMITE, así que dos trámites
-- del mismo Premium quedaban sin nada que los relacionara.
--
-- El equivalente del "pedido" aquí es el **Premium contratado**: se genera al
-- activarlo y lo comparten todos los trámites y comprobantes de ese periodo.
-- Si se desactiva y se vuelve a activar, es otra contratación y otro folio.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS mkt_premium_folio text;

COMMENT ON COLUMN public.usuarios.mkt_premium_folio IS
  'Folio único del Premium contratado, equivalente a store_pedidos.folio_oc. Se genera al activar y lo comparten todos los trámites de ese periodo.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_mkt_premium_folio
  ON public.usuarios(mkt_premium_folio) WHERE mkt_premium_folio IS NOT NULL;

-- Mismo formato y mismo mecanismo que `generar_folio_oc()`: 8 caracteres
-- alfanuméricos, reintentando si choca. El prefijo lo distingue de un folio de
-- pedido a simple vista.
CREATE OR REPLACE FUNCTION public.generar_folio_premium()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  folio text;
  existe boolean;
  intentos integer := 0;
BEGIN
  LOOP
    folio := 'MKT-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM usuarios WHERE mkt_premium_folio = folio) INTO existe;
    EXIT WHEN NOT existe;

    intentos := intentos + 1;
    IF intentos >= 100 THEN
      RAISE EXCEPTION 'No se pudo generar un folio de Premium único después de 100 intentos';
    END IF;
  END LOOP;
  RETURN folio;
END $$;

-- Los Premium que ya están activos no tienen folio. Se les asigna uno para que
-- sus trámites futuros lo lleven, en vez de quedarse sin referencia para siempre.
UPDATE public.usuarios
SET mkt_premium_folio = public.generar_folio_premium()
WHERE plan_mkt_premium IS TRUE AND mkt_premium_folio IS NULL;
