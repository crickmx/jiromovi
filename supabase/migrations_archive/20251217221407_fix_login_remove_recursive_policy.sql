/*
  # Corrección CRÍTICA: Eliminar política RLS recursiva que impide login
  
  1. Problema
    - La política "Admins can read all users" causa recursión infinita
    - Al hacer SELECT en la tabla usuarios dentro de la política de usuarios
    - Esto bloquea el login completamente
  
  2. Solución
    - Eliminar la política recursiva
    - Crear política simple que permita a usuarios autenticados ver otros usuarios
    - Los administradores tendrán acceso porque son usuarios autenticados
*/

-- Eliminar la política problemática
DROP POLICY IF EXISTS "Admins can read all users" ON usuarios;

-- Crear política simple y segura para lectura
-- Permite a TODOS los usuarios autenticados ver usuarios no eliminados
-- Esto es necesario para dropdowns de asignación, directorios, etc.
CREATE POLICY "Authenticated users can view active users" ON usuarios
  FOR SELECT TO authenticated
  USING (estado != 'eliminado');
