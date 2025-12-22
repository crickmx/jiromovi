# Logo sin Distorsión en PDFs de Comisiones

## Problema Resuelto

Los PDFs de comisiones mostraban el logo distorsionado porque:
1. Usaban un logo hardcodeado de Movi en lugar del logo del usuario
2. Las dimensiones eran fijas (40mm x 15mm) sin mantener la proporción de aspecto
3. No había lógica para calcular dimensiones apropiadas según la imagen original

## Solución Implementada

### 1. Nueva Función `loadImageWithDimensions()`

```typescript
interface ImageData {
  base64: string;
  width: number;
  height: number;
}
```

Esta función carga la imagen y devuelve:
- Base64 de la imagen
- Ancho original en píxeles
- Alto original en píxeles

### 2. Nueva Función `calculateLogoDimensions()`

```typescript
function calculateLogoDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number; x: number; y: number }
```

**Algoritmo:**
1. Calcula el aspect ratio original (ancho / alto)
2. Intenta ajustar por ancho máximo
3. Si la altura excede el máximo, ajusta por altura
4. Centra horizontalmente si es más pequeño que el máximo
5. Retorna dimensiones finales y posición

**Resultado:** El logo SIEMPRE mantiene su proporción original, sin distorsión.

### 3. Integración del Logo del Usuario

Ambas funciones de PDF ahora:
1. Obtienen el logo efectivo del usuario usando `getEffectiveUserLogo(agent.id)`
2. Cargan la imagen con sus dimensiones originales
3. Calculan las dimensiones finales manteniendo la proporción
4. Renderizan el logo con las dimensiones correctas

## Cambios en los Archivos

### `src/lib/pdfUtils.ts`

#### Imports Agregados:
```typescript
import { getEffectiveUserLogo } from './logoUtils';
```

#### Funciones Modificadas:

**1. `generateCommissionPDF()` (Comprobante de Comisiones)**
```typescript
// Antes:
const logoBase64 = await loadImageAsBase64('https://movi.digital/.../cropped-logonew.png');
doc.addImage(logoBase64, 'PNG', 15, 10, 40, 15);

// Ahora:
const logoUrl = await getEffectiveUserLogo(agent.id);
const logoData = await loadImageWithDimensions(logoUrl);
const dimensions = calculateLogoDimensions(
  logoData.width,
  logoData.height,
  40,  // max 40mm de ancho
  20   // max 20mm de alto
);
doc.addImage(
  logoData.base64,
  'PNG',
  dimensions.x,
  dimensions.y,
  dimensions.width,
  dimensions.height
);
```

**2. `generateOrdenDePagoPDF()` (Orden de Pago)**
```typescript
// Antes: No tenía logo

// Ahora: Logo agregado con dimensiones proporcionales
const logoUrl = await getEffectiveUserLogo(agent.id);
const logoData = await loadImageWithDimensions(logoUrl);
const dimensions = calculateLogoDimensions(
  logoData.width,
  logoData.height,
  35,  // max 35mm de ancho
  18   // max 18mm de alto
);
doc.addImage(
  logoData.base64,
  'PNG',
  marginLeft,
  8,
  dimensions.width,
  dimensions.height
);
```

## Comportamiento del Sistema

### Jerarquía de Logos (Automática)
1. **Logo Personal** → Si el usuario tiene `mi_logotipo_url`
2. **Logo de Oficina** → Si el usuario no tiene logo pero su oficina sí
3. **Logo JIRO** → Si no hay logo personal ni de oficina

### Manejo de Errores
- Si falla la carga del logo, el PDF se genera sin logo
- Se muestra un warning en consola pero NO falla la generación del PDF
- Garantiza que los PDFs siempre se generen correctamente

### Dimensiones Máximas

**Comprobante de Comisiones:**
- Ancho máximo: 40mm
- Alto máximo: 20mm
- Posición: Esquina superior izquierda, centrado horizontalmente

**Orden de Pago:**
- Ancho máximo: 35mm
- Alto máximo: 18mm
- Posición: Margen izquierdo (12mm), Y: 8mm

## Ejemplos de Cálculo

### Ejemplo 1: Logo Horizontal (800x200px)
- Aspect Ratio: 4:1
- Max: 40mm x 20mm
- Resultado: 40mm x 10mm (ajustado por ancho)
- Centrado: X = 15mm, Y = 10mm

### Ejemplo 2: Logo Vertical (300x600px)
- Aspect Ratio: 0.5:1
- Max: 40mm x 20mm
- Resultado: 10mm x 20mm (ajustado por altura)
- Centrado: X = 30mm (15 + (40-10)/2), Y = 10mm

### Ejemplo 3: Logo Cuadrado (500x500px)
- Aspect Ratio: 1:1
- Max: 40mm x 20mm
- Resultado: 20mm x 20mm (ajustado por altura)
- Centrado: X = 25mm (15 + (40-20)/2), Y = 10mm

## Dónde se Aplica

### 1. Página "Mis Comisiones"
- Genera PDFs usando `generateOrdenDePagoPDF()`
- Cada usuario ve su propio logo en sus PDFs
- Botón: "Descargar PDF"

### 2. Página "Comisiones" (Administrador)
- Puede generar PDFs de cualquier agente
- Usa `generateCommissionPDF()` o `generateOrdenDePagoPDF()`
- El logo corresponde al agente seleccionado, NO al administrador

### 3. Componente PdfFiscalPreview
- Preview del desglose fiscal
- Usa las mismas funciones con logo proporcional

## Testing Recomendado

### Test 1: Logo Horizontal
1. Subir logo con proporción 16:9 o 4:1
2. Generar PDF de comisiones
3. Verificar que no se estire verticalmente

### Test 2: Logo Vertical
1. Subir logo con proporción 1:2 o 1:3
2. Generar PDF de comisiones
3. Verificar que no se comprima horizontalmente

### Test 3: Logo Cuadrado
1. Subir logo 1:1 (cuadrado)
2. Generar PDF de comisiones
3. Verificar que mantenga proporción cuadrada

### Test 4: Sin Logo Personal
1. Usuario sin `mi_logotipo_url`
2. Generar PDF
3. Verificar que use logo de oficina o JIRO

### Test 5: Error de Carga
1. URL de logo inválida
2. Generar PDF
3. Verificar que el PDF se genere sin logo (sin crash)

## Notas Técnicas

### CORS y Imágenes
- La función usa `crossOrigin = 'anonymous'` para cargar imágenes externas
- Los buckets de Supabase están configurados para permitir CORS
- Las imágenes se convierten a base64 para incluirlas en el PDF

### Performance
- Las imágenes se cargan de forma asíncrona
- El cálculo de dimensiones es O(1) (constante)
- No afecta el tiempo de generación del PDF significativamente

### Compatibilidad
- Funciona con PNG, JPG, JPEG
- Compatible con todas las proporciones de aspecto
- Mantiene calidad de imagen sin pérdida

## Estado del Build

✅ **Compilación exitosa**
- Sin errores de TypeScript
- Build completado sin problemas
- Todos los imports correctos

## Archivos Modificados

1. `src/lib/pdfUtils.ts` - Funciones de generación de PDF con logo proporcional
