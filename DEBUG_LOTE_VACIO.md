# Debug: Lote se muestra vacío después de conversión

## Problema
Después de convertir un batch de importación a lotes de comisiones:
- El modal muestra "Conversión Completada" correctamente
- Se crearon N lotes con X documentos
- Pero al abrir el lote, solo muestra el número de pólizas pero sin datos en la tabla

## Pasos de debugging

### 1. Verificar logs en consola del navegador

Después de hacer clic en "Abrir lote", busca estos logs en la consola (F12):

```
[ComisionesLote] Cargando batch: {uuid}
[ComisionesLote] DIAGNÓSTICO - Conteo simple (sin JOINs): {count: X, error: null}
[ComisionesLote] DIAGNÓSTICO - Query simple (sin JOINs profundos): {data: [...], error: null}
[ComisionesLote] Batch result: {data: {...}, error: null}
[ComisionesLote] Details result: {data: [...], error: null}
[ComisionesLote] Details count: X
[ComisionesLote] Estado actualizado: {batch: {...}, detailsCount: X}
```

### 2. Casos posibles

#### Caso A: Conteo simple retorna 0
```
DIAGNÓSTICO - Conteo simple (sin JOINs): {count: 0}
```

**Causa**: No se insertaron datos en `commission_details`

**Verificar**:
1. Revisa los logs del edge function `convert-import-to-commission-batches`
2. Busca errores de validación o inserción
3. Verifica que `totalInsertedItems > 0` en el resultado del modal

**Solución**: El problema está en el backend, no en el frontend. Los datos no se están insertando.

#### Caso B: Conteo simple retorna X pero query con JOINs retorna vacío
```
DIAGNÓSTICO - Conteo simple (sin JOINs): {count: 150}
DIAGNÓSTICO - Query simple: {data: [5 items]}
Details result: {data: [], error: null}
```

**Causa**: Los JOINs anidados están fallando silenciosamente

**Verificar**:
1. Algunos `agent_id` en `commission_details` no existen en `commission_agents`
2. Algunos `office_id` en `commission_agents` no existen en `commission_offices`
3. Algunos `fiscal_regime_id` en `commission_agents` no existen en `commission_fiscal_regimes`

**Solución**: Los JOINs en PostgREST fallan silenciosamente si la foreign key no existe. Simplificar el SELECT o asegurar que todos los FKs existan.

#### Caso C: Query retorna error de RLS
```
Details result: {data: null, error: {code: "PGRST...", message: "..."}}
```

**Causa**: Las políticas RLS no permiten leer `commission_details`

**Verificar**:
1. El usuario es admin? `usuario.rol === 'Administrador'`
2. Las políticas RLS de `commission_details` requieren que el usuario sea admin

**Solución**: Verificar políticas RLS en la base de datos.

#### Caso D: Query retorna datos pero tabla se ve vacía
```
Details result: {data: [150 items], count: 150}
Estado actualizado: {detailsCount: 150}
```

Pero la tabla se ve vacía en la UI.

**Causa**: Problema de renderizado en el frontend

**Verificar**:
1. `details.map()` está recibiendo el array correcto
2. Verificar que los campos existan: `detail.poliza`, `detail.agent?.name`, etc.
3. Revisar si hay errores en console sobre campos undefined

**Solución**: Revisar el componente `ComisionesLote.tsx` en el tab de "Por Póliza".

### 3. Consulta SQL directa para verificar datos

Si tienes acceso a la base de datos, ejecuta:

```sql
-- Verificar que el batch existe
SELECT * FROM commission_batches WHERE id = '{batch_id}';

-- Verificar cuántos details tiene
SELECT COUNT(*) FROM commission_details WHERE batch_id = '{batch_id}';

-- Verificar los primeros 5 registros
SELECT
  id,
  poliza,
  nombre_asegurado,
  agent_id,
  ramo,
  aseguradora,
  prima_neta,
  commission_neta
FROM commission_details
WHERE batch_id = '{batch_id}'
LIMIT 5;

-- Verificar si los agent_id existen
SELECT
  cd.id,
  cd.poliza,
  cd.agent_id,
  ca.name as agent_name
FROM commission_details cd
LEFT JOIN commission_agents ca ON ca.id = cd.agent_id
WHERE cd.batch_id = '{batch_id}'
LIMIT 5;
```

### 4. Posibles causas y soluciones

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `count: 0` | No se insertaron datos | Revisar edge function, validación de datos |
| `count: X` pero `data: []` | JOINs fallando | Simplificar SELECT, verificar FKs |
| Error de RLS | Políticas demasiado restrictivas | Ajustar políticas RLS |
| Datos existen pero UI vacía | Error de renderizado | Revisar componente React |
| `agent.name` es undefined | `agent_id` NULL o FK inválido | Asegurar que todos los details tengan `agent_id` válido |

### 5. Solución temporal: Query sin JOINs profundos

Si los JOINs están causando problemas, modificar temporalmente el SELECT:

```typescript
// En lugar de:
supabase.from('commission_details').select(`
  *,
  agent:agent_id(
    *,
    office:office_id(*),
    fiscal_regime:fiscal_regime_id(*),
    usuario:usuario_id(*)
  )
`)

// Usar:
supabase.from('commission_details').select(`
  *,
  agent:agent_id(name, email)
`)
```

Esto simplifica los JOINs y debería retornar datos más rápidamente.

## Cambios implementados

### 1. Logging exhaustivo en `ComisionesLote.tsx`
- Agregado logging antes y después de cada query
- Diagnóstico con conteo simple (sin JOINs)
- Diagnóstico con query simple (solo IDs básicos)
- Logging del resultado completo

### 2. Simplificación de JOINs
- Removido el JOIN a `usuario:usuario_id` que podía estar causando problemas
- Solo se hace JOIN a `agent`, `office` y `fiscal_regime`

### 3. Manejo de errores
- Se muestra error específico si `detailsResult.error` existe
- No se oculta el error silenciosamente

## Verificación durante la conversión

Cuando conviertes el batch, también debes revisar los logs del modal:

```
[ConvertirLoteModal] Conversión exitosa: {success: true, createdBatches: [...], totalInsertedItems: 150}
[ConvertirLoteModal] Batches creados: [{id: "uuid1", display_name: "Semana 1", items: 75}, ...]
[ConvertirLoteModal] Total items: 150
```

**Si `totalInsertedItems` es 0**, entonces NO se insertaron datos y el problema está en el backend.

**Si `totalInsertedItems` es mayor a 0**, entonces los datos SÍ se insertaron y el problema está al leerlos (RLS o JOINs).

## Próximos pasos

1. **Reproducir el problema** en el navegador
2. **Revisar los logs de conversión** en el modal
3. **Abrir el lote** y revisar los logs en la consola (F12)
4. **Identificar cuál de los casos A, B, C o D** está ocurriendo
5. **Aplicar la solución** correspondiente

## Información adicional

- Archivo: `src/pages/ComisionesLote.tsx`
- Edge function: `supabase/functions/convert-import-to-commission-batches/index.ts`
- Tablas: `commission_batches`, `commission_details`, `commission_agents`
- RLS: Políticas en `20251210193447_create_commissions_module_correct.sql`
