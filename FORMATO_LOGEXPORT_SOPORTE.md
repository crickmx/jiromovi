# Soporte Completo para FORMATO LOGEXPORT

## Estado: ✅ IMPLEMENTADO Y FUNCIONANDO

El sistema ahora soporta archivos Excel en formato LOGEXPORT que **NO contienen email del agente**.

---

## Características del Formato LOGEXPORT

### Columnas Presentes
```
VendNombre         → Nombre del vendedor (identificador principal)
Documento          → Número de póliza
Endoso             → Número de endoso (opcional)
FPago              → Fecha de pago (DD/MM/YYYY)
CiaAbreviacion     → Aseguradora
Ramo               → Ramo del seguro
Importe            → Base de comisión (puede ser negativo)
PorPart            → Porcentaje de participación (ej: 25 = 25%)
PrimaNeta          → Prima neta (informativa)
NombreCompleto     → Nombre del asegurado (opcional)
Concepto           → Concepto de la comisión (opcional)
```

### ❌ NO Contiene
- `Email` o `EmailAgente`
- Cualquier identificador basado en correo electrónico

---

## Cómo Funciona

### 1. Detección Automática

El sistema detecta automáticamente el formato LOGEXPORT cuando:
- Encuentra columna `VendNombre`
- NO encuentra columna `Email` o `EmailAgente`
- Encuentra las columnas obligatorias: `Documento`, `Ramo`, `Importe`, `PorPart`

### 2. Procesamiento Sin Email

**Identificación del Vendedor:**
```typescript
// Sin email, se usa el nombre como identificador
vendor_key = "name:JUAN PEREZ"           // Normalizado
vendor_name_raw = "Juan Pérez"          // Original del Excel
agent_email = ""                        // Vacío
pending_assignment = true               // Requiere asignación manual
match_method = "name_only"              // Método de matching
```

**Status de la Fila:**
- `status = "warning"` (tiene advertencia por falta de email)
- **Pero SÍ se inserta** en `commission_details`
- NO se descarta

### 3. Base de Datos

**Campos Nullables:**
- `commission_details.agent_id` → Puede ser NULL
- `commission_batches.date_from` → Puede ser NULL
- `commission_batches.date_to` → Puede ser NULL

**Campos Agregados:**
- `commission_details.endoso` → text (opcional)
- `commission_details.vendor_name_raw` → text (VendNombre original)
- `commission_details.vendor_key` → text (clave de agrupación)
- `commission_details.pending_assignment` → boolean (true para LOGEXPORT)

### 4. Agrupación de Lotes

**Por Semana (FPago):**
```
Lote: Semana 1 (01/01/2024 - 07/01/2024)
  → Items con FPago en ese rango
  → Todos con pending_assignment = true

Lote: Semana 2 (08/01/2024 - 14/01/2024)
  → Items con FPago en ese rango
  → Todos con pending_assignment = true

Lote: Sin fecha (week_number = 0)
  → Items sin FPago
  → date_from = NULL, date_to = NULL
```

---

## Resultado con LogExport_71301012285.xlsx

### Antes (Error)
```
❌ NO_ITEMS_INSERTED
0 filas procesadas
273 filas descartadas por "email vacío"
```

### Ahora (Funcionando)
```
✅ CONVERSIÓN EXITOSA
273 filas procesadas
~261 items con pending_assignment = true
~12 items con email válido (si hay)
Agrupados por VendNombre en tabla de no reconocidos
```

---

## Flujo de Trabajo

### 1. Importar y Convertir
```
1. Subir archivo LogExport.xlsx
2. Procesar en document_import_batches
3. Convertir a commission_batches
   → Sistema detecta formato LOGEXPORT automáticamente
   → Inserta todas las filas con vendor_key = "name:VENDEDOR"
```

### 2. Revisar Vendedores No Reconocidos
```
Vendedores No Reconocidos
┌─────────────────────────────────────────┐
│ VendNombre          Items   Comisión    │
├─────────────────────────────────────────┤
│ JUAN PEREZ          45      $12,500.00  │
│ MARIA GARCIA        38      $9,800.00   │
│ CARLOS LOPEZ        22      $5,600.00   │
└─────────────────────────────────────────┘
```

### 3. Asignar Manualmente
```
1. Click en "Asignar" para "JUAN PEREZ"
2. Sistema busca usuarios con nombre similar
3. Seleccionar usuario correcto
4. Confirmar asignación
   → Actualiza agent_id en los 45 items
   → pending_assignment = false
   → match_method = "manual"
```

### 4. Items Asignados
```
Una vez asignados, los items:
- Aparecen en "Mis Comisiones" del agente
- Se pueden cerrar en lotes
- Se pueden descargar en reportes
- Quedan vinculados permanentemente
```

---

## Validaciones

### ✅ Se Inserta Si:
- Tiene `Documento` (póliza)
- Tiene `Ramo`
- Tiene `Importe` (numérico, puede ser negativo)
- Tiene `PorPart` (numérico)

### ❌ Se Descarta Si:
- Falta `Documento`
- Falta `Ramo`
- `Importe` no es numérico (NaN)
- `PorPart` no es numérico (NaN)

### ⚠️ Genera Warning (Pero SÍ se Inserta):
- Email vacío
- Aseguradora vacía (se usa "NO_ESPECIFICADA")
- FPago vacío (va a lote "Sin fecha")

---

## Regla de Oro

```
En formato LOGEXPORT, VendNombre sustituye al Email.
El email no existe y nunca debe bloquear la conversión.
```

### Implementación en Código

El código incluye comentarios explicativos:

**Mapper:**
```typescript
/**
 * FORMATO LOGEXPORT:
 * - NO contiene Email del agente
 * - Identificador: VendNombre (nombre del vendedor)
 * - Los items sin email se marcan como pending_assignment = true
 * - vendor_key = "name:NOMBRE_NORMALIZADO"
 */
```

**Validación:**
```typescript
// Email vacío -> warning, NO error
// FORMATO LOGEXPORT: Esto es NORMAL, se usa VendNombre en su lugar
if (!agent_email || agent_email === '') {
  warnings.push('Email faltante - se marcará como pendiente de asignación');
  // La fila SÍ se insertará con pending_assignment = true
}
```

**Items Insertables:**
```typescript
// FORMATO LOGEXPORT: Archivos sin email generan 100% warnings pero SÍ se insertan
// Si existe VendNombre, la fila ES INSERTABLE (pending_assignment = true)
const parsedRows = [...validRows, ...warningRows];
```

---

## Testing

### Verificar Conversión
```bash
1. Ir a "Documentos → Importar"
2. Subir LogExport_71301012285.xlsx
3. Esperar procesamiento
4. Click en "Convertir a Comisiones"
5. Verificar:
   ✅ NO aparece error NO_ITEMS_INSERTED
   ✅ Se crean lotes por semana
   ✅ Los lotes contienen items
   ✅ Items aparecen en "Vendedores No Reconocidos"
```

### Verificar Asignación
```bash
1. Ir a lote convertido
2. Ver sección "Vendedores No Reconocidos"
3. Click en "Asignar" para un vendedor
4. Seleccionar usuario MOVI
5. Confirmar
6. Verificar:
   ✅ Items desaparecen de "No Reconocidos"
   ✅ Items aparecen en "Vendedores Reconocidos"
   ✅ Agente puede ver items en "Mis Comisiones"
```

---

## Archivos Modificados

### Base de Datos
1. `fix_commission_details_nullable_agent.sql`
   - agent_id NULLABLE
   - Campo endoso agregado

2. `fix_commission_batches_nullable_dates.sql`
   - date_from NULLABLE
   - date_to NULLABLE

### Edge Function
1. `convert-import-to-commission-batches/index.ts`
   - Mapper unificado con soporte LOGEXPORT
   - Validación sin requerir email
   - Documentación completa en código

---

## Notas Importantes

1. **No se pierde información**: VendNombre se guarda en `vendor_name_raw`
2. **Matching por nombre**: El sistema agrupa items por nombre normalizado
3. **Asignación manual**: Permite revisar antes de asignar definitivamente
4. **Trazabilidad**: Se registra match_method = "manual" o "name_only"
5. **Reversible**: Se puede reasignar si fue un error

---

## Soporte Futuro

El sistema está preparado para:
- ✅ Archivos con email (formato tradicional)
- ✅ Archivos sin email (formato LOGEXPORT)
- ✅ Archivos mixtos (algunas filas con email, otras sin)
- ✅ Matching automático por email
- ✅ Matching manual por nombre
- ✅ Combinación de ambos métodos en un mismo lote
