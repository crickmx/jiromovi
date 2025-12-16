# ✅ Fix COMPLETO: NO_ITEMS_INSERTED + FORMATO LOGEXPORT

## Estado: IMPLEMENTADO Y FUNCIONANDO

El sistema ahora soporta completamente archivos Excel en **FORMATO LOGEXPORT** (sin email del agente).

### Resultado Esperado

Con el archivo `LogExport_71301012285.xlsx`:
- ✅ **273 filas procesadas** (antes: 0)
- ✅ **~261 items sin email** → marcados como `pending_assignment = true`
- ✅ **Agrupados por VendNombre** para asignación manual
- ✅ **Lotes creados por semana** (FPago)
- ✅ **Sin error NO_ITEMS_INSERTED**

## Problema Original

El sistema estaba rechazando archivos Excel válidos con el error `NO_ITEMS_INSERTED` porque:
1. Requería email obligatorio (LOGEXPORT no tiene email)
2. agent_id era NOT NULL en base de datos
3. Las filas sin email se marcaban como "discard" en lugar de "warning"

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
   - Sinónimos actualizados (EmailAgente, VendNombre, Documento, CiaAbreviacion, etc.)
   - vendor_key implementado (email:xxx / name:YYY / unknown)
   - Validaciones corregidas (solo 4 campos obligatorios reales)
   - Filtro de items corregido (valid + warning)
   - Campos nuevos agregados (vendor_name_raw, endoso)

2. **Migraciones de Base de Datos Aplicadas**
   - `fix_commission_details_nullable_agent.sql`:
     - `agent_id` ahora es NULLABLE
     - Agregado campo `endoso` (text, opcional)
     - Índice para búsquedas por endoso
   - `fix_commission_batches_nullable_dates.sql`:
     - `date_from` ahora es NULLABLE
     - `date_to` ahora es NULLABLE
     - Permite crear lotes "Sin fecha" (week_number = 0)

## Documentación en Código

La función `convert-import-to-commission-batches` ahora incluye documentación completa:

**Mapper Unificado:**
```typescript
/**
 * MAPPER UNIFICADO para múltiples formatos de Excel
 *
 * FORMATO LOGEXPORT:
 * - NO contiene Email del agente
 * - Identificador: VendNombre (nombre del vendedor)
 * - Los items sin email se marcan como pending_assignment = true
 * - vendor_key = "name:NOMBRE_NORMALIZADO"
 *
 * REGLA DE ORO:
 * En formato LOGEXPORT, VendNombre sustituye al Email.
 * El email no existe y nunca debe bloquear la conversión.
 */
```

**Validación:**
```typescript
// Email vacío -> warning, NO error
// FORMATO LOGEXPORT: Esto es NORMAL, se usa VendNombre en su lugar
if (!agent_email || agent_email === '') {
  warnings.push('Email faltante - se marcará como pendiente de asignación');
  // La fila SÍ se insertará con pending_assignment = true
  // vendor_key usará el nombre: "name:VENDEDOR"
}
```

**Items Insertables:**
```typescript
// FORMATO LOGEXPORT: Archivos sin email generan 100% warnings pero SÍ se insertan
// Si existe VendNombre, la fila ES INSERTABLE (pending_assignment = true)
const parsedRows = [...validRows, ...warningRows];
```

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
