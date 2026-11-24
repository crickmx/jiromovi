-- Categorias (familias) de logos del Brand Kit, antes hardcodeadas en el
-- frontend (LOGO_FAMILIES). Se vuelven dinamicas para poder agregar nuevas
-- (ej. "Jiro Fianzas") desde la UI sin tocar codigo.

CREATE TABLE IF NOT EXISTS mkt_logo_familias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text        NOT NULL UNIQUE,
  label       text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  orden       int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mkt_logo_familias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mkt_logo_familias_read" ON mkt_logo_familias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "mkt_logo_familias_admin_o_equipo_write" ON mkt_logo_familias
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
    OR EXISTS (
      SELECT 1 FROM tramites_grupos_miembros tgm
      JOIN mkt_equipos_acceso mea ON mea.grupo_id = tgm.grupo_id
      WHERE tgm.usuario_id = auth.uid()
    )
  );

-- Semilla: las 5 familias que ya existian hardcodeadas + la nueva pedida.
INSERT INTO mkt_logo_familias (key, label, description, orden) VALUES
  ('horizontal',     'Horizontal',     'Versión principal — montaña + texto',       0),
  ('vertical',       'Vertical',       'Montaña arriba, texto abajo',               1),
  ('isotype',        'Isotipo',        'Solo la montaña',                          2),
  ('wordmark',       'Wordmark',       'Solo el texto "JIRO Seguros"',              3),
  ('aniversario-50', '50 Aniversario', 'Solo campañas de aniversario',              4),
  ('jiro-fianzas',   'Jiro Fianzas',   'Logo de la línea de negocio Jiro Fianzas',  5)
ON CONFLICT (key) DO NOTHING;
