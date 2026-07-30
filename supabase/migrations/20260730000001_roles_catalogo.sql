/*
  # Catálogo de Roles (crear / editar / eliminar / fusionar) + asignación en usuarios

  Modelo "rol base": el motor de permisos de toda la plataforma sigue siendo la
  columna `usuarios.rol` (uno de los 4 valores canónicos: Administrador, Gerente,
  Empleado, Agente) — NADA de los ~130 archivos que hoy chequean `rol === 'X'`
  cambia. Encima se agrega un catálogo editable de roles:

    - Cada rol del catálogo hereda de un `rol_base` (uno de los 4).
    - Asignar un rol del catálogo a un usuario setea:
        usuarios.rol    = rol.rol_base   (comportamiento / motor de permisos)
        usuarios.rol_id = rol.id         (identidad, color, permisos de módulos por rol)
    - Todos los roles (incluidos los 4 sembrados) se pueden renombrar, recolorear,
      cambiar de base, eliminar y fusionar. Única red de seguridad: no dejar la
      plataforma con CERO administradores.

  NOTA de producción: en este proyecto `usuarios.id = auth.uid()` y las políticas
  RLS reales chequean admin contra `usuarios` directamente (NO contra `user_roles`,
  cuyo esquema en prod difiere del repo — drift). Se copia ese mismo patrón. Por eso
  esta migración NO toca `user_roles` ni `sync_user_roles`.
*/

-- 1. Catálogo de roles
CREATE TABLE IF NOT EXISTS roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  color       text DEFAULT '#6b7a90',
  rol_base    text NOT NULL CHECK (rol_base IN ('Administrador', 'Gerente', 'Empleado', 'Agente')),
  es_sistema  boolean NOT NULL DEFAULT false,
  activo      boolean NOT NULL DEFAULT true,
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE roles IS 'Catálogo editable de roles. rol_base = uno de los 4 comportamientos canónicos que hereda. es_sistema marca los 4 sembrados (informativo; son igual de editables).';

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_select_all ON roles;
CREATE POLICY roles_select_all ON roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS roles_admin_all ON roles;
CREATE POLICY roles_admin_all ON roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador'));

-- Semilla: los 4 roles actuales. rol_base = a sí mismos.
INSERT INTO roles (nombre, descripcion, color, rol_base, es_sistema, orden) VALUES
  ('Administrador', 'Acceso total a la plataforma.',                         '#d63f45', 'Administrador', true, 0),
  ('Gerente',       'Administración acotada a su oficina y equipos.',        '#c9820a', 'Gerente',       true, 1),
  ('Empleado',      'Usuario interno operativo, sin capacidades de admin.',  '#0d7a84', 'Empleado',      true, 2),
  ('Agente',        'Cliente externo. Solo ve lo que él mismo solicitó.',    '#6b7a90', 'Agente',        true, 3)
ON CONFLICT (nombre) DO NOTHING;

-- 2. usuarios.rol_id + backfill
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol_id uuid REFERENCES roles(id) ON DELETE SET NULL;

UPDATE usuarios u
   SET rol_id = r.id
  FROM roles r
 WHERE r.nombre = u.rol
   AND u.rol_id IS NULL;

-- 3a. Al insertar/cambiar rol sin rol_id, asignar uno por defecto que corresponda a
--     la base (así las altas por edge function que solo mandan `rol` siguen bien).
--     Solo escucha cambios de `rol` (no de rol_id) para no pisar una asignación
--     explícita ni interferir con el ON DELETE SET NULL.
CREATE OR REPLACE FUNCTION usuarios_set_default_rol_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol_id IS NULL AND NEW.rol IS NOT NULL THEN
    SELECT id INTO NEW.rol_id FROM roles WHERE nombre = NEW.rol LIMIT 1;
    IF NEW.rol_id IS NULL THEN
      SELECT id INTO NEW.rol_id FROM roles WHERE rol_base = NEW.rol ORDER BY es_sistema DESC, orden LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_default_rol_id ON usuarios;
CREATE TRIGGER trg_usuarios_default_rol_id
  BEFORE INSERT OR UPDATE OF rol ON usuarios
  FOR EACH ROW EXECUTE FUNCTION usuarios_set_default_rol_id();

-- 3b. Al cambiar la base de un rol, arrastrar la base de sus usuarios (mantiene el
--     motor de permisos coherente). El UPDATE a usuarios dispara los triggers de prod.
CREATE OR REPLACE FUNCTION roles_propagar_base()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol_base IS DISTINCT FROM OLD.rol_base THEN
    UPDATE usuarios SET rol = NEW.rol_base WHERE rol_id = NEW.id AND rol IS DISTINCT FROM NEW.rol_base;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_propagar_base ON roles;
CREATE TRIGGER trg_roles_propagar_base
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION roles_propagar_base();

-- 4. RPC: eliminar o fusionar un rol reasignando sus usuarios.
--    p_destino NULL solo si el origen no tiene usuarios. "Fusionar A en B" =
--    reasignar_y_eliminar_rol(A, B). Guardrail: no dejar la plataforma sin admins.
CREATE OR REPLACE FUNCTION reasignar_y_eliminar_rol(p_origen uuid, p_destino uuid)
RETURNS void AS $$
DECLARE
  v_origen  roles%ROWTYPE;
  v_destino roles%ROWTYPE;
  v_usuarios_origen int;
  v_admins_restantes int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.rol = 'Administrador') THEN
    RAISE EXCEPTION 'Solo un Administrador puede eliminar o fusionar roles.';
  END IF;

  SELECT * INTO v_origen FROM roles WHERE id = p_origen;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El rol a eliminar no existe.';
  END IF;

  IF p_destino IS NOT NULL THEN
    IF p_destino = p_origen THEN
      RAISE EXCEPTION 'El rol destino no puede ser el mismo que el origen.';
    END IF;
    SELECT * INTO v_destino FROM roles WHERE id = p_destino;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El rol destino no existe.';
    END IF;
  END IF;

  SELECT count(*) INTO v_usuarios_origen FROM usuarios WHERE rol_id = p_origen;

  IF v_usuarios_origen > 0 AND p_destino IS NULL THEN
    RAISE EXCEPTION 'El rol tiene % usuario(s). Debes indicar a qué rol reasignarlos.', v_usuarios_origen;
  END IF;

  -- Admins que quedarían tras la operación (base Administrador).
  SELECT count(*) INTO v_admins_restantes
    FROM usuarios u
   WHERE (
     (u.rol_id IS DISTINCT FROM p_origen AND u.rol = 'Administrador')
     OR (u.rol_id = p_origen AND p_destino IS NOT NULL AND v_destino.rol_base = 'Administrador')
   );

  IF v_admins_restantes = 0 THEN
    RAISE EXCEPTION 'La operación dejaría la plataforma sin administradores. Reasigna a un rol de base Administrador o cancela.';
  END IF;

  IF p_destino IS NOT NULL THEN
    UPDATE usuarios
       SET rol = v_destino.rol_base, rol_id = p_destino
     WHERE rol_id = p_origen;
  END IF;

  DELETE FROM module_visibility WHERE target_type = 'rol_id' AND target_value = p_origen::text;

  DELETE FROM roles WHERE id = p_origen;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION reasignar_y_eliminar_rol(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION reasignar_y_eliminar_rol(uuid, uuid) TO authenticated;

-- 5. module_visibility: permitir target_type = 'rol_id' (permisos de módulos por rol
--    del catálogo, más específico que la capa por rol base 'role').
ALTER TABLE module_visibility DROP CONSTRAINT IF EXISTS module_visibility_target_type_check;
ALTER TABLE module_visibility ADD CONSTRAINT module_visibility_target_type_check
  CHECK (target_type IN ('role', 'office', 'user', 'beta_user', 'rol_id'));
