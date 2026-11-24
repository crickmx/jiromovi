# Sistema de Mapeo SICAS Unificado

## Cambio Realizado

Se actualizó el sistema de mapeo de Despachos y Vendedores para que consulte la tabla unificada `sicas_catalogos` en lugar de las tablas específicas antiguas.

## Problema Original

Antes, el sistema usaba tablas separadas:
- `sicas_despachos` - Tabla específica para despachos
- `sicas_vendedores` - Tabla específica para vendedores

Esto causaba:
1. **Duplicación de datos** entre tablas antiguas y la nueva tabla unificada
2. **Inconsistencias** cuando se sincronizaba desde el webservice
3. **Dificultad de mantenimiento** con múltiples tablas

## Solución Implementada

Ahora el sistema usa **una sola tabla unificada**: `sicas_catalogos`

### IDs de Catálogo

| Catálogo | catalog_type_id | enum_name |
|----------|-----------------|-----------|
| Despachos | 11 | eDespachos |
| Vendedores | 32 | eVendedores |

### Flujo Actualizado

1. **Sincronización desde SICAS**:
   ```
   Usuario → "Sincronizar Despachos" → Edge Function sicas-sync
   → Consulta webservice SICAS (catalog_type_id: 11)
   → Guarda en sicas_catalogos
   ```

2. **Visualización en UI**:
   ```
   Usuario → "Mapeo Despachos" → getSicasDespachos()
   → SELECT * FROM sicas_catalogos WHERE catalog_type_id = 11
   → Une con sicas_mapeo_despacho_oficina
   → Muestra despachos con sus mapeos
   ```

## Funciones Actualizadas

### `getSicasDespachos()`

**Antes:**
```typescript
const { data } = await supabase
  .from('sicas_despachos')  // ❌ Tabla antigua
  .select('*');
```

**Ahora:**
```typescript
const CATALOG_TYPE_DESPACHOS = 11;

const { data: catalogos } = await supabase
  .from('sicas_catalogos')  // ✅ Tabla unificada
  .select('*')
  .eq('catalog_type_id', CATALOG_TYPE_DESPACHOS);

// Obtener mapeos por separado
const { data: mapeos } = await supabase
  .from('sicas_mapeo_despacho_oficina')
  .select('*, oficinas(id, nombre)')
  .in('id_sicas_despacho', catalogos.map(c => c.id_sicas));

// Combinar resultados
return catalogos.map(catalogo => ({
  ...catalogo,
  mapping: mapeos?.find(m => m.id_sicas_despacho === catalogo.id_sicas),
  is_mapped: !!mapeos?.find(m => m.id_sicas_despacho === catalogo.id_sicas)
}));
```

### `getSicasVendedores()`

**Antes:**
```typescript
const { data } = await supabase
  .from('sicas_vendedores')  // ❌ Tabla antigua
  .select('*');
```

**Ahora:**
```typescript
const CATALOG_TYPE_VENDEDORES = 32;

const { data: catalogos } = await supabase
  .from('sicas_catalogos')  // ✅ Tabla unificada
  .select('*')
  .eq('catalog_type_id', CATALOG_TYPE_VENDEDORES);

// Obtener mapeos por separado
const { data: mapeos } = await supabase
  .from('sicas_mapeo_vendedor_usuario')
  .select('*, usuarios(id, nombre, apellidos, email_personal)')
  .in('id_sicas_vendedor', catalogos.map(c => c.id_sicas));

// Combinar resultados
return catalogos.map(catalogo => ({
  ...catalogo,
  mapping: mapeos?.find(m => m.id_sicas_vendedor === catalogo.id_sicas),
  is_mapped: !!mapeos?.find(m => m.id_sicas_vendedor === catalogo.id_sicas)
}));
```

## Tablas de Mapeo (Sin Cambios)

Las tablas de mapeo se mantienen igual:
- ✅ `sicas_mapeo_despacho_oficina` - Relaciona despachos SICAS con oficinas MOVI
- ✅ `sicas_mapeo_vendedor_usuario` - Relaciona vendedores SICAS con usuarios MOVI

## Estructura de `sicas_catalogos`

```sql
CREATE TABLE sicas_catalogos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_type_id integer NOT NULL,  -- 11 para Despachos, 32 para Vendedores
  id_sicas text NOT NULL,            -- ID del registro en SICAS
  nombre text NOT NULL,              -- Nombre del despacho/vendedor
  raw jsonb,                         -- Datos completos del webservice
  metadata jsonb,                    -- Metadatos del parser
  is_mapped boolean DEFAULT false,   -- Calculado al consultar mapeos
  last_sync_at timestamptz,          -- Última sincronización
  created_at timestamptz DEFAULT now(),

  UNIQUE(catalog_type_id, id_sicas)  -- Un registro por catálogo
);
```

## Beneficios del Cambio

1. ✅ **Fuente única de verdad**: Todos los catálogos en una tabla
2. ✅ **Sincronización correcta**: Edge function guarda directamente en la tabla correcta
3. ✅ **Escalabilidad**: Fácil agregar más catálogos (Oficinas ID 10, Agentes ID 13, etc.)
4. ✅ **Consistencia**: No hay desincronización entre tablas
5. ✅ **Mantenimiento simplificado**: Una estructura para todos los catálogos

## Cómo Probar

1. **Ir a Integración SICAS**
2. **Tab "Conexión"**:
   - Click en "Sincronizar Despachos"
   - Verificar que se sincronicen correctamente
   - Click en "Sincronizar Vendedores"
   - Verificar que se sincronicen correctamente

3. **Tab "Mapeo Despachos"**:
   - Verificar que se muestren los despachos sincronizados desde SICAS
   - Crear mapeos a oficinas MOVI
   - Verificar que los badges "Mapeado/Sin mapear" funcionen

4. **Tab "Mapeo Vendedores"**:
   - Verificar que se muestren los vendedores sincronizados desde SICAS
   - Crear mapeos a usuarios MOVI
   - Verificar que los badges "Mapeado/Sin mapear" funcionen

## Archivos Modificados

- ✅ `src/lib/sicasUtils.ts` - Funciones actualizadas
  - `getSicasDespachos()` - Ahora consulta `sicas_catalogos`
  - `getAllSicasDespachos()` - Ahora consulta `sicas_catalogos`
  - `getSicasVendedores()` - Ahora consulta `sicas_catalogos`

## Próximos Pasos (Opcional)

Puedes migrar otros catálogos al mismo sistema:

- **Oficinas** (ID 10, enum: `eOficias`)
- **Agentes** (ID 13, enum: `eAgentes`)
- **Ejecutivos** (ID 33, enum: `eEjecutivos`)

Solo necesitas:
1. Sincronizar el catálogo usando la edge function
2. Crear la función getter similar a `getSicasDespachos()`
3. Crear la UI de mapeo si es necesario

## Notas Importantes

- Las **tablas antiguas** (`sicas_despachos`, `sicas_vendedores`) ya no se usan
- Las **tablas de mapeo** siguen siendo las mismas
- La **sincronización** ahora guarda directamente en `sicas_catalogos`
- Los **mapeos existentes** se preservan y siguen funcionando
