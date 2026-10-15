-- Add latency and error_category fields to insurer status
ALTER TABLE multi_autos_insurer_status 
  ADD COLUMN IF NOT EXISTS latency_ms integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_category text DEFAULT 'OK' 
    CHECK (error_category IN ('OK', 'CREDENTIAL_ERROR', 'DNS_UNREACHABLE', 'MISSING_AMIS', 'SOAP_FAULT', 'TIMEOUT', 'UNKNOWN'));

-- Update existing rows with categorized errors
UPDATE multi_autos_insurer_status SET error_category = 'CREDENTIAL_ERROR' WHERE credential_status IN ('missing', 'expired', 'invalid');
UPDATE multi_autos_insurer_status SET error_category = 'DNS_UNREACHABLE' WHERE endpoint_reachable = false;
UPDATE multi_autos_insurer_status SET error_category = 'OK' WHERE credential_status = 'valid';