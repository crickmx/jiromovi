
-- ============================================================
-- Merge duplicate GMM folders
-- Keep: cbf400e4 (oldest active, no description)
-- Merge into it: 9bdbbd04 (38 files)
-- Also deactivate: 3c2d5d30 (inactive, "Documentos de HDI Seguros / Bupa")
-- ============================================================

-- Move all files from duplicate GMM folder to the canonical one
UPDATE centro_digital_archivos
SET carpeta_id = 'cbf400e4-9914-4091-b26c-9542cc5b6ea2'
WHERE carpeta_id = '9bdbbd04-ddc2-45a0-9931-2c0e7947dc04';

-- Move any sub-carpetas from duplicate GMM to canonical
UPDATE centro_digital_carpetas
SET parent_id = 'cbf400e4-9914-4091-b26c-9542cc5b6ea2'
WHERE parent_id = '9bdbbd04-ddc2-45a0-9931-2c0e7947dc04';

UPDATE centro_digital_carpetas
SET parent_id = 'cbf400e4-9914-4091-b26c-9542cc5b6ea2'
WHERE parent_id = '3c2d5d30-e9c9-4bcc-8e4c-08a8c30b5857';

-- Deactivate duplicate GMM folders
UPDATE centro_digital_carpetas
SET activa = false
WHERE id IN ('9bdbbd04-ddc2-45a0-9931-2c0e7947dc04', '3c2d5d30-e9c9-4bcc-8e4c-08a8c30b5857');

-- ============================================================
-- Merge duplicate Transporte folders
-- Keep: 477cb460 (oldest active)
-- Merge into it: 215a9d7b (25 files)
-- Also deactivate: 9728da3c (inactive, "Documentos de Chubb Seguros")
-- ============================================================

UPDATE centro_digital_archivos
SET carpeta_id = '477cb460-6e9b-4337-9726-58483956b7fd'
WHERE carpeta_id = '215a9d7b-137f-4b62-9726-b10754521cc6';

UPDATE centro_digital_carpetas
SET parent_id = '477cb460-6e9b-4337-9726-58483956b7fd'
WHERE parent_id = '215a9d7b-137f-4b62-9726-b10754521cc6';

UPDATE centro_digital_carpetas
SET parent_id = '477cb460-6e9b-4337-9726-58483956b7fd'
WHERE parent_id = '9728da3c-81cf-45a2-89b7-0c14fb78c4ab';

UPDATE centro_digital_carpetas
SET activa = false
WHERE id IN ('215a9d7b-137f-4b62-9726-b10754521cc6', '9728da3c-81cf-45a2-89b7-0c14fb78c4ab');

-- ============================================================
-- Autos: 52eb9357 already inactive, ensure it stays that way
-- ============================================================
UPDATE centro_digital_carpetas
SET activa = false
WHERE id = '52eb9357-5a10-4f63-b228-7518f47e3676';
