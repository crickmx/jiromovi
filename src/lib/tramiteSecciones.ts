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
}

export interface CampoConSeccion {
  id: string;
  requerido: boolean;
  seccion_id?: string | null;
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
