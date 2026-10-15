/*
  # Drop and recreate get_seguwallet_polizas RPC with full field set

  Drops the previous version (which had fewer return columns) and recreates
  with full sicas_documents fields for the Seguwallet policy detail modal.
*/

DROP FUNCTION IF EXISTS get_seguwallet_polizas(uuid);

CREATE FUNCTION get_seguwallet_polizas(p_auth_id uuid)
RETURNS TABLE (
  id uuid,
  id_docto text,
  poliza text,
  aseguradora_nombre text,
  compania text,
  ramo text,
  subramo text,
  tipo_documento text,
  subtipo_documento text,
  cliente text,
  vend_nombre text,
  agente_nombre text,
  desp_nombre text,
  oficina_nombre text,
  vigencia_desde timestamptz,
  vigencia_hasta timestamptz,
  fecha_emision timestamptz,
  fecha_captura timestamptz,
  is_vigente boolean,
  is_cancelada boolean,
  is_renewable boolean,
  renewal_days_remaining integer,
  status_texto text,
  status_cobro text,
  prima_neta numeric,
  prima_total numeric,
  derechos numeric,
  impuestos numeric,
  recargos numeric,
  importe numeric,
  moneda text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    d.id,
    d.id_docto,
    d.poliza,
    d.aseguradora_nombre,
    d.compania,
    d.ramo,
    d.subramo,
    d.tipo_documento,
    d.subtipo_documento,
    d.cliente,
    d.vend_nombre,
    d.agente_nombre,
    d.desp_nombre,
    d.oficina_nombre,
    d.vigencia_desde,
    d.vigencia_hasta,
    d.fecha_emision,
    d.fecha_captura,
    d.is_vigente,
    d.is_cancelada,
    d.is_renewable,
    d.renewal_days_remaining,
    d.status_texto,
    d.status_cobro,
    d.prima_neta,
    d.prima_total,
    d.derechos,
    d.impuestos,
    d.recargos,
    d.importe,
    d.moneda
  FROM sicas_documents d
  WHERE d.is_poliza = true
    AND d.cliente IN (
      SELECT sc_link.sicas_client_id
      FROM seguwallet_customer_sicas_clients sc_link
      JOIN seguwallet_customers sc ON sc.id = sc_link.seguwallet_customer_id
      WHERE sc.auth_user_id = p_auth_id
        AND sc.status = 'active'
    )
  ORDER BY d.vigencia_hasta DESC NULLS LAST
  LIMIT 300;
$$;

GRANT EXECUTE ON FUNCTION get_seguwallet_polizas(uuid) TO authenticated;
