// Calcular el coeficiente correcto trabajando hacia atrás

const primaBase = 6445.36;
const primaAdicionales = 2658.53;

// Coberturas conocidas (correctas)
const cobEliminacionDed = 944.89;
const cobMultiregion = 586.53;
const cobVIP = 221.72;
const cobEmergencia = 80.67;

// Lo que debe ser medicamentos
const cobMedicamentos = primaAdicionales - cobEliminacionDed - cobMultiregion - cobVIP - cobEmergencia;
console.log('Medicamentos debe ser:', cobMedicamentos.toFixed(2));

// Opciones de cálculo
const denominador = 1 - (0.1 + 0.27 + 0.07); // 0.56
const baseFactores = primaBase;

console.log('\n=== Opciones de coeficiente ===');
console.log('1. Si usa (baseFactores / denominador) * coef:');
console.log('   coef =', (cobMedicamentos / (baseFactores / denominador)).toFixed(5));

console.log('\n2. Si usa baseFactores * coef (SIN denominador):');
console.log('   coef =', (cobMedicamentos / baseFactores).toFixed(5));

console.log('\n3. Si usa (baseFactores * denominador) * coef:');
console.log('   coef =', (cobMedicamentos / (baseFactores * denominador)).toFixed(5));

console.log('\n4. Coeficiente actual en BD:', 0.20471103868386598);
console.log('   Resultado actual:', ((baseFactores / denominador) * 0.20471103868386598).toFixed(2));
