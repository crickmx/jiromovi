// Tipos para el módulo "Mis Pólizas"

export interface SicasPoliza {
  id: string;
  id_docto: string;
  id_cont?: string;

  // Información del documento
  poliza: string;
  documento: string;
  tipo_documento?: string;

  // Aseguradora y ramo
  compania: string;
  compania_id?: string;
  ramo: string;
  ramo_id?: string;
  subramo?: string;
  subramo_id?: string;

  // Cliente
  cliente: string;
  contratante?: string;
  asegurado?: string;

  // Vigencia
  vigencia_desde: string;
  vigencia_hasta: string;
  fecha_emision?: string;
  fecha_captura?: string;

  // Montos
  prima_neta: number;
  prima_total: number;
  importe: number;

  // Estatus
  estatus: string;
  estatus_id?: string;
  es_vigente: boolean;
  dias_para_vencer?: number;

  // Vendedor y oficina
  vend_id?: string;
  vend_nombre: string;
  desp_id?: string;
  desp_nombre?: string;
  oficina_id?: string;
  oficina_nombre?: string;

  // Usuario mapeado (desde sicas_documents)
  usuario_id?: string;

  // Datos crudos de SICAS
  raw_data?: any;

  // Auditoría
  synced_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SicasArchivoCentroDigital {
  id: string;
  nombre: string;
  nombre_archivo: string;
  tipo_archivo: string;
  extension: string;
  tamanio_bytes: number;
  tamanio_legible: string;
  fecha_subida: string;
  url_descarga?: string;
  es_descargable: boolean;
  categoria?: string;
  descripcion?: string;
}

export interface SicasCentroDigitalResponse {
  id_docto: string;
  id_cont?: string;
  identity_type: string;
  archivos: SicasArchivoCentroDigital[];
  total_archivos: number;
  tiene_archivos: boolean;
  mensaje?: string;
  error?: string;
}

export interface SicasUserMapping {
  id: string;
  usuario_id: string;
  sicas_id_vendedor?: string;
  sicas_id_oficina?: string;
  sicas_id_gerencia?: string;
  sicas_id_despacho?: string;
  sicas_nombre_vendedor?: string;
  sicas_nombre_oficina?: string;
  sicas_nombre_gerencia?: string;
  sicas_nombre_despacho?: string;
  es_mapeo_principal: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SicasPolizasFilters {
  // Búsqueda general
  searchText?: string;

  // Estatus
  estatus?: 'vigente' | 'no_vigente' | 'todas';

  // Fechas
  fecha_desde?: string;
  fecha_hasta?: string;
  tipo_fecha?: 'vigencia' | 'captura' | 'emision';

  // Oficina y vendedor (según permisos)
  oficina_id?: string;
  vendedor_id?: string;
  vendedor_nombre?: string;

  // Aseguradora
  aseguradora?: string;
  aseguradora_id?: string;

  // Ramo
  ramo?: string;
  ramo_id?: string;
  subramo?: string;
  subramo_id?: string;

  // Tipo de documento
  tipo_documento?: string;

  // Ordenamiento
  sort_by?: 'vigencia_desde' | 'vigencia_hasta' | 'fecha_captura' | 'prima_neta' | 'poliza';
  sort_order?: 'asc' | 'desc';

  // Paginación
  page?: number;
  items_per_page?: number;
}

export interface SicasPolizasListRequest {
  filters: SicasPolizasFilters;
  usuario_id: string;
  rol: string;
  oficina_id?: string;
  force_refresh?: boolean; // Forzar consulta a SICAS en lugar de cache
}

export interface SicasPolizasListResponse {
  success: boolean;
  polizas: SicasPoliza[];
  pagination: {
    page: number;
    items_per_page: number;
    total_records: number;
    total_pages: number;
    has_next_page: boolean;
    has_prev_page: boolean;
  };
  metadata: {
    source: 'sicas' | 'cache' | 'database';
    keycode_used: string;
    filters_applied: string[];
    conditions_add?: string;
    cached_at?: string;
    query_time_ms?: number;
  };
  diagnostics?: {
    response_nbr: string;
    response_txt: string;
    message?: string;
    raw_xml_length?: number;
    parsed_records?: number;
  };
  error?: string;
}

export interface SicasConfig {
  id: string;
  keycode_polizas_vigentes: string;
  keycode_polizas_todas: string;
  keycode_centro_digital: string;
  items_per_page_default: number;
  items_per_page_max: number;
  cache_ttl_minutes: number;
  filtros_habilitados: {
    estatus: boolean;
    fecha_vigencia: boolean;
    fecha_captura: boolean;
    oficina: boolean;
    vendedor: boolean;
    aseguradora: boolean;
    ramo: boolean;
    subramo: boolean;
    tipo_documento: boolean;
  };
  debug_mode: boolean;
  created_at: string;
  updated_at: string;
}

// Helpers para construcción de filtros SICAS
export interface SicasCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'BETWEEN';
  value: string | string[];
  connector?: '!' | '&'; // ! = OR, & = AND (por defecto)
}

export interface SicasFilterBuilder {
  buildConditionsAdd(conditions: SicasCondition[]): string;
  buildDateRangeFilter(
    dateFrom: string,
    dateTo: string,
    field: string
  ): string;
  buildStatusFilter(status: 'vigente' | 'no_vigente' | 'todas'): string;
  buildDocumentTypeFilter(docType?: string): string;
}

// Estado de UI
export interface MisPolizasUIState {
  loading: boolean;
  syncing: boolean;
  polizas: SicasPoliza[];
  filteredPolizas: SicasPoliza[];
  selectedPoliza: SicasPoliza | null;
  showFilters: boolean;
  showCentroDigital: boolean;
  centroDigitalFiles: SicasArchivoCentroDigital[];
  loadingCentroDigital: boolean;
  syncMessage: {
    type: 'success' | 'error' | 'warning' | 'info';
    text: string;
  } | null;
  pagination: {
    current_page: number;
    total_pages: number;
    total_records: number;
  };
}

// Estadísticas
export interface SicasPolizasStats {
  total_polizas: number;
  polizas_vigentes: number;
  polizas_por_vencer_30_dias: number;
  polizas_vencidas: number;
  prima_neta_total: number;
  prima_total: number;
  por_aseguradora: {
    nombre: string;
    count: number;
    prima_total: number;
  }[];
  por_ramo: {
    nombre: string;
    count: number;
    prima_total: number;
  }[];
}
