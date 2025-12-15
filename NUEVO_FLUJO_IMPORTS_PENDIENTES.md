# Nueva Funcionalidad: Conversión a Lotes con Documentos Pendientes

## Cambio Implementado

El módulo "Importar documentos desde Excel" ahora **permite convertir a lotes de comisiones aunque existan documentos sin usuario asignado**.

### Antes

- Bloqueaba conversión si había documentos sin asignar
- Mostraba: "Debes asignar todos los vendedores antes de poder convertir"
- Estado: `needs_mapping` (amarillo)

### Ahora

- Permite conversión SIEMPRE (si el Excel está procesado correctamente)
- Documentos sin usuario se marcan como **pendientes** dentro del lote
- Se pueden asignar usuarios DESPUÉS de la conversión
- Los lotes pueden cerrarse solo cuando NO hay pendientes

---

## 1. Cambios en Base de Datos

### Nuevas columnas en `commission_details`

```sql
-- Control de asignación
pending_assignment BOOLEAN DEFAULT false
assignment_status TEXT CHECK (assigned, unassigned)
vendor_group_key TEXT -- Para agrupar documentos del mismo vendedor

-- agent_id ahora permite NULL cuando pending_assignment=true
```

### Nuevas columnas en `commission_batches`

```sql
has_pending_assignments BOOLEAN DEFAULT false
pending_count INT DEFAULT 0
```

### Trigger automático

Los contadores se actualizan automáticamente al cambiar `pending_assignment` o `assignment_status` en los detalles.

---

## 2. Lógica de Validación (Backend)

### Función `validate_batch_for_conversion`

**ANTES bloqueaba por:**
- Documentos sin usuario asignado ❌

**AHORA solo bloquea por:**
- Batch ya convertido
- No hay documentos
- **Faltan fechas (esto SÍ bloquea)** ❌

**Documentos sin usuario:**
- Se muestra como **advertencia** (warnings)
- NO bloquea la conversión

---

## 3. Función `calculate_batch_status_v2`

**Cambio crítico:**

```sql
-- ANTES:
IF unmatched_docs > 0 THEN
  RETURN 'needs_mapping'; -- Bloqueaba

-- AHORA:
IF unmatched_docs > 0 THEN
  RETURN 'ready_to_convert'; -- Permite conversión
```

Todos los batches con fechas válidas → `ready_to_convert`

---

## 4. Edge Function: `convert-import-to-commissions`

### Cambios principales

1. **Obtiene TODOS los documentos** (incluidos sin usuario):
```typescript
.eq("batch_id", batch_id) // Ya NO filtra is_unmatched=false
```

2. **Si tiene usuario asignado:**
   - Busca o crea `commission_agent`
   - `pending_assignment = false`
   - `assignment_status = "assigned"`

3. **Si NO tiene usuario asignado:**
   - `agent_id = null`
   - `pending_assignment = true`
   - `assignment_status = "unassigned"`
   - Genera `vendor_group_key` para poder agrupar después:
     - Por email: `email:vendedor@ejemplo.com`
     - Por nombre: `name:juan perez`
     - Sin info: `unknown:{doc_id}`

4. **Copia información del vendedor:**
```typescript
vendor_name_raw: doc.vendor_name_raw
vendor_email_raw: doc.vendor_email_raw
```

5. **Cuenta pendientes por lote:**
```typescript
pending_count: (SELECT COUNT(*) WHERE pending_assignment = true)
```

---

## 5. Interfaz de Usuario

### DocumentosImportar.tsx

**Banner actualizado:**
```tsx
{selectedBatch.records_unmatched > 0 ? (
  "Hay X documentos sin asignación. Podrás asignarlos dentro del lote después de convertir."
) : (
  "Todos los documentos tienen usuarios asignados..."
)}
```

**Botón "Convertir en lote":**
- Siempre habilitado cuando `status = 'ready_to_convert'`
- NO se deshabilita por documentos sin asignar

### ConvertirLoteModal.tsx

**Resumen mejorado:**
- Muestra total documentos
- Desglosa: X asignados / Y pendientes
- Color verde para asignados, naranja para pendientes

**Advertencias en azul (no amarillo):**
- Cambio de tono: información importante vs. bloqueante
- Mensaje: "Hay X documentos sin usuario... Podrás asignarlos dentro del lote"

**Banner importante:**
```
"Esta acción creará lotes... Los documentos sin asignar estarán
disponibles en el lote para asignarles usuarios antes de cerrarlo."
```

---

## 6. Dentro del Lote (TODO - Pendiente Implementación)

### Sección "Pendientes por asignar"

En la vista del lote de comisiones debe existir:

1. **Banner de alerta:**
   ```
   ⚠️ Este lote tiene X documentos sin usuario asignado.
   ```

2. **Tabla agrupada por vendedor:**
   - Agrupar por `vendor_group_key`
   - Mostrar: Vendedor detectado | Documentos | Pólizas
   - Botón "Asignar usuario" por grupo

3. **Modal de asignación:**
   - Seleccionar usuario MOVI (con autocompletado)
   - Checkbox: "Guardar mapeo para futuros lotes"
   - Al confirmar:
     - Actualiza `movi_user_id`
     - `pending_assignment = false`
     - `assignment_status = "assigned"`
     - Guarda mapeo en `vendor_mappings`

4. **Restricción para cierre:**
   - Bloquear botón "Cerrar lote" si `has_pending_assignments = true`
   - Mensaje: "No puedes cerrar el lote hasta asignar los X documentos pendientes"
   - Permitir: visualización, cálculos parciales, exportes

---

## 7. Flujo Completo (Usuario)

### Paso 1: Subir Excel
- Usuario sube archivo con documentos
- Sistema detecta vendedores automáticamente
- Algunos NO se reconocen → quedan sin asignar

### Paso 2: Ver detalle del import
- Total: 500 documentos
- Reconocidos: 480
- Sin reconocer: 20

### Paso 3: Convertir (SIN BLOQUEO)
- Usuario da clic en "Convertir a Lotes"
- Modal muestra:
  - Total: 500 docs
  - Asignados: 480
  - Pendientes: 20
  - Advertencia: "Podrás asignarlos dentro del lote"
- Usuario confirma

### Paso 4: Lotes creados
- Se crean 2 lotes por semana
- Semana 50: 300 docs (15 pendientes)
- Semana 51: 200 docs (5 pendientes)

### Paso 5: Dentro del lote (Semana 50)
- Banner: "⚠️ Este lote tiene 15 documentos sin usuario"
- Sección "Pendientes por asignar":
  - Grupo 1: "Juan Pérez" | 8 docs | [Asignar]
  - Grupo 2: "Sin información" | 7 docs | [Asignar]

### Paso 6: Asignar usuarios
- Usuario asigna "Juan Pérez" → José García (MOVI)
- Guarda mapeo: ✅
- Repite para otros grupos

### Paso 7: Cerrar lote
- Una vez sin pendientes, puede cerrar y notificar

---

## 8. Ventajas del Nuevo Flujo

1. **No bloquea el proceso:**
   - Permite avanzar aunque falten asignaciones
   - Reduce fricción en el flujo

2. **Contexto completo:**
   - Usuario ve los lotes por semana primero
   - Asigna con contexto de fechas y montos

3. **Flexibilidad:**
   - Puede asignar después
   - Puede procesar lotes parcialmente
   - Puede exportar reportes incluso con pendientes

4. **Trazabilidad:**
   - `vendor_group_key` permite agrupar inteligentemente
   - Mapeos se guardan para futuros imports

5. **Seguridad:**
   - Lotes NO se pueden cerrar con pendientes
   - Garantiza que todo se procese correctamente

---

## 9. Reglas de Negocio

### ✅ Permitido

- Convertir import con documentos sin asignar
- Ver lotes con pendientes
- Calcular comisiones de documentos asignados
- Exportar reportes parciales
- Ajustar comisiones de docs asignados

### ❌ Bloqueado

- Cerrar lote con `has_pending_assignments = true`
- Generar PDF "Orden de Pago" final con pendientes
- Enviar notificaciones a agentes con pendientes

### 🔄 Automático

- Actualización de contadores en batch
- Recálculo de `has_pending_assignments`
- Trigger de actualización de estados

---

## 10. Casos Edge

### Excel sin vendedor en NINGÚN documento

- Todos los docs: `pending_assignment = true`
- Conversión permitida
- Lote muestra: "Este lote tiene 500 documentos sin usuario"
- Admin asigna todos dentro del lote

### Excel sin fechas

- Conversión **BLOQUEADA**
- Error: "Falta fecha en X documentos. No es posible agrupar por semana"
- Usuario debe corregir Excel y volver a subir

### Import parcialmente convertido

- Batch marcado como `converted`
- NO se puede volver a convertir
- Error: "El batch ya fue convertido anteriormente"

---

## 11. Migraciones Aplicadas

1. `allow_pending_assignments_in_commissions.sql`
   - Agrega columnas a `commission_details`
   - Agrega columnas a `commission_batches`
   - Crea triggers de conteo automático

2. `update_validation_allow_unassigned.sql`
   - Actualiza `validate_batch_for_conversion`
   - Actualiza `calculate_batch_status_v2`
   - Cambia advertencias vs errores

---

## 12. Próximos Pasos (Pendientes)

1. Implementar UI "Pendientes por asignar" dentro del lote
2. Modal de asignación de usuarios en lote
3. Función para asignar en batch por `vendor_group_key`
4. Validación para bloquear cierre con pendientes
5. Estadísticas de pendientes en dashboard
6. Reportes de "Documentos sin asignar" globales

---

## 13. Testing

### Casos de prueba

1. ✅ Import con 100% docs asignados → Conversión normal
2. ✅ Import con 50% sin asignar → Permite conversión
3. ✅ Import sin fechas → Bloquea conversión
4. ✅ Batch ya convertido → Bloquea doble conversión
5. ⏳ Lote con pendientes → Bloquea cierre (pendiente UI)
6. ⏳ Asignar usuario en lote → Actualiza pendientes (pendiente UI)

---

## 14. Documentación Relacionada

- `SISTEMA_MAPEO_VENDEDORES.md` - Sistema de mapeo persistente
- `GUIA_SISTEMA_COMISIONES.md` - Módulo de comisiones completo
- `README_IMPORTANTE.md` - Arquitectura general

---

**Fecha de implementación:** 2025-12-15
**Estado:** Backend completo, UI básica implementada, asignación en lote pendiente
