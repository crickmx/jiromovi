/*
  # Fix Gamification RLS Policies

  1. Ensure admin and gerente can access all gamification data
  2. Fix potential RLS issues blocking access
*/

-- Drop existing restrictive policies and recreate
DROP POLICY IF EXISTS "Admin/Gerente pueden ver todos los perfiles" ON agent_gamification_profile;
DROP POLICY IF EXISTS "Admin/Gerente pueden ver todos los eventos" ON agent_gamification_events;
DROP POLICY IF EXISTS "Admin puede ver todas las misiones" ON agent_missions;
DROP POLICY IF EXISTS "Admin puede ver todos los multiplicadores" ON agent_xp_multipliers;

-- agent_gamification_profile: Admin y Gerente pueden ver todo
CREATE POLICY "Admin/Gerente pueden ver todos los perfiles"
  ON agent_gamification_profile FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'gerente')
    )
    OR user_id = auth.uid()
  );

-- agent_gamification_events: Admin y Gerente pueden ver todo
CREATE POLICY "Admin/Gerente pueden ver todos los eventos"
  ON agent_gamification_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol IN ('admin', 'gerente')
    )
    OR user_id = auth.uid()
  );

-- agent_missions: Admin puede ver y editar todo
CREATE POLICY "Admin puede ver todas las misiones"
  ON agent_missions FOR SELECT
  TO authenticated
  USING (
    activa = true
    OR EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'admin'
    )
  );

CREATE POLICY "Admin puede modificar misiones"
  ON agent_missions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'admin'
    )
  );

-- agent_xp_multipliers: Admin puede ver y editar todo
CREATE POLICY "Admin puede ver todos los multiplicadores"
  ON agent_xp_multipliers FOR SELECT
  TO authenticated
  USING (
    activo = true
    OR EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'admin'
    )
  );

CREATE POLICY "Admin puede modificar multiplicadores"
  ON agent_xp_multipliers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND rol = 'admin'
    )
  );
