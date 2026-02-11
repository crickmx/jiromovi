-- =====================================================
-- Script de Actualización: 96 Catálogos SICAS Oficiales
-- Ejecutar en: Supabase SQL Editor
-- =====================================================

-- Paso 1: Eliminar restricción de unicidad en nombre (si existe)
DO $$
BEGIN
  ALTER TABLE sicas_catalog_types DROP CONSTRAINT IF EXISTS sicas_catalog_types_name_key;
  RAISE NOTICE '✓ Restricción de unicidad en name eliminada';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠ No se pudo eliminar restricción: %', SQLERRM;
END $$;

-- Paso 2: Limpiar datos existentes
TRUNCATE TABLE sicas_catalog_types RESTART IDENTITY CASCADE;
RAISE NOTICE '✓ Tabla limpiada';

-- Paso 3: Insertar los 96 catálogos oficiales SICAS
INSERT INTO sicas_catalog_types (id, name, enum_name, description, is_mappable, requires_auth) VALUES
-- Catálogos 1-20
(1, 'Tipo_Ejecutivo', 'eTipo_Ejecutivo', 'Tipos de Ejecutivos', false, true),
(2, 'Tipo_Vendedor', 'eTipo_Vendedor', 'Tipos de Vendedores', false, true),
(3, 'Tipo_Venta', 'eTipo_Venta', 'Tipos de Venta', false, true),
(4, 'Tipo_Pago', 'eTipo_Pago', 'Tipos de Pago', false, true),
(5, 'Tipo_Ingreso', 'eTipo_Ingreso', 'Tipos de Ingreso', false, true),
(6, 'Tipo_Docto', 'eTipo_Docto', 'Tipos de Documento', false, true),
(7, 'Tipo_Entidad', 'eTipo_Entidad', 'Tipos de Entidad (PF/PM)', false, true),
(8, 'Tipo_Cia', 'eTipo_Cia', 'Tipos de Compañía', false, true),
(9, 'Clasificacion_Cia', 'eClasificacion_Cia', 'Clasificación de Compañías', false, true),
(10, 'Oficias', 'eOficias', 'Catálogo de Oficinas SICAS', true, true),
(11, 'Despachos', 'eDespachos', 'Catálogo de Despachos', true, true),
(12, 'Companias', 'eCompanias', 'Catálogo de Compañías Aseguradoras', false, true),
(13, 'Agentes', 'eAgentes', 'Catálogo de Agentes', true, true),
(14, 'Carteras', 'eCarteras', 'Catálogo de Carteras', false, true),
(15, 'Sub_Carteras', 'eSub_Carteras', 'Catálogo de Sub-Carteras', false, true),
(16, 'Tipo_Cedula', 'eTipo_Cedula', 'Tipos de Cédula', false, true),
(17, 'Tipo_Agente', 'eTipo_Agente', 'Tipos de Agente', false, true),
(18, 'Promotorias', 'ePromotorias', 'Catálogo de Promotorías', false, true),
(19, 'Grupos', 'eGrupos', 'Catálogo de Grupos', false, true),
(20, 'SubGrupos', 'eSubGrupos', 'Catálogo de Sub-Grupos', false, true),

-- Catálogos 21-40
(21, 'SubSubGrupos', 'eSubSubGrupos', 'Catálogo de Sub-Sub-Grupos', false, true),
(22, 'Contacto', 'eContacto', 'Catálogo de Contactos', false, true),
(23, 'Formas_Entero', 'eFormas_Entero', 'Formas de Entero', false, true),
(24, 'Clasificacion_Contacto', 'eClasificacion_Contacto', 'Clasificación de Contactos', false, true),
(25, 'Formatos_Mail', 'eFormatos_Mail', 'Formatos de Email', false, true),
(26, 'Sexos', 'eSexos', 'Catálogo de Sexos', false, true),
(27, 'Idiomas', 'eIdiomas', 'Catálogo de Idiomas', false, true),
(28, 'Grupo_Afinidad', 'eGrupo_Afinidad', 'Grupos de Afinidad', false, true),
(29, 'Cliente', 'eCliente', 'Catálogo de Clientes', false, true),
(30, 'Proceso_Actualizacion_Cli', 'eProceso_Actualizacion_Cli', 'Procesos de Actualización de Clientes', false, true),
(31, 'Status_Cliente', 'eStatus_Cliente', 'Status de Clientes', false, true),
(32, 'Vendedores', 'eVendedores', 'Catálogo de Vendedores', true, true),
(33, 'Ejecutivos', 'eEjecutivos', 'Catálogo de Ejecutivos', true, true),
(34, 'Agentes_Cia_Ramo', 'eAgentes_Cia_Ramo', 'Agentes por Compañía y Ramo', false, true),
(35, 'Ramos_Cia', 'eRamos_Cia', 'Ramos por Compañía', false, true),
(36, 'Formas_Pago', 'eFormas_Pago', 'Formas de Pago', false, true),
(37, 'Monedas', 'eMonedas', 'Catálogo de Monedas', false, true),
(38, 'Beneficiarios', 'eBeneficiarios', 'Catálogo de Beneficiarios', false, true),
(39, 'Tipo_Beneficiarios', 'eTipo_Beneficiarios', 'Tipos de Beneficiarios', false, true),
(40, 'Tipo_Cond_Cobro', 'eTipo_Cond_Cobro', 'Tipos de Condición de Cobro', false, true),

-- Catálogos 41-60
(41, 'Conducto_Cobro', 'eConducto_Cobro', 'Conductos de Cobro', false, true),
(42, 'Carrier', 'eCarrier', 'Catálogo de Carriers', false, true),
(43, 'Tipo_Tarjeta', 'eTipo_Tarjeta', 'Tipos de Tarjeta', false, true),
(44, 'Status_Endosos', 'eStatus_Endosos', 'Status de Endosos', false, true),
(45, 'Efectos_Endosos', 'eEfectos_Endosos', 'Efectos de Endosos', false, true),
(46, 'Tipos_Pagos_Doctos', 'eTipos_Pagos_Doctos', 'Tipos de Pagos de Documentos', false, true),
(47, 'Clasificacion_Doctos', 'eClasificacion_Doctos', 'Clasificación de Documentos', false, true),
(48, 'Motivo_Ext_Prima', 'eMotivo_Ext_Prima', 'Motivos de Extensión de Prima', false, true),
(49, 'Tipo_Benef_Vida', 'eTipo_Benef_Vida', 'Tipos de Beneficiarios de Vida', false, true),
(50, 'Ramos', 'eRamos', 'Catálogo de Ramos', false, true),
(51, 'SubRamos', 'eSubRamos', 'Catálogo de Sub-Ramos', false, true),
(52, 'Status_Docto_User', 'eStatus_Docto_User', 'Status de Documento por Usuario', false, true),
(53, 'Status_Docto_Cobro', 'eStatus_Docto_Cobro', 'Status de Documento en Cobro', false, true),
(54, 'Status_Documentos', 'eStatus_Documentos', 'Status de Documentos', false, true),
(55, 'Status_Fianzas', 'eStatus_Fianzas', 'Status de Fianzas', false, true),
(56, 'Marcar_Docto', 'eMarcar_Docto', 'Marcar Documentos', false, true),
(57, 'Familiares', 'eFamiliares', 'Catálogo de Familiares', false, true),
(58, 'Agentes_Cia', 'eAgentes_Cia', 'Agentes por Compañía', false, true),
(59, 'Tipo_Mercancias', 'eTipo_Mercancias', 'Tipos de Mercancías', false, true),
(60, 'Documentos_Cliente', 'eDocumentos_Cliente', 'Documentos por Cliente', false, true),

-- Catálogos 61-80
(61, 'Endosos_Docto', 'eEndosos_Docto', 'Endosos por Documento', false, true),
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

-- Catálogos 81-96
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
(96, 'Documento_Beneficiarios', 'eDocumento_Beneficiarios', 'Beneficiarios de Documentos', false, true);

-- Paso 4: Actualizar constraint de catalog_type_id en sicas_sync_history
ALTER TABLE sicas_sync_history DROP CONSTRAINT IF EXISTS sicas_sync_history_catalog_type_id_check;
ALTER TABLE sicas_sync_history ADD CONSTRAINT sicas_sync_history_catalog_type_id_check
  CHECK (catalog_type_id >= 1 AND catalog_type_id <= 96);

-- Paso 5: Actualizar comentarios
COMMENT ON TABLE sicas_catalog_types IS 'Define los 96 tipos de catálogos disponibles en SICAS';

-- Paso 6: Validar que todos los catálogos existan
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

-- Paso 7: Mostrar resumen de catálogos mapeables
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
