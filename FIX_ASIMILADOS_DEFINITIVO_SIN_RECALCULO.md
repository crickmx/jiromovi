# FIX DEFINITIVO: Cálculo ASIMILADOS Sin Recálculo en Frontend

## Problema Identificado

El sistema anterior tenía múltiples problemas con el cálculo fiscal para el régimen ASIMILADOS:

1. **Trigger por fila individual**: El trigger `calcular_asimilados_detalle()` procesaba cada comisión individualmente, pero las fórmulas fiscales requieren PRIMERO sumar todas las comisiones por Vida/Sin Vida y LUEGO aplicar los cálculos.

2. **Recálculo en frontend**: El PDF y la vista "Mis Comisiones" estaban recalculando valores en el frontend, lo que causaba inconsistencias.

3. **División /1.09 no aplicada correctamente**: La división necesaria para obtener la base sin IVA no se aplicaba correctamente en todos los casos.

4. **Separación incorrecta de Vida/Sin Vida**: No se sumaban correctamente las comisiones antes de aplicar las fórmulas fiscales.

## Solución Implementada

### 1. Función de Base de Datos Consolidada

Se creó una función `calcular_desglose_fiscal_asimilados(p_batch_id, p_agent_id)` que:

- **Suma TODAS las comisiones Vida** del agente en el lote
- **Suma TODAS las comisiones Sin Vida** del agente en el lote
- **Aplica las fórmulas fiscales correctas** con división /1.09
- **Retorna el desglose fiscal completo** como JSON

#### Fórmulas Fiscales Implementadas

```sql
-- PASO 1: SUMAR COMISIONES
vida = SUM(comisión WHERE ramo = 'vida')
sin_vida = SUM(comisión WHERE ramo != 'vida')

-- PASO 2: APLICAR FÓRMULAS FISCALES
ret_contable = ROUND(vida × 0.16, 2)
dispersion = ROUND(sin_vida × 0.09, 2)

base_isr_vida = ROUND((vida - ret_contable) / 1.09, 2)
isr_vida = ROUND(base_isr_vida × 0.10, 2)

base_isr_danios = ROUND((sin_vida - dispersion) / 1.09, 2)
isr_danios = ROUND(base_isr_danios × 0.10, 2)

isr_total = ROUND(isr_vida + isr_danios, 2)

total_pagar = ROUND(total_comision - ret_contable - dispersion - isr_total, 2)

IVA = 0.00 (siempre para ASIMILADOS)
```

### 2. Frontend: Solo Consulta, No Calcula

#### MisComisiones.tsx

- **Consulta** la función `calcular_desglose_fiscal_asimilados()` al cargar las comisiones
- **Muestra** el desglose fiscal pre-calculado en un panel destacado
- **NO recalcula** ningún valor

```typescript
// Cargar desglose fiscal desde función de base de datos
const { data: fiscal } = await supabase.rpc('calcular_desglose_fiscal_asimilados', {
  p_batch_id: batch.id,
  p_agent_id: agent.id
});
```

#### PDF (pdfUtils.ts)

- **Consulta** la función `obtenerDesgloseFiscalDesdeDB()` que llama a la función de base de datos
- **Muestra** solo los campos permitidos: Ret. Contable, Costo Dispersión, IVA (0), ISR Total
- **NO muestra** ISR Vida ni ISR Daños (se calculan internamente pero no se muestran)
- **NO recalcula** ningún valor

```typescript
// Para ASIMILADOS, consultar función de base de datos
if (regimenFiscal === 'ASIMILADOS') {
  desgloseFiscal = await obtenerDesgloseFiscalDesdeDB(batch.id, agentDetails[0].agent_id);
}
```

### 3. Campos Mostrados en el PDF

Para ASIMILADOS, el PDF muestra ÚNICAMENTE:

1. **Ret. Contable** (si > 0)
2. **Costo Dispersión** (si > 0)
3. **IVA** (siempre 0.00)
4. **ISR Total** (suma de ISR Vida + ISR Daños)
5. **Total a Pagar**

**NO se muestran**:
- ISR Vida (se calcula internamente)
- ISR Daños (se calcula internamente)
- Bases intermedias
- Comisión Vida/Sin Vida por separado

## Archivos Modificados

### 1. Base de Datos

**Migración**: `fix_asimilados_definitivo_sin_recalculo_frontend.sql`

- `calcular_desglose_fiscal_asimilados()`: Función principal de cálculo
- `validar_desglose_fiscal_asimilados()`: Función auxiliar para validación
- Índices optimizados para consultas rápidas

### 2. Frontend

**src/lib/pdfUtils.ts**
- Eliminada función `construirDesgloseFiscalDesdePersistencia()`
- Agregada función `obtenerDesgloseFiscalDesdeDB()` que consulta la base de datos
- Actualizada función `generateOrdenDePagoPDF()` para usar la nueva función
- Actualizada función `getPdfFiscalRows()` para mostrar solo campos permitidos

**src/pages/MisComisiones.tsx**
- Agregado estado `desgloseFiscal` para almacenar desgloses fiscales
- Actualizada función `loadCommissions()` para consultar desglose fiscal
- Agregado panel visual para mostrar desglose fiscal de ASIMILADOS

## Validación de Cálculos

### Caso de Prueba

**Entrada:**
- Comisión Total: $14,808.07
- Vida: $544.20
- Sin Vida: $14,263.87

**Salida Esperada:**
- Ret. Contable: $87.07
- Costo Dispersión: $1,283.75
- ISR Vida: (544.20 - 87.07) / 1.09 × 0.10 = $41.93
- ISR Daños: (14,263.87 - 1,283.75) / 1.09 × 0.10 = $1,189.92
- ISR Total: $1,231.85
- Total a Pagar: $12,205.40

### Función de Validación

Se puede usar la función auxiliar para validar:

```sql
SELECT * FROM validar_desglose_fiscal_asimilados(
  'batch_id_aqui',
  'agent_id_aqui'
);
```

Esta función verifica que:
- Total Comisión = Vida + Sin Vida
- Total a Pagar = Total Comisión - Ret. Contable - Dispersión - ISR Total

## Ventajas de la Nueva Implementación

1. **Única fuente de verdad**: La base de datos es la única que calcula
2. **Consistencia garantizada**: Frontend y PDF usan los mismos valores
3. **Sin recálculos**: Elimina errores de implementación en el frontend
4. **Optimizado**: Cálculo una sola vez, consultado múltiples veces
5. **Fácil de mantener**: Fórmulas centralizadas en un solo lugar
6. **Auditable**: Se puede validar y verificar fácilmente

## Impacto en el Sistema

### Cambios en el Flujo

**ANTES:**
1. Backend guarda comisiones individuales con campos ASIMILADOS
2. Frontend suma y recalcula al mostrar
3. PDF recalcula nuevamente
4. **Problema**: Inconsistencias y errores de redondeo

**DESPUÉS:**
1. Backend guarda comisiones individuales
2. Función de DB calcula desglose consolidado al momento de consulta
3. Frontend consulta y muestra valores pre-calculados
4. PDF consulta y muestra valores pre-calculados
5. **Beneficio**: Consistencia total y sin recálculos

### Compatibilidad

- ✅ Compatible con lotes existentes
- ✅ Compatible con comisiones manuales ajustadas
- ✅ Compatible con otros regímenes fiscales (no afectados)
- ✅ No requiere recálculo de datos históricos

## Instrucciones de Uso

### Para Desarrolladores

1. **Consultar desglose fiscal desde código:**

```typescript
const { data, error } = await supabase.rpc('calcular_desglose_fiscal_asimilados', {
  p_batch_id: batchId,
  p_agent_id: agentId
});

// data contiene:
// - regimen_fiscal
// - es_asimilados
// - total_comision
// - vida
// - sin_vida
// - ret_contable
// - dispersion
// - iva (siempre 0)
// - isr_vida
// - isr_danios
// - isr_total
// - total_pagar
```

2. **Validar cálculos:**

```sql
SELECT * FROM validar_desglose_fiscal_asimilados(
  'batch_id',
  'agent_id'
);
```

### Para Administradores

1. **Verificar desglose de un agente:**

```sql
SELECT calcular_desglose_fiscal_asimilados(
  'batch_id'::uuid,
  'agent_id'::uuid
);
```

2. **Auditar todos los lotes de un periodo:**

```sql
SELECT
  cb.name,
  ca.name as agente,
  calcular_desglose_fiscal_asimilados(cb.id, ca.id) as desglose
FROM commission_batches cb
CROSS JOIN commission_agents ca
WHERE cb.status = 'closed'
  AND EXISTS (
    SELECT 1 FROM usuarios u
    JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
    WHERE u.id = ca.usuario_id
      AND UPPER(cfr.name) LIKE '%ASIMILAD%'
  );
```

## Notas Importantes

1. **División /1.09**: Esta división es CRÍTICA y se aplica después de restar la retención contable (Vida) o el costo de dispersión (Sin Vida).

2. **Redondeo**: Todos los valores se redondean a 2 decimales al final de cada paso.

3. **IVA siempre 0**: Para ASIMILADOS, el IVA siempre es 0.00, pero se muestra en el PDF para claridad.

4. **ISR Total en PDF**: Solo se muestra el ISR Total, no se desglosa en Vida/Daños en el PDF.

5. **Régimen fiscal**: La función verifica automáticamente que el agente tenga régimen ASIMILADOS antes de calcular.

## Conclusión

Esta implementación garantiza que:

- ✅ Frontend NUNCA recalcula valores fiscales
- ✅ PDF solo lee valores pre-calculados
- ✅ Fórmulas fiscales correctas con división /1.09
- ✅ Separación correcta de Vida/Sin Vida
- ✅ Redondeo consistente a 2 decimales
- ✅ IVA siempre 0 para ASIMILADOS
- ✅ Única fuente de verdad en la base de datos

**La base de datos es la única fuente de verdad. Frontend y PDF solo consultan y muestran.**
