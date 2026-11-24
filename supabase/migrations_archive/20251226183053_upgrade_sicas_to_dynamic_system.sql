/*
  # Upgrade SICAS to Dynamic Multi-Catalog System
  
  1. Nuevas Estructuras
    - `sicas_catalog_types` - Enum de los 61 catálogos SICAS
    - `sicas_catalogos` - Tabla genérica para TODOS los catálogos
    - `sicas_sync_history` - Historial detallado de sincronizaciones
    
  2. Migración de Datos
    - Migrar `sicas_despachos` → `sicas_catalogos` (catalog_type_id = 11)
    - Migrar `sicas_vendedores` → `sicas_catalogos` (catalog_type_id = 32)
    
  3. Seguridad
    - RLS habilitado en todas las tablas nuevas
    - Solo administradores y service_role
    
  4. Características
    - Parser dinámico (no estructura fija)
    - Soporte para 61 catálogos
    - Metadatos extendidos
*/

-- 1. Crear tabla de tipos de catálogo (61 catálogos oficiales SICAS)
CREATE TABLE IF NOT EXISTS public.sicas_catalog_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  enum_name TEXT NOT NULL,
  is_mappable BOOLEAN DEFAULT false,
  requires_auth BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar los 61 catálogos oficiales de SICAS
INSERT INTO public.sicas_catalog_types (id, name, description, enum_name, is_mappable) VALUES
(1, 'Estados', 'Catálogo de Estados', 'eEstados', false),
(2, 'Municipios', 'Catálogo de Municipios', 'eMunicipios', false),
(3, 'Colonias', 'Catálogo de Colonias', 'eColonias', false),
(4, 'Códigos Postales', 'Catálogo de Códigos Postales', 'eCodigosPostales', false),
(5, 'Países', 'Catálogo de Países', 'ePaises', false),
(6, 'Monedas', 'Catálogo de Monedas', 'eMonedas', false),
(7, 'Bancos', 'Catálogo de Bancos', 'eBancos', false),
(8, 'Formas de Pago', 'Catálogo de Formas de Pago', 'eFormasPago', false),
(9, 'Ramos', 'Catálogo de Ramos de Seguros', 'eRamos', false),
(10, 'SubRamos', 'Catálogo de SubRamos', 'eSubRamos', false),
(11, 'Despachos', 'Catálogo de Despachos', 'eDespachos', true),
(12, 'Aseguradoras', 'Catálogo de Aseguradoras', 'eAseguradoras', false),
(13, 'Productos', 'Catálogo de Productos', 'eProductos', false),
(14, 'Planes', 'Catálogo de Planes', 'ePlanes', false),
(15, 'Agentes', 'Catálogo de Agentes', 'eAgentes', true),
(16, 'Ejecutivos', 'Catálogo de Ejecutivos', 'eEjecutivos', true),
(17, 'Contactos', 'Catálogo de Contactos', 'eContactos', false),
(18, 'Tipo de Entidad', 'Catálogo de Tipos de Entidad', 'eTipoEntidad', false),
(19, 'Sexo', 'Catálogo de Sexo', 'eSexo', false),
(20, 'Estado Civil', 'Catálogo de Estado Civil', 'eEstadoCivil', false),
(21, 'Profesiones', 'Catálogo de Profesiones', 'eProfesiones', false),
(22, 'Puestos', 'Catálogo de Puestos', 'ePuestos', false),
(23, 'Documentos', 'Catálogo de Documentos', 'eDocumentos', false),
(24, 'Tipos de Documento', 'Catálogo de Tipos de Documento', 'eTiposDocumento', false),
(25, 'Tipos de Archivo', 'Catálogo de Tipos de Archivo', 'eTiposArchivo', false),
(26, 'Tipos de Pago', 'Catálogo de Tipos de Pago', 'eTiposPago', false),
(27, 'Tipos de Moneda', 'Catálogo de Tipos de Moneda', 'eTiposMoneda', false),
(28, 'Tipos de Cambio', 'Catálogo de Tipos de Cambio', 'eTiposCambio', false),
(29, 'Tipos de Cobranza', 'Catálogo de Tipos de Cobranza', 'eTiposCobranza', false),
(30, 'Tipos de Comisión', 'Catálogo de Tipos de Comisión', 'eTiposComision', false),
(31, 'Usuarios', 'Catálogo de Usuarios SICAS', 'eUsuarios', true),
(32, 'Vendedores', 'Catálogo de Vendedores', 'eVendedores', true),
(33, 'Sucursales', 'Catálogo de Sucursales', 'eSucursales', false),
(34, 'Oficinas', 'Catálogo de Oficinas SICAS', 'eOficinas', true),
(35, 'Regímenes Fiscales', 'Catálogo de Regímenes Fiscales', 'eRegimenesFiscales', false),
(36, 'Impuestos', 'Catálogo de Impuestos', 'eImpuestos', false),
(37, 'Recibos', 'Catálogo de Recibos', 'eRecibos', false),
(38, 'Pagos', 'Catálogo de Pagos', 'ePagos', false),
(39, 'Cancelaciones', 'Catálogo de Cancelaciones', 'eCancelaciones', false),
(40, 'Estatus', 'Catálogo de Estatus', 'eEstatus', false),
(41, 'Motivos', 'Catálogo de Motivos', 'eMotivos', false),
(42, 'SubMotivos', 'Catálogo de SubMotivos', 'eSubMotivos', false),
(43, 'Centros Digitales', 'Catálogo de Centros Digitales', 'eCentrosDigitales', false),
(44, 'Carpetas', 'Catálogo de Carpetas CDigital', 'eCarpetas', false),
(45, 'SubCarpetas', 'Catálogo de SubCarpetas CDigital', 'eSubCarpetas', false),
(46, 'Estatus Seguros', 'Catálogo de Estatus de Seguros', 'eEstatusSeguros', false),
(47, 'Estatus Fianzas', 'Catálogo de Estatus de Fianzas', 'eEstatusFianzas', false),
(48, 'Reportes', 'Catálogo de Reportes', 'eReportes', false),
(49, 'Comisiones', 'Catálogo de Comisiones', 'eComisiones', false),
(50, 'Cobranza', 'Catálogo de Cobranza', 'eCobranza', false),
(51, 'Pólizas', 'Catálogo de Pólizas', 'ePolizas', false),
(52, 'Endosos', 'Catálogo de Endosos', 'eEndosos', false),
(53, 'Renovaciones', 'Catálogo de Renovaciones', 'eRenovaciones', false),
(54, 'Tipos de Endoso', 'Catálogo de Tipos de Endoso', 'eTiposEndoso', false),
(55, 'Motivos de Cancelación', 'Catálogo de Motivos de Cancelación', 'eMotivosCancel', false),
(56, 'Motivos de Endoso', 'Catálogo de Motivos de Endoso', 'eMotivosEndoso', false),
(57, 'Series', 'Catálogo de Series', 'eSeries', false),
(58, 'Folios', 'Catálogo de Folios', 'eFolios', false),
(59, 'Tipos de Usuario', 'Catálogo de Tipos de Usuario', 'eTiposUsuario', false),
(60, 'Roles', 'Catálogo de Roles', 'eRoles', false),
(61, 'Permisos', 'Catálogo de Permisos', 'ePermisos', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  enum_name = EXCLUDED.enum_name,
  is_mappable = EXCLUDED.is_mappable;

-- 2. Crear tabla genérica de catálogos (reemplaza sicas_despachos y sicas_vendedores)
CREATE TABLE IF NOT EXISTS public.sicas_catalogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_type_id INTEGER NOT NULL REFERENCES public.sicas_catalog_types(id) ON DELETE CASCADE,
  id_sicas TEXT NOT NULL,
  nombre TEXT NOT NULL,
  raw JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_mapped BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(catalog_type_id, id_sicas)
);

CREATE INDEX IF NOT EXISTS idx_sicas_catalogos_catalog_type ON public.sicas_catalogos(catalog_type_id);
CREATE INDEX IF NOT EXISTS idx_sicas_catalogos_id_sicas ON public.sicas_catalogos(id_sicas);
CREATE INDEX IF NOT EXISTS idx_sicas_catalogos_nombre ON public.sicas_catalogos USING gin(nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sicas_catalogos_is_mapped ON public.sicas_catalogos(is_mapped);
CREATE INDEX IF NOT EXISTS idx_sicas_catalogos_raw ON public.sicas_catalogos USING gin(raw);

-- 3. Crear tabla de historial de sincronizaciones
CREATE TABLE IF NOT EXISTS public.sicas_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_type_id INTEGER NOT NULL REFERENCES public.sicas_catalog_types(id) ON DELETE CASCADE,
  sync_started_at TIMESTAMPTZ NOT NULL,
  sync_completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  records_found INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  request_payload JSONB,
  response_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sicas_sync_history_catalog_type ON public.sicas_sync_history(catalog_type_id);
CREATE INDEX IF NOT EXISTS idx_sicas_sync_history_status ON public.sicas_sync_history(status);

-- 4. Migrar datos existentes de sicas_despachos → sicas_catalogos
INSERT INTO public.sicas_catalogos (catalog_type_id, id_sicas, nombre, raw, is_mapped, last_sync_at, created_at, updated_at)
SELECT 
  11 as catalog_type_id,
  id_sicas,
  nombre,
  raw,
  is_mapped,
  updated_at as last_sync_at,
  created_at,
  updated_at
FROM public.sicas_despachos
ON CONFLICT (catalog_type_id, id_sicas) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  raw = EXCLUDED.raw,
  is_mapped = EXCLUDED.is_mapped,
  last_sync_at = EXCLUDED.last_sync_at,
  updated_at = now();

-- 5. Migrar datos existentes de sicas_vendedores → sicas_catalogos
INSERT INTO public.sicas_catalogos (catalog_type_id, id_sicas, nombre, raw, is_mapped, last_sync_at, created_at, updated_at)
SELECT 
  32 as catalog_type_id,
  id_sicas,
  nombre,
  raw,
  is_mapped,
  updated_at as last_sync_at,
  created_at,
  updated_at
FROM public.sicas_vendedores
ON CONFLICT (catalog_type_id, id_sicas) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  raw = EXCLUDED.raw,
  is_mapped = EXCLUDED.is_mapped,
  last_sync_at = EXCLUDED.last_sync_at,
  updated_at = now();

-- 6. Actualizar mapeos existentes para usar nueva estructura
-- Los mapeos siguen usando sicas_despachos y sicas_vendedores por retrocompatibilidad
-- pero podríamos migrar a usar sicas_catalogos.id en el futuro

-- 7. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_sicas_catalogos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sicas_catalogos_timestamp ON public.sicas_catalogos;
CREATE TRIGGER update_sicas_catalogos_timestamp
  BEFORE UPDATE ON public.sicas_catalogos
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_catalogos_updated_at();

DROP TRIGGER IF EXISTS update_sicas_catalog_types_timestamp ON public.sicas_catalog_types;
CREATE TRIGGER update_sicas_catalog_types_timestamp
  BEFORE UPDATE ON public.sicas_catalog_types
  FOR EACH ROW
  EXECUTE FUNCTION update_sicas_catalogos_updated_at();

-- 8. RLS Policies
ALTER TABLE public.sicas_catalog_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sicas_catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sicas_sync_history ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden ver y modificar
CREATE POLICY "Administradores pueden ver catalog types"
  ON public.sicas_catalog_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Administradores pueden ver catálogos"
  ON public.sicas_catalogos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

CREATE POLICY "Administradores pueden ver sync history"
  ON public.sicas_sync_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.rol = 'admin'
    )
  );

-- Service role tiene acceso completo (para Edge Functions)
CREATE POLICY "Service role tiene acceso completo a catalog types"
  ON public.sicas_catalog_types FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role tiene acceso completo a catalogos"
  ON public.sicas_catalogos FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role tiene acceso completo a sync history"
  ON public.sicas_sync_history FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- 9. Función helper para obtener catálogos sincronizados
CREATE OR REPLACE FUNCTION get_sicas_catalog_stats()
RETURNS TABLE (
  catalog_type_id INTEGER,
  catalog_name TEXT,
  total_records BIGINT,
  mapped_records BIGINT,
  last_sync TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id as catalog_type_id,
    ct.name as catalog_name,
    COUNT(sc.id) as total_records,
    COUNT(sc.id) FILTER (WHERE sc.is_mapped = true) as mapped_records,
    MAX(sc.last_sync_at) as last_sync
  FROM public.sicas_catalog_types ct
  LEFT JOIN public.sicas_catalogos sc ON sc.catalog_type_id = ct.id
  GROUP BY ct.id, ct.name
  ORDER BY ct.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Comentarios de documentación
COMMENT ON TABLE public.sicas_catalog_types IS 'Tipos de catálogos SICAS - 61 catálogos oficiales del sistema';
COMMENT ON TABLE public.sicas_catalogos IS 'Tabla genérica para TODOS los catálogos SICAS - Reemplaza sicas_despachos y sicas_vendedores';
COMMENT ON TABLE public.sicas_sync_history IS 'Historial detallado de todas las sincronizaciones con SICAS';
COMMENT ON COLUMN public.sicas_catalogos.raw IS 'Objeto completo original de SICAS - NUNCA descartar';
COMMENT ON COLUMN public.sicas_catalogos.metadata IS 'Metadatos adicionales extraídos dinámicamente';
COMMENT ON COLUMN public.sicas_catalog_types.is_mappable IS 'Indica si este catálogo puede mapearse a entidades MOVI';