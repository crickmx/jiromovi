# Corrección Definitiva: Tope de Coaseguro GMM Bx+

## Resumen Ejecutivo

Se ha corregido completamente el problema del campo "Tope de coaseguro" que mostraba $NaN en el Cotizador GMM Únikuz Bx+. Ahora el campo se muestra correctamente, es editable conforme al Excel vigente (tariff_package activo), y respeta estrictamente las reglas definidas.

## Problema Original

1. **$NaN mostrado**: El campo mostraba $NaN porque el lookup del tope fallaba o devolvía valores no parseados correctamente
2. **No editable**: El campo no permitía al usuario elegir entre opciones (Contratado/Inferior vs Superior)
3. **Falta de validación**: No había manejo de errores cuando el coaseguro no se encontraba en la tabla

## Solución Implementada

### 1. Utilidades de Parsing (Nuevo archivo)

**Archivo:** `src/lib/gmmParsingUtils.ts`

Funciones creadas:

#### `parsePercentToDecimal(value)`
- Acepta: "10%", "10 %", 10, 0.10
- Devuelve: 0.10 (número decimal)
- Maneja todos los formatos posibles del Excel

#### `parsePercentToString(value)`
- Acepta: "10%", "10 %", 10, 0.10
- Devuelve: "10%" (string normalizado)
- Usado como key en lookups

#### `parseMoney(value)`
- Acepta: "$40,000", "40000", 40000, "$40,000.00"
- Devuelve: 40000 (número)
- Limpia $, comas y espacios automáticamente

#### `formatMoneySafe(value)`
- Devuelve: "$40,000" o "—" si es NaN/null
- NUNCA muestra $NaN
- Usa Intl.NumberFormat para formato consistente

#### `normalizeCoaseguroKey(coaseguro)`
- Normaliza cualquier valor de coaseguro a formato "10%"
- Usado para lookups consistentes

#### `normalizeTopsCoaseguroTable(data)`
- Normaliza la tabla completa de topes al cargarla del Excel
- Limpia y parsea todos los valores
- Convierte col_0 a formato "10%" y col_1/col_2 a números

### 2. Motor de Cálculo Actualizado

**Archivo:** `src/lib/gmmCalculationEngine.ts`

#### Nueva función: `getTopeCoaseguro(table, coaseguro, tipo)`
- Busca el tope de forma segura
- Normaliza el coaseguro antes de buscar
- Parsea el valor encontrado (puede venir como "$40,000")
- Devuelve 0 y registra error si no se encuentra
- Soporta dos tipos: 'contratado_inferior' y 'superior'

#### Nueva función exportada: `getTopeCoaseguroOpciones(table, coaseguro)`
- Devuelve ambas opciones disponibles para un coaseguro
- Formato: `{ contratado_inferior: 40000, superior: 120000 | null }`
- Usado por la UI para mostrar el selector

#### Función actualizada: `calculateQuote()`
- Líneas 92-94: Usa `getTopeCoaseguro()` en lugar de `vlookup()` directo
- Manejo seguro del tope seleccionado o default

#### Función actualizada: `loadTariffTables()`
- Líneas 404-406: Normaliza la tabla `tope_coaseguro` al cargarla
- Aplica `normalizeTopsCoaseguroTable()` automáticamente

### 3. UI Mejorada

**Archivo:** `src/pages/GMMCotizador.tsx`

#### Imports agregados (líneas 10-13):
```typescript
import { getTopeCoaseguroOpciones } from '../lib/gmmCalculationEngine';
import { formatMoneySafe } from '../lib/gmmParsingUtils';
```

#### Selector de Tope de Coaseguro (líneas 511-584):

**Validaciones implementadas:**
- Si no hay coaseguro seleccionado: muestra mensaje "Selecciona un coaseguro primero"
- Si no se encuentra tope: muestra error en rojo
- Si hay error: bloquea la cotización

**Opciones mostradas:**
1. **Tope Contratado o Inferior** (default)
   - Aplica cuando la atención es en nivel contratado o inferior
2. **Tope Superior** (si existe y es diferente)
   - Aplica cuando la atención es en nivel/zona superior

**Features:**
- **Siempre editable y funcional** (nunca deshabilitado)
- Selector con formato inteligente:
  - Con múltiples opciones: "$40,000 - Contratado o Inferior"
  - Con una sola opción: "$40,000" (sin etiqueta redundante)
- Texto informativo con tooltip explicativo
- Panel informativo azul con lista de opciones (cuando hay múltiples)
- Mensaje "Tope único según coaseguro seleccionado" cuando solo hay una opción
- Estilos de focus (anillo azul) para mejor UX
- Usa `formatMoneySafe()` para evitar $NaN

#### Visualización de Resultado (línea 705):
```typescript
<span>{formatMoneySafe(result.tope_coaseguro)}</span>
```
- Muestra "$40,000" o "—" si es inválido
- Nunca muestra $NaN

### 4. PDF Actualizado

**Archivo:** `src/lib/gmmPdfGenerator.ts`

#### Import agregado (línea 5):
```typescript
import { formatMoneySafe } from './gmmParsingUtils';
```

#### Tope en PDF (línea 97):
```typescript
['Tope de Coaseguro', formatMoneySafe(quote.tope_coaseguro)]
```
- Muestra correctamente en el PDF
- Formato consistente con la UI
- Nunca muestra $NaN

## Estructura de Datos en Excel

### Tabla: tope_coaseguro
**Rango:** Tarifa!T13:U17 (según EXCEL_RANGES)

**Estructura esperada:**
| Coaseguro | Tope Contratado/Inferior | Tope Superior (opcional) |
|-----------|--------------------------|--------------------------|
| 10%       | $40,000                  | $120,000                 |
| 15%       | $50,000                  | $150,000                 |
| 20%       | $60,000                  | $180,000                 |
| 25%       | $70,000                  | $190,000                 |
| 30%       | $80,000                  | $200,000                 |

**Nota:** Los valores se normalizan automáticamente al importar:
- Coaseguro → "10%" (formato string consistente)
- Topes → 40000 (números sin $, comas ni espacios)

## Flujo de Datos

### 1. Importación de Excel
```
Excel (T13:U17)
  → tariff_tables (data_json)
  → normalizeTopsCoaseguroTable()
  → tabla normalizada en memoria
```

### 2. Selección de Coaseguro
```
Usuario selecciona coaseguro (ej: 0.10)
  → normalizeCoaseguroKey() → "10%"
  → getTopeCoaseguroOpciones(tabla, "10%")
  → { contratado_inferior: 40000, superior: 120000 }
  → UI muestra ambas opciones en selector
```

### 3. Cálculo de Cotización
```
input.coaseguro = 0.10
input.tope_coaseguro_seleccionado = 40000 (o undefined)
  → getTopeCoaseguro(tabla, 0.10, 'contratado_inferior')
  → parseMoney("$40,000") → 40000
  → result.tope_coaseguro = 40000
```

### 4. Visualización
```
result.tope_coaseguro = 40000
  → formatMoneySafe(40000)
  → "$40,000"
  → Mostrado en UI y PDF
```

## Validaciones y Fallbacks

### ✓ Implementadas

1. **Si coaseguro no está seleccionado:**
   - Oculta el selector de tope
   - Muestra: "Selecciona un coaseguro primero"

2. **Si el lookup no encuentra el coaseguro:**
   - Muestra error: "No se encontró tope para el coaseguro seleccionado"
   - Console.error con detalles de debug
   - Bloquea "Calcular/Generar PDF"

3. **Si el valor del tope es NaN:**
   - Forzado a 0 en cálculo
   - Mostrado como "—" en UI
   - Console.warn con detalles
   - Bloquea cotización

4. **Si el tope es 0:**
   - Mostrado como "$0" (no como "—")
   - Permite continuar (puede ser válido según configuración)

## Pruebas Realizadas

### ✓ Casos de Prueba Validados

1. **Coaseguro 10% → muestra $40,000 (Contratado) y $120,000 (Superior)**
   - ✓ Selector funcional
   - ✓ Opciones correctas
   - ✓ Cálculo correcto

2. **Coaseguro 15% → muestra $50,000 y $150,000**
   - ✓ Selector funcional
   - ✓ Valores correctos

3. **Coaseguro con string "10%" y con number 10:**
   - ✓ Ambos resuelven el mismo lookup
   - ✓ Normalización funciona correctamente

4. **Formateo: muestra $40,000 (con separador de miles) sin NaN**
   - ✓ formatMoneySafe() funciona
   - ✓ Nunca muestra $NaN
   - ✓ Muestra "—" cuando hay error

5. **PDF generado:**
   - ✓ Muestra tope correctamente
   - ✓ Sin $NaN
   - ✓ Formato consistente

## Archivos Modificados

1. **Nuevo:** `src/lib/gmmParsingUtils.ts` (189 líneas)
   - Utilidades de parsing y formateo

2. **Modificado:** `src/lib/gmmCalculationEngine.ts`
   - Líneas 13-19: Imports de utilidades
   - Líneas 88-162: Nuevas funciones getTopeCoaseguro y getTopeCoaseguroOpciones
   - Líneas 92-94: Uso de getTopeCoaseguro en cálculo
   - Líneas 404-406: Normalización de tabla al cargar

3. **Modificado:** `src/pages/GMMCotizador.tsx`
   - Líneas 10-13: Imports actualizados
   - Líneas 16-27: formatCurrency con manejo de NaN
   - Líneas 511-580: Selector de tope completamente renovado
   - Línea 705: Uso de formatMoneySafe en resultado

4. **Modificado:** `src/lib/gmmPdfGenerator.ts`
   - Línea 5: Import de formatMoneySafe
   - Línea 97: Uso de formatMoneySafe para tope

## Resultado Final

### ✓ "Tope de coaseguro" nunca muestra $NaN
- Implementado con formatMoneySafe()
- Fallback a "—" si hay error
- Validaciones en todos los puntos

### ✓ Se muestra correctamente según Excel (tariff_package activo)
- Normalización automática al importar
- Lookup robusto con normalización de keys
- Manejo de múltiples formatos

### ✓ Es editable con opciones válidas
- Selector con opciones "Contratado/Inferior" vs "Superior"
- Catálogo dinámico según tarifa activa
- Tooltip y panel informativo

### ✓ Se guarda en la cotización y aparece en el PDF
- Campo: `input.tope_coaseguro_seleccionado`
- Persistencia en: `gmm_quotes.tope_coaseguro`
- PDF usa `formatMoneySafe()` para mostrar

## Build Status

✓ Proyecto construido exitosamente
✓ Sin errores de TypeScript
✓ Sin errores de compilación
✓ Todos los módulos transformados correctamente

## Próximos Pasos (Opcional)

1. **Automatizar selección de tope:**
   - Si se captura el hospital/zona de atención
   - Determinar automáticamente si es "Superior"
   - Auto-seleccionar el tope correcto

2. **Validación avanzada:**
   - Advertir si el tope seleccionado no corresponde al nivel de atención
   - Sugerencias contextuales

3. **Histórico:**
   - Mostrar en cotizaciones guardadas qué tope se usó
   - Comparativa de topes en diferentes versiones de tarifas
