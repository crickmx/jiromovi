/*
  # Catálogo de Roles (crear / editar / eliminar / fusionar) + asignación en usuarios

  Modelo "rol base": el motor de permisos de toda la plataforma sigue siendo la
  columna `usuarios.rol` (uno de los 4 valores canónicos: Administrador, Gerente,
  Empleado, Agente) — NADA de los ~130 archivos que hoy chequean `rol === 'X'`
  cambia. Encima de eso se agrega un catálogo editable de roles:

    - Cada rol del catálogo hereda de un `rol_base` (uno de los 4).
    - Asignar un rol del catálogo a un usuario setea:
        usuarios.rol    = rol.rol_base   (comportamiento / motor de permisos)
        usuarios.rol_id = rol.id         (identidad, color, permisos de módulos por rol)
    - Todos los roles (incluidos los 4 sembrados) se pueden renombrar, recolorear,
      cambiar de base, eliminar y fusionar. Única red de seguridad: no se puede
      dejar la plataforma con CERO administradores activos.

  1. Tabla nueva `roles` (catálogo)
  2. `usuarios.rol_id` + `user_roles.rol_id` (espejo de caché) + backfill
  3. Triggers: mantener rol_id por defecto y sincronizar base al cambiar rol_base
  4. RPC `reasignar_y_eliminar_rol` (elimina/fusiona con reasignación + guardrail)
  5. `module_visibility.target_type` gana el valor 'rol_id' (permisos por rol)
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Catálogo de roles
-- ─────────────────────────────────────────────────────────────────────────────
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

COMMENT ON TABLE roles IS 'Catálogo editable de roles. rol_base = uno de los 4 comportamientos canónicos que hereda. es_sistema marca los 4 sembrados originalmente (informativo; son igual de editables).';

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier autenticado (el frontend necesita el catálogo para pintar labels/colores)
DROP POLICY IF EXISTS roles_select_all ON roles;
CREATE POLICY roles_select_all ON roles
  FOR SELECT TO authenticated USING (true);

-- Escritura (insert/update/delete directo de la fila): solo Administrador.
-- La eliminación/fusión con reasignación de usuarios va por el RPC de abajo,
-- pero dejamos DELETE por si se quiere borrar un rol sin usuarios.
DROP POLICY IF EXISTS roles_admin_all ON roles;
CREATE POLICY roles_admin_all ON roles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.rol = 'Administrador' AND ur.activo
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.rol = 'Administrador' AND ur.activo
  ));

-- Semilla: los 4 roles actuales. rol_base = a sí mismos. es_sistema = true.
INSERT INTO roles (nombre, descripcion, color, rol_base, es_sistema, orden) VALUES
  ('Administrador', 'Acceso total a la plataforma.',                         '#d63f45', 'Administrador', true, 0),
  ('Gerente',       'Administración acotada a su oficina y equipos.',        '#c9820a', 'Gerente',       true, 1),
  ('Empleado',      'Usuario interno operativo, sin capacidades de admin.',  '#0d7a84', 'Empleado',      true, 2),
  ('Agente',        'Cliente externo. Solo ve lo que él mismo solicitó.',    '#6b7a90', 'Agente',        true, 3)
ON CONFLICT (nombre) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. usuarios.rol_id + espejo en user_roles + backfill
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE usuarios   ADD COLUMN IF NOT EXISTS rol_id uuid REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS rol_id uuid;

-- Backfill: emparejar cada usuario con el rol sembrado cuyo nombre == su rol base actual.
UPDATE usuarios u
   SET rol_id = r.id
  FROM roles r
 WHERE r.nombre = u.rol
   AND u.rol_id IS NULL;

UPDATE user_roles ur
   SET rol_id = u.rol_id
  FROM usuarios u
 WHERE u.id = ur.user_id
   AND ur.rol_id IS DISTINCT FROM u.rol_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. Trigger en usuarios: si se inserta/actualiza sin rol_id, asignar uno por
--     defecto que corresponda a la base (así los altas por edge function que solo
--     mandan `rol` siguen funcionando). Mantener también la base coherente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION usuarios_set_default_rol_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rol_id IS NULL AND NEW.rol IS NOT NULL THEN
    -- Preferir el rol cuyo nombre == la base; si no, cualquiera con esa base.
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
  BEFORE INSERT OR UPDATE OF rol, rol_id ON usuarios
  FOR EACH ROW EXECUTE FUNCTION usuarios_set_default_rol_id();

-- La caché user_roles debe copiar también rol_id. La función sync_user_roles ya
-- existe (creada en 20251023193253); la reemplazamos conservando su lógica.
CREATE OR REPLACE FUNCTION sync_user_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO user_roles (user_id, rol, rol_id, oficina_id, activo, updated_at)
    VALUES (NEW.id, NEW.rol, NEW.rol_id, NEW.oficina_id, NEW.activo, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
      rol        = EXCLUDED.rol,
      rol_id     = EXCLUDED.rol_id,
      oficina_id = EXCLUDED.oficina_id,
      activo     = EXCLUDED.activo,
      updated_at = EXCLUDED.updated_at;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM user_roles WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3b. Trigger en roles: al cambiar rol_base de un rol, arrastrar la base de todos
--     sus usuarios (mantiene el motor de permisos coherente con la nueva base).
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: eliminar o fusionar un rol reasignando sus usuarios.
--    - p_origen: rol a eliminar.
--    - p_destino: rol al que se reasignan sus usuarios (NULL solo si el origen no
--      tiene usuarios). "Fusionar A en B" = reasignar_y_eliminar_rol(A, B).
--    Guardrail: no dejar la plataforma sin administradores activos.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reasignar_y_eliminar_rol(p_origen uuid, p_destino uuid)
RETURNS void AS $$
DECLARE
  v_origen  roles%ROWTYPE;
  v_destino roles%ROWTYPE;
  v_usuarios_origen int;
  v_admins_restantes int;
BEGIN
  -- Solo Administrador
  IF NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.rol = 'Administrador' AND ur.activo) THEN
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

  -- Guardrail: contar administradores activos que quedarían tras la operación.
  -- Un usuario "admin activo" = usuarios.activo AND rol_base efectivo = Administrador.
  SELECT count(*) INTO v_admins_restantes
    FROM usuarios u
   WHERE u.activo
     AND (
       -- usuarios que NO se mueven y ya son admin base
       (u.rol_id IS DISTINCT FROM p_origen AND u.rol = 'Administrador')
       -- o los que SÍ se mueven, si el destino es de base Administrador
       OR (u.rol_id = p_origen AND p_destino IS NOT NULL AND v_destino.rol_base = 'Administrador')
     );

  IF v_admins_restantes = 0 THEN
    RAISE EXCEPTION 'La operación dejaría la plataforma sin administradores activos. Reasigna a un rol de base Administrador o cancela.';
  END IF;

  -- Reasignar usuarios (setea base + rol_id del destino). El trigger de usuarios
  -- sincroniza user_roles solo.
  IF p_destino IS NOT NULL THEN
    UPDATE usuarios
       SET rol = v_destino.rol_base, rol_id = p_destino
     WHERE rol_id = p_origen;
  END IF;

  -- Limpiar permisos de módulos propios del rol origen (los del destino se quedan).
  DELETE FROM module_visibility WHERE target_type = 'rol_id' AND target_value = p_origen::text;

  -- Eliminar el rol.
  DELETE FROM roles WHERE id = p_origen;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION reasignar_y_eliminar_rol(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION reasignar_y_eliminar_rol(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. module_visibility: permitir target_type = 'rol_id' (permisos de módulos por
--    rol del catálogo, más específico que la capa por rol base 'role').
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE module_visibility DROP CONSTRAINT IF EXISTS module_visibility_target_type_check;
ALTER TABLE module_visibility ADD CONSTRAINT module_visibility_target_type_check
  CHECK (target_type IN ('role', 'office', 'user', 'beta_user', 'rol_id'));
