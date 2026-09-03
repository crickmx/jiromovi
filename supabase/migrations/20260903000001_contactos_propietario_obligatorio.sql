/*
  # Mandatory agent and office ownership for CRM contacts

  Business rule:
  - Every CRM contact belongs to one agent and that agent's office.
  - New/manual contacts belong to their creator unless an agent is explicitly assigned.
  - When a lead or Seguwallet customer is assigned, its CRM contact follows that agent.
  - creado_por remains the audit field; agente_id is the current commercial owner.
*/

ALTER TABLE public.crm_contactos
  ADD COLUMN IF NOT EXISTS agente_id uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS oficina_id uuid REFERENCES public.oficinas(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_crm_contactos_agente_id
  ON public.crm_contactos (agente_id);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_oficina_id
  ON public.crm_contactos (oficina_id);

-- Prefer a current assignment over the historical creator when backfilling.
UPDATE public.crm_contactos c
SET agente_id = COALESCE(
      c.agente_id,
      (
        SELECT el.agente_asignado_id
        FROM public.express_leads el
        WHERE el.crm_contacto_id = c.id
          AND el.agente_asignado_id IS NOT NULL
        ORDER BY el.updated_at DESC NULLS LAST
        LIMIT 1
      ),
      (
        SELECT sw.agent_user_id
        FROM public.seguwallet_customers sw
        WHERE sw.crm_contact_id = c.id
          AND sw.agent_user_id IS NOT NULL
          AND sw.deleted_at IS NULL
        ORDER BY sw.updated_at DESC NULLS LAST
        LIMIT 1
      ),
      c.creado_por
    )
WHERE c.agente_id IS NULL;

UPDATE public.crm_contactos c
SET oficina_id = u.oficina_id
FROM public.usuarios u
WHERE u.id = c.agente_id
  AND c.oficina_id IS DISTINCT FROM u.oficina_id;

DO $$
DECLARE
  v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing
  FROM public.crm_contactos
  WHERE agente_id IS NULL OR oficina_id IS NULL;

  IF v_missing > 0 THEN
    RAISE EXCEPTION
      'No se puede activar propiedad obligatoria: % contacto(s) no tienen agente u oficina resoluble',
      v_missing;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_crm_contacto_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_oficina_id uuid;
BEGIN
  v_agent_id := COALESCE(NEW.agente_id, NEW.creado_por, auth.uid());

  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Todo contacto debe tener un agente relacionado';
  END IF;

  SELECT u.oficina_id
    INTO v_oficina_id
    FROM public.usuarios u
   WHERE u.id = v_agent_id
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El agente relacionado no existe: %', v_agent_id;
  END IF;

  IF v_oficina_id IS NULL THEN
    RAISE EXCEPTION 'El agente % no tiene una oficina relacionada', v_agent_id;
  END IF;

  NEW.agente_id := v_agent_id;
  NEW.oficina_id := v_oficina_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_contactos_owner ON public.crm_contactos;
CREATE TRIGGER trg_crm_contactos_owner
  BEFORE INSERT OR UPDATE OF agente_id, creado_por
  ON public.crm_contactos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_crm_contacto_owner();

CREATE OR REPLACE FUNCTION public.prevent_crm_contacto_creator_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.creado_por IS DISTINCT FROM OLD.creado_por THEN
    RAISE EXCEPTION 'El creador original del contacto no puede modificarse';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_contactos_creator_immutable ON public.crm_contactos;
CREATE TRIGGER trg_crm_contactos_creator_immutable
  BEFORE UPDATE OF creado_por
  ON public.crm_contactos
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_crm_contacto_creator_change();

ALTER TABLE public.crm_contactos
  ALTER COLUMN agente_id SET NOT NULL,
  ALTER COLUMN oficina_id SET NOT NULL;

-- Ownership drives access too. creado_por is retained only as immutable audit data.
DROP POLICY IF EXISTS "Usuarios solo ven sus propios contactos" ON public.crm_contactos;
CREATE POLICY "Usuarios solo ven sus propios contactos"
  ON public.crm_contactos FOR SELECT TO authenticated
  USING (agente_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios solo crean contactos propios" ON public.crm_contactos;
CREATE POLICY "Usuarios solo crean contactos propios"
  ON public.crm_contactos FOR INSERT TO authenticated
  WITH CHECK (agente_id = (SELECT auth.uid()) AND creado_por = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios actualizan sus propios contactos" ON public.crm_contactos;
DROP POLICY IF EXISTS "Usuarios solo actualizan sus propios contactos" ON public.crm_contactos;
CREATE POLICY "Usuarios actualizan sus propios contactos"
  ON public.crm_contactos FOR UPDATE TO authenticated
  USING (agente_id = (SELECT auth.uid()))
  WITH CHECK (agente_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Usuarios solo eliminan sus propios contactos" ON public.crm_contactos;
CREATE POLICY "Usuarios solo eliminan sus propios contactos"
  ON public.crm_contactos FOR DELETE TO authenticated
  USING (agente_id = (SELECT auth.uid()));

COMMENT ON COLUMN public.crm_contactos.agente_id IS
  'Agente comercial actual del contacto; puede cambiar por asignación del lead.';
COMMENT ON COLUMN public.crm_contactos.oficina_id IS
  'Oficina del agente comercial; se mantiene automáticamente.';

-- Keep an already-created CRM contact aligned with an Express lead assignment.
CREATE OR REPLACE FUNCTION public.sync_express_lead_contact_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.crm_contacto_id IS NOT NULL AND NEW.agente_asignado_id IS NOT NULL THEN
    UPDATE public.crm_contactos
       SET agente_id = NEW.agente_asignado_id,
           actualizado_en = now()
     WHERE id = NEW.crm_contacto_id
       AND agente_id IS DISTINCT FROM NEW.agente_asignado_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_express_lead_contact_owner ON public.express_leads;
CREATE TRIGGER trg_express_lead_contact_owner
  AFTER INSERT OR UPDATE OF agente_asignado_id, crm_contacto_id
  ON public.express_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_express_lead_contact_owner();

-- Keep linked Seguwallet contacts aligned with their assigned agent too.
CREATE OR REPLACE FUNCTION public.sync_seguwallet_contact_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.crm_contact_id IS NOT NULL AND NEW.agent_user_id IS NOT NULL THEN
    UPDATE public.crm_contactos
       SET agente_id = NEW.agent_user_id,
           actualizado_en = now()
     WHERE id = NEW.crm_contact_id
       AND agente_id IS DISTINCT FROM NEW.agent_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seguwallet_contact_owner ON public.seguwallet_customers;
CREATE TRIGGER trg_seguwallet_contact_owner
  AFTER INSERT OR UPDATE OF agent_user_id, crm_contact_id
  ON public.seguwallet_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_seguwallet_contact_owner();
