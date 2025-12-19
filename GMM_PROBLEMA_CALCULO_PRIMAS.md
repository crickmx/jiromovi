# Problema: Primas en $0.00 en el Cotizador GMM

## Síntoma
Las cotizaciones generadas muestran todas las primas en $0.00:
- Prima Base: $0.00
- Prima Adicionales: $0.00
- Prima Total: $0.00

Solo se calculan correctamente los gastos de expedición, IVA y total.

## Causa Identificada
El motor de cálculo estaba leyendo la **columna incorrecta** para el factor de estado.

### Corrección Aplicada
En `src/lib/gmmCalculationEngine.ts`, línea 220:
```typescript
// ANTES (incorrecto):
const factorEstado = vlookup(tables.factor_estado, input.estado, 3, 'Factor Estado');

// DESPUÉS (correcto):
const factorEstado = vlookup(tables.factor_estado, input.estado, 2, 'Factor Estado');
```

### Estructura de la Tabla factor_estado
```
col_0: Nombre del estado (ej: "QUERETARO")
col_1: Zona numérica (ej: 9)
col_2: Factor real (ej: 0.69) ← ESTE es el valor correcto
col_3: No existe
```

El código estaba intentando leer col_3 (que no existe), causando que el factor devolviera 0, y por lo tanto todas las primas calculadas eran $0.00.

## Diagnóstico

Para verificar que el motor de cálculo ahora funciona correctamente:

1. Abre en tu navegador:
   ```
   http://localhost:5173/diagnostico-gmm-calculo.html
   ```

2. Haz clic en "▶️ Ejecutar Diagnóstico"

3. El diagnóstico verificará:
   - Que existe un paquete de tarifas activo
   - Que todas las tablas críticas están cargadas
   - Que los factores se leen correctamente
   - Que el cálculo manual produce resultados correctos

### Ejemplo de Resultado Esperado
```
Factor Estado (QUERETARO): 0.69
Factor Nivel (PLUS): 0.76
Base Intermedia (Hombre 40 años): 30,257.34

Prima simple (sin otros factores): $15,874.33
✓ El cálculo está funcionando correctamente
```

## Verificación en el Cotizador

1. Ve a **GMM / Cotizador**
2. Configura los parámetros:
   - Estado: QUERETARO
   - Nivel Hospitalario: PLUS
   - Tabulador: ORO-110,000
   - Suma Asegurada: 50,000,000
   - Deducible: 35,000
   - Coaseguro: 15%
3. Agrega asegurados con edades válidas
4. Haz clic en **Calcular**

**Resultado esperado:**
- Las primas base deben mostrar valores > $0
- Las primas adicionales (si hay coberturas) deben calcularse
- La prima total debe ser correcta

## Otras Consideraciones

### Si las primas siguen en $0.00:

1. **Verifica que hay tarifas cargadas**:
   - Ve a GMM / Tarifas Admin
   - Debe haber un paquete "Activo"
   - Si no, carga un archivo Excel de tarifas

2. **Verifica que los valores coinciden**:
   - Los nombres de estados deben coincidir EXACTAMENTE
   - Ejemplo en DB: "QUERETARO"
   - Ejemplo en dropdown: debe ser "QUERETARO" (sin acentos, mayúsculas)

3. **Revisa la consola del navegador**:
   - Abre DevTools (F12)
   - Busca errores en rojo
   - Especialmente errores de `vlookup` que indiquen valores no encontrados

## Cambios Realizados

### Archivos Modificados
1. `src/lib/gmmCalculationEngine.ts`
   - Corregido índice de columna para factor_estado (col_3 → col_2)

2. `src/lib/gmmPdfGenerator.ts`
   - Agregadas secciones de "Coberturas Básicas Incluidas"
   - Agregadas secciones de "Servicios de Asistencia Incluidos"

3. `src/pages/GMMCotizador.tsx`
   - Coberturas preseleccionadas por default
   - Integración con sistema de guardado

4. `src/pages/MisCotizaciones.tsx` (nuevo)
   - Listado completo de cotizaciones
   - Acciones: Descargar PDF, Editar, Eliminar

### Archivos de Diagnóstico
- `public/diagnostico-gmm-calculo.html` (nuevo)

## Próximos Pasos

1. **Probar el diagnóstico**
   - Verificar que todos los factores se leen correctamente

2. **Crear cotización de prueba**
   - Usar valores conocidos
   - Verificar que las primas se calculan

3. **Guardar y descargar PDF**
   - Verificar que el PDF incluye todas las secciones nuevas
   - Confirmar que las primas aparecen correctamente

4. **Si todo funciona:**
   - El módulo está listo para uso en producción

---

**Estado Actual:** Corrección aplicada y compilada exitosamente ✅

El proyecto está listo para pruebas. El motor de cálculo ahora lee correctamente el factor de estado desde la columna 2 (col_2).
