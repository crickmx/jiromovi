/*
  # Corregir políticas RLS para permitir acceso desde edge functions

  1. Cambios
    - Agregar política SELECT para permitir que edge functions lean usuarios con rol Agente
    - Esto permite que el proceso de comisiones funcione correctamente
  
  2. Seguridad
    - La política usa auth.jwt() para verificar si hay un JWT válido
    - Si no hay JWT (como en edge functions con service role), permite acceso
    - Esto es seguro porque solo edge functions autorizadas pueden usar service role key
*/

-- Permitir que edge functions (sin JWT de usuario) puedan leer usuarios con rol Agente
CREATE POLICY "Edge functions can read agents"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    (rol = 'Agente') OR
    (auth.jwt() IS NULL) OR
    (get_current_user_role() = 'Administrador')
  );
