/**
 * Política de contraseñas de MOVI — versión del backend (Deno).
 *
 * Es la misma política que `src/lib/passwordPolicy.ts` del front: las reglas las
 * impone el proyecto Supabase (`password_min_length = 8`, los cuatro grupos de
 * caracteres, HIBP activo). Existe aquí porque las funciones que **crean o
 * cambian** contraseñas con la llave de servicio no deben fiarse del formulario:
 * si el valor llega del CSV de una carga masiva o de un panel, hay que validarlo
 * igual y devolver un mensaje en español en vez del inglés de GoTrue.
 *
 * Al desplegar una función que lo importe hay que subir también este archivo.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
  { id: 'length', label: `al menos ${PASSWORD_MIN_LENGTH} caracteres`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'lowercase', label: 'una letra minúscula', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'una letra mayúscula', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'un número', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'un símbolo (!@#$%…)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export function faltantesDePassword(password: string): string[] {
  const value = password ?? '';
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);
}

export function esPasswordValida(password: string): boolean {
  return faltantesDePassword(password).length === 0;
}

export function resumenReglas(): string {
  return (
    `Al menos ${PASSWORD_MIN_LENGTH} caracteres, con una minúscula, una mayúscula, ` +
    'un número y un símbolo. No puede ser una contraseña que aparezca en filtraciones conocidas.'
  );
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const SIMBOLOS = '!@#$%&*?+-';

/**
 * Contraseña aleatoria que **cumple la política por construcción**: se elige un
 * carácter de cada grupo obligatorio y se rellena el resto. Dejarlo al azar del
 * alfabeto completo puede producir (poco probable, pero posible) una contraseña
 * sin símbolo, y entonces el alta falla con un 422 que parece un bug de la
 * función.
 */
export function generarPasswordSegura(largo = 20): string {
  const pick = (set: string): string => {
    const buf = new Uint8Array(1);
    crypto.getRandomValues(buf);
    return set[buf[0] % set.length];
  };
  const minusculas = 'abcdefghijkmnopqrstuvwxyz';
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digitos = '23456789';

  const obligatorios = [pick(minusculas), pick(mayusculas), pick(digitos), pick(SIMBOLOS)];
  const resto: string[] = [];
  for (let i = obligatorios.length; i < Math.max(largo, PASSWORD_MIN_LENGTH); i++) {
    resto.push(pick(ALFABETO + SIMBOLOS));
  }

  // Mezcla Fisher-Yates: los obligatorios no pueden quedar siempre al principio.
  const todos = [...obligatorios, ...resto];
  for (let i = todos.length - 1; i > 0; i--) {
    const buf = new Uint8Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [todos[i], todos[j]] = [todos[j], todos[i]];
  }
  return todos.join('');
}

/**
 * Traduce el error de GoTrue al cambiar una contraseña. Sin esto, el panel que
 * manda `admin.updateUserById` devuelve al navegador el texto en inglés de
 * HIBP ("Password is known to be weak…"), que no dice qué hacer.
 */
export function mensajeDeRechazo(passwordError: { message?: string; code?: string } | null | undefined, password?: string): string | null {
  const texto = `${passwordError?.code || ''} ${passwordError?.message || ''}`.toLowerCase();

  if (texto.includes('known to be weak') || texto.includes('pwned') || texto.includes('breach')) {
    return 'Esa contraseña aparece en filtraciones de datos conocidas. Elige una distinta (no la que usas en otros sitios).';
  }
  if (texto.includes('should contain at least one') || texto.includes('characters')) {
    return `La contraseña no cumple las reglas: ${resumenReglas()}`;
  }
  if (texto.includes('at least 8') || texto.includes('password should be at least') || texto.includes('too short')) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (texto.includes('should be different') || texto.includes('same as')) {
    return 'La contraseña nueva tiene que ser distinta de la anterior.';
  }
  if (!passwordError && password !== undefined) {
    const faltan = faltantesDePassword(password);
    if (faltan.length) return `La contraseña no cumple las reglas (falta ${faltan.join(', ')}).`;
  }
  return null;
}

/** Error listo para devolver al cliente cuando la contraseña no cumple. */
export function errorDePasswordInvalida(password: string): string {
  const faltan = faltantesDePassword(password);
  if (!faltan.length) return resumenReglas();
  return `La contraseña no cumple las reglas: falta ${faltan.join(', ')}. ${resumenReglas()}`;
}
