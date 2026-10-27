// Lo que el cotizador Auna guarda en `cotizaciones.datos`: lo capturado, más
// la cotización calculada tal como se le presentó al cliente.
import type { Asegurado, FormaPago, ResultadoCotizacion } from './aunaOncoCotizador';
import type { Solicitud } from './aunaOncoSolicitud';

export interface DatosAuna {
  cliente: string;
  formaPago: FormaPago;
  descuento: number;
  asegurados: Asegurado[];
  resultado: ResultadoCotizacion;
  solicitud: Solicitud | null;
}
