export interface Cliente {
  id: string;
  nombre: string;
  tipoPersona: 'Fisica' | 'Moral';
  rfc: string;
  correo: string;
  telefono: string;
  codigoPostal: string;
  edad: number;
  genero: 'Masculino' | 'Femenino';
}

export interface Vehiculo {
  id: string;
  marca: string;
  modelo: string;
  anio: number;
  version: string;
  descripcionCompleta: string;
  claveAmis: string;
  armadoraGnp: string;
  carroceriaGnp: string;
  versionGnp: string;
  valorReferencia: number;
}

export interface CoberturaDetalle {
  nombre: string;
  sumaAsegurada: string;
  deducible: string;
  tipo: 'basica' | 'adicional';
}

export interface CoberturasPersonalizadasCliente {
  deducibleDanosMateriales: string;
  deducibleRoboTotal: string;
  sumaAseguradaRC: string;
  gastosMedicos: boolean;
  asistenciaVial: boolean;
  autoSustituto: boolean;
  defensa_legal: boolean;
}

export type PaqueteCobertura = 'Amplia' | 'Limitada' | 'RC';
export type FormaPago = 'Anual' | 'Semestral' | 'Trimestral' | 'Mensual';
export type EstatusCotizacion = 'Pendiente' | 'Emitida' | 'Expirada' | 'Cancelada';

export interface ResultadoAseguradora {
  aseguradora: string;
  logo: string;
  primaAnual: number;
  primaTotal: number;
  primaPorPago: number;
  coberturas: CoberturaDetalle[];
  tiempoRespuesta: number;
  disponible: boolean;
  error?: string;
}

export interface FleetVehicleConfig {
  vehiculo: Vehiculo;
  paquete: PaqueteCobertura;
  coberturas: CoberturasPersonalizadasCliente;
}

export interface FleetQuoteResult {
  vehiculo: Vehiculo;
  resultados: ResultadoAseguradora[];
  breakdowns: Record<string, { primaNeta: number; derechoPoliza: number; subtotal: number; iva: number; primaTotal: number; recargoFraccionamiento: number; primaTotalConRecargo: number; primaPorPago: number; primerPago: number; pagosSubsecuentes: number }>;
}

export interface Cotizacion {
  id: string;
  folio: string;
  fecha: string;
  cliente: Cliente;
  vehiculos: FleetVehicleConfig[];
  formaPago: FormaPago;
  status: EstatusCotizacion;
  resultadosFlota: FleetQuoteResult[];
  descuentoVolumen: number;
  totalFlota: Record<string, number>;
}

export interface ModelMetadata {
  modelo: string;
  tipoCarroceria: string;
  precioBase: number;
}
