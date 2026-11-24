// npx tsx src/lib/tramiteAviso.test.mjs
import assert from 'node:assert/strict';
import { mensajeNuevoTramite, recortarInstrucciones } from './tramiteAviso.ts';

// ── Lo que sale cuando hay todo ───────────────────────────────────────────
assert.equal(
  mensajeNuevoTramite({
    folio: 'TK571BB', tipoLabel: 'Registro de Póliza',
    solicitante: 'HUGO CARLOS FLORES LOPEZ', oficina: 'Jiro Satélite',
    prioridad: 'Media', instrucciones: 'Registro de pedido MKT Premium — Plan Anual',
  }),
  'TK571BB — Registro de Póliza\n' +
  'Solicitante: HUGO CARLOS FLORES LOPEZ\n' +
  'Oficina: Jiro Satélite\n' +
  'Prioridad: Media\n\n' +
  'Registro de pedido MKT Premium — Plan Anual',
);

// ── Las líneas sin dato se omiten, no salen con guion ─────────────────────
assert.equal(
  mensajeNuevoTramite({ folio: 'TK1', tipoLabel: 'Cobranza', solicitante: '', oficina: null, prioridad: '  ' }),
  'TK1 — Cobranza',
);

// ── El relleno del alta no se muestra como si fuera una instrucción ───────
for (const relleno of ['Sin descripción', 'sin descripcion', 'N/A', '-', '   ']) {
  assert.equal(recortarInstrucciones(relleno), '', `"${relleno}" no es una instrucción`);
}
assert.equal(mensajeNuevoTramite({ folio: 'TK2', tipoLabel: 'Alta', instrucciones: 'Sin descripción' }), 'TK2 — Alta');

// ── Un WhatsApp kilométrico no se lee ─────────────────────────────────────
const largo = 'a'.repeat(400);
const recortado = recortarInstrucciones(largo);
assert.ok(recortado.length < 300, `se recorta (quedó en ${recortado.length})`);
assert.ok(recortado.endsWith('…'), 'y se nota que está recortado');
// Un texto que cabe no se toca ni le cuelgan puntos suspensivos.
assert.equal(recortarInstrucciones('corto'), 'corto');

// Los saltos de línea de la descripción no rompen el formato del aviso.
assert.equal(recortarInstrucciones('linea uno\n\nlinea dos'), 'linea uno linea dos');

console.log('✓ tramiteAviso: el aviso trae con qué decidir, sin líneas vacías ni textos de relleno');
