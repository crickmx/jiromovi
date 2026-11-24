// Cómo se va a cobrar algo, en números que cuadran.
//
// El dato vive distinto en cada módulo: Store guarda la "forma de pago" como un
// solo texto armado con el catálogo de parcialidades y frecuencias ("3
// Quincenal"), y Marketing guarda las parcialidades y la frecuencia por
// separado. El PDF tiene que decir lo mismo en los dos casos, así que aquí se
// traduce todo a la misma figura.
//
// Sin dependencias a propósito: es lo único con aritmética de dinero y se puede
// comprobar solo (`cobroDesglose.test.mjs`).

/** Palabras del catálogo que describen el número de pagos, no cada cuándo. */
const SIN_FRECUENCIA = ['parcialidades', 'parcialidad', 'pagos', 'pago', 'exhibiciones', 'exhibicion'];

/**
 * Parte la "forma de pago" de Store en sus dos datos.
 *
 * El texto lo arma la pantalla de combinaciones como `cantidad + frecuencia`
 * ("3 Quincenal"), pero quedan valores viejos sin frecuencia real ("2
 * Parcialidades", "Contado"). Esos devuelven frecuencia nula en vez de hacer
 * que el PDF diga "cada Parcialidades".
 */
export function desglosarFormaPago(forma?: string | null): { parcialidades: number; frecuencia: string | null } {
  const texto = (forma ?? '').trim();
  if (!texto || /^contado$/i.test(texto)) return { parcialidades: 1, frecuencia: null };

  const m = texto.match(/^(\d+)\s*(.*)$/);
  if (!m) return { parcialidades: 1, frecuencia: texto };

  const parcialidades = Math.max(1, parseInt(m[1], 10));
  const resto = m[2].trim();
  const frecuencia = !resto || SIN_FRECUENCIA.includes(resto.toLowerCase()) ? null : resto;
  return { parcialidades, frecuencia };
}

export interface PlanCobro {
  total: number;
  parcialidades: number;
  frecuencia: string | null;
  /** Lo que se descuenta cada vez. */
  montoPorParcialidad: number;
  /** La última lleva los centavos que sobran para que la suma dé el total exacto. */
  ultimaParcialidad: number;
  /** ¿La última es distinta de las demás? Si sí, el PDF tiene que decirlo. */
  ultimaAjusta: boolean;
}

/**
 * Reparte un total en parcialidades sin perder ni inventar centavos.
 *
 * Dividir y redondear cada parcialidad hace que la suma no dé el total ($2,000
 * en 3 son $666.67 tres veces = $2,000.01). Aquí se trunca hacia abajo y la
 * última absorbe la diferencia, que es como se cobra de verdad.
 */
export function planDeCobro(total: number, parcialidades: number, frecuencia?: string | null): PlanCobro {
  const n = Math.max(1, Math.floor(parcialidades) || 1);
  const totalCent = Math.round(total * 100);
  const porParcialidadCent = Math.floor(totalCent / n);
  const ultimaCent = totalCent - porParcialidadCent * (n - 1);

  return {
    total: totalCent / 100,
    parcialidades: n,
    frecuencia: frecuencia?.trim() || null,
    montoPorParcialidad: porParcialidadCent / 100,
    ultimaParcialidad: ultimaCent / 100,
    ultimaAjusta: ultimaCent !== porParcialidadCent,
  };
}

/** Pesos con separador de miles y dos decimales, siempre. */
export function pesos(monto: number): string {
  return `$${monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
