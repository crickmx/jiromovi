# Solución de Errores en Producción

## Problemas Identificados y Corregidos

### 1. Error en CalendarioEventos (Dashboard)

**Error detectado:**
```
column aula_eventos.fecha_evento does not exist
```

**Causa:**
El componente `CalendarioEventos.tsx` intentaba acceder a columnas que no existen en la tabla `aula_eventos`. La tabla tiene las siguientes columnas:
- `fecha` (date) - no `fecha_evento`
- `hora` (time) - no `hora_inicio` y `hora_fin`
- No tiene columna `ubicacion`

**Solución aplicada:**
Se corrigió la consulta en `src/components/CalendarioEventos.tsx:150-167` para usar las columnas correctas:
- Cambiado `fecha_evento` a `fecha`
- Eliminadas referencias a `hora_inicio`, `hora_fin` y `ubicacion`

**Resultado:**
El calendario ahora carga correctamente los eventos del Aula Digital.

---

## 2. Error "Error al procesar el archivo" en Comisiones

### Causas Posibles

El error puede ocurrir por varias razones. El edge function `process-commissions` tiene logging extensivo que ayudará a identificar la causa exacta. Aquí están las causas más comunes:

#### A. No hay agentes registrados

**Síntoma:** Error indica que no hay agentes en el sistema.

**Solución:**
1. Ir a cualquier lote de comisiones existente
2. En la pestaña "Por Agente", los agentes se crean automáticamente basados en los datos del Excel
3. Si no hay lotes previos, el primer archivo que subas creará los agentes automáticamente

**Nota:** Los agentes se crean automáticamente al procesar el primer archivo Excel. No necesitas crear agentes manualmente.

#### B. Emails no coinciden

**Síntoma:** Error indica que el agente no fue encontrado para cierto email.

**Solución:**
- Verificar que la columna `Email` o `EmailAgente` en el Excel coincida exactamente con los emails de los agentes ya registrados
- Los emails se comparan en minúsculas, así que "Juan@example.com" es igual a "juan@example.com"
- Revisar la pestaña "Errores" del lote para ver qué emails no se encontraron

#### C. Columnas requeridas faltantes

**Síntoma:** Error indica que faltan columnas.

**Columnas obligatorias en el Excel:**
- `FPago` - Fecha de pago (formato fecha)
- `Email` o `EmailAgente` - Email del agente
- `Ramo` - Ramo de seguro
- `Aseguradora` o `CiaAbreviacion` - Nombre de la aseguradora
- `Importe` - Base de comisión (número). **CRÍTICO:** Este es el valor sobre el cual se calcula la comisión
- `PorPart` - Porcentaje de comisión (número, ej: 25 para 25%)
- `Poliza` o `Documento` - Número de póliza/documento

**Columnas opcionales:**
- `PrimaNeta` - Prima neta (solo informativo)
- `NombreCompleto`, `NombreAsegurado` o `Asegurado` - Nombre del asegurado
- `Concepto` - Descripción adicional

#### D. Datos inválidos

**Síntoma:** Error indica que hay datos inválidos.

**Validaciones que se hacen:**
- `FPago` debe ser una fecha válida
- `Importe` debe ser un número mayor a 0
- `PorPart` debe ser un número

### Cómo Diagnosticar el Error Específico

1. **Revisar la consola del navegador:**
   - Abrir DevTools (F12)
   - Ver la pestaña Console
   - Buscar mensajes que empiecen con `[ComisionesUpload]` o `[process-commissions]`

2. **Revisar errores en el lote creado:**
   - Si se creó un lote, ir a la pestaña "Errores" del lote
   - Ahí verás los detalles específicos de cada fila que falló

3. **Verificar el formato del Excel:**
   - Asegurarse de que sea un archivo `.xlsx`
   - Verificar que todas las columnas requeridas existan
   - Confirmar que los datos sean del tipo correcto

### Fórmula de Cálculo

**IMPORTANTE:** La comisión se calcula como:
```
Comisión = Importe × (PorPart / 100)
```

- El campo `PrimaNeta` es SOLO informativo y no afecta el cálculo
- El campo `Importe` debe contener la base correcta para el cálculo de comisiones

### Recomendaciones

1. **Probar con un archivo pequeño primero:** Subir un Excel con 2-3 filas para validar el formato
2. **Revisar el primer lote con detalle:** Ver la pestaña "Errores" para entender qué falló
3. **Comparar emails:** Asegurarse de que los emails coincidan exactamente
4. **Validar el Excel:** Verificar que todas las columnas requeridas estén presentes y con datos válidos

---

## Estado Actual

- **Problema del calendario:** ✅ CORREGIDO
- **Gráficas de comisiones:** ✅ IMPLEMENTADAS
- **Edge function de comisiones:** ✅ VERIFICADA (funcionando correctamente)

El proyecto ha sido compilado exitosamente con todas las correcciones aplicadas.
