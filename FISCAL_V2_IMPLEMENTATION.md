# Sistema de Cálculo Fiscal V2 - Implementación Completa

## Resumen Ejecutivo

Se ha implementado un sistema de cálculo fiscal completamente nuevo que sigue **exactamente** las fórmulas de los documentos de referencia para los tres regímenes fiscales: ASIMILADOS, HONORARIOS y RESICO.

## Validación de Casos de Prueba

Todos los casos de prueba pasan correctamente:

### ✅ ASIMILADOS
- **Comisión Gravada (NO VIDA):** $82.11
- **Comisión Exenta (VIDA):** $544.20
- **Total Esperado:** $477.40
- **Total Calculado:** $477.41
- **Diferencia:** $0.01 (dentro de tolerancia)

### ✅ HONORARIOS
- **Comisión Gravada (NO VIDA):** $814.95
- **Comisión Exenta (VIDA):** $1,119.05
- **Total Esperado:** $1,784.06
- **Total Calculado:** $1,784.06
- **Diferencia:** $0.00 (exacto)

### ✅ RESICO
- **Comisión Gravada (NO VIDA):** $17,616.83
- **Comisión Exenta (VIDA):** $4,931.88
- **Total Esperado:** $23,206.41
- **Total Calculado:** $23,206.41
- **Diferencia:** $0.00 (exacto)

## Archivos Creados/Modificados

### Nuevos Archivos
1. **`src/lib/commissionFiscalCalculationV2.ts`**
   - Implementación pura de las fórmulas fiscales
   - Funciones separadas por régimen fiscal
   - Sin dependencias de estado global

2. **`src/lib/commissionFiscalCalculationV2.test.ts`**
   - Suite de pruebas con los 3 casos de referencia
   - Validación automática de resultados
   - Comparación detallada de cada campo

### Archivos Modificados
1. **`src/lib/pdfUtils.ts`**
   - Actualizado `generateOrdenDePagoPDF()` para usar V2
   - Clasificación automática VIDA vs NO VIDA
   - Desglose fiscal siempre muestra los 8 campos

2. **`supabase/migrations/fix_fiscal_calculation_v2_exact_formulas.sql`**
   - Trigger simplificado (solo clasifica tipo_ramo)
   - Nueva función `calculate_batch_fiscal_aggregates_v2()`
   - Cálculos a nivel de lote con fórmulas exactas

## Fórmulas Implementadas

### ASIMILADOS
```
RET CONTABLE = COMISION_EXENTA × 0.16
COSTO DISPERSION = COMISION_GRAVADA × 0.09
BASE_ISR_EXENTA = COMISION_EXENTA / 1.16
ISR_EXENTA = BASE_ISR_EXENTA × 0.10
BASE_ISR_GRAVADA = COMISION_GRAVADA / 1.09
ISR_GRAVADA = BASE_ISR_GRAVADA × 0.10
RET_ISR = ISR_EXENTA + ISR_GRAVADA
IVA = 0
RET_IVA = 0
TOTAL = (COMISION_GRAVADA + COMISION_EXENTA) - RET_CONTABLE - COSTO_DISPERSION - RET_ISR
```

### HONORARIOS
```
RET CONTABLE = 0
COSTO DISPERSION = 0
IVA = COMISION_GRAVADA × 0.16
RET_ISR = COMISION_TOTAL × 0.10
RET_IVA = IVA × (2/3)
TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA
```

### RESICO
```
RET CONTABLE = 0
COSTO DISPERSION = 0
IVA = COMISION_GRAVADA × 0.16
RET_ISR = COMISION_TOTAL × 0.0125
RET_IVA = IVA × (2/3)
TOTAL = COMISION_TOTAL + IVA - RET_ISR - RET_IVA
```

## Clasificación de Ramos

- **VIDA** = COMISION EXENTA (no paga IVA)
- **NO VIDA** = COMISION GRAVADA (paga IVA)
  - VEHICULOS
  - DAÑOS
  - ACC y ENF
  - OTROS
  - Cualquier ramo que no sea VIDA

## Campos del PDF "Orden de Pago"

El PDF siempre muestra estos 8 campos en orden:

1. **COMISION GRAVADA** (positivo)
2. **COMISION EXENTA** (positivo)
3. **RET CONTABLE** (negativo, $0.00 si no aplica)
4. **COSTO DISPERSION** (negativo, $0.00 si no aplica)
5. **IVA** (positivo, $0.00 si no aplica)
6. **RET ISR** (negativo)
7. **RET IVA** (negativo, $0.00 si no aplica)
8. **TOTAL** (positivo, destacado en verde)

## Flujo de Cálculo

### Frontend (Generación de PDF)
1. Usuario descarga PDF de comisiones
2. Se clasifican comisiones por ramo (VIDA vs NO VIDA)
3. Se llama a `calcularDesgloseFiscalV2()` con:
   - Régimen fiscal actual del usuario
   - Comisión gravada (suma NO VIDA)
   - Comisión exenta (suma VIDA)
4. Se genera PDF con los 8 campos siempre visibles

### Backend (Base de Datos)
1. Trigger clasifica cada póliza como VIDA o DAÑOS
2. Al cerrar un lote, se llama a `calculate_batch_fiscal_aggregates_v2()`
3. La función suma todas las comisiones por tipo
4. Aplica fórmulas exactas según régimen del lote
5. Persiste valores en `commission_batches`

## Cambios Importantes

### ✅ Correcciones Aplicadas
1. **"DESGLOCE" → "DESGLOSE"** (ortografía corregida)
2. **ISR de HONORARIOS y RESICO** ahora es sobre COMISION_TOTAL (no individual)
3. **IVA solo aplica a comisiones gravadas** (NO VIDA)
4. **Ret. IVA = IVA × (2/3)** para HONORARIOS y RESICO
5. **Todos los campos siempre visibles** ($0.00 si no aplican)

### 🔄 Cambio de Arquitectura
- **Antes:** Cálculos individuales por póliza
- **Ahora:** Cálculos agregados a nivel de lote
- **Ventaja:** Coincide exactamente con los documentos de referencia

## Verificación

Para verificar que las fórmulas son correctas:

```bash
npx tsx src/lib/commissionFiscalCalculationV2.test.ts
```

Resultado esperado:
```
✅ ASIMILADOS: VÁLIDO
✅ HONORARIOS: VÁLIDO
✅ RESICO: VÁLIDO

🎉 TODOS LOS CASOS SON VÁLIDOS
```

## Notas Técnicas

### Redondeo
- Todos los valores se redondean a 2 decimales
- Se usa `Math.round((value + Number.EPSILON) * 100) / 100`
- Diferencias de ±$0.01 son aceptables por redondeo

### Compatibilidad
- La función antigua `calculate_batch_fiscal_aggregates()` ahora redirige a la V2
- El código existente sigue funcionando sin cambios
- Migración transparente para usuarios finales

### Tax Version
- Los lotes calculados con el nuevo sistema tienen `tax_version = '2026-v2-exact'`
- Esto permite identificar qué lotes usan las fórmulas correctas
- Los lotes antiguos mantienen su versión original

## Próximos Pasos Recomendados

1. ✅ **Recalcular lotes existentes** (opcional)
   - Usar la función `calculate_batch_fiscal_aggregates_v2()` en lotes ya cerrados
   - Esto actualizará los valores con las fórmulas correctas

2. ✅ **Capacitación a usuarios**
   - Explicar que el desglose ahora coincide con los documentos oficiales
   - Mostrar que todos los campos siempre son visibles

3. ✅ **Monitoreo**
   - Verificar que los PDFs generados muestren correctamente los 8 campos
   - Validar que los totales coincidan con las expectativas

## Soporte

Para cualquier duda sobre las fórmulas fiscales:

1. Revisar este documento
2. Ejecutar las pruebas (`commissionFiscalCalculationV2.test.ts`)
3. Verificar los documentos de referencia originales
4. Los valores calculados ahora coinciden exactamente con las imágenes de referencia

---

**Implementado:** 2026-04-06
**Versión:** V2 Exact Formulas
**Estado:** ✅ Validado y en Producción
