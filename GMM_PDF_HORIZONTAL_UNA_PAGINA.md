# PDF GMM BX+ - Rediseño Completo: Una Sola Página Horizontal

**Fecha:** 23 de diciembre de 2024
**Objetivo:** Implementar un PDF profesional de una sola página horizontal que funcione para modo simple (1 opción) y comparativo (2-3 opciones)

---

## ✅ Cambios Implementados

### 1. Formato y Orientación

**ANTES:**
- Formato: A4 Portrait (vertical)
- Múltiples páginas
- Desbordamiento vertical

**AHORA:**
- ✅ Formato: **A4 Landscape (horizontal)** - 297mm x 210mm
- ✅ **UNA SOLA PÁGINA** - No permite saltos
- ✅ Márgenes: 8.5mm (24px) lateral, 7mm (20px) vertical
- ✅ Grid de 12 columnas implícito

---

## 2. Estructura Visual del PDF

### Layout Vertical (de arriba hacia abajo):

```
┌────────────────────────────────────────────────────────────┐
│ 1. ENCABEZADO (18mm)                                       │
│    - Logo (izquierda) + Título (centro) + Info (centro)   │
│    - Línea separadora                                      │
├────────────────────────────────────────────────────────────┤
│ 2. BLOQUE DE OPCIONES CON ASEGURADOS (75mm)              │
│    - 1 a 3 columnas según número de opciones              │
│    - Cada columna contiene:                                │
│      • Título de opción + Badge mejor precio               │
│      • Datos del plan (compactos)                          │
│      • ASEGURADOS (cada uno con nombre, edad, prima)      │
│      • TOTAL + Forma de pago                               │
├────────────────────────────────────────────────────────────┤
│ 3. COBERTURAS BÁSICAS INCLUIDAS (12mm)                    │
│    - 9 coberturas en 3 columnas                            │
│    - Sin primas, solo lista con ✓                          │
├────────────────────────────────────────────────────────────┤
│ 4. TABLA COBERTURAS ADICIONALES (70mm)                    │
│    - 15 coberturas comparativas                            │
│    - Columnas: Cobertura | Descripción | Opc A/B/C        │
│    - Indicadores: ✓ (verde) / ✗ (rojo)                    │
├────────────────────────────────────────────────────────────┤
│ 5. NOTAS IMPORTANTES (8mm)                                 │
│    - Texto compacto con notas legales                      │
├────────────────────────────────────────────────────────────┤
│ 6. FOOTER FIJO (5mm)                                       │
│    - Nombre | agentedeseguros.online/slug | Teléfono      │
└────────────────────────────────────────────────────────────┘
```

**Total altura usada:** ~198mm (cabe perfectamente en 210mm)

---

## 3. Secciones Detalladas

### 📋 Sección 1: Encabezado (Header)

**Elementos:**
- **Logo:** Izquierda, 24mm x 12mm, jerarquía (Mi Logotipo → Oficina → JIRO)
- **Título:** Centro, "Cotización Únikuz Bx+", fuente 16pt bold
- **Info:** Centro, Folio + Fecha, fuente 7pt

**Diseño:**
- Línea separadora gris claro
- Sin sombras ni degradados
- Limpio y profesional

---

### 📊 Sección 2: Bloque de Opciones con Asegurados

**Layout Adaptativo:**
- **1 opción:** 1 columna ancha
- **2-3 opciones:** Columnas iguales con gap de 3mm

**Cada Columna Contiene:**

1. **Cabecera de Opción:**
   - Título: "Opción A/B/C" o "Cotización"
   - Badge "★ MEJOR PRECIO" (verde) si aplica
   - Borde destacado para mejor precio

2. **Datos del Plan (compactos):**
   - Estado · Nivel Hospitalario
   - Suma Asegurada · Deducible
   - Coaseguro · Tope Coaseguro
   - Fuente 6pt, centrado, en 3 líneas

3. **ASEGURADOS:**
   - Título "ASEGURADOS" (fuente 7pt bold)
   - Por cada asegurado:
     - **Nombre** (bold, 5.5pt)
     - **Sexo - Edad años** (normal, 5.5pt)
     - **Prima: $X,XXX** (bold azul, 5.5pt)
   - Separación: 8.5mm por asegurado

4. **Total:**
   - Separador
   - **TOTAL:** $XX,XXX (fuente 8pt bold verde)
   - Forma de pago (5.5pt)

**Altura fija:** 75mm por columna

---

### ✓ Sección 3: Coberturas Básicas Incluidas

**Características:**
- 9 coberturas básicas
- Distribuidas en 3 columnas
- Fuente 6pt
- Solo nombre con ✓, **SIN primas**
- Compacta: 12mm altura total

**Coberturas:**
1. Hospitalización
2. Honorarios médicos
3. Medicamentos hospitalarios
4. Laboratorio y gabinete
5. Cirugías
6. Anestesia
7. Terapias
8. Ambulancia
9. Urgencias

---

### 📑 Sección 4: Tabla de Coberturas Adicionales Comparativa

**Estructura:**
- Tabla de 15 filas (coberturas) + header
- Columnas:
  1. **Cobertura** (32mm, bold, 5.5pt)
  2. **Descripción** (ancho restante, 5pt)
  3-5. **Opción A/B/C o "Incluida"** (15mm c/u, centrado, 8pt)

**Indicadores Visuales:**
- ✓ Verde bold = Incluida
- ✗ Rojo = No incluida

**15 Coberturas:**
1. Maternidad
2. Reconocimiento de antigüedad
3. Medicamentos fuera del hospital
4. Complicaciones no amparadas
5. Padecimientos preexistentes
6. Eliminación de deducible por accidente
7. Multiregión
8. Beneficio VIP
9. Emergencia médica en el extranjero
10. Enfermedades graves en el extranjero
11. Cobertura internacional
12. Ampliación de servicios
13. Ayuda diaria por hospitalización
14. Indemnización por enfermedades graves
15. Xtensuz

**Diseño:**
- Theme: grid
- Headers: Fondo azul oscuro #003366, texto blanco
- Celdas: Padding 1.5mm, fuente 5.5pt
- Bordes: Gris claro #DCDCDC

**Altura:** ~70mm (ajustada automáticamente por autoTable)

---

### 📝 Sección 5: Notas Importantes

**Contenido:**
```
Notas importantes:
1. Cotización válida 15 días. 2. Aceptación sujeta a políticas de suscripción.
3. Coberturas sujetas a Condiciones Generales CNSF. 4. Documento ilustrativo,
no contractual, no garantiza emisión de póliza.
```

**Diseño:**
- Fuente 4.5pt (muy compacta)
- Color gris medio
- Altura: ~8mm
- Posición fija: 12mm desde el bottom

---

### 🔖 Sección 6: Footer Fijo

**Formato:**
```
Nombre Asesor | agentedeseguros.online/slug | 55-1234-5678
```

**Características:**
- Línea separadora superior
- Fuente 6pt, gris oscuro
- Centrado horizontalmente
- Altura: 5mm
- Posición fija: 2mm desde el bottom

---

## 4. Tipografía y Colores

### Tipografía

| Elemento | Tamaño | Peso |
|----------|--------|------|
| Título principal | 16pt | Bold |
| Título sección | 8pt | Bold |
| Título opción | 10pt | Bold |
| Info plan | 6pt | Normal |
| ASEGURADOS título | 7pt | Bold |
| Asegurado nombre | 5.5pt | Bold |
| Asegurado info | 5.5pt | Normal |
| Total | 8pt | Bold |
| Tabla headers | 6.5pt | Bold |
| Tabla contenido | 5.5pt | Normal |
| Notas | 4.5pt | Normal |
| Footer | 6pt | Normal |

### Colores

| Uso | Color RGB | Hex |
|-----|-----------|-----|
| Azul principal | (0, 51, 102) | #003366 |
| Azul info | (0, 102, 204) | #0066CC |
| Verde total | (0, 102, 51) | #006633 |
| Verde mejor precio | (0, 153, 51) | #009933 |
| Verde checkmark | (0, 153, 51) | #009933 |
| Rojo X | (200, 0, 0) | #C80000 |
| Gris texto | (60) | #3C3C3C |
| Gris claro | (80) | #505050 |
| Gris muy claro | (100) | #646464 |
| Gris líneas | (220) | #DCDCDC |
| Fondo tarjeta | (250, 250, 252) | #FAFAFC |

---

## 5. Reglas Técnicas Críticas

### ✅ Implementado

1. **Una sola página:** Todo cabe en 210mm altura
2. **Sin scroll:** No permite desbordamiento
3. **Sin cortes:** Todas las tablas completas
4. **Grid implícito:** Columnas calculadas dinámicamente
5. **Adaptativo:** Funciona con 1, 2 o 3 opciones
6. **Mejor precio destacado:** Badge verde y borde
7. **Asegurados con primas:** Cada asegurado muestra su prima individual
8. **Tabla comparativa:** 15 coberturas con ✓/✗
9. **Footer fijo:** Siempre visible al final
10. **Sin degradados:** Diseño plano profesional

---

## 6. Flujo de Generación

### Ubicaciones que Usan el PDF:

1. **GMMCotizador.tsx:**
   - Función: `handleDownloadPDF(quotation)`
   - Botón: "Descargar" en Mis Cotizaciones
   - Usa: `generateUnifiedQuotePDF()`

2. **MultiOptionQuote.tsx:**
   - Función: `handleDownloadComparativePDF()`
   - Botón: "Descargar PDF Comparativo"
   - Usa: `generateUnifiedQuotePDF()`

### Proceso de Generación:

```typescript
generateUnifiedQuotePDF(
  options: QuoteOptionResult[],  // 1-3 opciones
  quoteInfo: QuoteInfo,          // Folio, fecha, cliente
  asesor: AsesorInfo,            // Nombre, slug, teléfono
  logoUrl?: string               // Logo efectivo
): Promise<Blob>
```

**Pasos:**
1. Crear documento jsPDF landscape A4
2. Cargar logo (si existe) como base64
3. Renderizar header con logo + título
4. Calcular columnas según número de opciones
5. Renderizar cada opción con sus asegurados
6. Renderizar coberturas básicas en 3 columnas
7. Generar tabla autoTable de 15 coberturas adicionales
8. Agregar notas importantes en espacio fijo
9. Agregar footer con info del asesor
10. Retornar Blob del PDF

---

## 7. Ventajas del Nuevo Diseño

### Para el Cliente:
- ✅ **Todo en una vista:** No necesita hacer scroll ni cambiar páginas
- ✅ **Comparación rápida:** Ve todas las opciones lado a lado
- ✅ **Información clara:** Cada asegurado con su prima individual
- ✅ **Tabla legible:** 15 coberturas con descripciones
- ✅ **Profesional:** Diseño limpio y moderno

### Para el Asesor:
- ✅ **Marca visible:** Logo en header, info en footer
- ✅ **Página web destacada:** agentedeseguros.online/slug sin https
- ✅ **Flexible:** Funciona con 1, 2 o 3 opciones automáticamente
- ✅ **Mejor precio resaltado:** Cliente ve inmediatamente la mejor opción
- ✅ **PDF listo para compartir:** Una sola página, fácil de enviar

### Técnicas:
- ✅ **Sin saltos de página:** Todo calculado para caber
- ✅ **Orientación horizontal:** Máximo aprovechamiento de espacio
- ✅ **Grid implícito:** Distribución perfecta
- ✅ **Tipografía escalada:** Todo legible sin ocupar demasiado espacio
- ✅ **Sin overflow:** Notas y footer en posiciones fijas

---

## 8. Testing y Validación

### Casos de Uso Probados:

| Caso | Opciones | Asegurados | Resultado |
|------|----------|------------|-----------|
| Simple | 1 | 1-4 | ✅ Cabe en 1 página |
| Simple | 1 | 5+ | ✅ Cabe (ajuste automático) |
| Comparativo | 2 | 1-3 | ✅ Cabe en 1 página |
| Comparativo | 3 | 1-3 | ✅ Cabe en 1 página |
| Con logo | 1-3 | Variable | ✅ Logo visible |
| Sin logo | 1-3 | Variable | ✅ Espacio aprovechado |

### Verificación Visual:

- ✅ Logo no distorsionado
- ✅ Texto legible en todos los tamaños
- ✅ Colores contrastados
- ✅ Tabla completa visible
- ✅ Separadores sutiles
- ✅ Footer siempre visible
- ✅ Mejor precio destacado

---

## 9. Conclusión

El PDF de cotización GMM BX+ ha sido **completamente rediseñado** para cumplir con todas las especificaciones:

✅ **Una sola página horizontal**
✅ **Formato único para modo simple y comparativo**
✅ **Asegurados con primas individuales por columna**
✅ **Tabla comparativa de 15 coberturas adicionales con ✓/✗**
✅ **Coberturas básicas sin primas**
✅ **Notas importantes y footer fijo**
✅ **Diseño profesional sin sombras ni degradados**
✅ **Todo visible, sin scroll ni overflow**
✅ **Mejor precio destacado con badge verde**
✅ **Logo jerárquico (Mi Logotipo → Oficina → JIRO)**

**El sistema está listo y funciona en todas las ubicaciones donde se descarga el PDF.**

---

**Archivo modificado:** `src/lib/gmmPdfUnified.ts`
**Compilación:** ✅ Exitosa
**Estado:** ✅ Completamente implementado y funcionando
