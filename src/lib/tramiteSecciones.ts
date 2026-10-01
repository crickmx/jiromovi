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
  sistema_key?: string | null;
  config?: Record<string, any> | null;
}

export interface CampoConSeccion {
  id: string;
  requerido: boolean;
  seccion_id?: string | null;
  /** Para resolver la condición propia del campo, que apunta a otro campo por `key`. */
  key?: string;
  config?: { condicion_activa?: boolean; campo_fuente?: string; condicion_operador?: string; condicion_valor?: string; [k: string]: any } | null;
}

/** Hay respuesta: cubre texto vacío y arreglo vacío, que son los dos "nada" del formulario. */
export function tieneRespuesta(v: any): boolean {
  return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
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

/**
 * Explica POR QUÉ una sección está bloqueada, para mostrárselo a quien llena el
 * formulario. Antes las dos pantallas decían siempre "Completa la sección anterior",
 * incluso cuando el bloqueo venía de una condición por valor de campo — el usuario no
 * tenía forma de saber qué le faltaba.
 */
export function motivoSeccionBloqueada(
  seccion: SeccionMinima,
  secciones: SeccionMinima[],
  campos: (CampoConSeccion & { label?: string })[]
): string {
  if (seccion.condicion_campo_id && seccion.condicion_operador) {
    const fuente = campos.find(c => c.id === seccion.condicion_campo_id);
    const nombre = fuente?.label ?? 'un campo anterior';
    if (seccion.condicion_operador === 'tiene_valor') return `Responde "${nombre}" para continuar`;
    const relacion = seccion.condicion_operador === 'igual_a' ? 'sea' : 'sea distinto de';
    return `Se activa cuando "${nombre}" ${relacion} "${seccion.condicion_valor ?? ''}"`;
  }
  const origen = secciones.find(s => s.id === seccion.depende_de_seccion_id);
  return origen
    ? `Completa "${origen.nombre}" para continuar`
    : 'Completa la sección anterior para continuar';
}

/**
 * Agrupa campos por sección, respetando el orden de secciones; los campos sin
 * sección van primero (grupo `seccion: null`). Una sección sin ningún campo
 * (ej. una sección de solo-sistema cuando el llamador ya excluyó los campos
 * de sistema antes de agrupar) se omite -- mostrar una tarjeta de sección
 * vacía es puro ruido visual, nunca información real.
 *
 * La sección "Encabezado" (sistema_key 'header') se omite siempre: solo
 * existe para configurar el fondo del encabezado real del trámite (que ya se
 * ve arriba del todo, con su diseño, una vez creado) -- su único campo es
 * Estatus, que no se captura aquí. Mostrarla como tarjeta en el formulario de
 * alta o en el detalle no aporta nada, solo un candado sin contenido debajo.
 */
export function agruparCamposPorSeccion<C extends CampoConSeccion>(
  campos: C[],
  secciones: SeccionMinima[]
): { seccion: SeccionMinima | null; campos: C[] }[] {
  const sinSeccion = campos.filter(c => !c.seccion_id);
  const gruposConSeccion = [...secciones]
    .filter(s => s.sistema_key !== 'header')
    .sort((a, b) => a.orden - b.orden)
    .map(seccion => ({ seccion, campos: campos.filter(c => c.seccion_id === seccion.id) }))
    .filter(g => g.campos.length > 0);

  const resultado: { seccion: SeccionMinima | null; campos: C[] }[] = [];
  if (sinSeccion.length > 0) resultado.push({ seccion: null, campos: sinSeccion });
  resultado.push(...gruposConSeccion);
  return resultado;
}

/**
 * Estilo de borde + fondo muy sutil para una sección con color configurado.
 * A diferencia del fondo del Encabezado (tramiteHeader.ts, un banner de
 * página completa que exige recalcular el color del texto), esto es solo un
 * matiz ligero sobre la tarjeta -- el texto/inputs de adentro se quedan con
 * sus colores normales, nunca hace falta contraste especial.
 */
export function estiloSeccionColor(color?: string | null): { borderColor: string; backgroundColor: string } | undefined {
  if (!color) return undefined;
  return { borderColor: color, backgroundColor: `${color}0D` };
}

/**
 * ¿La condición PROPIA del campo se cumple? (independiente de su sección)
 *
 * Es el sistema de `config.condicion_activa` + `campo_fuente`. El detalle ya lo
 * evaluaba con una copia local; el alta no lo evaluaba en absoluto, así que un
 * campo condicionado se mostraba siempre al crear el trámite.
 */
export function campoCumpleSuCondicion(
  campo: CampoConSeccion,
  campos: CampoConSeccion[],
  respuestas: Record<string, any>
): boolean {
  if (!campo.config?.condicion_activa) return true;
  const { campo_fuente, condicion_operador, condicion_valor } = campo.config;
  if (!campo_fuente) return true;
  const fuente = campos.find(c => c.key === campo_fuente);
  if (!fuente) return true; // referencia rota — no esconder
  const op = (condicion_operador || 'igual_a') as 'igual_a' | 'distinto_a' | 'tiene_valor';
  return condicionCumplida(op, condicion_valor, respuestas[fuente.id]);
}

/**
 * ¿Se puede EXIGIR este campo ahora mismo?
 *
 * Marcar "requerido" un campo que vive en una sección que no aplica dejaba el
 * formulario imposible de enviar: el campo ni siquiera se muestra —la sección
 * está bloqueada— pero la validación lo seguía pidiendo por nombre. Eso impedía
 * justo lo que se busca, un formulario condicional: si el ramo es Daños, los
 * datos del auto no se piden.
 *
 * Una sección OPCIONAL solo exige sus requeridos si alguien ya puso algo en
 * ella: así se puede dejar entera en blanco, que es lo que "opcional" promete,
 * pero no se puede dejar a medias.
 */
export function campoExigible(
  campo: CampoConSeccion,
  secciones: SeccionMinima[],
  campos: CampoConSeccion[],
  respuestas: Record<string, any>
): boolean {
  if (!campo.requerido) return false;
  if (!campoCumpleSuCondicion(campo, campos, respuestas)) return false;
  if (!campo.seccion_id) return true;

  const seccion = secciones.find(s => s.id === campo.seccion_id);
  if (!seccion) return true; // sin sección conocida, se comporta como antes
  if (!seccionDesbloqueada(seccion, secciones, campos, respuestas)) return false;

  if (seccion.opcional) {
    const tocada = campos.some(c => c.seccion_id === seccion.id && tieneRespuesta(respuestas[c.id]));
    if (!tocada) return false;
  }
  return true;
}
