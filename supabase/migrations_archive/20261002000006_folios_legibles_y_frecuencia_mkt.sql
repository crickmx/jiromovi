-- Folios que se leen, se dictan y dicen de qué son.
--
-- Antes un folio era `A7F2K9` y nada más: no decía si era un servicio o unos
-- artículos, ni de quién era, ni cuántos iban. Ahora:
--
--   MKTPRMM-00042-CAP-RJR     Marketing Premium (servicio)
--   ARTMKT-00118-POL-MGL      Artículos de MOVI Store
--
--   prefijo   qué es
--   00042     consecutivo propio de cada tipo
--   CAP       3 letras de la oficina (Cápita)
--   RJR       iniciales del agente (Ricardo Jiménez Rodríguez)
--
-- Los `folio_oc` que ya existen NO se tocan: un folio ya impreso, adjuntado a un
-- trámite o dicho por teléfono no debe cambiar nunca. Los de Marketing sí se
-- rehacen — la columna se agregó hoy y nadie la ha visto todavía.

-- ── Piezas del folio ────────────────────────────────────────────────────────

-- Sin acentos y sin nada que no sea letra o espacio: un folio con "Ñ" o "Á" se
-- rompe al dictarlo, al buscarlo y al ponerlo en el nombre de un archivo.
CREATE OR REPLACE FUNCTION public.folio_normaliza(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(regexp_replace(
    translate(coalesce(p_texto, ''),
      'áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛäëïöÄËÏÖçÇ',
      'aeiouunAEIOUUNaeiouAEIOUaeiouAEIOUaeioAEIOcC'),
    '[^A-Za-z ]', '', 'g'));
$$;

/** Primeras N letras de un texto, rellenando con X si no alcanzan. */
CREATE OR REPLACE FUNCTION public.folio_siglas(p_texto text, p_largo integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT rpad(
    substring(replace(public.folio_normaliza(p_texto), ' ', '') from 1 for p_largo),
    p_largo, 'X');
$$;

/** Inicial del nombre y de cada apellido, máximo 3. */
CREATE OR REPLACE FUNCTION public.folio_iniciales(p_nombre text, p_apellidos text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  palabra text;
  res text := '';
BEGIN
  FOREACH palabra IN ARRAY regexp_split_to_array(
    trim(public.folio_normaliza(coalesce(p_nombre, '') || ' ' || coalesce(p_apellidos, ''))), '\s+')
  LOOP
    IF palabra <> '' THEN
      res := res || substring(palabra from 1 for 1);
    END IF;
    EXIT WHEN length(res) >= 3;
  END LOOP;
  RETURN rpad(res, 3, 'X');
END $$;

/** Arma el folio completo con los datos del agente al que se le va a cobrar. */
CREATE OR REPLACE FUNCTION public.folio_legible(p_prefijo text, p_consecutivo bigint, p_usuario_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u record;
BEGIN
  SELECT us.nombre, us.apellidos, o.nombre AS oficina
    INTO u
    FROM usuarios us
    LEFT JOIN oficinas o ON o.id = us.oficina_id
   WHERE us.id = p_usuario_id;

  RETURN p_prefijo
      || '-' || lpad(p_consecutivo::text, 5, '0')
      || '-' || folio_siglas(coalesce(u.oficina, 'SIN'), 3)
      || '-' || folio_iniciales(u.nombre, u.apellidos);
END $$;

-- ── Consecutivos, uno por tipo ──────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.folio_mktprmm_seq;
CREATE SEQUENCE IF NOT EXISTS public.folio_artmkt_seq;

-- ── Marketing Premium ───────────────────────────────────────────────────────

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS mkt_premium_folio text;

-- Cada cuánto se descuenta. Sale del MISMO catálogo que usa Store
-- (`store_frecuencias_pago`), no de una lista aparte que se desincronice.
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS mkt_premium_frecuencia_pago text;

COMMENT ON COLUMN public.usuarios.mkt_premium_frecuencia_pago IS
  'Cada cuánto se aplica el descuento (nombre de store_frecuencias_pago). Vacío = la del plan.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_mkt_premium_folio
  ON public.usuarios(mkt_premium_folio) WHERE mkt_premium_folio IS NOT NULL;

-- La versión sin argumentos daba folios aleatorios; ahora hace falta saber de
-- quién es el folio para poder escribir su oficina y sus iniciales.
DROP FUNCTION IF EXISTS public.generar_folio_premium();

CREATE OR REPLACE FUNCTION public.generar_folio_premium(p_usuario_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  folio text;
  intentos integer := 0;
BEGIN
  LOOP
    folio := folio_legible('MKTPRMM', nextval('folio_mktprmm_seq'), p_usuario_id);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM usuarios WHERE mkt_premium_folio = folio);
    intentos := intentos + 1;
    IF intentos >= 100 THEN
      RAISE EXCEPTION 'No se pudo generar un folio de Premium único después de 100 intentos';
    END IF;
  END LOOP;
  RETURN folio;
END $$;

-- ── MOVI Store ──────────────────────────────────────────────────────────────

-- Convive con `generar_folio_oc()` sin argumentos: esa se queda intacta para no
-- romper nada que todavía la llame. La nueva es la que usa la app.
CREATE OR REPLACE FUNCTION public.generar_folio_oc(p_usuario_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  folio text;
  intentos integer := 0;
BEGIN
  LOOP
    folio := folio_legible('ARTMKT', nextval('folio_artmkt_seq'), p_usuario_id);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM store_pedidos WHERE folio_oc = folio);
    intentos := intentos + 1;
    IF intentos >= 100 THEN
      RAISE EXCEPTION 'No se pudo generar un folio de OC único después de 100 intentos';
    END IF;
  END LOOP;
  RETURN folio;
END $$;

-- ── Los Premium activos estrenan folio ──────────────────────────────────────
-- Incluye los `MKT-XXXXXX` de la migración anterior: se generaron hoy y nadie
-- los ha visto. Los `folio_oc` de Store no se tocan.
UPDATE public.usuarios
SET mkt_premium_folio = public.generar_folio_premium(id)
WHERE plan_mkt_premium IS TRUE
  AND (mkt_premium_folio IS NULL OR mkt_premium_folio LIKE 'MKT-%');
