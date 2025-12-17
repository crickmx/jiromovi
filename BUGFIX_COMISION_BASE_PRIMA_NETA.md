# Corrección: Comisión Base y Comisiones en Ceros

## Problema Reportado

En el módulo de comisiones, se presentaban los siguientes errores:

1. **Comisión Base idéntica a Prima Neta**: El campo `importe_base` mostraba el mismo valor que `prima_neta` en todos los casos
2. **Comisión Total en ceros**: Las comisiones calculadas aparecían en $0.00
3. **PDFs incorrectos**: Los documentos generados mostraban información inconsistente

---

## Causa Raíz

En el archivo `supabase/functions/process-commissions/index.ts`, existía un bug crítico:

### Antes (Incorrecto):

```typescript
// Las variables se declaraban dentro del bloque if
if (commissionConfig.commission_bruta_source === 'rules_engine') {
  let porcentajeComision = porcentajeBase;  // ❌ Alcance limitado
  let importeBase = primaNeta;              // ❌ Alcance limitado
  let tipoCalculo = 'directo';              // ❌ Alcance limitado

  // ... cálculos ...
}

// Al insertar, siempre usaba los valores por defecto
detailsToInsert.push({
  porcentaje_comision: porcentajeBase,  // ❌ Siempre el valor original
  importe_base: primaNeta,              // ❌ Siempre prima neta
  tipo_calculo: 'directo',              // ❌ Siempre 'directo'
  // ...
});
```

**Resultado**: Los valores calculados dentro del bloque `if` nunca se usaban porque estaban fuera de alcance.

---

## Solución Implementada

### Cambios en `process-commissions/index.ts`:

```typescript
// ✅ CORRECTO: Declarar variables ANTES del if para que estén disponibles
let commissionBruta: number | null = null;
let calculationStatus = 'ok';
let calculationMethod = 'unknown';
const calculationWarnings: any[] = [];
let porcentajeComision = porcentajeBase;  // ✅ Alcance correcto
let importeBase = primaNeta;              // ✅ Alcance correcto
let tipoCalculo = 'directo';              // ✅ Alcance correcto
let ruleApplied = null;

if (commissionConfig.commission_bruta_source === 'rules_engine') {
  const matchingRule = findBusinessRule(...);

  if (matchingRule) {
    tipoCalculo = matchingRule.tipo_calculo;

    if (tipoCalculo === 'multiplicador') {
      importeBase = primaNeta * matchingRule.valor_calculo;  // ✅ Se modifica correctamente
    }
    // ... otros cálculos

    commissionBruta = (importeBase * porcentajeComision) / 100;
  }
}

// ✅ CORRECTO: Ahora usa los valores calculados
detailsToInsert.push({
  porcentaje_comision: porcentajeComision,  // ✅ Usa valor calculado
  importe_base: importeBase,                // ✅ Usa valor calculado
  tipo_calculo: tipoCalculo,                // ✅ Usa valor calculado
  // ...
});
```

---

## Estructura de Datos de Comisiones

Para entender correctamente el flujo, aquí están los campos clave:

### Campos de Entrada (desde Excel/Importación):

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `prima_neta` | Prima total de la póliza | $10,000.00 |
| `porcentaje_base` | Porcentaje original del Excel (PorPart) | 15% |

### Campos Calculados (por Reglas de Negocio):

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `importe_base` | Base sobre la cual se calcula la comisión (puede ser diferente a `prima_neta`) | $8,000.00 |
| `porcentaje_comision` | Porcentaje final aplicado (puede ser diferente a `porcentaje_base`) | 18% |
| `commission_bruta` | Comisión antes de impuestos: `(importe_base × porcentaje_comision) / 100` | $1,440.00 |
| `commission_neta` | Comisión después de impuestos (actualmente igual a bruta) | $1,440.00 |

### Ejemplo de Cálculo con Regla "Multiplicador":

```
Prima Neta:         $10,000.00
Porcentaje Base:    15%
Regla:              Multiplicador × 0.8

→ Importe Base:     $10,000 × 0.8 = $8,000.00
→ Porcentaje Com:   15% (sin cambios)
→ Com. Bruta:       $8,000 × 0.15 = $1,200.00
→ Com. Neta:        $1,200.00
```

**Antes del fix**: `importe_base` hubiera sido $10,000 (incorrecto)
**Después del fix**: `importe_base` es $8,000 (correcto)

---

## Archivos Modificados

1. **`supabase/functions/process-commissions/index.ts`**
   - Líneas 352-355: Declaración de variables fuera del bloque if
   - Líneas 438-439: Uso de variables calculadas en lugar de valores por defecto
   - Línea 443: Uso de `tipoCalculo` calculado

---

## Estado

✅ **CORREGIDO Y VALIDADO**

- Build exitoso
- Cálculos funcionando correctamente
- PDFs generando información precisa

**Fecha de corrección:** 2024-12-17
