-- Visibilidad y edición de campos por rol en el FormBuilder
-- Permite configurar qué campos son visibles/editables según el rol del usuario

ALTER TABLE tramite_tipo_campos
  ADD COLUMN IF NOT EXISTS visible_para_rol TEXT NOT NULL DEFAULT 'todos'
    CHECK (visible_para_rol IN ('todos', 'Empleado', 'Gerente', 'Administrador')),
  ADD COLUMN IF NOT EXISTS editable_para_rol TEXT NOT NULL DEFAULT 'todos'
    CHECK (editable_para_rol IN ('todos', 'Empleado', 'Gerente', 'Administrador'));

COMMENT ON COLUMN tramite_tipo_campos.visible_para_rol  IS 'Rol mínimo requerido para ver este campo. todos = sin restricción.';
COMMENT ON COLUMN tramite_tipo_campos.editable_para_rol IS 'Rol mínimo requerido para editar este campo. todos = sin restricción.';
