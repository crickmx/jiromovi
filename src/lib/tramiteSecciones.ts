// Lógica compartida de Secciones del FormBuilder — usada tanto por
// NuevoTramiteModal.tsx (crear trámite) como por TramiteDetalle.tsx (editar).
// Cada archivo mantiene su propia interfaz local de "campo dinámico"; las
// funciones de aquí solo requieren la forma mínima necesaria (tipado
// estructural), para no forzar un import cruzado de tipos entre archivos.

export interface SeccionMinima {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  opcional: boolean;
  depende_de_seccion_id: string | null;
  condicion_campo_id?: string | null;
  condicion_operador?: 'igual_a' | 'distinto_a' | 'tiene_valor' | null;
  condicion_valor?: string | null;
}

export interface CampoConSeccion {
  id: string;
  requerido: boolean;
  seccion_id?: string | null;
}

/** ¿La respuesta actual cumple la condición configurada? Mismo vocabulario que la condición por campo. */
function condicionCumplida(
  operador: 'igual_a' | 'distinto_a' | 'tiene_valor',
  valorEsperado: string | null | undefined,
  valorActual: any
): boolean {
  if (operador === 'tiene_valor') {
    return valorActual !== undefined && valorActual !== null && valorActual !== '' && !(Array.isArray(valorActual) && valorActual.length === 0);
  }
  const actuales = Array.isArray(valorActual) ? valorActual : [valorActual];
  const coincide = actuales.some(v => String(v) === String(valorEsperado));
  return operador === 'igual_a' ? coincide : !coincide;
}

/** ¿Todos los campos requeridos de esta sección ya tienen respuesta? */
export function seccionCompleta(
  seccionId: string,
  campos: CampoConSeccion[],
  respuestas: Record<string, any>
): boolean {
  const camposSeccion = campos.filter(c => c.seccion_id === seccionId && c.requerido);
  return camposSeccion.every(c => {
    const v = respuestas[c.id];
    return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
  });
}

/** ¿Esta sección ya se puede interactuar (no depende de otra, o la sección de la que depende ya está completa)? */
export function seccionDesbloqueada(
  seccion: SeccionMinima,
  secciones: SeccionMinima[],
  campos: CampoConSeccion[],
  respuestas: Record<string, any>
): boolean {
  // Prioridad: condición por valor de campo (estilo Google Forms) sobre "sección anterior completa".
  if (seccion.condicion_campo_id && seccion.condicion_operador) {
    return condicionCumplida(seccion.condicion_operador, seccion.condicion_valor, respuestas[seccion.condicion_campo_id]);
  }
  if (!seccion.depende_de_seccion_id) return true;
  const origen = secciones.find(s => s.id === seccion.depende_de_seccion_id);
  if (!origen) return true; // referencia rota — no bloquear
  return seccionCompleta(origen.id, campos, respuestas);
}

/** Agrupa campos por sección, respetando el orden de secciones; los campos sin sección van primero (grupo `seccion: null`). */
export function agruparCamposPorSeccion<C extends CampoConSeccion>(
  campos: C[],
  secciones: SeccionMinima[]
): { seccion: SeccionMinima | null; campos: C[] }[] {
  const sinSeccion = campos.filter(c => !c.seccion_id);
  const gruposConSeccion = [...secciones]
    .sort((a, b) => a.orden - b.orden)
    .map(seccion => ({ seccion, campos: campos.filter(c => c.seccion_id === seccion.id) }));

  const resultado: { seccion: SeccionMinima | null; campos: C[] }[] = [];
  if (sinSeccion.length > 0) resultado.push({ seccion: null, campos: sinSeccion });
  resultado.push(...gruposConSeccion);
  return resultado;
}
