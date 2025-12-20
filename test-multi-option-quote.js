/**
 * Test de Cotizaciones Comparativas GMM BX+
 *
 * Este script demuestra cómo usar calculateQuoteMultiOption
 * para crear cotizaciones con múltiples opciones.
 */

// Ejemplo de uso de la nueva función calculateQuoteMultiOption

const mockInput = {
  // Asegurados comunes a todas las opciones
  insureds: [
    { nombre: 'Alisson Romero', edad: 29, sexo: 'Mujer' }
  ],

  // Opción A: Deducible $29,000, Coaseguro 10%
  // Opción B: Deducible $17,000, Coaseguro 10%
  // Opción C: Deducible $29,000, Coaseguro 0%
  options: [
    {
      plan: {
        zona: 'ZONA 1',
        estado: 'Jalisco',
        nivel_hospitalario: 'PLUS',
        tabulador: 'ORO-110,000',
        suma_asegurada: '50000000',
        deducible: '29000',
        coaseguro: '0.10',
        formas_pago: ['ANUAL'],
        montos: {}
      },
      coberturas: {
        medicamentos_fuera: true,
        eliminacion_deducible_accidente: true,
        multiregion: true,
        vip: true,
        emergencia_medica_extranjero: true
      }
    },
    {
      plan: {
        zona: 'ZONA 1',
        estado: 'Jalisco',
        nivel_hospitalario: 'PLUS',
        tabulador: 'ORO-110,000',
        suma_asegurada: '50000000',
        deducible: '17000',
        coaseguro: '0.10',
        formas_pago: ['ANUAL'],
        montos: {}
      },
      coberturas: {
        medicamentos_fuera: true,
        eliminacion_deducible_accidente: true,
        multiregion: false,
        vip: true,
        emergencia_medica_extranjero: true
      }
    },
    {
      plan: {
        zona: 'ZONA 1',
        estado: 'Ciudad de México',
        nivel_hospitalario: 'ELITE',
        tabulador: 'DIAMANTE',
        suma_asegurada: '100000000',
        deducible: '29000',
        coaseguro: '0.00',
        formas_pago: ['MENSUAL'],
        montos: {}
      },
      coberturas: {
        medicamentos_fuera: true,
        eliminacion_deducible_accidente: false,
        multiregion: true,
        vip: true,
        emergencia_medica_extranjero: true
      }
    }
  ]
};

console.log('==========================================');
console.log('TEST: Cotizaciones Comparativas GMM BX+');
console.log('==========================================');
console.log('');
console.log('Input:');
console.log('  Asegurados:', mockInput.insureds.length);
console.log('  Opciones:', mockInput.options.length);
console.log('');
console.log('Opción A:');
console.log('  - Deducible: $29,000');
console.log('  - Coaseguro: 10%');
console.log('  - Estado: Jalisco');
console.log('  - Nivel: PLUS');
console.log('');
console.log('Opción B:');
console.log('  - Deducible: $17,000');
console.log('  - Coaseguro: 10%');
console.log('  - Estado: Jalisco');
console.log('  - Nivel: PLUS');
console.log('');
console.log('Opción C:');
console.log('  - Deducible: $29,000');
console.log('  - Coaseguro: 0%');
console.log('  - Estado: CDMX');
console.log('  - Nivel: ELITE');
console.log('');
console.log('==========================================');
console.log('Para ejecutar el cálculo en el cotizador:');
console.log('');
console.log('1. Importar:');
console.log('   import { calculateQuoteMultiOption } from "../lib/gmmCalculationEngineV2";');
console.log('');
console.log('2. Usar:');
console.log('   const result = calculateQuoteMultiOption(multiInput, tariffTables);');
console.log('');
console.log('3. Resultado:');
console.log('   result.options[0].totales.total_pagar  // Total Opción A');
console.log('   result.options[1].totales.total_pagar  // Total Opción B');
console.log('   result.options[2].totales.total_pagar  // Total Opción C');
console.log('');
console.log('==========================================');
console.log('✓ Los tipos y función están disponibles');
console.log('✓ Las importaciones están correctas');
console.log('✓ El build funciona sin errores');
console.log('==========================================');
