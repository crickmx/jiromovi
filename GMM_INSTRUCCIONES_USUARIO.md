# 🚀 Instrucciones para Corregir Coberturas Adicionales GMM BX+

## ⚠️ Problema

Las primas adicionales están **85% menores** de lo correcto:
- Sistema calcula: **$1,047** por asegurado
- Excel muestra: **$7,094** por asegurado

## 🎯 Solución en 3 Pasos

### Paso 1: Ejecutar Diagnóstico

1. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Abrir en el navegador:
   ```
   http://localhost:5173/diagnostico-gmm-tarifas-coberturas.html
   ```

3. Click en **"🚀 Ejecutar Diagnóstico"**

4. Click en **"🔄 Ingeniería Inversa"**

5. **Anotar los valores mostrados:**
   - coef_medicamentos
   - coef_vip
   - coef_emergencia_ext
   - factor_deducible_35000
   - **Multiregión QUERETARO:**
     - col_1 = ?
     - col_2 = ?
   - gastos_expedicion

### Paso 2: Verificar en el Excel Original

Abrir el archivo **Excel de tarifas Únikuz BX+** y verificar:

| Concepto | Ubicación Excel | Anotar Valor |
|----------|-----------------|--------------|
| Medicamentos | `Tarifa!AJ3` | _______ |
| VIP | `Tarifa!BI3` | _______ |
| Emergencia Extranjero | `Tarifa!AW3` | _______ |
| Deducible 35000 | `Tarifa!AW15:AW23` (buscar fila) | _______ |
| Multiregión QUERETARO | `Tarifa!AQ42:AS74` (buscar fila) | |
| • Columna A | Estado = QUERETARO | |
| • Columna B | col_1 = | _______ |
| • Columna C | col_2 = | _______ |
| Gastos Expedición | `Cotizacion!O67` | _______ |

**Calcular la suma:**
```
SUMA = Medicamentos + VIP + Emergencia + Deducible + Multiregión

¿Qué valor de Multiregión usar?
  - Si col_1 hace que SUMA = 0.616394, usar col_1 ✓
  - Si col_2 hace que SUMA = 0.616394, usar col_2 ✓
```

**OBJETIVO:** La suma debe ser **0.616394** (61.64%)

### Paso 3: Aplicar la Corrección

#### Caso A: Si col_1 es el valor correcto

Editar `src/lib/gmmCalculationEngineV2.ts` línea 371:

```typescript
// ANTES (línea 371):
return roundTo5Decimals(Number(row.col_2 || 0));

// DESPUÉS:
return roundTo5Decimals(Number(row.col_1 || 0));
```

#### Caso B: Si col_2 es correcto pero los valores no suman 0.616394

El Excel tiene valores incorrectos. Solicitar al proveedor de tarifas:
- Excel actualizado con valores correctos
- O verificar que se está usando la versión correcta del Excel

#### Caso C: Si los valores NO están en la BD

Re-subir el Excel:
1. Ir a la página de administración de tarifas
2. Subir el archivo Excel correcto
3. Activar el nuevo paquete de tarifas

#### Caso D: Gastos de Expedición

Si el Excel tiene $150 en lugar de $300:

**Opción 1** - Actualizar Excel:
- Cambiar celda `Cotizacion!O67` a `300`
- Re-subir

**Opción 2** - Override en código:
```typescript
// En gmmCalculationEngineV2.ts línea 917:
gastos_expedicion: Number(get('gastos_expedicion')?.[0]?.col_0 || 300), // Cambiar de 150 a 300
```

## ✅ Validar la Corrección

Después de aplicar los cambios:

1. Recompilar:
   ```bash
   npm run build
   ```

2. Crear una nueva cotización con los mismos datos:
   - Estado: QUERETARO
   - Nivel: PLUS
   - Tabulador: ORO-110,000
   - Suma Asegurada: 50,000,000
   - Deducible: 35,000
   - Coaseguro: 15%
   - Tope Coaseguro: 60,000
   - 3 asegurados (Hombre 40, Mujer 39, Mujer 1)
   - Coberturas: Medicamentos, Elim.Deducible, Multiregión, VIP, Emergencia

3. Verificar que las primas coincidan:
   ```
   Prima Base:        $11,509.57 ✓
   Prima Adicionales: $7,094.43  ← Debe coincidir
   Prima Total:       $18,604.00 ← Debe coincidir
   ```

## 📊 Valores Esperados

| Asegurado | Prima Base | Prima Adicionales | Prima Total |
|-----------|-----------|-------------------|-------------|
| Hombre 40 | $11,509.57 | $7,094.43 | $18,604.00 |
| Mujer 39 | $14,595.59 | $8,996.64 | $23,592.23 |
| Mujer 1 | $6,043.98 | $3,725.47 | $9,769.45 |
| **TOTAL** | **$32,149.14** | **$19,816.54** | **$51,965.68** |

```
+ Gastos Expedición:  $900.00  (3 × $300)
= Subtotal:           $52,865.68
+ IVA (16%):          $8,458.51
= TOTAL A PAGAR:      $61,324.20 ✓
```

## 🔍 Información Adicional

- **Análisis Completo**: Ver `GMM_ANALISIS_COMPLETO_COBERTURAS.md`
- **Ingeniería Inversa**: Ver `test-gmm-reverse-engineering.js`
- **Hipótesis Multiregión**: Ver `test-multiregion-column-hypothesis.js`
- **Diagnóstico HTML**: `public/diagnostico-gmm-tarifas-coberturas.html`

## 💡 Ayuda

Si después de seguir estos pasos las primas aún no coinciden:

1. Verificar que el paquete de tarifas esté **activo** en la BD
2. Verificar que se cargó el Excel **correcto**
3. Contactar al proveedor de tarifas para validar los valores del Excel
4. Revisar los logs del navegador para errores de cálculo

---

**¿Necesitas ayuda?** Consulta los archivos de análisis o ejecuta los scripts de prueba para más detalles.
