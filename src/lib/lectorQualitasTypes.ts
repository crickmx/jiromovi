export interface ExtractedPolizaData {
  archivo: string;
  tipoPoliza?: string;
  numeroPoliza?: string;
  nombreCliente?: string;
  direccion?: string;
  cp?: string;
  municipio?: string;
  colonia?: string;
  rfcAsegurado?: string;
  descripcionVehiculo?: string;
  nacionalImportado?: string;
  placas?: string;
  serie?: string;
  motor?: string;
  formaPago?: string;
  moneda?: string;
  primaNeta?: string;
  tasaFinanciamiento?: string;
  gastosExpedicion?: string;
  subtotal?: string;
  iva?: string;
  primaTotal?: string;
  inicioVigencia?: string;
  finVigencia?: string;
  tipoVehiculo?: string;
  mensaje?: string;
  // SICAS enrichment fields
  sicasVendor?: SicasVendorSelection;
}

export interface SicasVendorSelection {
  vendorId: string;
  vendorIdSicas: string;
  vendorName: string;
  vendorKey?: string;
  vendorType?: string;
  gerenciaId?: string;
  gerenciaName?: string;
  despachoId?: string;
  despachoName?: string;
  moviUserId?: string;
  moviUserName?: string;
}

export interface SicasVendorOption {
  id: string;
  idSicas: string;
  nombre: string;
  clave?: string;
  tipoVend?: string;
  gerenciaId?: string;
  gerenciaName?: string;
  despachoId?: string;
  despachoName?: string;
  moviUserId?: string;
  moviUserName?: string;
}

export interface ExtractionResult {
  success: boolean;
  data?: ExtractedPolizaData[];
  error?: string;
}
