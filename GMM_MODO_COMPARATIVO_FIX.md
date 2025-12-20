# ✅ Modo Comparativo GMM BX+ - Cálculo y Guardado Corregido

## 🐛 Problemas Identificados y Resueltos

### **Problema 1: Primas Mostraban $0**

**Causa Raíz:**
- El resultado de `calculateQuoteMultiOption` no incluía los campos `prima_neta_total` y `tope_coaseguro` en la estructura `QuoteOptionResult`
- El componente `MultiOptionQuote` intentaba acceder a estos campos que no existían

**Solución Implementada:**

#### 1. Actualización del Tipo `QuoteOptionResult`
📁 `src/lib/gmmTypes.ts`

```typescript
export interface QuoteOptionResult {
  totales: {
    prima_neta: number;
    gastos_expedicion: number;
    subtotal: number;
    iva: number;
    total_pagar: number;
    forma_pago: string;
    recargo: number;
    primer_recibo: number;
    recibos_subsecuentes: number | null;
  };
  prima_neta_total: number;        // ✅ AGREGADO
  tope_coaseguro: number | null;    // ✅ AGREGADO
  insureds: InsuredCalculation[];
  plan: QuoteOptionPlan;
  coberturas: QuoteOptionCoberturas;
}
```

#### 2. Actualización del Engine de Cálculo
📁 `src/lib/gmmCalculationEngineV2.ts`

**Antes:**
```typescript
results.push({
  totales: { /* ... */ },
  insureds: result.insureds,
  plan: option.plan,
  coberturas: option.coberturas
});
```

**Ahora:**
```typescript
results.push({
  totales: { /* ... */ },
  prima_neta_total: result.prima_neta_total,        // ✅ AGREGADO
  tope_coaseguro: result.tope_coaseguro || null,    // ✅ AGREGADO
  insureds: result.insureds,
  plan: option.plan,
  coberturas: option.coberturas
});
```

---

### **Problema 2: Faltaba Opción de Guardar**

**Causa Raíz:**
- No había una función para guardar cotizaciones comparativas
- El componente `MultiOptionQuote` no recibía un callback `onSave`

**Solución Implementada:**

#### 1. Nueva Función de Guardado
📁 `src/pages/GMMCotizador.tsx`

```typescript
async function handleSaveMultiOption(multiResult: QuoteCalculationMultiResult) {
  if (!multiResult || !multiResult.options || multiResult.options.length === 0) {
    alert('Calcule las opciones primero');
    return;
  }

  if (!input.insureds[0].nombre) {
    alert('Ingrese el nombre del asegurado principal');
    return;
  }

  setSaving(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    // Usar la primera opción como base para datos principales
    const firstOption = multiResult.options[0];

    const quotationData = {
      usuario_id: user.id,
      estado: 'active',
      producto: 'GMM BX+ Comparativa',
      cliente_nombre: null,
      asegurado_principal: input.insureds[0].nombre,
      quote_data: {
        insureds: input.insureds,
        multi_option_result: multiResult,
      },
      coverage_selections: firstOption.coberturas,
      prima_neta_total: firstOption.prima_neta_total,
      total_a_pagar: firstOption.totales.total_pagar,
      forma_pago: firstOption.totales.forma_pago,
      editada_desde_cotizacion_id: null,
    };

    const { data: quotation, error: quotationError } = await supabase
      .from('gmm_quotations')
      .insert(quotationData)
      .select()
      .single();

    if (quotationError) throw quotationError;

    alert(`Cotización comparativa guardada: ${quotation.folio}`);
    setActiveTab('cotizaciones');
    loadQuotes();
  } catch (error: any) {
    console.error('Error saving multi-option:', error);
    alert(`Error: ${error.message}`);
  } finally {
    setSaving(false);
  }
}
```

#### 2. Botón de Guardar en el Componente
📁 `src/components/gmm/MultiOptionQuote.tsx`

```tsx
<div className="flex justify-center gap-3">
  <Button
    onClick={handleCalculate}
    disabled={calculating}
    size="lg"
    className="px-8"
  >
    <Calculator className="h-5 w-5 mr-2" />
    {calculating ? 'Calculando...' : 'Calcular Todas las Opciones'}
  </Button>

  {result && onSave && (
    <Button
      onClick={() => onSave(result)}
      variant="outline"
      size="lg"
      className="px-8"
    >
      <Save className="h-5 w-5 mr-2" />
      Guardar Comparativa
    </Button>
  )}
</div>
```

---

## 🎨 Mejora Adicional: Tabla Comparativa

Se agregó una tabla comparativa completa que aparece después del cálculo:

```tsx
{/* Tabla Comparativa de Resultados */}
{result && result.options.length > 0 && (
  <Card className="p-6 mt-8">
    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
      <FileText className="h-5 w-5" />
      Comparativa de Resultados
    </h3>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-3">Concepto</th>
            <th>Opción A</th>
            <th>Opción B</th>
            {/* ... más opciones ... */}
          </tr>
        </thead>
        <tbody>
          {/* Filas: Suma Asegurada, Deducible, Coaseguro, Tope, etc. */}
        </tbody>
      </table>
    </div>

    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
      <h4 className="font-semibold mb-2 text-sm">Mejor Opción (Precio más bajo)</h4>
      <p className="text-sm text-gray-700">
        {/* Calcula automáticamente la opción más económica */}
      </p>
    </div>
  </Card>
)}
```

**La tabla muestra:**
- ✅ Suma Asegurada (con formato moneda)
- ✅ Deducible (con formato moneda)
- ✅ Coaseguro (con formato porcentaje)
- ✅ Tope de Coaseguro (con formato moneda)
- ✅ Prima Neta Total
- ✅ Gastos de Expedición
- ✅ IVA
- ✅ **Total a Pagar** (destacado en verde)
- ✅ Mejor opción (precio más bajo) calculado automáticamente

---

## 🔧 Ajustes de Límites

**Antes:** Máximo 3 opciones
**Ahora:** Máximo 5 opciones

📁 `src/lib/gmmCalculationEngineV2.ts`
```typescript
if (input.options.length > 5) {
  throw new Error('[MULTI-OPTION] Máximo 5 opciones permitidas');
}
```

---

## 📊 Flujo Completo del Modo Comparativo

### **1. Configuración**
```
Usuario configura:
├── Asegurados (comunes a todas las opciones)
├── Formas de pago (aplican a todas las opciones)
└── Opciones individuales (2-5 opciones)
    ├── Estado, Nivel Hospitalario, Tabulador
    ├── Suma Asegurada, Deducible, Coaseguro
    └── Coberturas Adicionales (15 disponibles)
```

### **2. Cálculo**
```
Al hacer clic en "Calcular Todas las Opciones":
├── Se validan todos los campos
├── Se actualizan formas de pago en cada opción
├── Se llama a calculateQuoteMultiOption()
│   ├── Para cada opción:
│   │   ├── Se crea QuoteInput individual
│   │   ├── Se calcula con calculateQuoteV2()
│   │   └── Se agrega prima_neta_total y tope_coaseguro
│   └── Retorna QuoteCalculationMultiResult
└── Se muestra:
    ├── Resultado en cada card de opción
    │   ├── Total a Pagar (grande y azul)
    │   ├── Prima Neta
    │   └── Tope Coaseguro
    └── Tabla comparativa completa
```

### **3. Guardado**
```
Al hacer clic en "Guardar Comparativa":
├── Se valida que haya resultado
├── Se crea registro en gmm_quotations:
│   ├── producto: 'GMM BX+ Comparativa'
│   ├── quote_data: { insureds, multi_option_result }
│   ├── Prima/Total de la primera opción (referencia)
│   └── Todas las opciones guardadas en multi_option_result
├── Se genera folio único
└── Se navega a "Mis Cotizaciones"
```

---

## 📁 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/lib/gmmTypes.ts` | Agregado `prima_neta_total` y `tope_coaseguro` a `QuoteOptionResult` |
| `src/lib/gmmCalculationEngineV2.ts` | Incluye nuevos campos en resultado + límite a 5 opciones |
| `src/components/gmm/MultiOptionQuote.tsx` | Botón guardar + tabla comparativa + mejor opción |
| `src/pages/GMMCotizador.tsx` | Nueva función `handleSaveMultiOption` + callback a componente |

---

## ✅ Validación de Cambios

### **Verificación Manual**

1. **Cálculo Correcto:**
   ```
   ✅ Ir a "GMM Cotizador"
   ✅ Activar "Modo Comparativo"
   ✅ Agregar asegurado con nombre
   ✅ Configurar 2-3 opciones diferentes
   ✅ Hacer clic en "Calcular Todas las Opciones"
   ✅ Verificar que TODAS las opciones muestran valores correctos (NO $0)
   ✅ Verificar que aparece tabla comparativa
   ```

2. **Guardado Correcto:**
   ```
   ✅ Después de calcular, verificar que aparece botón "Guardar Comparativa"
   ✅ Hacer clic en "Guardar Comparativa"
   ✅ Verificar mensaje: "Cotización comparativa guardada: GMM-XXXX"
   ✅ Ir a "Mis Cotizaciones"
   ✅ Verificar que aparece con producto "GMM BX+ Comparativa"
   ```

3. **Tabla Comparativa:**
   ```
   ✅ Verificar que muestra todas las opciones calculadas
   ✅ Verificar formatos:
      - Suma Asegurada: $50,000,000
      - Deducible: $29,000
      - Coaseguro: 10%
      - Total a Pagar: destacado en verde
   ✅ Verificar que indica "Mejor Opción (Precio más bajo)"
   ```

---

## 🎯 Comparativa Antes/Después

### **ANTES ❌**
```
┌─────────────────────────────────┐
│ Opción A                        │
│ ─────────────────────────────   │
│ [Configuración...]              │
│                                 │
│ Total a Pagar                   │
│ $0                          ❌ │
│ Prima Neta: $0              ❌ │
└─────────────────────────────────┘

[Calcular Todas las Opciones]
❌ No hay botón de guardar
❌ No hay tabla comparativa
```

### **AHORA ✅**
```
┌─────────────────────────────────┐
│ Opción A                        │
│ ─────────────────────────────   │
│ [Configuración...]              │
│                                 │
│ Total a Pagar                   │
│ $18,245                     ✅ │
│ Prima Neta: $15,234         ✅ │
│ Tope Coaseguro: $50,000     ✅ │
└─────────────────────────────────┘

[Calcular Todas las Opciones] [Guardar Comparativa] ✅

┌────────────────────────────────────────────────┐
│ 📄 Comparativa de Resultados            ✅   │
├────────────────┬──────────┬──────────┬────────┤
│ Concepto       │ Opción A │ Opción B │ Opc. C │
├────────────────┼──────────┼──────────┼────────┤
│ Suma Asegurada │ $50M     │ $50M     │ $50M   │
│ Deducible      │ $29K     │ $17K     │ $0     │
│ Coaseguro      │ 10%      │ 10%      │ 0%     │
│ Prima Neta     │ $15,234  │ $16,890  │ $19,230│
│ Total a Pagar  │ $18,245  │ $20,123  │ $22,890│
└────────────────┴──────────┴──────────┴────────┘

💡 Mejor Opción: Opción A - $18,245     ✅
```

---

## 🚀 Estado Final

| Funcionalidad | Estado |
|---------------|--------|
| Cálculo de múltiples opciones | ✅ Funcionando |
| Mostrar primas correctas | ✅ Funcionando |
| Mostrar tope coaseguro | ✅ Funcionando |
| Tabla comparativa visual | ✅ Agregada |
| Indicador mejor opción | ✅ Agregado |
| Botón "Guardar Comparativa" | ✅ Funcionando |
| Guardado en base de datos | ✅ Funcionando |
| Hasta 5 opciones | ✅ Soportado |
| Build sin errores | ✅ Exitoso |

---

## 📝 Notas Importantes

1. **Estructura de Guardado:**
   - Las cotizaciones comparativas se guardan con `producto: 'GMM BX+ Comparativa'`
   - El campo `quote_data.multi_option_result` contiene todas las opciones calculadas
   - Los valores principales (prima, total) corresponden a la primera opción (referencia)

2. **Compatibilidad:**
   - Las cotizaciones simples siguen funcionando igual
   - Las cotizaciones comparativas no interfieren con el flujo normal
   - Se pueden mezclar ambos tipos en "Mis Cotizaciones"

3. **Validaciones:**
   - Mínimo 2 opciones para comparación
   - Máximo 5 opciones permitidas
   - Al menos 1 forma de pago requerida
   - Nombre de asegurado principal obligatorio para guardar

---

**Fecha de Corrección**: 20 de Diciembre, 2024
**Versión**: 2.1.0
**Estado**: ✅ Completamente Funcional
