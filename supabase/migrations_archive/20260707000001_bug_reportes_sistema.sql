-- ═══════════════════════════════════════════════════════════════════
-- Sistema de Reportes de Bug — botón flotante + diagnóstico técnico
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Log técnico por trámite de tipo "reporte_de_bug" ───────────
CREATE TABLE IF NOT EXISTS bug_reportes (
  ticket_id                   uuid        PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  errores_consola             jsonb       NOT NULL DEFAULT '[]',
  peticiones_fallidas         jsonb       NOT NULL DEFAULT '[]',
  rutas_visitadas             jsonb       NOT NULL DEFAULT '[]',
  user_agent                  text,
  viewport                    text,
  diagnostico_ia              text,
  diagnostico_ia_generado_en  timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bug_reportes ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede insertar el log de SU PROPIO reporte recién creado.
CREATE POLICY "bug_reportes_insert" ON bug_reportes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.creado_por = auth.uid())
  );

-- Solo Admin/Gerente o el equipo asignado al trámite puede leer el diagnóstico técnico.
CREATE POLICY "bug_reportes_select" ON bug_reportes
  FOR SELECT TO authenticated
  USING (
    get_my_rol() = ANY (ARRAY['Administrador'::text, 'Gerente'::text])
    OR EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_id
        AND t.grupo_asignado_id IS NOT NULL
        AND t.grupo_asignado_id = ANY (get_my_grupo_ids())
    )
  );

-- ── 2. Configuración del módulo (fila única) ──────────────────────
CREATE TABLE IF NOT EXISTS bug_report_config (
  id                      int         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  boton_activo            boolean     NOT NULL DEFAULT true,
  ia_automatica_activo    boolean     NOT NULL DEFAULT true,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

INSERT INTO bug_report_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE bug_report_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bug_report_config_select" ON bug_report_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bug_report_config_admin" ON bug_report_config
  FOR UPDATE TO authenticated
  USING (get_my_rol() = 'Administrador')
  WITH CHECK (get_my_rol() = 'Administrador');

-- ── 3. Categoría de adjunto para la captura de pantalla ───────────
INSERT INTO maestro_adjunto_categorias (nombre, descripcion)
SELECT 'Captura de pantalla (Reporte de bug)', 'Captura automática adjuntada al reportar un problema'
WHERE NOT EXISTS (
  SELECT 1 FROM maestro_adjunto_categorias WHERE nombre = 'Captura de pantalla (Reporte de bug)'
);
