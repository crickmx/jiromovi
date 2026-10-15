/*
  # Optimize SICAS sync performance with indexes

  1. New Indexes
    - `sicas_documents(source_keycode, synced_at)` - speeds up dedup checks during sync
    - `sicas_documents(vend_id, fecha_emision)` - speeds up vendor-scoped queries
    - `sicas_documents(oficina_id, fecha_emision)` - speeds up office-scoped queries
    - `sicas_sync_jobs(status, started_at)` - speeds up job mutex checks
    - `sicas_mapeo_vendedor_usuario(id_sicas_vendedor)` - speeds up vendor lookup
    - `sicas_mapeo_despacho_oficina(id_sicas_despacho)` - speeds up despacho mapping
    - `sicas_catalogos(catalog_type_id, id_sicas)` - speeds up catalog mapping

  2. Performance Impact
    - Reduces full table scans during sync batch processing
    - Accelerates mapping lookups that happen on every batch
    - Improves dashboard query performance for all scopes

  3. Important Notes
    - All indexes use IF NOT EXISTS to be safe
    - No data changes, only index creation
    - Skipped sicas_polizas_vigentes (it is a view)
*/

-- Index for dedup checks during sync batches
CREATE INDEX IF NOT EXISTS idx_sicas_documents_source_synced
  ON sicas_documents(source_keycode, synced_at);

-- Index for vendor-scoped dashboard queries
CREATE INDEX IF NOT EXISTS idx_sicas_documents_vend_fecha
  ON sicas_documents(vend_id, fecha_emision);

-- Index for office-scoped dashboard queries
CREATE INDEX IF NOT EXISTS idx_sicas_documents_oficina_fecha
  ON sicas_documents(oficina_id, fecha_emision);

-- Index for sync job mutex/status checks
CREATE INDEX IF NOT EXISTS idx_sicas_sync_jobs_status_started
  ON sicas_sync_jobs(status, started_at);

-- Index for vendor mapping lookups during sync
CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_vendedor_usuario_vend
  ON sicas_mapeo_vendedor_usuario(id_sicas_vendedor);

-- Index for despacho mapping lookups during sync
CREATE INDEX IF NOT EXISTS idx_sicas_mapeo_despacho_oficina_despacho
  ON sicas_mapeo_despacho_oficina(id_sicas_despacho);

-- Index for catalog lookups during mapping
CREATE INDEX IF NOT EXISTS idx_sicas_catalogos_type_id_sicas
  ON sicas_catalogos(catalog_type_id, id_sicas);
