# Fix NO_ITEMS_INSERTED - Formato Real Excel

## Problema Resuelto

El sistema estaba rechazando archivos Excel válidos con el error `NO_ITEMS_INSERTED` porque las validaciones no estaban alineadas con el formato real de los archivos.

## Formato Real del Archivo

El archivo contiene estas columnas exactas:
- **EmailAgente**: Email del agente (puede estar vacío en 261 de 273 filas)
- **VendNombre**: Nombre del vendedor (para identificación manual)
- **Documento**: Número de póliza
- **Endoso**: Número de endoso (opcional)
- **FPago**: Fecha oficial de pago (DD/MM/YYYY)
- **CiaAbreviacion**: Aseguradora (puede estar vacía en 2 filas)
- **Importe**: Base de comisión (puede ser negativo para ajustes)
- **PorPart**: Porcentaje de participación (ej: 25 = 25%)
- **PrimaNeta**: Prima neta informativa (opcional)
- **Ramo**: Ramo del seguro
- **NombreCompleto**: Nombre del asegurado (opcional)
- **Concepto**: Concepto de la comisión (opcional)

## Cambios Implementados

### 1. Actualización de Sinónimos de Columnas

Agregados sinónimos para reconocer las columnas reales:
- `emailagente` → `email`
- `vendnombre` → `vendornombre`
- `documento` → `poliza`
- `ciaabreviacion` → `aseguradora`
- `nombrecompleto` → `nombreasegurado`
- `fliquidacion` → `fpago`
- `endoso` → campo nuevo

### 2. EmailAgente NO es Obligatorio

**ANTES**: Se descartaban filas sin email
**AHORA**:
- Si `EmailAgente` está vacío → NO DESCARTAR
- Marcar como `pending_assignment = true`
- Usar `VendNombre` como identificador para asignación manual
- Crear `vendor_key` basado en email o nombre

### 3. Importe Negativo es Válido

**ANTES**: Se descartaban filas con importe negativo
**AHORA**:
- Importe puede ser positivo o negativo
- Solo se descarta si es NaN o no numérico
- Válido para: ajustes, cancelaciones, reversos

### 4. Aseguradora Opcional con Default

**ANTES**: Se descartaban filas sin aseguradora
**AHORA**:
- Si `CiaAbreviacion` está vacía → usar `"NO_ESPECIFICADA"`
- Generar warning pero NO descartar
- Permitir procesar las 2 filas sin aseguradora

### 5. Sistema vendor_key para Matching

Nuevo campo `vendor_key` para identificar vendedores:

```typescript
vendor_key =
  - "email:xxx@xxx.com" si existe email
  - "name:NOMBRE NORMALIZADO" si no hay email pero sí nombre
  - "unknown" si no hay ninguno
```

Esto permite:
- Agrupar filas por vendedor sin email
- Asignación manual posterior
- Tracking consistente

### 6. Campos Nuevos Capturados

Agregados a la interfaz y BD:
- `vendor_name_raw`: VendNombre original del Excel
- `vendor_name_norm`: Nombre normalizado para matching
- `vendor_key`: Clave de identificación
- `endoso`: Número de endoso
- `pending_assignment`: Flag para items sin asignar

### 7. Validación Correcta

**Campos REALMENTE Obligatorios** (los únicos que bloquean):
- `Documento` (poliza)
- `Ramo`
- `Importe` (numérico, permite negativo)
- `PorPart` (numérico)

**Campos Opcionales** (generan warning pero NO bloquean):
- `EmailAgente` (puede estar vacío)
- `CiaAbreviacion` (usa default)
- `PrimaNeta` (solo informativo)
- `NombreCompleto` (opcional)
- `Endoso` (opcional)

### 8. Filtro de Items Correcto

```typescript
// ANTES: solo válidos
const itemsToInsert = validRows.map(...)

// AHORA: válidos + warnings
const parsedRows = [...validRows, ...warningRows];
const itemsToInsert = parsedRows.map(...)
```

## Resultados Esperados

Con el archivo de 273 filas:
- **Items insertados**: ~273 (todas las filas válidas)
- **Warnings**:
  - `missing_email`: ~261 filas
  - `missing_aseguradora`: 2 filas
- **Descartados**: 0 (si todas tienen Documento/Ramo/Importe/PorPart válidos)

## Diagnóstico en Logs

El sistema ahora muestra:
```
totalRowsRead: 273
validRows: X (sin warnings)
warningRows: Y (con warnings pero insertables)
discardedRows: Z (solo si faltan obligatorios reales)
insertableRows: X + Y (debe ser > 0)
```

Si `insertableRows == 0`, el error mostrará exactamente qué campos obligatorios faltan.

## Archivos Modificados

1. **supabase/functions/convert-import-to-commission-batches/index.ts**
   - Sinónimos actualizados
   - vendor_key implementado
   - Validaciones corregidas
   - Filtro de items corregido
   - Campos nuevos agregados

## Próximos Pasos

Una vez convertido el lote:
1. Los items con email se intentarán matchear automáticamente
2. Los items sin email quedarán en "Vendedores no reconocidos"
3. Usar la UI de "Asignar Vendedor" para asignación manual por `vendor_name_raw`
4. Una vez asignados, se pueden convertir a comisiones normales

## Testing

Para verificar con el archivo real:
1. Subir el Excel con 273 filas
2. Convertir el lote
3. Verificar que se crean lotes por semana
4. Verificar que los ~261 items sin email quedan como `pending_assignment`
5. Usar "Vendedores no reconocidos" para agrupar por `VendNombre`
6. Asignar manualmente cada vendedor
7. Las comisiones se calcularán correctamente incluso para importes negativos
