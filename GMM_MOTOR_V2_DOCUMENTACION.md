# Motor de Cálculo GMM BX+ V2 - Documentación Técnica

## Resumen Ejecutivo

Se ha refactorizado completamente el motor de cálculo del cotizador GMM BX+ con los siguientes objetivos:

1. **Alineación 1:1 con el Excel oficial** (fuente única de verdad)
2. **Prevención de errores futuros** al agregar/modificar coberturas, edades, regiones, etc.
3. **Arquitectura en 5 capas** claramente separadas
4. **Validaciones automáticas** en cada paso
5. **Modo debug integrado** para auditoría

---

## Principio Fundamental

**El Excel es la ÚNICA fuente de verdad.**

El sistema:
- ✅ NO infiere
- ✅ NO simplifica
- ✅ NO reinterpreta
- ✅ Replica exactamente la lógica del Excel

---

## Arquitectura de 5 Capas

### Capa 1: Datos Base (Lookup Puro)

**Responsabilidad:** Buscar valores en tablas SIN realizar cálculos.

**Funciones principales:**
- `vlookup()` - Búsqueda genérica en tablas
- `vlookupByAge()` - Búsqueda por edad y sexo
- `getTopeCoaseguro()` - Obtener topes de coaseguro

**Reglas:**
- ❌ NO calcula nada
- ✅ Solo retorna valores de tablas
- ✅ Lanza error si no encuentra el valor

**Ejemplo:**
```typescript
const factorEstado = vlookup(tables.factor_estado, 'Aguascalientes', 2, 'Factor Estado');
// Retorna: 1.05 (directo de la tabla, sin cálculo)
```

---

### Capa 2: Construcción de Prima Base FINAL

**Responsabilidad:** Multiplicar TODOS los factores para obtener la prima base final.

**Fórmula exacta:**
```
prima_base_final =
  base_edad_sexo
  × factor_estado
  × factor_nivel_hospitalario
  × factor_tabulador
  × factor_suma_asegurada
  × factor_deducible
  × factor_coaseguro
```

**Función principal:**
- `calcularPrimaBaseFinal()`

**Reglas:**
- ✅ Todos los factores DEBEN aplicarse
- ✅ El orden importa (mismo orden que Excel)
- ❌ No saltarse factores
- ❌ No usar tablas intermedias como prima final

**Retorna:**
```typescript
interface PrimaBaseComponents {
  baseEdadSexo: number;
  factorEstado: number;
  factorNivelHospitalario: number;
  factorTabulador: number;
  factorSumaAsegurada: number;
  factorDeducible: number;
  factorCoaseguro: number;
  primaBaseFinal: number;
}
```

---

### Capa 3: Cargas del Sistema (Denominador)

**Responsabilidad:** Aplicar las cargas del sistema a la prima base.

**Fórmula exacta:**
```
prima_base_con_cargas = prima_base_final / (1 - SUM(cargas_sistema))
```

**Función principal:**
- `aplicarCargasSistema()`

**Reglas:**
- ✅ Las cargas vienen directamente del Excel
- ❌ Nunca hardcodear las cargas
- ✅ Validar que denominador > 0

**Retorna:**
```typescript
interface CargasSistema {
  sumCargas: number;
  denominador: number;
  primaBaseConCargas: number;
}
```

---

### Capa 4: Coberturas Adicionales (Modular y Extensible)

**Responsabilidad:** Calcular coberturas adicionales de forma modular.

**Arquitectura:**
- Cada cobertura tiene su configuración
- Todas las coberturas se calculan de la misma forma
- Base de cálculo consistente

**Configuración de cobertura:**
```typescript
interface CoberturaConfig {
  nombre: string;
  activa: boolean;
  coeficiente?: number;
  calcularFactor?: (edad, sexo, input, tables) => number;
  baseCalculo: 'primaBaseConCargas' | 'primaBaseFinal';
}
```

**Fórmula:**
```
prima_cobertura = base_calculo × coeficiente
```

**Función principal:**
- `calcularCoberturasAdicionales()`

**Reglas:**
- ✅ Todas las coberturas usan la misma base correcta
- ❌ No recalcular la prima base por cobertura
- ✅ Fácil agregar nuevas coberturas (agregar config, listo)

**Coberturas soportadas:**
1. Medicamentos fuera (usa `primaBaseConCargas`)
2. Padecimientos preexistentes (usa `primaBaseConCargas`)
3. Complicaciones no amparadas (usa `primaBaseConCargas`)
4. VIP (usa `primaBaseFinal`)
5. Reconocimiento antigüedad (usa `primaBaseFinal`)
6. Emergencia médica extranjero (usa `primaBaseFinal`)
7. Enfermedades graves extranjero (usa `primaBaseFinal`)
8. Ayuda diaria (usa `primaBaseFinal`)
9. Ampliación servicios (usa `primaBaseFinal`)
10. Eliminación deducible accidente (usa `primaBaseFinal`, factor dinámico)
11. Multiregión (usa `primaBaseFinal`, factor por estado)
12. Cobertura internacional (usa `primaBaseFinal`, factor por edad/sexo)
13. Indemnización EG (usa `primaBaseFinal`, factor por edad/sexo)

---

### Capa 5: Totales

**Responsabilidad:** Calcular los totales finales de la cotización.

**Fórmulas:**
```
prima_neta_asegurado = prima_base_final + SUM(coberturas)
prima_neta_total = SUM(prima_neta_asegurado por persona)
gastos_expedicion = num_asegurados × 150
subtotal = prima_neta_total + gastos_expedicion
iva = subtotal × 0.16
total_con_iva = subtotal + iva
```

**Funciones principales:**
- `calcularPrimaNetaAsegurado()`
- `calcularTotales()`
- `calcularFormasDePago()`

---

## Validaciones Automáticas

### Validación de Tablas

**¿Qué valida?**
- Todas las tablas requeridas existen
- Las tablas no están vacías

**Función:** `validarTablas()`

**Resultado:**
```typescript
interface ValidationResult {
  valido: boolean;
  errores: string[];
  advertencias: string[];
}
```

**Tablas requeridas:**
1. `base_intermedia_edad_sexo`
2. `factor_estado`
3. `factor_nivel_hospitalario`
4. `factor_tabulador`
5. `factor_suma_asegurada`
6. `factor_deducible`
7. `factor_coaseguro`
8. `denominador_cargas`

---

### Validación de Factores

**¿Qué valida?**
- Ningún factor es 0 o negativo
- Factores no son inusualmente altos (> 100)

**Función:** `validarFactores()`

**Ejemplo de error:**
```
[VALIDACIÓN] Factor "factorEstado" = 0 (debe ser > 0)
```

---

## Modo Debug

**¿Cómo activarlo?**
```typescript
const resultado = calculateQuoteV2(input, tables, true); // debug = true
```

**¿Qué muestra?**
Para cada asegurado:
```typescript
interface DebugInfo {
  capa1_datosBase: {
    baseEdadSexo: number;
    factorEstado: number;
    // ... todos los factores
  };
  capa2_primaBaseFinal: number;
  capa3_cargas: {
    sumCargas: number;
    denominador: number;
    primaBaseConCargas: number;
  };
  capa4_coberturas: Record<string, number>;
  capa5_totales: {
    primaNetaAsegurado: number;
  };
  validaciones: {
    tablas: ValidationResult;
    factores: ValidationResult;
  };
}
```

**Uso:**
- Comparar valores intermedios con Excel
- Identificar dónde se genera una diferencia
- Auditar cálculos

---

## Cómo Agregar una Nueva Cobertura

### Paso 1: Agregar coeficiente a `TariffTables`

```typescript
// En gmmTypes.ts
export interface TariffTables {
  // ... existentes ...
  coef_nueva_cobertura: number;
}
```

### Paso 2: Cargar coeficiente en `loadTariffTables`

```typescript
// En gmmCalculationEngineV2.ts
export function loadTariffTables(tables: any[]): TariffTables {
  return {
    // ... existentes ...
    coef_nueva_cobertura: Number(get('coef_nueva_cobertura')?.[0]?.col_0 || 0),
  };
}
```

### Paso 3: Agregar a configuración de coberturas

```typescript
// En obtenerConfiguracionCoberturas()
{
  nombre: 'nueva_cobertura',
  activa: input.coberturas.nueva_cobertura,
  coeficiente: tables.coef_nueva_cobertura,
  baseCalculo: 'primaBaseConCargas' // o 'primaBaseFinal' según Excel
}
```

### Paso 4: Agregar al input de usuario

```typescript
// En gmmTypes.ts
export interface QuoteCoverages {
  // ... existentes ...
  nueva_cobertura: boolean;
}
```

¡Listo! La cobertura se calcula automáticamente.

---

## Cómo Validar el Motor

### Validación Manual (Caso por Caso)

1. **Preparar caso de prueba en Excel**
   - Llenar todos los parámetros
   - Anotar el resultado final

2. **Activar modo debug**
   ```typescript
   const resultado = calculateQuoteV2(input, tables, true);
   ```

3. **Comparar en consola**
   - Prima base final
   - Prima base con cargas
   - Cada cobertura
   - Total final

4. **Tolerancia:** ≤ $0.01 de diferencia

### Validación Automática (Recomendado)

```typescript
// Crear suite de pruebas
const casosPrueba = [
  { descripcion: 'Hombre 30 años, Aguascalientes', input: {...}, esperado: 5000.00 },
  { descripcion: 'Mujer 45 años, CDMX', input: {...}, esperado: 7500.00 },
  // ... más casos
];

for (const caso of casosPrueba) {
  const resultado = calculateQuoteV2(caso.input, tables, false);
  const diferencia = Math.abs(resultado.total_con_iva - caso.esperado);

  if (diferencia > 0.01) {
    console.error(`❌ ${caso.descripcion}: esperado ${caso.esperado}, obtenido ${resultado.total_con_iva}`);
  } else {
    console.log(`✅ ${caso.descripcion}`);
  }
}
```

---

## Criterio de Aceptación

**Una cotización generada por el sistema DEBE coincidir EXACTAMENTE con el Excel oficial, o el cálculo se considera inválido.**

Diferencia permitida: **$0.01 máximo** (por redondeos)

---

## Mantenimiento Futuro

### ✅ Cambios Seguros (No Rompen el Sistema)

- Agregar coberturas nuevas
- Modificar coeficientes existentes
- Cambiar factores de estado/región
- Actualizar tablas de edad
- Agregar rangos de suma asegurada
- Modificar deducibles/coaseguros

### ⚠️ Cambios que Requieren Validación

- Cambiar el orden de multiplicación de factores
- Modificar la fórmula de cargas
- Cambiar la base de cálculo de coberturas existentes
- Modificar redondeos

### ❌ Cambios NO Permitidos

- Saltarse factores en el cálculo
- Inferir valores en lugar de leerlos de tablas
- Simplificar fórmulas "porque el resultado es similar"
- Cambiar el principio de "Excel = fuente de verdad"

---

## Migración del Motor Antiguo

### Archivos Modificados

1. **Nuevo:** `/src/lib/gmmCalculationEngineV2.ts` (motor refactorizado)
2. **Actualizado:** `/src/pages/GMMCotizador.tsx` (usa motor V2)

### Archivos No Modificados (Compatibilidad)

- `/src/lib/gmmTypes.ts` (interfaces sin cambios)
- `/src/lib/gmmParsingUtils.ts` (utilidades sin cambios)
- `/src/lib/gmmPdfGenerator.ts` (generación de PDF sin cambios)
- `/src/lib/gmmCoverageHelp.ts` (textos de ayuda sin cambios)

### Motor Antiguo

El motor antiguo permanece en `/src/lib/gmmCalculationEngine.ts` para referencia o rollback si fuera necesario.

---

## Contacto y Soporte

Para dudas o problemas con el motor V2:

1. Revisar esta documentación
2. Activar modo debug y analizar logs
3. Comparar paso a paso con Excel
4. Verificar que las tablas estén cargadas correctamente

---

**Última actualización:** 2024-12-20
**Versión del motor:** 2.0.0
**Estado:** Producción
