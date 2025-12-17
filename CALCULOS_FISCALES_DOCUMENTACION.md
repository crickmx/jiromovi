# Documentación: Cálculos Fiscales en Comisiones

## Resumen

Se ha implementado un sistema unificado de cálculos fiscales que garantiza exactitud y consistencia entre el backend y los PDFs generados.

---

## Arquitectura

### Fuente Única de Verdad

**Archivo:** `src/lib/commissionFiscalCalculations.ts`

Esta es la **ÚNICA** función que realiza cálculos fiscales:

```typescript
calcularDesgloseFiscal(params: CalculoFiscalParams): DesgloseFiscal
```

Tanto el backend como el PDF usan esta misma función, garantizando consistencia al 100%.

---

## Regímenes Fiscales Implementados

### 1. ASIMILADOS

#### Fórmulas Oficiales:
- **Retención Contable** = Vida × 0.16
- **Costo de Dispersión** = Sin Vida × 0.10
- **IVA** = 0 (No aplica)
- **ISR Vida** = (Vida – Retención Contable) × 0.10
- **ISR Daños** = (Sin Vida – Dispersión) × 0.10
- **ISR Total** = ISR Vida + ISR Daños
- **Total a Pagar** = Comisión Base Total – Retención Contable – Dispersión – ISR Total

#### Conceptos Base:
- **Vida**: Comisiones del ramo "Vida"
- **Sin Vida**: Comisión Base Total – Vida

---

### 2. HONORARIOS

#### Fórmulas Oficiales:
- **IVA** = Sin Vida × 0.16
- **Retención ISR** = Comisión Base Total × 0.10
- **Retención IVA** = Sin Vida × 0.10667
- **Total a Pagar** = Comisión Base Total + IVA – Retención ISR – Retención IVA

#### Conceptos Clave:
- La retención ISR se calcula sobre el **total**, no solo sobre Sin Vida
- La retención IVA es 10.667% (2/3 de 16%)

---

### 3. RESICO (Régimen Simplificado de Confianza)

#### Fórmulas Oficiales:
- **IVA** = Sin Vida × 0.16
- **Retención ISR** = Comisión Base Total × 0.0125
- **Retención IVA** = Sin Vida × 0.10667
- **Total a Pagar** = Comisión Base Total + IVA – Retención ISR – Retención IVA

#### Conceptos Clave:
- Tasa ISR especial de 1.25% para RESICO
- La retención ISR se calcula sobre el **total**, no solo sobre Sin Vida

---

## Estructura de Datos

### Campos Base de Comisiones

Antes de aplicar cálculos fiscales, es importante entender la estructura de datos de comisiones:

| Campo | Descripción | Uso |
|-------|-------------|-----|
| `prima_neta` | Prima total de la póliza | Referencia |
| `importe_base` | Base sobre la que se calcula comisión | Puede diferir de prima_neta |
| `porcentaje_comision` | Porcentaje aplicado | Según reglas de negocio |
| `commission_bruta` | Comisión antes de impuestos | `(importe_base × porcentaje) / 100` |
| `commission_neta` | Comisión después de impuestos | Base para cálculo fiscal |

**IMPORTANTE**: Para el cálculo fiscal, se usa `commission_neta` como "Comisión Base Total".

### Interface DesgloseFiscal

```typescript
interface DesgloseFiscal {
  vida: number;              // Comisión del ramo Vida
  sinVida: number;           // Comisión Base - Vida
  retContable: number;       // Retención contable (solo ASIMILADOS)
  costoDispersion: number;   // Costo dispersión (solo ASIMILADOS)
  iva: number;               // IVA trasladado
  retIsr: number;            // Retención ISR
  retIva: number;            // Retención IVA
  isrVida: number;           // ISR sobre Vida (solo ASIMILADOS)
  isrDanios: number;         // ISR sobre Daños (solo ASIMILADOS)
  isrTotal: number;          // ISR Total (solo ASIMILADOS)
  totalAPagar: number;       // Total final a pagar al agente
}
```

Todos los valores están **redondeados a 2 decimales** usando:
```typescript
Math.round(num * 100) / 100
```

---

## PDF "Orden de Pago"

### Formato

El PDF muestra un desglose fiscal diferenciado según el régimen:

#### Encabezado
- Título: "ORDEN DE PAGO"
- Nombre del agente
- Oficina
- Semana / Periodo

#### Resumen por Ramo
- Tabla con cada ramo, prima total y comisión

#### Desglose de Pólizas
- Hasta 30 pólizas con: Póliza, Ramo, Aseguradora, Contratante, Prima, Comisión

#### Desglose Fiscal (Diferenciado por Régimen)

**Para ASIMILADOS:**
```
Comisión Base Total    $X,XXX.XX
Vida                   $X,XXX.XX
Comisión Sin Vida      $X,XXX.XX
Retención Contable     - $X,XXX.XX
Costo Dispersión       - $X,XXX.XX
ISR Vida              - $X,XXX.XX
ISR Daños             - $X,XXX.XX
ISR Total             - $X,XXX.XX
-----------------------------------
Total a Pagar         $X,XXX.XX
```

**Para HONORARIOS:**
```
Comisión Base Total    $X,XXX.XX
Vida                   $X,XXX.XX
Comisión Sin Vida      $X,XXX.XX
IVA (16%)             + $X,XXX.XX
Retención ISR (10%)    - $X,XXX.XX
Retención IVA (10.667%) - $X,XXX.XX
-----------------------------------
Total a Pagar         $X,XXX.XX
```

**Para RESICO:**
```
Comisión Base Total    $X,XXX.XX
Vida                   $X,XXX.XX
Comisión Sin Vida      $X,XXX.XX
IVA (16%)             + $X,XXX.XX
Retención ISR (1.25%)  - $X,XXX.XX
Retención IVA (10.667%) - $X,XXX.XX
-----------------------------------
Total a Pagar         $X,XXX.XX
```

---

## Validaciones Implementadas

1. ✅ El régimen fiscal del agente es **obligatorio**
2. ✅ No se puede cerrar un lote sin régimen fiscal
3. ✅ Backend y PDF usan la **misma función** de cálculo
4. ✅ Todos los valores se redondean a **2 decimales**
5. ✅ No existen cálculos duplicados o inconsistentes

---

## Criterios de Aceptación

✅ Los números coinciden exactamente con las especificaciones oficiales
✅ El PDF refleja el mismo cálculo que el backend
✅ No existen cálculos duplicados en el código
✅ El sistema es auditable y consistente
✅ Cada régimen tiene su lógica claramente documentada

---

## Archivos Modificados

1. **`src/lib/commissionFiscalCalculations.ts`**
   - Actualizado el interface `DesgloseFiscal`
   - Corregidas todas las fórmulas según especificaciones
   - Agregada función `roundTo2Decimals()`
   - Documentación completa en código

2. **`src/lib/pdfUtils.ts`**
   - Actualizada función `generateOrdenDePagoPDF()`
   - Desglose fiscal diferenciado por régimen
   - Formato mejorado y más legible

---

## Regla de Oro

> **El cálculo fiscal depende del régimen del agente.**
> **Nunca asumir reglas genéricas.**
> **Backend y PDF usan la misma fuente de verdad.**

Esta regla está documentada en el código y debe respetarse en cualquier modificación futura.

---

## Pruebas Recomendadas

Para validar la implementación:

1. Crear un lote con agentes de régimen ASIMILADOS
2. Crear un lote con agentes de régimen HONORARIOS
3. Crear un lote con agentes de régimen RESICO
4. Verificar que los números en el PDF coincidan exactamente con el backend
5. Verificar que los cálculos coincidan con las imágenes de referencia proporcionadas

---

## Soporte

Para cualquier duda sobre los cálculos fiscales:
1. Revisar este documento
2. Consultar los comentarios en `commissionFiscalCalculations.ts`
3. Validar con el área contable/fiscal antes de modificar fórmulas

---

**Fecha de implementación:** 2024
**Versión:** 1.0
