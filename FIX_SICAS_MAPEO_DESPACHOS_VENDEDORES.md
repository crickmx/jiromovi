# Fix: Mostrar Despachos y Vendedores en Integración SICAS

## Problema Reportado

En la página "Integración SICAS", las pestañas **"Mapeo Despachos"** y **"Mapeo Vendedores"** no mostraban los despachos y vendedores sincronizados desde SICAS para poder mapearlos con las entidades de MOVI (oficinas y usuarios).

## Causas Identificadas

### 1. Funciones Frontend Consultaban Tablas Antiguas
Las funciones `getSicasDespachos()` y `getSicasVendedores()` estaban consultando tablas obsoletas:
- ❌ `sicas_despachos` (tabla antigua, ya no se usa)
- ❌ `sicas_vendedores` (tabla antigua, ya no se usa)

Con el nuevo sistema unificado, todos los catálogos se guardan en:
- ✅ `sicas_catalogos` (tabla unificada con todos los catálogos)

### 2. Políticas RLS Incompletas
La tabla `sicas_catalogos` solo tenía política SELECT para administradores, pero faltaban:
- ❌ Política INSERT
- ❌ Política UPDATE
- ❌ Política DELETE

### 3. Parser XML Guardaba Nombres Incorrectos
El parser XML de SICAS, al no encontrar campos de nombre estándar, usaba `JSON.stringify(fields)` como fallback, guardando:
```
❌ '{"IDDespacho":"1","DespNombre":"MARSELLA CORPORATIVO",...}'
```

En lugar de:
```
✅ 'MARSELLA CORPORATIVO'
```

Los campos de nombre específicos de cada catálogo no estaban incluidos:
- Despachos usan: `DespNombre`
- Vendedores usan: `VendNombre`

## Soluciones Implementadas

### 1. Actualización de Funciones Frontend ✅

**Archivo:** `src/lib/sicasUtils.ts`

#### `getSicasDespachos()` - ANTES:
```typescript
const { data } = await supabase
  .from('sicas_despachos')  // ❌ Tabla antigua
  .select('*');
```

#### `getSicasDespachos()` - DESPUÉS:
```typescript
const CATALOG_TYPE_DESPACHOS = 11;

const { data: catalogos } = await supabase
  .from('sicas_catalogos')  // ✅ Tabla unificada
  .select('*')
  .eq('catalog_type_id', CATALOG_TYPE_DESPACHOS);

// Obtener mapeos
const { data: mapeos } = await supabase
  .from('sicas_mapeo_despacho_oficina')
  .select('*, oficinas(id, nombre)')
  .in('id_sicas_despacho', catalogos.map(c => c.id_sicas));

// Combinar datos
return catalogos.map(catalogo => ({
  ...catalogo,
  mapping: mapeos?.find(m => m.id_sicas_despacho === catalogo.id_sicas),
  is_mapped: !!mapeos?.find(m => m.id_sicas_despacho === catalogo.id_sicas)
}));
```

#### `getSicasVendedores()` - Similar
Ahora consulta `sicas_catalogos` con `catalog_type_id = 32` (Vendedores).

### 2. Políticas RLS Completas ✅

**Migración:** `fix_sicas_catalogos_rls_policies.sql`

```sql
-- Políticas completas para administradores
CREATE POLICY "Admins pueden ver catálogos SICAS"
  ON sicas_catalogos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
    AND usuarios.estado = 'activo'
  ));

CREATE POLICY "Admins pueden insertar catálogos SICAS"
  ON sicas_catalogos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
    AND usuarios.estado = 'activo'
  ));

CREATE POLICY "Admins pueden actualizar catálogos SICAS"
  ON sicas_catalogos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
    AND usuarios.estado = 'activo'
  ));

CREATE POLICY "Admins pueden eliminar catálogos SICAS"
  ON sicas_catalogos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.rol = 'admin'
    AND usuarios.estado = 'activo'
  ));
```

### 3. Parser XML Mejorado ✅

**Archivo:** `supabase/functions/_shared/sicasParser.ts`

#### ANTES:
```typescript
const nombre =
  fields.NOMBRE ||
  fields.DESCRIPCION ||
  JSON.stringify(fields);  // ❌ Fallback genérico
```

#### DESPUÉS:
```typescript
const nombre =
  fields.NOMBRE ||
  fields.DESCRIPCION ||
  fields.DESCAMPO ||
  fields.DESPNOMBRE ||           // ✅ Despachos - Campo oficial
  fields.VENDNOMBRE ||           // ✅ Vendedores - Campo oficial SICAS
  fields.VENDEDORNOMBRE ||
  fields.AGENTENOMBRE ||          // Agentes
  fields.OFNANOMBRE ||            // Oficinas
  fields.COMPANIANOMBRE ||        // Compañías
  fields.TEXTO ||
  JSON.stringify(fields);        // Fallback solo si no hay nada
```

### 4. Corrección de Datos Existentes ✅

**Migración:** `fix_sicas_catalogos_nombres_from_raw.sql`

Extrae los nombres correctos desde el campo `raw` (jsonb) para todos los registros ya guardados:

```sql
-- Despachos
UPDATE sicas_catalogos
SET nombre = COALESCE(
  raw->>'DespNombre',
  raw->>'DESPNOMBRE',
  nombre
)
WHERE catalog_type_id = 11
AND (nombre LIKE '{%' OR LENGTH(nombre) > 200);

-- Vendedores
UPDATE sicas_catalogos
SET nombre = COALESCE(
  raw->>'VendNombre',
  raw->>'VENDNOMBRE',
  nombre
)
WHERE catalog_type_id = 32
AND (nombre LIKE '{%' OR LENGTH(nombre) > 200);
```

## IDs de Catálogo

| Catálogo | catalog_type_id | Campo ID | Campo Nombre |
|----------|-----------------|----------|--------------|
| Despachos | 11 | IDDespacho | DespNombre |
| Vendedores | 32 | IDVend | VendNombre |

## Archivos Modificados

1. ✅ `src/lib/sicasUtils.ts`
   - `getSicasDespachos()` - Ahora consulta `sicas_catalogos`
   - `getAllSicasDespachos()` - Ahora consulta `sicas_catalogos`
   - `getSicasVendedores()` - Ahora consulta `sicas_catalogos`

2. ✅ `src/lib/sicasTypes.ts`
   - Agregado campo `last_sync_at?: string` a tipos legacy

3. ✅ `supabase/functions/_shared/sicasParser.ts`
   - Agregados campos específicos de cada catálogo SICAS

4. ✅ `supabase/functions/sicas-sync/index.ts`
   - Deployado con parser actualizado

## Migraciones Aplicadas

1. ✅ `fix_sicas_catalogos_rls_policies.sql`
   - Políticas RLS completas para administradores

2. ✅ `fix_sicas_catalogos_nombres_from_raw.sql`
   - Corrección de nombres de Despachos

3. ✅ `fix_sicas_vendedores_nombres_vendnombre.sql`
   - Corrección de nombres de Vendedores

## Edge Functions Deployadas

1. ✅ `sicas-sync` - Con parser XML mejorado

## Verificación de Datos

### Despachos Corregidos (37 registros)
```sql
SELECT id_sicas, nombre FROM sicas_catalogos
WHERE catalog_type_id = 11
ORDER BY id_sicas::int LIMIT 5;
```

Resultado:
```
1  | MARSELLA CORPORATIVO
2  | CELAYA ALAMEDA
3  | CUERNAVACA MC
4  | CUERNAVACA GZ
5  | TOLUCA
```

### Vendedores Corregidos (1,343 registros)
```sql
SELECT id_sicas, nombre FROM sicas_catalogos
WHERE catalog_type_id = 32
ORDER BY id_sicas::int LIMIT 5;
```

Resultado:
```
1  | GERENA ESPINOSA NORA GRACIELA
2  | NAVARRO GUEVARA LUIS
3  | GARCIA PÉREZ ROGELIO
4  | ESPINO DE LA TORRE JOSE LUIS
5  | VALDEZ MARTIN CARLOS
```

## Cómo Probar

1. **Ir a Integración SICAS**
   - URL: `/sicas-admin`

2. **Tab "Mapeo Despachos"**:
   - ✅ Ahora muestra los 37 despachos sincronizados
   - ✅ Cada despacho muestra su nombre correcto (ej: "MARSELLA CORPORATIVO")
   - ✅ Puedes seleccionar una oficina MOVI del dropdown
   - ✅ El badge muestra "Mapeado" o "Sin mapear"
   - ✅ Puedes eliminar mapeos con el botón de basura

3. **Tab "Mapeo Vendedores"**:
   - ✅ Ahora muestra los 1,343 vendedores sincronizados
   - ✅ Cada vendedor muestra su nombre completo (ej: "GERENA ESPINOSA NORA GRACIELA")
   - ✅ Puedes seleccionar un usuario MOVI del dropdown
   - ✅ El badge muestra "Mapeado" o "Sin mapear"
   - ✅ Puedes eliminar mapeos con el botón de basura

4. **Filtros y Búsqueda**:
   - ✅ Botón "Solo Sin Mapear" filtra registros pendientes
   - ✅ Campo de búsqueda busca por nombre o ID
   - ✅ Los mapeos se guardan correctamente

## Beneficios del Sistema Unificado

1. ✅ **Fuente única de verdad**: Todos los catálogos en `sicas_catalogos`
2. ✅ **Sincronización correcta**: Edge function guarda directamente en la tabla correcta
3. ✅ **Nombres legibles**: Parser extrae campos específicos de cada catálogo
4. ✅ **Escalabilidad**: Fácil agregar más catálogos (Oficinas ID 10, Agentes ID 13, etc.)
5. ✅ **Consistencia**: No hay desincronización entre tablas
6. ✅ **Mantenimiento simplificado**: Una estructura para todos los catálogos

## Estado Final

- ✅ Las funciones frontend consultan la tabla correcta (`sicas_catalogos`)
- ✅ Las políticas RLS permiten todas las operaciones necesarias
- ✅ El parser XML extrae correctamente los nombres de cada catálogo
- ✅ Los datos existentes fueron corregidos
- ✅ Los mapeos se crean y eliminan correctamente
- ✅ La UI muestra todos los registros sincronizados

## Próximos Catálogos (Opcional)

Si deseas mapear otros catálogos de SICAS:

| Catálogo | ID | Enum | Campo ID | Campo Nombre |
|----------|----|----- |----------|--------------|
| Oficinas | 10 | eOficinas | IDOfna | OfnaNombre |
| Agentes | 13 | eAgentes | IDAgen | AgenNombre |
| Ejecutivos | 33 | eEjecutivos | IDEjecut | EjecutNombre |

Solo necesitas:
1. Sincronizar el catálogo con `sicas-sync`
2. Crear función getter similar a `getSicasDespachos()`
3. Crear tabla de mapeo y UI si es necesario
