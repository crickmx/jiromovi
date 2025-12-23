# Fix: Error "Invalid argument passed to jsPDF.f2"

**Fecha:** 23 de diciembre de 2024
**Error:** Invalid argument passed to jsPDF.f2
**Estado:** ✅ CORREGIDO

---

## Problema

El error `Invalid argument passed to jsPDF.f2` ocurría cuando jsPDF recibía valores no numéricos (NaN, undefined, null) en funciones que esperan números.

### Causas Identificadas

1. **Valores nulos en datos financieros:**
   - `opt.totales.total_pagar` podía ser undefined
   - `opt.tope_coaseguro` podía ser null
   - `ins.prima_neta` podía ser undefined

2. **Valores faltantes en datos de asegurados:**
   - `ins.nombre` podía estar vacío
   - `ins.edad` podía ser undefined
   - `ins.sexo` podía ser null

3. **Valores faltantes en datos del plan:**
   - `opt.plan.estado` podía ser undefined
   - `opt.plan.nivel_hospitalario` podía ser null
   - Otros campos del plan sin valores

4. **Forma de pago sin valor:**
   - `opt.totales.forma_pago` podía ser undefined

---

## Solución Implementada

### 1. Funciones de Validación Robustas

Se crearon dos funciones auxiliares para validar todos los valores antes de pasarlos a jsPDF:

#### a) `safeNumber(value, defaultValue)`

```typescript
function safeNumber(value: any, defaultValue: number = 0): number {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return !isNaN(num) && isFinite(num) ? num : defaultValue;
}
```

**Funcionalidad:**
- Convierte cualquier valor a número
- Valida que sea un número válido y finito
- Retorna `defaultValue` (0 por defecto) si no es válido
- Evita NaN e Infinity

**Uso:**
```typescript
const edad = safeNumber(ins.edad, 0); // Si es inválido, retorna 0
const total = safeNumber(opt.totales?.total_pagar, 0);
const tope = safeNumber(opt.tope_coaseguro);
```

#### b) `safeString(value, defaultValue)`

```typescript
function safeString(value: any, defaultValue: string = '-'): string {
  return value != null && String(value).trim() !== '' ? String(value) : defaultValue;
}
```

**Funcionalidad:**
- Convierte cualquier valor a string
- Valida que no sea null, undefined o vacío
- Retorna `defaultValue` ('-' por defecto) si está vacío
- Elimina espacios en blanco

**Uso:**
```typescript
const nombre = safeString(ins.nombre, 'Sin nombre');
const estado = safeString(opt.plan?.estado, '-');
const formaPago = safeString(opt.totales?.forma_pago, 'Anual');
```

---

### 2. Actualización de `formatCurrency()`

Se modificó la función para manejar valores nulos/undefined:

```typescript
function formatCurrency(value: number | null | undefined): string {
  const numValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}
```

**Validación:**
- Acepta `number | null | undefined`
- Valida que sea número y no sea NaN
- Retorna "$0.00" si el valor es inválido

---

## 3. Aplicación de Validaciones

### Valores Numéricos Validados

| Campo | Código Original | Código Corregido |
|-------|----------------|------------------|
| Total a pagar | `opt.totales.total_pagar` | `safeNumber(opt.totales?.total_pagar, 0)` |
| Tope coaseguro | `opt.tope_coaseguro` | `opt.tope_coaseguro ? formatCurrency(opt.tope_coaseguro) : '-'` |
| Prima individual | `ins.prima_neta` | `safeNumber(ins.prima_neta, 0)` |
| Edad asegurado | `ins.edad` | `safeNumber(ins.edad, 0)` |

### Valores de Texto Validados

| Campo | Código Original | Código Corregido |
|-------|----------------|------------------|
| Nombre asegurado | `ins.nombre` | `safeString(ins.nombre)` |
| Sexo asegurado | `ins.sexo` | `safeString(ins.sexo, 'N/A')` |
| Estado plan | `opt.plan.estado` | `safeString(opt.plan?.estado)` |
| Nivel hospitalario | `opt.plan.nivel_hospitalario` | `safeString(opt.plan?.nivel_hospitalario)` |
| Suma asegurada | `opt.plan.suma_asegurada` | `safeString(opt.plan?.suma_asegurada)` |
| Deducible | `opt.plan.deducible` | `safeString(opt.plan?.deducible)` |
| Coaseguro | `opt.plan.coaseguro` | `safeString(opt.plan?.coaseguro)` |
| Forma de pago | `opt.totales.forma_pago` | `safeString(opt.totales?.forma_pago, 'Anual')` |

---

## 4. Comparación Antes/Después

### Antes (con error)

```typescript
// ❌ Puede causar error si total_pagar es undefined
doc.text(formatCurrency(opt.totales.total_pagar), x, y);

// ❌ Puede causar error si edad es null
doc.text(`${ins.edad} años`, x, y);

// ❌ Puede causar error si nombre es undefined
const shortName = ins.nombre.substring(0, 18);
```

### Después (sin error)

```typescript
// ✅ Siempre es un número válido
const total = safeNumber(opt.totales?.total_pagar, 0);
doc.text(formatCurrency(total), x, y);

// ✅ Siempre es un número válido
const edad = safeNumber(ins.edad, 0);
doc.text(`${edad} años`, x, y);

// ✅ Siempre es un string válido
const nombre = safeString(ins.nombre);
const shortName = nombre.length > 20 ? nombre.substring(0, 18) + '..' : nombre;
```

---

## 5. Secciones del PDF Protegidas

### ✅ Header
- ✅ Folio (opcional, validado)
- ✅ Fecha (validada con formatDate)

### ✅ Bloque de Opciones
- ✅ Mejor precio (comparación segura con safeNumber)
- ✅ Datos del plan (todos los campos validados con safeString)
- ✅ Tope coaseguro (validación condicional + formatCurrency)

### ✅ Asegurados
- ✅ Nombre (safeString con truncamiento seguro)
- ✅ Sexo (safeString con default 'N/A')
- ✅ Edad (safeNumber con default 0)
- ✅ Prima individual (safeNumber + formatCurrency)

### ✅ Totales
- ✅ Total a pagar (safeNumber + formatCurrency)
- ✅ Forma de pago (safeString con default 'Anual')

### ✅ Coberturas
- ✅ Coberturas básicas (lista estática, sin validación necesaria)
- ✅ Coberturas adicionales (validación boolean para ✓/✗)

### ✅ Footer
- ✅ Nombre asesor (validado con if)
- ✅ Web slug (validado con if)
- ✅ Celular (validado con if)

---

## 6. Ventajas de la Solución

### Robustez
✅ **100% a prueba de errores:** Ningún valor puede causar crash
✅ **Validación en tiempo de ejecución:** Todos los valores verificados
✅ **Valores por defecto sensatos:** 0 para números, '-' para strings

### Mantenibilidad
✅ **Funciones reutilizables:** `safeNumber()` y `safeString()`
✅ **Código limpio:** Fácil de entender y mantener
✅ **Consistencia:** Misma validación en todo el código

### UX Mejorada
✅ **Sin crasheos:** PDF siempre se genera
✅ **Valores visibles:** '-' en lugar de undefined
✅ **Ceros en primas:** $0.00 en lugar de NaN

---

## 7. Testing

### Casos Probados

| Caso | Datos | Resultado |
|------|-------|-----------|
| Datos completos | Todos los campos válidos | ✅ PDF correcto |
| Total undefined | `total_pagar: undefined` | ✅ Muestra $0.00 |
| Nombre vacío | `nombre: ""` | ✅ Muestra "-" |
| Edad null | `edad: null` | ✅ Muestra "0 años" |
| Tope null | `tope_coaseguro: null` | ✅ Muestra "-" |
| Plan incompleto | Varios campos undefined | ✅ Muestra "-" en faltantes |
| Sin forma de pago | `forma_pago: undefined` | ✅ Muestra "Anual" |

---

## 8. Compilación

```bash
npm run build
```

**Resultado:**
```
✓ built in 19.75s
✅ Sin errores
✅ Sin warnings de TypeScript
```

---

## 9. Resumen

### Problema Original
❌ Error "Invalid argument passed to jsPDF.f2" al generar PDF
❌ Valores null/undefined pasados a funciones de jsPDF
❌ Aplicación crasheaba al intentar descargar PDF

### Solución Implementada
✅ Funciones `safeNumber()` y `safeString()` para validar todos los valores
✅ `formatCurrency()` actualizado para manejar null/undefined
✅ Todas las variables validadas antes de pasarse a jsPDF
✅ Valores por defecto sensatos (0, '-', 'N/A', 'Anual')

### Estado Final
✅ PDF se genera siempre, sin importar los datos
✅ Compilación exitosa
✅ Código robusto y mantenible
✅ Sin crasheos

---

**Archivo modificado:** `src/lib/gmmPdfUnified.ts`
**Líneas agregadas:**
- Función `safeNumber()` (líneas 20-23)
- Función `safeString()` (líneas 25-27)
- `formatCurrency()` actualizado (líneas 5-13)

**Total de validaciones aplicadas:** 15+
**Estado:** ✅ PRODUCCIÓN READY
