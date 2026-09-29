-- =============================================================================
-- RLS: corregir políticas que comparan usuarios.rol con literales que no existen
-- =============================================================================
-- Los roles reales en public.usuarios son 'Administrador', 'Gerente', 'Agente'
-- y 'Empleado'. Muchas políticas comparaban con 'admin', 'superadmin',
-- 'gerente', 'ejecutivo', 'administrador' (sensible a mayúsculas), con
-- public.user_roles (vacía), con auth.jwt()->>'role' (siempre 'authenticated')
-- o con raw_app_meta_data->>'rol' = 'Admin'. En la práctica no aplicaban a nadie.
--
-- Este archivo:
--   1. Crea public.usuario_tiene_rol(text[]) — comparación case-insensitive
--      contra usuarios.rol del usuario autenticado.
--   2. Reescribe (ALTER POLICY, conserva nombre/comando/roles) cada política
--      afectada. Mapeo de literales:
--        admin / superadmin / administrador / Admin -> 'Administrador'
--        gerente / Gerente                          -> 'Gerente'
--        ejecutivo                                  -> (se elimina: es un
--          rol_en_equipo de trámites, no un valor de usuarios.rol)
--      Las condiciones adicionales (deleted_at, estado, activo, bucket, etc.)
--      se conservan tal cual.
--
-- Fuera de alcance (ya funcionan o se corrigen en otro lado):
--   - seguros_education_*, cedula_a_*  -> PR #45 (public.se_es_admin()).
--   - clara_*, chava_documentos        -> ya incluyen 'Administrador'/'Gerente'.
--   - quote_forms, quote_form_*        -> get_user_role_for_quotes() ya mapea
--                                         'Administrador' -> 'admin', etc.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.usuario_tiene_rol(p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND lower(u.rol) = ANY (SELECT lower(r) FROM unnest(p_roles) AS r)
  );
$$;

COMMENT ON FUNCTION public.usuario_tiene_rol(text[]) IS
  'true si usuarios.rol del usuario autenticado coincide (sin distinguir mayúsculas) con alguno de p_roles. Usar en RLS como (SELECT public.usuario_tiene_rol(ARRAY[...])).';

REVOKE ALL ON FUNCTION public.usuario_tiene_rol(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.usuario_tiene_rol(text[]) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Gamificación de agentes
-- -----------------------------------------------------------------------------
ALTER POLICY "Admin/Gerente pueden ver todos los eventos" ON public.agent_gamification_events
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])) OR user_id = auth.uid());
ALTER POLICY "Agentes pueden ver sus eventos" ON public.agent_gamification_events
  USING (user_id = auth.uid() OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "Solo admin puede modificar eventos" ON public.agent_gamification_events
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Admin/Gerente pueden ver todos los perfiles" ON public.agent_gamification_profile
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])) OR user_id = auth.uid());
ALTER POLICY "Agentes pueden ver su propio perfil" ON public.agent_gamification_profile
  USING (user_id = auth.uid() OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "Solo admin puede modificar perfiles" ON public.agent_gamification_profile
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Solo admin puede gestionar niveles" ON public.agent_levels
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Agentes pueden ver su progreso" ON public.agent_mission_progress
  USING (user_id = auth.uid() OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));

ALTER POLICY "Admin puede modificar misiones" ON public.agent_missions
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admin puede ver todas las misiones" ON public.agent_missions
  USING (activa = true OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Solo admin puede gestionar misiones" ON public.agent_missions
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Usuarios pueden ver misiones activas" ON public.agent_missions
  USING (activa = true OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Admin puede modificar multiplicadores" ON public.agent_xp_multipliers
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admin puede ver todos los multiplicadores" ON public.agent_xp_multipliers
  USING (activo = true OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Solo admin puede gestionar multiplicadores" ON public.agent_xp_multipliers
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Usuarios pueden ver multiplicadores activos" ON public.agent_xp_multipliers
  USING (activo = true OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

-- -----------------------------------------------------------------------------
-- Catálogos / administración general
-- -----------------------------------------------------------------------------
ALTER POLICY "Admin puede gestionar aseguradoras" ON public.aseguradoras
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Admins can view all analytics" ON public.assistant_mode_analytics
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can view all routing logs" ON public.assistant_routing_logs
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

-- Antes: EXISTS en public.user_roles (tabla vacía) con rol = 'administrador'.
ALTER POLICY "Administradores pueden ver permisos" ON public.aula_eventos_permisos
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Admins can delete categories" ON public.comunicados_categorias
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can insert categories" ON public.comunicados_categorias
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can update categories" ON public.comunicados_categorias
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Solo admin puede actualizar categorías" ON public.publicidad_categorias
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Solo admin puede crear categorías" ON public.publicidad_categorias
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Solo admin puede eliminar categorías" ON public.publicidad_categorias
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Admins can delete loading facts" ON public.loading_facts
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can manage loading facts" ON public.loading_facts
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can update loading facts" ON public.loading_facts
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])))
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Admins can manage notification channels" ON public.notification_channels
  USING (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
    AND EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.deleted_at IS NULL)
  )
  WITH CHECK (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
    AND EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.deleted_at IS NULL)
  );

-- Antes: 'Administrador' vs 'administrador' (sensible a mayúsculas).
ALTER POLICY "Admins can view all notification history" ON public.transactional_notification_history
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "delete_terms_admin" ON public.platform_terms
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "insert_terms_admin" ON public.platform_terms
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "update_terms_admin" ON public.platform_terms
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])))
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "select_all_acceptance_admin" ON public.platform_terms_acceptance
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

-- Original sólo 'gerente' (sin admin); se respeta.
ALTER POLICY "Gerentes can view batches" ON public.production_import_batches
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Gerente'])));

ALTER POLICY "Usuarios pueden ver sus pedidos" ON public.store_pedidos
  USING (
    usuario_id = auth.uid()
    OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente']))
    OR EXISTS (
      SELECT 1
      FROM vendor_mappings v1
      JOIN vendor_mappings v2
        ON v1.source_value = v2.source_value AND v1.source_type = v2.source_type
      WHERE v1.movi_user_id = auth.uid()
        AND v2.movi_user_id = store_pedidos.usuario_id
        AND v1.status = 'active'
        AND v2.status = 'active'
    )
  );

-- -----------------------------------------------------------------------------
-- Lector Qualitas
-- -----------------------------------------------------------------------------
ALTER POLICY "Users can view own export batches" ON public.lector_qualitas_export_batches
  USING (auth.uid() = exported_by_user_id OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "Users can view own export items" ON public.lector_qualitas_export_items
  USING (auth.uid() = exported_by_user_id OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "Users can update extractions" ON public.lector_qualitas_extractions
  USING (auth.uid() = usuario_id OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])))
  WITH CHECK (auth.uid() = usuario_id OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "Users can view office extractions" ON public.lector_qualitas_extractions
  USING (
    auth.uid() = usuario_id
    OR oficina_id IN (SELECT u.oficina_id FROM usuarios u WHERE u.id = auth.uid())
    OR (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
  );

-- -----------------------------------------------------------------------------
-- Monitoreo de sitios (antes: raw_app_meta_data->>'rol' o auth.jwt()->>'role')
-- -----------------------------------------------------------------------------
ALTER POLICY "Admin and gerente can delete monitored sites" ON public.monitored_sites
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "Admin and gerente can insert monitored sites" ON public.monitored_sites
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "Admin and gerente can update monitored sites" ON public.monitored_sites
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])))
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "admin_gerente_can_delete_monitored_sites" ON public.monitored_sites
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "admin_gerente_can_insert_monitored_sites" ON public.monitored_sites
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "admin_gerente_can_update_monitored_sites" ON public.monitored_sites
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])))
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));

ALTER POLICY "Admin and gerente can insert site history" ON public.site_history
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "admin_gerente_can_delete_site_history" ON public.site_history
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "admin_gerente_can_insert_site_history" ON public.site_history
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "admin_gerente_can_update_site_history" ON public.site_history
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])))
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));

ALTER POLICY "Admin and gerente can insert status changes" ON public.status_changes
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "admin_gerente_can_delete_status_changes" ON public.status_changes
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "admin_gerente_can_insert_status_changes" ON public.status_changes
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "admin_gerente_can_update_status_changes" ON public.status_changes
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])))
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));

-- -----------------------------------------------------------------------------
-- SeguWallet
-- -----------------------------------------------------------------------------
ALTER POLICY "Agents can view their claims events" ON public.seguwallet_claims_events
  USING (
    agent_user_id = auth.uid()
    OR (
      (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
      AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.deleted_at IS NULL)
    )
  );

ALTER POLICY "Admins can view all events" ON public.seguwallet_customer_events
  USING (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
    AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
  );

ALTER POLICY "Admin sees all ext policies" ON public.seguwallet_external_policies
  USING (deleted_at IS NULL AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admin sees all ext docs" ON public.seguwallet_external_policy_documents
  USING (deleted_at IS NULL AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admin sees all ext logs" ON public.seguwallet_external_policy_logs
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

-- seguwallet_insurers: 'Administrador'/'Gerente' ya funcionaban; se normaliza.
ALTER POLICY "Admins can delete insurers" ON public.seguwallet_insurers
  USING (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente']))
    AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
  );
ALTER POLICY "Admins can insert insurers" ON public.seguwallet_insurers
  WITH CHECK (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente']))
    AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
  );
ALTER POLICY "Admins can update insurers" ON public.seguwallet_insurers
  USING (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente']))
    AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
  )
  WITH CHECK (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente']))
    AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
  );
ALTER POLICY "Admins can read all insurers" ON public.seguwallet_insurers
  USING (
    (is_active = true AND deleted_at IS NULL)
    OR (
      (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
      AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
    )
  );
ALTER POLICY "Authenticated users can read active insurers" ON public.seguwallet_insurers
  USING (
    (is_active = true AND deleted_at IS NULL)
    OR (
      (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
      AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
    )
  );

ALTER POLICY "Admins can delete terms" ON public.seguwallet_terms
  USING (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
    AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
  );
ALTER POLICY "Admins can insert terms" ON public.seguwallet_terms
  WITH CHECK (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
    AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
  );
ALTER POLICY "Admins can update terms" ON public.seguwallet_terms
  USING (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
    AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
  )
  WITH CHECK (
    (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
    AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
  );
ALTER POLICY "Users can read active terms" ON public.seguwallet_terms
  USING (
    is_active = true
    OR (
      (SELECT public.usuario_tiene_rol(ARRAY['Administrador']))
      AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND (u.estado IS NULL OR u.estado <> 'eliminado'))
    )
  );

-- -----------------------------------------------------------------------------
-- SICAS
-- -----------------------------------------------------------------------------
ALTER POLICY "Admins can view all SICAS logs" ON public.sicas_api_call_logs
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can insert diagnostics" ON public.sicas_api_diagnostics
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can view diagnostics" ON public.sicas_api_diagnostics
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can manage circuit breaker" ON public.sicas_circuit_breaker
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can manage SICAS locks" ON public.sicas_process_locks
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admins can manage rate config" ON public.sicas_rate_config
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])))
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

-- Original: 'admin','gerente','ejecutivo'. 'ejecutivo' no es un usuarios.rol.
ALTER POLICY "Admin and gerente can insert resolutions" ON public.sicas_delivery_resolutions
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "Admin and gerente can update resolutions" ON public.sicas_delivery_resolutions
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])))
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente'])));
ALTER POLICY "Admins can manage all resolutions" ON public.sicas_delivery_resolutions
  USING ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])))
  WITH CHECK ((SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Gerentes can read office resolutions" ON public.sicas_delivery_resolutions
  USING (
    (SELECT public.usuario_tiene_rol(ARRAY['Gerente']))
    AND EXISTS (
      SELECT 1
      FROM usuarios u
      JOIN policy_deliveries pd ON pd.id = sicas_delivery_resolutions.delivery_id
      WHERE u.id = auth.uid()
        AND pd.sicas_office_id = u.oficina_id::text
    )
  );

-- -----------------------------------------------------------------------------
-- storage.objects
-- -----------------------------------------------------------------------------
ALTER POLICY "Admin can read all quote PDFs" ON storage.objects
  USING (bucket_id = 'gmm-quotes' AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

ALTER POLICY "Admin can read tariffs" ON storage.objects
  USING (bucket_id = 'gmm-tariffs' AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
ALTER POLICY "Admin can upload tariffs" ON storage.objects
  WITH CHECK (bucket_id = 'gmm-tariffs' AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));

-- Original: 'admin','gerente','ejecutivo' + activo + deleted_at.
ALTER POLICY "Admins can delete insurance logos" ON storage.objects
  USING (
    bucket_id = 'insurance-carriers-logos'
    AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente']))
    AND EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.activo = true AND usuarios.deleted_at IS NULL)
  );
ALTER POLICY "Admins can update insurance logos" ON storage.objects
  USING (
    bucket_id = 'insurance-carriers-logos'
    AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente']))
    AND EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.activo = true AND usuarios.deleted_at IS NULL)
  );
ALTER POLICY "Admins can upload insurance logos" ON storage.objects
  WITH CHECK (
    bucket_id = 'insurance-carriers-logos'
    AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador','Gerente']))
    AND EXISTS (SELECT 1 FROM usuarios WHERE usuarios.id = auth.uid() AND usuarios.activo = true AND usuarios.deleted_at IS NULL)
  );

ALTER POLICY "Admins can manage migration temp" ON storage.objects
  USING (bucket_id = 'videos-migration-temp' AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])))
  WITH CHECK (bucket_id = 'videos-migration-temp' AND (SELECT public.usuario_tiene_rol(ARRAY['Administrador'])));
