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
// TIPOS DE CATÁLOGOS (96 catálogos oficiales SICAS)
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
// CONSTANTES: 96 CATÁLOGOS OFICIALES SICAS
// ========================================

export const SICAS_CATALOG_IDS = {
  TIPO_EJECUTIVO: 1,
  TIPO_VENDEDOR: 2,
  TIPO_VENTA: 3,
  TIPO_PAGO: 4,
  TIPO_INGRESO: 5,
  TIPO_DOCTO: 6,
  TIPO_ENTIDAD: 7,
  TIPO_CIA: 8,
  CLASIFICACION_CIA: 9,
  OFICIAS: 10,
  DESPACHOS: 11,
  COMPANIAS: 12,
  AGENTES: 13,
  CARTERAS: 14,
  SUB_CARTERAS: 15,
  TIPO_CEDULA: 16,
  TIPO_AGENTE: 17,
  PROMOTORIAS: 18,
  GRUPOS: 19,
  SUBGRUPOS: 20,
  SUBSUBGRUPOS: 21,
  CONTACTO: 22,
  FORMAS_ENTERO: 23,
  CLASIFICACION_CONTACTO: 24,
  FORMATOS_MAIL: 25,
  SEXOS: 26,
  IDIOMAS: 27,
  GRUPO_AFINIDAD: 28,
  CLIENTE: 29,
  PROCESO_ACTUALIZACION_CLI: 30,
  STATUS_CLIENTE: 31,
  VENDEDORES: 32,
  EJECUTIVOS: 33,
  AGENTES_CIA_RAMO: 34,
  RAMOS_CIA: 35,
  FORMAS_PAGO: 36,
  MONEDAS: 37,
  BENEFICIARIOS: 38,
  TIPO_BENEFICIARIOS: 39,
  TIPO_COND_COBRO: 40,
  CONDUCTO_COBRO: 41,
  CARRIER: 42,
  TIPO_TARJETA: 43,
  STATUS_ENDOSOS: 44,
  EFECTOS_ENDOSOS: 45,
  TIPOS_PAGOS_DOCTOS: 46,
  CLASIFICACION_DOCTOS: 47,
  MOTIVO_EXT_PRIMA: 48,
  TIPO_BENEF_VIDA: 49,
  RAMOS: 50,
  SUBRAMOS: 51,
  STATUS_DOCTO_USER: 52,
  STATUS_DOCTO_COBRO: 53,
  STATUS_DOCUMENTOS: 54,
  STATUS_FIANZAS: 55,
  MARCAR_DOCTO: 56,
  FAMILIARES: 57,
  AGENTES_CIA: 58,
  TIPO_MERCANCIAS: 59,
  DOCUMENTOS_CLIENTE: 60,
  ENDOSOS_DOCTO: 61,
  DOCUMENTOS_UNICO: 62,
  TIPO_DECLARACION_TRANS: 63,
  GERENCIAS: 64,
  STATUS_RECLAMOS: 65,
  TARJETAS_CLIENTE: 66,
  CERCANIA_MAR: 67,
  CERCANIA_RIO: 68,
  STATUS_REC_USER: 69,
  STATUS_RECIBOS: 70,
  DOCTOS_PAGO_DOCTO: 71,
  DOCTOS_PAGO_UNICO: 72,
  PARENTESCO_DEPENDIENTES: 73,
  EJECUTIVOS_CIA: 74,
  TIPO_PAGO_DOCTO: 75,
  SINIESTRO_UNICO: 76,
  SINIESTROS_DOCTO: 77,
  CAMPANIA_STATUS: 78,
  CAMPANIA_MEDIO: 79,
  PRODUCTOS_CIA: 80,
  PRODUCTOS_UNICO: 81,
  COBERTURAS_PLAN: 82,
  DIRECCIONES_CLIENTE: 83,
  DIRECCIONES: 84,
  DIRECCION_UNICA: 85,
  USO_VEHICULO: 86,
  TIPO_SERVICIO: 87,
  COLOR: 88,
  EMISORAS: 89,
  RECIBOS_DOCTO: 90,
  RECIBOS_ENDOSO: 91,
  PAGOS_RECIBOS: 92,
  DOCUMENTO_DETAIL: 93,
  DOCUMENTO_COBERTURAS: 94,
  DOCUMENTO_DEPENDIENTES: 95,
  DOCUMENTO_BENEFICIARIOS: 96,
} as const;

export const SICAS_MAPPABLE_CATALOGS = [
  SICAS_CATALOG_IDS.DESPACHOS,
  SICAS_CATALOG_IDS.AGENTES,
  SICAS_CATALOG_IDS.EJECUTIVOS,
  SICAS_CATALOG_IDS.VENDEDORES,
  SICAS_CATALOG_IDS.OFICIAS,
];
