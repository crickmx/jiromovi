# Diagnóstico y Solución Definitiva GMM BX+

## 📋 Diagnóstico Completo

### Problema Identificado

Las **primas adicionales** están calculando **85% menos** de lo que deberían según el Excel original.

**Ejemplo del error:**
- Prima Base: $11,509.57
- Prima Adicional Actual: **$1,047.37** ❌
- Prima Adicional Correcta: **$7,094.43** ✓
- Diferencia: **-85.2%**

### Causa Raíz

Según el análisis exhaustivo del Excel original "Únikuz BX+" (ver `report.md`), las coberturas adicionales deben sumar **61.6394%** de la prima base con cargas.

**Fórmula del Excel:**
```
Prima Adicional Total = Prima Base Con Cargas × 0.616394
```

**Donde 0.616394 es la suma de:**
1. Medicamentos Fuera (coef_medicamentos)
2. VIP (coef_vip)
3. Emergencia Médica Extranjero (coef_emergencia_ext)
4. Eliminación Deducible por Accidente (tabla por deducible)
5. Multiregión (tabla por estado)

## ✅ Estado del Código

### Código Frontend/Motor de Cálculo: ✓ CORRECTO

El archivo `src/lib/gmmCalculationEngineV2.ts` está **correctamente implementado**:

1. ✓ Calcula Prima Base con factores multiplicativos
2. ✓ Aplica cargas del sistema (gastos 44%)
3. ✓ Calcula coberturas adicionales como % de Prima Base Con Cargas
4. ✓ Suma todas las coberturas
5. ✓ Aplica gastos de expedición ($300 por asegurado)

**Cambios ya aplicados:**
- ✓ Multiregión usa `col_1` en lugar de `col_2` (línea 371)
- ✓ Gastos de expedición default: $300 (línea 917)

### Problema: ❌ DATOS EN BASE DE DATOS

Los **valores** almacenados en `tariff_tables` **NO coinciden** con el Excel original.

## 🔧 Solución Definitiva

### Opción 1: Re-subir Excel Original

**RECOMENDADO**: Subir el archivo Excel oficial `unikuzdic25.xlsm` para que el sistema extraiga los valores correctos.

**Pasos:**
1. Ir a **Administración → Tarifas GMM**
2. Click en "Subir Nuevo Paquete de Tarifas"
3. Seleccionar archivo: `unikuzdic25.xlsm`
4. El sistema parseará automáticamente todas las tablas
5. Activar el paquete subido

### Opción 2: Verificar y Corregir Valores Manualmente

Si no tienes el Excel original, aquí están los valores que **deben** estar en la base de datos:

#### Coeficientes Simples

Estos valores se encuentran en celdas específicas del Excel:

| Cobertura | Key en BD | Celda Excel | Valor Correcto |
|-----------|-----------|-------------|----------------|
| Medicamentos Fuera | `coef_medicamentos` | AJ3 | **Verificar en Excel** |
| VIP | `coef_vip` | BI3 | **Verificar en Excel** |
| Emergencia Extranjero | `coef_emergencia_ext` | AW3 | **Verificar en Excel** |

#### Tabla Eliminación Deducible

| Deducible | Factor |
|-----------|--------|
| 12,000 | 1.000 |
| 17,000 | 0.855 |
| 23,000 | 0.722 |
| 29,000 | 0.634 |
| **35,000** | **Verificar en Excel (AW15:AW23)** |
| 40,000 | Verificar |
| 46,000 | Verificar |

#### Tabla Multiregión

| Estado | Región | Factor (col_1) |
|--------|--------|----------------|
| AGUASCALIENTES | 3 | 0.62 |
| **QUERETARO** | ? | **Verificar en Excel (columna AQ)** |
| CDMX | 6 | 0.9735 |

**IMPORTANTE**: La columna correcta es **col_1**, NO col_2.

#### Gastos de Expedición

| Concepto | Celda Excel | Valor Correcto |
|----------|-------------|----------------|
| Gastos de Expedición | O67 | **$300 por asegurado** |

### Opción 3: Script de Corrección SQL

Si conoces los valores exactos del Excel, puedo crear un script SQL para actualizar directamente la base de datos.

## 🧪 Validación

### Caso de Prueba: Familia de 3

**Configuración:**
- Estado: QUERETARO
- Nivel: PLUS
- Tabulador: ORO-110,000
- Suma Asegurada: 50,000,000
- Deducible: 35,000
- Coaseguro: 15%
- Tope Coaseguro: $60,000
- Forma de Pago: ANUAL

**Asegurados:**
1. Hombre 40 años
2. Mujer 39 años
3. Mujer 1 año

**Coberturas Activas:**
- ✓ Medicamentos Fuera del Hospital
- ✓ Eliminación Deducible por Accidente
- ✓ Multiregión
- ✓ Beneficio VIP
- ✓ Emergencia Médica en el Extranjero

**Resultados Esperados:**

| Asegurado | Prima Base | Prima Adicional | Prima Total |
|-----------|-----------|-----------------|-------------|
| Hombre 40 | $11,509.57 | $7,094.43 | $18,604.00 |
| Mujer 39 | $14,595.59 | $8,996.64 | $23,592.23 |
| Mujer 1 | $6,043.98 | $3,725.47 | $9,769.45 |

**Totales:**
```
Prima Neta Total:      $51,965.68
Gastos de Expedición:  $900.00 (3 × $300)
Subtotal:              $52,865.68
IVA (16%):             $8,458.51
─────────────────────────────────
Total a Pagar:         $61,324.20 ✓
```

### Fórmula de Verificación

Para **cualquier** configuración:

```
Ratio = Prima Adicional / Prima Base Con Cargas

Si todas las coberturas están activas:
Ratio DEBE ser ≈ 0.616394 (61.64%)
```

Si el ratio es ~0.09 (9%), los valores en la BD están incorrectos.

## 📊 Herramienta de Diagnóstico

Crea una cotización de prueba y verifica en la consola del navegador:

```javascript
console.log('Prima Base:', primaBase);
console.log('Prima Adicional:', primaAdicional);
console.log('Ratio:', (primaAdicional / primaBase * 100).toFixed(2) + '%');
console.log('Esperado:', '61.64%');
```

## 🎯 Siguiente Paso CRÍTICO

**Necesitas hacer UNA de estas 3 cosas:**

### A. Subir Excel Original ⭐ RECOMENDADO
1. Ir a Admin → Tarifas GMM
2. Subir `unikuzdic25.xlsm`
3. Activar paquete
4. Probar cotización

### B. Enviarme el Excel
Si no puedes subirlo, envíame el archivo para:
1. Extraer los valores exactos
2. Crear script SQL de corrección
3. Aplicar migración

### C. Verificar Valores Manualmente
1. Abrir el Excel original
2. Anotar valores de celdas AJ3, BI3, AW3, AW15:AW23, AQ42:AS74
3. Actualizar manualmente en Admin → Tarifas GMM

## ⚠️ Conclusión

El **código está correcto**. El problema es que **las tablas en la base de datos no contienen los valores del Excel original**.

Sin el Excel o los valores correctos, el sistema no puede calcular las primas correctamente.

---

**Archivos Relacionados:**
- `report.md` - Análisis exhaustivo del Excel original
- `GMM_FIX_COBERTURAS_ADICIONALES_IMPLEMENTADO.md` - Cambios en código
- `GMM_INSTRUCCIONES_USUARIO.md` - Guía de uso

**Estado**: ⏸️ Pendiente de acción del usuario (subir Excel o proporcionar valores)
