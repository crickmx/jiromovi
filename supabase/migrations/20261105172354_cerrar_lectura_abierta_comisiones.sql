-- Hueco de seguridad: cualquier usuario autenticado podía leer TODAS las
-- comisiones de TODOS los agentes (monto, póliza, aseguradora) y el nombre de
-- TODOS los clientes asegurados, sin importar su rol ni si era suyo.
--
-- Causa: "Authenticated users can view details"/"...errors" con USING (true).
-- En RLS las políticas permisivas se combinan con OR, así que esa política
-- por sí sola dejaba sin efecto a las demás (que sí estaban bien escritas).
--
-- Reemplazo:
--   - Cada quien ve su propia comisión en cualquier estatus de lote (antes
--     "Agents view own commissions" solo cubría lotes 'closed' -- el
--     snapshot del asistente de IA pedía la del mes actual sin filtrar por
--     estatus, así que dependía sin saberlo de la política abierta).
--   - Empleado/Gerente/Administrador sí necesitan ver comisiones de
--     cualquier agente: Mesa de Control adjunta el lote correcto al crear un
--     trámite a nombre de otro agente (NuevoTramiteModal.tsx) y Admin ya
--     tenía "Admins manage commission details" para todo lo demás.
--   - Un Agente deja de poder leer las comisiones y los datos de clientes de
--     otros agentes, que era el hueco real.

DROP POLICY IF EXISTS "Authenticated users can view details" ON public.commission_details;
DROP POLICY IF EXISTS "Authenticated users can view errors" ON public.commission_errors;

CREATE POLICY "Users view own commission details any status"
  ON public.commission_details
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Staff can view all commission details"
  ON public.commission_details
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente', 'Empleado')
    )
  );

CREATE POLICY "Staff can view all commission errors"
  ON public.commission_errors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.rol IN ('Administrador', 'Gerente', 'Empleado')
    )
  );
