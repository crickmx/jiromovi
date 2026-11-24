// Cómo se lee la respuesta de Google siteverify en el alta pública.
//
// El criterio es deliberadamente asimétrico: **solo se rechaza cuando Google
// dice que es un bot**. Todo lo demás pasa.
//
// Por qué. Un reCAPTCHA que bloquea de más, en un formulario de alta, no se
// nota como un bloqueo: la persona ve un error genérico, lo abandona y nadie se
// entera. Un bot que pasa, en cambio, deja un registro basura que sí se ve y se
// borra. Así que cualquier cosa que no sea un veredicto claro de Google —no
// llegó token, no hay llaves, Google no contestó, la llave no empata— se trata
// como gente, no como bot.
//
// Esto reemplaza dos extremos que ya se vivieron en este archivo:
//   - Antes del 2026-09-29 se rechazaba al no llegar token, y un adblocker o
//     una ventana privada bastaban para tumbar un registro legítimo.
//   - Con el fix del 2026-09-29 la función pasó a devolver `true` SIEMPRE, con
//     lo que el reCAPTCHA quedó decorativo y el alta sin ninguna defensa.

/** Lo que devuelve https://www.google.com/recaptcha/api/siteverify. */
export interface RespuestaSiteverify {
  success?: boolean;
  score?: number;
  'error-codes'?: string[];
}

/** Debajo de esto Google considera que el tráfico es automatizado. */
export const UMBRAL_BOT = 0.3;

export interface Veredicto {
  permitir: boolean;
  /** Para el log: por qué se decidió así. */
  motivo: string;
}

/**
 * Decide con las respuestas que dio Google, una por cada llave probada.
 * Un elemento `null` es una llamada que ni siquiera se pudo hacer (red caída).
 */
export function decidirRecaptcha(args: {
  hayLlaves: boolean;
  hayToken: boolean;
  respuestas: (RespuestaSiteverify | null)[];
}): Veredicto {
  const { hayLlaves, hayToken, respuestas } = args;

  if (!hayLlaves) return { permitir: true, motivo: 'sin llaves configuradas en el backend' };
  if (!hayToken) return { permitir: true, motivo: 'sin token (adblocker o ventana privada)' };

  // La primera llave que verifica de verdad es la correcta: su veredicto manda.
  for (const r of respuestas) {
    if (!r?.success) continue;
    const score = r.score;
    if (typeof score !== 'number') return { permitir: true, motivo: 'verificado, sin score' };
    if (score < UMBRAL_BOT) {
      return { permitir: false, motivo: `Google lo califica como bot (score ${score})` };
    }
    return { permitir: true, motivo: `verificado (score ${score})` };
  }

  // Ninguna llave verificó: o no empatan, o el token venía mal, o Google no
  // contestó. Nada de eso es evidencia de bot — es problema nuestro.
  const codigos = respuestas.flatMap(r => r?.['error-codes'] ?? []);
  return {
    permitir: true,
    motivo: codigos.length > 0
      ? `sin veredicto de Google (${codigos.join(', ')})`
      : 'Google no respondió',
  };
}
