/*
  # Sección de sistema "Header" + fondo configurable del encabezado

  El encabezado de un trámite (área, nombre, folio, estatus) hoy se pinta con un
  color sólido que sale de `ticket_tipos.color`, y el color del texto se calcula
  por luminancia para que siempre se lea. Eso no aparece por ningún lado en el
  FormBuilder, así que no se puede configurar ni se entiende que existe.

  Esta migración lo convierte en una sección de sistema más — igual que
  "Personas y Asignación" — con su fondo configurable: color, degradado o imagen.
  El campo Estatus vive ahí, que es donde realmente se muestra y se cambia.

  Decisiones de producto (Ricardo, 2026-09-25):
  - Solo el fondo es configurable; el contenido del encabezado no cambia.
  - Con degradado o imagen se aplica un velo oscuro automático y texto blanco.
    Con color sólido se conserva el cálculo de luminancia actual, para que los
    tipos existentes se sigan viendo exactamente igual.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Config libre por sección
-- ─────────────────────────────────────────────────────────────────────────────
/*
  `config` genérico en vez de columnas sueltas de fondo: solo la sección header
  las usa hoy, y meterlas como columnas dejaría seis campos NULL en todas las
  demás. Forma esperada:
    { "fondo": { "tipo": "color"|"degradado"|"imagen",
                 "color": "#DB2777", "color2": "#7C3AED", "angulo": 135,
                 "imagen_url": "https://..." } }
*/
ALTER TABLE public.tramite_tipo_secciones
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Sembrado idempotente de la sección header
-- ─────────────────────────────────────────────────────────────────────────────
/*
  `orden = -1` la deja siempre antes de "Personas y Asignación" (orden 0). El
  encabezado va primero por definición, así que el frontend tampoco deja moverla.
  El fondo inicial replica el color que el tipo ya tenía, para que nada cambie
  de aspecto hasta que alguien lo edite a propósito.
*/
CREATE OR REPLACE FUNCTION public.ensure_seccion_header(p_tipo_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_seccion_id uuid;
  v_color      text;
BEGIN
  SELECT color INTO v_color FROM ticket_tipos WHERE id = p_tipo_id;

  SELECT id INTO v_seccion_id
    FROM tramite_tipo_secciones
   WHERE tramite_tipo_id = p_tipo_id AND sistema_key = 'header';

  IF v_seccion_id IS NULL THEN
    INSERT INTO tramite_tipo_secciones
      (tramite_tipo_id, nombre, descripcion, orden, opcional, activo, sistema_key, config)
    VALUES
      (p_tipo_id, 'Encabezado',
       'Lo que se ve arriba del trámite: área, nombre, folio y estatus.',
       -1, false, true, 'header',
       jsonb_build_object('fondo', jsonb_build_object('tipo', 'color', 'color', COALESCE(v_color, '#6B7280'))))
    RETURNING id INTO v_seccion_id;
  END IF;

  -- El estatus se muestra y se cambia en el encabezado, así que ahí pertenece.
  UPDATE tramite_tipo_campos
     SET seccion_id = v_seccion_id
   WHERE tramite_tipo_id = p_tipo_id
     AND sistema_key = 'estatus'
     AND (seccion_id IS DISTINCT FROM v_seccion_id);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tipos nuevos — se engancha al mismo trigger que ya siembra la otra sección
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_ensure_seccion_personas()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM ensure_seccion_header(NEW.id);
  PERFORM ensure_seccion_personas(NEW.id);
  RETURN NEW;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tipos que ya existen
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM ticket_tipos LOOP
    PERFORM ensure_seccion_header(r.id);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Bucket público para las imágenes de fondo
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Público a propósito: son imágenes decorativas sin datos sensibles, y evita
  tener que firmar URLs que caducan cada vez que se pinta un encabezado.
*/
INSERT INTO storage.buckets (id, name, public)
VALUES ('tramite-headers', 'tramite-headers', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tramite_headers_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "tramite_headers_admin_write"  ON storage.objects;
DROP POLICY IF EXISTS "tramite_headers_admin_delete" ON storage.objects;

CREATE POLICY "tramite_headers_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'tramite-headers');

-- Solo Administrador sube o borra: el catálogo de tipos ya es admin-only.
CREATE POLICY "tramite_headers_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tramite-headers' AND get_my_rol() = 'Administrador');

CREATE POLICY "tramite_headers_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tramite-headers' AND get_my_rol() = 'Administrador');
