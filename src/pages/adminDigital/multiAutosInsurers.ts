import type {
  Vehiculo,
  PaqueteCobertura,
  FormaPago,
  CoberturaDetalle,
  ResultadoAseguradora,
  CoberturasPersonalizadasCliente,
} from './multiAutosTypes';

export interface InsurerConfig {
  nombre: string;
  color: string;
  derechoPoliza: number;
  tipoApi: 'SOAP' | 'REST' | 'SOAP_REST';
  endpointDesc: string;
  credentialKeys: string[];
  factorBase: number;
  disponible: boolean;
}

export const INSURERS_CONFIG: InsurerConfig[] = [
  {
    nombre: 'Qualitas',
    color: '#00A651',
    derechoPoliza: 870.00,
    tipoApi: 'SOAP',
    endpointDesc: 'SOAP WS Cotizacion v2.0',
    credentialKeys: ['QUALITAS_WS_USER', 'QUALITAS_WS_PASSWORD'],
    factorBase: 0.98,
    disponible: true,
  },
  {
    nombre: 'GNP',
    color: '#003DA5',
    derechoPoliza: 720.00,
    tipoApi: 'SOAP',
    endpointDesc: 'SOAP XML WS Multicotizador',
    credentialKeys: ['GNP_CLIENT_SOAP_PASS'],
    factorBase: 1.02,
    disponible: true,
  },
  {
    nombre: 'ANA Seguros',
    color: '#E31837',
    derechoPoliza: 750.00,
    tipoApi: 'SOAP',
    endpointDesc: 'XML SOAP API Cotizacion',
    credentialKeys: ['ANA_API_USER', 'ANA_API_PASSWORD', 'ANA_API_KEY'],
    factorBase: 0.96,
    disponible: true,
  },
  {
    nombre: 'HDI Seguros',
    color: '#006341',
    derechoPoliza: 750.00,
    tipoApi: 'SOAP_REST',
    endpointDesc: 'JSON/SOAP Endpoint Autos',
    credentialKeys: ['HDI_PARTNER_ID', 'HDI_API_KEY'],
    factorBase: 1.00,
    disponible: true,
  },
  {
    nombre: 'Zurich',
    color: '#003399',
    derechoPoliza: 947.21,
    tipoApi: 'REST',
    endpointDesc: 'REST API OAuth2 Client Credentials',
    credentialKeys: ['ZURICH_CLIENT_ID', 'ZURICH_CLIENT_SECRET'],
    factorBase: 1.05,
    disponible: true,
  },
  {
    nombre: 'Chubb',
    color: '#B8860B',
    derechoPoliza: 799.00,
    tipoApi: 'SOAP',
    endpointDesc: 'SOAP Service Integrator',
    credentialKeys: ['CHUBB_INTEGRATOR_ID'],
    factorBase: 1.08,
    disponible: true,
  },
  {
    nombre: 'Potosi',
    color: '#8B0000',
    derechoPoliza: 850.00,
    tipoApi: 'REST',
    endpointDesc: 'REST API Bearer Token',
    credentialKeys: ['POTOSI_BEARER_TOKEN'],
    factorBase: 0.93,
    disponible: true,
  },
];

const IVA_RATE = 0.16;

const PACKAGE_RATES: Record<PaqueteCobertura, number> = {
  Amplia: 0.0245,
  Limitada: 0.0155,
  RC: 0.0072,
};

const PAYMENT_SURCHARGES: Record<string, Record<FormaPago, number>> = {
  Qualitas: { Anual: 0, Semestral: 0.05, Trimestral: 0.08, Mensual: 0.12 },
  GNP: { Anual: 0, Semestral: 0.04, Trimestral: 0.07, Mensual: 0.10 },
  'ANA Seguros': { Anual: 0, Semestral: 0.06, Trimestral: 0.09, Mensual: 0.13 },
  'HDI Seguros': { Anual: 0, Semestral: 0.05, Trimestral: 0.08, Mensual: 0.11 },
  Zurich: { Anual: 0, Semestral: 0.04, Trimestral: 0.07, Mensual: 0.10 },
  Chubb: { Anual: 0, Semestral: 0.05, Trimestral: 0.09, Mensual: 0.14 },
  Potosi: { Anual: 0, Semestral: 0.06, Trimestral: 0.10, Mensual: 0.15 },
};

const PAYMENT_PERIODS: Record<FormaPago, number> = {
  Anual: 1,
  Semestral: 2,
  Trimestral: 4,
  Mensual: 12,
};

function getDriverFactor(edad: number, genero: 'Masculino' | 'Femenino'): number {
  let factor = 1.0;
  if (edad < 25) factor = 1.18;
  else if (edad < 30) factor = 1.05;
  else if (edad > 60) factor = 1.03;
  else if (edad > 45) factor = 0.95;
  if (genero === 'Femenino') factor *= 0.97;
  return factor;
}

function getVehicleAgeFactor(anio: number): number {
  const currentYear = new Date().getFullYear();
  const age = currentYear - anio;
  if (age <= 0) return 1.0;
  if (age <= 2) return 1.0 + age * 0.01;
  if (age <= 5) return 1.02 + (age - 2) * 0.015;
  return 1.065 + (age - 5) * 0.02;
}

function getZoneRiskFactor(codigoPostal: string): number {
  const prefix = parseInt(codigoPostal.slice(0, 2)) || 0;
  if (prefix >= 1 && prefix <= 16) return 1.12; // CDMX + Edomex
  if (prefix >= 44 && prefix <= 45) return 1.08; // Guadalajara
  if (prefix >= 64 && prefix <= 67) return 1.06; // Monterrey
  if (prefix >= 72 && prefix <= 75) return 1.04; // Puebla
  return 1.0;
}

export function buildCoveragesList(
  paquete: PaqueteCobertura,
  vehiculo: Vehiculo,
  coberturas: CoberturasPersonalizadasCliente
): CoberturaDetalle[] {
  const list: CoberturaDetalle[] = [];
  const valor = vehiculo.valorReferencia;

  if (paquete === 'Amplia') {
    list.push(
      { nombre: 'Danos Materiales', sumaAsegurada: `$${valor.toLocaleString()}`, deducible: coberturas.deducibleDanosMateriales, tipo: 'basica' },
      { nombre: 'Robo Total', sumaAsegurada: `$${valor.toLocaleString()}`, deducible: coberturas.deducibleRoboTotal, tipo: 'basica' }
    );
  }
  if (paquete === 'Limitada') {
    list.push(
      { nombre: 'Robo Total', sumaAsegurada: `$${valor.toLocaleString()}`, deducible: coberturas.deducibleRoboTotal, tipo: 'basica' }
    );
  }
  list.push(
    { nombre: 'Responsabilidad Civil (Danos a Terceros)', sumaAsegurada: coberturas.sumaAseguradaRC, deducible: 'N/A', tipo: 'basica' },
    { nombre: 'Responsabilidad Civil (Personas)', sumaAsegurada: '$1,500,000', deducible: 'N/A', tipo: 'basica' }
  );
  if (coberturas.gastosMedicos) {
    list.push({ nombre: 'Gastos Medicos Ocupantes', sumaAsegurada: '$200,000 por persona', deducible: 'N/A', tipo: 'adicional' });
  }
  if (coberturas.asistenciaVial) {
    list.push({ nombre: 'Asistencia Vial y en Viajes', sumaAsegurada: 'Incluida', deducible: 'N/A', tipo: 'adicional' });
  }
  if (coberturas.autoSustituto) {
    list.push({ nombre: 'Auto Sustituto por Siniestro', sumaAsegurada: '15 dias', deducible: 'N/A', tipo: 'adicional' });
  }
  if (coberturas.defensa_legal) {
    list.push({ nombre: 'Defensa Legal y Asistencia Juridica', sumaAsegurada: 'Incluida', deducible: 'N/A', tipo: 'adicional' });
  }
  return list;
}

export interface QuoteBreakdown {
  primaNeta: number;
  derechoPoliza: number;
  subtotal: number;
  iva: number;
  primaTotal: number;
  recargoFraccionamiento: number;
  primaTotalConRecargo: number;
  primaPorPago: number;
  primerPago: number;
  pagosSubsecuentes: number;
}

export function calculateInsuredQuote(
  insurer: InsurerConfig,
  vehiculo: Vehiculo,
  paquete: PaqueteCobertura,
  formaPago: FormaPago,
  edad: number,
  genero: 'Masculino' | 'Femenino',
  codigoPostal: string,
  coberturas: CoberturasPersonalizadasCliente
): { resultado: ResultadoAseguradora; breakdown: QuoteBreakdown } {
  const valor = vehiculo.valorReferencia;
  const packageRate = PACKAGE_RATES[paquete];
  const driverFactor = getDriverFactor(edad, genero);
  const vehicleAgeFactor = getVehicleAgeFactor(vehiculo.anio);
  const zoneFactor = getZoneRiskFactor(codigoPostal);
  const insurerFactor = insurer.factorBase;

  // Base net premium calculation
  let primaNeta = valor * packageRate * insurerFactor * driverFactor * vehicleAgeFactor * zoneFactor;

  // Add-ons premium
  if (coberturas.gastosMedicos) primaNeta += 850;
  if (coberturas.asistenciaVial) primaNeta += 520;
  if (coberturas.autoSustituto) primaNeta += 1350;
  if (coberturas.defensa_legal) primaNeta += 680;

  // Slight random variation to simulate real API responses (+/- 3%)
  const variance = 0.97 + Math.random() * 0.06;
  primaNeta = Math.round(primaNeta * variance);

  // Official Mexican insurance calculation
  const derechoPoliza = insurer.derechoPoliza;
  const subtotal = primaNeta + derechoPoliza;
  const iva = Math.round(subtotal * IVA_RATE * 100) / 100;
  const primaTotal = Math.round((subtotal + iva) * 100) / 100;

  // Fractional payment surcharge
  const surchargeRate = PAYMENT_SURCHARGES[insurer.nombre]?.[formaPago] ?? 0;
  const recargoFraccionamiento = Math.round(primaNeta * surchargeRate * 100) / 100;
  const primaTotalConRecargo = Math.round((primaTotal + recargoFraccionamiento + (recargoFraccionamiento * IVA_RATE)) * 100) / 100;

  // Payment breakdown: Derecho de Poliza goes 100% in first payment
  const periods = PAYMENT_PERIODS[formaPago];
  let primerPago: number;
  let pagosSubsecuentes: number;
  let primaPorPago: number;

  if (periods === 1) {
    primerPago = primaTotalConRecargo;
    pagosSubsecuentes = 0;
    primaPorPago = primerPago;
  } else {
    const derechoPolizaConIva = derechoPoliza + (derechoPoliza * IVA_RATE);
    const primaNetaConIvaYRecargo = primaTotalConRecargo - derechoPolizaConIva;
    pagosSubsecuentes = Math.round((primaNetaConIvaYRecargo / periods) * 100) / 100;
    primerPago = Math.round((pagosSubsecuentes + derechoPolizaConIva) * 100) / 100;
    primaPorPago = pagosSubsecuentes;
  }

  const coverages = buildCoveragesList(paquete, vehiculo, coberturas);
  const tiempoRespuesta = 800 + Math.random() * 2200;

  const breakdown: QuoteBreakdown = {
    primaNeta,
    derechoPoliza,
    subtotal,
    iva,
    primaTotal,
    recargoFraccionamiento,
    primaTotalConRecargo,
    primaPorPago,
    primerPago,
    pagosSubsecuentes,
  };

  const resultado: ResultadoAseguradora = {
    aseguradora: insurer.nombre,
    logo: '',
    primaAnual: primaNeta,
    primaTotal: primaTotalConRecargo,
    primaPorPago,
    coberturas: coverages,
    tiempoRespuesta: Math.round(tiempoRespuesta),
    disponible: insurer.disponible && Math.random() > 0.04,
  };

  return { resultado, breakdown };
}

export function calculateAllInsurers(
  vehiculo: Vehiculo,
  paquete: PaqueteCobertura,
  formaPago: FormaPago,
  edad: number,
  genero: 'Masculino' | 'Femenino',
  codigoPostal: string,
  coberturas: CoberturasPersonalizadasCliente
): { resultados: ResultadoAseguradora[]; breakdowns: Record<string, QuoteBreakdown> } {
  const resultados: ResultadoAseguradora[] = [];
  const breakdowns: Record<string, QuoteBreakdown> = {};

  for (const insurer of INSURERS_CONFIG) {
    const { resultado, breakdown } = calculateInsuredQuote(
      insurer, vehiculo, paquete, formaPago, edad, genero, codigoPostal, coberturas
    );
    resultados.push(resultado);
    breakdowns[insurer.nombre] = breakdown;
  }

  resultados.sort((a, b) => {
    if (a.disponible && !b.disponible) return -1;
    if (!a.disponible && b.disponible) return 1;
    return a.primaTotal - b.primaTotal;
  });

  return { resultados, breakdowns };
}

// Volume discount for fleet quotes
export function applyVolumeDiscount(
  vehicleCount: number,
  breakdowns: Record<string, QuoteBreakdown>
): { discountRate: number; discountedBreakdowns: Record<string, QuoteBreakdown> } {
  let discountRate = 0;
  if (vehicleCount >= 4) discountRate = 0.10;
  else if (vehicleCount >= 2) discountRate = 0.05;

  if (discountRate === 0) return { discountRate, discountedBreakdowns: breakdowns };

  const discountedBreakdowns: Record<string, QuoteBreakdown> = {};
  for (const [key, bd] of Object.entries(breakdowns)) {
    const discountedPrimaNeta = Math.round(bd.primaNeta * (1 - discountRate));
    const subtotal = discountedPrimaNeta + bd.derechoPoliza;
    const iva = Math.round(subtotal * IVA_RATE * 100) / 100;
    const primaTotal = Math.round((subtotal + iva) * 100) / 100;
    const primaTotalConRecargo = Math.round((primaTotal + bd.recargoFraccionamiento + (bd.recargoFraccionamiento * IVA_RATE)) * 100) / 100;

    discountedBreakdowns[key] = {
      ...bd,
      primaNeta: discountedPrimaNeta,
      subtotal,
      iva,
      primaTotal,
      primaTotalConRecargo,
    };
  }

  return { discountRate, discountedBreakdowns };
}
