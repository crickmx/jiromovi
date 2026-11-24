// Autocomprobación del emparejado de reglas de equipo por usuario.
//   npx tsx src/lib/tramiteTeamAssignments.test.mjs
//
// Lo que se protege: que renombrar un área —o mover un equipo a otra— no
// duplique la regla ni borre el ejecutivo asignado a mano. El área se guarda
// como texto, así que emparejar por área es exactamente donde se rompía.

import assert from 'node:assert/strict';
import { planearReglasDeEquipo, groupTramiteTeamsByCategory } from './tramiteTeamRules.ts';

const sel = (pares) => new Map(pares);

// ── El área se renombró: misma regla, mismo equipo, nombre nuevo ──────────────
{
  const existentes = [{ id: 'r1', grupo_id: 'g1', area: 'Operaciones', activo: true }];
  const plan = planearReglasDeEquipo(existentes, sel([['mesa de control', { id: 'g1', area: 'Mesa de Control' }]]));
  assert.deepEqual(plan.insertar, [], 'no debe crear una regla nueva por un renombre');
  assert.deepEqual(plan.desactivar, [], 'no debe desactivar la regla que sigue vigente');
  assert.deepEqual(plan.actualizar, [{ id: 'r1', grupo_id: 'g1', area: 'Mesa de Control', limpiarEjecutivo: false }]);
}

// ── El equipo se movió de área: igual, y el ejecutivo se conserva ─────────────
{
  const existentes = [{ id: 'r1', grupo_id: 'g1', area: 'Comercial', activo: true, ejecutivo_id: 'u9' }];
  const plan = planearReglasDeEquipo(existentes, sel([['operaciones', { id: 'g1', area: 'Operaciones' }]]));
  assert.equal(plan.actualizar[0].limpiarEjecutivo, false, 'mismo equipo ⇒ el ejecutivo no se toca');
  assert.deepEqual(plan.insertar, []);
  assert.deepEqual(plan.desactivar, []);
}

// ── Cambio real de equipo dentro de la misma área: se limpia el ejecutivo ─────
{
  const existentes = [{ id: 'r1', grupo_id: 'g1', area: 'Operaciones', activo: true }];
  const plan = planearReglasDeEquipo(existentes, sel([['operaciones', { id: 'g2', area: 'Operaciones' }]]));
  assert.deepEqual(plan.actualizar, [{ id: 'r1', grupo_id: 'g2', area: 'Operaciones', limpiarEjecutivo: true }]);
  assert.deepEqual(plan.desactivar, []);
}

// ── Área nueva sin regla previa: se inserta, sin tocar las demás ──────────────
{
  const existentes = [{ id: 'r1', grupo_id: 'g1', area: 'Comercial', activo: true }];
  const plan = planearReglasDeEquipo(existentes, sel([
    ['comercial', { id: 'g1', area: 'Comercial' }],
    ['cobranza', { id: 'g7', area: 'Cobranza' }],
  ]));
  assert.deepEqual(plan.insertar, [{ grupo_id: 'g7', area: 'Cobranza' }]);
  assert.deepEqual(plan.desactivar, []);
}

// ── Una regla que ya no corresponde a ningún equipo elegido se desactiva ──────
{
  const existentes = [
    { id: 'r1', grupo_id: 'g1', area: 'Comercial', activo: true },
    { id: 'r2', grupo_id: 'g5', area: 'Mercadotecnia', activo: true },
  ];
  const plan = planearReglasDeEquipo(existentes, sel([['comercial', { id: 'g1', area: 'Comercial' }]]));
  assert.deepEqual(plan.desactivar, ['r2']);
}

// ── Duplicados viejos del mismo equipo: se reusa la activa, la otra se apaga ──
{
  const existentes = [
    { id: 'vieja', grupo_id: 'g1', area: 'Operaciones', activo: false },
    { id: 'viva', grupo_id: 'g1', area: 'Operaciones', activo: true },
  ];
  const plan = planearReglasDeEquipo(existentes, sel([['operaciones', { id: 'g1', area: 'Operaciones' }]]));
  assert.equal(plan.actualizar.length, 1);
  assert.equal(plan.actualizar[0].id, 'viva', 'debe reusar la regla en uso, no la desactivada');
  assert.deepEqual(plan.desactivar, ['vieja']);
}

// ── Sin selección: todo se apaga, nada se inserta ─────────────────────────────
{
  const existentes = [{ id: 'r1', grupo_id: 'g1', area: 'Comercial', activo: true }];
  const plan = planearReglasDeEquipo(existentes, sel([]));
  assert.deepEqual(plan, { actualizar: [], insertar: [], desactivar: ['r1'] });
}

// ── Las categorías se agrupan por el área que traiga el equipo, con o sin acento
{
  const grupos = groupTramiteTeamsByCategory([
    { id: 'a', nombre: 'Mesa CDMX', color: null, area_categoria: 'Operaciones' },
    { id: 'b', nombre: 'Merca', color: null, area_categoria: 'Mercadotecnía' },
    { id: 'c', nombre: 'Cobranza Nueva', color: null, area_categoria: 'Cobranza' },
  ]);
  const etiquetas = grupos.map(g => g.label);
  assert.ok(etiquetas.includes('Cobranza'), 'un área nueva debe aparecer con su nombre real');
  assert.equal(grupos.length, 3);
}

console.log('✓ tramiteTeamRules: renombrar un área o mover un equipo no duplica reglas ni borra el ejecutivo');
