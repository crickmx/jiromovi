# FIX DEFINITIVO: ISR ASIMILADOS Implementado y Validado

## Problema Resuelto

El sistema calculaba el ISR de ASIMILADOS usando una fórmula global incorrecta:

```
ISR_INCORRECTO = ((ComisiónTotal - RetContable - CostoDispersión) / 1.09) × 0.10
```

Esto producía ISR ~ $1,232.78 cuando debería ser un valor diferente.

## Solución Implementada

### 1. Eliminación Completa del Cálculo Incorrecto

✅ **Eliminado trigger viejo**: `calcular_asimilados_detalle()` que calculaba por fila individual
✅ **Eliminada función de clasificación**: `clasificar_tipo_ramo()`
✅ **Eliminadas columnas innecesarias**: `tipo_ramo`, `asimilados_base_vida`, etc.

### 2. Fórmulas Fiscales Correctas (SIN /1.09)

La función `calcular_desglose_fiscal_asimilados()` implementa:

```sql
-- PASO 1: SUMAR comisiones por Vida y Sin Vida
vida = SUM(comisión WHERE ramo = 'vida')
sinVida = SUM(comisión WHERE ramo != 'vida')

-- PASO 2: APLICAR fórmulas fiscales
retContable = vida × 0.16
dispersion = sinVida × 0.09

isrVida = (vida - retContable) × 0.10
isrDanios = (sinVida - dispersion) × 0.10
isrTotal = isrVida + isrDanios

totalPagar = (vida + sinVida) - retContable - dispersion - isrTotal
IVA = 0
```

### 3. Frontend: Solo Consulta, NUNCA Calcula

#### MisComisiones.tsx
- ✅ Consulta `calcular_desglose_fiscal_asimilados()` al cargar
- ✅ Muestra panel de desglose fiscal pre-calculado
- ❌ NO recalcula ningún valor

#### PDF (pdfUtils.ts)
- ✅ Consulta `obtenerDesgloseFiscalDesdeDB()` para ASIMILADOS
- ✅ Muestra solo: Ret. Contable, Costo Dispersión, IVA (0), ISR Total, Total
- ❌ NO muestra ISR Vida ni ISR Daños (calculados internamente)
- ❌ NO recalcula ningún valor

### 4. Test Automático Bloqueante

Función `test_asimilados_con_caso_real()` que valida:
- ✅ Ret. Contable = Vida × 0.16
- ✅ Dispersión = Sin Vida × 0.09
- ✅ Fórmulas ISR aplicadas correctamente
- ✅ Total a Pagar = Total - Ret - Dispersión - ISR

### 5. Validación Antes de Cerrar Lote/Generar PDF

Función `validar_desglose_fiscal_o_abortar()` que verifica:
1. ✅ Vida + Sin Vida = Total Comisión
2. ✅ Total a Pagar = Total - Ret - Dispersión - ISR
3. ✅ Ret. Contable = Vida × 0.16
4. ✅ Dispersión = Sin Vida × 0.09
5. ✅ ISR Total > 0
6. ✅ Total a Pagar < Total Comisión

Si alguna validación falla, **ABORTA** la operación con mensaje detallado.

## Archivos Modificados

### Base de Datos

1. **fix_asimilados_sin_division_109.sql**
   - Función `calcular_desglose_fiscal_asimilados()` con fórmulas correctas

2. **test_validacion_bloqueante_asimilados.sql**
   - Función `validar_desglose_fiscal_o_abortar()` para validación
   - Función `test_asimilados_con_caso_real()` para testing
   - Eliminación de trigger y función viejos

### Frontend

3. **src/lib/pdfUtils.ts**
   - Función `obtenerDesgloseFiscalDesdeDB()` para consultar BD
   - Actualizada `generateOrdenDePagoPDF()` para usar consulta
   - Actualizada `getPdfFiscalRows()` con campos permitidos

4. **src/pages/MisComisiones.tsx**
   - Estado `desgloseFiscal` para almacenar datos
   - Consulta a `calcular_desglose_fiscal_asimilados()` al cargar
   - Panel visual para mostrar desglose fiscal

## Flujo de Datos

```
┌─────────────────────────────────────────┐
│  Commission Details (múltiples filas)   │
│  - poliza, ramo, commission_neta        │
└────────────────┬────────────────────────┘
                 │
                 │ Consulta consolidada
                 ▼
┌─────────────────────────────────────────┐
│  calcular_desglose_fiscal_asimilados()  │
│  1. Suma Vida / Sin Vida                │
│  2. Aplica fórmulas fiscales            │
│  3. Retorna JSON consolidado            │
└────────────────┬────────────────────────┘
                 │
       ┌─────────┴─────────┐
       │                   │
       ▼                   ▼
┌────────────┐      ┌────────────┐
│  Frontend  │      │    PDF     │
│ (consulta) │      │ (consulta) │
│ NO calcula │      │ NO calcula │
└────────────┘      └────────────┘
```

## Campos en el PDF para ASIMILADOS

El PDF muestra ÚNICAMENTE:

| Campo              | Ejemplo     | Notas                              |
|--------------------|-------------|------------------------------------|
| Comisión Total     | $14,808.07  | Informativo (en resumen por ramo)  |
| Ret. Contable      | - $87.07    | Si > 0                             |
| Costo Dispersión   | - $1,283.75 | Si > 0                             |
| IVA                | $0.00       | Siempre 0 para ASIMILADOS          |
| **ISR Total**      | - $1,343.72 | **Suma de ISR Vida + ISR Daños**   |
| **Total a Pagar**  | **$12,093.53** | **En negrita destacado**        |

**NO se muestran:**
- ❌ ISR Vida (calculado internamente)
- ❌ ISR Daños (calculado internamente)
- ❌ Bases intermedias
- ❌ Comisión Vida/Sin Vida por separado

## Ejemplo de Cálculo

### Entrada
- Vida: $544.20
- Sin Vida: $14,263.87
- Total: $14,808.07

### Proceso (automático en BD)
```
retContable = 544.20 × 0.16 = 87.07
dispersion = 14,263.87 × 0.09 = 1,283.75

isrVida = (544.20 - 87.07) × 0.10 = 45.71
isrDanios = (14,263.87 - 1,283.75) × 0.10 = 1,298.01
isrTotal = 45.71 + 1,298.01 = 1,343.72

totalPagar = 14,808.07 - 87.07 - 1,283.75 - 1,343.72 = 12,093.53
```

### Salida (en PDF y Frontend)
- Ret. Contable: **$87.07**
- Costo Dispersión: **$1,283.75**
- IVA: **$0.00**
- ISR Total: **$1,343.72**
- Total a Pagar: **$12,093.53**

## Uso de las Funciones

### Consultar Desglose Fiscal

```typescript
// Desde TypeScript/JavaScript
const { data, error } = await supabase.rpc('calcular_desglose_fiscal_asimilados', {
  p_batch_id: batchId,
  p_agent_id: agentId
});

// data contiene:
// {
//   regimen_fiscal: "ASIMILADOS",
//   es_asimilados: true,
//   total_comision: 14808.07,
//   vida: 544.20,
//   sin_vida: 14263.87,
//   ret_contable: 87.07,
//   dispersion: 1283.75,
//   iva: 0.00,
//   isr_vida: 45.71,
//   isr_danios: 1298.01,
//   isr_total: 1343.72,
//   total_pagar: 12093.53
// }
```

### Validar Antes de Cerrar Lote

```sql
-- Esto ABORTA si detecta inconsistencias
SELECT validar_desglose_fiscal_o_abortar(
  'batch_id'::uuid,
  'agent_id'::uuid
);
```

### Ejecutar Test Manual

```sql
-- Test con caso específico
SELECT test_asimilados_con_caso_real(
  544.20,      -- vida
  14263.87,    -- sin_vida
  87.07,       -- ret_contable esperado
  1283.75,     -- dispersion esperada
  1343.72,     -- isr_total esperado
  12093.53     -- total esperado
);
```

## Validaciones Implementadas

La función `validar_desglose_fiscal_o_abortar()` verifica:

1. **Suma correcta**: `Vida + Sin Vida = Total Comisión`
2. **Resta correcta**: `Total a Pagar = Total - Ret - Dispersión - ISR`
3. **Ret. Contable correcta**: `Ret = Vida × 0.16`
4. **Dispersión correcta**: `Dispersión = Sin Vida × 0.09`
5. **ISR positivo**: `ISR > 0`
6. **Total lógico**: `Total a Pagar < Total Comisión`

Si alguna falla, **ABORTA** con mensaje detallado.

## Ventajas de la Implementación

1. ✅ **Única fuente de verdad**: La base de datos calcula todo
2. ✅ **Sin recálculos**: Frontend y PDF solo consultan
3. ✅ **Validación automática**: Tests bloquean operaciones incorrectas
4. ✅ **Consistencia garantizada**: Mismos valores en todos lados
5. ✅ **Separación Vida/Sin Vida**: Suma correcta antes de calcular
6. ✅ **Redondeo a 2 decimales**: En cada paso
7. ✅ **Auditable**: Se puede verificar fácilmente

## Notas Importantes

1. **NO usar /1.09**: Las fórmulas NO incluyen división por 1.09
2. **IVA siempre 0**: Para ASIMILADOS, el IVA es 0.00
3. **ISR Total en PDF**: Solo se muestra el total, no el desglose
4. **Validar antes de cerrar**: Llamar `validar_desglose_fiscal_o_abortar()` antes de cerrar lote
5. **Régimen fiscal**: La función verifica automáticamente que sea ASIMILADOS

## Conclusión

✅ **Frontend NUNCA recalcula valores fiscales**
✅ **PDF solo lee valores pre-calculados**
✅ **Fórmulas fiscales correctas SIN /1.09**
✅ **Separación correcta de Vida/Sin Vida**
✅ **Redondeo consistente a 2 decimales**
✅ **IVA siempre 0 para ASIMILADOS**
✅ **Test automático bloqueante**
✅ **Validación antes de cerrar lote/PDF**
✅ **Única fuente de verdad en la base de datos**

**La base de datos es la única fuente de verdad. Frontend y PDF solo consultan y muestran.**
