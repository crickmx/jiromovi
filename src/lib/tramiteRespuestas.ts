// En qué columna de `tramite_respuestas` se guarda el valor de cada campo.
//
// La tabla tiene cinco columnas de valor y el tipo del campo decide cuál se usa.
// **Si quien escribe y quien lee no usan la misma lista, el campo se guarda sin
// error y se muestra vacío** — no hay forma de notarlo salvo mirando el dato.
//
// Esa lista estaba copiada en cuatro archivos, y ya había divergido: la copia de
// `mktPremiumTriggers.ts` no incluía `area`, `equipo`, `creado_por` ni
// `oficina_jiro` (y sí tres tipos que no existen en el proyecto: `select`,
// `radio`, `checkbox`). Resultado: los trámites creados desde Marketing Premium
// escribían esos campos en `valor_json` mientras el detalle los lee de
// `valor_texto`, así que salían vacíos.
//
// Esta es la lista buena, la misma que usa `TramiteDetalle` para leer.

/** Tipos cuyo valor vive en `valor_texto`. */
export const TIPOS_TEXTO = [
  'texto_corto', 'texto_largo', 'area', 'equipo',
  'agente_vendedor', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion', 'creado_por',
  'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp',
];

export const TIPOS_NUMERICOS = ['numerico', 'porcentaje'];

export interface RespuestaTramite {
  tramite_id: string;
  campo_id: string;
  valor_texto: string | null;
  valor_numerico: number | null;
  valor_fecha: string | null;
  valor_booleano: boolean | null;
  valor_json: unknown;
}

/** Qué columna le toca a un tipo de campo. */
export function columnaDeTipo(tipoCampo: string): keyof Pick<
  RespuestaTramite, 'valor_texto' | 'valor_numerico' | 'valor_fecha' | 'valor_booleano' | 'valor_json'
> {
  if (TIPOS_TEXTO.includes(tipoCampo)) return 'valor_texto';
  if (TIPOS_NUMERICOS.includes(tipoCampo)) return 'valor_numerico';
  if (tipoCampo === 'fecha') return 'valor_fecha';
  if (tipoCampo === 'booleano') return 'valor_booleano';
  return 'valor_json';
}

/** Arma la fila de `tramite_respuestas` con el valor en la columna correcta. */
export function construirRespuesta(
  tramiteId: string,
  campoId: string,
  tipoCampo: string,
  valor: unknown,
): RespuestaTramite {
  const columna = columnaDeTipo(tipoCampo);
  return {
    tramite_id: tramiteId,
    campo_id: campoId,
    valor_texto: columna === 'valor_texto' ? String(valor) : null,
    valor_numerico: columna === 'valor_numerico' ? Number(valor) : null,
    valor_fecha: columna === 'valor_fecha' ? String(valor) : null,
    valor_booleano: columna === 'valor_booleano' ? Boolean(valor) : null,
    valor_json: columna === 'valor_json' ? valor : null,
  };
}
