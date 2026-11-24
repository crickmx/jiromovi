# Sistema de Cálculo Fiscal V3 - Blindaje Completo

## 🎯 Resumen Ejecutivo

Se ha implementado un **motor fiscal completamente blindado** (V3) que garantiza cálculos correctos, validados y auditables para los tres regímenes fiscales: ASIMILADOS, HONORARIOS y RESICO.

### ✅ Validación Completa: 6/6 Casos Exitosos

**Casos Originales (Validación de Fórmulas):**
- ✅ CASO 1: ASIMILADOS ($477.40) - Diferencia: $0.01
- ✅ CASO 2: HONORARIOS ($1,784.06) - Exacto
- ✅ CASO 3: RESICO ($23,206.41) - Exacto

**Casos Actuales (PDFs de Producción):**
- ✅ CASO 4: ASIMILADOS ($14,598.70) - Exacto
- ✅ CASO 5: HONORARIOS ($14,092.79) - Exacto
- ✅ CASO 6: RESICO ($7,900.63) - Exacto

---

## 🔒 Garantías del Sistema V3

### 1. **Función Pura Sin Efectos Secundarios**
- ✅ No accede a estado global
- ✅ No usa cachés entre invocaciones
- ✅ Mismo input = mismo output siempre
- ✅ No modifica variables externas

### 2. **Validación Interna Estricta**
Cada régimen fiscal valida internamente que:

**ASIMILADOS:**
- `RET_CONTABLE` = `COMISION_EXENTA × 0.16`
- `COSTO_DISPERSION` = `COMISION_GRAVADA × 0.09`
- `RET_ISR` = suma correcta de ISR exenta + ISR gravada
- `TOTAL` > 0 (si no, warning)

**HONORARIOS:**
- `IVA` = `COMISION_GRAVADA × 0.16`
- `RET_ISR` = `COMISION_TOTAL × 0.10`
- `RET_IVA` = `IVA × (2/3)`
- `TOTAL` > 0 (si no, warning)

**RESICO:**
- `IVA` = `COMISION_GRAVADA × 0.16`
- `RET_ISR` = `COMISION_TOTAL × 0.0125`
- `RET_IVA` = `IVA × (2/3)`
- `TOTAL` > 0 (si no, warning)

### 3. **Auditoría y Versionado**
Cada cálculo incluye:
```typescript
audit: {
  formulaVersion: "v3.0.0-exact",
  performedAt: "2026-04-06T12:34:56.789Z",
  roundingPolicy: "round-half-up-2-decimals",
  validationsPassed: true,
  warnings: []
}
```

### 4. **Manejo de Errores Robusto**
- Lanza `FiscalCalculationError` si:
  - Régimen fiscal no reconocido
  - Comisiones no son números válidos
  - Comisiones son negativas
  - No hay comisiones para calcular
  - Validaciones internas fallan

### 5. **Política de Redondeo Documentada**
- **Método:** Round Half Up (Math.round)
- **Decimales:** 2
- **Protección:** Se agrega `Number.EPSILON` para evitar errores de precisión flotante
- **Consistencia:** Todos los valores monetarios usan la misma función

### 6. **Interfaces TypeScript Estrictas**
```typescript
interface FiscalBreakdownInput {
  regimenFiscal: "ASIMILADOS" | "HONORARIOS" | "RESICO";
  comisionGravada: number;
  comisionExenta: number;
  context?: {
    agentId?: string;
    loteId?: string;
    periodo?: string;
    sourceDocumentIds?: string[];
  };
}

interface FiscalBreakdownResult {
  regimenFiscal: RegimenFiscal;
  base: { comisionGravada, comisionExenta, comisionTotal };
  calculations: { retContable, costoDispersion, iva, retIsr, retIva, total };
  audit: { formulaVersion, performedAt, roundingPolicy, validationsPassed, warnings };
  pdfRows: Array<{key, label, value, formattedValue, sign}>;
}
```

---

## 📁 Archivos Implementados

### 1. Motor Fiscal Principal
**`src/lib/commissionFiscalCalculationV3.ts`** (400 líneas)
- Función principal: `calcularDesgloseFiscalV3()`
- Funciones por régimen: `calcularAsimilados()`, `calcularHonorarios()`, `calcularResico()`
- Validación de inputs: `validateInput()`
- Redondeo consistente: `round2()`
- Formateo: `formatCurrency()`
- Utilidades de testing: `validarResultadoFiscal()`, `formatearResultadoParaLog()`
- Constantes exportadas: `FISCAL_CONFIG`

### 2. Suite de Pruebas Completa
**`src/lib/commissionFiscalCalculationV3.test.ts`** (300 líneas)
- 6 casos de prueba completos
- Validación automática de totales
- Logging detallado de resultados
- Resumen visual con emojis
- Exit code 1 si hay fallos

### 3. Generador de PDF Actualizado
**`src/lib/pdfUtils.ts`** (modificado)
- Importa y usa motor V3
- Incluye contexto de auditoría en cálculos
- Muestra versión de fórmula en PDF
- Logging detallado con prefijo `[PDF V3]`

### 4. Documentación Completa
**`FISCAL_V3_BLINDAJE_COMPLETO.md`** (este archivo)
- Garantías del sistema
- Casos de prueba validados
- Fórmulas documentadas
- Guía de uso
- Troubleshooting

---

## 🧪 Cómo Ejecutar las Pruebas

### Opción 1: Con npx tsx (Recomendado)
```bash
npx tsx src/lib/commissionFiscalCalculationV3.test.ts
```

### Opción 2: Con Node.js + Compilación TypeScript
```bash
npm run typecheck
node dist/lib/commissionFiscalCalculationV3.test.js
```

### Resultado Esperado
```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║               SUITE DE PRUEBAS - MOTOR FISCAL V3                             ║
║                    Sistema MOVI Digital - 2026                               ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

Versión de Fórmulas: v3.0.0-exact
Política de Redondeo: round-half-up-2-decimals
Tolerancia: $0.02
Total de Tests: 6

[Tests ejecutándose...]

╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                            RESUMEN DE TESTS                                  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

✅ PASÓ  - CASO 1: ASIMILADOS - Validación Original
✅ PASÓ  - CASO 2: HONORARIOS - Validación Original
✅ PASÓ  - CASO 3: RESICO - Validación Original
✅ PASÓ  - CASO 4: ASIMILADOS - PDF Actual
✅ PASÓ  - CASO 5: HONORARIOS - PDF Actual
✅ PASÓ  - CASO 6: RESICO - PDF Actual

────────────────────────────────────────────────────────────────────────────────
Total: 6 | Exitosos: 6 | Fallidos: 0
────────────────────────────────────────────────────────────────────────────────

🎉 ¡TODOS LOS TESTS PASARON EXITOSAMENTE!

El motor fiscal V3 está validado y listo para producción.

Garantías verificadas:
  ✓ Cálculos exactos según fórmulas oficiales
  ✓ Validaciones internas completas
  ✓ Consistencia entre casos originales y actuales
  ✓ Auditoría y versionado implementados
  ✓ Manejo de errores robusto
```

---

## 📐 Fórmulas Implementadas

### ASIMILADOS
```typescript
RET_CONTABLE = COMISION_EXENTA × 0.16
COSTO_DISPERSION = COMISION_GRAVADA × 0.09
BASE_ISR_EXENTA = COMISION_EXENTA / 1.16
ISR_EXENTA = BASE_ISR_EXENTA × 0.10
BASE_ISR_GRAVADA = COMISION_GRAVADA / 1.09
ISR_GRAVADA = BASE_ISR_GRAVADA × 0.10
RET_ISR = ISR_EXENTA + ISR_GRAVADA
IVA = 0
RET_IVA = 0
TOTAL = (COMISION_GRAVADA + COMISION_EXENTA) - RET_CONTABLE - COSTO_DISPERSION - RET_ISR
```

### HONORARIOS
```typescript
RET_CONTABLE = 0
COSTO_DISPERSION = 0
IVA = COMISION_GRAVADA × 0.16
RET_ISR = COMISION_TOTAL × 0.10
RET_IVA = IVA × (2/3)
TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA
```

### RESICO
```typescript
RET_CONTABLE = 0
COSTO_DISPERSION = 0
IVA = COMISION_GRAVADA × 0.16
RET_ISR = COMISION_TOTAL × 0.0125
RET_IVA = IVA × (2/3)
TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA
```

---

## 💡 Guía de Uso

### En el Frontend (Generación de PDF)

```typescript
import {
  calcularDesgloseFiscalV3,
  type FiscalBreakdownInput
} from './commissionFiscalCalculationV3';

// 1. Clasificar comisiones por ramo
const comisionGravada = 10708.94; // NO VIDA
const comisionExenta = 4315.11;   // VIDA

// 2. Preparar input con contexto
const input: FiscalBreakdownInput = {
  regimenFiscal: 'HONORARIOS',
  comisionGravada,
  comisionExenta,
  context: {
    agentId: 'abc-123',
    periodo: '2026-04-W15'
  }
};

// 3. Calcular (lanza error si hay problemas)
try {
  const resultado = calcularDesgloseFiscalV3(input);

  // 4. Verificar validaciones
  if (!resultado.audit.validationsPassed) {
    console.error('Validaciones fallaron');
    return;
  }

  // 5. Usar pdfRows para renderizar
  resultado.pdfRows.forEach(row => {
    console.log(`${row.label}: ${row.formattedValue}`);
  });

  // 6. Total a pagar
  console.log(`Total: ${resultado.calculations.total}`);

} catch (error) {
  if (error instanceof FiscalCalculationError) {
    console.error(`Error: ${error.code}`, error.message);
  }
}
```

### En Testing

```typescript
import {
  calcularDesgloseFiscalV3,
  validarResultadoFiscal
} from './commissionFiscalCalculationV3';

const resultado = calcularDesgloseFiscalV3({
  regimenFiscal: 'ASIMILADOS',
  comisionGravada: 82.11,
  comisionExenta: 544.20
});

const validacion = validarResultadoFiscal(resultado, 477.40);

if (validacion.valido) {
  console.log('✅ Test pasó');
} else {
  console.log(`❌ Test falló: diferencia de $${validacion.diferencia}`);
}
```

---

## 🐛 Troubleshooting

### Error: "Régimen fiscal no reconocido"
**Causa:** El régimen no es ASIMILADOS, HONORARIOS o RESICO (case-sensitive)
**Solución:** Normalizar a mayúsculas antes de llamar la función

### Error: "Comisión gravada inválida"
**Causa:** El valor no es un número o es negativo
**Solución:** Validar datos antes de llamar la función

### Error: "Validación fallida: IVA no coincide"
**Causa:** Bug en las fórmulas o redondeo incorrecto
**Solución:** Revisar el código de cálculo, esto NO debe pasar

### Warning: "TOTAL negativo detectado"
**Causa:** Las deducciones superan las comisiones
**Solución:** Revisar los montos de entrada, puede ser correcto en casos especiales

---

## 📊 Comparación de Versiones

| Característica | V1 (Original) | V2 (Exacto) | V3 (Blindado) |
|----------------|---------------|-------------|---------------|
| Fórmulas correctas | ❌ | ✅ | ✅ |
| Función pura | ❌ | ✅ | ✅ |
| Validación interna | ❌ | ❌ | ✅ |
| Auditoría | ❌ | ❌ | ✅ |
| Manejo de errores | ⚠️ | ⚠️ | ✅ |
| 6 casos validados | ❌ | ⚠️ | ✅ |
| TypeScript estricto | ⚠️ | ✅ | ✅ |
| Documentación | ⚠️ | ✅ | ✅ |

---

## 🚀 Próximos Pasos

### ✅ Completado
1. Motor fiscal puro y blindado
2. Validación interna estricta
3. Suite de pruebas con 6 casos
4. Auditoría y versionado
5. Integración con generador de PDF
6. Documentación completa

### ⏭️ Opcional (Futuro)
1. Migración de base de datos para usar V3 en batch calculations
2. Dashboard de auditoría de cálculos
3. Alertas automáticas si validaciones fallan
4. Tests de integración end-to-end
5. Métricas de precisión y performance

---

## 📞 Soporte

Para dudas sobre el sistema fiscal V3:

1. **Revisar este documento** primero
2. **Ejecutar las pruebas** para validar comportamiento
3. **Leer el código fuente** - está completamente documentado
4. **Verificar logs** en consola con prefijo `[Fiscal V3]` o `[PDF V3]`

---

**Implementado:** 2026-04-06
**Versión:** V3 - Blindaje Completo
**Estado:** ✅ Validado, Testeado y Listo para Producción
**Casos de Prueba:** 6/6 Exitosos
**Cobertura:** ASIMILADOS, HONORARIOS, RESICO
