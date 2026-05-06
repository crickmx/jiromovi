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
}

export interface ExtractionResult {
  success: boolean;
  data?: ExtractedPolizaData[];
  error?: string;
}
