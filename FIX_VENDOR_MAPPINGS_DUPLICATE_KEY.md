# Fix: Error de Duplicado en vendor_mappings

## 🐛 Error Original

```
Error al guardar el mapeo: Error al crear mapeo: duplicate key value violates unique constraint "vendor_mappings_source_type_source_value_key"
```

## 🔍 Causa Raíz

El constraint UNIQUE en `vendor_mappings(source_type, source_value)` era **GLOBAL** (aplicaba a todos los registros), lo que impedía:

1. ✗ Reasignar un vendedor que ya había sido mapeado anteriormente
2. ✗ Mantener histórico de mapeos (todos activos/inactivos)
3. ✗ Cambiar la asignación de un vendedor

### Ejemplo del Problema

```sql
-- ✓ Primera asignación funcionaba
INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status)
VALUES ('name', 'castanon navarro samuel', 'user-1', 'active');

-- ✗ Desactivar y reasignar FALLABA
UPDATE vendor_mappings SET status = 'inactive' WHERE ...;
INSERT INTO vendor_mappings (source_type, source_value, movi_user_id, status)
VALUES ('name', 'castanon navarro samuel', 'user-2', 'active');
-- ERROR: duplicate key constraint
```

## ✅ Solución Implementada

### 1. Constraint UNIQUE Parcial

**Antes:**
```sql
UNIQUE (source_type, source_value)  -- Aplica a TODOS los registros
```

**Después:**
```sql
CREATE UNIQUE INDEX idx_vendor_mappings_unique_active_source
  ON vendor_mappings(source_type, source_value)
  WHERE status = 'active';  -- Solo aplica a registros ACTIVOS
```

**Beneficios:**
- ✅ Permite múltiples registros INACTIVOS del mismo vendedor (histórico)
- ✅ Garantiza solo 1 mapeo ACTIVO por vendedor
- ✅ Permite reasignar vendedores

### 2. Actualización de Código Frontend

**Función `crearVendorMapping()` en `vendorMappingUtils.ts`:**

```typescript
export async function crearVendorMapping(mapping, userId) {
  // PASO 1: Desactivar mapeo activo existente con el mismo source
  await supabase
    .from('vendor_mappings')
    .update({ status: 'inactive', updated_by: userId })
    .eq('source_type', mapping.source_type)
    .eq('source_value', mapping.source_value)
    .eq('status', 'active');

  // PASO 2: Desactivar cualquier otro mapeo activo del usuario
  await supabase
    .from('vendor_mappings')
    .update({ status: 'inactive', updated_by: userId })
    .eq('movi_user_id', mapping.movi_user_id)
    .eq('status', 'active');

  // PASO 3: Crear nuevo mapeo activo
  const { data, error } = await supabase
    .from('vendor_mappings')
    .insert({ ...mapping, status: 'active' });
}
```

### 3. Actualización de Funciones de Base de Datos

**`assign_vendor_manually()`:**
- Desactiva mapeos existentes ANTES de insertar
- Inserta nuevo mapeo sin `ON CONFLICT`

**`apply_vendor_mappings_to_batch()`:**
- Actualizado para usar `usuario_id` en lugar de `agent_id`
- Consistente con la eliminación de `commission_agents`

## 📊 Estado Final

### Constraint Verificado
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'vendor_mappings'
  AND indexname ILIKE '%source%';
```

| Index Name | Definition |
|------------|------------|
| `idx_vendor_mappings_unique_active_source` | `UNIQUE (source_type, source_value) WHERE status = 'active'` |

### Comportamiento Esperado

| Escenario | Antes | Después |
|-----------|-------|---------|
| Primera asignación | ✓ Funciona | ✓ Funciona |
| Reasignar vendedor | ✗ Error duplicado | ✓ Funciona |
| Histórico de mapeos | ✗ Imposible | ✓ Mantiene histórico |
| Múltiples inactivos | ✗ Error duplicado | ✓ Permitido |
| Múltiples activos | ✗ Error duplicado | ✗ Bloqueado (correcto) |

## 🚀 Migraciones Aplicadas

1. **`20260122050000_unify_commission_agents_with_usuarios.sql`**
   - Unificó `commission_agents` con `usuarios`
   - Eliminó tabla `commission_agents`
   - Agregó `usuarios.id_sicas`

2. **`20260122060000_fix_vendor_mappings_unique_constraint_partial.sql`**
   - Eliminó constraint UNIQUE global
   - Creó constraint UNIQUE parcial (solo activos)

3. **`20260122070000_fix_assign_vendor_manually_for_partial_unique.sql`**
   - Actualizó función para desactivar mapeos antes de insertar
   - Usa `usuario_id` en lugar de `agent_id`

4. **`20260122080000_fix_apply_vendor_mappings_use_usuario_id.sql`**
   - Actualizó función para usar `usuario_id`
   - Consistente con eliminación de `commission_agents`

## 🎯 Resultado

✅ **Error resuelto completamente**

Ahora puedes:
- Reasignar vendedores sin errores
- Mantener histórico completo de mapeos
- Cambiar asignaciones cuando sea necesario
- Sistema más flexible y mantenible

---

**Fecha:** 22 de Enero 2026
**Estado:** ✅ Resuelto y Probado
