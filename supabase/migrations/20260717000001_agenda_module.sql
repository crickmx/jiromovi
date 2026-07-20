/*
  # Módulo de Agenda (agendamiento tipo Calendly) — Fase 1 MVP

  Cada usuario puede tener uno o varios calendarios (por marca/propósito), con
  tipos de cita (event types) configurables, disponibilidad recurrente +
  excepciones, y una página pública de reservas sin login. Videollamada con
  Jitsi Meet (gratuito, sin OAuth) — Google Meet queda para Fase 2.

  ## Seguridad
  - Todas las tablas tienen RLS: el dueño (`user_id = auth.uid()`) hace CRUD
    de su propia configuración. NO hay políticas de lectura para `anon`.
  - La página pública (sin sesión) nunca lee las tablas directamente: usa
    `agenda_public_get_event_type` (SECURITY DEFINER) para leer y
    `agenda_public_crear_reserva` (SECURITY DEFINER) para escribir, igual que
    ya hace `get_public_web_page_by_slug` con "Mi Página Web". La disponibilidad
    se revalida por completo dentro del RPC de creación — nunca se confía en
    el horario que manda el cliente.
  - `agenda_public_crear_reserva` toma un advisory lock por calendario
    (`pg_advisory_xact_lock`) para serializar reservas concurrentes del mismo
    calendario y evitar doble-booking por condición de carrera.
*/

-- ═══════════════════════════════════════════════════════════════
-- 1. Tablas
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agenda_calendarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  marca text,
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#2563eb',
  zona_horaria text NOT NULL DEFAULT 'America/Mexico_City',
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agenda_tipos_cita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES agenda_calendarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  slug text NOT NULL,
  descripcion text,
  color text,
  duracion_minutos int NOT NULL DEFAULT 30 CHECK (duracion_minutos > 0),
  buffer_antes_minutos int NOT NULL DEFAULT 0 CHECK (buffer_antes_minutos >= 0),
  buffer_despues_minutos int NOT NULL DEFAULT 0 CHECK (buffer_despues_minutos >= 0),
  anticipacion_minima_minutos int NOT NULL DEFAULT 60 CHECK (anticipacion_minima_minutos >= 0),
  limite_reservas_por_dia int CHECK (limite_reservas_por_dia IS NULL OR limite_reservas_por_dia > 0),
  modalidades text[] NOT NULL DEFAULT ARRAY['jitsi']::text[],
  direccion text,
  telefono_organizador text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_tipos_cita_slug_unico UNIQUE (user_id, slug),
  CONSTRAINT agenda_tipos_cita_modalidades_validas CHECK (
    modalidades <@ ARRAY['presencial','telefono','google_meet','jitsi']::text[]
    AND array_length(modalidades, 1) > 0
  )
);

CREATE TABLE IF NOT EXISTS agenda_disponibilidad_reglas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES agenda_calendarios(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_reglas_horario_valido CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS agenda_disponibilidad_excepciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES agenda_calendarios(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  todo_el_dia boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_excepcion_horario_valido CHECK (
    (todo_el_dia AND start_time IS NULL AND end_time IS NULL)
    OR (NOT todo_el_dia AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE TABLE IF NOT EXISTS agenda_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_cita_id uuid NOT NULL REFERENCES agenda_tipos_cita(id) ON DELETE CASCADE,
  calendario_id uuid NOT NULL REFERENCES agenda_calendarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  invitado_nombre text NOT NULL,
  invitado_email text NOT NULL,
  invitado_telefono text,
  invitado_notas text,
  modalidad text NOT NULL CHECK (modalidad IN ('presencial','telefono','google_meet','jitsi')),
  ubicacion_detalle text,
  meeting_url text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  zona_horaria_invitado text,
  status text NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada','reprogramada')),
  cancelado_en timestamptz,
  cancelado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_reservas_rango_valido CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_agenda_reservas_tipo_cita_rango ON agenda_reservas (tipo_cita_id, start_at);
CREATE INDEX IF NOT EXISTS idx_agenda_reservas_calendario_rango ON agenda_reservas (calendario_id, start_at);
CREATE INDEX IF NOT EXISTS idx_agenda_reservas_email_created ON agenda_reservas (invitado_email, created_at);

CREATE TABLE IF NOT EXISTS agenda_website_bloques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_cita_id uuid NOT NULL REFERENCES agenda_tipos_cita(id) ON DELETE CASCADE,
  visible boolean NOT NULL DEFAULT true,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_website_bloques_unico UNIQUE (user_id, tipo_cita_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 2. updated_at
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agenda_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_calendarios_updated_at ON agenda_calendarios;
CREATE TRIGGER trg_agenda_calendarios_updated_at
  BEFORE UPDATE ON agenda_calendarios
  FOR EACH ROW EXECUTE FUNCTION agenda_set_updated_at();

DROP TRIGGER IF EXISTS trg_agenda_tipos_cita_updated_at ON agenda_tipos_cita;
CREATE TRIGGER trg_agenda_tipos_cita_updated_at
  BEFORE UPDATE ON agenda_tipos_cita
  FOR EACH ROW EXECUTE FUNCTION agenda_set_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS — solo el dueño; la página pública usa los RPCs de abajo
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE agenda_calendarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_tipos_cita ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_disponibilidad_reglas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_disponibilidad_excepciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_website_bloques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_calendarios_owner_all" ON agenda_calendarios FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "agenda_tipos_cita_owner_all" ON agenda_tipos_cita FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "agenda_reglas_owner_all" ON agenda_disponibilidad_reglas FOR ALL
  TO authenticated
  USING (calendario_id IN (SELECT id FROM agenda_calendarios WHERE user_id = auth.uid()))
  WITH CHECK (calendario_id IN (SELECT id FROM agenda_calendarios WHERE user_id = auth.uid()));

CREATE POLICY "agenda_excepciones_owner_all" ON agenda_disponibilidad_excepciones FOR ALL
  TO authenticated
  USING (calendario_id IN (SELECT id FROM agenda_calendarios WHERE user_id = auth.uid()))
  WITH CHECK (calendario_id IN (SELECT id FROM agenda_calendarios WHERE user_id = auth.uid()));

-- Reservas: el organizador solo puede ver/cancelar las suyas. Nunca INSERT
-- directo — todas las reservas nuevas pasan por agenda_public_crear_reserva.
CREATE POLICY "agenda_reservas_owner_select" ON agenda_reservas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "agenda_reservas_owner_update" ON agenda_reservas FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "agenda_website_bloques_owner_all" ON agenda_website_bloques FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- 4. RPC pública de lectura — página de reservas sin login
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agenda_public_get_event_type(p_web_slug text, p_tipo_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user record;
  v_tipo record;
  v_calendario record;
  v_result json;
BEGIN
  SELECT id, nombre_completo
  INTO v_user
  FROM usuarios
  WHERE web_slug = p_web_slug
  LIMIT 1;

  IF v_user.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT tc.*
  INTO v_tipo
  FROM agenda_tipos_cita tc
  WHERE tc.user_id = v_user.id
    AND tc.slug = p_tipo_slug
    AND tc.activo = true
  LIMIT 1;

  IF v_tipo.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.* INTO v_calendario
  FROM agenda_calendarios c
  WHERE c.id = v_tipo.calendario_id AND c.activo = true
  LIMIT 1;

  IF v_calendario.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'organizador', json_build_object('nombre_completo', v_user.nombre_completo),
    'calendario', json_build_object(
      'id', v_calendario.id,
      'nombre', v_calendario.nombre,
      'color', v_calendario.color,
      'zona_horaria', v_calendario.zona_horaria
    ),
    'tipo_cita', json_build_object(
      'id', v_tipo.id,
      'nombre', v_tipo.nombre,
      'slug', v_tipo.slug,
      'descripcion', v_tipo.descripcion,
      'color', v_tipo.color,
      'duracion_minutos', v_tipo.duracion_minutos,
      'buffer_antes_minutos', v_tipo.buffer_antes_minutos,
      'buffer_despues_minutos', v_tipo.buffer_despues_minutos,
      'anticipacion_minima_minutos', v_tipo.anticipacion_minima_minutos,
      'limite_reservas_por_dia', v_tipo.limite_reservas_por_dia,
      'modalidades', v_tipo.modalidades,
      'direccion', v_tipo.direccion,
      'telefono_organizador', v_tipo.telefono_organizador
    ),
    'reglas', COALESCE((
      SELECT json_agg(json_build_object('weekday', r.weekday, 'start_time', r.start_time, 'end_time', r.end_time))
      FROM agenda_disponibilidad_reglas r
      WHERE r.calendario_id = v_calendario.id AND r.activo = true
    ), '[]'::json),
    'excepciones', COALESCE((
      SELECT json_agg(json_build_object('fecha', e.fecha, 'todo_el_dia', e.todo_el_dia, 'start_time', e.start_time, 'end_time', e.end_time))
      FROM agenda_disponibilidad_excepciones e
      WHERE e.calendario_id = v_calendario.id AND e.fecha >= (current_date - interval '1 day')
    ), '[]'::json),
    'ocupados', COALESCE((
      SELECT json_agg(json_build_object('start_at', b.start_at, 'end_at', b.end_at))
      FROM agenda_reservas b
      WHERE b.calendario_id = v_calendario.id
        AND b.status = 'confirmada'
        AND b.start_at >= (now() - interval '1 day')
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION agenda_public_get_event_type(text, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. RPC pública de escritura — crear reserva, validada en servidor
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agenda_public_crear_reserva(
  p_tipo_cita_id uuid,
  p_start_at timestamptz,
  p_invitado_nombre text,
  p_invitado_email text,
  p_modalidad text,
  p_invitado_telefono text DEFAULT NULL,
  p_invitado_notas text DEFAULT NULL,
  p_zona_horaria_invitado text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo record;
  v_calendario record;
  v_end_at timestamptz;
  v_local_ts timestamp;
  v_weekday int;
  v_regla_ok boolean;
  v_excepcion_bloquea boolean;
  v_reservas_hoy int;
  v_solapes int;
  v_recientes_email int;
  v_booking_id uuid := gen_random_uuid();
  v_meeting_url text;
  v_ubicacion text;
  v_result json;
BEGIN
  IF p_invitado_nombre IS NULL OR trim(p_invitado_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre del invitado es requerido';
  END IF;
  IF p_invitado_email IS NULL OR p_invitado_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'El correo del invitado no es válido';
  END IF;

  SELECT * INTO v_tipo FROM agenda_tipos_cita WHERE id = p_tipo_cita_id AND activo = true;
  IF v_tipo.id IS NULL THEN
    RAISE EXCEPTION 'Tipo de cita no encontrado';
  END IF;

  SELECT * INTO v_calendario FROM agenda_calendarios WHERE id = v_tipo.calendario_id AND activo = true;
  IF v_calendario.id IS NULL THEN
    RAISE EXCEPTION 'Calendario no disponible';
  END IF;

  IF NOT (p_modalidad = ANY(v_tipo.modalidades)) THEN
    RAISE EXCEPTION 'Modalidad no disponible para este tipo de cita';
  END IF;

  IF p_modalidad = 'google_meet' THEN
    RAISE EXCEPTION 'Google Meet aún no está disponible';
  END IF;

  -- Serializa reservas concurrentes del mismo calendario para evitar doble-booking
  PERFORM pg_advisory_xact_lock(hashtextextended(v_calendario.id::text, 0));

  v_end_at := p_start_at + make_interval(mins => v_tipo.duracion_minutos);

  IF p_start_at < now() + make_interval(mins => v_tipo.anticipacion_minima_minutos) THEN
    RAISE EXCEPTION 'Debes reservar con más anticipación';
  END IF;

  v_local_ts := p_start_at AT TIME ZONE v_calendario.zona_horaria;
  v_weekday := EXTRACT(DOW FROM v_local_ts)::int;

  SELECT EXISTS (
    SELECT 1 FROM agenda_disponibilidad_reglas r
    WHERE r.calendario_id = v_calendario.id
      AND r.activo = true
      AND r.weekday = v_weekday
      AND v_local_ts::time >= r.start_time
      AND (v_local_ts + make_interval(mins => v_tipo.duracion_minutos))::time <= r.end_time
  ) INTO v_regla_ok;

  IF NOT v_regla_ok THEN
    RAISE EXCEPTION 'El horario elegido ya no está disponible';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM agenda_disponibilidad_excepciones e
    WHERE e.calendario_id = v_calendario.id
      AND e.fecha = v_local_ts::date
      AND (
        e.todo_el_dia
        OR (v_local_ts::time < e.end_time AND (v_local_ts + make_interval(mins => v_tipo.duracion_minutos))::time > e.start_time)
      )
  ) INTO v_excepcion_bloquea;

  IF v_excepcion_bloquea THEN
    RAISE EXCEPTION 'El horario elegido ya no está disponible';
  END IF;

  IF v_tipo.limite_reservas_por_dia IS NOT NULL THEN
    SELECT COUNT(*) INTO v_reservas_hoy
    FROM agenda_reservas b
    WHERE b.tipo_cita_id = v_tipo.id
      AND b.status = 'confirmada'
      AND (b.start_at AT TIME ZONE v_calendario.zona_horaria)::date = v_local_ts::date;

    IF v_reservas_hoy >= v_tipo.limite_reservas_por_dia THEN
      RAISE EXCEPTION 'Ya no hay cupo disponible para ese día';
    END IF;
  END IF;

  -- Doble-booking: ninguna otra reserva confirmada del mismo calendario debe
  -- traslaparse con el rango + buffers de esta cita nueva.
  SELECT COUNT(*) INTO v_solapes
  FROM agenda_reservas b
  WHERE b.calendario_id = v_calendario.id
    AND b.status = 'confirmada'
    AND (p_start_at - make_interval(mins => v_tipo.buffer_antes_minutos)) < b.end_at
    AND (v_end_at + make_interval(mins => v_tipo.buffer_despues_minutos)) > b.start_at;

  IF v_solapes > 0 THEN
    RAISE EXCEPTION 'El horario elegido ya no está disponible';
  END IF;

  SELECT COUNT(*) INTO v_recientes_email
  FROM agenda_reservas
  WHERE invitado_email = p_invitado_email
    AND created_at > now() - interval '10 minutes';

  IF v_recientes_email >= 5 THEN
    RAISE EXCEPTION 'Demasiadas solicitudes, intenta de nuevo en unos minutos';
  END IF;

  IF p_modalidad = 'jitsi' THEN
    v_meeting_url := 'https://meet.jit.si/movi-' || replace(v_booking_id::text, '-', '');
    v_ubicacion := NULL;
  ELSIF p_modalidad = 'presencial' THEN
    v_meeting_url := NULL;
    v_ubicacion := v_tipo.direccion;
  ELSIF p_modalidad = 'telefono' THEN
    v_meeting_url := NULL;
    v_ubicacion := v_tipo.telefono_organizador;
  END IF;

  INSERT INTO agenda_reservas (
    id, tipo_cita_id, calendario_id, user_id, invitado_nombre, invitado_email,
    invitado_telefono, invitado_notas, modalidad, ubicacion_detalle, meeting_url,
    start_at, end_at, zona_horaria_invitado, status
  ) VALUES (
    v_booking_id, v_tipo.id, v_calendario.id, v_tipo.user_id, trim(p_invitado_nombre), p_invitado_email,
    p_invitado_telefono, p_invitado_notas, p_modalidad, v_ubicacion, v_meeting_url,
    p_start_at, v_end_at, p_zona_horaria_invitado, 'confirmada'
  );

  SELECT json_build_object(
    'id', v_booking_id,
    'start_at', p_start_at,
    'end_at', v_end_at,
    'modalidad', p_modalidad,
    'meeting_url', v_meeting_url,
    'ubicacion_detalle', v_ubicacion,
    'tipo_cita_nombre', v_tipo.nombre,
    'zona_horaria', v_calendario.zona_horaria
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION agenda_public_crear_reserva(uuid, timestamptz, text, text, text, text, text, text) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. Extiende get_public_web_page_by_slug con los bloques de agenda
--    activados en "Mi Página Web" (para no duplicar el mecanismo público)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION agenda_public_get_website_blocks(p_user_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(json_agg(
    json_build_object(
      'tipo_cita_id', tc.id,
      'nombre', tc.nombre,
      'slug', tc.slug,
      'descripcion', tc.descripcion,
      'duracion_minutos', tc.duracion_minutos,
      'orden', wb.orden
    ) ORDER BY wb.orden
  ), '[]'::json)
  FROM agenda_website_bloques wb
  JOIN agenda_tipos_cita tc ON tc.id = wb.tipo_cita_id AND tc.activo = true
  WHERE wb.user_id = p_user_id AND wb.visible = true;
$$;

GRANT EXECUTE ON FUNCTION agenda_public_get_website_blocks(uuid) TO anon, authenticated;
