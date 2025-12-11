# Diagnóstico: Producción No Muestra Datos

## El Problema

La configuración de Google Sheets está guardada correctamente, pero las páginas de Producción no muestran datos.

## Herramientas de Diagnóstico

He agregado **logs detallados** en el código y creado **herramientas de prueba** para diagnosticar el problema.

## Pasos para Diagnosticar

### 1. Abrir la Herramienta de Prueba

1. Abre tu navegador
2. Ve a: `https://tu-dominio.com/test-production-google-sheets.html`
3. O abre el archivo: `/public/test-production-google-sheets.html`

### 2. Ejecutar las Pruebas en Orden

#### Test 1: Verificar Configuración DB
- Click en "Test 1: Verificar Configuración DB"
- Esto verifica que la configuración esté guardada correctamente
- Deberías ver el Sheet ID: `1FladEQiSlbwHQoBKGtPMq5WI-MSXYPm2HcfUZsEadbk`

#### Test 2: Probar CSV Directo
- Click en "Test 2: Probar CSV Directo"
- Esto intenta descargar el CSV directamente desde Google Sheets
- **IMPORTANTE**: Si falla con error 403 o 401, significa que el Google Sheet NO es público

**Si Test 2 Falla:**
1. Abre el Google Sheet en tu navegador
2. Click en "Compartir" (esquina superior derecha)
3. En "Acceso general", selecciona **"Cualquier persona con el link"**
4. Asegúrate de que el rol sea **"Lector"**
5. Click en "Listo"
6. Vuelve a ejecutar Test 2

#### Test 3: Llamar Edge Function
- Click en "Test 3: Llamar Edge Function"
- Esto prueba el Edge Function completo
- Deberías ver: "Edge Function funcionando: X registros"

#### Test 4: Simular Carga de Producción Total
- Click en "Test 4: Simular Carga de Producción Total"
- Esto simula exactamente lo que hace ProduccionTotal.tsx
- Deberías ver el total de registros y el primer registro

### 3. Revisar la Consola del Navegador

1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Console"
3. Ve a la página de **Producción Total** o **Producción Convenio**
4. Busca los logs que comienzan con `[ProduccionTotal]` o `[ProduccionConvenio]`

**Logs esperados:**
```
[ProduccionTotal] Iniciando carga de datos...
[ProduccionTotal] Llamando a: https://...
[ProduccionTotal] Response status: 200
[ProduccionTotal] Result: {success: true, total: 12345, hasRecords: true}
[ProduccionTotal] Procesando 12345 registros...
[ProduccionTotal] Datos procesados: 12345
[ProduccionTotal] Records establecidos en state: 12345
[ProduccionTotal] Carga completada exitosamente
```

**Si ves errores:**
- Anota el mensaje de error completo
- Revisa el Response status (¿es 200, 403, 500?)
- Revisa si `result.success` es `false`

## Problemas Comunes y Soluciones

### Problema 1: "Error al obtener datos de Google Sheets"
**Causa**: El Google Sheet no es público
**Solución**:
1. Abre el Google Sheet
2. Compartir → "Cualquier persona con el link" → "Lector"

### Problema 2: "No hay una configuración activa de Google Sheets"
**Causa**: No se ha configurado el link
**Solución**:
1. Ir a `/produccion/configuracion`
2. Ingresar el link de Google Sheets
3. Guardar

### Problema 3: Edge Function devuelve error 500
**Causa**: Error en el parseo del CSV o estructura incorrecta
**Solución**:
1. Verificar que el Google Sheet tenga las columnas correctas
2. Verificar que los nombres de las columnas coincidan exactamente

### Problema 4: Los datos llegan pero no se muestran
**Causa**: Problema en el frontend
**Solución**:
1. Revisar si `records.length > 0` en la consola
2. Verificar que no haya errores de filtros
3. Verificar que `filteredRecords` tenga datos

## Columnas Esperadas en Google Sheets

El sistema busca estas columnas (no son case-sensitive):

**Obligatorias:**
- `FechaSimp` o `Fecha`
- `DespNombre` (nombre del despacho)
- `GerenciaNombre` (nombre de la gerencia)
- `VendNombre` (nombre del agente)
- `Nombre Compañía` (aseguradora)
- `Sub Ramo` o `RamosNombre` (ramo)
- `IMPORTE PESOS` (importe en pesos)
- `Prima de convenio`
- `Prima Ponderada`
- `Bono`

**Opcionales:**
- `Dirección Regional` o `region`
- `CONVENIO` (Si/No)
- `% BONO`

## Verificar Estructura del CSV

Puedes verificar el CSV directamente en tu navegador:

1. Abre esta URL (reemplaza `{SHEET_ID}` con tu Sheet ID):
   ```
   https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=0
   ```

2. Con tu Sheet ID:
   ```
   https://docs.google.com/spreadsheets/d/1FladEQiSlbwHQoBKGtPMq5WI-MSXYPm2HcfUZsEadbk/export?format=csv&gid=0
   ```

3. Deberías ver el CSV en texto plano
4. Verifica que:
   - La primera línea tenga los nombres de las columnas
   - Las siguientes líneas tengan datos
   - No haya errores de encoding

## Contacto

Si después de seguir estos pasos sigues teniendo problemas:

1. Copia todos los logs de la consola
2. Copia el resultado de los 4 tests
3. Toma una captura de pantalla del error
4. Comparte la información para más ayuda

## Logs Agregados al Código

He agregado logs detallados en:
- `ProduccionTotal.tsx` (líneas 78-165)
- `ProduccionConvenio.tsx` (líneas 70-161)

Estos logs te ayudarán a identificar exactamente dónde está fallando.
