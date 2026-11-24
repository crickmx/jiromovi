/*
  # Fix SICAS Catalogos RLS Policies
  
  1. Problema
    - Solo existe política SELECT para administradores
    - No hay políticas para INSERT, UPDATE, DELETE
    - Las funciones de mapeo necesitan modificar is_mapped
    
  2. Solución
    - Agregar políticas completas para administradores
    - Permitir INSERT, UPDATE, DELETE
    
  3. Seguridad
    - Solo administradores pueden modificar
    - Service role mantiene acceso completo
*/

-- Eliminar política antigua restrictiva
DROP POLICY IF EXISTS "Administradores pueden ver catálogos" ON public.sicas_catalogos;

-- Crear políticas completas para administradores
CREATE POLICY "Admins pueden ver catálogos SICAS"
  ON public.sicas_catalogos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins pueden insertar catálogos SICAS"
  ON public.sicas_catalogos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins pueden actualizar catálogos SICAS"
  ON public.sicas_catalogos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.estado = 'activo'
    )
  );

CREATE POLICY "Admins pueden eliminar catálogos SICAS"
  ON public.sicas_catalogos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
      AND usuarios.estado = 'activo'
    )
  );
