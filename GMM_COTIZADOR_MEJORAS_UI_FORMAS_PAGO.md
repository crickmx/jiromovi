# Mejoras al Cotizador GMM BX+: Formatos y Múltiples Formas de Pago

## Cambios Implementados

### 1. Formato de Moneda para Suma Asegurada y Deducible

Se agregó formato de moneda mexicana ($) a los campos de Suma Asegurada y Deducible para mejor legibilidad.

**Función helper creada:**
```typescript
function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
```

**Ejemplo de visualización:**
- Antes: `50000`
- Ahora: `$50,000`

### 2. Formato de Porcentaje para Coaseguro

Se agregó formato de porcentaje (%) al campo de Coaseguro.

**Función helper creada:**
```typescript
function formatPercentage(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${(num * 100).toFixed(0)}%`;
}
```

**Ejemplo de visualización:**
- Antes: `0.2`
- Ahora: `20%`

### 3. Selección Múltiple de Formas de Pago

Se cambió de un selector simple a checkboxes que permiten seleccionar múltiples formas de pago simultáneamente.

**Cambios en tipos:**

```typescript
// Antes
export interface QuoteInput {
  // ...
  forma_pago: string;
}

// Ahora
export interface QuoteInput {
  // ...
  formas_pago: string[];
}
```

**Cambios en resultado:**

```typescript
// Antes
export interface QuoteCalculationResult {
  insureds: InsuredCalculation[];
  prima_neta_total: number;
  recargo: number;
  gastos_expedicion: number;
  subtotal: number;
  iva: number;
  total: number;
  primer_recibo: number;
  recibos_subsecuentes: number;
  num_recibos: number;
  tope_coaseguro: number;
}

// Ahora
export interface PaymentPlanResult {
  forma_pago: string;
  recargo: number;
  gastos_expedicion: number;
  subtotal: number;
  iva: number;
  total: number;
  primer_recibo: number;
  recibos_subsecuentes: number;
  num_recibos: number;
}

export interface QuoteCalculationResult {
  insureds: InsuredCalculation[];
  prima_neta_total: number;
  tope_coaseguro: number;
  payment_plans: PaymentPlanResult[];
}
```

### 4. Visualización de Múltiples Planes de Pago

La interfaz ahora muestra:

1. **Resumen General** (sticky)
   - Prima Neta Total (compartida por todos los planes)
   - Tope Coaseguro

2. **Cards individuales para cada forma de pago seleccionada**
   - Nombre de la forma de pago como título
   - Prima Neta
   - Recargo específico
   - Gastos de Expedición
   - Subtotal
   - IVA
   - Total
   - Primer Recibo
   - Recibos Subsecuentes (si aplica)

**Ejemplo de visualización:**

```
┌─────────────────────────────────┐
│ Resumen General                 │
│ Prima Neta Total: $10,000.00   │
│ Tope Coaseguro: $50,000.00     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Anual                           │
│ Prima Neta: $10,000.00         │
│ Recargo: $0.00                 │
│ ...                            │
│ TOTAL: $11,600.00              │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Semestral                       │
│ Prima Neta: $10,000.00         │
│ Recargo: $350.00               │
│ ...                            │
│ TOTAL: $12,006.00              │
└─────────────────────────────────┘
```

## Cambios en Motor de Cálculo

### Función `calculateQuote()` Mejorada

La función ahora calcula múltiples planes de pago en una sola ejecución:

```typescript
export function calculateQuote(
  input: QuoteInput,
  tables: TariffTables
): QuoteCalculationResult {
  // ... cálculo de prima neta (compartida) ...

  // Calcular múltiples planes de pago
  const paymentPlans = input.formas_pago.map(formaPagoName => {
    const formaPago = tables.forma_pago.find(r => r.col_0 === formaPagoName);
    // ... cálculo específico para cada forma de pago ...

    return {
      forma_pago: formaPagoName,
      recargo,
      gastos_expedicion: gastosExpedicion,
      subtotal,
      iva,
      total,
      primer_recibo: primerRecibo,
      recibos_subsecuentes: recibosSubsecuentes,
      num_recibos: numRecibos,
    };
  });

  return {
    insureds,
    prima_neta_total: primaNetaTotal,
    tope_coaseguro: topeCoaseguro,
    payment_plans: paymentPlans,
  };
}
```

## Validaciones Actualizadas

### Validación de Formas de Pago

```typescript
if (input.formas_pago.length === 0) {
  alert('Por favor seleccione al menos una forma de pago');
  return;
}
```

## UI Mejorado

### Checkboxes de Formas de Pago

```tsx
<div className="col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Formas de Pago (selecciona una o más)
  </label>
  <div className="grid grid-cols-2 gap-3">
    {tariffTables.forma_pago.map((row) => (
      <label key={row.col_0} className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={input.formas_pago.includes(row.col_0)}
          onChange={(e) => {
            if (e.target.checked) {
              setInput({ ...input, formas_pago: [...input.formas_pago, row.col_0] });
            } else {
              setInput({ ...input, formas_pago: input.formas_pago.filter(fp => fp !== row.col_0) });
            }
          }}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span>{row.col_0}</span>
      </label>
    ))}
  </div>
</div>
```

## Compatibilidad con Base de Datos

El guardado de cotizaciones mantiene compatibilidad con el esquema existente:

```typescript
// Usar el primer plan de pago para campos individuales (compatibilidad)
const firstPlan = result.payment_plans[0];

const { data: quote } = await supabase
  .from('gmm_quotes')
  .insert({
    // ...
    forma_pago: input.formas_pago.join(', '),  // Todas las formas seleccionadas
    num_recibos: firstPlan.num_recibos,        // Del primer plan
    recargo: firstPlan.recargo,                 // Del primer plan
    // ...
    input_json: input,      // Input completo
    result_json: result,    // Todos los planes de pago
  });
```

## Archivos Modificados

### 1. `src/lib/gmmTypes.ts`
- Cambiado `forma_pago: string` → `formas_pago: string[]` en `QuoteInput`
- Agregado nuevo tipo `PaymentPlanResult`
- Modificado `QuoteCalculationResult` para incluir array de `payment_plans`

### 2. `src/lib/gmmCalculationEngine.ts`
- Agregado import de `PaymentPlanResult`
- Modificada función `calculateQuote()` para calcular múltiples planes
- Prima neta se calcula una vez (compartida)
- Cada forma de pago genera su propio `PaymentPlanResult`

### 3. `src/pages/GMMCotizador.tsx`
- Agregadas funciones helper `formatCurrency()` y `formatPercentage()`
- Cambiado estado inicial de `forma_pago: ''` → `formas_pago: []`
- Reemplazado select de forma de pago con checkboxes múltiples
- Actualizada validación para verificar `formas_pago.length > 0`
- Modificada visualización de resultados para mostrar múltiples planes
- Actualizada función `handleSave()` para manejar múltiples formas de pago

## Beneficios de los Cambios

### 1. Mejor UX
- Formato de moneda facilita lectura de cantidades
- Formato de porcentaje clarifica el coaseguro
- Selección múltiple permite comparar planes en una sola cotización

### 2. Eficiencia
- Una sola cotización puede mostrar múltiples opciones de pago
- Usuario puede comparar fácilmente costos entre formas de pago
- Reducción de tiempo al no tener que calcular cada forma de pago por separado

### 3. Flexibilidad
- Sistema preparado para mostrar tantas formas de pago como sea necesario
- Mantiene compatibilidad con sistema de guardado existente
- Resultado JSON incluye toda la información para reportes futuros

## Uso del Sistema

### Flujo de Usuario

1. Usuario selecciona parámetros del plan (estado, nivel hospitalario, etc.)
2. Usuario selecciona suma asegurada (mostrada como $50,000, $100,000, etc.)
3. Usuario selecciona deducible (mostrado como $5,000, $10,000, etc.)
4. Usuario selecciona coaseguro (mostrado como 10%, 15%, 20%, etc.)
5. **Usuario marca uno o más checkboxes de formas de pago**
6. Usuario agrega asegurados
7. Usuario hace clic en "Calcular"
8. Sistema muestra:
   - Resumen general (prima neta y tope coaseguro)
   - Card separada para cada forma de pago seleccionada con su costo total
9. Usuario puede guardar la cotización con todas las formas de pago

### Ejemplo de Cotización

Usuario selecciona:
- Suma Asegurada: $100,000
- Deducible: $10,000
- Coaseguro: 20%
- Formas de pago: ✓ Anual, ✓ Semestral, ✓ Mensual

Resultado muestra 3 cards:
1. **Anual**: Total $11,600 (sin recargo)
2. **Semestral**: Total $12,006 (2 pagos de $6,003 c/u)
3. **Mensual**: Total $12,878 (12 pagos de $1,073.17 c/u)

Usuario puede comparar y decidir la mejor opción.

---

**Fecha de Implementación:** 2025-12-19
**Estado:** COMPLETADO ✓
**Build:** Exitoso
**Testing:** Pendiente
