import type {
  Vehiculo,
  PaqueteCobertura,
  FormaPago,
  CoberturaDetalle,
  ResultadoAseguradora,
  CoberturasPersonalizadasCliente,
} from './multiAutosTypes';

interface InsurerInfo {
  nombre: string;
  color: string;
}

export const INSURERS: InsurerInfo[] = [
  { nombre: 'Qualitas', color: '#00A651' },
  { nombre: 'GNP', color: '#003DA5' },
  { nombre: 'ANA', color: '#E31837' },
  { nombre: 'HDI', color: '#006341' },
  { nombre: 'Zurich', color: '#003399' },
  { nombre: 'Chubb', color: '#B8860B' },
  { nombre: 'Potosi', color: '#8B0000' },
];

const PACKAGE_FACTORS: Record<PaqueteCobertura, number> = {
  Amplia: 0.024,
  Limitada: 0.015,
  RC: 0.007,
};

const INSURER_VARIATION: Record<string, number> = {
  Qualitas: 0.98,
  GNP: 1.02,
  ANA: 0.96,
  HDI: 1.0,
  Zurich: 1.05,
  Chubb: 1.08,
  Potosi: 0.93,
};

const PAYMENT_SURCHARGES: Record<string, Record<FormaPago, number>> = {
  Qualitas: { Anual: 1.0, Semestral: 1.05, Trimestral: 1.08, Mensual: 1.12 },
  GNP: { Anual: 1.0, Semestral: 1.04, Trimestral: 1.07, Mensual: 1.10 },
  ANA: { Anual: 1.0, Semestral: 1.06, Trimestral: 1.09, Mensual: 1.13 },
  HDI: { Anual: 1.0, Semestral: 1.05, Trimestral: 1.08, Mensual: 1.11 },
  Zurich: { Anual: 1.0, Semestral: 1.04, Trimestral: 1.07, Mensual: 1.10 },
  Chubb: { Anual: 1.0, Semestral: 1.05, Trimestral: 1.09, Mensual: 1.14 },
  Potosi: { Anual: 1.0, Semestral: 1.06, Trimestral: 1.10, Mensual: 1.15 },
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
  else if (edad > 45) factor = 0.95;
  if (genero === 'Femenino') factor *= 0.97;
  return factor;
}

function getVehicleAgeFactor(anio: number): number {
  const age = new Date().getFullYear() - anio;
  return 1.0 + age * 0.015;
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
  if (paquete === 'Amplia' || paquete === 'Limitada') {
    list.push(
      { nombre: 'Robo Total', sumaAsegurada: `$${valor.toLocaleString()}`, deducible: coberturas.deducibleRoboTotal, tipo: 'basica' }
    );
  }
  list.push(
    { nombre: 'Responsabilidad Civil', sumaAsegurada: coberturas.sumaAseguradaRC, deducible: 'N/A', tipo: 'basica' }
  );
  if (coberturas.gastosMedicos) {
    list.push({ nombre: 'Gastos Medicos Ocupantes', sumaAsegurada: '$200,000', deducible: 'N/A', tipo: 'adicional' });
  }
  if (coberturas.asistenciaVial) {
    list.push({ nombre: 'Asistencia Vial', sumaAsegurada: 'Incluida', deducible: 'N/A', tipo: 'adicional' });
  }
  if (coberturas.autoSustituto) {
    list.push({ nombre: 'Auto Sustituto', sumaAsegurada: '15 dias', deducible: 'N/A', tipo: 'adicional' });
  }
  if (coberturas.defensa_legal) {
    list.push({ nombre: 'Defensa Legal', sumaAsegurada: 'Incluida', deducible: 'N/A', tipo: 'adicional' });
  }
  return list;
}

export function calculateSimulatedQuote(
  insurer: string,
  vehiculo: Vehiculo,
  paquete: PaqueteCobertura,
  formaPago: FormaPago,
  edad: number,
  genero: 'Masculino' | 'Femenino',
  coberturas: CoberturasPersonalizadasCliente
): ResultadoAseguradora {
  const start = Date.now();
  const valor = vehiculo.valorReferencia;
  const packageFactor = PACKAGE_FACTORS[paquete];
  const insurerVariation = INSURER_VARIATION[insurer] ?? 1.0;
  const driverFactor = getDriverFactor(edad, genero);
  const vehicleAgeFactor = getVehicleAgeFactor(vehiculo.anio);

  let primaAnual = valor * packageFactor * insurerVariation * driverFactor * vehicleAgeFactor;

  // Add coverage add-ons cost
  if (coberturas.gastosMedicos) primaAnual += 800;
  if (coberturas.asistenciaVial) primaAnual += 500;
  if (coberturas.autoSustituto) primaAnual += 1200;
  if (coberturas.defensa_legal) primaAnual += 600;

  // Random variation +/-5%
  const randomFactor = 0.95 + Math.random() * 0.10;
  primaAnual = Math.round(primaAnual * randomFactor);

  const surcharge = PAYMENT_SURCHARGES[insurer]?.[formaPago] ?? 1.0;
  const primaTotal = Math.round(primaAnual * surcharge);
  const periods = PAYMENT_PERIODS[formaPago];
  const primaPorPago = Math.round(primaTotal / periods);

  const coverages = buildCoveragesList(paquete, vehiculo, coberturas);

  const tiempoRespuesta = 800 + Math.random() * 2000;

  return {
    aseguradora: insurer,
    logo: '',
    primaAnual,
    primaTotal,
    primaPorPago,
    coberturas: coverages,
    tiempoRespuesta: Math.round(tiempoRespuesta),
    disponible: Math.random() > 0.05,
  };
}

export function calculateAllInsurers(
  vehiculo: Vehiculo,
  paquete: PaqueteCobertura,
  formaPago: FormaPago,
  edad: number,
  genero: 'Masculino' | 'Femenino',
  coberturas: CoberturasPersonalizadasCliente
): ResultadoAseguradora[] {
  return INSURERS.map((ins) =>
    calculateSimulatedQuote(ins.nombre, vehiculo, paquete, formaPago, edad, genero, coberturas)
  ).sort((a, b) => a.primaAnual - b.primaAnual);
}
