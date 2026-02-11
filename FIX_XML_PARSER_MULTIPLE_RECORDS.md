# Fix: Parser XML Ahora Detecta Múltiples Registros Correctamente

## Problema Identificado

Cuando se sincronizaba el catálogo de Despachos (ID 11), solo se obtenía **1 registro** en lugar de toda la lista de despachos disponibles.

### Causa Raíz

El parser XML estaba usando una lógica simplista:
1. Buscaba el **primer tag** que encontraba en el XML
2. Extraía todos los elementos con ese tag
3. **Problema**: Si el primer tag era `<Datos>` (contenedor), solo encontraba UNO

### Ejemplo de XML de SICAS

```xml
<Datos>
  <VCatDespachos>
    <IDDespacho>1</IDDespacho>
    <DespachoNombre>DESPACHO A</DespachoNombre>
  </VCatDespachos>
  <VCatDespachos>
    <IDDespacho>2</IDDespacho>
    <DespachoNombre>DESPACHO B</DespachoNombre>
  </VCatDespachos>
  <VCatDespachos>
    <IDDespacho>3</IDDespacho>
    <DespachoNombre>DESPACHO C</DespachoNombre>
  </VCatDespachos>
</Datos>
```

**Antes**: Detectaba `<Datos>` y solo encontraba 1 registro
**Ahora**: Detecta `<VCatDespachos>` que se repite 3 veces

## Solución Implementada

### Nueva Estrategia de Detección

El parser ahora:

1. **Cuenta todos los tags** en el XML
2. **Ignora tags contenedores** comunes (`Datos`, `NewDataSet`, `Table`, `Root`, `Response`)
3. **Identifica el tag que MÁS se repite** (esos son los registros individuales)
4. Extrae todos los elementos con ese tag

### Código Mejorado

```typescript
// Contar ocurrencias de cada tag
const allTagMatches = xml.matchAll(/<([A-Z_][A-Z0-9_]*)\b[^>]*>/gi);
const tagCounts = new Map<string, number>();

for (const match of allTagMatches) {
  const tagName = match[1];
  // Ignorar tags comunes de contenedor
  if (['Datos', 'NewDataSet', 'Table', 'Root', 'Response'].includes(tagName)) {
    continue;
  }
  tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
}

// Encontrar el tag que más se repite
let recordTag = '';
let maxCount = 0;

for (const [tag, count] of tagCounts.entries()) {
  if (count > maxCount) {
    maxCount = count;
    recordTag = tag;
  }
}
```

## Mejoras Adicionales

### 1. Logging Detallado

Ahora el parser imprime en consola:
- Longitud del XML recibido
- Preview de los primeros 200 caracteres
- Conteo de cada tag encontrado
- Tag de registro detectado y número de ocurrencias
- Número de registros encontrados
- Keys de cada registro parseado

### 2. Detección de Campos Mejorada

Se agregaron más variantes de campos ID y nombre:
```typescript
const id = fields.ID ||
           fields.CVECAMPO ||
           fields.CVE ||
           fields.IDDESPACHO ||   // ✅ Nuevo para Despachos
           fields.IDOFNA ||       // ✅ Nuevo para Oficinas
           `${i + 1}`;

const nombre = fields.NOMBRE ||
               fields.DESCRIPCION ||
               fields.DESCAMPO ||
               fields.DESPACHONOMBRE ||  // ✅ Nuevo para Despachos
               fields.OFNANOMBRE ||      // ✅ Nuevo para Oficinas
               JSON.stringify(fields);
```

### 3. Regex Mejorado

El regex ahora es más robusto y soporta tags con atributos:
```typescript
// Antes: /<([A-Z_]+)>/i
// Ahora:  /<([A-Z_][A-Z0-9_]*)\b[^>]*>/gi

// Esto soporta tags como:
// <VCatDespachos>
// <VCatDespachos id="1">
// <VCatDespachos xmlns="...">
```

## Testing

Para verificar el fix:

1. Ve a **SICAS Admin**
2. Selecciona el catálogo **"Despachos"** (ID 11)
3. Haz clic en **"Sincronizar"**
4. Verifica que se importan múltiples despachos (no solo 1)

Revisa los logs en Supabase Edge Functions:
```bash
[XML Parser] Analizando XML, longitud: 5234
[XML Parser] Tag counts: { VCatDespachos: 15, IDDespacho: 15, DespachoNombre: 15 }
[XML Parser] Tag de registro detectado: VCatDespachos con 15 ocurrencias
[XML Parser] Registros encontrados: 15
```

## Catálogos Afectados

Este fix mejora el parsing de TODOS los catálogos XML de SICAS, incluyendo:

- ✅ Oficinas (ID 10, tag: `VCatOficinas`)
- ✅ Despachos (ID 11, tag: `VCatDespachos`)
- ✅ Agentes (ID 13, tag: `VCatAgentes`)
- ✅ Vendedores (ID 32, tag: `VCatVendedores`)
- ✅ Ejecutivos (ID 33, tag: `VCatEjecutivos`)
- ✅ Cualquier otro catálogo que use estructura XML similar

## Archivos Modificados

- ✅ `supabase/functions/_shared/sicasParser.ts` - Parser mejorado
- ✅ Edge function `sicas-sync` deployada con los cambios

## Próximos Pasos

1. Prueba sincronizar diferentes catálogos
2. Verifica que cada uno traiga todos los registros disponibles
3. Revisa los logs si algún catálogo sigue sin traer datos completos
