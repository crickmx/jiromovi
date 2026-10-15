-- Favoritos del menú por usuario.
--
-- Antes vivían en localStorage ('movi_nav_favorites'), o sea por navegador:
-- marcar un favorito en la compu no aparecía en el celular. Ahora se guardan
-- aquí y el frontend migra solo lo que hubiera en localStorage la primera vez.
--
-- item_path es el path del item del menú (workspaceConfig.ts), igual que la
-- llave que ya usaban los favoritos de localStorage.
--
-- Solo agrega una tabla: no le hace nada al sitio que todavía no tenga el código.

CREATE TABLE IF NOT EXISTS public.usuario_menu_favoritos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_path   text NOT NULL,
  orden       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, item_path)
);

CREATE INDEX IF NOT EXISTS idx_usuario_menu_favoritos_usuario
  ON public.usuario_menu_favoritos (usuario_id, orden);

ALTER TABLE public.usuario_menu_favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuario_menu_favoritos_select_propios ON public.usuario_menu_favoritos;
CREATE POLICY usuario_menu_favoritos_select_propios ON public.usuario_menu_favoritos
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS usuario_menu_favoritos_insert_propios ON public.usuario_menu_favoritos;
CREATE POLICY usuario_menu_favoritos_insert_propios ON public.usuario_menu_favoritos
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS usuario_menu_favoritos_update_propios ON public.usuario_menu_favoritos;
CREATE POLICY usuario_menu_favoritos_update_propios ON public.usuario_menu_favoritos
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS usuario_menu_favoritos_delete_propios ON public.usuario_menu_favoritos;
CREATE POLICY usuario_menu_favoritos_delete_propios ON public.usuario_menu_favoritos
  FOR DELETE TO authenticated USING (usuario_id = auth.uid());
