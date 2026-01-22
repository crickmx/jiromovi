# Sistema Unificado de Mapeo Usuarios MOVI ↔ SICAS

## Resumen

Se ha implementado un sistema unificado para mapear usuarios MOVI con usuarios SICAS, garantizando relaciones **1:1 estrictas** en todos los sistemas.

## 📊 Arquitectura

### Fuente Única de Verdad

**Campo `usuarios.nombre_sicas`** - Almacena el nombre del usuario en SICAS directamente en la tabla usuarios.

```sql
SELECT
  u.id,
  u.nombre_completo as nombre_movi,
  u.nombre_sicas,
  u.email_laboral
FROM usuarios u
WHERE u.nombre_sicas IS NOT NULL;
```

### Relaciones 1:1 Garantizadas

#### 1. **sicas_mapeo_vendedor_usuario**
- Mapeo oficial entre usuarios MOVI y vendedores SICAS
- **UNIQUE constraint en `movi_user_id`** → cada usuario MOVI solo puede tener 1 vendedor SICAS
- **UNIQUE constraint en `id_sicas_vendedor`** → cada vendedor SICAS solo puede tener 1 usuario MOVI
- Se sincroniza automáticamente con `usuarios.nombre_sicas`

```sql
-- Estructura
CREATE TABLE sicas_mapeo_vendedor_usuario (
  id uuid PRIMARY KEY,
  id_sicas_vendedor text UNIQUE NOT NULL,  -- 1:1 con sicas_vendedores
  movi_user_id uuid UNIQUE NOT NULL,       -- 1:1 con usuarios
  mapped_by uuid,
  mapped_at timestamptz
);
```

#### 2. **commission_agents**
- Sistema de comisiones
- **UNIQUE constraint en `usuario_id`** → cada usuario MOVI solo puede tener 1 agente de comisiones
- Link directo a `usuarios(id)`

```sql
-- Estructura
CREATE TABLE commission_agents (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  usuario_id uuid UNIQUE,  -- 1:1 con usuarios
  office_id uuid,
  fiscal_regime_id uuid
);
```

#### 3. **vendor_mappings**
- Mapeos de vendedores no reconocidos (producción)
- **UNIQUE INDEX parcial** → solo 1 mapeo activo por usuario
- Permite múltiples mapeos inactivos (histórico)

```sql
-- Index que garantiza 1:1
CREATE UNIQUE INDEX idx_vendor_mappings_unique_active_user
  ON vendor_mappings(movi_user_id)
  WHERE status = 'active';
```

## 🔄 Sincronización Automática

### Trigger de Sincronización

Cuando se crea o actualiza un mapeo SICAS, se sincroniza automáticamente el campo `usuarios.nombre_sicas`:

```sql
CREATE TRIGGER trigger_sync_nombre_sicas
  AFTER INSERT OR UPDATE ON sicas_mapeo_vendedor_usuario
  FOR EACH ROW
  EXECUTE FUNCTION sync_nombre_sicas_on_mapping();
```

## 📋 Vista Unificada

### vista_mapeo_usuarios_unificado

Vista consolidada que muestra todos los mapeos de un usuario en un solo lugar:

```sql
SELECT * FROM vista_mapeo_usuarios_unificado
WHERE estado_consistencia != 'CONSISTENTE';
```

**Campos:**
- `usuario_id` - ID del usuario MOVI
- `nombre_movi` - Nombre completo en MOVI
- `nombre_sicas` - Nombre en SICAS (fuente de verdad)
- `oficina_nombre` - Oficina del usuario
- `sicas_mapping_id` - ID del mapeo SICAS oficial
- `commission_agent_id` - ID del agente de comisiones
- `estado_mapeo` - Estado general del mapeo
- `estado_consistencia` - Indicador de inconsistencias

**Estados de Consistencia:**
- ✅ `CONSISTENTE` - Todo está bien
- ⚠️ `INCONSISTENTE: nombre_sicas sin mapeo` - Hay nombre_sicas pero no existe mapeo
- ⚠️ `INCONSISTENTE: mapeo sin nombre_sicas` - Hay mapeo pero falta nombre_sicas
- ⚠️ `INCONSISTENTE: nombres no coinciden` - Los nombres no son iguales

## 🛠️ Funciones Helper

### get_user_nombre_sicas(user_id)

Obtiene el nombre SICAS de un usuario desde la fuente unificada:

```sql
SELECT get_user_nombre_sicas('e721d4ed-4ba4-499a-a08c-3b881ff380ea');
```

## 🔒 Garantías del Sistema

### 1. Relación 1:1 Usuario MOVI ↔ Usuario SICAS
✅ Un usuario MOVI solo puede tener 1 usuario SICAS asignado
✅ Un usuario SICAS solo puede estar asignado a 1 usuario MOVI
✅ Enforced por UNIQUE constraints a nivel de base de datos

### 2. Relación 1:1 Usuario MOVI ↔ Commission Agent
✅ Un usuario MOVI solo puede tener 1 agente de comisiones
✅ Enforced por UNIQUE constraint en `commission_agents.usuario_id`

### 3. Vendor Mappings Activos
✅ Un usuario MOVI solo puede tener 1 mapeo de vendedor activo
✅ Permite múltiples mapeos inactivos para histórico
✅ Enforced por UNIQUE INDEX parcial

### 4. Sincronización Automática
✅ `usuarios.nombre_sicas` se actualiza automáticamente desde mapeos SICAS
✅ Trigger ejecutado en cada INSERT/UPDATE de mapeos

## 🎯 Flujo de Trabajo

### Crear Nuevo Mapeo SICAS

```sql
-- 1. Insertar mapeo (el trigger sincroniza automáticamente)
INSERT INTO sicas_mapeo_vendedor_usuario (id_sicas_vendedor, movi_user_id, mapped_by)
VALUES ('VENDEDOR001', 'uuid-del-usuario', auth.uid());

-- 2. Verificar sincronización
SELECT nombre_sicas FROM usuarios WHERE id = 'uuid-del-usuario';
```

### Actualizar Mapeo Existente

```sql
-- Si ya existe un mapeo para el usuario, primero eliminarlo
DELETE FROM sicas_mapeo_vendedor_usuario
WHERE movi_user_id = 'uuid-del-usuario';

-- Luego crear el nuevo mapeo
INSERT INTO sicas_mapeo_vendedor_usuario (...)
VALUES (...);
```

### Buscar Inconsistencias

```sql
-- Ver todos los usuarios con inconsistencias
SELECT
  usuario_id,
  nombre_movi,
  nombre_sicas,
  estado_consistencia
FROM vista_mapeo_usuarios_unificado
WHERE estado_consistencia != 'CONSISTENTE';
```

## 🐛 Resolución de Problemas

### Error: "violates unique constraint"

Si intentas crear un mapeo duplicado:

```
ERROR: duplicate key value violates unique constraint
"sicas_mapeo_vendedor_usuario_movi_user_id_key"
```

**Solución:** Elimina el mapeo existente antes de crear uno nuevo.

### Error: "existen múltiples mapeos"

Si la migración falla por duplicados:

```
ERROR: Existen N usuarios con múltiples mapeos SICAS
```

**Solución:** Revisa y elimina manualmente los mapeos duplicados:

```sql
-- Ver duplicados
SELECT movi_user_id, COUNT(*)
FROM sicas_mapeo_vendedor_usuario
GROUP BY movi_user_id
HAVING COUNT(*) > 1;

-- Eliminar duplicados dejando solo el más reciente
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY movi_user_id ORDER BY mapped_at DESC
  ) as rn
  FROM sicas_mapeo_vendedor_usuario
)
DELETE FROM sicas_mapeo_vendedor_usuario
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

## 📊 Estadísticas

### Ver Mapeos por Tipo

```sql
SELECT
  CASE
    WHEN smu.id IS NOT NULL THEN 'SICAS'
    WHEN ca.id IS NOT NULL THEN 'Comisiones'
    ELSE 'Sin Mapeo'
  END as tipo_mapeo,
  COUNT(*) as cantidad
FROM usuarios u
LEFT JOIN sicas_mapeo_vendedor_usuario smu ON smu.movi_user_id = u.id
LEFT JOIN commission_agents ca ON ca.usuario_id = u.id
WHERE u.deleted_at IS NULL
GROUP BY tipo_mapeo;
```

### Ver Usuarios Sin Mapeo SICAS

```sql
SELECT
  u.id,
  u.nombre_completo,
  u.email_laboral,
  o.nombre as oficina
FROM usuarios u
LEFT JOIN oficinas o ON o.id = u.oficina_id
LEFT JOIN sicas_mapeo_vendedor_usuario smu ON smu.movi_user_id = u.id
WHERE u.deleted_at IS NULL
  AND smu.id IS NULL
  AND u.rol = 'Agente'
ORDER BY o.nombre, u.nombre_completo;
```

## 🔐 Seguridad

- ✅ RLS habilitado en todas las tablas
- ✅ Solo administradores pueden crear/modificar mapeos
- ✅ Service role puede acceder desde Edge Functions
- ✅ Auditoría completa con `created_by`, `updated_by`, `mapped_by`
- ✅ Constraints a nivel de base de datos (no solo aplicación)

## 📝 Notas Importantes

1. **Campo `usuarios.nombre_sicas` es la fuente de verdad**
   - Siempre usar este campo para mostrar el nombre SICAS
   - No consultar directamente `sicas_mapeo_vendedor_usuario` para mostrar nombres

2. **Los mapeos antiguos fueron limpiados**
   - Duplicados en `vendor_mappings` fueron desactivados (no eliminados)
   - Se mantiene el histórico con `status = 'inactive'`

3. **Vendor Mappings es solo para producción**
   - Usado para mapear vendedores en reportes de producción
   - Separado del mapeo oficial SICAS
   - Permite identificar múltiples variaciones de nombres → 1 usuario

4. **Commission Agents está vinculado a usuarios**
   - Ya tiene relación 1:1 con `usuarios.usuario_id`
   - No necesita campo adicional `nombre_sicas`

## 🚀 Migración Aplicada

**Archivo:** `20260122000000_unify_user_sicas_mapping_system.sql`

**Cambios realizados:**
1. ✅ Agregado campo `usuarios.nombre_sicas`
2. ✅ UNIQUE constraint en `sicas_mapeo_vendedor_usuario.movi_user_id`
3. ✅ UNIQUE INDEX en `vendor_mappings` para mapeos activos
4. ✅ Trigger de sincronización automática
5. ✅ Vista unificada `vista_mapeo_usuarios_unificado`
6. ✅ Función helper `get_user_nombre_sicas()`
7. ✅ Limpieza de duplicados en `vendor_mappings`
8. ✅ Sincronización de datos existentes

---

**Fecha de Implementación:** 22 de Enero 2026
**Estado:** ✅ Activo y Funcionando
**Versión:** 1.0
