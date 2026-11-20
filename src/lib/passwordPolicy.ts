/**
 * Política de contraseñas de MOVI — **una sola fuente para el front**.
 *
 * Las reglas NO las inventa este archivo: son las que el proyecto Supabase
 * aplica en el servidor (`GET /v1/projects/{ref}/config/auth`). Si cambian allí,
 * aquí hay que cambiarlas también, y por eso todo lo que el usuario ve (reglas,
 * mensajes de error, medidor de fuerza) sale de este módulo en vez de estar
 * escrito a mano en cada pantalla.
 *
 *   password_min_length              = 8
 *   password_required_characters     = minúscula + MAYÚSCULA + dígito + símbolo
 *   password_hibp_enabled            = true  (rechaza contraseñas filtradas)
 *
 * HIBP no se puede comprobar desde el navegador: una contraseña puede pasar
 * todas las reglas de aquí y aun así ser rechazada por el servidor. De ahí que
 * `describePasswordError()` exista y que ninguna pantalla escriba su propio
 * mensaje: el rechazo de HIBP solo se sabe al enviar.
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRuleId = 'length' | 'lowercase' | 'uppercase' | 'digit' | 'symbol';

export interface PasswordRule {
  id: PasswordRuleId;
  /** Texto corto que se pinta en la lista de requisitos. */
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'lowercase', label: 'Una letra minúscula (a-z)', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'Una letra mayúscula (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'Un número (0-9)', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'Un símbolo (!@#$%…)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export function checkPassword(password: string): Record<PasswordRuleId, boolean> {
  return PASSWORD_RULES.reduce((acc, rule) => {
    acc[rule.id] = rule.test(password);
    return acc;
  }, {} as Record<PasswordRuleId, boolean>);
}

export function failingRules(password: string): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password));
}

export function isPasswordValid(password: string): boolean {
  return failingRules(password).length === 0;
}

/** Una línea con todas las reglas, para correos, avisos y tooltips. */
export function passwordRuleSummary(): string {
  return (
    `Al menos ${PASSWORD_MIN_LENGTH} caracteres, con una minúscula, una mayúscula, ` +
    'un número y un símbolo. No puede ser una contraseña que aparezca en filtraciones conocidas.'
  );
}

export interface PasswordStrength {
  level: number; // 0..4
  label: string;
  color: string;
}

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 1, label: 'Débil', color: '#ef4444' };
  if (score <= 3) return { level: 2, label: 'Media', color: '#f59e0b' };
  if (score <= 4) return { level: 3, label: 'Fuerte', color: '#22c55e' };
  return { level: 4, label: 'Muy fuerte', color: '#10b981' };
}

/** Lo mínimo que necesitamos de un error de supabase-js, sin atarnos a su tipo. */
export interface AuthLikeError {
  message?: string;
  code?: string;
  status?: number;
}

function raw(error: AuthLikeError | null | undefined): string {
  return `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
}

/**
 * Error de inicio de sesión. Existe aparte de `describePasswordError` porque
 * aquí el problema casi nunca es la contraseña en sí: un correo sin confirmar,
 * la cuenta bloqueada o los intentos seguidos también lo tiran.
 */
export function describeLoginError(error: AuthLikeError | null | undefined): string {
  const text = raw(error);
  if (text.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (text.includes('email not confirmed')) {
    return 'Tu correo todavía no está confirmado. Entra con Ingreso Express y quedará confirmado.';
  }
  if (text.includes('banned') || text.includes('user is disabled') || text.includes('blocked')) {
    return 'Esta cuenta está bloqueada. Pide a un Administrador que la reactive.';
  }
  if (text.includes('rate') || error?.status === 429) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  }
  return error?.message
    ? `No se pudo iniciar sesión: ${error.message}`
    : 'No se pudo iniciar sesión. Intenta de nuevo.';
}

/**
 * Traduce el error de auth a algo que el usuario pueda accionar.
 *
 * Antes cualquier fallo se pintaba como "No se pudo actualizar la contraseña":
 * daba igual que fuera una contraseña filtrada, que faltara un símbolo o que la
 * sesión se hubiera caído, y el usuario se quedaba creyendo que el cambio se
 * había guardado. El motivo real es lo único que le permite arreglarlo.
 */
export function describePasswordError(error: AuthLikeError | null | undefined): string {
  const text = raw(error);
  const message = error?.message || '';

  // HIBP: la contraseña está en una filtración. Es el rechazo que no se puede
  // predecir en el cliente ni arreglar cambiando cómo se escribe.
  if (text.includes('known to be weak') || text.includes('pwned') || text.includes('breach')) {
    return 'Esa contraseña aparece en filtraciones de datos conocidas, así que el sistema la rechaza. Elige otra distinta (no la que usas en otros sitios).';
  }

  // Política de caracteres: el servidor enumera los grupos que faltan.
  if (text.includes('should contain at least one') || text.includes('characters')) {
    return `La contraseña no cumple las reglas: ${passwordRuleSummary()}`;
  }

  if (text.includes('at least 8') || text.includes('password should be at least') || text.includes('too short')) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (text.includes('should be different') || text.includes('same as')) {
    return 'La contraseña nueva tiene que ser distinta de la anterior.';
  }

  if (text.includes('auth session missing') || text.includes('session') || text.includes('jwt')) {
    return 'Tu sesión expiró o el enlace ya no es válido. Vuelve a iniciar sesión (o pide un enlace nuevo) e inténtalo otra vez.';
  }

  if (text.includes('rate') || error?.status === 429) {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  }

  if (text.includes('reauthenticat')) {
    return 'El sistema pide confirmar de nuevo tu identidad antes de cambiar la contraseña. Vuelve a iniciar sesión e inténtalo.';
  }

  // Nada reconocido: se muestra el mensaje del servidor en vez de esconderlo.
  return message
    ? `No se pudo guardar la contraseña: ${message}`
    : 'No se pudo guardar la contraseña. Intenta de nuevo.';
}
