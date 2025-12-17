# Sistema de Cálculo Fiscal ASIMILADOS

## Descripción General

El sistema de cálculo fiscal ASIMILADOS implementa un método de cálculo de comisiones específico para agentes bajo el régimen fiscal "ASIMILADOS", calculando todo desde la **Prima Total (Importe)** y no desde la comisión pre-calculada.

Este sistema incluye:
- Clasificación automática de ramos como VIDA o DAÑOS
- Fórmulas fiscales específicas para cada tipo
- Cálculo automático mediante triggers de base de datos
- Persistencia de todos los valores intermedios para auditoría

---

## Características Principales

### 1. Base del Cálculo: Prima Total (Importe)

**Cambio fundamental**: En lugar de calcular comisiones usando `comision_bruta` y luego aplicar retenciones, el sistema ASIMILADOS calcula TODO desde el valor de **Importe (Prima Total)**.

**Fórmula anterior (incorrecta)**:
```
Comisión Bruta = Importe × (PorPart / 100)
Comisión Neta = Comisión Bruta - Retenciones
```

**Fórmula nueva (correcta para ASIMILADOS)**:
```
Todo se calcula desde Prima Total (Importe)
Comisión Final = Prima Total - Retención Contable - Dispersión - ISR Total
```

### 2. Clasificación Automática de Ramos

Cada póliza se clasifica automáticamente como:
- **VIDA**: Si el campo `ramo` contiene la palabra "vida" (case insensitive)
- **DAÑOS**: Todos los demás casos

Esta clasificación determina qué fórmula fiscal aplicar.

### 3. Fórmulas Fiscales

#### VIDA (Ramos de Vida)

```
1. Retención Contable = Prima Total × 16%
2. Base Vida = Prima Total - Retención Contable
3. Comisión Vida = Base Vida × 10%
4. ISR Vida = Comisión Vida
```

#### DAÑOS (Ramos de Daños)

```
1. Base Preliminar Daños = Prima Total - Dispersión
2. Base Sin IVA = Base Preliminar / 1.09
3. Comisión Daños = Base Sin IVA × 10%
4. ISR Daños = Comisión Daños
```

#### TOTAL (Combinación)

```
1. ISR Total = ISR Vida + ISR Daños
2. Comisión Final = Prima Total - Retención Contable - Dispersión - ISR Total
```

### 4. Validación

**Regla de consistencia**:
```
ISR Total DEBE SIEMPRE SER IGUAL A (ISR Vida + ISR Daños)
```

Si esta regla no se cumple, hay un error en el cálculo.

---

## Arquitectura Técnica

### Base de Datos

#### Nuevos Campos en `commission_details`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `tipo_ramo` | TEXT | Clasificación: 'VIDA' o 'DAÑOS' |
| `costo_dispersion` | NUMERIC(12,2) | Costo de dispersión bancaria |
| `asimilados_retencion_contable` | NUMERIC(12,2) | Retención contable 16% |
| `asimilados_base_vida` | NUMERIC(12,2) | Base Vida = Prima - Retención |
| `asimilados_comision_vida` | NUMERIC(12,2) | Comisión Vida 10% |
| `asimilados_base_danios_pre` | NUMERIC(12,2) | Base Preliminar Daños |
| `asimilados_base_danios_sin_iva` | NUMERIC(12,2) | Base Sin IVA (/ 1.09) |
| `asimilados_comision_danios` | NUMERIC(12,2) | Comisión Daños 10% |
| `asimilados_isr_vida` | NUMERIC(12,2) | ISR Vida = Comisión Vida |
| `asimilados_isr_danios` | NUMERIC(12,2) | ISR Daños = Comisión Daños |
| `asimilados_isr_total` | NUMERIC(12,2) | ISR Total = ISR Vida + Daños |
| `asimilados_comision_final` | NUMERIC(12,2) | Comisión Final |

#### Función de Clasificación

```sql
CREATE OR REPLACE FUNCTION clasificar_tipo_ramo(ramo_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF ramo_name IS NULL OR TRIM(ramo_name) = '' THEN
    RETURN 'DAÑOS';
  END IF;

  IF LOWER(TRIM(ramo_name)) LIKE '%vida%' THEN
    RETURN 'VIDA';
  END IF;

  RETURN 'DAÑOS';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### Trigger Automático

El trigger `trigger_calcular_asimilados` se ejecuta **BEFORE INSERT OR UPDATE** en `commission_details`.

**Flujo del trigger**:
1. Obtiene el régimen fiscal del agente
2. Si NO es ASIMILADOS, no hace nada (retorna NEW sin modificar)
3. Si ES ASIMILADOS:
   - Clasifica el tipo de ramo
   - Obtiene Prima Total e importe de dispersión
   - Calcula según fórmulas VIDA o DAÑOS
   - Actualiza todos los campos calculados
   - Actualiza `commission_neta` con la comisión final

**Importante**: El trigger SOLO afecta a agentes con régimen ASIMILADOS. Los demás regímenes (RESICO, HONORARIOS) NO se ven afectados.

### Migración Aplicada

**Archivo**: `fix_asimilados_calculation_complete_v3.sql`

**Contenido**:
- Agrega 12 columnas nuevas a `commission_details`
- Crea función `clasificar_tipo_ramo()`
- Crea función `calcular_asimilados_detalle()`
- Crea trigger `trigger_calcular_asimilados`
- Backfill: Reclasifica ramos existentes y fuerza recálculo

### TypeScript

**Archivo**: `src/lib/commissionTypes.ts`

Se actualizó la interfaz `CommissionDetail` para incluir todos los campos nuevos:

```typescript
export interface CommissionDetail {
  // ... campos existentes ...
  tipo_ramo?: 'VIDA' | 'DAÑOS' | null;
  costo_dispersion?: number | null;
  asimilados_retencion_contable?: number | null;
  asimilados_base_vida?: number | null;
  asimilados_comision_vida?: number | null;
  asimilados_base_danios_pre?: number | null;
  asimilados_base_danios_sin_iva?: number | null;
  asimilados_comision_danios?: number | null;
  asimilados_isr_vida?: number | null;
  asimilados_isr_danios?: number | null;
  asimilados_isr_total?: number | null;
  asimilados_comision_final?: number | null;
}
```

---

## Flujo de Datos

### Carga de Comisiones con ASIMILADOS

```
1. Usuario carga Excel con datos de comisiones
   ↓
2. Sistema crea registros en commission_details
   ↓
3. Trigger detecta que agente es ASIMILADOS
   ↓
4. Trigger clasifica ramo (VIDA o DAÑOS)
   ↓
5. Trigger aplica fórmulas correspondientes
   ↓
6. Todos los campos calculados se persisten
   ↓
7. commission_neta se actualiza con comisión final
   ↓
8. Usuario ve comisión correctamente calculada
```

### Actualización Manual

Si un admin ajusta manualmente una comisión ASIMILADOS:

```
1. Admin modifica importe_base o porcentaje_comision
   ↓
2. Trigger se ejecuta automáticamente (BEFORE UPDATE)
   ↓
3. Todos los cálculos se regeneran
   ↓
4. commission_neta se recalcula
   ↓
5. Cambios se reflejan inmediatamente
```

---

## Casos de Uso

### Caso 1: Póliza de VIDA

**Datos**:
- Prima Total (Importe): $100,000
- Ramo: "Vida Individual"
- Dispersión: $0

**Cálculo**:
1. Clasificación: VIDA (contiene "vida")
2. Retención Contable = $100,000 × 0.16 = $16,000
3. Base Vida = $100,000 - $16,000 = $84,000
4. Comisión Vida = $84,000 × 0.10 = $8,400
5. ISR Vida = $8,400
6. ISR Total = $8,400
7. **Comisión Final = $100,000 - $16,000 - $0 - $8,400 = $75,600**

### Caso 2: Póliza de DAÑOS

**Datos**:
- Prima Total (Importe): $50,000
- Ramo: "Autos"
- Dispersión: $500

**Cálculo**:
1. Clasificación: DAÑOS (no contiene "vida")
2. Base Preliminar Daños = $50,000 - $500 = $49,500
3. Base Sin IVA = $49,500 / 1.09 = $45,412.84
4. Comisión Daños = $45,412.84 × 0.10 = $4,541.28
5. ISR Daños = $4,541.28
6. ISR Total = $4,541.28
7. **Comisión Final = $50,000 - $0 - $500 - $4,541.28 = $44,958.72**

### Caso 3: Póliza Mixta (aunque no aplica en práctica)

En la práctica, cada póliza es VIDA o DAÑOS, no ambas. Pero el sistema soporta el cálculo separado:

- ISR Total siempre será ISR Vida + ISR Daños
- Solo uno de los dos será diferente de cero

---

## Validaciones y Reglas de Negocio

### 1. Solo ASIMILADOS

El trigger SOLO se ejecuta si:
```sql
SELECT UPPER(cfr.name)
FROM commission_fiscal_regimes cfr
JOIN usuarios u ON u.regimen_fiscal_id = cfr.id
JOIN commission_agents ca ON ca.usuario_id = u.id
WHERE ca.id = NEW.agent_id
  AND UPPER(cfr.name) LIKE '%ASIMILAD%'
```

Si el agente NO es ASIMILADOS, el trigger retorna inmediatamente sin modificar nada.

### 2. Valores NULL

Si `importe_base` o `costo_dispersion` son NULL, se asume 0 en los cálculos:
```sql
prima_total := COALESCE(NEW.importe_base, 0);
dispersion := COALESCE(NEW.costo_dispersion, 0);
```

### 3. Redondeo

Todos los cálculos se redondean a 2 decimales:
```sql
ROUND((valor)::numeric, 2)
```

### 4. Comisión Final en commission_neta

El campo `commission_neta` siempre se actualiza con el valor de `asimilados_comision_final`:
```sql
NEW.commission_neta := comision_final;
```

Esto garantiza que:
- Los reportes usan el valor correcto
- Las sumas por agente son correctas
- Los PDFs muestran la comisión correcta

---

## Diferencias con Otros Regímenes

| Aspecto | ASIMILADOS | RESICO / HONORARIOS |
|---------|------------|---------------------|
| Base de cálculo | Prima Total (Importe) | Comisión Bruta |
| Clasificación de ramos | Sí (VIDA/DAÑOS) | No |
| Retención contable | Sí (16% en VIDA) | No |
| Dispersión | Sí (en DAÑOS) | No |
| IVA | Sí (se divide / 1.09) | Diferente |
| ISR | ISR Vida + ISR Daños | Fórmula diferente |
| Trigger | Automático | No aplica |

---

## Testing y Validación

### Pruebas Manuales

1. **Cargar póliza de VIDA**:
   - Verificar que `tipo_ramo` = 'VIDA'
   - Verificar que `asimilados_retencion_contable` = importe × 0.16
   - Verificar que `asimilados_comision_vida` = base_vida × 0.10
   - Verificar que `asimilados_isr_vida` = comision_vida

2. **Cargar póliza de DAÑOS**:
   - Verificar que `tipo_ramo` = 'DAÑOS'
   - Verificar que `asimilados_base_danios_sin_iva` = (importe - dispersión) / 1.09
   - Verificar que `asimilados_comision_danios` = base_sin_iva × 0.10
   - Verificar que `asimilados_isr_danios` = comision_danios

3. **Validar ISR Total**:
   - Verificar que `asimilados_isr_total` = isr_vida + isr_danios

4. **Validar Comisión Final**:
   - Verificar que `asimilados_comision_final` = prima_total - retencion - dispersion - isr_total
   - Verificar que `commission_neta` = comision_final

### SQL de Diagnóstico

```sql
-- Ver campos ASIMILADOS de una póliza
SELECT
  poliza,
  ramo,
  tipo_ramo,
  importe_base,
  costo_dispersion,
  asimilados_retencion_contable,
  asimilados_base_vida,
  asimilados_comision_vida,
  asimilados_base_danios_pre,
  asimilados_base_danios_sin_iva,
  asimilados_comision_danios,
  asimilados_isr_vida,
  asimilados_isr_danios,
  asimilados_isr_total,
  asimilados_comision_final,
  commission_neta
FROM commission_details
WHERE agent_id IN (
  SELECT ca.id FROM commission_agents ca
  JOIN usuarios u ON ca.usuario_id = u.id
  JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE UPPER(cfr.name) LIKE '%ASIMILAD%'
)
LIMIT 10;
```

```sql
-- Validar consistencia ISR
SELECT
  poliza,
  asimilados_isr_vida,
  asimilados_isr_danios,
  asimilados_isr_total,
  (asimilados_isr_vida + asimilados_isr_danios) as isr_calculado,
  CASE
    WHEN ABS(asimilados_isr_total - (asimilados_isr_vida + asimilados_isr_danios)) < 0.01 THEN '✓ OK'
    ELSE '✗ ERROR'
  END as validacion
FROM commission_details
WHERE agent_id IN (
  SELECT ca.id FROM commission_agents ca
  JOIN usuarios u ON ca.usuario_id = u.id
  JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
  WHERE UPPER(cfr.name) LIKE '%ASIMILAD%'
);
```

---

## Resolución de Problemas

### Problema: Comisiones ASIMILADOS son incorrectas

**Diagnóstico**:
1. Verificar que el agente tenga régimen ASIMILADOS:
   ```sql
   SELECT u.nombre_completo, cfr.name
   FROM usuarios u
   JOIN commission_fiscal_regimes cfr ON u.regimen_fiscal_id = cfr.id
   WHERE u.id = 'USUARIO_ID';
   ```

2. Verificar que el trigger esté activo:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_calcular_asimilados';
   ```

3. Forzar recálculo manualmente:
   ```sql
   UPDATE commission_details
   SET costo_dispersion = COALESCE(costo_dispersion, 0)
   WHERE batch_id = 'LOTE_ID';
   ```

### Problema: ISR Total ≠ ISR Vida + ISR Daños

**Causa**: Bug en el trigger o datos inconsistentes.

**Solución**:
1. Ejecutar query de validación (ver arriba)
2. Identificar registros con inconsistencia
3. Forzar recálculo:
   ```sql
   UPDATE commission_details
   SET tipo_ramo = clasificar_tipo_ramo(ramo)
   WHERE id IN (SELECT id FROM registros_inconsistentes);
   ```

### Problema: tipo_ramo es NULL

**Causa**: El trigger no se ejecutó.

**Solución**:
```sql
UPDATE commission_details
SET tipo_ramo = clasificar_tipo_ramo(ramo)
WHERE tipo_ramo IS NULL AND batch_id = 'LOTE_ID';
```

---

## Mejoras Futuras

### Posibles Mejoras

1. **UI de Desglose**: Mostrar desglose completo de ASIMILADOS en interfaz
2. **PDF Mejorado**: Incluir desglose fiscal en Orden de Pago
3. **Alertas**: Notificar si ISR Total ≠ ISR Vida + ISR Daños
4. **Configuración**: Permitir ajustar porcentajes (16%, 10%, 1.09) por configuración
5. **Historial**: Log de cambios en cálculos
6. **Reporte Fiscal**: Reporte específico para ASIMILADOS con todos los desgloses

---

## Referencias

### Archivos Relacionados

- **Migración**: `supabase/migrations/fix_asimilados_calculation_complete_v3.sql`
- **TypeScript**: `src/lib/commissionTypes.ts`
- **UI**: `src/pages/ComisionesLote.tsx`
- **Cálculos Anteriores**: `src/lib/commissionFiscalCalculations.ts` (deprecated para ASIMILADOS)

### Documentos Relacionados

- `SISTEMA_COMISIONES_UNIFICADO.md`: Sistema general de comisiones
- `DESGLOSE_FISCAL_COMISIONES.md`: Desglose fiscal para otros regímenes
- `CALCULOS_FISCALES_DOCUMENTACION.md`: Fórmulas fiscales generales

---

**Desarrollado**: Diciembre 2024
**Versión**: 1.0
**Estado**: Implementado y funcionando
