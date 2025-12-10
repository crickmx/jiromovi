# Guía Completa: Sistema de Comisiones con PortPart

## Resumen

El sistema de comisiones ahora soporta el uso de la columna **PortPart** del archivo Excel de las aseguradoras, que contiene el porcentaje o monto de comisión ya calculado. Esta es la forma más precisa de calcular comisiones, ya que usa los valores exactos proporcionados por las aseguradoras.

## ¿Qué es PortPart?

**PortPart** es una columna que viene en los archivos Excel de las aseguradoras que contiene:
- El porcentaje o monto de comisión ya calculado por la aseguradora
- Incluye todos los ajustes, bonos, penalizaciones y condiciones especiales
- Garantiza que las comisiones coincidan exactamente con los reportes oficiales

## Ventajas de Usar PortPart

✅ **Precisión Máxima**: Usa el cálculo oficial de la aseguradora
✅ **Sin Discrepancias**: Coincide exactamente con reportes oficiales
✅ **Incluye Ajustes**: Bonos, penalizaciones, condiciones especiales ya incluidos
✅ **Menos Errores**: No hay diferencias por redondeos o fórmulas

## Estructura del Archivo Excel

El archivo Excel debe contener las siguientes columnas **obligatorias**:

```
FPago          - Fecha de pago (formato fecha)
EmailAgente    - Email del agente (o columna "Email")
Ramo           - Tipo de seguro (Autos, Vida, GMM, etc.)
Aseguradora    - Nombre de la aseguradora (o "CiaAbreviacion")
PrimaNeta      - Prima neta de la póliza
PortPart       - Comisión calculada por la aseguradora (NUEVA)
Poliza         - Número de póliza (o "Documento")
Concepto       - Concepto del pago (opcional)
```

### Ejemplo de Datos

| FPago      | EmailAgente          | Ramo  | Aseguradora | PrimaNeta | PortPart | Poliza    |
|------------|---------------------|-------|-------------|-----------|----------|-----------|
| 2024-12-01 | agente@correo.com   | Autos | GNP         | 10000     | 1250     | POL-12345 |
| 2024-12-01 | otro@correo.com     | Vida  | AXA         | 20000     | 2500     | POL-67890 |

## Reglas de Negocio Creadas

Se han creado **33 reglas predeterminadas** con `tipo_calculo = 'usar_portpart'` para:

### Aseguradoras Incluidas
- GNP (5 ramos: Autos, Vida, GMM, Daños, Diversos)
- AXA (4 ramos: Autos, Vida, GMM, Daños)
- Qualitas (2 ramos: Autos, Daños)
- HDI (4 ramos: Autos, Vida, GMM, Daños)
- Mapfre (4 ramos: Autos, Vida, GMM, Daños)
- Chubb (3 ramos: Autos, Vida, Daños)
- AIG (4 ramos: Autos, Vida, GMM, Daños)
- Banorte (3 ramos: Autos, Vida, GMM)
- Zurich (4 ramos: Autos, Vida, GMM, Daños)

### Características de las Reglas
- **Prioridad**: 100 (más alta que otras reglas)
- **Campo Base**: PortPart
- **Oficina**: Aplica a todas (office_id = NULL)
- **Vigencia**: Desde 2024-01-01, sin fecha de fin

## Cómo Usar el Sistema

### Paso 1: Preparar el Archivo Excel

1. Asegúrate que tu archivo tiene la columna **PortPart**
2. Verifica que las columnas obligatorias estén presentes
3. Los emails de agentes deben coincidir con los registrados en el sistema

### Paso 2: Subir el Archivo

1. Ve a **Comisiones** → **Subir Archivo**
2. Selecciona tu archivo .xlsx
3. El sistema validará las columnas automáticamente
4. Verás un resumen de las semanas encontradas

### Paso 3: Seleccionar Semanas

1. El sistema agrupa las pólizas por semana
2. Selecciona las semanas que deseas procesar
3. Puedes seleccionar una o varias semanas

### Paso 4: Procesar

1. Haz clic en **"Procesar Comisiones"**
2. El sistema:
   - Buscará la regla de negocio correspondiente
   - Usará el valor de **PortPart** directamente
   - Calculará impuestos según el régimen fiscal del agente
   - Creará los lotes por semana

### Paso 5: Verificar Resultados

1. El sistema mostrará:
   - Lotes creados exitosamente
   - Número de errores (si los hay)
2. Navega a **Ver Lotes** para ver los detalles

## Diagnóstico de Problemas

### Problema: "Lotes creados exitosamente: 0"

**Posibles causas:**

1. **No hay semanas seleccionadas**
   - Verifica que hayas marcado al menos una semana

2. **Fechas incorrectas en el Excel**
   - La columna FPago debe tener formato de fecha válido
   - Formato recomendado: YYYY-MM-DD o DD/MM/YYYY

3. **Filas filtradas**
   - Revisa los logs de la función edge en Supabase
   - Ve a: Supabase Dashboard → Edge Functions → process-commissions → Logs

### Ver Logs de Procesamiento

Para ver los logs detallados:

1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Console"
3. Busca mensajes que empiecen con `[process-commissions]`
4. Verás información como:
   ```
   [process-commissions] Received rows: 150
   [process-commissions] Selected weeks: 2
   [process-commissions] Filtered rows: 75
   [process-commissions] Batches to create: 2
   ```

### Problema: "No se encontró regla para Ramo/Aseguradora"

**Solución:**

1. Ve a **Comisiones** → **Reglas de Negocio**
2. Crea una nueva regla:
   - Ramo: El ramo del error
   - Aseguradora: La aseguradora del error
   - Tipo de Cálculo: **Usar valor de PortPart (Recomendado)**
   - Campo Base: Se establece automáticamente en PortPart
   - Prioridad: 100 (o mayor)

### Problema: "El agente no tiene régimen fiscal asignado"

**Solución:**

1. Ve a **Comisiones** → **Importar Agentes**
2. Busca el agente
3. Asígnale un régimen fiscal válido

## Crear Reglas de Negocio Manualmente

Si necesitas crear reglas adicionales:

### 1. Ir a Reglas de Negocio

**Comisiones** → **Reglas de Negocio** → **Nueva Regla**

### 2. Llenar el Formulario

```
Ramo:              [Selecciona el ramo]
Aseguradora:       [Escribe el nombre exacto de la aseguradora]
Oficina:           Todas (dejar en blanco para aplicar a todas)
Campo Base:        PortPart (se establece automáticamente)
Tipo de Cálculo:   Usar valor de PortPart (Recomendado)
Prioridad:         100 (más alto = mayor prioridad)
Válido Desde:      2024-01-01
Válido Hasta:      Dejar vacío (sin fecha de fin)
```

### 3. Guardar

La regla estará disponible inmediatamente para procesamiento.

## Tipos de Cálculo Disponibles

El sistema soporta 4 tipos de cálculo:

### 1. Usar valor de PortPart ⭐ (Recomendado)
- Usa el valor directo de la columna PortPart
- No requiere configurar porcentaje ni montos
- Es la forma más precisa

### 2. Porcentaje sobre base
- Calcula: `PrimaNeta * porcentaje / 100`
- Requiere: porcentaje

### 3. Monto fijo
- Usa un monto fijo por póliza
- Requiere: monto_fijo

### 4. Porcentaje con mínimo y máximo
- Calcula porcentaje con límites
- Requiere: porcentaje, mínimo, máximo

## Verificar Reglas Creadas

### Opción 1: Página de Verificación

Abre en tu navegador:
```
http://localhost:5173/test-portpart-rules.html
```

Funciones disponibles:
- **Ver Todas las Reglas**: Lista completa de reglas
- **Ver Reglas con PortPart**: Solo reglas que usan PortPart
- **Ver Estadísticas**: Distribución de tipos de cálculo
- **Simular Cálculo**: Comparación entre métodos

### Opción 2: Base de Datos

```sql
-- Ver todas las reglas con PortPart
SELECT ramo, aseguradora, campo_base, prioridad
FROM commission_business_rules
WHERE tipo_calculo = 'usar_portpart'
ORDER BY aseguradora, ramo;

-- Contar reglas por tipo
SELECT tipo_calculo, COUNT(*) as cantidad
FROM commission_business_rules
GROUP BY tipo_calculo;
```

## Prioridad de Reglas

Cuando existen múltiples reglas que coinciden:

1. **Mayor prioridad gana** (número más alto)
2. Las reglas con PortPart tienen prioridad 100
3. Reglas específicas de oficina tienen prioridad sobre reglas generales
4. La fecha debe estar dentro de la vigencia

### Ejemplo de Prioridad

```
Regla 1: Autos + GNP + PortPart + Prioridad 100 → Se usa esta ✅
Regla 2: Autos + GNP + 15% + Prioridad 50 → Se ignora
Regla 3: Autos + GNP + Oficina A + Prioridad 90 → Se ignora
```

## Flujo Completo del Sistema

```
1. Usuario sube Excel con columna PortPart
   ↓
2. Sistema valida columnas obligatorias
   ↓
3. Sistema agrupa por semanas
   ↓
4. Usuario selecciona semanas
   ↓
5. Sistema procesa cada póliza:
   - Busca agente por email
   - Busca regla de negocio (tipo_calculo = 'usar_portpart')
   - Toma valor directo de PortPart
   - Calcula impuestos según régimen fiscal
   - Calcula comisión neta
   ↓
6. Sistema crea lotes por semana
   ↓
7. Usuario puede ver resultados y ajustar si es necesario
```

## Cálculo de Comisión con PortPart

### Fórmula

```javascript
// Comisión Bruta
commission_bruta = PortPart (valor directo del Excel)

// Impuestos
iva_trasladado = commission_bruta * regimen.iva_trasladado
iva_retenido   = commission_bruta * regimen.iva_retenido
isr            = commission_bruta * regimen.isr
otros          = commission_bruta * regimen.otros

// Comisión Neta
commission_neta = commission_bruta
                  + iva_trasladado
                  - iva_retenido
                  - isr
                  - otros
```

### Ejemplo Numérico

```
Datos del Excel:
- PrimaNeta: $10,000
- PortPart: $1,250

Régimen Fiscal del Agente:
- IVA Trasladado: 16% (0.16)
- IVA Retenido: 10.66% (0.1066)
- ISR: 10% (0.10)

Cálculo:
1. Comisión Bruta = $1,250 (valor directo de PortPart)
2. IVA Trasladado = $1,250 × 0.16 = $200
3. IVA Retenido = $1,250 × 0.1066 = $133.25
4. ISR = $1,250 × 0.10 = $125
5. Comisión Neta = $1,250 + $200 - $133.25 - $125 = $1,191.75
```

## Preguntas Frecuentes

### ¿Qué pasa si el Excel no tiene columna PortPart?

El sistema funcionará normalmente usando las otras reglas de negocio (% sobre base, monto fijo, etc.).

### ¿Puedo mezclar reglas con PortPart y sin PortPart?

Sí. El sistema buscará la regla con mayor prioridad. Si no encuentra una regla con PortPart, usará otra disponible.

### ¿Qué pasa si PortPart viene vacío o null?

El sistema intentará usar otra regla de negocio disponible para ese ramo y aseguradora.

### ¿Puedo cambiar la prioridad de las reglas?

Sí, puedes editar cualquier regla y cambiar su prioridad. Mayor número = mayor prioridad.

### ¿Las reglas aplican a todas las oficinas?

Las reglas predeterminadas aplican a todas las oficinas (office_id = NULL). Puedes crear reglas específicas por oficina con mayor prioridad.

## Soporte Técnico

Para problemas o dudas:

1. **Ver logs del navegador**: Consola (F12) → Console
2. **Ver logs de Supabase**: Dashboard → Edge Functions → Logs
3. **Verificar reglas**: `/test-portpart-rules.html`
4. **Revisar base de datos**: Tabla `commission_business_rules`

## Próximos Pasos Recomendados

1. ✅ Subir archivo de prueba con columna PortPart
2. ✅ Verificar que se crean los lotes correctamente
3. ✅ Revisar que los montos coinciden con reportes oficiales
4. ✅ Ajustar prioridades de reglas si es necesario
5. ✅ Capacitar al equipo en el uso del sistema

---

**Última actualización**: Diciembre 2024
**Versión**: 1.0
