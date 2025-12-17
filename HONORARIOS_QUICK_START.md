# Quick Start: Cálculo Fiscal HONORARIOS

Guía rápida para usar el nuevo cálculo fiscal de HONORARIOS.

---

## 1. Verificar Régimen del Agente

```sql
-- Ver régimen fiscal de un agente
SELECT
  ca.name as agente,
  cfr.name as regimen_fiscal
FROM commission_agents ca
JOIN commission_fiscal_regimes cfr ON ca.fiscal_regime_id = cfr.id
WHERE ca.name = 'NOMBRE_AGENTE';
```

**Debe mostrar**: `HONORARIOS`

---

## 2. Calcular Desglose Fiscal de un Lote

### Opción A: Desde SQL (Backend)

```sql
-- Calcular desglose fiscal automáticamente
SELECT calculate_batch_fiscal_desglose('uuid-del-lote');
```

**Resultado**:
```json
{
  "regimen_fiscal": "HONORARIOS",
  "prima_total": 12000.00,
  "prima_vida": 5000.00,
  "prima_sin_vida": 7000.00,
  "retencion_contable": 800.00,
  "costo_dispersion": 630.00,
  "isr_vida": 431.03,
  "isr_danios": 642.20,
  "isr_total": 1073.23,
  "total_final": 9496.77
}
```

### Opción B: Desde TypeScript (Frontend)

```typescript
import { calcularDesgloseFiscal, agruparComisionesPorRamo } from '@/lib/commissionFiscalCalculations';

// 1. Obtener detalles del lote
const { data: detalles } = await supabase
  .from('commission_details')
  .select('ramo, importe_base, commission_neta')
  .eq('batch_id', batchId);

// 2. Para HONORARIOS: Agrupar por Prima Total (importe_base)
const resumenPorRamo = agruparComisionesPorRamo(detalles, true); // true = usar importe_base

// 3. Calcular Prima Total
const primaTotal = detalles.reduce((sum, d) => sum + (d.importe_base || 0), 0);

// 4. Calcular desglose fiscal
const desglose = calcularDesgloseFiscal({
  regimenFiscal: 'HONORARIOS',
  resumenPorRamo,
  totalComisionNeta: primaTotal, // Para HONORARIOS = Prima Total
  usePrimaTotal: true
});

// 5. Usar resultados
console.log('Total a Pagar:', desglose.totalAPagar);
console.log('ISR Total:', desglose.isrTotal);
console.log('Retención:', desglose.retContable);
```

---

## 3. Guardar Desglose en Base de Datos

```sql
-- Calcular y guardar en commission_batches
UPDATE commission_batches
SET fiscal_desglose_json = calculate_batch_fiscal_desglose(id)
WHERE id = 'uuid-del-lote';

-- Verificar que se guardó
SELECT
  batch_name,
  fiscal_desglose_json->>'total_final' as total_a_pagar
FROM commission_batches
WHERE id = 'uuid-del-lote';
```

---

## 4. Mostrar en UI (Resumen de Lote)

```tsx
import { useState, useEffect } from 'react';

function ResumenLoteHonorarios({ batchId }: { batchId: string }) {
  const [desglose, setDesglose] = useState<any>(null);

  useEffect(() => {
    // Cargar desglose desde commission_batches
    const loadDesglose = async () => {
      const { data } = await supabase
        .from('commission_batches')
        .select('fiscal_desglose_json')
        .eq('id', batchId)
        .single();

      setDesglose(data?.fiscal_desglose_json);
    };

    loadDesglose();
  }, [batchId]);

  if (!desglose) return <div>Cargando...</div>;

  return (
    <div className="bg-white rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-bold">Desglose Fiscal - HONORARIOS</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Prima Total</p>
          <p className="text-xl font-bold">${desglose.prima_total.toLocaleString()}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Prima Vida</p>
          <p className="text-lg">${desglose.prima_vida.toLocaleString()}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Prima Sin Vida</p>
          <p className="text-lg">${desglose.prima_sin_vida.toLocaleString()}</p>
        </div>
      </div>

      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Retención Contable (Vida 16%)</span>
          <span className="text-red-600">-${desglose.retencion_contable.toLocaleString()}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Costo Dispersión (Sin Vida 9%)</span>
          <span className="text-red-600">-${desglose.costo_dispersion.toLocaleString()}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">ISR Vida</span>
          <span className="text-red-600">-${desglose.isr_vida.toLocaleString()}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">ISR Daños</span>
          <span className="text-red-600">-${desglose.isr_danios.toLocaleString()}</span>
        </div>

        <div className="flex justify-between font-bold text-lg border-t pt-2">
          <span>ISR Total</span>
          <span className="text-red-600">-${desglose.isr_total.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded p-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-green-900">Total a Pagar</span>
          <span className="text-2xl font-bold text-green-600">
            ${desglose.total_final.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <p>Calculado: {new Date(desglose.calculated_at).toLocaleString('es-MX')}</p>
        <p>Base: {desglose.base_calculo}</p>
      </div>
    </div>
  );
}
```

---

## 5. Validar Cálculo Manual

### Ejemplo: Lote con Prima Total = $12,000

**Datos**:
- Prima Vida: $5,000
- Prima Sin Vida: $7,000

**Cálculo Manual**:
```
1. Retención Contable = 5,000 × 0.16 = 800.00
2. Costo Dispersión = 7,000 × 0.09 = 630.00
3. ISR Vida = (5,000 / 1.16) × 0.10 = 431.03
4. ISR Daños = (7,000 / 1.09) × 0.10 = 642.20
5. ISR Total = 431.03 + 642.20 = 1,073.23
6. Total Final = 12,000 - 800 - 630 - 1,073.23 = 9,496.77
```

**Verificar en SQL**:
```sql
SELECT
  fiscal_desglose_json->>'prima_total' as prima_total,
  fiscal_desglose_json->>'retencion_contable' as retencion,
  fiscal_desglose_json->>'costo_dispersion' as dispersion,
  fiscal_desglose_json->>'isr_vida' as isr_vida,
  fiscal_desglose_json->>'isr_danios' as isr_danios,
  fiscal_desglose_json->>'isr_total' as isr_total,
  fiscal_desglose_json->>'total_final' as total_final
FROM commission_batches
WHERE id = 'uuid-del-lote';
```

**Debe coincidir exactamente** con el cálculo manual.

---

## 6. Recalcular Lotes Existentes

Si ya tienes lotes creados antes de esta corrección:

```sql
-- Recalcular todos los lotes de HONORARIOS
UPDATE commission_batches cb
SET fiscal_desglose_json = calculate_batch_fiscal_desglose(cb.id)
FROM commission_details cd
JOIN commission_agents ca ON cd.agent_id = ca.id
JOIN commission_fiscal_regimes cfr ON ca.fiscal_regime_id = cfr.id
WHERE cd.batch_id = cb.id
  AND UPPER(cfr.name) = 'HONORARIOS'
  AND cb.fiscal_desglose_json IS NULL;
```

---

## 7. Reportes y Consultas

### Resumen por Agente (mes actual)

```sql
SELECT
  ca.name as agente,
  COUNT(cb.id) as total_lotes,
  SUM((cb.fiscal_desglose_json->>'prima_total')::numeric) as prima_total,
  SUM((cb.fiscal_desglose_json->>'isr_total')::numeric) as isr_total,
  SUM((cb.fiscal_desglose_json->>'total_final')::numeric) as total_pagado
FROM commission_batches cb
JOIN commission_details cd ON cd.batch_id = cb.id
JOIN commission_agents ca ON cd.agent_id = ca.id
JOIN commission_fiscal_regimes cfr ON ca.fiscal_regime_id = cfr.id
WHERE UPPER(cfr.name) = 'HONORARIOS'
  AND cb.created_at >= date_trunc('month', NOW())
GROUP BY ca.name
ORDER BY total_pagado DESC;
```

### Top 10 Lotes por Monto

```sql
SELECT
  cb.batch_name,
  ca.name as agente,
  (cb.fiscal_desglose_json->>'prima_total')::numeric as prima_total,
  (cb.fiscal_desglose_json->>'total_final')::numeric as total_pagado,
  cb.created_at
FROM commission_batches cb
JOIN commission_details cd ON cd.batch_id = cb.id
JOIN commission_agents ca ON cd.agent_id = ca.id
JOIN commission_fiscal_regimes cfr ON ca.fiscal_regime_id = cfr.id
WHERE UPPER(cfr.name) = 'HONORARIOS'
  AND cb.fiscal_desglose_json IS NOT NULL
ORDER BY (cb.fiscal_desglose_json->>'total_final')::numeric DESC
LIMIT 10;
```

---

## 8. Tests Rápidos

### Test en Consola del Navegador

```javascript
// Abrir DevTools (F12) → Console
import { runAllHonorariosTests } from './lib/commissionFiscalCalculations.test';
runAllHonorariosTests();
```

**Debe mostrar**:
```
==================================================
TESTS DE CÁLCULO FISCAL PARA HONORARIOS
==================================================

Test 1: HONORARIOS Solo Vida
✓ Retención Contable: true
✓ ISR Vida: true
✓ Total Final: true

Test 2: HONORARIOS Solo Sin Vida
✓ Costo Dispersión: true
✓ ISR Daños: true
✓ Total Final: true

...
```

### Test en Base de Datos

```sql
-- Test con datos ficticios
DO $$
DECLARE
  v_batch_id uuid;
  v_agent_id uuid;
  v_result jsonb;
BEGIN
  -- Crear agente de prueba HONORARIOS
  INSERT INTO commission_agents (name, fiscal_regime_id)
  VALUES ('Test HONORARIOS', (SELECT id FROM commission_fiscal_regimes WHERE name = 'HONORARIOS'))
  RETURNING id INTO v_agent_id;

  -- Crear lote de prueba
  INSERT INTO commission_batches (batch_name, status)
  VALUES ('Test Lote HONORARIOS', 'draft')
  RETURNING id INTO v_batch_id;

  -- Insertar detalles
  INSERT INTO commission_details (batch_id, agent_id, ramo, importe_base, porcentaje_comision)
  VALUES
    (v_batch_id, v_agent_id, 'Vida', 5000, 100),
    (v_batch_id, v_agent_id, 'Daños', 7000, 100);

  -- Calcular
  v_result := calculate_batch_fiscal_desglose(v_batch_id);

  -- Verificar
  IF (v_result->>'total_final')::numeric = 9496.77 THEN
    RAISE NOTICE '✓ Test PASSED: Total Final = %', v_result->>'total_final';
  ELSE
    RAISE EXCEPTION '✗ Test FAILED: Expected 9496.77, got %', v_result->>'total_final';
  END IF;

  -- Limpiar
  DELETE FROM commission_details WHERE batch_id = v_batch_id;
  DELETE FROM commission_batches WHERE id = v_batch_id;
  DELETE FROM commission_agents WHERE id = v_agent_id;
END $$;
```

---

## 9. Troubleshooting

### Problema: Total Final es negativo

**Causa**: Prima Total muy baja o datos incorrectos

**Solución**:
```sql
-- Verificar datos del lote
SELECT
  ramo,
  COUNT(*) as polizas,
  SUM(importe_base) as total_importe,
  SUM(commission_neta) as total_comision
FROM commission_details
WHERE batch_id = 'uuid-del-lote'
GROUP BY ramo;
```

### Problema: ISR Vida es 0 cuando debería tener valor

**Causa**: Ramo no reconocido como 'Vida'

**Solución**:
```sql
-- Ver valores exactos de ramo
SELECT DISTINCT ramo, LOWER(ramo)
FROM commission_details
WHERE batch_id = 'uuid-del-lote';

-- Normalizar si es necesario
UPDATE commission_details
SET ramo = 'Vida'
WHERE batch_id = 'uuid-del-lote'
  AND LOWER(ramo) IN ('vida', 'VIDA', ' vida ');
```

### Problema: Desglose fiscal NULL

**Causa**: No se ha calculado aún

**Solución**:
```sql
-- Forzar cálculo
UPDATE commission_batches
SET fiscal_desglose_json = calculate_batch_fiscal_desglose(id)
WHERE id = 'uuid-del-lote';
```

---

## 10. Checklist de Verificación

Antes de aprobar un lote de HONORARIOS, verificar:

- [ ] Régimen del agente es HONORARIOS
- [ ] `fiscal_desglose_json` está calculado y no es NULL
- [ ] Prima Vida + Prima Sin Vida = Prima Total
- [ ] ISR Vida > 0 si hay Prima Vida > 0
- [ ] ISR Daños > 0 si hay Prima Sin Vida > 0
- [ ] Total Final > 0 (no negativo)
- [ ] Retención Contable = Prima Vida × 0.16
- [ ] Costo Dispersión = Prima Sin Vida × 0.09
- [ ] Fórmulas en JSON coinciden con documentación

**Query de verificación**:
```sql
SELECT
  cb.batch_name,
  cb.fiscal_desglose_json->>'regimen_fiscal' as regimen,
  (cb.fiscal_desglose_json->>'prima_total')::numeric as prima_total,
  (cb.fiscal_desglose_json->>'prima_vida')::numeric +
    (cb.fiscal_desglose_json->>'prima_sin_vida')::numeric as suma_primas,
  (cb.fiscal_desglose_json->>'total_final')::numeric as total_final,
  CASE
    WHEN (cb.fiscal_desglose_json->>'total_final')::numeric <= 0 THEN '❌ Total negativo'
    WHEN (cb.fiscal_desglose_json->>'prima_total')::numeric !=
         ((cb.fiscal_desglose_json->>'prima_vida')::numeric +
          (cb.fiscal_desglose_json->>'prima_sin_vida')::numeric) THEN '❌ Suma no coincide'
    ELSE '✅ OK'
  END as validacion
FROM commission_batches cb
WHERE id = 'uuid-del-lote';
```

---

**Listo para usar en producción** ✅
