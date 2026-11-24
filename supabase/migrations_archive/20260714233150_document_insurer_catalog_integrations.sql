-- Record the official catalog discovery strategy and current environment.
-- Credentials remain exclusively in Edge Function secrets.

UPDATE public.multi_autos_aseguradoras
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || jsonb_build_object(
  'catalog_strategy', 'webservice',
  'catalog_methods', jsonb_build_array('Categoria', 'Marca', 'SubMarca', 'CatVeh', 'Vehiculo'),
  'quote_method', 'Transaccion',
  'catalog_mapping_field', 'clave_ana'
)
WHERE nombre = 'ANA Seguros';

UPDATE public.multi_autos_aseguradoras
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || jsonb_build_object(
  'catalog_strategy', 'api',
  'catalog_url', 'https://api.service.gnp.com.mx/autos/wsp/catalogos/catalogo',
  'catalog_types', jsonb_build_array(
    'VEHICULOS',
    'ARMADORA_VEHICULO',
    'CARROCERIA_VEHICULO',
    'VERSION_VEHICULO'
  ),
  'catalog_mapping_fields', jsonb_build_array('armadora_gnp', 'carroceria_gnp', 'version_gnp')
)
WHERE nombre = 'GNP';

UPDATE public.multi_autos_aseguradoras
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || jsonb_build_object(
  'environment', 'implementation',
  'catalog_strategy', 'webservice',
  'catalog_methods', jsonb_build_array(
    'ObtenerMarcas',
    'ObtenerModelos',
    'ObtenerTipos',
    'ObtenerTransmisiones',
    'ObtenerVersiones',
    'ObtenerVehiculoVersiones',
    'ObtenerClaveVehiculo'
  ),
  'quote_method', 'ObtenerMultiPaquetesExpress',
  'catalog_mapping_field', 'clave_hdi'
)
WHERE nombre = 'HDI Seguros';

UPDATE public.multi_autos_aseguradoras
SET configuracion = COALESCE(configuracion, '{}'::jsonb) || jsonb_build_object(
  'environment', 'qa',
  'quote_method', 'QBCDE',
  'blocking_issue', 'Incapsula HTTP 503 desde la red de Supabase; requiere allowlist de egreso o endpoint alternativo'
)
WHERE nombre = 'Qualitas';
