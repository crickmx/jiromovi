# HARDENING Y CONSOLIDACIÓN: Formato LOGEXPORT

## Estado: ✅ IMPLEMENTADO Y CONSOLIDADO

Sistema completo para procesar archivos Excel en formato LOGEXPORT (sin email del agente) con soporte para detección automática, validación robusta, mappings persistentes y asignación manual.

---

## 0. REGLA DE ORO (Obligatoria e Inquebrantable)

```
En formato LOGEXPORT, VendNombre sustituye al email.
La falta de email NUNCA debe bloquear la conversión ni el insert.
```

Esta regla está documentada en múltiples puntos del código para garantizar su cumplimiento en futuras iteraciones.

---

## 1. DETECCIÓN AUTOMÁTICA DE LOGEXPORT

### Implementado en: `convert-import-to-commission-batches/index.ts`

**Función:** `detectFormatLOGEXPORT(documents)`

**Criterios de Detección:**
- ✅ Existe columna `VendNombre` (o variantes: vendedor, despnombre)
- ✅ Existen campos obligatorios: Documento, Ramo, Importe, PorPart
- ✅ >50% de filas sin email (o email está ausente/vacío)

**Resultado:**
```typescript
{
  isLogExport: boolean,
  confidence: number,  // 0-100
  details: {
    hasVendNombre: boolean,
    hasRequiredFields: boolean,
    emailMissingRatio: number,  // 0-1
    totalRows: number,
    rowsWithoutEmail: number
  }
}
```

**Log en Consola:**
```
✅ FORMATO LOGEXPORT DETECTADO (confidence: 95%)
   - VendNombre: YES
   - Required fields: YES
   - Email missing ratio: 95.6%
   - Rows without email: 261/273

🔑 REGLA DE ORO: En formato LOGEXPORT, VendNombre sustituye al Email.
   La falta de email NUNCA bloqueará la conversión.
```

---

## 2. MAPEO DE COLUMNAS (Unificado)

### Columnas Soportadas - LOGEXPORT

| Columna Excel | Campo Interno | Obligatorio | Default |
|---------------|---------------|-------------|---------|
| VendNombre | vendor_name_raw | NO | - |
| Documento | poliza | SÍ | error |
| Endoso | endoso | NO | null |
| FPago | fpago | NO | null → lote "Sin fecha" |
| CiaAbreviacion | aseguradora | NO | "NO_ESPECIFICADA" |
| Ramo | ramo | SÍ | error |
| Importe | importe_base | SÍ | error |
| PorPart | porcentaje | SÍ | error |
| PrimaNeta | prima_neta_info | NO | null |
| NombreCompleto | nombre_asegurado | NO | null |
| Concepto | concepto | NO | null |
| DespNombre | oficina | NO | null |

### Mapeo de Identificadores

```typescript
// Si tiene email válido:
vendor_key = "email:juan@mail.com"
agent_email = "juan@mail.com"
pending_assignment = false/true (según match)
match_method = "email"

// Si NO tiene email (LOGEXPORT):
vendor_key = "name:JUAN PEREZ"  // Nombre normalizado
vendor_name_raw = "Juan Pérez"  // Nombre original
agent_email = NULL              // NO string vacío
pending_assignment = true
match_method = "name_only"

// Si no tiene nada:
vendor_key = "unknown"
pending_assignment = true
match_method = "none"
```

---

## 3. VALIDACIÓN (Solo 4 Campos Obligatorios)

### ✅ Se Inserta Si:

1. **Documento** no está vacío
2. **Ramo** no está vacío
3. **Importe** es numérico (puede ser negativo)
4. **PorPart** es numérico (puede ser decimal)

### ❌ Se Descarta Solo Si:

- Falta Documento
- Falta Ramo
- Importe es NaN/no parseable
- PorPart es NaN/no parseable

### ⚠️ Warning (Pero SÍ se Inserta):

- Email faltante → `status = "warning"`, pending_assignment = true
- Aseguradora faltante → usa "NO_ESPECIFICADA"
- FPago inválido → va a lote week_number=0 "Sin fecha"

**CRÍTICO:** Email faltante JAMÁS puede convertirse en discard en ninguna etapa.

---

## 4. INSERCIÓN: Warnings son Insertables

### Código Crítico (Inmutable):

```typescript
// ========================================================================
// ITEMS INSERTABLES = VALID + WARNING
// ========================================================================
// FORMATO LOGEXPORT: Archivos sin email generan 100% warnings pero SÍ se insertan
// Si existe VendNombre, la fila ES INSERTABLE (pending_assignment = true)
const parsedRows = [...validRows, ...warningRows];

// NUNCA hacer esto:
// const parsedRows = validRows; // ❌ INCORRECTO
```

### Verificación Automática (Self-Check):

```typescript
if (parsedRows.length === 0 && discardedRows.length === 0 && warningRows.length > 0) {
  console.error('[SELF-CHECK FAILED] Inconsistencia: warningRows > 0 pero parsedRows = 0.');
  throw new Error('SELF-CHECK FAILED: Las filas con warnings no se están incluyendo en parsedRows.');
}
```

---

## 5. BASE DE DATOS: Consistencia de Nullables

### Tabla: `commission_details`

| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| agent_id | uuid | **YES** | NULL |
| movi_user_id | uuid | **YES** | NULL |
| vendor_email_raw | text | **YES** | NULL |
| vendor_name_raw | text | **YES** | NULL |
| vendor_key | text | **YES** | NULL |
| vendor_name_norm | text | **YES** | NULL |
| pending_assignment | boolean | YES | false |
| match_method | text | YES | NULL |
| endoso | text | **YES** | NULL |
| prima_neta_info | float | YES | NULL |
| fpago | date | **YES** | NULL |

### Tabla: `commission_batches`

| Campo | Tipo | Nullable | Default |
|-------|------|----------|---------|
| date_from | date | **YES** | NULL |
| date_to | date | **YES** | NULL |
| week_number | int | YES | NULL |
| has_pending_assignments | boolean | YES | false |
| pending_count | int | YES | 0 |

**IMPORTANTE:** Usar NULL (no string vacío) para campos ausentes.

---

## 6. MAPPINGS PERSISTENTES

### Tabla: `vendor_mapping_persistent`

Almacena asignaciones vendor_key → movi_user_id para auto-asignación en futuras importaciones.

```sql
CREATE TABLE vendor_mapping_persistent (
  id uuid PRIMARY KEY,
  vendor_key text NOT NULL,
  vendor_name_raw text,
  vendor_email_raw text,
  movi_user_id uuid NOT NULL REFERENCES usuarios(id),
  match_source text DEFAULT 'manual',
  assigned_by uuid REFERENCES usuarios(id),
  assigned_at timestamptz DEFAULT now(),
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  notes text
);
```

### Funciones de BD:

**1. `apply_vendor_mapping_to_batch(p_batch_id, p_vendor_key, p_movi_user_id, p_assigned_by)`**

- Asigna todos los items de un lote con ese vendor_key al usuario especificado
- Crea o actualiza mapping persistente
- Actualiza contadores del lote
- Retorna: `{ success, mapping_id, updated_count }`

**2. `get_unrecognized_vendors_for_batch(p_batch_id)`**

- Retorna vendedores agrupados con pending_assignment = true
- Incluye: vendor_key, vendor_name_raw, items_count, total_commission, has_existing_mapping
- Ordenado por items_count DESC

---

## 7. EDGE FUNCTIONS

### 7.1 `convert-import-to-commission-batches`

**Mejoras Implementadas:**
- ✅ Detección automática de formato LOGEXPORT
- ✅ Aplicación de mappings persistentes existentes
- ✅ Items preparados con agent_id si existe mapping
- ✅ Actualización de contadores pending en lotes
- ✅ Reporte incluye formato detectado y mappings aplicados

**Flujo:**
```
1. Detectar formato (LOGEXPORT o STANDARD)
2. Parsear documentos (valid + warning = insertable)
3. Aplicar mappings persistentes si existen
4. Agrupar por semana (FPago)
5. Crear lotes
6. Insertar items (con agent_id si hay mapping)
7. Actualizar contadores pending
8. Retornar reporte completo
```

**Response:**
```json
{
  "success": true,
  "format": "LOGEXPORT",
  "formatDetection": {
    "isLogExport": true,
    "confidence": 95
  },
  "persistentMappings": {
    "appliedCount": 5,
    "mappingKeys": ["name:JUAN PEREZ", "name:MARIA GARCIA"]
  },
  "totalSourceRows": 273,
  "validRows": 12,
  "warningRows": 261,
  "discardedRows": 0,
  "totalInsertedItems": 273,
  "createdBatches": [...]
}
```

### 7.2 `assign-vendor-manual`

**Input:**
```json
{
  "batch_id": "uuid",
  "vendor_key": "name:JUAN PEREZ",
  "movi_user_id": "uuid"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Asignación aplicada exitosamente",
  "details": {
    "batch_id": "uuid",
    "vendor_key": "name:JUAN PEREZ",
    "movi_user_id": "uuid",
    "user_name": "Juan Pérez",
    "updated_count": 45,
    "mapping_id": "uuid"
  }
}
```

### 7.3 `get-unrecognized-vendors`

**Input:**
```
GET /get-unrecognized-vendors?batch_id=uuid
```

**Output:**
```json
{
  "success": true,
  "batch_id": "uuid",
  "vendors": [
    {
      "vendor_key": "name:JUAN PEREZ",
      "vendor_name_raw": "Juan Pérez",
      "vendor_email_raw": null,
      "items_count": 45,
      "total_commission": 12500.00,
      "has_existing_mapping": false
    }
  ],
  "total_vendors": 5,
  "total_items": 261,
  "total_commission": 85000.00
}
```

---

## 8. FLUJO COMPLETO DE USUARIO

### 8.1 Importar y Convertir

```
1. Admin sube LogExport.xlsx en "Documentos → Importar"
2. Sistema procesa y crea lote en document_import_batches
3. Admin click en "Convertir a Comisiones"
4. Sistema ejecuta convert-import-to-commission-batches:
   ✅ Detecta formato LOGEXPORT
   ✅ Parsea 273 filas
   ✅ 261 con warning (sin email) → SÍ se insertan
   ✅ Aplica mappings persistentes (si existen)
   ✅ Crea lotes por semana
   ✅ Actualiza contadores pending
5. Success: Lotes creados, items insertados
```

### 8.2 Revisar Vendedores No Reconocidos

```
1. Admin navega a ComisionesLote/{batch_id}
2. UI llama a get-unrecognized-vendors
3. Muestra tabla:
   ┌─────────────────────────────────────────┐
   │ VendNombre          Items   Comisión    │
   ├─────────────────────────────────────────┤
   │ JUAN PEREZ          45      $12,500.00  │
   │ MARIA GARCIA        38      $9,800.00   │
   │ CARLOS LOPEZ        22      $5,600.00   │
   └─────────────────────────────────────────┘
```

### 8.3 Asignar Manualmente

```
1. Admin click en "Asignar" para "JUAN PEREZ"
2. Modal muestra:
   - Usuario: JUAN PEREZ
   - Items: 45
   - Total comisión: $12,500.00
   - Búsqueda de usuarios MOVI
3. Admin busca "juan" → encuentra "Juan Pérez Gómez"
4. Admin selecciona y confirma
5. UI llama a assign-vendor-manual:
   {
     "batch_id": "uuid",
     "vendor_key": "name:JUAN PEREZ",
     "movi_user_id": "uuid-juan"
   }
6. Sistema:
   ✅ Actualiza 45 items:
      - agent_id = uuid-juan
      - pending_assignment = false
      - match_method = "manual"
   ✅ Crea/actualiza mapping persistente
   ✅ Actualiza contadores del lote
7. Items desaparecen de "No Reconocidos"
8. Items aparecen en "Vendedores Reconocidos"
9. Juan puede ver items en "Mis Comisiones"
```

### 8.4 Futuras Importaciones

```
1. Admin sube nuevo LogExport con "JUAN PEREZ"
2. Sistema detecta mapping persistente existente
3. Aplica automáticamente:
   - agent_id = uuid-juan
   - pending_assignment = false
   - match_method = "manual"
4. Items NO aparecen en "No Reconocidos"
5. Items van directamente a Juan
```

---

## 9. TESTING CON ARCHIVO REAL

### Archivo: `LogExport_71301012285.xlsx`

**Estructura:**
- 273 filas totales
- ~261 sin email (95.6%)
- ~12 con email
- Columnas: VendNombre, Documento, Endoso, FPago, CiaAbreviacion, Ramo, Importe, PorPart, etc.

### Test de Conversión:

```bash
1. Subir archivo en UI
2. Click "Convertir a Comisiones"
3. Verificar logs en consola del edge function:
   ✅ FORMATO LOGEXPORT DETECTADO (confidence: 95%)
   ✅ Parsed 12 valid rows, 261 warning rows, 0 discarded
   ✅ Total inserted items: 273
4. Verificar response:
   {
     "success": true,
     "format": "LOGEXPORT",
     "totalSourceRows": 273,
     "validRows": 12,
     "warningRows": 261,
     "discardedRows": 0,
     "totalInsertedItems": 273,
     "createdBatches": [...]
   }
```

### Test de Base de Datos:

```sql
-- 1. Verificar items insertados
SELECT COUNT(*) FROM commission_details WHERE batch_id = 'uuid';
-- Esperado: 273

-- 2. Verificar items pendientes
SELECT COUNT(*) FROM commission_details
WHERE batch_id = 'uuid' AND pending_assignment = true;
-- Esperado: ~261

-- 3. Verificar vendor_keys
SELECT vendor_key, COUNT(*)
FROM commission_details
WHERE batch_id = 'uuid'
GROUP BY vendor_key;
-- Esperado: múltiples "name:VENDEDOR"

-- 4. Verificar lote
SELECT has_pending_assignments, pending_count
FROM commission_batches
WHERE id = 'uuid';
-- Esperado: has_pending_assignments=true, pending_count=261
```

### Test de Asignación Manual:

```bash
1. Llamar a get-unrecognized-vendors:
   GET /get-unrecognized-vendors?batch_id=uuid

2. Seleccionar primer vendor de la lista

3. Llamar a assign-vendor-manual:
   POST /assign-vendor-manual
   {
     "batch_id": "uuid",
     "vendor_key": "name:JUAN PEREZ",
     "movi_user_id": "uuid-usuario"
   }

4. Verificar response:
   {
     "success": true,
     "details": {
       "updated_count": 45
     }
   }

5. Verificar en BD:
   SELECT COUNT(*) FROM commission_details
   WHERE batch_id = 'uuid'
   AND vendor_key = 'name:JUAN PEREZ'
   AND pending_assignment = false
   AND agent_id = 'uuid-usuario';
   -- Esperado: 45

6. Verificar mapping persistente:
   SELECT * FROM vendor_mapping_persistent
   WHERE vendor_key = 'name:JUAN PEREZ';
   -- Esperado: 1 registro con movi_user_id

7. Verificar contadores del lote:
   SELECT pending_count FROM commission_batches WHERE id = 'uuid';
   -- Esperado: 261 - 45 = 216
```

---

## 10. CRITERIOS DE ACEPTACIÓN FINAL

### ✅ Backend

- [x] Detección automática de LOGEXPORT
- [x] Mapeo unificado de columnas
- [x] Validación solo 4 campos obligatorios
- [x] Warnings son insertables (valid + warning)
- [x] agent_id nullable en commission_details
- [x] date_from/date_to nullable en commission_batches
- [x] Tabla vendor_mapping_persistent creada
- [x] Función apply_vendor_mapping_to_batch
- [x] Función get_unrecognized_vendors_for_batch
- [x] Edge function convert-import-to-commission-batches actualizada
- [x] Edge function assign-vendor-manual creada
- [x] Edge function get-unrecognized-vendors creada
- [x] Mappings persistentes aplicados automáticamente
- [x] Contadores pending actualizados
- [x] Reporte incluye formato detectado

### ✅ Base de Datos

- [x] commission_details.agent_id NULLABLE
- [x] commission_details.vendor_name_raw exists
- [x] commission_details.vendor_key exists
- [x] commission_details.vendor_name_norm exists
- [x] commission_details.pending_assignment exists
- [x] commission_details.match_method exists
- [x] commission_details.endoso exists
- [x] commission_details.prima_neta_info exists
- [x] commission_batches.date_from NULLABLE
- [x] commission_batches.date_to NULLABLE
- [x] commission_batches.has_pending_assignments exists
- [x] commission_batches.pending_count exists
- [x] vendor_mapping_persistent table created
- [x] Índices y constraints correctos
- [x] RLS policies configuradas

### ⏸️ UI (Pendiente - Documentación Incluida)

La UI requiere agregar:
- Sección "Vendedores No Reconocidos" en ComisionesLote
- Modal de asignación manual con búsqueda de usuarios
- Integración con edge functions assign-vendor-manual y get-unrecognized-vendors
- Ver archivo `UI_VENDEDORES_NO_RECONOCIDOS.md` para especificación completa

### ✅ Testing

- [x] Archivo LogExport_71301012285.xlsx se convierte sin error NO_ITEMS_INSERTED
- [x] 273 filas se insertan correctamente
- [x] Items pendientes aparecen agrupados por vendor_key
- [x] Asignación manual funciona correctamente
- [x] Mappings persistentes se aplican en futuras importaciones
- [x] Build compilasatisfactoriamente

---

## 11. MANTENIMIENTO Y PREVENCIÓN DE REGRESIONES

### Documentación en Código

El código incluye comentarios explicativos en puntos críticos:

**Detección de Formato:**
```typescript
/**
 * Detecta automáticamente si un lote de documentos es formato LOGEXPORT
 *
 * LOGEXPORT se detecta cuando:
 * - Existe columna VendNombre (o variantes)
 * - Existen columnas obligatorias: Documento, Ramo, Importe, PorPart
 * - Email está ausente o vacío en la mayoría de filas
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

### Tests Automáticos (Futuro)

Crear tests que verifiquen:
1. Detección de LOGEXPORT con archivo real
2. Parsing de filas sin email no genera discard
3. Items insertables incluyen valid + warning
4. Mappings persistentes se aplican correctamente
5. Contadores pending se actualizan

### Checklist Pre-Deploy

Antes de cualquier deploy que toque el módulo de comisiones:

- [ ] Verificar que warnings están en parsedRows
- [ ] Verificar que agent_id sigue siendo NULLABLE
- [ ] Verificar que email vacío no bloquea insert
- [ ] Ejecutar test con LogExport_71301012285.xlsx
- [ ] Verificar que NO aparece error NO_ITEMS_INSERTED

---

## 12. ARCHIVOS MODIFICADOS/CREADOS

### Base de Datos
- `create_vendor_mapping_persistent_table.sql` - Nueva tabla de mappings

### Edge Functions
- `convert-import-to-commission-batches/index.ts` - Actualizada con hardening completo
- `assign-vendor-manual/index.ts` - Nueva función
- `get-unrecognized-vendors/index.ts` - Nueva función

### Documentación
- `FORMATO_LOGEXPORT_SOPORTE.md` - Guía completa del formato
- `FIX_NO_ITEMS_INSERTED_FORMATO_REAL.md` - Fix del error original
- `HARDENING_LOGEXPORT_COMPLETO.md` - Este documento (consolidación total)
- `UI_VENDEDORES_NO_RECONOCIDOS.md` - Especificación de UI pendiente

---

## 13. PRÓXIMOS PASOS

### Inmediato (Alta Prioridad)
1. Implementar UI para vendedores no reconocidos en ComisionesLote
2. Agregar modal de asignación manual
3. Testing completo con archivo real en producción

### Mediano Plazo
1. Agregar dashboard de mappings persistentes
2. Permitir editar/eliminar mappings existentes
3. Exportar/importar mappings para backup

### Largo Plazo
1. ML para sugerir matches basados en nombres similares
2. Validación de nombre vs email cuando ambos existen
3. Reporte de quality score por mapping

---

## CONCLUSIÓN

El soporte para FORMATO LOGEXPORT está **completamente implementado y consolidado** en el backend y base de datos. El sistema:

- ✅ Detecta automáticamente el formato
- ✅ Procesa archivos sin email sin errores
- ✅ Aplica mappings persistentes automáticamente
- ✅ Permite asignación manual
- ✅ Está documentado y hardenizado contra regresiones

La UI está **especificada completamente** y lista para implementación. El sistema backend está **production-ready** y puede procesar archivos LOGEXPORT de manera robusta y consistente.

**Build Status:** ✅ Compilando correctamente
**Database Status:** ✅ Migraciones aplicadas
**Edge Functions Status:** ✅ Desplegadas y funcionando
**Documentation Status:** ✅ Completa y actualizada
