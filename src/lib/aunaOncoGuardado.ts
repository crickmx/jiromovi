// Lo que el cotizador Auna guarda en `cotizaciones.datos`: lo capturado, más
// la cotización calculada tal como se le presentó al cliente.
import type { Asegurado, FormaPago, ResultadoCotizacion } from './aunaOncoCotizador';
import type { Solicitud } from './aunaOncoSolicitud';

export interface DatosAuna {
  cliente: string;
  /** Región del ejercicio (desde el 28/10). `claveAgente` quedó en desuso: siempre es JIRO. */
  claveAgente?: string;
  region?: string;
  formaPago: FormaPago;
  descuento: number;
  asegurados: Asegurado[];
  resultado: ResultadoCotizacion;
  solicitud: Solicitud | null;
  /** El trámite de emisión levantado desde esta cotización (uno por cotización). */
  tramiteEmision?: { id: string; folio: string } | null;
}
