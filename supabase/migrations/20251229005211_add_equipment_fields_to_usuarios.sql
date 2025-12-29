/*
  # Agregar campos de equipos asignados

  1. Cambios
    - Agregar columna `equipo_computo` a usuarios
    - Agregar columna `equipo_celular` a usuarios
    
  2. Notas
    - Solo visible para administradores
    - Almacena información del equipo asignado al empleado
*/

-- Agregar columnas de equipos asignados
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS equipo_computo text,
ADD COLUMN IF NOT EXISTS equipo_celular text;

-- Comentarios para documentación
COMMENT ON COLUMN usuarios.equipo_computo IS 'Modelo y detalles del equipo de cómputo asignado al usuario';
COMMENT ON COLUMN usuarios.equipo_celular IS 'Modelo y detalles del equipo celular asignado al usuario';
