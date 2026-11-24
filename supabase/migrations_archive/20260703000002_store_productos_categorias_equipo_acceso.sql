-- Extiende el acceso por equipo (store_equipos_acceso) a store_productos y store_categorias.
-- La migracion 20260702000010_store_equipos_triggers.sql solo lo agrego a store_pedidos;
-- StoreAdmin.tsx ya deja entrar a miembros de equipo con acceso (tieneAccesoEquipoStore),
-- pero RLS seguia dejando ver/crear/editar/eliminar productos y categorias solo a Administrador.

-- store_categorias: equipo con acceso puede ver todas (incluidas inactivas), crear, actualizar, eliminar
CREATE POLICY "store_categorias_equipo_ver_todas" ON store_categorias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_categorias_equipo_crear" ON store_categorias
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_categorias_equipo_actualizar" ON store_categorias
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_categorias_equipo_eliminar" ON store_categorias
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- store_productos: equipo con acceso puede ver todos (incluidos inactivos), crear, actualizar, eliminar
CREATE POLICY "store_productos_equipo_ver_todos" ON store_productos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_productos_equipo_crear" ON store_productos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_productos_equipo_actualizar" ON store_productos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "store_productos_equipo_eliminar" ON store_productos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
