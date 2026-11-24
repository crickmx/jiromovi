/**
 * TypeSafe AI + SICAS Client Module
 * Módulo de sanitización, tipado estricto y mapeo determinista para SICAS WebServices
 * Repositorio: crickmx/jiromovi
 * Autor / Mantenedor: Hermes (Christofer Cruz-Chousal Jiménez)
 */

export interface SicasQueryInput {
  query: string;
  tipoBusqueda?: 'poliza' | 'rfc' | 'nombre' | 'siniestro' | 'auto';
}

export type TipoRamoSeguro = 'autos' | 'vida' | 'gmm' | 'danos' | 'fianzas' | 'otro';
export type EstatusPolizaSicas = 'VIGENTE' | 'CANCELADA' | 'VENCIDA' | 'EN_TRAMITE' | 'SUSPENDIDA';

export interface TypeSafePolicySchema {
  poliza: string;
  aseguradora: string;
  asegurado: string;
  rfc?: string;
  ramo: TipoRamoSeguro;
  estatus: EstatusPolizaSicas;
  vendedor: string;
  despacho: string;
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  primaNeta?: number;
  moneda?: 'MXN' | 'USD' | 'UDIS';
  rawMetadata?: Record<string, any>;
}

export interface TypeSafeClaimSchema {
  numeroSiniestro: string;
  poliza: string;
  aseguradora: string;
  asegurado: string;
  fechaOcurrencia?: string;
  fechaReporte?: string;
  estatus: 'ABIERTO' | 'CERRADO' | 'EN_REVISION' | 'RECHAZADO' | 'PAGADO';
  vendedor: string;
  despacho: string;
  montoReclamado?: number;
  montoPagado?: number;
}

export interface TypeSafeReceiptSchema {
  numeroRecibo: string;
  poliza: string;
  reciboDeTotal?: string; // ej. "1/12"
  importe: number;
  moneda: 'MXN' | 'USD' | 'UDIS';
  fechaVencimiento: string;
  estatus: 'PENDIENTE' | 'PAGADO' | 'CANCELADO';
}

export class TypeSafeSicasService {
  /**
   * Sanitiza y normaliza la entrada del usuario antes de enviarla a SICAS SOAP / REST
   */
  public static sanitizeInput(input: SicasQueryInput): { cleanQuery: string; detectedType: 'poliza' | 'rfc' | 'nombre' | 'siniestro' } {
    const raw = (input.query || '').trim().toUpperCase().replace(/\s+/g, ' ');
    
    // Detección heurística determinista
    const isRfc = /^[A-Z&Ñ]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A]$/.test(raw);
    const isClaim = /^SIN-?\d+/i.test(raw) || (raw.length >= 6 && /^\d{6,10}$/.test(raw) && input.tipoBusqueda === 'siniestro');
    const isPoliza = /^[A-Z0-9\-]+$/.test(raw) && raw.length >= 5;

    let detectedType: 'poliza' | 'rfc' | 'nombre' | 'siniestro' = 'nombre';
    if (input.tipoBusqueda && input.tipoBusqueda !== 'auto') {
      detectedType = input.tipoBusqueda;
    } else if (isRfc) {
      detectedType = 'rfc';
    } else if (isClaim) {
      detectedType = 'siniestro';
    } else if (isPoliza) {
      detectedType = 'poliza';
    }

    return {
      cleanQuery: raw,
      detectedType,
    };
  }

  /**
   * Mapea y valida una respuesta SOAP/REST cruda de SICAS hacia un objeto TypeScript fuertemente tipado
   */
  public static mapSoapToPolicy(raw: any): TypeSafePolicySchema {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Payload SOAP de SICAS no válido o vacío');
    }

    // Normalizar ramo
    const rawRamo = String(raw.Ramo || raw.ramo || '').toLowerCase();
    let normalizedRamo: TipoRamoSeguro = 'otro';
    if (rawRamo.includes('auto')) normalizedRamo = 'autos';
    else if (rawRamo.includes('vida')) normalizedRamo = 'vida';
    else if (rawRamo.includes('gmm') || rawRamo.includes('gastos') || rawRamo.includes('medicos')) normalizedRamo = 'gmm';
    else if (rawRamo.includes('dano') || rawRamo.includes('daño') || rawRamo.includes('hogar') || rawRamo.includes('empresa')) normalizedRamo = 'danos';
    else if (rawRamo.includes('fianza')) normalizedRamo = 'fianzas';

    // Normalizar estatus
    const rawStatus = String(raw.Estatus || raw.status || raw.Estado || '').toUpperCase();
    let normalizedStatus: EstatusPolizaSicas = 'VIGENTE';
    if (rawStatus.includes('CANC')) normalizedStatus = 'CANCELADA';
    else if (rawStatus.includes('VENC')) normalizedStatus = 'VENCIDA';
    else if (rawStatus.includes('TRAM')) normalizedStatus = 'EN_TRAMITE';
    else if (rawStatus.includes('SUSP')) normalizedStatus = 'SUSPENDIDA';

    return {
      poliza: String(raw.Poliza || raw.poliza || raw.NumeroPoliza || 'SIN_POLIZA').trim(),
      aseguradora: String(raw.Aseguradora || raw.Compania || raw.Cia || 'NO_ESPECIFICADA').trim(),
      asegurado: String(raw.Asegurado || raw.NombreCliente || raw.Cliente || 'NO_IDENTIFICADO').trim(),
      rfc: raw.RFC ? String(raw.RFC).trim() : undefined,
      ramo: normalizedRamo,
      estatus: normalizedStatus,
      vendedor: String(raw.Vendedor || raw.Agente || raw.NombreVendedor || 'Sin Asignar').trim(),
      despacho: String(raw.Despacho || raw.Oficina || raw.NombreDespacho || 'Oficina Central').trim(),
      vigenciaDesde: raw.FechaInicio || raw.VigenciaDesde || undefined,
      vigenciaHasta: raw.FechaFin || raw.VigenciaHasta || undefined,
      primaNeta: typeof raw.PrimaNeta === 'number' ? raw.PrimaNeta : raw.PrimaNeta ? parseFloat(raw.PrimaNeta) : undefined,
      moneda: (['MXN', 'USD', 'UDIS'].includes(raw.Moneda) ? raw.Moneda : 'MXN') as any,
      rawMetadata: raw,
    };
  }

  /**
   * Mapea datos crudos de siniestro a schema tipado
   */
  public static mapSoapToClaim(raw: any): TypeSafeClaimSchema {
    const rawStatus = String(raw.Estatus || raw.status || '').toUpperCase();
    let normalizedStatus: TypeSafeClaimSchema['estatus'] = 'EN_REVISION';
    if (rawStatus.includes('ABIERTO') || rawStatus.includes('PROCESO')) normalizedStatus = 'ABIERTO';
    else if (rawStatus.includes('CERR') || rawStatus.includes('FIN')) normalizedStatus = 'CERRADO';
    else if (rawStatus.includes('RECHAZ')) normalizedStatus = 'RECHAZADO';
    else if (rawStatus.includes('PAG')) normalizedStatus = 'PAGADO';

    return {
      numeroSiniestro: String(raw.NumeroSiniestro || raw.Siniestro || raw.IdSiniestro || 'SIN_ID').trim(),
      poliza: String(raw.Poliza || raw.poliza || '').trim(),
      aseguradora: String(raw.Aseguradora || raw.Compania || '').trim(),
      asegurado: String(raw.Asegurado || raw.Cliente || '').trim(),
      fechaOcurrencia: raw.FechaOcurrencia || undefined,
      fechaReporte: raw.FechaReporte || undefined,
      estatus: normalizedStatus,
      vendedor: String(raw.Vendedor || raw.Agente || 'Sin Asignar').trim(),
      despacho: String(raw.Despacho || raw.Oficina || 'Oficina Central').trim(),
      montoReclamado: raw.MontoReclamado ? parseFloat(raw.MontoReclamado) : undefined,
      montoPagado: raw.MontoPagado ? parseFloat(raw.MontoPagado) : undefined,
    };
  }
}
