-- Permite un 4to target_type 'beta_user': overrides que SOLO suman visibilidad
-- (nunca ocultan) para usuarios registrados en usuarios_beta, y solo aplican
-- cuando el sitio se ve desde beta.movi.digital (chequeo de host + membresia
-- Beta vive en el frontend, useModuleVisibility.ts).
ALTER TABLE module_visibility DROP CONSTRAINT IF EXISTS module_visibility_target_type_check;
ALTER TABLE module_visibility ADD CONSTRAINT module_visibility_target_type_check
  CHECK (target_type IN ('role', 'office', 'user', 'beta_user'));
