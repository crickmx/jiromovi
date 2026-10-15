
ALTER TABLE oficinas ADD COLUMN IF NOT EXISTS responsable_default_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

-- Set YURI AGUILAR as the default responsable for Jiro Corporativo
UPDATE oficinas
SET responsable_default_id = '0a8f09a2-270b-4695-b559-8b3a45239b59'
WHERE id = '1d8e8c31-2bc7-446d-869d-cfc1241b363d';
