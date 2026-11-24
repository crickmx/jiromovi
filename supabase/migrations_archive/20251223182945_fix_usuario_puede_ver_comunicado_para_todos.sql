/*
  # Corregir función de visibilidad de comunicados

  1. Problema
    - La función usuario_puede_ver_comunicado no considera el campo para_todos
    - Usuarios no pueden ver comunicados con para_todos=true
    - Esto causa "Acceso Denegado" en la página de detalle

  2. Solución
    - Actualizar la función para verificar para_todos=true
    - Si para_todos=true, el comunicado es visible para todos
    - Mantener la lógica existente para reglas específicas

  3. Lógica de visibilidad
    - Si no hay reglas → visible para todos
    - Si existe regla con para_todos=true → visible para todos
    - Si hay reglas específicas → verificar rol/oficina/usuario
*/

-- Reemplazar función con lógica corregida
CREATE OR REPLACE FUNCTION public.usuario_puede_ver_comunicado(
  p_comunicado_id UUID,
  p_usuario_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tiene_restricciones BOOLEAN;
  v_tiene_para_todos BOOLEAN;
  v_usuario_rol TEXT;
  v_usuario_oficina UUID;
  v_puede_ver BOOLEAN;
BEGIN
  -- Verificar si el comunicado tiene restricciones de visibilidad
  SELECT EXISTS(
    SELECT 1 FROM comunicados_visibilidad
    WHERE comunicado_id = p_comunicado_id
  ) INTO v_tiene_restricciones;

  -- Si no tiene restricciones, todos pueden verlo
  IF NOT v_tiene_restricciones THEN
    RETURN true;
  END IF;

  -- Verificar si tiene la regla "para_todos"
  SELECT EXISTS(
    SELECT 1 FROM comunicados_visibilidad
    WHERE comunicado_id = p_comunicado_id
      AND para_todos = true
  ) INTO v_tiene_para_todos;

  -- Si tiene para_todos=true, todos pueden verlo
  IF v_tiene_para_todos THEN
    RETURN true;
  END IF;

  -- Obtener datos del usuario
  SELECT rol, oficina_id INTO v_usuario_rol, v_usuario_oficina
  FROM usuarios
  WHERE id = p_usuario_id;

  -- Verificar si el usuario cumple alguna regla de visibilidad específica
  SELECT EXISTS(
    SELECT 1 FROM comunicados_visibilidad
    WHERE comunicado_id = p_comunicado_id
      AND (
        rol = v_usuario_rol OR
        oficina_id = v_usuario_oficina OR
        usuario_id = p_usuario_id
      )
  ) INTO v_puede_ver;

  RETURN v_puede_ver;
END;
$$;

-- Comentario explicativo
COMMENT ON FUNCTION public.usuario_puede_ver_comunicado IS 
  'Verifica si un usuario puede ver un comunicado específico basado en las reglas de visibilidad. Considera: sin reglas, para_todos=true, y reglas específicas por rol/oficina/usuario.';
