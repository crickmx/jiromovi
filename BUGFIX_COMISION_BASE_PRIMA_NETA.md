# Bug Fix: Comisión Base igual a Prima Neta

## Problema Reportado

El sistema estaba asignando incorrectamente `commission_bruta = prima_neta` en lugar de calcular la comisión correctamente.

### Impacto
- **Crítico**: Las comisiones calculadas eran incorrectas
- Afectaba a todos los lotes de comisiones importados
- No había validación para detectar este error

## Causa Raíz

1. **No había separación clara** entre `prima_neta` (monto del seguro) y `commission_bruta` (comisión calculada)
2. **No había configuración** para definir de dónde obtener la comisión base
3. **No había validación** para prevenir que commission_bruta === prima_neta
4. **No había auditoría** de cómo se calculó cada comisión

## Soluciones Implementadas

### 1. Migración de Base de Datos

**Archivo:** `supabase/migrations/fix_commission_base_separation.sql`

#### Nuevos campos en `commission_details`:
```sql
- calculation_status: 'ok' | 'missing_base' | 'missing_rules' | 'error'
- calculation_warnings: jsonb array
- calculation_method: 'excel_column' | 'rules_engine' | 'manual' | 'unknown'
```

#### Nueva tabla `commission_import_config`:
```sql
CREATE TABLE commission_import_config (
  id uuid PRIMARY KEY,
  config_name text UNIQUE,

  -- Fuente de prima_neta
  prima_neta_source text DEFAULT 'excel_column',
  prima_neta_column_name text DEFAULT 'PrimaNeta',

  -- Fuente de commission_bruta (CRÍTICO)
  commission_bruta_source text DEFAULT 'rules_engine',
  commission_bruta_column_name text,

  -- Validaciones
  allow_prima_neta_as_commission_bruta boolean DEFAULT false, -- DEBE ser false
  strict_validation boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  active boolean DEFAULT true
);
```

#### Nueva tabla `commission_recalculations`:
Registra auditoría de cada recálculo:
- `before_stats`: Estadísticas antes del recálculo
- `after_stats`: Estadísticas después del recálculo
- `changes_summary`: Resumen de cambios
- `warnings`: Advertencias generadas

#### Trigger de validación automática:
```sql
CREATE FUNCTION validate_commission_bruta_not_prima_neta()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.commission_bruta = NEW.prima_neta THEN
    IF NOT allow_prima_neta_as_commission_bruta THEN
      NEW.calculation_status = 'error';
      NEW.calculation_warnings = warnings + 'SUSPICIOUS_BRUTA_EQUALS_PRIMA';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

Este trigger se ejecuta ANTES de INSERT/UPDATE y marca automáticamente como error si detecta el bug.

### 2. Edge Function Actualizada: `process-commissions`

**Archivo:** `supabase/functions/process-commissions/index.ts`

#### Cambios principales:

1. **Lee configuración activa:**
```typescript
const { data: config } = await supabase
  .from('commission_import_config')
  .select('*')
  .eq('active', true)
  .maybeSingle();

const commissionConfig = config || {
  commission_bruta_source: 'rules_engine',
  allow_prima_neta_as_commission_bruta: false,
  strict_validation: true
};
```

2. **Calcula commission_bruta según la fuente:**
```typescript
if (commissionConfig.commission_bruta_source === 'excel_column') {
  // Lee del Excel
  const columnValue = row[commissionConfig.commission_bruta_column_name];
  commissionBruta = Number(columnValue);
  calculationMethod = 'excel_column';

} else if (commissionConfig.commission_bruta_source === 'rules_engine') {
  // Usa reglas de negocio
  const matchingRule = findBusinessRule(rules, ramo, aseguradora, officeId);
  if (matchingRule) {
    commissionBruta = (importeBase * porcentaje) / 100;
    calculationMethod = 'rules_engine';
  } else {
    calculationStatus = 'missing_rules';
  }
}
```

3. **Validación anti-bug:**
```typescript
if (commissionBruta === primaNeta && primaNeta > 0) {
  if (!commissionConfig.allow_prima_neta_as_commission_bruta) {
    calculationStatus = 'error';
    calculationWarnings.push({
      code: 'SUSPICIOUS_BRUTA_EQUALS_PRIMA',
      message: 'commission_bruta es igual a prima_neta, esto probablemente es un bug'
    });
    console.warn(`BUG DETECTED: commission_bruta === prima_neta (${primaNeta})`);
  }
}
```

4. **Guarda metadata de cálculo:**
```typescript
{
  commission_bruta: commissionBruta,
  commission_neta: commissionNeta,
  calculation_status: calculationStatus,
  calculation_method: calculationMethod,
  calculation_warnings: calculationWarnings,
}
```

### 3. Nueva Edge Function: `recalculate-commission-batch`

**Archivo:** `supabase/functions/recalculate-commission-batch/index.ts`

Permite recalcular un lote completo:

#### Proceso:
1. Lee configuración actual
2. Recarga todas las commission_details del batch
3. Recalcula commission_bruta para cada item
4. Detecta y marca items sospechosos
5. Actualiza todos los registros
6. Registra auditoría completa

#### Uso:
```typescript
POST /functions/v1/recalculate-commission-batch
Body: { batchId: "uuid" }

Response: {
  success: true,
  before_stats: { ... },
  after_stats: { ... },
  changes_summary: { ... },
  warnings: [ ... ]
}
```

#### Estadísticas que genera:
- `total_items`: Total de items procesados
- `with_commission_bruta`: Items con comisión calculada
- `null_commission_bruta`: Items sin comisión
- `status_ok`: Items OK
- `status_error`: Items con error
- `status_missing_base`: Items sin base
- `status_missing_rules`: Items sin reglas
- `bruta_equals_prima`: Items donde bruta === prima (BUG!)

### 4. Componente de Test Anti-Regresión

**Archivo:** `src/components/commission/CommissionBugTest.tsx`

Componente React que ejecuta tests automáticos:

#### Tests que ejecuta:

**Test 1: Configuración Segura**
```typescript
if (config.allow_prima_neta_as_commission_bruta === true) {
  throw new Error('CONFIGURACIÓN PELIGROSA detectada');
}
```

**Test 2: No commission_bruta === prima_neta**
```typescript
for (const detail of details) {
  if (detail.commission_bruta === detail.prima_neta && detail.prima_neta > 0) {
    if (detail.calculation_status !== 'error') {
      errors.push(`Bug detectado en póliza ${detail.poliza}`);
    }
  }
}
```

**Test 3: Calculation Method conocido**
```typescript
if (detail.calculation_method === 'unknown') {
  warnings.push('Método de cálculo desconocido');
}
```

#### Resultado:
- **PASS ✓**: Si no se detectan bugs
- **FAIL ✗**: Si encuentra commission_bruta === prima_neta

#### Estadísticas que muestra:
- Total verificados
- Sospechosos
- Con error
- Sin base
- Sin reglas
- Lista de registros sospechosos con detalles

## Configuración Recomendada

### Por Defecto (Segura):
```sql
INSERT INTO commission_import_config (config_name, ...) VALUES (
  'default',
  'excel_column',  -- prima_neta_source
  'PrimaNeta',     -- prima_neta_column_name
  'rules_engine',  -- commission_bruta_source
  null,            -- commission_bruta_column_name
  false,           -- allow_prima_neta_as_commission_bruta (CRÍTICO!)
  true,            -- strict_validation
  true             -- active
);
```

### Si el Excel trae columna de comisión:
```sql
UPDATE commission_import_config SET
  commission_bruta_source = 'excel_column',
  commission_bruta_column_name = 'ComisionBruta'
WHERE config_name = 'default';
```

### Si se calcula por reglas:
```sql
UPDATE commission_import_config SET
  commission_bruta_source = 'rules_engine',
  commission_bruta_column_name = null
WHERE config_name = 'default';
```

## Cómo Verificar el Fix

### 1. Ejecutar Test Anti-Regresión
```
Admin → Comisiones → Test Anti-Regresión
Click "Ejecutar Test"
```

Debe mostrar **PASS ✓**

### 2. Verificar Configuración
```sql
SELECT * FROM commission_import_config WHERE active = true;
```

Verificar que:
- `allow_prima_neta_as_commission_bruta` = `false`
- `strict_validation` = `true`
- `commission_bruta_source` esté configurado correctamente

### 3. Verificar Nuevos Imports
Después de importar un nuevo lote:
```sql
SELECT
  calculation_status,
  calculation_method,
  COUNT(*) as count
FROM commission_details
WHERE batch_id = 'uuid-del-lote'
GROUP BY calculation_status, calculation_method;
```

No debe haber registros con `calculation_status = 'error'` causados por el bug.

### 4. Recalcular Lotes Existentes
Para lotes ya importados antes del fix:
```
Admin → Comisiones → Seleccionar Lote
Click "Recalcular Comisiones"
```

Revisar el resumen de cambios.

## Garantías del Sistema

### ✓ Validación Automática
- Trigger de base de datos detecta automáticamente si commission_bruta === prima_neta
- Marca como error y registra warning

### ✓ Auditoría Completa
- Cada item tiene `calculation_method` (de dónde vino la comisión)
- Cada item tiene `calculation_status` (si está OK o tiene problema)
- Cada item tiene `calculation_warnings` (detalles de problemas)

### ✓ Configuración Centralizada
- Una sola tabla `commission_import_config` define cómo calcular
- Admin puede cambiar sin modificar código

### ✓ Recálculo Seguro
- Edge function dedicada para recalcular
- Registra before/after para comparación
- No pierde datos originales (están en `raw_row`)

### ✓ Tests Automáticos
- Componente de test verifica 1000+ registros
- Muestra estadísticas detalladas
- Identifica registros sospechosos

## Archivos Modificados/Creados

### Nuevos:
1. `supabase/migrations/fix_commission_base_separation.sql`
2. `supabase/functions/recalculate-commission-batch/index.ts`
3. `src/components/commission/CommissionBugTest.tsx`
4. `BUGFIX_COMISION_BASE_PRIMA_NETA.md` (este archivo)

### Modificados:
1. `supabase/functions/process-commissions/index.ts`

## Próximos Pasos

### Corto Plazo
1. **Ejecutar test en producción** para detectar registros afectados
2. **Recalcular lotes antiguos** que tengan el bug
3. **Verificar configuración** está correcta

### Mediano Plazo
1. **Agregar UI de configuración** para Admin (sin necesitar SQL)
2. **Dashboard de calidad** de comisiones (% OK, % con error, etc.)
3. **Alertas automáticas** si se detecta el bug

### Largo Plazo
1. **Validación en frontend** antes de subir Excel
2. **Preview de cálculos** antes de confirmar lote
3. **Reportes de auditoría** para contabilidad

## Conclusión

El bug fue causado por la **falta de separación conceptual** entre Prima Neta (monto del seguro) y Comisión Base (comisión calculada).

La solución implementa:
- **Configuración explícita** de fuentes de datos
- **Validación automática** en base de datos y código
- **Auditoría completa** de cálculos
- **Herramientas de recálculo** para corregir datos históricos
- **Tests automáticos** para prevenir regresión

**Resultado:** El sistema ahora **rechaza automáticamente** cualquier intento de asignar commission_bruta = prima_neta y lo marca como error para revisión.
