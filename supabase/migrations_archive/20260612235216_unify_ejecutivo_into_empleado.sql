-- Convert any existing Ejecutivo users to Empleado
UPDATE usuarios SET rol = 'Empleado' WHERE rol = 'Ejecutivo';

-- Remove Ejecutivo from module_visibility rules (merge into Empleado)
DELETE FROM module_visibility WHERE target_value = 'Ejecutivo';

-- Update the check constraint on usuarios.rol to remove Ejecutivo
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check 
  CHECK (rol IN ('Administrador', 'Gerente', 'Empleado', 'Agente'));