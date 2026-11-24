// Autocomprobación del acceso por rol a los campos.
//   npx tsx src/lib/rolCampos.test.mjs
//
// Decide qué ve y qué puede cambiar cada quien, así que los dos errores son
// caros: de más, se filtra información o alguien mueve un estatus que no le
// toca; de menos, un administrador se queda sin poder trabajar.

import assert from 'node:assert/strict';
import { puedeVerCampo, puedeEditarCampo } from './rolCampos.ts';

// El caso que lo motivó: Estatus visible para todos, editable solo de Empleado
// para arriba. Un Agente lo veía Y lo podía cambiar.
const estatus = { visible_para_rol: 'todos', editable_para_rol: 'Empleado' };
assert.equal(puedeVerCampo(estatus, 'Agente'), true);
assert.equal(puedeEditarCampo(estatus, 'Agente'), false, 'un Agente NO debe poder cambiar el estatus');
assert.equal(puedeEditarCampo(estatus, 'Empleado'), true);
assert.equal(puedeEditarCampo(estatus, 'Gerente'), true);
assert.equal(puedeEditarCampo(estatus, 'Administrador'), true);

// Sin configuración, nada se restringe: es como se comportaba antes.
const libre = {};
for (const rol of ['Agente', 'Empleado', 'Gerente', 'Administrador', null, undefined]) {
  assert.equal(puedeVerCampo(libre, rol), true);
  assert.equal(puedeEditarCampo(libre, rol), true);
}
assert.equal(puedeEditarCampo({ visible_para_rol: 'todos', editable_para_rol: 'todos' }, 'Agente'), true);

// Un valor desconocido no debe bloquear a nadie: la columna es texto libre y
// bloquear por un dato raro dejaría el formulario inservible sin explicación.
assert.equal(puedeEditarCampo({ editable_para_rol: 'Supervisor' }, 'Agente'), true);
assert.equal(puedeVerCampo({ visible_para_rol: '' }, 'Agente'), true);
assert.equal(puedeVerCampo({ visible_para_rol: null }, 'Agente'), true);

// Visible solo para Gerente: un Empleado no lo ve.
const soloGerencia = { visible_para_rol: 'Gerente' };
assert.equal(puedeVerCampo(soloGerencia, 'Empleado'), false);
assert.equal(puedeVerCampo(soloGerencia, 'Gerente'), true);

// Un rol desconocido cae al nivel más bajo, no al más alto.
assert.equal(puedeVerCampo(soloGerencia, 'Becario'), false);

// No se puede editar lo que no se puede ver, aunque la config se contradiga.
const contradictorio = { visible_para_rol: 'Administrador', editable_para_rol: 'todos' };
assert.equal(puedeEditarCampo(contradictorio, 'Agente'), false);
assert.equal(puedeEditarCampo(contradictorio, 'Administrador'), true);

console.log('✓ rolCampos: un Agente no edita lo reservado, y una config rara no bloquea a nadie');
