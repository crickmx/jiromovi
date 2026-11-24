/*
  # Sección de sistema "Personas y Asignación"

  Hoy el bloque "Personas Involucradas" que se ve al crear un trámite NO es una
  sección: es un agrupamiento dibujado a mano en `NuevoTramiteModal.tsx`, y solo
  funciona mientras esos campos no estén asignados a ninguna sección. Si un admin
  les asigna una, el grupo se deshace. En el detalle del trámite ni siquiera
  existe ese agrupamiento — hay un bloque estático aparte, escrito por separado.

  Esta migración lo convierte en dato: una sección real, sembrada en todos los
  tipos, que agrupa las tres personas del trámite más el contexto que el sistema
  asigna solo (área, equipo y oficina).

  Decisiones de producto (Ricardo, 2026-09-25):
  - La sección existe SIEMPRE y no se puede borrar, ni sacarle sus campos.
  - Pero sí se puede renombrar y mover de posición, por si un tipo la quiere abajo.

  Nota de diseño: NO se toca `create_all_sistema_campos()`. Esa función se
  reescribe entera en cada migración que la extiende, y en este proyecto la
  versión viva suele diferir de la del repo (pasó con `ejecutar_recurrencias`).
  Un trigger propio consigue lo mismo sin ese riesgo.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Marcar secciones de sistema
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.tramite_tipo_secciones
  ADD COLUMN IF NOT EXISTS sistema_key text;

COMMENT ON COLUMN public.tramite_tipo_secciones.sistema_key IS
  'No nulo = sección de sistema: no se borra ni se le sacan campos. Renombrarla y moverla sí se permite.';

-- Una sola sección de sistema por clave y por tipo. Es lo que hace idempotente a
-- ensure_sistema_seccion(), igual que idx_sistema_campos_unique para los campos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sistema_secciones_unique
  ON public.tramite_tipo_secciones(tramite_tipo_id, sistema_key)
  WHERE sistema_key IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Sembrado idempotente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_seccion_personas(p_tipo_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_seccion_id uuid;
BEGIN
  SELECT id INTO v_seccion_id
    FROM tramite_tipo_secciones
   WHERE tramite_tipo_id = p_tipo_id AND sistema_key = 'personas_asignacion';

  IF v_seccion_id IS NULL THEN
    INSERT INTO tramite_tipo_secciones (tramite_tipo_id, nombre, descripcion, orden, opcional, activo, sistema_key)
    VALUES (p_tipo_id, 'Personas y Asignación',
            'Quién solicita, quién registra y quién atiende este trámite.',
            0, false, true, 'personas_asignacion')
    RETURNING id INTO v_seccion_id;
  END IF;

  -- Los campos se mueven a la sección solo si no están ya ahí. No se fuerza el
  -- `orden` de cada uno: dentro de la sección se pueden reordenar libremente.
  UPDATE tramite_tipo_campos
     SET seccion_id = v_seccion_id
   WHERE tramite_tipo_id = p_tipo_id
     AND sistema_key IN ('agente_vendedor', 'creado_por', 'asignado_a', 'area', 'equipo', 'oficina_jiro')
     AND (seccion_id IS DISTINCT FROM v_seccion_id);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tipos nuevos
-- ─────────────────────────────────────────────────────────────────────────────
/*
  El nombre importa: Postgres dispara los AFTER triggers en orden alfabético, y
  este tiene que correr DESPUÉS de `trigger_create_sistema_campos` — si corriera
  antes, los campos que busca todavía no existirían. La "z" lo garantiza.
*/
CREATE OR REPLACE FUNCTION public.trg_ensure_seccion_personas()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM ensure_seccion_personas(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_z_ensure_seccion_personas ON public.ticket_tipos;
CREATE TRIGGER trigger_z_ensure_seccion_personas
  AFTER INSERT ON public.ticket_tipos
  FOR EACH ROW EXECUTE FUNCTION public.trg_ensure_seccion_personas();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tipos que ya existen
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Sin filtrar por `activo`: los 11 tipos Legacy que se dieron de baja el
  2026-09-23 siguen abriéndose en el detalle con sus trámites históricos, y
  dejarlos fuera los descuadraría respecto al resto.
*/
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM ticket_tipos LOOP
    PERFORM ensure_seccion_personas(r.id);
  END LOOP;
END $$;
