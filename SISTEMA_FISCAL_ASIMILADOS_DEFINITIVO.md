# Sistema Fiscal ASIMILADOS - Documentación Definitiva

## Resumen Ejecutivo

Este documento describe la implementación DEFINITIVA del cálculo fiscal para el régimen ASIMILADOS en el módulo de Comisiones por Lote Semanal.

## Reglas Críticas

### PROHIBIDO (Eliminado Completamente)

Las siguientes prácticas están PROHIBIDAS y han sido eliminadas:

1. ISR calculado con una base global única
2. Cualquier fórmula del tipo: `ISR = ((ComisiónTotal - RetContable - CostoDispersión) / 1.09) × 0.10`
3. Cualquier ISR que:
   - No separe Vida / Sin Vida
   - Use una sola base neta
   - Se recalcule dentro del PDF
   - Se derive directamente de commission_total

### OBLIGATORIO (Única Lógica Válida)

Aplica SOLO para:
- Régimen fiscal: ASIMILADOS
- Módulo: Comisiones → Lotes por Semana

## Fórmulas Correctas

### 1. Bases del Lote (por semana)

```
vida = suma(comisión_base donde ramo == "Vida")
sinVida = suma(comisión_base donde ramo != "Vida")
total = vida + sinVida
```

**IMPORTANTE:**
- `comisión_base` SIEMPRE viene del campo `Importe` del Excel
- Corresponde a `commission_neta` en la base de datos
- `PrimaNeta` es solo informativa y NO participa en ningún cálculo

### 2. Retenciones Obligatorias

```
retContable = vida × 0.16
costoDispersion = sinVida × 0.09
iva = 0
```

### 3. ISR CORRECTO (SEPARADO, OBLIGATORIO)

**NUNCA usar base global**

```
isrVida = (vida - retContable) × 0.10
isrDanios = (sinVida - costoDispersion) × 0.10
isrTotal = isrVida + isrDanios
```

**NOTA IMPORTANTE:** La fórmula implementada NO usa división /1.09 porque los valores de prueba del usuario así lo requieren.

### 4. Total Neto del Lote Semanal

```
totalPagar = total - retContable - costoDispersion - isrTotal
```

### 5. Redondeo (obligatorio)

Todos los conceptos fiscales deben redondearse a 2 decimales:

```
round2(retContable)
round2(costoDispersion)
round2(isrVida)
round2(isrDanios)
round2(isrTotal)
round2(totalPagar)
```

El redondeo se hace al final de cada concepto, no antes.

## Caso de Prueba (Test Bloqueante)

### Entrada

```
vida = 544.20
sinVida = 14,263.87
total = 14,808.07
```

### Resultado Esperado

```
retContable = 87.07
costoDispersion = 1,283.75
isrTotal = 1,343.72
totalPagar = 12,093.53
```

### Regla

Si cualquier valor NO coincide exactamente (diferencia > 0.01):

```
throw Error("CÁLCULO FISCAL ASIMILADOS INCORRECTO EN LOTE SEMANAL")
```

## Arquitectura del Sistema

### Base de Datos (Única Fuente de Verdad)

**Función:** `calcular_desglose_fiscal_asimilados(p_batch_id, p_agent_id)`

**Ubicación:** `supabase/migrations/20251219235900_fix_asimilados_formula_sin_109.sql`

**Responsabilidad:**
- Sumar todas las comisiones por Vida y Sin Vida
- Aplicar las fórmulas fiscales correctas
- Retornar el desglose completo como JSON
- Es la ÚNICA fuente de verdad

**Campos retornados:**
```json
{
  "regimen_fiscal": "ASIMILADOS",
  "es_asimilados": true,
  "total_comision": 14808.07,
  "vida": 544.20,
  "sin_vida": 14263.87,
  "ret_contable": 87.07,
  "dispersion": 1283.75,
  "iva": 0.00,
  "isr_vida": 45.71,
  "isr_danios": 1298.01,
  "isr_total": 1343.72,
  "total_pagar": 12093.53
}
```

### Frontend

**Archivo:** `src/pages/MisComisiones.tsx` (líneas 95-108)

**Responsabilidad:**
- Consultar la función de base de datos
- Guardar el resultado en `desgloseFiscal` map
- NUNCA recalcular valores

**Código:**
```typescript
const { data: fiscal, error: fiscalError } = await supabase.rpc(
  'calcular_desglose_fiscal_asimilados',
  {
    p_batch_id: batch.id,
    p_agent_id: agent.id
  }
);

if (!fiscalError && fiscal) {
  fiscalMap.set(batch.id, fiscal);
}
```

### Generador de PDF

**Archivo:** `src/lib/pdfUtils.ts` (línea 666)

**Responsabilidad:**
- Consultar la función de base de datos para ASIMILADOS
- Renderizar valores sin recalcular NADA
- Mostrar SOLO los campos permitidos

**Código:**
```typescript
if (regimenFiscal === 'ASIMILADOS') {
  desgloseFiscal = await obtenerDesgloseFiscalDesdeDB(
    batch.id,
    agentDetails[0].agent_id
  );
}
```

### Campos Mostrados en el PDF

El PDF de "Orden de Pago" muestra ÚNICAMENTE:

- Comisión Total
- Ret. Contable
- Costo Dispersión
- IVA (0.00)
- ISR Total (valor único)
- Total a Pagar

**NO muestra:**
- ISR Vida
- ISR Daños
- Bases intermedias
- Ningún cálculo interno

## Persistencia de Datos

Aunque actualmente no se persisten campos adicionales en `commission_batches`, el sistema funciona calculando en tiempo real desde `commission_details` usando la función de base de datos.

**Campos consultados dinámicamente:**
- `commission_total` (suma de commission_neta)
- `commission_vida` (suma donde ramo == "Vida")
- `commission_sinvida` (suma donde ramo != "Vida")
- `retencion_contable` (calculado)
- `costo_dispersion` (calculado)
- `isr_total` (calculado)
- `total_neto` (calculado)

## Test Bloqueante

### Test de Base de Datos

**Archivo:** `supabase/migrations/20251219235900_fix_asimilados_formula_sin_109.sql`

**Ejecución:** Se ejecuta automáticamente al aplicar la migración

**Falla si:** Cualquier valor calculado difiere del esperado en más de 0.01

### Test TypeScript

**Archivo:** `src/lib/commissionAsimiladosTest.ts`

**Funciones:**
- `testAsimiladosCalculosCorrecto()`: Ejecuta el test con el caso de prueba
- `todosLosTestsPasaron()`: Verifica si todos los tests pasaron
- `generarReporteTest()`: Genera un reporte de resultados
- `ejecutarTestBloqueante()`: Lanza excepción si algún test falla

**Ejecución:** Se ejecuta automáticamente en modo desarrollo

## Verificación del Sistema

### Checklist de Implementación

- [x] Función de base de datos implementada sin /1.09
- [x] Test bloqueante en base de datos
- [x] Test TypeScript creado
- [x] Frontend consulta la función de BD (no recalcula)
- [x] PDF consulta la función de BD (no recalcula)
- [x] PDF muestra solo campos permitidos
- [x] Redondeo a 2 decimales en todos los cálculos
- [x] Separación Vida/Sin Vida en todos los cálculos

### Puntos de Validación

1. **Base de Datos:**
   ```sql
   SELECT * FROM test_asimilados_calculo_correcto();
   ```
   Todos los campos deben mostrar "CORRECTO"

2. **Frontend (Consola del navegador):**
   ```typescript
   import { ejecutarTestBloqueante } from './lib/commissionAsimiladosTest';
   ejecutarTestBloqueante();
   ```
   Debe mostrar "TODOS LOS TESTS PASARON"

3. **PDF Generado:**
   - Verificar que muestra ISR Total único
   - Verificar que NO muestra ISR Vida ni ISR Daños
   - Verificar que los valores coinciden con la función de BD

## Alcance del Cambio

Este sistema aplica a:

- Backend de cálculo de comisiones
- Resumen del lote semanal
- Vista "Mis Comisiones"
- Generación del PDF "Orden de Pago"

Cualquier lógica fiscal previa ha sido eliminada.

## Resultado Esperado

- Todos los lotes por semana en Comisiones
- Todos los PDFs de Orden de Pago
- Coinciden EXACTAMENTE con los valores correctos
- No hay variaciones de centavos
- No existen cálculos duplicados o inconsistentes

## Troubleshooting

### Si los valores no coinciden:

1. Verificar que se está usando `commission_neta` (no `prima_base`)
2. Verificar que el régimen fiscal es "ASIMILADOS"
3. Verificar que se están separando Vida y Sin Vida correctamente
4. Verificar que el redondeo se aplica a 2 decimales
5. Ejecutar el test de base de datos manualmente
6. Revisar los logs de la función de base de datos

### Si el PDF muestra valores incorrectos:

1. Verificar que está llamando a `obtenerDesgloseFiscalDesdeDB`
2. Verificar que NO está usando `calcularDesgloseFiscalCore` para ASIMILADOS
3. Verificar que está usando `getPdfFiscalRows` para filtrar campos

### Si el frontend muestra valores incorrectos:

1. Verificar que está llamando a `supabase.rpc('calcular_desglose_fiscal_asimilados')`
2. Verificar que está guardando el resultado en el estado
3. Verificar que NO está recalculando con funciones locales

## Conclusión

Este sistema implementa la ÚNICA lógica válida para el cálculo fiscal de ASIMILADOS, eliminando cualquier inconsistencia o cálculo duplicado. Todo el sistema consulta una única fuente de verdad (la función de base de datos) y NUNCA recalcula valores.
