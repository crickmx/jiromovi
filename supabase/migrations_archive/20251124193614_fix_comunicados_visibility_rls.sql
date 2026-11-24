/*
  # Actualizar RLS de Comunicados para Visibilidad Granular

  ## Descripción
  Actualiza las políticas RLS de comunicados_publicaciones para respetar
  la visibilidad configurada en comunicados_visibilidad.

  ## Cambios
  1. Reemplaza política "Anyone can view published comunicados"
  2. Agrega lógica de visibilidad por:
     - Rol del usuario
     - Oficina del usuario
     - Usuario específico
  3. Si no hay reglas de visibilidad, el comunicado es visible para todos

  ## Seguridad
  - Administradores ven TODO (política existente se mantiene)
  - Usuarios ven solo comunicados que cumplan las reglas de visibilidad
  - Si comunicado no tiene reglas, es público para todos los autenticados
*/

-- Eliminar política anterior
DROP POLICY IF EXISTS "Anyone can view published comunicados" ON comunicados_publicaciones;

-- Nueva política con visibilidad granular
CREATE POLICY "Users can view comunicados based on visibility"
  ON comunicados_publicaciones
  FOR SELECT
  TO authenticated
  USING (
    publicado = true 
    AND fecha_publicacion <= now()
    AND (
      -- Si no hay reglas de visibilidad, es visible para todos
      NOT EXISTS (
        SELECT 1 FROM comunicados_visibilidad
        WHERE comunicados_visibilidad.comunicado_id = comunicados_publicaciones.id
      )
      OR
      -- O cumple con alguna regla de visibilidad
      EXISTS (
        SELECT 1 FROM comunicados_visibilidad cv
        INNER JOIN usuarios u ON u.id = auth.uid()
        WHERE cv.comunicado_id = comunicados_publicaciones.id
        AND (
          -- Visibilidad por rol
          (cv.rol IS NOT NULL AND cv.rol = u.rol)
          OR
          -- Visibilidad por oficina
          (cv.oficina_id IS NOT NULL AND cv.oficina_id = u.oficina_id)
          OR
          -- Visibilidad por usuario específico
          (cv.usuario_id IS NOT NULL AND cv.usuario_id = u.id)
        )
      )
    )
  );
