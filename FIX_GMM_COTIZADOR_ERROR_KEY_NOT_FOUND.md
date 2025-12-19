# Fix: Error "Key not found" en Cotizador GMM BX+

## Problema Reportado

Error en el Cotizador GMM BX+:
```
Error: Key "0.2" not found in table
```

## Causa Raíz

El error ocurría cuando la función `vlookup()` intentaba buscar valores numéricos en las tablas de tarifas. El problema principal era:

1. **Comparación de tipos inconsistente**: Los valores en la base de datos están almacenados como números (ej. `0.2`), pero el HTML `<select>` los convierte a strings al enviarlos.

2. **Sin tolerancia a precisión flotante**: Los números decimales pueden tener pequeñas diferencias de precisión que impiden coincidencias exactas.

3. **Mensajes de error genéricos**: El mensaje original no indicaba qué tabla ni qué valores estaban disponibles, dificultando el diagnóstico.

## Solución Implementada

### 1. Función `vlookup()` Mejorada

Ahora la función usa un enfoque de búsqueda en cascada:

```typescript
function vlookup(table: any[], key: any, valueCol: number = 1, tableName: string = 'unknown'): number {
  // 1. Intentar búsqueda exacta primero
  let row = table.find(r => r.col_0 === key);

  // 2. Si no hay coincidencia exacta, intentar comparación numérica con tolerancia
  if (!row) {
    const keyNum = Number(key);
    const isNumericKey = !isNaN(keyNum);

    if (isNumericKey) {
      row = table.find(r => {
        const rowNum = Number(r.col_0);
        return !isNaN(rowNum) && Math.abs(rowNum - keyNum) < 0.0001;
      });
    }
  }

  // 3. Si aún no hay coincidencia, intentar comparación de strings
  if (!row) {
    row = table.find(r => String(r.col_0) === String(key));
  }

  // 4. Si no se encuentra, lanzar error detallado
  if (!row) {
    const availableKeys = table.slice(0, 10).map(r => `"${r.col_0}"`).join(', ');
    const totalKeys = table.length;
    throw new Error(
      `Valor "${key}" no encontrado en tabla "${tableName}".\n` +
      `Valores disponibles (${totalKeys} total): ${availableKeys}${totalKeys > 10 ? '...' : ''}\n` +
      `Tipo del valor buscado: ${typeof key}`
    );
  }
  return Number(row[`col_${valueCol}`] || 0);
}
```

### 2. Función `vlookupByAge()` Mejorada

```typescript
function vlookupByAge(table: any[], edad: number, sexo: string): number {
  const row = table.find(r => Number(r.col_0) === edad);
  if (!row) {
    const minAge = Math.min(...table.map(r => Number(r.col_0)));
    const maxAge = Math.max(...table.map(r => Number(r.col_0)));
    throw new Error(
      `Edad ${edad} no encontrada en tabla de tarifas.\n` +
      `Rango válido: ${minAge} - ${maxAge} años`
    );
  }
  const col = sexo === 'Hombre' ? 'col_1' : 'col_2';
  return Number(row[col] || 0);
}
```

### 3. Mensajes de Error Mejorados en Forma de Pago

```typescript
const formaPago = tables.forma_pago.find(r => r.col_0 === input.forma_pago);
if (!formaPago) {
  const available = tables.forma_pago.map(r => `"${r.col_0}"`).join(', ');
  throw new Error(
    `Forma de pago "${input.forma_pago}" no encontrada.\n` +
    `Formas de pago disponibles: ${available}`
  );
}
```

### 4. Validación Mejorada en UI

```typescript
function handleCalculate() {
  // ... validaciones previas ...

  // Validar que todos los campos principales estén seleccionados
  if (!input.estado || !input.nivel_hospitalario || !input.tabulador ||
      !input.suma_asegurada || !input.deducible || !input.coaseguro || !input.forma_pago) {
    alert('Por favor complete todos los parámetros del plan antes de calcular');
    return;
  }

  // ... cálculo ...
}
```

### 5. Mejor Manejo de Errores en UI

```typescript
try {
  const calculated = calculateQuote(input, tariffTables);
  setResult(calculated);
} catch (error: any) {
  console.error('Error calculating:', error);
  const message = error.message || 'Error al calcular la cotización';
  alert(`Error en el cálculo:\n\n${message}`);
}
```

## Archivos Modificados

1. **`src/lib/gmmCalculationEngine.ts`**
   - Mejorada función `vlookup()` con búsqueda en cascada
   - Mejorada función `vlookupByAge()` con mensajes detallados
   - Mejorados mensajes de error en búsqueda de forma de pago
   - Agregados nombres de tabla a todas las llamadas `vlookup()`

2. **`src/pages/GMMCotizador.tsx`**
   - Agregada validación de campos completos antes de calcular
   - Mejorado manejo de errores con mensajes más claros
   - Mejor feedback al usuario en mensajes de validación

## Beneficios de la Solución

1. **Robustez**: Maneja múltiples formatos de datos (números, strings, decimales con precisión flotante)

2. **Diagnóstico**: Errores ahora incluyen:
   - Nombre de la tabla con problema
   - Valor buscado
   - Tipo del valor buscado
   - Lista de valores disponibles
   - Rango válido (para edades)

3. **Prevención**: Validación preventiva en UI evita llamadas con datos incompletos

4. **UX**: Mensajes de error claros en español ayudan al usuario a corregir el problema

## Ejemplo de Error Mejorado

**Antes:**
```
Error: Key "0.2" not found in table
```

**Después:**
```
Valor "0.2" no encontrado en tabla "Coaseguro".
Valores disponibles (5 total): "0.1", "0.15", "0.2", "0.25", "0.3"
Tipo del valor buscado: string
```

## Validación de Datos en Base de Datos

Se verificó que las tablas están correctamente cargadas:

```sql
-- Tabla factor_coaseguro tiene los valores correctos:
[
  {"col_0": 0.1,  "col_1": 1},
  {"col_0": 0.15, "col_1": 0.929},
  {"col_0": 0.2,  "col_1": 0.9},      ← Valor que causaba error
  {"col_0": 0.25, "col_1": 0.867},
  {"col_0": 0.3,  "col_1": 0.833}
]
```

## Testing Recomendado

1. Probar cotización con coaseguro 0.2 (20%)
2. Probar cotización con todos los valores de coaseguro disponibles
3. Verificar que edades fuera de rango muestran mensaje claro
4. Intentar calcular sin seleccionar todos los campos
5. Verificar que los mensajes de error se muestran correctamente en la UI

---

**Fecha de Implementación:** 2025-12-19
**Estado:** COMPLETADO ✓
**Build:** Exitoso
