-- Values verified against the original insurer kits recovered from Gmail.
-- No credentials are stored in this migration.

UPDATE public.multi_autos_aseguradoras
SET derecho_poliza = 720,
    configuracion = COALESCE(configuracion, '{}'::jsonb) || jsonb_build_object(
      'derecho_poliza', '720',
      'business_values_source', 'Matriz oficial SW JIRO 06983/82153',
      'formas_pago', jsonb_build_object(
        'contado', 'C',
        'semestral', 'S',
        'trimestral', 'T',
        'mensual', 'M'
      ),
      'uso_autos', '1',
      'uso_pickup_personal', '5',
      'uso_pickup_carga', '6',
      'servicio_particular', '1'
    )
WHERE nombre = 'Qualitas';

UPDATE public.multi_autos_aseguradoras
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || jsonb_build_object(
  'folio', 'P0011723',
  'participante_agente', 'JIAASF12D74C',
  'subramo_residente', '01',
  'uso_particular', '01',
  'paquetes_persona_fisica_auto_residente', jsonb_build_object(
    'Amplia', 'PRS0009355',
    'Limitada', 'PRS0009356',
    'Responsabilidad Civil', 'PRP0000289',
    'Premium', 'PRS0010536',
    'Auto Elite', 'PRP0000357'
  ),
  'business_values_source', 'Kit GNP - Multicotizador JIRO.xlsx'
)
WHERE nombre = 'GNP';

UPDATE public.multi_autos_aseguradoras
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || jsonb_build_object(
  'planes', jsonb_build_object(
    'Amplia', '1',
    'UPT', '2',
    'Limitada', '3',
    'Responsabilidad Civil', '4',
    'Responsabilidad Civil Pura', '5'
  ),
  'xml_whitespace_rule', 'El nodo XML debe enviarse como string sin espacios ni saltos de linea',
  'business_values_source', 'Manual Servicio WEB ANA V7 y ejemplos oficiales'
)
WHERE nombre = 'ANA Seguros';
