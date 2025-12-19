// Script para verificar cálculos GMM manualmente

// Datos del asegurado UNO
const edad = 40;
const sexo = 'Hombre';
const baseIntermedia = 20772.64;

// Factores
const factorEstado = 0.69; // QUERETARO
const factorNivel = 0.76; // PLUS
const factorTabulador = 1.147; // ORO-110,000
const factorSA = 1.017; // 50,000,000
const factorDeducible = 0.546; // 35,000
const factorCoaseguro = 0.929; // 0.15

// Calcular prima base
const primaBase = baseIntermedia * factorEstado * factorNivel * factorTabulador * factorSA * factorDeducible * factorCoaseguro;
console.log('Prima Base UNO:', primaBase.toFixed(2));

// Denominador para coberturas con carga sistema
const denominador = 1 - (0.1 + 0.27 + 0.07); // 0.56
console.log('Denominador:', denominador);

// Coberturas adicionales
const baseFactores = baseIntermedia * factorEstado * factorNivel * factorTabulador * factorSA * factorDeducible * factorCoaseguro;
console.log('Base Factores:', baseFactores.toFixed(2));

// 1. Medicamentos fuera
const coefMedicamentos = 0.20471103868386598;
const cobMedicamentos = Math.round((baseFactores / denominador) * coefMedicamentos * 100) / 100;
console.log('Cobertura Medicamentos:', cobMedicamentos.toFixed(2));

// 2. Eliminación deducible por accidente (deducible 35000)
const factorEliminacionDed = 0.1466; // índice 4 para 35000
const cobEliminacionDed = Math.round(primaBase * factorEliminacionDed * 100) / 100;
console.log('Cobertura Eliminación Deducible:', cobEliminacionDed.toFixed(2));

// 3. Multiregión (QUERETARO)
const factorMultiregion = 0.091;
const cobMultiregion = Math.round(primaBase * factorMultiregion * 100) / 100;
console.log('Cobertura Multiregión:', cobMultiregion.toFixed(2));

// 4. VIP
const coefVIP = 0.0344;
const cobVIP = Math.round(primaBase * coefVIP * 100) / 100;
console.log('Cobertura VIP:', cobVIP.toFixed(2));

// 5. Emergencia médica extranjero
const coefEmergencia = 0.012516293427348835;
const cobEmergencia = Math.round(primaBase * coefEmergencia * 100) / 100;
console.log('Cobertura Emergencia Extranjero:', cobEmergencia.toFixed(2));

// Total adicionales
const totalAdicionales = cobMedicamentos + cobEliminacionDed + cobMultiregion + cobVIP + cobEmergencia;
console.log('\n=== TOTALES ===');
console.log('Total Adicionales:', totalAdicionales.toFixed(2));
console.log('Prima Total:', (primaBase + totalAdicionales).toFixed(2));
console.log('\nValor esperado según PDF:');
console.log('Prima Base: $6,445.36');
console.log('Prima Adicionales: $2,658.53');
console.log('Prima Total: $9,103.89');
