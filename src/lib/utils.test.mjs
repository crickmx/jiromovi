// Autocomprobación de cn: npx tsx src/lib/utils.test.mjs
import assert from 'node:assert/strict';
import { cn, cnSistema } from './utils.ts';

const casos = [
  // tamaño propio + color: se quedan los dos
  [['text-metric', 'text-neutral-900'], 'text-metric text-neutral-900'],
  [['text-body-sm', 'text-neutral-500'], 'text-body-sm text-neutral-500'],
  [['text-title-sm font-semibold text-neutral-900 dark:text-white', 'text-amber-900'], 'text-title-sm font-semibold dark:text-white text-amber-900'],
  // dos tamaños: gana el último, sea propio o de Tailwind
  [['text-title', 'text-base'], 'text-base'],
  [['text-sm', 'text-body'], 'text-body'],
  [['text-body', 'text-title-lg'], 'text-title-lg'],
  // dos colores: gana el último, como siempre
  [['text-red-500', 'text-blue-500'], 'text-blue-500'],
];
for (const [args, esperado] of casos) {
  assert.equal(cn(...args), esperado, `cn(${JSON.stringify(args)})`);
}
assert.equal(cnSistema, cn);
console.log(`ok — ${casos.length} casos`);
