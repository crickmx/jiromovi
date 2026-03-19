# Referencia Rápida: PDFs Fiscales de Comisiones

## ¿Qué se corrigió?

Los PDFs de Orden de Pago ahora calculan valores fiscales **individuales** para cada agente en lugar de reutilizar valores del lote completo.

## Cambios Clave

### Antes
- Todos los PDFs del mismo lote = mismo resultado fiscal ❌
- IVA y Ret. IVA en $0 para Honorarios/RESICO ❌
- Valores no correspondían a la comisión del agente ❌

### Después
- Cada PDF = cálculo individual y único ✅
- IVA y Ret. IVA calculados correctamente ✅
- Valores corresponden a la comisión real del agente ✅

## Fórmulas por Régimen Fiscal

### ASIMILADOS
```
Campos mostrados: Ret. ISR, Total

Ret. ISR = Calculado por motor fiscal de MOVI
Total = Comisión Bruta - Ret. ISR
```

### HONORARIOS
```
Campos mostrados: IVA, Ret. ISR, Ret. IVA, Total

IVA = Comisión Bruta × 16%
Ret. ISR = Comisión Bruta × 10%
Ret. IVA = IVA × 2/3
Total = Comisión Bruta + IVA - Ret. ISR - Ret. IVA
```

### RESICO
```
Campos mostrados: IVA, Ret. ISR, Ret. IVA, Total

IVA = Comisión Bruta × 16%
Ret. ISR = Comisión Bruta × 1.25%
Ret. IVA = IVA × 2/3
Total = Comisión Bruta + IVA - Ret. ISR - Ret. IVA
```

## Prueba Rápida

1. Generar PDF de 2 agentes diferentes del mismo lote
2. Verificar que tengan valores fiscales **diferentes**
3. Verificar que IVA no sea $0.00 en Honorarios/RESICO
4. Verificar que la "Base de cálculo" coincida con la comisión del agente

## Ejemplo de Valores Correctos

| Agente | Comisión | Régimen | IVA | Ret. ISR | Ret. IVA | Total |
|--------|----------|---------|-----|----------|----------|-------|
| A | $10,000 | HONORARIOS | $1,600 | $1,000 | $1,067 | $9,533 |
| B | $20,000 | HONORARIOS | $3,200 | $2,000 | $2,133 | $19,067 |
| C | $10,000 | RESICO | $1,600 | $125 | $1,067 | $10,408 |
| D | $15,000 | ASIMILADOS | - | $1,500 | - | $13,500 |

## Logs en Consola

Abrir DevTools (F12) al generar PDF y buscar:

```
[PDF] Generando PDF Fiscal para: [Nombre Agente]
[PDF] Régimen Fiscal: [HONORARIOS/ASIMILADOS/RESICO]
[PDF] Comisión Bruta: $X,XXX.XX
```

Esto confirma que se está usando la comisión correcta.

## Archivos Técnicos

- `FIX_PDF_FISCAL_BUG_CRITICO.md` - Documentación técnica completa
- `PRUEBAS_PDF_FISCAL.md` - Guía de pruebas detallada
- `DIAGRAMA_FLUJO_PDF_FISCAL.md` - Diagramas visuales
- `src/lib/pdfFiscalCalculation.ts` - Módulo de cálculo fiscal
- `src/lib/pdfFiscalCalculation.test.ts` - Pruebas unitarias

## Contacto

Si detectas algún valor incorrecto después del fix, reporta:
1. Screenshot del PDF
2. Comisión bruta del agente
3. Régimen fiscal
4. Valores mostrados vs esperados
5. Logs de consola
