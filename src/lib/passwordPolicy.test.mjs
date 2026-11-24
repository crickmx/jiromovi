/**
 * Pruebas de la política de contraseñas (sin red, sin React).
 *
 *   node src/lib/passwordPolicy.test.mjs
 *
 * El valor que protege esta política es que el front no se desincronice del
 * servidor: los casos de abajo son exactamente los rechazos que devuelve el
 * proyecto Supabase de MOVI (`weak_password` con reasons `characters` y `pwned`).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PASSWORD_MIN_LENGTH,
  checkPassword,
  describeLoginError,
  describePasswordError,
  failingRules,
  isPasswordValid,
  passwordRuleSummary,
  passwordStrength,
} from './passwordPolicy.ts';

test('una contraseña que cumple los cuatro grupos es válida', () => {
  assert.equal(isPasswordValid('MoviSegura!2026'), true);
  assert.deepEqual(failingRules('MoviSegura!2026'), []);
});

test('cada regla falta por su motivo (los rechazos reales del servidor)', () => {
  assert.deepEqual(failingRules('Corta1!').map((r) => r.id), ['length']);
  assert.deepEqual(failingRules('SINMINUSCULAS1!').map((r) => r.id), ['lowercase']);
  assert.deepEqual(failingRules('sinmayusculas1!').map((r) => r.id), ['uppercase']);
  assert.deepEqual(failingRules('SinNumeros!!').map((r) => r.id), ['digit']);
  assert.deepEqual(failingRules('SoloLetras123').map((r) => r.id), ['symbol']);
  assert.deepEqual(failingRules('aaaaaaaa').map((r) => r.id), ['uppercase', 'digit', 'symbol']);
  assert.equal(isPasswordValid(''), false);
});

test('los espacios no cuentan como símbolo', () => {
  assert.equal(checkPassword('Password 123').symbol, false);
});

test('el mínimo de longitud es el del proyecto', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.equal(checkPassword('Abc1!xyz').length, true);
  assert.equal(checkPassword('Abc1!xy').length, false);
});

test('el resumen nombra las reglas y HIBP', () => {
  const s = passwordRuleSummary();
  assert.match(s, /minúscula/);
  assert.match(s, /mayúscula/);
  assert.match(s, /número/);
  assert.match(s, /símbolo/);
  assert.match(s, /filtraciones/);
});

test('la fuerza sube con longitud, variedad y símbolos', () => {
  assert.equal(passwordStrength('').level, 0);
  assert.equal(passwordStrength('abcdefgh').level, 1);
  assert.equal(passwordStrength('MoviSegura!2026').level, 4);
});

test('un rechazo por filtración se explica como filtración', () => {
  const msg = describePasswordError({
    code: 'weak_password',
    status: 422,
    message: 'Password is known to be weak and easy to guess, please choose a different one.',
  });
  assert.match(msg, /filtraciones/);
});

test('un rechazo por caracteres explica las reglas, no "no se pudo"', () => {
  const msg = describePasswordError({
    code: 'weak_password',
    status: 422,
    message:
      "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~.",
  });
  assert.match(msg, /mayúscula/);
  assert.ok(!/No se pudo/.test(msg));
});

test('una sesión caída se distingue de una contraseña mala', () => {
  assert.match(describePasswordError({ message: 'Auth session missing!', status: 400 }), /sesión/);
  assert.match(describePasswordError({ status: 429, message: 'Too many requests' }), /Espera/);
});

test('un error desconocido muestra el mensaje del servidor, no uno genérico', () => {
  assert.match(
    describePasswordError({ message: 'Email not confirmed', status: 400 }),
    /Email not confirmed/,
  );
  assert.match(describePasswordError(null), /Intenta de nuevo/);
});

test('el error de inicio de sesión distingue credenciales, bloqueo y correo sin confirmar', () => {
  assert.match(describeLoginError({ message: 'Invalid login credentials' }), /incorrectos/);
  assert.match(describeLoginError({ message: 'Email not confirmed' }), /no está confirmado/);
  assert.match(describeLoginError({ code: 'user_banned', message: 'User is banned' }), /bloqueada/);
  assert.match(describeLoginError({ status: 429, message: 'too many requests' }), /Espera/);
  assert.match(describeLoginError({ message: 'boom' }), /boom/);
});
