// Tipos y filtro de las reglas de trámite automático.
//
// Vive aparte de `tramiteTriggers.ts` para poder comprobarse sin cliente de
// Supabase (ver `tramiteTriggerFiltro.test.mjs`). Ese archivo lo reexporta, así que
// nadie más tiene que cambiar de import.

/** Lo mínimo que el motor necesita saber de una regla. */
export interface TriggerBase {
  id: string;
  nombre: string;
  descripcion_template: string;
  metodo_pago_filtro?: string[] | null;
  forma_pago_filtro?: string[] | null;
  ticket_tipos: { id: string; value: string; label: string; area: string | null };
}

export interface MapeoCampoTrigger {
  campo_id: string;
  fuente: string;
  valor_template?: string | null;
}

export interface ResultadoTriggers {
  creados: { folio: string; tipoLabel: string }[];
  omitidos: { folio: string; tipoLabel: string }[];
  errores: { nombre: string; error: string }[];
  totalTriggers: number;
  triggersAplicados: number;
}

/**
 * Filtra las reglas por el pago del caso.
 *
 * Nulo o arreglo vacío = "cualquiera"; una regla puede aplicar a varios métodos
 * o formas a la vez. Se separa del resto porque es la única parte con lógica
 * propia y porque un fallo aquí no se ve: la regla simplemente no dispara y
 * nadie se entera de que debía hacerlo.
 */
export function filtrarTriggersPorPago<T extends TriggerBase>(
  triggers: T[],
  pago: { metodo?: string | null; forma?: string | null },
): T[] {
  return triggers.filter(t =>
    (!t.metodo_pago_filtro?.length || (!!pago.metodo && t.metodo_pago_filtro.includes(pago.metodo))) &&
    (!t.forma_pago_filtro?.length || (!!pago.forma && t.forma_pago_filtro.includes(pago.forma)))
  );
}
