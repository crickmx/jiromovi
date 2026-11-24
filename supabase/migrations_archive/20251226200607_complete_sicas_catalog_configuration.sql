/*
  # Configuración Completa de Catálogos SICAS

  1. Actualización de Catálogos
    - Corregir nombres y descripciones
    - Agregar información faltante
    - Marcar catálogos mapeables correctamente

  2. Validación
    - Todos los 61 catálogos deben estar presentes
    - Información completa y consistente
*/

-- Actualizar catálogos existentes con información completa
UPDATE sicas_catalog_types SET
  description = 'Catálogo de Estados de la República Mexicana',
  requires_auth = true
WHERE id = 1;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Municipios por Estado',
  requires_auth = true
WHERE id = 2;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Colonias por Municipio',
  requires_auth = true
WHERE id = 3;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Códigos Postales (SEPOMEX)',
  requires_auth = true
WHERE id = 4;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Países',
  requires_auth = true
WHERE id = 5;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Monedas (MXN, USD, EUR, etc)',
  requires_auth = true
WHERE id = 6;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Instituciones Bancarias',
  requires_auth = true
WHERE id = 7;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Formas de Pago (Contado, Mensual, Anual, etc)',
  requires_auth = true
WHERE id = 8;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Ramos de Seguros (Autos, Vida, GMM, etc)',
  requires_auth = true
WHERE id = 9;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de SubRamos dentro de cada Ramo',
  requires_auth = true
WHERE id = 10;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Despachos / Oficinas SICAS',
  is_mappable = true,
  requires_auth = true
WHERE id = 11;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Compañías Aseguradoras',
  requires_auth = true
WHERE id = 12;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Productos de Seguros por Aseguradora',
  requires_auth = true
WHERE id = 13;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Planes dentro de cada Producto',
  requires_auth = true
WHERE id = 14;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Agentes de Seguros',
  is_mappable = true,
  requires_auth = true
WHERE id = 15;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Ejecutivos de Cuenta',
  is_mappable = true,
  requires_auth = true
WHERE id = 16;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Contactos (Personas Físicas y Morales)',
  requires_auth = true
WHERE id = 17;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Entidad (PF/PM)',
  requires_auth = true
WHERE id = 18;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Sexo (Masculino/Femenino)',
  requires_auth = true
WHERE id = 19;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Estado Civil',
  requires_auth = true
WHERE id = 20;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Profesiones',
  requires_auth = true
WHERE id = 21;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Puestos de Trabajo',
  requires_auth = true
WHERE id = 22;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Documentos (Pólizas, Endosos)',
  requires_auth = true
WHERE id = 23;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Documento',
  requires_auth = true
WHERE id = 24;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Archivo',
  requires_auth = true
WHERE id = 25;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Pago',
  requires_auth = true
WHERE id = 26;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Moneda',
  requires_auth = true
WHERE id = 27;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Cambio',
  requires_auth = true
WHERE id = 28;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Cobranza',
  requires_auth = true
WHERE id = 29;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Comisión',
  requires_auth = true
WHERE id = 30;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Usuarios del Sistema SICAS',
  is_mappable = true,
  requires_auth = true
WHERE id = 31;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Vendedores',
  is_mappable = true,
  requires_auth = true
WHERE id = 32;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Sucursales',
  requires_auth = true
WHERE id = 33;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Oficinas dentro de SICAS',
  is_mappable = true,
  requires_auth = true
WHERE id = 34;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Regímenes Fiscales (RIF, RESICO, etc)',
  requires_auth = true
WHERE id = 35;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Impuestos (IVA, ISR, etc)',
  requires_auth = true
WHERE id = 36;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Recibos',
  requires_auth = true
WHERE id = 37;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Pagos Registrados',
  requires_auth = true
WHERE id = 38;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Cancelaciones',
  requires_auth = true
WHERE id = 39;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Estatus Generales',
  requires_auth = true
WHERE id = 40;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Motivos',
  requires_auth = true
WHERE id = 41;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de SubMotivos',
  requires_auth = true
WHERE id = 42;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Centros Digitales',
  requires_auth = true
WHERE id = 43;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Carpetas del Centro Digital',
  requires_auth = true
WHERE id = 44;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de SubCarpetas del Centro Digital',
  requires_auth = true
WHERE id = 45;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Estatus específicos para Seguros',
  requires_auth = true
WHERE id = 46;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Estatus específicos para Fianzas',
  requires_auth = true
WHERE id = 47;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Reportes Disponibles',
  requires_auth = true
WHERE id = 48;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Comisiones',
  requires_auth = true
WHERE id = 49;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Cobranza',
  requires_auth = true
WHERE id = 50;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Pólizas',
  requires_auth = true
WHERE id = 51;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Endosos',
  requires_auth = true
WHERE id = 52;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Renovaciones',
  requires_auth = true
WHERE id = 53;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Endoso',
  requires_auth = true
WHERE id = 54;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Motivos de Cancelación',
  requires_auth = true
WHERE id = 55;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Motivos de Endoso',
  requires_auth = true
WHERE id = 56;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Series de Documentos',
  requires_auth = true
WHERE id = 57;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Folios',
  requires_auth = true
WHERE id = 58;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Tipos de Usuario',
  requires_auth = true
WHERE id = 59;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Roles de Usuario',
  requires_auth = true
WHERE id = 60;

UPDATE sicas_catalog_types SET
  description = 'Catálogo de Permisos del Sistema',
  requires_auth = true
WHERE id = 61;

-- Verificar que todos los catálogos existan
DO $$
DECLARE
  missing_catalogs INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_catalogs
  FROM generate_series(1, 61) AS expected_id
  WHERE NOT EXISTS (
    SELECT 1 FROM sicas_catalog_types WHERE id = expected_id
  );

  IF missing_catalogs > 0 THEN
    RAISE EXCEPTION 'Faltan % catálogos en sicas_catalog_types', missing_catalogs;
  END IF;

  RAISE NOTICE 'Validación completa: Los 61 catálogos SICAS están correctamente configurados';
END $$;

-- Crear función para verificar estado de configuración
CREATE OR REPLACE FUNCTION get_sicas_configuration_status()
RETURNS TABLE (
  total_catalog_types BIGINT,
  mappable_catalogs BIGINT,
  synced_catalogs BIGINT,
  total_catalog_records BIGINT,
  last_global_sync TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_catalog_types,
    COUNT(*) FILTER (WHERE is_mappable = true) as mappable_catalogs,
    COUNT(DISTINCT sc.catalog_type_id) as synced_catalogs,
    COALESCE(SUM(record_count), 0) as total_catalog_records,
    MAX(last_sync) as last_global_sync
  FROM sicas_catalog_types ct
  LEFT JOIN (
    SELECT
      catalog_type_id,
      COUNT(*) as record_count,
      MAX(last_sync_at) as last_sync
    FROM sicas_catalogos
    GROUP BY catalog_type_id
  ) sc ON sc.catalog_type_id = ct.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_sicas_configuration_status() IS 'Retorna estadísticas generales del sistema SICAS';
