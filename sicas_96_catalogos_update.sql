-- =====================================================
-- Script de Actualización: 96 Catálogos SICAS Oficiales
-- Ejecutar en: Supabase SQL Editor
-- =====================================================

-- Paso 1: Actualizar catálogos existentes (1-61) con nombres oficiales
UPDATE sicas_catalog_types SET name = 'Tipo_Ejecutivo', enum_name = 'eTipo_Ejecutivo', description = 'Tipos de Ejecutivos', is_mappable = false, requires_auth = true WHERE id = 1;
UPDATE sicas_catalog_types SET name = 'Tipo_Vendedor', enum_name = 'eTipo_Vendedor', description = 'Tipos de Vendedores', is_mappable = false, requires_auth = true WHERE id = 2;
UPDATE sicas_catalog_types SET name = 'Tipo_Venta', enum_name = 'eTipo_Venta', description = 'Tipos de Venta', is_mappable = false, requires_auth = true WHERE id = 3;
UPDATE sicas_catalog_types SET name = 'Tipo_Pago', enum_name = 'eTipo_Pago', description = 'Tipos de Pago', is_mappable = false, requires_auth = true WHERE id = 4;
UPDATE sicas_catalog_types SET name = 'Tipo_Ingreso', enum_name = 'eTipo_Ingreso', description = 'Tipos de Ingreso', is_mappable = false, requires_auth = true WHERE id = 5;
UPDATE sicas_catalog_types SET name = 'Tipo_Docto', enum_name = 'eTipo_Docto', description = 'Tipos de Documento', is_mappable = false, requires_auth = true WHERE id = 6;
UPDATE sicas_catalog_types SET name = 'Tipo_Entidad', enum_name = 'eTipo_Entidad', description = 'Tipos de Entidad (PF/PM)', is_mappable = false, requires_auth = true WHERE id = 7;
UPDATE sicas_catalog_types SET name = 'Tipo_Cia', enum_name = 'eTipo_Cia', description = 'Tipos de Compañía', is_mappable = false, requires_auth = true WHERE id = 8;
UPDATE sicas_catalog_types SET name = 'Clasificacion_Cia', enum_name = 'eClasificacion_Cia', description = 'Clasificación de Compañías', is_mappable = false, requires_auth = true WHERE id = 9;
UPDATE sicas_catalog_types SET name = 'Oficias', enum_name = 'eOficias', description = 'Catálogo de Oficinas SICAS', is_mappable = true, requires_auth = true WHERE id = 10;
UPDATE sicas_catalog_types SET name = 'Despachos', enum_name = 'eDespachos', description = 'Catálogo de Despachos', is_mappable = true, requires_auth = true WHERE id = 11;
UPDATE sicas_catalog_types SET name = 'Companias', enum_name = 'eCompanias', description = 'Catálogo de Compañías Aseguradoras', is_mappable = false, requires_auth = true WHERE id = 12;
UPDATE sicas_catalog_types SET name = 'Agentes', enum_name = 'eAgentes', description = 'Catálogo de Agentes', is_mappable = true, requires_auth = true WHERE id = 13;
UPDATE sicas_catalog_types SET name = 'Carteras', enum_name = 'eCarteras', description = 'Catálogo de Carteras', is_mappable = false, requires_auth = true WHERE id = 14;
UPDATE sicas_catalog_types SET name = 'Sub_Carteras', enum_name = 'eSub_Carteras', description = 'Catálogo de Sub-Carteras', is_mappable = false, requires_auth = true WHERE id = 15;
UPDATE sicas_catalog_types SET name = 'Tipo_Cedula', enum_name = 'eTipo_Cedula', description = 'Tipos de Cédula', is_mappable = false, requires_auth = true WHERE id = 16;
UPDATE sicas_catalog_types SET name = 'Tipo_Agente', enum_name = 'eTipo_Agente', description = 'Tipos de Agente', is_mappable = false, requires_auth = true WHERE id = 17;
UPDATE sicas_catalog_types SET name = 'Promotorias', enum_name = 'ePromotorias', description = 'Catálogo de Promotorías', is_mappable = false, requires_auth = true WHERE id = 18;
UPDATE sicas_catalog_types SET name = 'Grupos', enum_name = 'eGrupos', description = 'Catálogo de Grupos', is_mappable = false, requires_auth = true WHERE id = 19;
UPDATE sicas_catalog_types SET name = 'SubGrupos', enum_name = 'eSubGrupos', description = 'Catálogo de Sub-Grupos', is_mappable = false, requires_auth = true WHERE id = 20;
UPDATE sicas_catalog_types SET name = 'SubSubGrupos', enum_name = 'eSubSubGrupos', description = 'Catálogo de Sub-Sub-Grupos', is_mappable = false, requires_auth = true WHERE id = 21;
UPDATE sicas_catalog_types SET name = 'Contacto', enum_name = 'eContacto', description = 'Catálogo de Contactos', is_mappable = false, requires_auth = true WHERE id = 22;
UPDATE sicas_catalog_types SET name = 'Formas_Entero', enum_name = 'eFormas_Entero', description = 'Formas de Entero', is_mappable = false, requires_auth = true WHERE id = 23;
UPDATE sicas_catalog_types SET name = 'Clasificacion_Contacto', enum_name = 'eClasificacion_Contacto', description = 'Clasificación de Contactos', is_mappable = false, requires_auth = true WHERE id = 24;
UPDATE sicas_catalog_types SET name = 'Formatos_Mail', enum_name = 'eFormatos_Mail', description = 'Formatos de Email', is_mappable = false, requires_auth = true WHERE id = 25;
UPDATE sicas_catalog_types SET name = 'Sexos', enum_name = 'eSexos', description = 'Catálogo de Sexos', is_mappable = false, requires_auth = true WHERE id = 26;
UPDATE sicas_catalog_types SET name = 'Idiomas', enum_name = 'eIdiomas', description = 'Catálogo de Idiomas', is_mappable = false, requires_auth = true WHERE id = 27;
UPDATE sicas_catalog_types SET name = 'Grupo_Afinidad', enum_name = 'eGrupo_Afinidad', description = 'Grupos de Afinidad', is_mappable = false, requires_auth = true WHERE id = 28;
UPDATE sicas_catalog_types SET name = 'Cliente', enum_name = 'eCliente', description = 'Catálogo de Clientes', is_mappable = false, requires_auth = true WHERE id = 29;
UPDATE sicas_catalog_types SET name = 'Proceso_Actualizacion_Cli', enum_name = 'eProceso_Actualizacion_Cli', description = 'Procesos de Actualización de Clientes', is_mappable = false, requires_auth = true WHERE id = 30;
UPDATE sicas_catalog_types SET name = 'Status_Cliente', enum_name = 'eStatus_Cliente', description = 'Status de Clientes', is_mappable = false, requires_auth = true WHERE id = 31;
UPDATE sicas_catalog_types SET name = 'Vendedores', enum_name = 'eVendedores', description = 'Catálogo de Vendedores', is_mappable = true, requires_auth = true WHERE id = 32;
UPDATE sicas_catalog_types SET name = 'Ejecutivos', enum_name = 'eEjecutivos', description = 'Catálogo de Ejecutivos', is_mappable = true, requires_auth = true WHERE id = 33;
UPDATE sicas_catalog_types SET name = 'Agentes_Cia_Ramo', enum_name = 'eAgentes_Cia_Ramo', description = 'Agentes por Compañía y Ramo', is_mappable = false, requires_auth = true WHERE id = 34;
UPDATE sicas_catalog_types SET name = 'Ramos_Cia', enum_name = 'eRamos_Cia', description = 'Ramos por Compañía', is_mappable = false, requires_auth = true WHERE id = 35;
UPDATE sicas_catalog_types SET name = 'Formas_Pago', enum_name = 'eFormas_Pago', description = 'Formas de Pago', is_mappable = false, requires_auth = true WHERE id = 36;
UPDATE sicas_catalog_types SET name = 'Monedas', enum_name = 'eMonedas', description = 'Catálogo de Monedas', is_mappable = false, requires_auth = true WHERE id = 37;
UPDATE sicas_catalog_types SET name = 'Beneficiarios', enum_name = 'eBeneficiarios', description = 'Catálogo de Beneficiarios', is_mappable = false, requires_auth = true WHERE id = 38;
UPDATE sicas_catalog_types SET name = 'Tipo_Beneficiarios', enum_name = 'eTipo_Beneficiarios', description = 'Tipos de Beneficiarios', is_mappable = false, requires_auth = true WHERE id = 39;
UPDATE sicas_catalog_types SET name = 'Tipo_Cond_Cobro', enum_name = 'eTipo_Cond_Cobro', description = 'Tipos de Condición de Cobro', is_mappable = false, requires_auth = true WHERE id = 40;
UPDATE sicas_catalog_types SET name = 'Conducto_Cobro', enum_name = 'eConducto_Cobro', description = 'Conductos de Cobro', is_mappable = false, requires_auth = true WHERE id = 41;
UPDATE sicas_catalog_types SET name = 'Carrier', enum_name = 'eCarrier', description = 'Catálogo de Carriers', is_mappable = false, requires_auth = true WHERE id = 42;
UPDATE sicas_catalog_types SET name = 'Tipo_Tarjeta', enum_name = 'eTipo_Tarjeta', description = 'Tipos de Tarjeta', is_mappable = false, requires_auth = true WHERE id = 43;
UPDATE sicas_catalog_types SET name = 'Status_Endosos', enum_name = 'eStatus_Endosos', description = 'Status de Endosos', is_mappable = false, requires_auth = true WHERE id = 44;
UPDATE sicas_catalog_types SET name = 'Efectos_Endosos', enum_name = 'eEfectos_Endosos', description = 'Efectos de Endosos', is_mappable = false, requires_auth = true WHERE id = 45;
UPDATE sicas_catalog_types SET name = 'Tipos_Pagos_Doctos', enum_name = 'eTipos_Pagos_Doctos', description = 'Tipos de Pagos de Documentos', is_mappable = false, requires_auth = true WHERE id = 46;
UPDATE sicas_catalog_types SET name = 'Clasificacion_Doctos', enum_name = 'eClasificacion_Doctos', description = 'Clasificación de Documentos', is_mappable = false, requires_auth = true WHERE id = 47;
UPDATE sicas_catalog_types SET name = 'Motivo_Ext_Prima', enum_name = 'eMotivo_Ext_Prima', description = 'Motivos de Extensión de Prima', is_mappable = false, requires_auth = true WHERE id = 48;
UPDATE sicas_catalog_types SET name = 'Tipo_Benef_Vida', enum_name = 'eTipo_Benef_Vida', description = 'Tipos de Beneficiarios de Vida', is_mappable = false, requires_auth = true WHERE id = 49;
UPDATE sicas_catalog_types SET name = 'Ramos', enum_name = 'eRamos', description = 'Catálogo de Ramos', is_mappable = false, requires_auth = true WHERE id = 50;
UPDATE sicas_catalog_types SET name = 'SubRamos', enum_name = 'eSubRamos', description = 'Catálogo de Sub-Ramos', is_mappable = false, requires_auth = true WHERE id = 51;
UPDATE sicas_catalog_types SET name = 'Status_Docto_User', enum_name = 'eStatus_Docto_User', description = 'Status de Documento por Usuario', is_mappable = false, requires_auth = true WHERE id = 52;
UPDATE sicas_catalog_types SET name = 'Status_Docto_Cobro', enum_name = 'eStatus_Docto_Cobro', description = 'Status de Documento en Cobro', is_mappable = false, requires_auth = true WHERE id = 53;
UPDATE sicas_catalog_types SET name = 'Status_Documentos', enum_name = 'eStatus_Documentos', description = 'Status de Documentos', is_mappable = false, requires_auth = true WHERE id = 54;
UPDATE sicas_catalog_types SET name = 'Status_Fianzas', enum_name = 'eStatus_Fianzas', description = 'Status de Fianzas', is_mappable = false, requires_auth = true WHERE id = 55;
UPDATE sicas_catalog_types SET name = 'Marcar_Docto', enum_name = 'eMarcar_Docto', description = 'Marcar Documentos', is_mappable = false, requires_auth = true WHERE id = 56;
UPDATE sicas_catalog_types SET name = 'Familiares', enum_name = 'eFamiliares', description = 'Catálogo de Familiares', is_mappable = false, requires_auth = true WHERE id = 57;
UPDATE sicas_catalog_types SET name = 'Agentes_Cia', enum_name = 'eAgentes_Cia', description = 'Agentes por Compañía', is_mappable = false, requires_auth = true WHERE id = 58;
UPDATE sicas_catalog_types SET name = 'Tipo_Mercancias', enum_name = 'eTipo_Mercancias', description = 'Tipos de Mercancías', is_mappable = false, requires_auth = true WHERE id = 59;
UPDATE sicas_catalog_types SET name = 'Documentos_Cliente', enum_name = 'eDocumentos_Cliente', description = 'Documentos por Cliente', is_mappable = false, requires_auth = true WHERE id = 60;
UPDATE sicas_catalog_types SET name = 'Endosos_Docto', enum_name = 'eEndosos_Docto', description = 'Endosos por Documento', is_mappable = false, requires_auth = true WHERE id = 61;

-- Paso 2: Insertar nuevos catálogos (62-96)
INSERT INTO sicas_catalog_types (id, name, enum_name, description, is_mappable, requires_auth) VALUES
(62, 'Documentos_Unico', 'eDocumentos_Unico', 'Documentos Únicos', false, true),
(63, 'Tipo_Declaracion_Trans', 'eTipo_Declaracion_Trans', 'Tipos de Declaración de Transportes', false, true),
(64, 'Gerencias', 'eGerencias', 'Catálogo de Gerencias', false, true),
(65, 'Status_Reclamos', 'eStatus_Reclamos', 'Status de Reclamos', false, true),
(66, 'Tarjetas_Cliente', 'eTarjetas_Cliente', 'Tarjetas por Cliente', false, true),
(67, 'Cercania_Mar', 'eCercania_Mar', 'Cercanía al Mar', false, true),
(68, 'Cercania_Rio', 'eCercania_Rio', 'Cercanía a Ríos', false, true),
(69, 'Status_Rec_User', 'eStatus_Rec_User', 'Status de Recibo por Usuario', false, true),
(70, 'Status_Recibos', 'eStatus_Recibos', 'Status de Recibos', false, true),
(71, 'Doctos_Pago_Docto', 'eDoctos_Pago_Docto', 'Documentos de Pago por Documento', false, true),
(72, 'Doctos_Pago_Unico', 'eDoctos_Pago_Unico', 'Documentos de Pago Únicos', false, true),
(73, 'Parentesco_Dependientes', 'eParentesco_Dependientes', 'Parentesco de Dependientes', false, true),
(74, 'Ejecutivos_Cia', 'eEjecutivos_Cia', 'Ejecutivos por Compañía', false, true),
(75, 'Tipo_Pago_Docto', 'eTipo_Pago_Docto', 'Tipos de Pago de Documento', false, true),
(76, 'Siniestro_Unico', 'eSiniestro_Unico', 'Siniestros Únicos', false, true),
(77, 'Siniestros_Docto', 'eSiniestros_Docto', 'Siniestros por Documento', false, true),
(78, 'Campania_Status', 'eCampania_Status', 'Status de Campañas', false, true),
(79, 'Campania_Medio', 'eCampania_Medio', 'Medios de Campaña', false, true),
(80, 'Productos_Cia', 'eProductos_Cia', 'Productos por Compañía', false, true),
(81, 'Productos_Unico', 'eProductos_Unico', 'Productos Únicos', false, true),
(82, 'Coberturas_Plan', 'eCoberturas_Plan', 'Coberturas por Plan', false, true),
(83, 'Direcciones_Cliente', 'eDirecciones_Cliente', 'Direcciones por Cliente', false, true),
(84, 'Direcciones', 'eDirecciones', 'Catálogo de Direcciones', false, true),
(85, 'Direccion_Unica', 'eDireccion_Unica', 'Direcciones Únicas', false, true),
(86, 'Uso_Vehiculo', 'eUso_Vehiculo', 'Usos de Vehículos', false, true),
(87, 'Tipo_Servicio', 'eTipo_Servicio', 'Tipos de Servicio', false, true),
(88, 'Color', 'eColor', 'Catálogo de Colores', false, true),
(89, 'Emisoras', 'eEmisoras', 'Catálogo de Emisoras', false, true),
(90, 'Recibos_Docto', 'eRecibos_Docto', 'Recibos por Documento', false, true),
(91, 'Recibos_Endoso', 'eRecibos_Endoso', 'Recibos por Endoso', false, true),
(92, 'Pagos_Recibos', 'ePagos_Recibos', 'Pagos de Recibos', false, true),
(93, 'Documento_Detail', 'eDocumento_Detail', 'Detalle de Documentos', false, true),
(94, 'Documento_Coberturas', 'eDocumento_Coberturas', 'Coberturas de Documentos', false, true),
(95, 'Documento_Dependientes', 'eDocumento_Dependientes', 'Dependientes de Documentos', false, true),
(96, 'Documento_Beneficiarios', 'eDocumento_Beneficiarios', 'Beneficiarios de Documentos', false, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  enum_name = EXCLUDED.enum_name,
  description = EXCLUDED.description,
  is_mappable = EXCLUDED.is_mappable,
  requires_auth = EXCLUDED.requires_auth;

-- Paso 3: Actualizar constraint de catalog_type_id en sicas_sync_history
ALTER TABLE sicas_sync_history DROP CONSTRAINT IF EXISTS sicas_sync_history_catalog_type_id_check;
ALTER TABLE sicas_sync_history ADD CONSTRAINT sicas_sync_history_catalog_type_id_check
  CHECK (catalog_type_id >= 1 AND catalog_type_id <= 96);

-- Paso 4: Actualizar comentarios
COMMENT ON TABLE sicas_catalog_types IS 'Define los 96 tipos de catálogos disponibles en SICAS';

-- Paso 5: Validar que todos los catálogos existan
DO $$
DECLARE
  missing_catalogs INTEGER;
  total_catalogs INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_catalogs
  FROM generate_series(1, 96) AS expected_id
  WHERE NOT EXISTS (
    SELECT 1 FROM sicas_catalog_types WHERE id = expected_id
  );

  SELECT COUNT(*) INTO total_catalogs FROM sicas_catalog_types WHERE id BETWEEN 1 AND 96;

  IF missing_catalogs > 0 THEN
    RAISE EXCEPTION 'Faltan % catálogos en sicas_catalog_types', missing_catalogs;
  END IF;

  RAISE NOTICE '✅ Validación completa: Los 96 catálogos SICAS están correctamente configurados';
  RAISE NOTICE '📊 Total de catálogos: %', total_catalogs;
  RAISE NOTICE '🔗 Catálogos mapeables: ID 10 (Oficias), 11 (Despachos), 13 (Agentes), 32 (Vendedores), 33 (Ejecutivos)';
END $$;

-- Paso 6: Mostrar resumen de catálogos mapeables
SELECT
  id,
  enum_name,
  name,
  description,
  is_mappable,
  created_at
FROM sicas_catalog_types
WHERE is_mappable = true
ORDER BY id;
