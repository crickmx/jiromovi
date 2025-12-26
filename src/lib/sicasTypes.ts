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
