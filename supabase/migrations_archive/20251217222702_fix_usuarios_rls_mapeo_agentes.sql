/*
  # Fix RLS para Mapeo de Agentes - Permitir lectura de usuarios

  1. Objetivo
    - Asegurar que los administradores puedan leer TODOS los usuarios activos
    - Necesario para el dropdown de mapeo de agentes en Producción → Configuración
    - Sin esto, el dropdown solo muestra "Sin asignar"

  2. Cambios
    - Verificar y recrear política de lectura de usuarios activos
    - Permite a usuarios autenticados ver usuarios no eliminados
    - Simple y sin recursión

  3. Seguridad
    - Solo usuarios autenticados pueden leer
    - Solo usuarios con estado != 'eliminado' son visibles
    - No hay recursión en la política
*/

-- Eliminar política existente si hay conflictos
DROP POLICY IF EXISTS "Authenticated users can view active users" ON usuarios;
DROP POLICY IF EXISTS "Users can read all users" ON usuarios;
DROP POLICY IF EXISTS "Admins can read all users" ON usuarios;

-- Crear política simple y robusta para lectura de usuarios
CREATE POLICY "Authenticated users can view active users" ON usuarios
  FOR SELECT TO authenticated
  USING (estado != 'eliminado');

-- Verificar que el índice existe para mejor performance
CREATE INDEX IF NOT EXISTS idx_usuarios_estado 
  ON usuarios(estado) 
  WHERE estado != 'eliminado';
