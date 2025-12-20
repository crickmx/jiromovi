# Fix: Error al Cargar Tarifas GMM

## Problema Resuelto

Se corrigió el error "Error al cargar tarifas" que ocurría al intentar acceder al cotizador GMM.

## Causa del Error

El motor de cálculo V2 no estaba cargando todas las propiedades requeridas por el tipo `TariffTables`, específicamente:
- `forma_pago`
- `maternidad_tasa_por_edad`
- `maternidad_threshold`
- `indemnizacion_eg_monto`
- `xtensuz_factor`
- `gastos_expedicion`
- `iva`

## Solución Implementada

Se actualizó la función `loadTariffTables()` en `/src/lib/gmmCalculationEngineV2.ts` para cargar todas las propiedades requeridas.

---

## Diagnóstico del Sistema

Para verificar que el sistema GMM esté funcionando correctamente:

### Opción 1: Usar la herramienta de diagnóstico

1. Abrir en el navegador: `/diagnostico-gmm-tarifas.html`
2. La herramienta ejecutará automáticamente un diagnóstico completo
3. Mostrará:
   - Estado de autenticación
   - Paquetes de tarifas disponibles
   - Paquete activo (si existe)
   - Tablas cargadas
   - Coeficientes de coberturas
   - Acciones recomendadas

### Opción 2: Verificación manual en Supabase

Ejecutar estas consultas en el SQL Editor de Supabase:

```sql
-- 1. Verificar paquetes de tarifas
SELECT id, name, status, source_filename, created_at
FROM tariff_packages
ORDER BY created_at DESC;

-- 2. Verificar si hay un paquete activo
SELECT id, name, status
FROM tariff_packages
WHERE status = 'active';

-- 3. Contar tablas del paquete activo
SELECT COUNT(*) as total_tablas
FROM tariff_tables
WHERE tariff_package_id = (
  SELECT id FROM tariff_packages WHERE status = 'active' LIMIT 1
);

-- 4. Ver todas las tablas del paquete activo
SELECT table_key, row_count
FROM tariff_tables
WHERE tariff_package_id = (
  SELECT id FROM tariff_packages WHERE status = 'active' LIMIT 1
)
ORDER BY table_key;
```

---

## Soluciones a Problemas Comunes

### Problema 1: "No hay tarifas activas"

**Síntoma:** El diagnóstico muestra que no hay paquetes con status = 'active'

**Solución:**
1. Ir a "GMM Tarifas Admin" en la aplicación
2. Cargar un archivo Excel con las tarifas BX+
3. Una vez cargado, activar el paquete
4. Recargar el cotizador

---

### Problema 2: "No hay paquetes de tarifas"

**Síntoma:** La tabla `tariff_packages` está vacía

**Solución:**
1. Ir a "GMM Tarifas Admin"
2. Cargar el archivo Excel oficial de tarifas BX+
3. Esperar a que se procese (puede tardar unos segundos)
4. Verificar que el status sea 'active'

---

### Problema 3: "Faltan tablas requeridas"

**Síntoma:** El paquete activo no tiene todas las tablas necesarias

**Tablas requeridas mínimas:**
- `base_intermedia_edad_sexo`
- `factor_estado`
- `factor_nivel_hospitalario`
- `factor_tabulador`
- `factor_suma_asegurada`
- `factor_deducible`
- `factor_coaseguro`
- `denominador_cargas`
- `forma_pago`

**Solución:**
1. Verificar que el Excel tenga todas las hojas y rangos necesarios
2. Borrar el paquete incompleto
3. Volver a cargar el Excel completo
4. Activar el nuevo paquete

---

### Problema 4: "Coeficientes con valor 0 o vacío"

**Síntoma:** Los coeficientes de coberturas no tienen valores

**Coeficientes requeridos:**
- `coef_medicamentos`
- `coef_preexistentes`
- `coef_complicaciones`
- `coef_vip`
- `coef_antiguedad`
- `coef_emergencia_ext`
- `coef_enf_graves_ext`
- `coef_ayuda_diaria`
- `coef_ampliacion_servicios`

**Solución:**
1. Verificar que el Excel tenga los coeficientes en las celdas correctas
2. Verificar que los valores sean numéricos (no texto)
3. Recargar el Excel

---

## Verificación Post-Fix

Después de aplicar el fix, verificar:

1. ✅ El proyecto compila sin errores (`npm run build`)
2. ✅ El cotizador GMM carga sin mostrar "Error al cargar tarifas"
3. ✅ Los dropdowns de estado, nivel, tabulador, etc. tienen opciones
4. ✅ Se pueden agregar asegurados
5. ✅ El botón "Calcular" funciona
6. ✅ Se generan resultados correctos

---

## Próximos Pasos

1. Ejecutar el diagnóstico: `/diagnostico-gmm-tarifas.html`
2. Si no hay tarifas, cargarlas desde "GMM Tarifas Admin"
3. Si hay tarifas pero no están activas, activarlas
4. Probar una cotización de prueba
5. Comparar resultados con Excel oficial

---

## Archivos Modificados

- ✅ `/src/lib/gmmCalculationEngineV2.ts` - Fix en `loadTariffTables()`
- ✅ `/public/diagnostico-gmm-tarifas.html` - Nueva herramienta de diagnóstico
- ✅ Proyecto compilado exitosamente

---

## Fix Adicional: Página en Blanco al Calcular

Durante la corrección del error de carga de tarifas, se identificó y corrigió un segundo bug crítico:

**Problema:** Al dar clic en "Calcular", la página se ponía en blanco.

**Causa:** `result.payment_plans.map is not a function` - El motor V2 devolvía un objeto en lugar de un array.

**Solución:** Se actualizó la función `calcularFormasDePago()` para devolver un array de `PaymentPlanResult[]`.

**Documentación completa:** Ver `FIX_PAGINA_EN_BLANCO_CALCULAR.md`

**Test de verificación:** `/test-gmm-calculo-fix.html`

---

**Fecha del fix:** 2024-12-20
**Estado:** Resuelto ✅ (ambos problemas)
