-- Allow per-user visibility overrides in module_visibility (in addition to role/office)
ALTER TABLE module_visibility DROP CONSTRAINT IF EXISTS module_visibility_target_type_check;
ALTER TABLE module_visibility ADD CONSTRAINT module_visibility_target_type_check
  CHECK (target_type IN ('role', 'office', 'user'));
