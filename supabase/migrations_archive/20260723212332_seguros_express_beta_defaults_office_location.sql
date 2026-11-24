-- seguros.express:
-- 1) Los usuarios Beta existentes y nuevos comienzan habilitados.
-- 2) La habilitacion sigue siendo individual y editable en cualquier ambiente.
-- 3) Si el usuario no definio una ubicacion propia, hereda la de su oficina.

ALTER TABLE public.oficinas
  ADD COLUMN IF NOT EXISTS ubicacion_lat numeric,
  ADD COLUMN IF NOT EXISTS ubicacion_lng numeric,
  ADD COLUMN IF NOT EXISTS ubicacion_updated_at timestamptz;

COMMENT ON COLUMN public.oficinas.ubicacion_lat IS
  'Latitud de respaldo para matching de seguros.express.';
COMMENT ON COLUMN public.oficinas.ubicacion_lng IS
  'Longitud de respaldo para matching de seguros.express.';

-- Permitir distinguir una ubicacion personal de la heredada de oficina.
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_ubicacion_metodo_check;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_ubicacion_metodo_check
  CHECK (ubicacion_metodo IS NULL OR ubicacion_metodo IN ('gps', 'manual', 'oficina'));

CREATE OR REPLACE FUNCTION public.express_aplicar_defaults_beta(p_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.usuarios u
  SET
    seguros_express_habilitado = true,
    ubicacion_lat = CASE
      WHEN u.ubicacion_metodo IS NULL THEN o.ubicacion_lat
      ELSE u.ubicacion_lat
    END,
    ubicacion_lng = CASE
      WHEN u.ubicacion_metodo IS NULL THEN o.ubicacion_lng
      ELSE u.ubicacion_lng
    END,
    ubicacion_direccion_manual = CASE
      WHEN u.ubicacion_metodo IS NULL THEN NULLIF(trim(o.domicilio), '')
      ELSE u.ubicacion_direccion_manual
    END,
    ubicacion_metodo = CASE
      WHEN u.ubicacion_metodo IS NULL
        AND (
          o.ubicacion_lat IS NOT NULL
          OR o.ubicacion_lng IS NOT NULL
          OR NULLIF(trim(o.domicilio), '') IS NOT NULL
        )
      THEN 'oficina'
      ELSE u.ubicacion_metodo
    END,
    ubicacion_updated_at = CASE
      WHEN u.ubicacion_metodo IS NULL
        AND (
          o.ubicacion_lat IS NOT NULL
          OR o.ubicacion_lng IS NOT NULL
          OR NULLIF(trim(o.domicilio), '') IS NOT NULL
        )
      THEN now()
      ELSE u.ubicacion_updated_at
    END,
    updated_at = now()
  FROM public.oficinas o
  WHERE u.id = p_usuario_id
    AND o.id = u.oficina_id;

  -- Usuarios sin oficina tambien deben iniciar habilitados.
  UPDATE public.usuarios
  SET seguros_express_habilitado = true, updated_at = now()
  WHERE id = p_usuario_id
    AND oficina_id IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.express_defaults_al_alta_beta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.express_aplicar_defaults_beta(NEW.usuario_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_express_defaults_al_alta_beta ON public.usuarios_beta;
CREATE TRIGGER trg_express_defaults_al_alta_beta
  AFTER INSERT ON public.usuarios_beta
  FOR EACH ROW
  EXECUTE FUNCTION public.express_defaults_al_alta_beta();

-- Mantener sincronizados solo a quienes aun usan el respaldo de oficina.
CREATE OR REPLACE FUNCTION public.express_sincronizar_ubicacion_oficina()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.usuarios
  SET
    ubicacion_lat = NEW.ubicacion_lat,
    ubicacion_lng = NEW.ubicacion_lng,
    ubicacion_direccion_manual = NULLIF(trim(NEW.domicilio), ''),
    ubicacion_updated_at = now(),
    updated_at = now()
  WHERE oficina_id = NEW.id
    AND ubicacion_metodo = 'oficina';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_express_sincronizar_ubicacion_oficina ON public.oficinas;
CREATE TRIGGER trg_express_sincronizar_ubicacion_oficina
  AFTER UPDATE OF domicilio, ubicacion_lat, ubicacion_lng ON public.oficinas
  FOR EACH ROW
  EXECUTE FUNCTION public.express_sincronizar_ubicacion_oficina();

-- La misma regla aplica a cualquier usuario habilitado manualmente, sin
-- importar si navega en Beta o Produccion. Una ubicacion personal gps/manual
-- nunca se reemplaza.
CREATE OR REPLACE FUNCTION public.express_preparar_ubicacion_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  oficina record;
BEGIN
  IF NOT COALESCE(NEW.seguros_express_habilitado, false)
    OR NEW.oficina_id IS NULL
    OR NEW.ubicacion_metodo IN ('gps', 'manual') THEN
    RETURN NEW;
  END IF;

  SELECT domicilio, ubicacion_lat, ubicacion_lng
  INTO oficina
  FROM public.oficinas
  WHERE id = NEW.oficina_id;

  IF FOUND THEN
    NEW.ubicacion_lat := oficina.ubicacion_lat;
    NEW.ubicacion_lng := oficina.ubicacion_lng;
    NEW.ubicacion_direccion_manual := NULLIF(trim(oficina.domicilio), '');
    IF oficina.ubicacion_lat IS NOT NULL
      OR oficina.ubicacion_lng IS NOT NULL
      OR NULLIF(trim(oficina.domicilio), '') IS NOT NULL THEN
      NEW.ubicacion_metodo := 'oficina';
      NEW.ubicacion_updated_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_express_preparar_ubicacion_usuario ON public.usuarios;
DROP TRIGGER IF EXISTS trg_express_preparar_ubicacion_usuario_insert ON public.usuarios;
DROP TRIGGER IF EXISTS trg_express_preparar_ubicacion_usuario_update ON public.usuarios;

CREATE TRIGGER trg_express_preparar_ubicacion_usuario_insert
  BEFORE INSERT ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.express_preparar_ubicacion_usuario();

CREATE TRIGGER trg_express_preparar_ubicacion_usuario_update
  BEFORE UPDATE OF seguros_express_habilitado, oficina_id ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.express_preparar_ubicacion_usuario();

-- Configuracion inicial para todos los Beta ya aprobados. Esto no crea una
-- dependencia permanente: despues el Admin puede deshabilitar a cualquiera.
DO $$
DECLARE
  beta record;
BEGIN
  FOR beta IN SELECT usuario_id FROM public.usuarios_beta LOOP
    PERFORM public.express_aplicar_defaults_beta(beta.usuario_id);
  END LOOP;
END;
$$;
