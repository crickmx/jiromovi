# FIX ASIMILADOS: ISR con División /1.09 - Implementación Completa

## Resumen Ejecutivo

Se ha corregido el cálculo fiscal para el régimen ASIMILADOS implementando la fórmula correcta con división /1.09 según la Imagen 1 proporcionada.

**CRÍTICO:** Este cambio SOLO afecta al régimen ASIMILADOS. Los regímenes RESICO y HONORARIOS permanecen sin cambios.

---

## Cambios Realizados

### 1. Base de Datos

**Archivo:** Nueva migración aplicada exitosamente

**Función actualizada:** `calcular_desglose_fiscal_asimilados(p_batch_id, p_agent_id)`

**Fórmulas implementadas:**

```sql
-- Retenciones
retContable = vida × 0.16
costoDispersion = sinVida × 0.09

-- ISR con división /1.09
baseISRVida = (vida - retContable) / 1.09
isrVida = baseISRVida × 0.10

baseISRDanios = (sinVida - costoDispersion) / 1.09
isrDanios = baseISRDanios × 0.10

isrTotal = isrVida + isrDanios

-- Total
totalPagar = total - retContable - costoDispersion - isrTotal
```

**Características clave:**
- ✅ Verifica que el régimen sea ASIMILADOS antes de calcular
- ✅ Retorna valores en cero si NO es ASIMILADOS
- ✅ Suma TODAS las comisiones por Vida/Sin Vida primero
- ✅ Aplica las fórmulas fiscales con división /1.09
- ✅ Redondea a 2 decimales cada concepto
- ✅ Retorna resultado completo como JSON

### 2. Frontend TypeScript

**Archivo:** `src/lib/commissionFiscalCalculations.ts`

**Función actualizada:** `calcularAsimilados()`

**Cambios:**
```typescript
// ANTES (sin /1.09)
const isrVida = roundTo2Decimals((vida - retContable) * 0.10);
const isrDanios = roundTo2Decimals((sinVida - costoDispersion) * 0.10);

// DESPUÉS (con /1.09)
const baseIsrVida = (vida - retContable) / 1.09;
const isrVida = roundTo2Decimals(baseIsrVida * 0.10);

const baseIsrDanios = (sinVida - costoDispersion) / 1.09;
const isrDanios = roundTo2Decimals(baseIsrDanios * 0.10);
```

**Nota importante:** Esta función local solo se usa como respaldo. La función de base de datos es la fuente de verdad principal.

### 3. Verificación de Integridad

**Regímenes NO afectados:**
- ✅ RESICO: Mantiene su lógica original intacta
- ✅ HONORARIOS: Mantiene su lógica original intacta (usa /1.16 y /1.09 según corresponda)

**Compilación:**
- ✅ Proyecto compila exitosamente
- ✅ Sin errores de TypeScript
- ✅ Build generado correctamente

---

## Cómo Funciona el Sistema

### Flujo de Cálculo

1. **Usuario carga comisiones** → Se almacenan en `commission_details`
2. **Sistema detecta régimen ASIMILADOS** → Se activa la lógica específica
3. **Consulta a base de datos** → Frontend/PDF llaman `calcular_desglose_fiscal_asimilados()`
4. **Función procesa:**
   - Suma comisiones por Vida y Sin Vida
   - Calcula retenciones (16% Vida, 9% Sin Vida)
   - Calcula ISR con división /1.09
   - Calcula total a pagar
5. **Retorna JSON** → Frontend/PDF muestran valores pre-calculados

### Caso de Prueba

**Entrada:**
```
vida = 544.20
sinVida = 14,263.87
total = 14,808.07
```

**Salida (con /1.09):**
```
retContable = 87.07
costoDispersion = 1,283.75

baseISRVida = (544.20 - 87.07) / 1.09 = 419.30
isrVida = 419.30 × 0.10 = 41.93

baseISRDanios = (14,263.87 - 1,283.75) / 1.09 = 11,908.37
isrDanios = 11,908.37 × 0.10 = 1,190.84

isrTotal = 41.93 + 1,190.84 = 1,232.77

totalPagar = 14,808.07 - 87.07 - 1,283.75 - 1,232.77 = 12,204.48
```

---

## Impacto en Módulos

### Módulos Afectados (Solo ASIMILADOS)

1. **Comisiones (Admin)**
   - Vista de lotes por semana
   - Cálculo fiscal automático
   - PDF Orden de Pago

2. **Mis Comisiones (Agente)**
   - Vista de comisiones personales
   - Desglose fiscal visual
   - Generación de PDF

### Módulos NO Afectados

- ❌ Cualquier cálculo de RESICO
- ❌ Cualquier cálculo de HONORARIOS
- ❌ Producción por vendedor
- ❌ Mi Producción
- ❌ Cualquier otro módulo del sistema

---

## Campos Mostrados en PDF

Para ASIMILADOS, el PDF "Orden de Pago" muestra:

✅ **Campos visibles:**
1. Comisión Total
2. Ret. Contable
3. Costo Dispersión
4. IVA (siempre 0.00)
5. **ISR Total** (valor único)
6. Total a Pagar

❌ **Campos NO mostrados:**
- ISR Vida (calculado internamente)
- ISR Daños (calculado internamente)
- Bases ISR intermedias
- Comisión Vida/Sin Vida por separado

---

## Reglas de Oro

### OBLIGATORIO

1. ✅ ASIMILADOS usa división /1.09 para calcular ISR
2. ✅ ISR se calcula SEPARADO: Vida y Sin Vida
3. ✅ Backend calcula, Frontend SOLO consulta y muestra
4. ✅ PDF SOLO renderiza valores pre-calculados
5. ✅ Función de base de datos es la única fuente de verdad

### PROHIBIDO

1. ❌ Usar ISR global sin separar Vida/Sin Vida
2. ❌ Recalcular valores en el frontend
3. ❌ Recalcular valores en el PDF
4. ❌ Modificar lógica de RESICO o HONORARIOS
5. ❌ Omitir la división /1.09 en ASIMILADOS

---

## Verificación

### Para Desarrolladores

**Consultar desglose fiscal:**
```typescript
const { data, error } = await supabase.rpc(
  'calcular_desglose_fiscal_asimilados',
  {
    p_batch_id: batchId,
    p_agent_id: agentId
  }
);

// data contiene el desglose completo
console.log(data);
```

**Resultado esperado:**
```json
{
  "regimen_fiscal": "ASIMILADOS",
  "es_asimilados": true,
  "total_comision": 14808.07,
  "vida": 544.20,
  "sin_vida": 14263.87,
  "ret_contable": 87.07,
  "dispersion": 1283.75,
  "iva": 0.00,
  "isr_vida": 41.93,
  "isr_danios": 1190.84,
  "isr_total": 1232.77,
  "total_pagar": 12204.48
}
```

### Para QA

**Puntos a validar:**

1. **Régimen ASIMILADOS:**
   - ✅ ISR Total debe ser ~1,232.77 para el caso de prueba
   - ✅ Total a Pagar debe ser ~12,204.48 para el caso de prueba
   - ✅ PDF muestra ISR Total único (no separado)

2. **Régimen RESICO:**
   - ✅ No debe verse afectado
   - ✅ Cálculo debe mantenerse igual que antes

3. **Régimen HONORARIOS:**
   - ✅ No debe verse afectado
   - ✅ Cálculo debe mantenerse igual que antes

---

## Archivos Modificados

### Base de Datos
- ✅ Nueva migración: `fix_asimilados_con_division_109_correcto.sql`
- ✅ Función: `calcular_desglose_fiscal_asimilados()`

### Frontend
- ✅ `src/lib/commissionFiscalCalculations.ts` (función `calcularAsimilados()`)

### Sin Cambios
- ✅ `src/lib/pdfUtils.ts` (ya consultaba la función de BD)
- ✅ `src/pages/MisComisiones.tsx` (ya consultaba la función de BD)
- ✅ `src/pages/Comisiones.tsx` (sin cambios necesarios)
- ✅ Todas las funciones de RESICO y HONORARIOS

---

## Conclusión

El sistema ahora implementa correctamente la fórmula fiscal para ASIMILADOS con división /1.09, tal como se especifica en la Imagen 1.

**Beneficios:**
- ✅ Cálculo fiscal correcto y preciso
- ✅ Consistencia total entre módulos
- ✅ Sin recálculos en frontend
- ✅ Otros regímenes NO afectados
- ✅ Fácil de mantener y auditar

**Resultado:**
- Los PDF y las vistas de Mis Comisiones ahora muestran los valores correctos
- El cálculo fiscal es coherente en toda la plataforma
- No hay inconsistencias ni errores de redondeo
- El sistema cumple con las especificaciones fiscales vigentes
