// Qué correos forman el mismo hilo. El servidor manda candidatos por asunto;
// aquí se decide con las referencias (Message-ID / In-Reply-To / References).

export interface CorreoHilo {
  uid: number;
  folder?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
  subject: string;
  fromEmail: string;
  to: string[];
  date: string;
}

const ids = (s?: string) => (s || '').match(/<[^>]+>/g)?.map(x => x.toLowerCase()) ?? [];

export function asuntoBaseCliente(subject: string): string {
  let s = (subject || '').trim();
  for (let i = 0; i < 5; i++) {
    const n = s.replace(/^\s*(re|rv|fw|fwd|reenv|res|aw|wg)\s*(\[\d+\])?\s*:\s*/i, '');
    if (n === s) break;
    s = n;
  }
  return s.trim().toLowerCase();
}

/**
 * Devuelve los demás correos del hilo de `actual`, del más viejo al más nuevo,
 * sin repetir (el mismo correo puede venir de Entrada y de otra carpeta).
 */
export function correosDelHilo<T extends CorreoHilo>(actual: CorreoHilo, candidatos: T[]): T[] {
  const propio = (actual.messageId || '').toLowerCase();
  const red = new Set<string>([propio, ...ids(actual.inReplyTo), ...ids(actual.references)].filter(Boolean));
  const base = asuntoBaseCliente(actual.subject);
  const correoDe = (e: string) => e.toLowerCase().replace(/.*<|>.*/g, '').trim();
  const participantes = new Set([actual.fromEmail, ...actual.to].map(correoDe));

  // Expandir la red: un candidato que cite algo de la red entra y aporta sus ids.
  let cambio = true;
  const dentro = new Set<T>();
  while (cambio) {
    cambio = false;
    for (const c of candidatos) {
      if (dentro.has(c)) continue;
      const suyos = [(c.messageId || '').toLowerCase(), ...ids(c.inReplyTo), ...ids(c.references)].filter(Boolean);
      if (suyos.some(x => red.has(x))) {
        dentro.add(c);
        suyos.forEach(x => red.add(x));
        cambio = true;
      }
    }
  }
  // Sin referencias (clientes que no las mandan): mismo asunto y mismas personas.
  for (const c of candidatos) {
    if (dentro.has(c)) continue;
    if (!base || asuntoBaseCliente(c.subject) !== base) continue;
    const suyos = [c.fromEmail, ...c.to].map(correoDe);
    if (suyos.some(p => participantes.has(p))) dentro.add(c);
  }

  const vistos = new Set<string>([propio]);
  const out: T[] = [];
  for (const c of [...dentro].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
    const k = (c.messageId || `${c.folder}:${c.uid}`).toLowerCase();
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(c);
  }
  return out;
}
