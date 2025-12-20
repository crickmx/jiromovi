# Fix: Página en Blanco al Calcular Cotización GMM

## Problema Resuelto

Al dar clic en el botón "Calcular" en el cotizador GMM, la página se ponía completamente en blanco.

## Causa Raíz

**Error:** `Uncaught TypeError: result.payment_plans.map is not a function`

**Ubicación:** `src/pages/GMMCotizador.tsx:788`

**Análisis:**
1. El componente `GMMCotizador` esperaba que `result.payment_plans` fuera un **array**
2. El motor V2 (`gmmCalculationEngineV2.ts`) estaba devolviendo un **objeto** con propiedades `anual`, `semestral`, `trimestral`, `mensual`
3. Al intentar hacer `.map()` sobre un objeto, JavaScript lanzaba un error que crasheaba React
4. React mostraba una pantalla en blanco en lugar de mostrar el error

## Cambios Implementados

### 1. Actualización del Tipo `QuoteCalculationResult`

**Archivo:** `src/lib/gmmTypes.ts`

```typescript
export interface QuoteCalculationResult {
  insureds: InsuredCalculation[];
  prima_neta_total: number;
  gastos_expedicion: number;      // ✅ Nuevo
  subtotal: number;               // ✅ Nuevo
  iva: number;                    // ✅ Nuevo
  total_con_iva: number;          // ✅ Nuevo
  tope_coaseguro: number;
  payment_plans: PaymentPlanResult[];
}
```

### 2. Corrección del Motor V2

**Archivo:** `src/lib/gmmCalculationEngineV2.ts`

**Función `calcularFormasDePago()` - Cambio de estructura:**

Antes (devolvía objeto):
```typescript
return {
  anual: { per_payment: ..., total_anual: ... },
  semestral: { per_payment: ..., total_anual: ... },
  // ...
};
```

Después (devuelve array):
```typescript
return [
  {
    forma_pago: 'Anual',
    recargo: 0,
    gastos_expedicion: 150,
    subtotal: ...,
    iva: ...,
    total: ...,
    primer_recibo: ...,
    recibos_subsecuentes: ...,
    num_recibos: 1
  },
  // ... más planes según formas_pago seleccionadas
];
```

**Actualización de `calculateQuoteV2()`:**
- Recibe las formas de pago seleccionadas del input
- Calcula solo los planes para las formas de pago elegidas por el usuario
- Devuelve los campos adicionales (gastos_expedicion, subtotal, iva, total_con_iva)

### 3. Actualización del Motor V1

**Archivo:** `src/lib/gmmCalculationEngine.ts`

Actualizado el `return` de `calculateQuote()` para incluir los mismos campos adicionales y mantener compatibilidad:

```typescript
return {
  insureds,
  prima_neta_total: primaNetaTotal,
  gastos_expedicion: planAnual?.gastos_expedicion || gastosExpedicionBase,
  subtotal: planAnual?.subtotal || primaNetaTotal + gastosExpedicionBase,
  iva: planAnual?.iva || roundTo2Decimals((primaNetaTotal + gastosExpedicionBase) * ivaRate),
  total_con_iva: planAnual?.total || roundTo2Decimals((primaNetaTotal + gastosExpedicionBase) * (1 + ivaRate)),
  tope_coaseguro: topeCoaseguro,
  payment_plans: paymentPlans,
};
```

## Lógica de Formas de Pago

La nueva implementación calcula planes de pago basándose en:

| Forma de Pago | Recargo | Número de Recibos |
|---------------|---------|-------------------|
| Anual         | 0%      | 1                 |
| Semestral     | 3%      | 2                 |
| Trimestral    | 5%      | 4                 |
| Mensual       | 7%      | 12                |

**Fórmulas:**
```
Recargo = Prima Neta Total × % Recargo
Subtotal = Prima Neta Total + Recargo + Gastos Expedición
IVA = Subtotal × 16%
Total = Subtotal + IVA
Primer Recibo = Total / Número de Recibos
Recibos Subsecuentes = Primer Recibo (para planes con más de 1 recibo)
```

## Verificación Post-Fix

### Checklist de Pruebas

1. ✅ El proyecto compila sin errores
2. ✅ El cotizador carga correctamente
3. ✅ Se pueden ingresar datos de asegurados
4. ✅ El botón "Calcular" funciona sin errores
5. ✅ Se muestran los resultados correctamente
6. ✅ Los planes de pago se muestran como cards individuales
7. ✅ Cada plan muestra: forma de pago, prima neta, recargo, gastos, subtotal, IVA y total

### Flujo de Prueba

1. Ir a "GMM Cotizador"
2. Seleccionar:
   - Estado
   - Nivel Hospitalario
   - Tabulador
   - Suma Asegurada
   - Deducible
   - Coaseguro
   - Formas de pago (múltiples)
3. Agregar al menos 1 asegurado con edad
4. Seleccionar coberturas opcionales
5. Click en "Calcular"
6. Verificar que se muestran:
   - Datos de cada asegurado
   - Prima neta total
   - Tope de coaseguro
   - Cards de cada forma de pago seleccionada

## Impacto en Otras Funcionalidades

### Guardar Cotizaciones
- ✅ Compatible - El resultado se guarda completo en `quote_data`
- ✅ La estructura incluye todos los campos necesarios

### Descargar PDF
- ✅ Compatible - El PDF usa `result.payment_plans.map()` correctamente
- ✅ Muestra cada plan de pago en el documento

### Editar Cotización
- ✅ Compatible - Al cargar una cotización guardada, se recalcula con la nueva estructura

### Mis Cotizaciones
- ✅ Compatible - La tabla muestra las cotizaciones guardadas sin cambios

## Archivos Modificados

1. ✅ `src/lib/gmmTypes.ts` - Actualización del tipo `QuoteCalculationResult`
2. ✅ `src/lib/gmmCalculationEngineV2.ts` - Corrección de `calcularFormasDePago()` y `calculateQuoteV2()`
3. ✅ `src/lib/gmmCalculationEngine.ts` - Actualización de `calculateQuote()` para compatibilidad

## Archivos NO Modificados

- ✅ `src/pages/GMMCotizador.tsx` - No requiere cambios, ya funcionaba correctamente
- ✅ `src/lib/gmmPdfGenerator.ts` - Compatible con la nueva estructura

## Mejoras Adicionales

### 1. Flexibilidad en Formas de Pago
Ahora el sistema solo calcula los planes para las formas de pago que el usuario selecciona, en lugar de calcular todas y filtrar después.

### 2. Valores por Defecto
Si el usuario no selecciona ninguna forma de pago, el sistema usa "Anual" por defecto para evitar errores.

### 3. Estructura Consistente
Tanto el motor V1 como V2 ahora devuelven la misma estructura, facilitando el mantenimiento.

## Notas Técnicas

### Por Qué Ocurrió Este Error

El error se introdujo al migrar del motor V1 al V2. El motor V2 tenía una función `calcularFormasDePago()` simplificada que devolvía un objeto plano en lugar de un array estructurado como `PaymentPlanResult[]`.

### Prevención Futura

1. **Tipos estrictos:** TypeScript debería haber detectado este error, pero se usó `any` en algunos lugares
2. **Pruebas:** Agregar pruebas unitarias para las funciones de cálculo
3. **Validación:** Agregar validación en runtime de la estructura del resultado

---

**Fecha del fix:** 2024-12-20
**Estado:** Resuelto ✅
**Severidad original:** Crítica (bloqueaba uso del cotizador)
**Impacto:** Ningún impacto negativo en funcionalidades existentes
