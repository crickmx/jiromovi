# 📋 Diseño: Cotizaciones Comparativas GMM BX+

## 🎯 Objetivo

Permitir crear hasta 3 opciones de cotización para los mismos asegurados, variando parámetros del plan y coberturas opcionales, y generar un PDF comparativo en una sola página horizontal.

---

## 📊 Esquema de Datos

### Estructura Actual (QuoteInput)

```typescript
interface QuoteInput {
  zona: string;
  estado: string;
  nivel_hospitalario: string;
  tabulador: string;
  suma_asegurada: string;
  deducible: string;
  coaseguro: string;
  formas_pago: string[];
  insureds: QuoteInputInsured[];
  coberturas: {
    medicamentos_fuera?: boolean;
    eliminacion_deducible_accidente?: boolean;
    multiregion?: boolean;
    vip?: boolean;
    emergencia_medica_extranjero?: boolean;
    // ... otras
  };
  montos: Record<string, any>;
}
```

### Nueva Estructura (QuoteInputMultiOption)

```typescript
interface QuoteInputInsured {
  nombre: string;
  sexo: 'Hombre' | 'Mujer';
  edad: number;
}

interface QuoteOptionPlan {
  zona: string;
  estado: string;
  nivel_hospitalario: string;
  tabulador: string;
  suma_asegurada: string;
  deducible: string;
  coaseguro: string;
  formas_pago: string[];
  montos: Record<string, any>;
}

interface QuoteOptionCoberturas {
  medicamentos_fuera?: boolean;
  eliminacion_deducible_accidente?: boolean;
  multiregion?: boolean;
  vip?: boolean;
  emergencia_medica_extranjero?: boolean;
  // ... otras
}

interface QuoteOption {
  plan: QuoteOptionPlan;
  coberturas: QuoteOptionCoberturas;
}

interface QuoteInputMultiOption {
  // Asegurados comunes a todas las opciones
  insureds: QuoteInputInsured[];

  // 1 a 3 opciones de cotización
  options: QuoteOption[];
}
```

### Nueva Estructura de Resultados

```typescript
interface QuoteOptionResult {
  // Totales por opción
  totales: {
    prima_neta: number;
    gastos_expedicion: number;
    subtotal: number;
    iva: number;
    total_pagar: number;
    forma_pago: string;
  };

  // Desglose por asegurado
  insureds: InsuredCalculation[];

  // Parámetros del plan (copia para referencia)
  plan: QuoteOptionPlan;
  coberturas: QuoteOptionCoberturas;
}

interface QuoteCalculationMultiResult {
  // Resultados por opción
  options: QuoteOptionResult[];

  // Metadata
  tariff_package_id: string;
  fecha_cotizacion: string;
}
```

---

## 🗄️ Cambios en Base de Datos

### Tabla: gmm_quotations

**Cambios en columnas:**

- `quote_data` (jsonb):
  - **Antes:** Contenía todo el plan + asegurados juntos
  - **Ahora:** Contiene `{ insureds: [...], options: [{plan: {...}, coberturas: {...}}] }`

- `coverage_selections` (jsonb):
  - **Deprecado** cuando hay múltiples opciones
  - Cada opción tiene su propio objeto `coberturas`

- `prima_neta_total` (numeric):
  - Si hay 1 opción: valor de esa opción
  - Si hay >1 opción: NULL (calcular on-the-fly por opción)

- `total_a_pagar` (numeric):
  - Si hay 1 opción: valor de esa opción
  - Si hay >1 opción: NULL (calcular on-the-fly por opción)

- `forma_pago` (text):
  - Si hay 1 opción: valor de esa opción
  - Si hay >1 opción: NULL (cada opción tiene su forma de pago)

**NO se requieren nuevas columnas.** Todo se maneja en los campos JSONB existentes.

---

## 🎨 Diseño de UI/UX

### Estructura del Cotizador

```
┌─────────────────────────────────────────────────────┐
│              COTIZADOR GMM BX+                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  📋 ASEGURADOS (común para todas las opciones)      │
│  ┌──────────────────────────────────────────────┐  │
│  │ Nombre    Edad    Sexo                       │  │
│  │ [___]     [__]    [____]    [+ Añadir]       │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ⚡ OPCIONES DE COTIZACIÓN                          │
│                                                      │
│  [Cotización A] [Cotización B] [Cotización C]       │
│       (activa)      (inactiva)     (+ Añadir)       │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │  COTIZACIÓN A                           [X]  │   │
│  │                                              │   │
│  │  Estado/Zona: [____________]                │   │
│  │  Nivel: [_____] Tabulador: [_____]          │   │
│  │  SA: [________] Deducible: [_____]          │   │
│  │  Coaseguro: [___] Tope: $48,000             │   │
│  │  Forma de pago: [______]                    │   │
│  │                                              │   │
│  │  ☑ Coberturas Opcionales:                   │   │
│  │  □ Medicamentos fuera del hospital          │   │
│  │  □ Eliminación deducible por accidente      │   │
│  │  □ Multiregión                              │   │
│  │  □ VIP                                      │   │
│  │  □ Emergencia médica en el extranjero       │   │
│  │                                              │   │
│  │  ──────────────────────────────────────     │   │
│  │  Prima neta: $19,572.94                     │   │
│  │  Total a pagar: $23,748.61                  │   │
│  │                                              │   │
│  │  [Calcular]                                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  [+ Añadir Opción]                                  │
│                                                      │
│  [Guardar Cotización] [Generar PDF Comparativo]    │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Comportamiento de Botones

#### Añadir Opción
- Visible cuando hay <3 opciones
- Clona la opción actual como plantilla (mejora UX)
- Crea nueva pestaña/card
- Máximo: 3 opciones

#### Eliminar Opción
- Visible solo cuando hay >1 opción
- Botón [X] en esquina superior derecha de cada card
- Requiere confirmación modal:
  ```
  ¿Eliminar esta opción?
  Esta acción no se puede deshacer.
  [Cancelar] [Eliminar]
  ```

#### Calcular
- Por opción individual
- Recalcula solo la opción activa
- Actualiza resumen en tiempo real

#### Guardar Cotización
- Guarda todas las opciones
- Genera folio único
- Estado: 'active'

#### Generar PDF Comparativo
- Solo disponible si hay al menos 1 opción calculada
- Genera PDF horizontal de 1 página
- Muestra todas las opciones en tabla comparativa

---

## 🔧 Motor de Cálculo

### Función Principal

```typescript
function calculateQuoteMultiOption(
  input: QuoteInputMultiOption,
  tariffTables: TariffTables
): QuoteCalculationMultiResult {
  const results: QuoteOptionResult[] = [];

  for (const option of input.options) {
    // Reconstruir QuoteInput individual por opción
    const singleInput: QuoteInput = {
      ...option.plan,
      insureds: input.insureds,
      coberturas: option.coberturas
    };

    // Calcular usando motor existente
    const result = calculateQuoteV2(singleInput, tariffTables);

    results.push({
      totales: {
        prima_neta: result.prima_neta_total,
        gastos_expedicion: result.gastos_expedicion,
        subtotal: result.subtotal,
        iva: result.iva,
        total_pagar: result.total_a_pagar,
        forma_pago: singleInput.formas_pago[0] || 'ANUAL'
      },
      insureds: result.insureds,
      plan: option.plan,
      coberturas: option.coberturas
    });
  }

  return {
    options: results,
    tariff_package_id: tariffTables.package_id,
    fecha_cotizacion: new Date().toISOString()
  };
}
```

---

## 📄 Generador de PDF Comparativo

### Especificaciones

- **Orientación:** Landscape (horizontal)
- **Tamaño:** Letter (11" x 8.5")
- **Márgenes:** 0.5" todos los lados
- **Fuentes:**
  - Título: 14pt bold
  - Subtítulos: 12pt bold
  - Tabla headers: 10pt bold
  - Tabla contenido: 9pt regular

### Layout de 1 Página

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Comparativo de Cotizaciones GMM BX+                                   │
│  Folio: GMM-2025-00028 | Fecha: 20/12/2024 | Tarifas: v1.0            │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────│
│                                                                         │
│  ASEGURADOS                                                            │
│  ┌──────────────────────────────────────┐                             │
│  │ Nombre         │ Edad │ Sexo         │                             │
│  ├──────────────────────────────────────┤                             │
│  │ Alisson Romero │  29  │ Mujer        │                             │
│  └──────────────────────────────────────┘                             │
│                                                                         │
│  COMPARATIVO DE OPCIONES                                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Parámetro           │ Opción A    │ Opción B    │ Opción C     │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ Estado/Zona         │ Jalisco 1   │ Jalisco 1   │ CDMX 1       │  │
│  │ Nivel Hospitalario  │ PLUS        │ PLUS        │ ELITE        │  │
│  │ Tabulador           │ ORO-110,000 │ ORO-110,000 │ DIAMANTE     │  │
│  │ Suma Asegurada      │ $50,000,000 │ $50,000,000 │ $100,000,000 │  │
│  │ Deducible           │ $29,000     │ $17,000     │ $29,000      │  │
│  │ Coaseguro           │ 10%         │ 10%         │ 0%           │  │
│  │ Tope Coaseguro      │ $48,000     │ $48,000     │ $0           │  │
│  │ Forma de Pago       │ Anual       │ Anual       │ Mensual      │  │
│  │                     │             │             │              │  │
│  │ Coberturas Opcionales                                          │  │
│  │ - Medicamentos      │ ✓           │ ✓           │ ✓            │  │
│  │ - Eliminación Ded.  │ ✓           │ ✓           │ ✗            │  │
│  │ - Multiregión       │ ✓           │ ✗           │ ✓            │  │
│  │ - VIP               │ ✓           │ ✓           │ ✓            │  │
│  │ - Emergencia Ext.   │ ✓           │ ✓           │ ✓            │  │
│  │                     │             │             │              │  │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │
│  │ Prima Neta          │ $19,572.94  │ $21,450.00  │ $35,200.00   │  │
│  │ Gastos Expedición   │ $900.00     │ $900.00     │ $900.00      │  │
│  │ Subtotal            │ $20,472.94  │ $22,350.00  │ $36,100.00   │  │
│  │ IVA (16%)           │ $3,275.67   │ $3,576.00   │ $5,776.00    │  │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│  │
│  │ TOTAL A PAGAR       │ $23,748.61  │ $25,926.00  │ $41,876.00   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  Asesor: Christofer Cruz-Chousal Jiménez                              │
│  www.jiro.mx | Cel. 5520206922                                        │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Validaciones

### Frontend
- Máximo 3 opciones
- Máximo 5 asegurados (para PDF de 1 página)
- Al menos 1 opción debe estar calculada para guardar
- Todos los campos obligatorios por opción

### Backend
- Validar estructura de `quote_data`
- Validar que todas las opciones usen el mismo `tariff_package_id`
- Validar límites (opciones: 1-3, asegurados: 1-5)

---

## 🔄 Flujo de Trabajo

### Crear Nueva Cotización

1. Usuario abre cotizador
2. Añade asegurados (común)
3. Configura Opción A (default)
4. Click "Calcular" → muestra resultados
5. Click "+ Añadir Opción" → crea Opción B (clona A)
6. Modifica parámetros de Opción B
7. Click "Calcular" en Opción B
8. Click "Guardar Cotización"
9. Click "Generar PDF Comparativo"

### Editar Cotización Existente

1. Usuario va a "Mis Cotizaciones"
2. Click "Editar" en una cotización
3. Carga todas las opciones guardadas
4. Puede modificar cualquier opción
5. Puede añadir/eliminar opciones
6. "Guardar" actualiza la cotización
7. Nuevo PDF comparativo se genera

---

## 📦 Archivos a Modificar/Crear

### Modificar

1. `src/lib/gmmTypes.ts`
   - Añadir interfaces de múltiples opciones

2. `src/lib/gmmCalculationEngineV2.ts`
   - Añadir `calculateQuoteMultiOption`

3. `src/pages/GMMCotizador.tsx`
   - UI para múltiples opciones
   - Gestión de estado por opción

4. `src/lib/gmmPdfGenerator.ts`
   - Añadir `generateComparativePDF`

### Crear

1. `src/components/gmm/OptionCard.tsx`
   - Card individual por opción

2. `src/components/gmm/OptionTabs.tsx`
   - Tabs para navegación entre opciones

3. `src/components/gmm/OptionComparison.tsx`
   - Vista comparativa en UI

---

## 🎯 Criterios de Aceptación

- [ ] Usuario puede crear hasta 3 opciones
- [ ] Cada opción se calcula independientemente
- [ ] Los cálculos coinciden con Excel por opción
- [ ] PDF comparativo se genera en 1 página horizontal
- [ ] PDF es claro y legible
- [ ] Guardar/cargar cotizaciones con múltiples opciones funciona
- [ ] Eliminar opciones con confirmación funciona
- [ ] Responsive en mobile (tabs en lugar de cards paralelos)

---

## 📅 Estimación

- **Fase 1:** Esquema de datos y tipos (1h)
- **Fase 2:** Motor de cálculo multi-opción (1h)
- **Fase 3:** UI/UX cotizador (3h)
- **Fase 4:** PDF comparativo (2h)
- **Fase 5:** Testing y ajustes (1h)

**Total:** ~8 horas

