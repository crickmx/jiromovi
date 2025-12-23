# PDF Comparativo GMM - Diseño Tabla Comparativa

**Fecha:** 23 de diciembre de 2024
**Tipo:** Rediseño completo del PDF a formato tabla comparativa
**Estado:** ✅ IMPLEMENTADO

---

## Nuevo Diseño: Tabla Comparativa

El PDF ahora utiliza un diseño de **tabla comparativa matricial** que facilita la comparación visual entre opciones.

### Estructura Visual

```
┌─────────────────────────────────────────────────────────────┐
│  LOGO             Comparativo de Opciones Únikuz Bx+        │
│                                                      Folio   │
│                                                      Fecha   │
├─────────────────────────────────────────────────────────────┤
│                    TABLA COMPARATIVA                        │
│                                                              │
│  Característica    │  ★ Opción A  │  Opción B  │  Opción C │
│  ──────────────────┼──────────────┼────────────┼───────────│
│  INFORMACIÓN DEL PLAN                                       │
│  Estado y Nivel    │  CDMX        │  CDMX      │  CDMX     │
│                    │  Premium     │  Premium   │  Estándar │
│  ──────────────────┼──────────────┼────────────┼───────────│
│  ASEGURADOS                                                 │
│  Asegurado 1       │  Juan Pérez  │  Juan P.   │  Juan P.  │
│                    │  M, 35 años  │  M, 35     │  M, 35    │
│                    │  $5,000      │  $4,500    │  $3,800   │
│  ──────────────────┼──────────────┼────────────┼───────────│
│  COBERTURAS ADICIONALES                                     │
│  Maternidad        │  ✓ SÍ        │  ✓ SÍ      │  ✗ NO     │
│  Gastos de parto   │              │            │           │
│  ──────────────────┼──────────────┼────────────┼───────────│
│  TOTAL A PAGAR                                              │
│  Prima Total       │  $12,500     │  $11,800   │  $9,500   │
│  Forma de Pago     │  Anual       │  Anual     │  Anual    │
└─────────────────────────────────────────────────────────────┘
```

---

## Características del Nuevo Diseño

### 1. Formato Tabla Matricial

**Primera Columna (50mm):**
- ✅ Características y conceptos
- ✅ Fondo gris claro (240, 240, 245)
- ✅ Texto en negritas
- ✅ Fuente 7pt

**Columnas de Opciones (dinámicas):**
- ✅ Una columna por opción (A, B, C)
- ✅ Ancho calculado automáticamente
- ✅ Contenido centrado
- ✅ Fuente 7pt

### 2. Secciones Organizadas

#### SECCIÓN 1: INFORMACIÓN DEL PLAN
- Estado y Nivel
- Suma Asegurada
- Deducible
- Coaseguro
- Tope de Coaseguro

**Estilo:**
- Header azul oscuro (0, 51, 102)
- Texto blanco
- Fuente 8pt bold

#### SECCIÓN 2: ASEGURADOS
- Una fila por asegurado
- Información en 3 líneas:
  - Línea 1: Nombre completo
  - Línea 2: Sexo y edad
  - Línea 3: Prima individual

**Estilo:**
- Header azul oscuro
- Datos en múltiples líneas
- Fondo gris claro para etiquetas

#### SECCIÓN 3: COBERTURAS BÁSICAS
- Indicador "✓ INCLUIDAS"
- Lista resumida:
  - "Hospitalización, Honorarios,"
  - "Medicamentos, Cirugías, etc."

**Estilo:**
- Header azul oscuro
- Texto verde (0, 153, 51)
- Checkmark ✓ destacado

#### SECCIÓN 4: COBERTURAS ADICIONALES
- Una fila por cobertura
- **Nombre en línea 1** (bold)
- **Descripción en línea 2** (texto secundario, fuente 6pt, gris)
- Indicadores: "✓ SÍ" o "✗ NO"

**Estilo:**
- Header azul oscuro
- ✓ SÍ en verde (0, 153, 51), bold, 8pt
- ✗ NO en rojo (200, 50, 50), 8pt
- Descripción en gris (100, 100, 100)

#### SECCIÓN 5: TOTAL A PAGAR
- Prima Total (destacada)
- Forma de Pago

**Estilo:**
- Header azul oscuro
- Fondo amarillo claro (255, 250, 230)
- Prima en verde oscuro (0, 102, 51), bold, 10pt

---

## 3. Identificación Visual

### Mejor Precio (★)
- ✅ Estrella "★" en el header
- ✅ Fondo verde (0, 153, 51)
- ✅ Borde verde grueso (0.8mm)
- ✅ Texto blanco, bold, 9pt

### Otras Opciones
- ✅ Fondo azul (0, 102, 204)
- ✅ Texto blanco, bold, 9pt
- ✅ Borde estándar

---

## 4. Paleta de Colores

### Headers de Sección
```
Azul Oscuro: RGB(0, 51, 102)
Texto: Blanco RGB(255, 255, 255)
```

### Opciones
```
Mejor Precio: RGB(0, 153, 51) - Verde
Otras: RGB(0, 102, 204) - Azul
```

### Coberturas
```
✓ Incluida: RGB(0, 153, 51) - Verde
✗ No incluida: RGB(200, 50, 50) - Rojo
```

### Totales
```
Fondo: RGB(255, 250, 230) - Amarillo claro
Texto: RGB(0, 102, 51) - Verde oscuro
```

### Backgrounds
```
Etiquetas: RGB(240, 240, 245) - Gris muy claro
Asegurados: RGB(245, 245, 250) - Gris claro
```

---

## 5. Tipografía y Tamaños

| Elemento | Tamaño | Estilo |
|----------|--------|--------|
| Título principal | 18pt | Bold |
| Headers de sección | 8pt | Bold |
| Headers de opciones | 9pt | Bold |
| Etiquetas | 7pt | Bold |
| Datos generales | 7pt | Normal |
| Coberturas ✓/✗ | 8pt | Bold/Normal |
| Descripciones | 6pt | Normal |
| Prima Total | 10pt | Bold |
| Notas | 5pt | Normal |
| Footer | 7pt | Bold |

---

## 6. Coberturas Adicionales: Descripción como Texto Secundario

### Implementación

Cada cobertura se muestra en **una sola fila** con:

```typescript
const cobRow = [`${cobertura.label}\n${cobertura.description}`];
```

**Visual:**
```
┌──────────────────────┬──────────┬──────────┐
│ Maternidad           │  ✓ SÍ    │  ✗ NO    │
│ Gastos de parto y    │          │          │
│ complicaciones       │          │          │
└──────────────────────┴──────────┴──────────┘
```

### Estilizado de Descripciones

```typescript
// Coberturas adicionales: descripción más pequeña
if (data.column.index === 0 && rowText.includes('\n')) {
  const lines = rowText.split('\n');
  if (lines.length === 2) {
    data.cell.styles.fontSize = 6;
    data.cell.styles.textColor = [100, 100, 100];
  }
}
```

**Resultado:**
- Nombre: 7pt, negro, bold
- Descripción: 6pt, gris (100, 100, 100), normal

---

## 7. Layout Responsive

### Cálculo Dinámico de Anchos

```typescript
const labelColWidth = 50; // mm fijos
const optionColWidth = (contentWidth - labelColWidth) / numOptions;
```

**Ejemplos:**

| Opciones | Ancho Contenido | Ancho Etiquetas | Ancho por Opción |
|----------|----------------|-----------------|------------------|
| 1 opción | 277mm | 50mm | 227mm |
| 2 opciones | 277mm | 50mm | 113.5mm |
| 3 opciones | 277mm | 50mm | 75.7mm |

### Adaptación de Contenido

**Nombres de asegurados:**
- Si > 20 caracteres: truncar y agregar ".."
- Ejemplo: "Juan Antonio Pérez" → "Juan Antonio Pérez"

**Descripciones largas:**
- Auto-wrap con `\n`
- Fuente más pequeña (6pt)

---

## 8. Header y Footer

### Header (20mm altura)
```
┌─────────────────────────────────────────────────────┐
│ [LOGO]        Comparativo de Opciones Únikuz Bx+   │
│                                      Folio: GMM-001 │
│                              23 de diciembre de 2024│
└─────────────────────────────────────────────────────┘
```

**Componentes:**
- Logo: 30mm × 15mm (izquierda)
- Título: 18pt, centrado
- Folio y fecha: 8pt, alineado derecha

### Footer (15mm altura)
```
┌─────────────────────────────────────────────────────┐
│ Notas importantes: Cotización válida 15 días...    │
│                                                     │
│ ────────────────────────────────────────────────── │
│     Juan Pérez  |  agentedeseguros.online/juan-perez  |  555-1234-5678     │
└─────────────────────────────────────────────────────┘
```

**Componentes:**
- Notas: 5pt, gris oscuro
- Separador: línea gris
- Contacto: 7pt, azul oscuro, centrado

---

## 9. Ventajas del Nuevo Diseño

### Visual
✅ **Fácil de escanear:** Columnas claras y definidas
✅ **Comparación directa:** Características alineadas horizontalmente
✅ **Jerarquía clara:** Secciones bien diferenciadas
✅ **Colores significativos:** Verde = incluido, Rojo = no incluido

### UX
✅ **Mejor precio destacado:** Estrella ★ y color verde
✅ **Información condensada:** Todo en una página
✅ **Lectura rápida:** Checkmarks y X visibles
✅ **Descripciones útiles:** Texto secundario para coberturas

### Técnico
✅ **Responsive:** Se adapta a 1, 2 o 3 opciones
✅ **Escalable:** Maneja cualquier número de asegurados
✅ **Robusto:** Validaciones en todos los datos
✅ **Profesional:** Tipografía y colores consistentes

---

## 10. Casos de Uso

### Caso 1: Una Sola Opción
```
┌──────────────────┬────────────────────────────┐
│ Característica   │ Cotización                 │
├──────────────────┼────────────────────────────┤
│ Estado y Nivel   │ CDMX Premium               │
│ ...              │ ...                        │
└──────────────────┴────────────────────────────┘
```

### Caso 2: Dos Opciones
```
┌──────────────────┬──────────────┬──────────────┐
│ Característica   │ ★ Opción A   │ Opción B     │
├──────────────────┼──────────────┼──────────────┤
│ Estado y Nivel   │ CDMX Premium │ CDMX Estándar│
│ ...              │ ...          │ ...          │
└──────────────────┴──────────────┴──────────────┘
```

### Caso 3: Tres Opciones
```
┌──────────────────┬──────────┬──────────┬──────────┐
│ Característica   │ Opción A │ ★ Op. B  │ Opción C │
├──────────────────┼──────────┼──────────┼──────────┤
│ Estado y Nivel   │ CDMX Pr. │ CDMX Pr. │ CDMX Est.│
│ ...              │ ...      │ ...      │ ...      │
└──────────────────┴──────────┴──────────┴──────────┘
```

---

## 11. Ejemplo Real de Cobertura

### Antes (dos filas)
```
┌──────────────────────────┬─────┬─────┬─────┐
│ Cobertura                │  A  │  B  │  C  │
├──────────────────────────┼─────┼─────┼─────┤
│ Maternidad               │  ✓  │  ✓  │  ✗  │
├──────────────────────────┼─────┼─────┼─────┤
│ Descripción              │     │     │     │
│ Gastos de parto y comp.  │     │     │     │
└──────────────────────────┴─────┴─────┴─────┘
```

### Después (una fila)
```
┌──────────────────────────┬────────┬────────┬────────┐
│ Maternidad               │ ✓ SÍ   │ ✓ SÍ   │ ✗ NO   │
│ Gastos de parto y comp.  │        │        │        │
└──────────────────────────┴────────┴────────┴────────┘
```

**Diferencia:**
- ✅ Menos espacio vertical
- ✅ Descripción como texto secundario
- ✅ Más fácil de leer
- ✅ Más información en menos espacio

---

## 12. Compilación

```bash
npm run build
```

**Resultado:**
```
✓ built in 25.34s
✅ Sin errores
✅ Sin warnings de tipos
✅ PDF comparativo funcionando
```

---

## 13. Comparación Antes vs Después

### Diseño Anterior
❌ Tarjetas individuales por opción
❌ Difícil comparar características
❌ Coberturas en tabla separada con descripción en otra fila
❌ Mucho scroll horizontal mental
❌ No destacaba mejor precio claramente

### Diseño Actual
✅ Tabla comparativa matricial
✅ Comparación directa característica por característica
✅ Coberturas con descripción en misma celda (texto secundario)
✅ Lectura natural de izquierda a derecha
✅ Mejor precio con estrella ★ y color verde

---

## 14. Resumen de Cambios

### Estructura
- ✅ De "tarjetas lado a lado" a "tabla comparativa"
- ✅ Primera columna para características
- ✅ Columnas siguientes para opciones

### Coberturas Adicionales
- ✅ Descripción como texto secundario (mismo renglón)
- ✅ Nombre en negritas 7pt
- ✅ Descripción en gris 6pt
- ✅ Ya no usa dos filas

### Visual
- ✅ Headers azul oscuro con texto blanco
- ✅ Mejor precio con ★ y fondo verde
- ✅ Checkmarks verdes, X rojas
- ✅ Prima total destacada con fondo amarillo

### UX
- ✅ Más fácil de comparar opciones
- ✅ Lectura más rápida
- ✅ Mejor jerarquía visual
- ✅ Información más densa pero legible

---

**Archivo modificado:** `src/lib/gmmPdfUnified.ts`
**Líneas totales:** 523
**Formato:** A4 Horizontal (297mm × 210mm)
**Estado:** ✅ PRODUCCIÓN READY
