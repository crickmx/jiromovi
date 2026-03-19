# Diagrama de Flujo: Generación de PDF Fiscal

## Flujo ANTERIOR (Incorrecto)

```
┌─────────────────────────────────────────────────────┐
│ Usuario: Generar PDF Orden de Pago                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Sistema: Obtener batch.id del lote                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ ❌ PROBLEMA: Consultar commission_batches            │
│    SELECT iva, ret_isr, ret_iva, total_neto         │
│    WHERE id = batch.id                              │
│                                                      │
│    Resultado: VALORES AGREGADOS DEL LOTE COMPLETO   │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ ❌ BUG: Usar estos valores para TODOS los agentes   │
│    desgloseFiscal = {                               │
│      iva: 2403.85,        ← Mismo para todos        │
│      retIsr: 1502.40,     ← Mismo para todos        │
│      retIva: 1602.57,     ← Mismo para todos        │
│      total: 14322.93      ← Mismo para todos        │
│    }                                                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ ❌ RESULTADO: PDFs incorrectos                       │
│    - Agente A (comisión $10,000): Total $14,322.93  │
│    - Agente B (comisión $20,000): Total $14,322.93  │
│    - Agente C (comisión $5,000):  Total $14,322.93  │
│                                                      │
│    ¡Todos muestran el mismo total!                  │
└─────────────────────────────────────────────────────┘
```

---

## Flujo NUEVO (Correcto)

```
┌─────────────────────────────────────────────────────┐
│ Usuario: Generar PDF Orden de Pago                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Sistema: Obtener agentDetails (pólizas del agente)  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ ✅ CORRECTO: Calcular comisión bruta del agente     │
│    let totalComisionNeta = 0;                       │
│    agentDetails.forEach(detail => {                 │
│      totalComisionNeta += detail.commission_neta;   │
│    });                                              │
│                                                      │
│    Resultado: COMISIÓN INDIVIDUAL del agente        │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Sistema: Obtener régimen fiscal del usuario         │
│    SELECT regimen_fiscal FROM usuarios              │
│    WHERE id = usuario_id                            │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ ✅ CORRECTO: Preparar input único para este agente  │
│    fiscalInput = {                                  │
│      regimenFiscal: 'HONORARIOS',                   │
│      comisionBruta: 15024.05   ← Individual         │
│    }                                                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ ✅ FUNCIÓN PURA: calcularPdfFiscalComisiones()      │
│                                                      │
│    const base = 15024.05;                           │
│    const iva = base × 0.16 = 2403.85;               │
│    const retIsr = base × 0.10 = 1502.40;            │
│    const retIva = iva × 2/3 = 1602.57;              │
│    const total = base + iva - retIsr - retIva;      │
│                 = 14322.93                          │
│                                                      │
│    return {                                         │
│      calculos: { iva, retIsr, retIva, total },      │
│      visibleFields: [...]                           │
│    }                                                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Sistema: Renderizar PDF con visibleFields           │
│    visibleFields.forEach(field => {                 │
│      agregar fila a tabla con field.label y value   │
│    });                                              │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ ✅ RESULTADO: PDFs correctos e individuales         │
│    - Agente A (comisión $10,000): Total $9,066.67   │
│    - Agente B (comisión $20,000): Total $18,133.33  │
│    - Agente C (comisión $5,000):  Total $4,533.33   │
│                                                      │
│    ¡Cada uno tiene su propio cálculo!               │
└─────────────────────────────────────────────────────┘
```

---

## Comparación: Antes vs Después

### ANTES (Valores Hardcodeados/Cacheados)

```
┌──────────────────┐
│  Commission      │
│  Batches Table   │──► IVA: $2,403.85     ─┐
│                  │   Ret. ISR: $1,502.40  │
│  (Valores del    │   Ret. IVA: $1,602.57  │
│   lote completo) │   Total: $14,322.93    │
└──────────────────┘                        │
                                            │
                    Mismo valor para todos  │
                              ▼             │
         ┌─────────────────────────────────┤
         │                                 │
         ▼                                 ▼
┌────────────────┐              ┌────────────────┐
│  PDF Agente A  │              │  PDF Agente B  │
│  Com: $10,000  │              │  Com: $20,000  │
├────────────────┤              ├────────────────┤
│ IVA: $2,403.85 │ ❌           │ IVA: $2,403.85 │ ❌
│ ISR: $1,502.40 │ ❌           │ ISR: $1,502.40 │ ❌
│ Tot: $14,322.93│ ❌           │ Tot: $14,322.93│ ❌
└────────────────┘              └────────────────┘
    (Incorrecto)                   (Incorrecto)
```

### DESPUÉS (Cálculo Individual)

```
┌──────────────────┐
│  Agente A        │
│  Pólizas:        │──► Comisión Bruta: $10,000
│  - Póliza 1      │         │
│  - Póliza 2      │         ▼
│  - Póliza 3      │   ┌─────────────────────┐
└──────────────────┘   │ Función Pura:       │
                       │ calcularPdf()       │
                       │ Input: $10,000      │
                       └──────┬──────────────┘
                              │
                              ▼
                    ┌────────────────┐
                    │  PDF Agente A  │
                    │  Com: $10,000  │
                    ├────────────────┤
                    │ IVA: $1,600.00 │ ✅
                    │ ISR: $1,000.00 │ ✅
                    │ Tot: $9,066.67 │ ✅
                    └────────────────┘
                        (Correcto)

┌──────────────────┐
│  Agente B        │
│  Pólizas:        │──► Comisión Bruta: $20,000
│  - Póliza 4      │         │
│  - Póliza 5      │         ▼
│  - Póliza 6      │   ┌─────────────────────┐
└──────────────────┘   │ Función Pura:       │
                       │ calcularPdf()       │
                       │ Input: $20,000      │
                       └──────┬──────────────┘
                              │
                              ▼
                    ┌────────────────┐
                    │  PDF Agente B  │
                    │  Com: $20,000  │
                    ├────────────────┤
                    │ IVA: $3,200.00 │ ✅
                    │ ISR: $2,000.00 │ ✅
                    │ Tot: $18,133.33│ ✅
                    └────────────────┘
                        (Correcto)
```

---

## Función Pura: Aislamiento por Documento

```
                GARANTÍAS DE LA FUNCIÓN PURA
                ============================

┌──────────────────────────────────────────────────────┐
│  function calcularPdfFiscalComisiones(input) {       │
│                                                       │
│    ✅ NO lee estados globales                         │
│    ✅ NO modifica variables externas                  │
│    ✅ NO usa cache compartido                         │
│    ✅ NO reutiliza resultados anteriores              │
│                                                       │
│    const base = input.comisionBruta;                 │
│                                                       │
│    // Cálculo desde cero cada vez                    │
│    if (input.regimenFiscal === 'HONORARIOS') {       │
│      const iva = base × 0.16;                        │
│      const retIsr = base × 0.10;                     │
│      const retIva = iva × 2/3;                       │
│      const total = base + iva - retIsr - retIva;     │
│      return { calculos, visibleFields };             │
│    }                                                  │
│                                                       │
│    ✅ Mismo input = mismo output (determinista)       │
│    ✅ Cada invocación es independiente                │
│  }                                                    │
└──────────────────────────────────────────────────────┘

        Input A                  Input B
    (Com: $10,000)          (Com: $20,000)
          │                       │
          ▼                       ▼
    ┌─────────┐              ┌─────────┐
    │Función  │              │Función  │
    │  Pura   │              │  Pura   │
    └────┬────┘              └────┬────┘
         │                        │
         ▼                        ▼
    Total: $9,066          Total: $18,133
         │                        │
         └────────────┬───────────┘
                      │
                      ▼
        Resultados DIFERENTES y CORRECTOS
```

---

## Campos Visibles por Régimen

```
ASIMILADOS                 HONORARIOS               RESICO
═══════════                ═══════════              ═══════════

┌──────────────┐          ┌──────────────┐         ┌──────────────┐
│ Ret. ISR     │          │ IVA          │         │ IVA          │
│              │          │              │         │              │
│ Total        │          │ Ret. ISR     │         │ Ret. ISR     │
└──────────────┘          │              │         │              │
                          │ Ret. IVA     │         │ Ret. IVA     │
NO muestra:               │              │         │              │
• IVA                     │ Total        │         │ Total        │
• Ret. IVA                └──────────────┘         └──────────────┘
• Ret. Contable
• Costo Dispersión        NO muestra:              NO muestra:
                          • Ret. Contable          • Ret. Contable
                          • Costo Dispersión       • Costo Dispersión

Fórmula:                  Fórmula:                 Fórmula:
Total = Base - ISR        Total = Base + IVA       Total = Base + IVA
                                - ISR - RetIVA             - ISR - RetIVA

ISR: Calculado            ISR: Base × 10%          ISR: Base × 1.25%
     por motor fiscal     IVA: Base × 16%          IVA: Base × 16%
                          RetIVA: IVA × 2/3        RetIVA: IVA × 2/3
```

---

## Logging y Trazabilidad

```
Consola del Navegador (F12)
═══════════════════════════

[PDF] ========================================
[PDF] Generando PDF Fiscal para: Juan Pérez
[PDF] Régimen Fiscal: HONORARIOS
[PDF] Comisión Bruta: $15,024.05              ← Valor individual
[PDF Fiscal] Calculando desglose fiscal:
  - Régimen: HONORARIOS
  - Comisión Bruta: $15,024.05                ← Confirmación
  - IVA (16%): $2,403.85                      ← Cálculo en tiempo real
  - Ret. ISR (10%): $1,502.40                 ← Cálculo en tiempo real
  - Ret. IVA (2/3): $1,602.57                 ← Cálculo en tiempo real
  - Total: $14,322.93                         ← Resultado final
[PDF] Resultado Fiscal Calculado:
[PDF]   - IVA: $2,403.85
[PDF]   - Ret. ISR: $1,502.40
[PDF]   - Ret. IVA: $1,602.57
[PDF]   - Total: $14,322.93
[PDF] Campos visibles: 4
[PDF] ========================================

✅ Trazabilidad completa de cálculos
✅ Valores visibles en consola para debugging
✅ Confirmación de origen de datos
```

---

## Resumen Visual

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    FIX IMPLEMENTADO                   ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

ANTES                              DESPUÉS
═════                              ═══════

❌ Valores del lote completo       ✅ Comisión bruta individual
❌ Cache/hardcodeo                 ✅ Cálculo puro desde cero
❌ Mismo resultado para todos      ✅ Resultado único por agente
❌ IVA = $0 en Honorarios/RESICO   ✅ IVA calculado correctamente
❌ No respeta régimen fiscal       ✅ Respeta régimen del usuario

IMPACTO: PDFs ahora son precisos, individuales y confiables
```
