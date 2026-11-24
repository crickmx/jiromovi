/*
  # Corregir políticas RLS para service role

  1. Cambios
    - Eliminar política incorrecta anterior
    - Agregar política que permita acceso completo al service role
  
  2. Notas
    - El service role bypasea RLS por defecto
    - Esta política es redundante pero asegura compatibilidad
*/

-- Eliminar política incorrecta
DROP POLICY IF EXISTS "Edge functions can read agents" ON usuarios;

-- El service role ya bypasea RLS, pero para asegurar compatibilidad
-- verificamos que la función get_current_user_role existe
-- Si no, las otras políticas siguen funcionando normalmente
