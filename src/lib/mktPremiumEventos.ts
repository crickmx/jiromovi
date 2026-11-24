// Qué eventos de Plan Premium se dispararon al guardar un agente.
//
// Antes esto era una cadena de `if` con los cuatro eventos escritos adentro, así
// que `mkt_premium_eventos` parecía configurable pero no lo era: una fila nueva
// creada desde la pantalla **nunca se habría disparado** —no había nada que
// emitiera su nombre— y una regla configurada para ella se habría quedado
// esperando para siempre, sin error ni aviso.
//
// Ahora cada evento declara QUÉ observa y esta función solo evalúa esa
// declaración, así que crear un evento desde la pantalla sirve de verdad.

export interface EventoPremium {
  key: string;
  disparador_tipo: string;
  campos_observados?: string[] | null;
}

/** Lo que hace falta de un agente para decidir qué cambió. */
export type EstadoPremium = Record<string, unknown> & { plan_mkt_premium?: boolean | null };

/**
 * Claves de los eventos que aplican a este cambio.
 *
 * Reglas, en el mismo orden que tenían en el código:
 * - Se prendió el Premium → solo los de `activacion`.
 * - Se apagó → solo los de `desactivacion`.
 * - Siguió activo → los de `cambio_campo` cuya lista de columnas tenga al menos
 *   una que de verdad cambió.
 * - Siguió apagado → ninguno. Editar los datos de alguien sin Premium no es un
 *   evento; si lo fuera, se levantarían trámites por tocar un campo muerto.
 */
export function eventosDisparados(
  eventos: EventoPremium[],
  antes: EstadoPremium,
  despues: EstadoPremium,
): string[] {
  const eraActivo = !!antes.plan_mkt_premium;
  const esActivo = !!despues.plan_mkt_premium;

  if (!eraActivo && esActivo) {
    return eventos.filter(e => e.disparador_tipo === 'activacion').map(e => e.key);
  }
  if (eraActivo && !esActivo) {
    return eventos.filter(e => e.disparador_tipo === 'desactivacion').map(e => e.key);
  }
  if (!eraActivo && !esActivo) return [];

  return eventos
    .filter(e => e.disparador_tipo === 'cambio_campo')
    .filter(e => (e.campos_observados ?? []).some(campo => cambio(antes[campo], despues[campo])))
    .map(e => e.key);
}

/**
 * ¿Cambió el valor?
 *
 * `null`, `undefined` y `''` cuentan como lo mismo: la pantalla guarda un campo
 * vacío a veces como null y a veces como cadena vacía, y tratarlos distinto
 * levantaría un trámite por un cambio que nadie hizo.
 */
function cambio(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === null || v === undefined || v === '' ? null : v);
  return norm(a) !== norm(b);
}
