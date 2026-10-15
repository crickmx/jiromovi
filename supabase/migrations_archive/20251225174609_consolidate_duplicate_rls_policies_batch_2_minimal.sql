/*
  # Consolidate Duplicate RLS Policies - Batch 2 (Minimal)

  Consolidates duplicate permissive policies for verified tables.
  
  ## Tables Optimized
  - gmm_quotes, gmm_quotations
  - meetings
  - notificaciones_globales
  - oficinas
  - reservas_espacio
  - solicitudes_vacaciones
  - store_pedidos
  - valores_campos_personalizados
  - web_page_categories
  
  ## Security
  Uses optimized (select auth.uid()) pattern for better performance.
*/

-- GMM Quotes: Consolidate policies
DROP POLICY IF EXISTS "Admins can view all quotes" ON gmm_quotes;
DROP POLICY IF EXISTS "Users can view own quotes" ON gmm_quotes;
DROP POLICY IF EXISTS "Admin can view all quotes" ON gmm_quotes;
CREATE POLICY "Users can view quotes"
  ON gmm_quotes FOR SELECT TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Admins can update all quotes" ON gmm_quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON gmm_quotes;
CREATE POLICY "Users can update quotes"
  ON gmm_quotes FOR UPDATE TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- GMM Quotations: Consolidate policies
DROP POLICY IF EXISTS "Admins can view all quotations" ON gmm_quotations;
DROP POLICY IF EXISTS "Users can view own quotations" ON gmm_quotations;
CREATE POLICY "Users can view quotations"
  ON gmm_quotations FOR SELECT TO authenticated
  USING (
    usuario_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- Meetings: Consolidate policies
DROP POLICY IF EXISTS "Meeting hosts can manage" ON meetings;
DROP POLICY IF EXISTS "Participants can view meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view meetings they are part of" ON meetings;
CREATE POLICY "Users can view meetings"
  ON meetings FOR SELECT TO authenticated
  USING (
    host_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM meeting_participants
      WHERE meeting_participants.meeting_id = meetings.id
        AND meeting_participants.usuario_id = (select auth.uid())
    )
  );

CREATE POLICY "Hosts can manage meetings"
  ON meetings FOR ALL TO authenticated
  USING (host_id = (select auth.uid()))
  WITH CHECK (host_id = (select auth.uid()));

-- Notificaciones Globales: Consolidate policies
DROP POLICY IF EXISTS "Admins can manage global notifications" ON notificaciones_globales;
DROP POLICY IF EXISTS "Admins manage notifications" ON notificaciones_globales;
CREATE POLICY "Admins can manage notifications"
  ON notificaciones_globales FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- Oficinas: Consolidate policies
DROP POLICY IF EXISTS "Admins can manage offices" ON oficinas;
DROP POLICY IF EXISTS "Admins manage all offices" ON oficinas;
CREATE POLICY "Admins can manage offices"
  ON oficinas FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

DROP POLICY IF EXISTS "Users can view all offices" ON oficinas;
DROP POLICY IF EXISTS "Authenticated users view offices" ON oficinas;
CREATE POLICY "Users can view offices"
  ON oficinas FOR SELECT TO authenticated
  USING (true);

-- Reservas Espacio: Consolidate policies
DROP POLICY IF EXISTS "Users can view own reservations" ON reservas_espacio;
DROP POLICY IF EXISTS "Admins can view all reservations" ON reservas_espacio;
DROP POLICY IF EXISTS "Users view reservations" ON reservas_espacio;
CREATE POLICY "Users can view reservations"
  ON reservas_espacio FOR SELECT TO authenticated
  USING (
    usuario_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol IN ('Administrador', 'Gerente')
    )
  );

DROP POLICY IF EXISTS "Users can create reservations" ON reservas_espacio;
DROP POLICY IF EXISTS "Users create own reservations" ON reservas_espacio;
CREATE POLICY "Users can create reservations"
  ON reservas_espacio FOR INSERT TO authenticated
  WITH CHECK (usuario_id = (select auth.uid()));

-- Solicitudes Vacaciones: Consolidate policies
DROP POLICY IF EXISTS "Users view own vacation requests" ON solicitudes_vacaciones;
DROP POLICY IF EXISTS "Admins view all requests" ON solicitudes_vacaciones;
DROP POLICY IF EXISTS "Gerentes view office requests" ON solicitudes_vacaciones;
CREATE POLICY "Users can view vacation requests"
  ON solicitudes_vacaciones FOR SELECT TO authenticated
  USING (
    usuario_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u
      JOIN usuarios solicitante ON solicitante.id = solicitudes_vacaciones.usuario_id
      WHERE u.id = (select auth.uid())
        AND u.rol = 'Gerente'
        AND u.oficina_id = solicitante.oficina_id
    )
  );

-- Store Pedidos: Consolidate policies
DROP POLICY IF EXISTS "Users view own orders" ON store_pedidos;
DROP POLICY IF EXISTS "Admins view all orders" ON store_pedidos;
CREATE POLICY "Users can view orders"
  ON store_pedidos FOR SELECT TO authenticated
  USING (
    usuario_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- Valores Campos Personalizados: Consolidate policies
DROP POLICY IF EXISTS "Admins can manage custom field values" ON valores_campos_personalizados;
DROP POLICY IF EXISTS "Admins manage custom values" ON valores_campos_personalizados;
CREATE POLICY "Admins can manage values"
  ON valores_campos_personalizados FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );

-- Web Page Categories: Consolidate policies
DROP POLICY IF EXISTS "Admins can manage categories" ON web_page_categories;
DROP POLICY IF EXISTS "Authenticated can view categories" ON web_page_categories;
CREATE POLICY "Users can view categories"
  ON web_page_categories FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage categories"
  ON web_page_categories FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = (select auth.uid()) AND rol = 'Administrador'
    )
  );
