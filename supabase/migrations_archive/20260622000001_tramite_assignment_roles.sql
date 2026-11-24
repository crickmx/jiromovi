/*
  # Tramite Assignment Modes & Team Roles

  ## Changes

  1. `ticket_tipos.assignment_mode`
     - 'direct': creator explicitly picks the responsable (existing behavior)
     - 'pool':   ticket is created unassigned; Mesa de Control / team members assign later
     - 'auto':   auto-assign from office `responsable_default_id`
     - Operaciones types default to 'pool' so tickets land in the unassigned queue.

  2. `tramites_grupos_miembros.rol_en_equipo`
     - 'lider':    can assign tramites to other team members
     - 'ejecutivo': can self-assign (take) unassigned tramites
     - 'miembro':  view only
     - Existing members default to 'ejecutivo'.

  3. Updated `get_grupo_miembros` RPC — returns `rol_en_equipo`.

  4. Notification trigger — on INSERT into tickets when assignment_mode='pool'
     and assigned_to_user_id IS NULL:
       • Notify all Operaciones group members (Mesa de Control)
       • Notify Admins not already in an Operaciones group
       • Notify the creator/agent about their ticket
*/

-- ── 1. assignment_mode ────────────────────────────────────────────────────────

ALTER TABLE ticket_tipos
  ADD COLUMN IF NOT EXISTS assignment_mode TEXT NOT NULL DEFAULT 'direct'
  CHECK (assignment_mode IN ('direct', 'pool', 'auto'));

COMMENT ON COLUMN ticket_tipos.assignment_mode IS
  'direct: creator picks responsable; pool: unassigned queue for Mesa de Control; auto: assign from office default';

-- Operations ticket types go to the unassigned pool by default
UPDATE ticket_tipos
  SET assignment_mode = 'pool'
  WHERE value IN (
    'solicitud_comisiones_pendientes',
    'correccion_comisiones',
    'registro_poliza',
    'correccion_poliza_registrada'
  );

-- ── 2. rol_en_equipo ─────────────────────────────────────────────────────────

ALTER TABLE tramites_grupos_miembros
  ADD COLUMN IF NOT EXISTS rol_en_equipo TEXT NOT NULL DEFAULT 'ejecutivo'
  CHECK (rol_en_equipo IN ('lider', 'ejecutivo', 'miembro'));

COMMENT ON COLUMN tramites_grupos_miembros.rol_en_equipo IS
  'lider: can assign to others; ejecutivo: can self-assign; miembro: view only';

-- ── 3. Updated get_grupo_miembros ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_grupo_miembros(uuid);

CREATE OR REPLACE FUNCTION public.get_grupo_miembros(p_grupo_id uuid)
RETURNS TABLE (
  id            uuid,
  nombre_completo text,
  oficina_nombre  text,
  rol             text,
  oficina_id      uuid,
  rol_en_equipo   text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.nombre_completo, UPPER(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellidos, ''))) AS nombre_completo,
    o.nombre  AS oficina_nombre,
    u.rol,
    u.oficina_id,
    m.rol_en_equipo
  FROM usuarios u
  INNER JOIN tramites_grupos_miembros m ON m.usuario_id = u.id
  LEFT  JOIN oficinas o ON o.id = u.oficina_id
  WHERE m.grupo_id = p_grupo_id
    AND u.estado   = 'activo'
  ORDER BY
    CASE m.rol_en_equipo WHEN 'lider' THEN 1 WHEN 'ejecutivo' THEN 2 ELSE 3 END,
    u.nombre_completo;
END;
$function$;

-- ── 4. Notification trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_ticket_created_unassigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment_mode text;
  v_tipo_label      text;
  v_agente_nombre   text;
  v_folio           text;
BEGIN
  IF TG_OP != 'INSERT' THEN RETURN NEW; END IF;

  SELECT assignment_mode, label INTO v_assignment_mode, v_tipo_label
  FROM ticket_tipos WHERE value = NEW.tipo_tramite;

  IF v_assignment_mode IS DISTINCT FROM 'pool'  THEN RETURN NEW; END IF;
  IF NEW.assigned_to_user_id IS NOT NULL         THEN RETURN NEW; END IF;

  v_folio := COALESCE(NEW.folio, 'Sin folio');

  SELECT nombre_completo INTO v_agente_nombre
  FROM usuarios WHERE id = NEW.agente_id;

  -- Notify all Operaciones group members (Mesa de Control)
  INSERT INTO notifications (user_id, title, body, link_url, is_read)
  SELECT DISTINCT
    gm.usuario_id,
    'Trámite Sin Asignar',
    'Nuevo ' || v_folio || ' — ' || COALESCE(v_tipo_label, NEW.tipo_tramite) ||
    '. Agente: ' || COALESCE(v_agente_nombre, 'Sin nombre') || '. Pendiente de asignación.',
    '/tramites',
    false
  FROM tramites_grupos_miembros gm
  JOIN tramites_grupos_visualizacion gv ON gm.grupo_id = gv.id
  WHERE gv.activo            = true
    AND gv.area_categoria    = 'Operaciones'
    AND gm.usuario_id IS DISTINCT FROM NEW.creado_por;

  -- Also notify Admins not already in an Operaciones group
  INSERT INTO notifications (user_id, title, body, link_url, is_read)
  SELECT
    u.id,
    'Trámite Sin Asignar',
    'Nuevo ' || v_folio || ' — ' || COALESCE(v_tipo_label, NEW.tipo_tramite) ||
    '. Agente: ' || COALESCE(v_agente_nombre, 'Sin nombre') || '. Pendiente de asignación.',
    '/tramites',
    false
  FROM usuarios u
  WHERE u.rol    = 'Administrador'
    AND u.estado = 'activo'
    AND u.id IS DISTINCT FROM NEW.creado_por
    AND NOT EXISTS (
      SELECT 1
      FROM tramites_grupos_miembros gm2
      JOIN tramites_grupos_visualizacion gv2 ON gm2.grupo_id = gv2.id
      WHERE gm2.usuario_id      = u.id
        AND gv2.area_categoria  = 'Operaciones'
    );

  -- Notify the creator about their ticket
  IF NEW.creado_por IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, link_url, is_read)
    VALUES (
      NEW.creado_por,
      'Trámite Iniciado',
      'Tu trámite ' || v_folio || ' fue iniciado correctamente. Pronto será asignado a un ejecutivo de Mesa de Control.',
      '/tramites',
      false
    );
  END IF;

  -- If agent is different from creator, notify the agent too
  IF NEW.agente_id IS NOT NULL AND NEW.agente_id IS DISTINCT FROM NEW.creado_por THEN
    INSERT INTO notifications (user_id, title, body, link_url, is_read)
    VALUES (
      NEW.agente_id,
      'Trámite Iniciado',
      'Tu trámite ' || v_folio || ' fue iniciado. Pronto será asignado a un ejecutivo de Mesa de Control.',
      '/tramites',
      false
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_ticket_created_unassigned ON tickets;

CREATE TRIGGER trg_notify_ticket_created_unassigned
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ticket_created_unassigned();
