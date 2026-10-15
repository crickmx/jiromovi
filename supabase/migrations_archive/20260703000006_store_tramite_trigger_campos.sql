-- Mapeo configurable de campos por trigger Store -> Tramites.
-- Antes solo existia descripcion_template; esto permite al admin elegir,
-- por cada campo del FormBuilder del tipo elegido, de donde sale su valor
-- (plantilla de texto con placeholders del pedido, o el PDF de Orden de
-- Compra para campos de adjunto). Generico: sirve para cualquier trigger
-- futuro, no solo "Registro Pedido MOVI STORE Comisiones".

CREATE TABLE IF NOT EXISTS store_tramite_trigger_campos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id  uuid        NOT NULL REFERENCES store_tramite_triggers(id) ON DELETE CASCADE,
  campo_id    uuid        NOT NULL REFERENCES tramite_tipo_campos(id) ON DELETE CASCADE,
  fuente      text        NOT NULL DEFAULT 'vacio' CHECK (fuente IN ('vacio', 'template', 'adjunto_oc')),
  valor_template text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trigger_id, campo_id)
);

ALTER TABLE store_tramite_trigger_campos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_tramite_trigger_campos_read" ON store_tramite_trigger_campos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "store_tramite_trigger_campos_admin_all" ON store_tramite_trigger_campos
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
  );

CREATE POLICY "store_tramite_trigger_campos_equipo_all" ON store_tramite_trigger_campos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- store_tramite_triggers (Fase Store<->Tramites, 20260702000010) solo dejaba
-- gestionar a Administrador; StoreAdmin.tsx ya deja entrar a equipos con
-- acceso a la pestaña "Triggers" -- se extiende igual que ya se hizo con
-- store_productos/categorias.
CREATE POLICY "store_tramite_triggers_equipo_all" ON store_tramite_triggers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN store_equipos_acceso sea ON sea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );
