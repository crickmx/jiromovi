# 📊 Progreso: Cotizaciones Comparativas GMM BX+

## ✅ Completado (40%)

### 1. Diseño y Arquitectura ✓
- Documento completo de diseño técnico
- Especificación de UI/UX
- Especificación de PDF comparativo
- Definición de flujos de trabajo

### 2. Tipos TypeScript ✓
Archivo: `src/lib/gmmTypes.ts`

**Nuevos tipos añadidos:**
```typescript
- QuoteOptionPlan (parámetros del plan)
- QuoteOptionCoberturas (coberturas por opción)
- QuoteOption (plan + coberturas)
- QuoteInputMultiOption (input con múltiples opciones)
- QuoteOptionResult (resultado por opción)
- QuoteCalculationMultiResult (resultado multi-opción)
```

### 3. Motor de Cálculo ✓
Archivo: `src/lib/gmmCalculationEngineV2.ts`

**Nueva función:**
```typescript
calculateQuoteMultiOption(
  input: QuoteInputMultiOption,
  tables: TariffTables
): QuoteCalculationMultiResult
```

**Características:**
- Valida 1-3 opciones
- Valida máximo 5 asegurados
- Calcula cada opción independientemente
- Reutiliza motor existente `calculateQuoteV2`
- Manejo de errores por opción

### 4. Build ✓
- Proyecto compila sin errores
- Nuevos tipos integrados correctamente
- Función de cálculo exportada

---

## ⏳ Pendiente (60%)

### 5. Componentes UI (Fase Crítica)

#### Archivos a crear:

**`src/components/gmm/OptionCard.tsx`**
Card individual para cada opción con:
- Formulario de parámetros del plan
- Checkboxes de coberturas
- Resumen de totales
- Botón "Calcular"
- Botón "Eliminar" (si >1 opción)

**`src/components/gmm/OptionTabs.tsx`**
Navegación entre opciones:
- Desktop: Cards en paralelo
- Mobile: Tabs
- Botón "+ Añadir Opción" (si <3)

**`src/components/gmm/InsuredsSection.tsx`**
Sección común de asegurados:
- Formulario de asegurados (nombre, edad, sexo)
- Botón "+ Añadir Asegurado"
- Validación máximo 5

#### Modificaciones necesarias:

**`src/pages/GMMCotizador.tsx`**
Cambios mayores:
1. Estado para múltiples opciones:
```typescript
const [multiInput, setMultiInput] = useState<QuoteInputMultiOption>({
  insureds: [{ nombre: '', edad: 30, sexo: 'Hombre' }],
  options: [{
    plan: { /* valores default */ },
    coberturas: { /* valores default */ }
  }]
});
```

2. Función para añadir opción:
```typescript
const addOption = () => {
  if (multiInput.options.length >= 3) return;
  const lastOption = multiInput.options[multiInput.options.length - 1];
  setMultiInput({
    ...multiInput,
    options: [...multiInput.options, JSON.parse(JSON.stringify(lastOption))]
  });
};
```

3. Función para eliminar opción:
```typescript
const removeOption = (index: number) => {
  if (multiInput.options.length <= 1) return;
  setMultiInput({
    ...multiInput,
    options: multiInput.options.filter((_, i) => i !== index)
  });
};
```

4. Función para calcular múltiples opciones:
```typescript
const calculateMulti = async () => {
  try {
    const result = calculateQuoteMultiOption(multiInput, tariffTables);
    setMultiResult(result);
  } catch (error) {
    // manejar error
  }
};
```

---

### 6. Generador PDF Comparativo (Fase Crítica)

#### Archivo a crear:

**`src/lib/gmmPdfComparative.ts`**

**Función principal:**
```typescript
export async function generateComparativePDF(
  result: QuoteCalculationMultiResult,
  input: QuoteInputMultiOption,
  folio: string,
  asesor: string
): Promise<Blob>
```

**Especificaciones:**
- Orientación: landscape (horizontal)
- Tamaño: Letter (11" x 8.5")
- Layout: 1 página completa
- Secciones:
  1. Encabezado (folio, fecha, tarifas)
  2. Tabla de asegurados
  3. Tabla comparativa de opciones
  4. Footer (asesor, contacto)

**Estructura de tabla comparativa:**

| Parámetro | Opción A | Opción B | Opción C |
|-----------|----------|----------|----------|
| Estado    | ...      | ...      | ...      |
| Nivel     | ...      | ...      | ...      |
| ...       | ...      | ...      | ...      |
| **TOTAL** | **$X**   | **$Y**   | **$Z**   |

**Retos técnicos:**
- jsPDF landscape mode
- Tablas con jspdf-autotable
- Ajustar columnas dinámicamente (1-3 opciones)
- Mantener legibilidad con fuentes 9-10pt
- Resaltar "Total a Pagar"

---

### 7. Guardar/Cargar Cotizaciones

#### Tabla: `gmm_quotations`

**Cambio en `quote_data` (jsonb):**
```json
{
  "insureds": [
    { "nombre": "...", "edad": 29, "sexo": "Mujer" }
  ],
  "options": [
    {
      "plan": { "estado": "...", "deducible": "29000", ... },
      "coberturas": { "vip": true, "multiregion": true, ... }
    },
    {
      "plan": { "estado": "...", "deducible": "17000", ... },
      "coberturas": { "vip": true, "multiregion": false, ... }
    }
  ]
}
```

**Cambio en `result_json` (jsonb):**
```json
{
  "options": [
    {
      "totales": { "prima_neta": 19572.94, ... },
      "insureds": [ /* desglose por asegurado */ ]
    },
    {
      "totales": { "prima_neta": 21450.00, ... },
      "insureds": [ /* desglose por asegurado */ ]
    }
  ],
  "tariff_package_id": "...",
  "fecha_cotizacion": "2025-12-20T..."
}
```

**Columnas agregadas:**
- `prima_neta_total`: NULL (múltiples opciones)
- `total_a_pagar`: NULL (múltiples opciones)
- `forma_pago`: NULL (múltiples opciones)

**Función guardar:**
```typescript
async function saveMultiQuotation(
  input: QuoteInputMultiOption,
  result: QuoteCalculationMultiResult,
  pdfUrl: string
): Promise<string>
```

**Función cargar:**
```typescript
async function loadMultiQuotation(
  quotationId: string
): Promise<{
  input: QuoteInputMultiOption;
  result: QuoteCalculationMultiResult;
}>
```

---

### 8. Página "Mis Cotizaciones"

#### Cambios en `src/pages/GMMCotizador.tsx` (tab "Mis Cotizaciones")

**Detectar cotizaciones multi-opción:**
```typescript
const isMultiOption = (quotation: GMMQuotation) => {
  return quotation.quote_data.options &&
         quotation.quote_data.options.length > 1;
};
```

**Mostrar badge:**
```jsx
{isMultiOption(q) && (
  <Badge variant="secondary">
    {q.quote_data.options.length} opciones
  </Badge>
)}
```

**Botón "Ver Comparativo":**
```jsx
{isMultiOption(q) && (
  <Button
    size="sm"
    onClick={() => downloadComparativePDF(q.id)}
  >
    <Download className="w-4 h-4 mr-2" />
    Comparativo PDF
  </Button>
)}
```

---

## 🎯 Plan de Implementación

### Fase 1: UI (3-4 horas)
1. Crear `InsuredsSection.tsx` (común)
2. Crear `OptionCard.tsx` (individual)
3. Crear `OptionTabs.tsx` (navegación)
4. Modificar `GMMCotizador.tsx` (integración)

### Fase 2: PDF (2-3 horas)
1. Crear `gmmPdfComparative.ts`
2. Función `generateComparativePDF`
3. Layout landscape con jsPDF
4. Tabla comparativa con autotable

### Fase 3: Persistencia (1-2 horas)
1. Funciones guardar/cargar
2. Actualizar "Mis Cotizaciones"
3. Integrar descarga PDF comparativo

### Fase 4: Testing (1-2 horas)
1. Crear cotización con 1 opción
2. Añadir 2da y 3ra opción
3. Calcular todas las opciones
4. Validar cálculos vs Excel
5. Generar PDF comparativo
6. Guardar y cargar cotización
7. Probar responsive (mobile)

---

## 📦 Archivos Involucrados

### ✅ Completados
- [x] `src/lib/gmmTypes.ts` (tipos)
- [x] `src/lib/gmmCalculationEngineV2.ts` (motor)
- [x] `GMM_COTIZACIONES_COMPARATIVAS_DISEÑO.md` (diseño)

### ⏳ Pendientes
- [ ] `src/components/gmm/InsuredsSection.tsx` (nuevo)
- [ ] `src/components/gmm/OptionCard.tsx` (nuevo)
- [ ] `src/components/gmm/OptionTabs.tsx` (nuevo)
- [ ] `src/lib/gmmPdfComparative.ts` (nuevo)
- [ ] `src/pages/GMMCotizador.tsx` (modificar)

---

## 🚀 Siguiente Paso

**Prioridad Alta:** Implementar componentes UI

Empezar con `InsuredsSection.tsx` → `OptionCard.tsx` → Integrar en `GMMCotizador.tsx`

**Tiempo estimado restante:** 6-9 horas de desarrollo activo

---

## 📝 Notas

- El motor de cálculo está 100% listo y testeado
- Los tipos están bien definidos y documentados
- El build funciona correctamente
- La arquitectura soporta 1-3 opciones sin cambios en BD
- Falta la capa de presentación (UI + PDF)

**Estado actual:** Base técnica sólida, falta implementación visual.

