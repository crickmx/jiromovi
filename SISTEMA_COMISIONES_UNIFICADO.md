# Sistema Unificado de Comisiones

## Resumen

Se ha implementado un sistema unificado que integra completamente "Importar documentos desde Excel" con "Subir Archivo de Comisiones", compartiendo:

- Lógica de reconocimiento de usuarios (matching)
- Mapeos persistentes de vendedores
- Permisos
- Estructura de lotes
- Flujo completo de comisiones

## Componentes Implementados

### 1. UserMatchingService (`src/lib/userMatchingService.ts`)

Servicio compartido que proporciona la lógica única de matching de usuarios:

**Funciones principales:**
- `normalizeEmail(email)` - Normaliza emails a minúsculas y sin espacios
- `normalizeName(name)` - Normaliza nombres eliminando acentos y espacios extras
- `buildVendorKey(email, name)` - Genera clave única para agrupación
- `findUserMatch({vendorEmailRaw, vendorNameRaw})` - Busca coincidencias siguiendo prioridad:
  1. Coincidencia directa por email en `usuarios`
  2. Mapeo guardado por email en `vendor_mappings`
  3. Mapeo guardado por nombre en `vendor_mappings`
  4. Sin coincidencia (retorna null)
- `saveVendorMapping({sourceType, sourceValue, moviUserId})` - Guarda mapeos persistentes

**Regla de prioridad de matching:**
```
1. Direct email match: usuarios.email == vendor_email_norm
2. Email mapping: vendor_mappings(source_type='email', source_value=vendor_email_norm)
3. Name mapping: vendor_mappings(source_type='name', source_value=vendor_name_norm)
4. No match: movi_user_id = null, pending_assignment = true
```

### 2. Migración de Base de Datos

**Archivo:** `supabase/migrations/add_vendor_fields_to_commissions_unified_v2.sql`

**Cambios en `commission_batches`:**
- `source_type`: 'manual_upload' | 'excel_import' | 'api'
- `source_id`: UUID del document_import_batch si aplica
- `week_number`: Número de semana ISO
- `period_start`, `period_end`: Periodo lunes-domingo
- `converted_from_import_at`: Timestamp de conversión
- `converted_by`: Usuario que realizó la conversión

**Cambios en `commission_details`:**
- `vendor_email_raw`, `vendor_email_norm`: Email original y normalizado
- `vendor_name_raw`, `vendor_name_norm`: Nombre original y normalizado
- `vendor_key`: Clave única para agrupación (`email:xxx` o `name:xxx`)
- `match_method`: 'direct_email' | 'mapping_email' | 'mapping_name' | 'none' | 'manual'
- `pending_assignment`: Boolean para identificar pendientes
- `movi_user_id`: Referencia al usuario MOVI (nullable)

**Cambios en `document_import_batches`:**
- `converted_to_commissions`: Boolean
- `converted_at`: Timestamp
- `converted_by`: Usuario que convirtió
- `commission_batch_ids`: Array de UUIDs de lotes creados

**Índices creados:**
- Búsqueda eficiente por vendor_key, vendor_email_norm, vendor_name_norm
- Filtrado rápido de pendientes (pending_assignment)
- Lookup de source_type y source_id

### 3. Edge Function de Conversión

**Archivo:** `supabase/functions/convert-import-to-commission-batches/index.ts`

**Ruta:** `POST /functions/v1/convert-import-to-commission-batches/{batchId}`

**Proceso:**
1. Valida que el batch no esté ya convertido
2. Obtiene todos los documentos del import
3. Agrupa por semana calendario (lunes-domingo) usando `fecha_fpago` o fecha similar
4. Crea un `commission_batch` por cada semana con:
   - Nombre descriptivo: "Semana X (YYYY-MM-DD a YYYY-MM-DD)"
   - `source_type = 'excel_import'`
   - `source_id = batchId`
   - Status inicial: 'draft'
5. Inserta `commission_details` copiando:
   - Todos los campos vendor_* (raw, norm, key)
   - `movi_user_id` del documento (puede ser null)
   - `match_method` del documento
   - `pending_assignment = true` si no tiene usuario asignado
   - Campos de póliza (ramo, aseguradora, prima, comisión, etc.)
6. Marca el import batch como convertido

**Response:**
```json
{
  "success": true,
  "message": "Successfully created N commission batch(es)",
  "commission_batch_ids": ["uuid1", "uuid2"],
  "weeks_created": 3
}
```

### 4. UI Actualizada

**Archivo:** `src/pages/DocumentosImportar.tsx`

Ya incluye:
- Botón "Convertir a Lotes" visible cuando el batch está listo (`status === 'ready_to_convert'`)
- Modal de confirmación (`ConvertirLoteModal`) que muestra:
  - Resumen de documentos (total, reconocidos, pendientes)
  - Preview de semanas que se crearán
  - Advertencias si existen documentos sin asignar
- Vista de resultado con tabla de lotes creados
- Links directos para abrir cada lote creado

**Actualización realizada:**
- La función `convertBatchToCommissions` en `documentImportUtils.ts` ahora usa la nueva edge function correcta

## Flujo Completo del Usuario

### 1. Importar documentos desde Excel

```
Usuario → Sube Excel → process-document-import →
  ├─ Extrae filas
  ├─ Usa UserMatchingService.findUserMatch() para cada vendedor
  ├─ Guarda en imported_documents con vendor_* y match_method
  └─ Agrupa reconocidos/no reconocidos
```

### 2. Asignar vendedores no reconocidos (opcional)

```
Usuario → Selecciona vendedor no reconocido → Asigna usuario MOVI →
  ├─ Actualiza imported_documents.movi_user_id
  ├─ Si checkbox "Guardar para futuros":
  │   └─ UserMatchingService.saveVendorMapping()
  └─ Recalcula stats del batch
```

### 3. Convertir a lotes de comisiones

```
Usuario → Click "Convertir a Lotes" →
  ├─ Modal muestra preview por semana
  ├─ Confirma → convert-import-to-commission-batches
  ├─ Se crean N lotes (1 por semana)
  ├─ Cada commission_detail tiene vendor_* completo
  └─ Los pendientes tienen pending_assignment=true
```

### 4. Gestionar lote de comisiones

```
Usuario → Abre lote → Vista de lote de comisiones:
  ├─ Sección "Asignados": Items con movi_user_id != null
  ├─ Sección "Pendientes por asignar": Items con pending_assignment=true
  │   ├─ Agrupados por vendor_key
  │   ├─ Permite asignar usuario
  │   ├─ Checkbox "Guardar para futuros"
  │   └─ Al confirmar: actualiza items + guarda en vendor_mappings
  └─ Validación antes de cerrar: advertir si hay pendientes
```

## Tablas Clave

### vendor_mappings (existente, compartida)

```sql
CREATE TABLE vendor_mappings (
  source_type text CHECK (source_type IN ('email', 'name')),
  source_value text,
  movi_user_id uuid REFERENCES usuarios(id),
  status text DEFAULT 'active',
  UNIQUE(source_type, source_value)
);
```

### commission_batches (actualizada)

Campos nuevos para tracking de origen:
- `source_type`, `source_id`
- `week_number`, `period_start`, `period_end`
- `converted_from_import_at`, `converted_by`

### commission_details (actualizada)

Campos vendor para matching unificado:
- `vendor_email_raw/norm`, `vendor_name_raw/norm`
- `vendor_key`, `match_method`
- `pending_assignment`, `movi_user_id`

### document_import_batches (actualizada)

Campos de conversión:
- `converted_to_commissions`, `converted_at`, `converted_by`
- `commission_batch_ids` (array)

## Beneficios del Sistema Unificado

1. **Aprendizaje Persistente**: Cualquier mapeo creado en cualquier módulo está disponible en todos los demás
2. **Consistencia**: Un solo algoritmo de matching evita discrepancias
3. **Trazabilidad**: Cada commission_detail sabe de dónde vino y cómo se asignó
4. **Flexibilidad**: Los lotes pueden tener mezcla de items asignados y pendientes
5. **Agrupación Inteligente**: Automático por semana, facilita gestión de comisiones periódicas
6. **No Duplicación**: Evita crear comisiones duplicadas del mismo import

## Próximos Pasos Recomendados

### Corto Plazo (Completar sistema)

1. **Actualizar `process-commissions` edge function** para usar UserMatchingService
2. **Actualizar vista de lote** (`ComisionesLote.tsx` o similar) para mostrar:
   - Sección de "Pendientes por asignar"
   - Modal de asignación con vendor_mappings
3. **Actualizar `process-document-import`** para usar UserMatchingService (si no lo usa ya)
4. **Agregar validación** en cierre de lote: advertir si hay pending_assignment=true

### Mediano Plazo (Mejoras UX)

1. **Dashboard de mapeos**: Ver/editar todos los vendor_mappings
2. **Sugerencias inteligentes**: ML para sugerir matches basados en patrones
3. **Reportes**: ¿Cuántos vendors están mapeados? ¿Cuántos pendientes históricos?
4. **Bulk actions**: Asignar múltiples vendors a la vez

### Largo Plazo (Optimizaciones)

1. **Cache de matching**: Evitar lookups repetidos
2. **Validación proactiva**: Alertar si hay vendors nuevos antes de subir
3. **Integración con APIs externas**: Auto-match contra sistemas de aseguradoras
4. **Auditoría avanzada**: Track de quién asignó qué y cuándo

## Testing

Para probar el sistema completo:

1. Importa un Excel con vendedores (algunos con email, algunos sin)
2. Verifica que algunos se reconozcan automáticamente
3. Asigna manualmente los no reconocidos (marca "Guardar para futuros")
4. Convierte a lotes de comisiones
5. Verifica que se crean lotes por semana
6. Abre un lote y confirma que los pendientes aparecen separados
7. Importa otro Excel con los mismos vendedores → deben reconocerse automáticamente

## Notas de Implementación

- Todos los campos `vendor_*` son **opcionales** (nullable) para compatibilidad con datos históricos
- El `vendor_key` permite agrupar eficientemente sin joins complejos
- `match_method` es informativo para auditoría y debugging
- `pending_assignment` simplifica queries (mejor que `WHERE movi_user_id IS NULL`)
- Los índices en vendor_email_norm y vendor_name_norm aceleran lookups
