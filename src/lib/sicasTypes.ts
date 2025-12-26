// ========================================
// CONFIGURACIÓN SICAS
// ========================================

export interface SicasConfig {
  id: string;
  endpoint: string;
  last_test_at: string | null;
  last_test_success: boolean | null;
  last_test_message: string | null;
  last_sync_despachos_at: string | null;
  last_sync_vendedores_at: string | null;
  sync_logs: any[] | null;
  created_at: string;
  updated_at: string;
}

// ========================================
// TIPOS DE CATÁLOGOS (61 catálogos oficiales SICAS)
// ========================================

export interface SicasCatalogType {
  id: number;
  name: string;
  description: string | null;
  enum_name: string;
  is_mappable: boolean;
  requires_auth: boolean;
  created_at: string;
  updated_at: string;
}

// ========================================
// CATÁLOGOS GENÉRICOS
// ========================================

export interface SicasCatalogo {
  id: string;
  catalog_type_id: number;
  id_sicas: string;
  nombre: string;
  raw: any;
  metadata: any;
  is_active: boolean;
  is_mapped: boolean;
  last_sync_at: string;
  created_at: string;
  updated_at: string;
}

export interface SicasCatalogoWithType extends SicasCatalogo {
  catalog_type: SicasCatalogType;
}

// ========================================
// HISTORIAL DE SINCRONIZACIONES
// ========================================

export interface SicasSyncHistory {
  id: string;
  catalog_type_id: number;
  sync_started_at: string;
  sync_completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  records_found: number;
  records_inserted: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
  request_payload: any;
  response_preview: string | null;
  created_at: string;
}

export interface SicasSyncHistoryWithType extends SicasSyncHistory {
  catalog_type: SicasCatalogType;
}

// ========================================
// MAPEOS (Retrocompatibilidad)
// ========================================

export interface SicasMapeoDespacho {
  id: string;
  id_sicas_despacho: string;
  movi_oficina_id: string;
  mapped_by: string | null;
  mapped_at: string;
  created_at: string;
  updated_at: string;
}

export interface SicasMapeoVendedor {
  id: string;
  id_sicas_vendedor: string;
  movi_user_id: string;
  mapped_by: string | null;
  mapped_at: string;
  created_at: string;
  updated_at: string;
}

// ========================================
// ESTADÍSTICAS DE CATÁLOGOS
// ========================================

export interface SicasCatalogStats {
  catalog_type_id: number;
  catalog_name: string;
  total_records: number;
  mapped_records: number;
  last_sync: string | null;
}

// ========================================
// TIPOS LEGACY (Retrocompatibilidad)
// ========================================

export interface SicasDespacho {
  id: string;
  id_sicas: string;
  nombre: string;
  raw: any;
  is_mapped: boolean;
  created_at: string;
  updated_at: string;
}

export interface SicasVendedor {
  id: string;
  id_sicas: string;
  nombre: string;
  raw: any;
  is_mapped: boolean;
  created_at: string;
  updated_at: string;
}

export interface SicasDespachoWithMapping extends SicasDespacho {
  mapping?: SicasMapeoDespacho;
  oficina?: {
    id: string;
    nombre: string;
  };
}

export interface SicasVendedorWithMapping extends SicasVendedor {
  mapping?: SicasMapeoVendedor;
  usuario?: {
    id: string;
    nombre: string;
    apellidos: string;
    email: string;
  };
}

// ========================================
// CONSTANTES: 61 CATÁLOGOS OFICIALES SICAS
// ========================================

export const SICAS_CATALOG_IDS = {
  ESTADOS: 1,
  MUNICIPIOS: 2,
  COLONIAS: 3,
  CODIGOS_POSTALES: 4,
  PAISES: 5,
  MONEDAS: 6,
  BANCOS: 7,
  FORMAS_PAGO: 8,
  RAMOS: 9,
  SUBRAMOS: 10,
  DESPACHOS: 11,
  ASEGURADORAS: 12,
  PRODUCTOS: 13,
  PLANES: 14,
  AGENTES: 15,
  EJECUTIVOS: 16,
  CONTACTOS: 17,
  TIPO_ENTIDAD: 18,
  SEXO: 19,
  ESTADO_CIVIL: 20,
  PROFESIONES: 21,
  PUESTOS: 22,
  DOCUMENTOS: 23,
  TIPOS_DOCUMENTO: 24,
  TIPOS_ARCHIVO: 25,
  TIPOS_PAGO: 26,
  TIPOS_MONEDA: 27,
  TIPOS_CAMBIO: 28,
  TIPOS_COBRANZA: 29,
  TIPOS_COMISION: 30,
  USUARIOS: 31,
  VENDEDORES: 32,
  SUCURSALES: 33,
  OFICINAS: 34,
  REGIMENES_FISCALES: 35,
  IMPUESTOS: 36,
  RECIBOS: 37,
  PAGOS: 38,
  CANCELACIONES: 39,
  ESTATUS: 40,
  MOTIVOS: 41,
  SUBMOTIVOS: 42,
  CENTROS_DIGITALES: 43,
  CARPETAS: 44,
  SUBCARPETAS: 45,
  ESTATUS_SEGUROS: 46,
  ESTATUS_FIANZAS: 47,
  REPORTES: 48,
  COMISIONES: 49,
  COBRANZA: 50,
  POLIZAS: 51,
  ENDOSOS: 52,
  RENOVACIONES: 53,
  TIPOS_ENDOSO: 54,
  MOTIVOS_CANCELACION: 55,
  MOTIVOS_ENDOSO: 56,
  SERIES: 57,
  FOLIOS: 58,
  TIPOS_USUARIO: 59,
  ROLES: 60,
  PERMISOS: 61,
} as const;

export const SICAS_MAPPABLE_CATALOGS = [
  SICAS_CATALOG_IDS.DESPACHOS,
  SICAS_CATALOG_IDS.AGENTES,
  SICAS_CATALOG_IDS.EJECUTIVOS,
  SICAS_CATALOG_IDS.USUARIOS,
  SICAS_CATALOG_IDS.VENDEDORES,
  SICAS_CATALOG_IDS.OFICINAS,
];
