/*
  # Fix SICAS production config vendor filter field

  1. Changes
    - Update `report_filter_field` from `DatDocumentos.IDVend` to `DatDocumentos.VendId`
    - The SICAS REST API uses `VendId` (not `IDVend`) for the vendor ID filter
    - `IDVend` is the SOAP API field name; `VendId` is the REST API field name

  2. Impact
    - Fixes production queries returning empty results because the filter field was wrong
    - Affects all vendor-scoped production queries (summary, documents, detail)
*/

UPDATE sicas_production_config
SET report_filter_field = 'DatDocumentos.VendId',
    updated_at = now()
WHERE report_filter_field = 'DatDocumentos.IDVend';
