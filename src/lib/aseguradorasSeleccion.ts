// Las aseguradoras elegidas en un campo dinámico se guardan como UN solo texto
// separado por comas ("ANA COMPAÑIA DE SEGUROS, S.A., BANORTE GENERALI SEGUROS")
// y varios nombres del catálogo traen coma propia. Partir por coma a secas
// rompía el nombre en pedazos, ninguno coincidía con el catálogo, la casilla
// salía sin palomear y volver a hacer clic agregaba el nombre OTRA VEZ — de ahí
// los duplicados que se veían en el selector.
//
// El formato de texto se conserva (así se guarda y así se lee en el detalle del
// trámite); lo que cambia es que al leerlo se vuelven a pegar los pedazos que
// juntos forman un nombre del catálogo.

/** Nombre más largo del catálogo medido en comas; de sobra para "S.A. de C.V.". */
const MAX_PIEZAS = 4;

export function parseAseguradoras(valor: string | null | undefined, nombresCatalogo: string[]): string[] {
  const piezas = String(valor ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const conocidos = new Set(nombresCatalogo.map((n) => n.trim()).filter(Boolean));
  const salida: string[] = [];

  let i = 0;
  while (i < piezas.length) {
    // Del pedazo más largo al más corto: gana el nombre completo del catálogo.
    let nombre = '';
    for (let j = Math.min(i + MAX_PIEZAS, piezas.length); j > i; j--) {
      const candidato = piezas.slice(i, j).join(', ');
      if (conocidos.has(candidato)) {
        nombre = candidato;
        i = j;
        break;
      }
    }
    // Nombre que ya no está en el catálogo (se dio de baja, se renombró): se
    // respeta tal cual en vez de perderlo.
    if (!nombre) {
      nombre = piezas[i];
      i++;
    }
    if (!salida.includes(nombre)) salida.push(nombre);
  }

  return salida;
}

/** Lo que se ve en el campo cerrado. La lista completa va en el detalle del trámite. */
export function etiquetaAseguradoras(seleccionadas: string[]): string {
  if (seleccionadas.length === 0) return '';
  if (seleccionadas.length === 1) return seleccionadas[0];
  return `${seleccionadas[0]} + otras ${seleccionadas.length - 1}`;
}
