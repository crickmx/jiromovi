-- Unified Terms & Conditions system for all platforms (MOVI Digital, Seguwallet, Chava AI)

-- Table to store terms documents (both terms & conditions and privacy notice)
CREATE TABLE platform_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  titulo text NOT NULL,
  contenido_html text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('terminos', 'privacidad')),
  activo boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active document per type at a time
CREATE UNIQUE INDEX idx_platform_terms_active_tipo ON platform_terms (tipo) WHERE activo = true;
CREATE INDEX idx_platform_terms_tipo ON platform_terms (tipo);
CREATE INDEX idx_platform_terms_activo ON platform_terms (activo);

ALTER TABLE platform_terms ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active terms
CREATE POLICY "select_active_terms" ON platform_terms FOR SELECT
  TO authenticated USING (activo = true);

-- Only admins can manage terms (using role from usuarios table)
CREATE POLICY "insert_terms_admin" ON platform_terms FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'superadmin'))
  );

CREATE POLICY "update_terms_admin" ON platform_terms FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')));

CREATE POLICY "delete_terms_admin" ON platform_terms FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')));

-- Table to record user acceptance of terms
CREATE TABLE platform_terms_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_id uuid NOT NULL REFERENCES platform_terms(id) ON DELETE RESTRICT,
  terms_version integer NOT NULL,
  terms_tipo text NOT NULL CHECK (terms_tipo IN ('terminos', 'privacidad')),
  platform text NOT NULL CHECK (platform IN ('movi', 'seguwallet', 'chava')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_terms_acceptance_usuario ON platform_terms_acceptance (usuario_id);
CREATE INDEX idx_terms_acceptance_terms ON platform_terms_acceptance (terms_id);
CREATE INDEX idx_terms_acceptance_platform ON platform_terms_acceptance (platform);
-- Composite index for checking if user has accepted current terms
CREATE INDEX idx_terms_acceptance_user_tipo ON platform_terms_acceptance (usuario_id, terms_tipo, terms_id);

ALTER TABLE platform_terms_acceptance ENABLE ROW LEVEL SECURITY;

-- Users can read their own acceptances
CREATE POLICY "select_own_acceptance" ON platform_terms_acceptance FOR SELECT
  TO authenticated USING (auth.uid() = usuario_id);

-- Users can insert their own acceptances
CREATE POLICY "insert_own_acceptance" ON platform_terms_acceptance FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = usuario_id);

-- No updates or deletes to acceptance records (immutable audit trail)
-- Admins can read all acceptances for audit
CREATE POLICY "select_all_acceptance_admin" ON platform_terms_acceptance FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol IN ('admin', 'superadmin'))
  );

-- RPC to check if user has accepted current active terms
CREATE OR REPLACE FUNCTION check_user_terms_acceptance(p_usuario_id uuid)
RETURNS TABLE(
  tipo text,
  accepted boolean,
  terms_id uuid,
  terms_version integer
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.tipo,
    EXISTS (
      SELECT 1 FROM platform_terms_acceptance pta
      WHERE pta.usuario_id = p_usuario_id
        AND pta.terms_id = pt.id
    ) AS accepted,
    pt.id AS terms_id,
    pt.version AS terms_version
  FROM platform_terms pt
  WHERE pt.activo = true;
END;
$$;