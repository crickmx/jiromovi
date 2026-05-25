export type CentroDigitalEntityType =
  | 'document'
  | 'contact'
  | 'client'
  | 'endorsement'
  | 'claim'
  | 'receipt'
  | 'company'
  | 'agent'
  | 'vendor'
  | 'office'
  | 'despacho';

export interface CentroDigitalParams {
  entityType: CentroDigitalEntityType;
  idDocto?: string | number;
  idCont?: string | number;
  idEnd?: string | number;
  idClaim?: string | number;
  idRecibo?: string | number;
  idCompany?: string | number;
  idAgent?: string | number;
  idVendor?: string | number;
  idOffice?: string | number;
  idDespacho?: string | number;
  forceRefresh?: boolean;
}

export interface CentroDigitalFile {
  id: string;
  nombre: string;
  nombre_archivo: string;
  tipo_archivo: string;
  extension: string;
  tamanio_bytes: number;
  tamanio_legible: string;
  fecha_subida: string;
  carpeta: string;
  can_preview: boolean;
  can_download: boolean;
}

export interface CentroDigitalFolder {
  id: string;
  name: string;
  path: string;
  level: number;
  has_files: boolean;
  files: CentroDigitalFile[];
}

export interface CentroDigitalResult {
  success: boolean;
  entity_type: CentroDigitalEntityType;
  entity_id: string;
  files: CentroDigitalFile[];
  folders: CentroDigitalFolder[];
  total_files: number;
  has_files: boolean;
  source: 'cache' | 'sicas_live';
  cached_at?: string;
  error?: string;
}
