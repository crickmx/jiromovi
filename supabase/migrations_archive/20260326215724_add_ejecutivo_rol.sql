/*
  # Agregar rol "Ejecutivo" al sistema

  1. Cambios
    - Agrega "Ejecutivo" como rol válido en la tabla usuarios
    - Agrega "Ejecutivo" como rol válido en permisos_campos
    - Ejecutivo se trata como Empleado (sin permisos administrativos adicionales)

  2. Notas
    - Ejecutivo es un empleado con funciones específicas
    - No tiene permisos administrativos por defecto
    - Puede tener permisos adicionales asignados por Gerentes si es necesario
*/

-- Actualizar constraint de rol en tabla usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('Administrador', 'Gerente', 'Empleado', 'Agente', 'Ejecutivo'));

-- Actualizar constraint de rol en tabla permisos_campos
ALTER TABLE permisos_campos DROP CONSTRAINT IF EXISTS permisos_campos_rol_check;
ALTER TABLE permisos_campos ADD CONSTRAINT permisos_campos_rol_check
  CHECK (rol IN ('Administrador', 'Gerente', 'Empleado', 'Agente', 'Ejecutivo'));

-- Comentario aclaratorio
COMMENT ON COLUMN usuarios.rol IS
  'Rol del usuario: Administrador (acceso total), Gerente (acceso a su oficina + permisos adicionales), Empleado/Ejecutivo (acceso básico), Agente (acceso limitado a sus datos)';
