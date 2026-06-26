import { supabase } from '../../lib/supabase';
import type {
  Vehiculo,
  PaqueteCobertura,
  FormaPago,
  CoberturaDetalle,
  ResultadoAseguradora,
  CoberturasPersonalizadasCliente,
  FleetVehicleConfig,
  FleetQuoteResult,
} from './multiAutosTypes';

export interface InsurerConfig {
  nombre: string;
  color: string;
  derechoPoliza: number;
  tipoApi: string;
  endpointDesc: string;
  disponible: boolean;
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

export let INSURERS_CONFIG: InsurerConfig[] = [];

export async function loadInsurersConfig(): Promise<InsurerConfig[]> {
  const { data } = await supabase
    .from('multi_autos_aseguradoras')
    .select('nombre, color, derecho_poliza, tipo_api, endpoint_desc, disponible')
    .eq('disponible', true)
    .order('nombre');

  if (data && data.length > 0) {
    INSURERS_CONFIG = data.map((row) => ({
      nombre: row.nombre,
      color: row.color || '#666',
      derechoPoliza: Number(row.derecho_poliza),
      tipoApi: row.tipo_api,
      endpointDesc: row.endpoint_desc || '',
      disponible: row.disponible,
    }));
  }
  return INSURERS_CONFIG;
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

interface WSQuoteResult {
  aseguradora: string;
  color: string;
  primaNeta: number | null;
  derechoPoliza: number | null;
  iva: number | null;
  primaTotal: number | null;
  disponible: boolean;
  modo: string;
  error: string | null;
  tiempoRespuesta: number;
}

interface WSResponse {
  success: boolean;
  vehicleCount: number;
  discountRate: number;
  formaPago: string;
  results: { vehicleIndex: number; quotes: WSQuoteResult[] }[];
  timestamp: string;
  error?: string;
}

const PAYMENT_PERIODS: Record<FormaPago, number> = {
  Anual: 1,
  Semestral: 2,
  Trimestral: 4,
  Mensual: 12,
};

const IVA_RATE = 0.16;

const PAYMENT_SURCHARGES: Record<string, Record<FormaPago, number>> = {
  Qualitas: { Anual: 0, Semestral: 0.05, Trimestral: 0.08, Mensual: 0.12 },
  GNP: { Anual: 0, Semestral: 0.04, Trimestral: 0.07, Mensual: 0.10 },
  'ANA Seguros': { Anual: 0, Semestral: 0.06, Trimestral: 0.09, Mensual: 0.13 },
  'HDI Seguros': { Anual: 0, Semestral: 0.05, Trimestral: 0.08, Mensual: 0.11 },
  Zurich: { Anual: 0, Semestral: 0.04, Trimestral: 0.07, Mensual: 0.10 },
  Chubb: { Anual: 0, Semestral: 0.05, Trimestral: 0.09, Mensual: 0.14 },
  Potosi: { Anual: 0, Semestral: 0.06, Trimestral: 0.10, Mensual: 0.15 },
};

export async function callQuoteWebService(
  vehiculos: FleetVehicleConfig[],
  formaPago: FormaPago,
  edad: number,
  genero: string,
  codigoPostal: string
): Promise<{ results: FleetQuoteResult[]; discountRate: number }> {
  const { data: { session } } = await supabase.auth.getSession();

  const payload = {
    vehiculos: vehiculos.map((vc) => ({
      valorReferencia: vc.vehiculo.valorReferencia,
      anio: vc.vehiculo.anio,
      marca: vc.vehiculo.marca,
      modelo: vc.vehiculo.modelo,
      version: vc.vehiculo.version,
      paquete: vc.paquete,
      coberturas: {
        gastosMedicos: vc.coberturas.gastosMedicos,
        asistenciaVial: vc.coberturas.asistenciaVial,
        autoSustituto: vc.coberturas.autoSustituto,
        defensa_legal: vc.coberturas.defensa_legal,
      },
    })),
    formaPago,
    edad,
    genero,
    codigoPostal,
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const response = await fetch(`${supabaseUrl}/functions/v1/multi-autos-quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Error de conexion' }));
    throw new Error(errData.error || `Error ${response.status}`);
  }

  const wsResponse: WSResponse = await response.json();

  if (!wsResponse.success) {
    throw new Error(wsResponse.error || 'Error en la cotizacion');
  }

  const fleetResults: FleetQuoteResult[] = wsResponse.results.map((vr, idx) => {
    const vehicleConfig = vehiculos[idx];
    const resultados: ResultadoAseguradora[] = [];
    const breakdowns: Record<string, QuoteBreakdown> = {};

    for (const q of vr.quotes) {
      const coverages = buildCoveragesList(vehicleConfig.paquete, vehicleConfig.vehiculo, vehicleConfig.coberturas);

      if (!q.disponible || !q.primaNeta || q.primaNeta <= 0) {
        resultados.push({
          aseguradora: q.aseguradora,
          logo: '',
          primaAnual: 0,
          primaTotal: 0,
          primaPorPago: 0,
          coberturas: coverages,
          tiempoRespuesta: q.tiempoRespuesta,
          disponible: false,
          error: q.error || 'Sin respuesta del web service',
        });
        continue;
      }

      const primaNeta = q.primaNeta;
      const derechoPoliza = q.derechoPoliza || 0;
      const subtotal = primaNeta + derechoPoliza;
      const iva = q.iva || Math.round(subtotal * IVA_RATE * 100) / 100;
      const primaTotal = q.primaTotal || Math.round((subtotal + iva) * 100) / 100;

      // Payment surcharges
      const surchargeRate = PAYMENT_SURCHARGES[q.aseguradora]?.[formaPago] ?? 0;
      const recargoFraccionamiento = Math.round(primaNeta * surchargeRate * 100) / 100;
      const primaTotalConRecargo = Math.round((primaTotal + recargoFraccionamiento + (recargoFraccionamiento * IVA_RATE)) * 100) / 100;

      // Payment breakdown
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

      // Apply volume discount
      const discountMultiplier = wsResponse.discountRate > 0 ? (1 - wsResponse.discountRate) : 1;

      breakdowns[q.aseguradora] = {
        primaNeta: Math.round(primaNeta * discountMultiplier),
        derechoPoliza,
        subtotal: Math.round(subtotal * discountMultiplier),
        iva: Math.round(iva * discountMultiplier),
        primaTotal: Math.round(primaTotal * discountMultiplier),
        recargoFraccionamiento: Math.round(recargoFraccionamiento * discountMultiplier),
        primaTotalConRecargo: Math.round(primaTotalConRecargo * discountMultiplier),
        primaPorPago: Math.round(primaPorPago * discountMultiplier),
        primerPago: Math.round(primerPago * discountMultiplier),
        pagosSubsecuentes: Math.round(pagosSubsecuentes * discountMultiplier),
      };

      resultados.push({
        aseguradora: q.aseguradora,
        logo: '',
        primaAnual: Math.round(primaNeta * discountMultiplier),
        primaTotal: Math.round(primaTotalConRecargo * discountMultiplier),
        primaPorPago: Math.round(primaPorPago * discountMultiplier),
        coberturas: coverages,
        tiempoRespuesta: q.tiempoRespuesta,
        disponible: true,
      });
    }

    resultados.sort((a, b) => {
      if (a.disponible && !b.disponible) return -1;
      if (!a.disponible && b.disponible) return 1;
      return a.primaTotal - b.primaTotal;
    });

    return { vehiculo: vehicleConfig.vehiculo, resultados, breakdowns };
  });

  return { results: fleetResults, discountRate: wsResponse.discountRate };
}


export { INSURERS_CONFIG }