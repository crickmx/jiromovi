// Reglas básicas del correo: mover o marcar según remitente o asunto.
// Se aplican al abrir el correo, sobre lo que hay en Recibidos.

export interface ReglaCorreo {
  id: string;
  nombre: string;
  campo: 'remitente' | 'asunto';
  operador: 'contiene' | 'es' | 'empieza';
  valor: string;
  accion: 'mover' | 'marcar_leido';
  carpeta_destino: string | null;
  activa: boolean;
  orden: number;
}

export interface CorreoParaRegla { uid: number; from: string; fromEmail: string; subject: string; seen: boolean }

export interface AccionRegla { uid: number; regla: ReglaCorreo }

const norm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function cumpleRegla(r: ReglaCorreo, c: CorreoParaRegla): boolean {
  if (!r.activa || !r.valor.trim()) return false;
  const v = norm(r.valor);
  const textos = r.campo === 'remitente' ? [c.fromEmail, c.from] : [c.subject];
  return textos.some(t => {
    const x = norm(t);
    if (r.operador === 'es') return x === v;
    if (r.operador === 'empieza') return x.startsWith(v);
    return x.includes(v);
  });
}

/**
 * Qué hacer con cada correo. Gana la primera regla (por orden) que aplique y
 * que de verdad cambie algo: marcar leído un correo ya leído no cuenta, y no se
 * mueve un correo a la carpeta donde ya está.
 */
export function planearReglas(reglas: ReglaCorreo[], correos: CorreoParaRegla[], carpetaActual: string): AccionRegla[] {
  const activas = [...reglas].filter(r => r.activa).sort((a, b) => a.orden - b.orden);
  const out: AccionRegla[] = [];
  for (const c of correos) {
    for (const r of activas) {
      if (!cumpleRegla(r, c)) continue;
      if (r.accion === 'marcar_leido' && c.seen) continue;
      if (r.accion === 'mover' && (!r.carpeta_destino || r.carpeta_destino === carpetaActual)) continue;
      out.push({ uid: c.uid, regla: r });
      break;
    }
  }
  return out;
}
