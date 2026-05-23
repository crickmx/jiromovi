-- Migration: 20260523012000_create_web_monitor_module
-- Description: Creates the web page monitor module for Admin Digital
-- Tables created:
--   - monitored_sites: Stores registered websites and their latest check results
--   - site_history: Historical log of all site checks over time
--   - status_changes: Records state transitions (status or SSL) for alerting
-- Changes:
--   - Enables RLS on all tables
--   - Creates policies for authenticated users (admin/gerente manage, all authenticated read)
--   - Creates indexes for optimized queries on history and status lookups

-- =============================================================================
-- TABLE: monitored_sites
-- Stores each monitored website and its most recent check results
-- =============================================================================
CREATE TABLE IF NOT EXISTS monitored_sites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now(),
    last_check timestamptz,
    last_status text,
    last_http_code integer,
    last_response_time integer,
    last_ssl_status text,
    last_ssl_valid_to timestamptz,
    last_diagnosis text,
    previous_status text,
    previous_ssl_status text,
    previous_http_code integer,
    status_changed_at timestamptz,
    ssl_changed_at timestamptz
);

COMMENT ON TABLE monitored_sites IS 'Registered websites for periodic monitoring';
COMMENT ON COLUMN monitored_sites.last_status IS 'Current status: OK, ADVERTENCIA, or CRITICO';
COMMENT ON COLUMN monitored_sites.last_response_time IS 'Last response time in milliseconds';
COMMENT ON COLUMN monitored_sites.last_ssl_valid_to IS 'SSL certificate expiration date';

-- =============================================================================
-- TABLE: site_history
-- Historical log of all check results for each monitored site
-- =============================================================================
CREATE TABLE IF NOT EXISTS site_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES monitored_sites(id) ON DELETE CASCADE,
    checked_at timestamptz DEFAULT now(),
    status text,
    http_code integer,
    response_time integer,
    ssl_status text,
    diagnosis text
);

COMMENT ON TABLE site_history IS 'Historical record of all site check results';
COMMENT ON COLUMN site_history.response_time IS 'Response time in milliseconds';

-- =============================================================================
-- TABLE: status_changes
-- Records detected changes in status or SSL state for alerting purposes
-- =============================================================================
CREATE TABLE IF NOT EXISTS status_changes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES monitored_sites(id) ON DELETE CASCADE,
    url text NOT NULL,
    change_type text NOT NULL,
    old_value text,
    new_value text,
    detected_at timestamptz DEFAULT now()
);

COMMENT ON TABLE status_changes IS 'Log of status or SSL state transitions for notifications';
COMMENT ON COLUMN status_changes.change_type IS 'Type of change: status or ssl';

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_site_history_site_checked
    ON site_history(site_id, checked_at);

CREATE INDEX IF NOT EXISTS idx_status_changes_detected_at
    ON status_changes(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitored_sites_last_status
    ON monitored_sites(last_status);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE monitored_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_changes ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Policies for monitored_sites
-- -----------------------------------------------------------------------------

-- All authenticated users can read
CREATE POLICY "authenticated_users_can_read_monitored_sites"
    ON monitored_sites
    FOR SELECT
    TO authenticated
    USING (true);

-- Admin and gerente roles can insert
CREATE POLICY "admin_gerente_can_insert_monitored_sites"
    ON monitored_sites
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    );

-- Admin and gerente roles can update
CREATE POLICY "admin_gerente_can_update_monitored_sites"
    ON monitored_sites
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    )
    WITH CHECK (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    );

-- Admin and gerente roles can delete
CREATE POLICY "admin_gerente_can_delete_monitored_sites"
    ON monitored_sites
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    );

-- -----------------------------------------------------------------------------
-- Policies for site_history
-- -----------------------------------------------------------------------------

-- All authenticated users can read
CREATE POLICY "authenticated_users_can_read_site_history"
    ON site_history
    FOR SELECT
    TO authenticated
    USING (true);

-- Admin and gerente roles can insert
CREATE POLICY "admin_gerente_can_insert_site_history"
    ON site_history
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    );

-- Admin and gerente roles can update
CREATE POLICY "admin_gerente_can_update_site_history"
    ON site_history
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    )
    WITH CHECK (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    );

-- Admin and gerente roles can delete
CREATE POLICY "admin_gerente_can_delete_site_history"
    ON site_history
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    );

-- -----------------------------------------------------------------------------
-- Policies for status_changes
-- -----------------------------------------------------------------------------

-- All authenticated users can read
CREATE POLICY "authenticated_users_can_read_status_changes"
    ON status_changes
    FOR SELECT
    TO authenticated
    USING (true);

-- Admin and gerente roles can insert
CREATE POLICY "admin_gerente_can_insert_status_changes"
    ON status_changes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    );

-- Admin and gerente roles can update
CREATE POLICY "admin_gerente_can_update_status_changes"
    ON status_changes
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    )
    WITH CHECK (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    );

-- Admin and gerente roles can delete
CREATE POLICY "admin_gerente_can_delete_status_changes"
    ON status_changes
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') IN ('admin', 'gerente')
    );