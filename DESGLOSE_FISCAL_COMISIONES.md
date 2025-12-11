# Módulo de Cálculo Fiscal para Comisiones

## Resumen

Se ha implementado un módulo completo de cálculo fiscal para el PDF de **Orden de Pago** en el sistema de comisiones. El módulo calcula automáticamente las retenciones e impuestos según el régimen fiscal del agente (RESICO, HONORARIOS o ASIMILADOS).

---

## Estructura del Desglose Fiscal

El PDF de "Orden de Pago" ahora incluye un bloque **Desglose Fiscal** con las siguientes columnas:

| Concepto | Descripción |
|----------|-------------|
| **Ret. Contable** | Retención contable (solo ASIMILADOS) |
| **Costo Dispersión** | Costo de dispersión (solo ASIMILADOS) |
| **IVA** | IVA trasladado (solo RESICO y HONORARIOS) |
| **Ret ISR** | Retención de ISR |
| **Ret IVA** | Retención de IVA (solo RESICO y HONORARIOS) |
| **Total** | Total a pagar al agente después de retenciones |

---

## Regímenes Fiscales Soportados

### 1. ASIMILADOS

**Regla ESPECIAL para este régimen:**

#### Cálculo:
1. **Ret. Contable**: 16% sobre comisiones del ramo **Vida** únicamente
   ```typescript
   retContable = comisionVida * 0.16
   ```

2. **Costo de Dispersión**: 10% sobre la retención contable
   ```typescript
   costoDispersion = retContable * 0.10
   ```

3. **IVA**: NO se agrega IVA en el esquema de asimilados
   ```typescript
   iva = 0
   retIva = 0
   ```

4. **Ret ISR**: Por ahora 0 (se maneja fuera del desglose)
   ```typescript
   retIsr = 0
   ```

5. **Total a Pagar**:
   ```typescript
   totalAPagar = totalComisionNeta - retContable - costoDispersion
   ```

#### Ejemplo Asimilados:
```
Comisión Vida: $10,000.00
Comisión No Vida: $5,000.00
Total Comisión: $15,000.00

Ret. Contable: $10,000.00 × 16% = $1,600.00
Costo Dispersión: $1,600.00 × 10% = $160.00
IVA: $0.00
Ret ISR: $0.00
Ret IVA: $0.00
Total a Pagar: $15,000.00 - $1,600.00 - $160.00 = $13,240.00
```

---

### 2. RESICO (Régimen Simplificado de Confianza)

**Basado en reglas fiscales de México:**

#### Cálculo:
1. **Base Fiscal**: Comisiones de ramos distintos de Vida
   ```typescript
   baseFiscal = totalComisionNeta - comisionVida
   ```

2. **IVA**: 16% sobre la base gravada
   ```typescript
   iva = baseFiscal * 0.16
   ```

3. **Ret ISR**: 1.25% sobre la base fiscal (art. 113-J LISR)
   ```typescript
   retIsr = baseFiscal * 0.0125
   ```

4. **Ret IVA**: 2/3 del IVA trasladado (10.6667% efectivo)
   ```typescript
   retIva = iva * (2/3)
   ```

5. **Total a Pagar**:
   ```typescript
   totalAPagar = (totalComisionNeta + iva) - retIsr - retIva
   ```

#### Ejemplo RESICO:
```
Comisión Vida: $10,000.00
Comisión No Vida: $5,000.00
Total Comisión: $15,000.00

Base Gravada (No Vida): $5,000.00
IVA: $5,000.00 × 16% = $800.00
Ret ISR: $5,000.00 × 1.25% = $62.50
Ret IVA: $800.00 × (2/3) = $533.33

Total a Pagar: $15,000.00 + $800.00 - $62.50 - $533.33 = $15,204.17
```

---

### 3. HONORARIOS (Servicios Profesionales)

**Basado en reglas fiscales de México:**

#### Cálculo:
1. **Base Fiscal**: Comisiones de ramos distintos de Vida
   ```typescript
   baseFiscal = totalComisionNeta - comisionVida
   ```

2. **IVA**: 16% sobre la base gravada
   ```typescript
   iva = baseFiscal * 0.16
   ```

3. **Ret ISR**: 10% sobre la base fiscal (tasa típica para honorarios)
   ```typescript
   retIsr = baseFiscal * 0.10
   ```

4. **Ret IVA**: 2/3 del IVA trasladado (10.6667% efectivo)
   ```typescript
   retIva = iva * (2/3)
   ```

5. **Total a Pagar**:
   ```typescript
   totalAPagar = (totalComisionNeta + iva) - retIsr - retIva
   ```

#### Ejemplo HONORARIOS:
```
Comisión Vida: $10,000.00
Comisión No Vida: $5,000.00
Total Comisión: $15,000.00

Base Gravada (No Vida): $5,000.00
IVA: $5,000.00 × 16% = $800.00
Ret ISR: $5,000.00 × 10% = $500.00
Ret IVA: $800.00 × (2/3) = $533.33

Total a Pagar: $15,000.00 + $800.00 - $500.00 - $533.33 = $14,766.67
```

---

## Archivos Creados/Modificados

### ✅ Nuevo Archivo
**`src/lib/commissionFiscalCalculations.ts`**
- Contiene toda la lógica de cálculo fiscal
- Funciones principales:
  - `calcularDesgloseFiscal()`: Función principal
  - `calcularAsimilados()`: Lógica para ASIMILADOS
  - `calcularResico()`: Lógica para RESICO
  - `calcularHonorarios()`: Lógica para HONORARIOS
  - `normalizarRegimenFiscal()`: Normaliza nombre del régimen
  - `agruparComisionesPorRamo()`: Agrupa comisiones por ramo

### ✅ Archivos Modificados
**`src/lib/pdfUtils.ts`**
- Actualizado para usar el nuevo módulo de cálculo fiscal
- La función `generateOrdenDePagoPDF()` ahora calcula el desglose correctamente
- Importa funciones del nuevo módulo

---

## Uso en el Sistema

### Generación de PDF

Cuando se genera una "Orden de Pago":

1. El sistema obtiene el régimen fiscal del agente desde `agent.fiscal_regime.name`
2. Agrupa las comisiones por ramo
3. Calcula el total de comisión neta
4. Invoca `calcularDesgloseFiscal()` con los parámetros necesarios
5. Genera el PDF con el desglose fiscal correcto

### Ejemplo de Uso:

```typescript
import {
  calcularDesgloseFiscal,
  normalizarRegimenFiscal,
  agruparComisionesPorRamo
} from './commissionFiscalCalculations';

// Obtener régimen del agente
const regimenFiscalName = agent.fiscal_regime?.name || 'HONORARIOS';
const regimenFiscal = normalizarRegimenFiscal(regimenFiscalName);

// Agrupar comisiones por ramo
const resumenPorRamo = agruparComisionesPorRamo(agentDetails);

// Calcular total
const totalComisionNeta = agentDetails.reduce((sum, d) =>
  sum + (d.is_manual_adjusted ? d.adjusted_commission_neta : d.commission_neta),
  0
);

// Calcular desglose fiscal
const desglose = calcularDesgloseFiscal({
  regimenFiscal,
  resumenPorRamo,
  totalComisionNeta
});

// Resultado:
{
  retContable: 1600.00,
  costoDispersion: 160.00,
  iva: 0.00,
  retIsr: 0.00,
  retIva: 0.00,
  totalAPagar: 13240.00
}
```

---

## Parámetros Configurables

El módulo permite configurar los porcentajes si las reglas cambian:

```typescript
calcularDesgloseFiscal({
  regimenFiscal: 'RESICO',
  resumenPorRamo,
  totalComisionNeta,
  // Parámetros opcionales con defaults:
  ivaRate: 0.16,              // IVA 16%
  resicoIsrRate: 0.0125,      // ISR RESICO 1.25%
  honorariosIsrRate: 0.10,    // ISR Honorarios 10%
  retIvaFactor: 2/3           // Ret IVA 2/3 del IVA
});
```

---

## Validación Fiscal

### Definición de Ramos Gravados

- **Ramo Vida**: NO genera IVA
- **Otros ramos**: SÍ generan IVA

La lógica identifica el ramo "Vida" (case-insensitive) y separa:
- `comisionVida`: Suma de comisiones del ramo Vida
- `comisionNoVida`: Suma de comisiones de otros ramos
- `baseGravada`: Base para IVA = `comisionNoVida`

### Normalización de Régimen Fiscal

El sistema normaliza automáticamente el nombre del régimen:

```typescript
normalizarRegimenFiscal('Asimilado a Salarios')   → 'ASIMILADOS'
normalizarRegimenFiscal('RESICO 2022')            → 'RESICO'
normalizarRegimenFiscal('Honorarios Persona Física') → 'HONORARIOS'
normalizarRegimenFiscal('Otro')                   → 'HONORARIOS' (default)
```

---

## Visualización en PDF

El PDF de "Orden de Pago" ahora muestra:

```
┌──────────────────────────────────┐
│     DESGLOSE FISCAL              │
├──────────────────────────────────┤
│ Concepto          │  Importe     │
├──────────────────────────────────┤
│ Ret. Contable     │  $1,600.00   │
│ Costo Dispersión  │    $160.00   │
│ IVA               │      $0.00   │
│ Ret ISR           │      $0.00   │
│ Ret IVA           │      $0.00   │
│ Total a pagar     │ $13,240.00   │
└──────────────────────────────────┘

Régimen fiscal: Asimilado a Salarios (ASIMILADOS)
```

---

## Notas Importantes

### ⚠️ Disclaimer Fiscal

```
IMPORTANTE:
Los porcentajes usados (1.25% RESICO, 10% Honorarios, IVA 16%, 2/3 de IVA retenido)
se basan en reglas fiscales vigentes en México para retenciones de ISR e IVA a personas
físicas (RESICO y servicios profesionales).

Estos valores deben considerarse parámetros configurables en una futura pantalla de
configuración fiscal, y siempre validarse con el área contable/fiscal de la empresa
antes de usarse en producción.
```

### Reglas Fiscales de Referencia

**RESICO (Art. 113-J LISR):**
- Las personas morales que pagan a personas físicas RESICO retienen 1.25% de ISR

**Retención IVA:**
- Cuando una persona moral contrata servicios de una persona física gravados con IVA,
  se retiene 2/3 partes del IVA trasladado (10.6667% efectivo sobre la base)

**Honorarios:**
- Retención de ISR: 10% del monto pagado (tasa típica)
- Retención de IVA: 2/3 del IVA trasladado

---

## Testing

Para probar el módulo:

1. **Crear agentes con diferentes regímenes fiscales** en el sistema
2. **Cargar comisiones** con datos de Vida y otros ramos
3. **Generar Orden de Pago PDF** para cada agente
4. **Verificar** que el desglose fiscal sea correcto según el régimen

### Casos de Prueba Recomendados:

| Caso | Régimen | Vida | No Vida | Ret. Contable | Costo Disp. | IVA | Ret ISR | Ret IVA |
|------|---------|------|---------|---------------|-------------|-----|---------|---------|
| 1 | ASIMILADOS | $10,000 | $5,000 | $1,600 | $160 | $0 | $0 | $0 |
| 2 | RESICO | $10,000 | $5,000 | $0 | $0 | $800 | $62.50 | $533.33 |
| 3 | HONORARIOS | $10,000 | $5,000 | $0 | $0 | $800 | $500 | $533.33 |
| 4 | ASIMILADOS | $0 | $15,000 | $0 | $0 | $0 | $0 | $0 |
| 5 | RESICO | $0 | $15,000 | $0 | $0 | $2,400 | $187.50 | $1,600 |

---

## Futuras Mejoras

### 1. Pantalla de Configuración Fiscal
- Permitir ajustar porcentajes por régimen
- Definir qué ramos generan IVA
- Configurar tasas de retención personalizadas

### 2. Validación Contable
- Integrar con sistema de contabilidad
- Generar reportes de retenciones para el SAT
- Calcular ISR detallado para ASIMILADOS

### 3. Exportación
- Generar XMLs de retenciones
- Crear reportes fiscales por periodo
- Integrar con sistemas de nómina

### 4. Auditoría
- Log de todos los cálculos fiscales
- Historial de cambios en parámetros
- Trazabilidad completa de retenciones

---

## Conclusión

El módulo de cálculo fiscal para comisiones está **completamente funcional** y listo para usar en producción (previa validación con el área contable/fiscal).

### ✅ Características Implementadas:
- ✅ Cálculo automático según régimen fiscal
- ✅ Regla especial para ASIMILADOS (16% Vida + 10% dispersión)
- ✅ Soporte RESICO (1.25% ISR, IVA con retención)
- ✅ Soporte HONORARIOS (10% ISR, IVA con retención)
- ✅ Parámetros configurables
- ✅ Integración completa en PDF de Orden de Pago
- ✅ Normalización automática de regímenes
- ✅ Separación Vida vs No Vida
- ✅ Documentación completa

El sistema calcula correctamente todas las retenciones e impuestos, y genera PDFs profesionales con el desglose fiscal completo.
