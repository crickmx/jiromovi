# Sistema de Producción con Google Sheets

## Resumen

El sistema de producción ahora consulta datos **en tiempo real directamente desde Google Sheets**. Ya no es necesario cargar archivos Excel manualmente.

## Cambios Implementados

### 1. Arquitectura Nueva
- **Antes**: Datos almacenados en la base de datos Supabase (tabla `production_records`)
- **Ahora**: Datos consultados en vivo desde Google Sheets mediante un Edge Function

### 2. Eliminación de Límites
- **Antes**: Límite de 1,000 registros por defecto de Supabase
- **Ahora**: Sin límites, todos los registros se obtienen directamente de Google Sheets

### 3. Configuración de Google Sheets

#### Para Configurar el Link:
1. Ir a **Dashboard** → Click en "Configurar Producción"
2. O navegar directamente a `/produccion/configuracion`
3. Ingresar el link público de Google Sheets
4. Click en "Guardar Configuración"

#### Preparar Google Sheets:
1. Abrir la hoja de Google Sheets con los datos de producción
2. Click en **"Compartir"** (esquina superior derecha)
3. Seleccionar **"Cualquier persona con el link puede ver"**
4. Copiar el link
5. Pegar en la configuración del sistema

### 4. Formato de Google Sheets

El archivo debe tener las siguientes columnas:

**Columnas Requeridas:**
- `FechaSimp` o `Fecha` - Fecha del registro
- `DespNombre` - Nombre del despacho
- `GerenciaNombre` - Nombre de la gerencia
- `VendNombre` - Nombre del agente/vendedor
- `Nombre Compañía` - Nombre de la aseguradora
- `Sub Ramo` - Ramo/subramo del seguro
- `IMPORTE PESOS` - Importe en pesos
- `Prima de convenio` - Prima de convenio
- `Prima Ponderada` - Prima ponderada
- `Bono` - Bono

**Columnas Opcionales:**
- `Dirección Regional` - Región
- `CONVENIO` - Si/No para indicar si es convenio
- `% BONO` - Porcentaje de bono

### 5. Cómo Funciona

1. **Administrador** configura el link de Google Sheets
2. Sistema extrae el **Sheet ID** del link
3. Cuando un usuario accede a **Producción Total** o **Producción con Convenio**:
   - El sistema llama al Edge Function `fetch-production-sheets`
   - El Edge Function obtiene el CSV público desde Google Sheets
   - Parsea los datos y los transforma al formato correcto
   - Los devuelve en tiempo real al frontend
4. **No hay caché**, los datos son siempre actuales

### 6. Ventajas

✅ **Sin límites de registros** - Obtiene todos los datos disponibles
✅ **Datos en tiempo real** - Cualquier cambio en Google Sheets se refleja inmediatamente
✅ **No requiere cargar archivos** - Ya no es necesario subir Excel manualmente
✅ **Fácil de mantener** - Solo actualiza la hoja de Google Sheets
✅ **Única fuente de verdad** - Google Sheets es la única fuente de datos

### 7. Edge Function

**Nombre**: `fetch-production-sheets`

**Ruta**: `/functions/v1/fetch-production-sheets`

**Parámetros de Query**:
- `convenio_only=true` - Filtra solo registros con convenio

**Respuesta**:
```json
{
  "success": true,
  "records": [...],
  "total": 300038,
  "fetched_at": "2025-12-11T..."
}
```

### 8. Tabla de Configuración

**Tabla**: `production_google_sheets_config`

**Columnas**:
- `id` - UUID
- `sheet_url` - URL completo de Google Sheets
- `sheet_id` - ID extraído del URL
- `configurado_por_user_id` - Usuario que configuró
- `activo` - Boolean (solo un registro activo a la vez)
- `created_at` - Fecha de creación
- `updated_at` - Última actualización

### 9. Seguridad (RLS)

- Solo **Administradores** pueden configurar el link de Google Sheets
- Todos los usuarios autenticados pueden leer la configuración activa
- Los datos de Google Sheets deben estar públicos (solo lectura)

### 10. Páginas Modificadas

1. **ProduccionTotal.tsx** - Ahora consulta Google Sheets en tiempo real
2. **ProduccionConvenio.tsx** - Filtra convenios desde Google Sheets
3. **ProduccionConfiguracion.tsx** - Nueva página para configurar el link
4. **Dashboard.tsx** - Botón actualizado a "Configurar Producción"

### 11. Páginas Eliminadas

- **ProduccionCargar.tsx** - Ya no es necesaria

### 12. Rutas Actualizadas

**Antes**: `/produccion/cargar`
**Ahora**: `/produccion/configuracion`

## Instrucciones de Uso

### Para Administradores:

1. Preparar Google Sheets con las columnas correctas
2. Hacer la hoja pública (cualquier persona con el link puede ver)
3. Ir a Configuración de Producción
4. Pegar el link de Google Sheets
5. Guardar

### Para Usuarios:

1. Acceder a **Producción Total** o **Producción con Convenio**
2. Los datos se cargan automáticamente desde Google Sheets
3. Todos los filtros y gráficas funcionan igual que antes
4. Los datos están siempre actualizados

## Solución de Problemas

### Error: "No hay una configuración activa de Google Sheets"
- El administrador necesita configurar el link en `/produccion/configuracion`

### Error: "Error al obtener datos de Google Sheets"
- Verificar que el link de Google Sheets sea correcto
- Verificar que la hoja esté configurada como pública
- Verificar que la hoja tenga las columnas correctas

### Los datos no aparecen
- Verificar que la hoja no esté vacía
- Verificar que las columnas tengan los nombres exactos
- Revisar la consola del navegador para errores

## Notas Técnicas

- El CSV se obtiene con formato: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid=0`
- El Edge Function procesa el CSV y transforma cada fila al formato esperado
- Los filtros se aplican en el frontend después de obtener los datos
- No hay límite en la cantidad de registros que se pueden procesar
