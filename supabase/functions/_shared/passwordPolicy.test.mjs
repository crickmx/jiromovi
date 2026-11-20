/**
 * Pruebas de la política de contraseñas del backend (sin red).
 *
 *   node supabase/functions/_shared/passwordPolicy.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  errorDePasswordInvalida,
  esPasswordValida,
  faltantesDePassword,
  generarPasswordSegura,
  mensajeDeRechazo,
  resumenReglas,
} from './passwordPolicy.ts';

test('esPasswordValida coincide con la política del proyecto', () => {
  assert.equal(esPasswordValida('MoviSegura!2026'), true);
  assert.deepEqual(faltantesDePassword('SoloLetras123'), ['un símbolo (!@#$%…)']);
  assert.deepEqual(faltantesDePassword('Corta1!'), ['al menos 8 caracteres']);
});

test('la contraseña generada cumple la política por construcción', () => {
  for (let i = 0; i < 200; i++) {
    const pw = generarPasswordSegura(20);
    assert.equal(pw.length, 20);
    assert.equal(esPasswordValida(pw), true, `no cumple: ${pw}`);
  }
});

test('la contraseña generada es distinta cada vez y respeta el largo mínimo', () => {
  const vistas = new Set(Array.from({ length: 50 }, () => generarPasswordSegura(20)));
  assert.equal(vistas.size, 50);
  assert.equal(generarPasswordSegura(4).length, 8);
});

test('el rechazo de HIBP se explica en español', () => {
  const msg = mensajeDeRechazo({ code: 'weak_password', message: 'Password is known to be weak and easy to guess, please choose a different one.' });
  assert.match(msg, /filtraciones/);
});

test('el rechazo por caracteres enumera las reglas', () => {
  const msg = mensajeDeRechazo({ code: 'weak_password', message: 'Password should contain at least one character of each: abc, ABC, 123, symbols' });
  assert.match(msg, /mayúscula/);
});

test('sin error del servidor, la validación local nombra lo que falta', () => {
  assert.match(errorDePasswordInvalida('sinmayusculas1!'), /mayúscula/);
  assert.equal(mensajeDeRechazo(null, 'MoviSegura!2026'), null);
  assert.match(mensajeDeRechazo(null, 'aaaa'), /falta/);
  assert.match(resumenReglas(), /filtraciones/);
});
