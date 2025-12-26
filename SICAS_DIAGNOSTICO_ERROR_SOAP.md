# Diagnóstico Error SICAS - "Error parseando respuesta SOAP"

## Estado Actual

✅ **La conexión a SICAS funciona** - El test de autenticación pasa correctamente
❌ **La sincronización de catálogos falla** - Error al parsear la respuesta SOAP

## Cambios Realizados

He actualizado el edge function `sicas-sync` para incluir las credenciales en el lugar correcto del XML SOAP:

```xml
<wsReadData>
  <PropertyUserName>...</PropertyUserName>
  <PropertyPassword>...</PropertyPassword>
  <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
  <PropertyTypeReadData>11</PropertyTypeReadData>
</wsReadData>
```

También agregué **logging detallado** para identificar qué está respondiendo SICAS.

## Cómo Ver los Logs Detallados

### Opción 1: Dashboard de Supabase

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Edge Functions** en el menú lateral
4. Haz clic en **sicas-sync**
5. Ve a la pestaña **Logs**
6. Haz clic en "Sincronizar Despachos" en tu aplicación
7. Revisa los logs en tiempo real

Busca estas líneas clave:
- `[SICAS Sync] Análisis de respuesta:`
- `[SICAS Parser] ReadInfoDataResult extraído`
- `[SICAS Parser] RESPONSETXT encontrado:`
- `[SICAS Parser] XML completo:`

### Opción 2: Página de Diagnóstico

Abre en tu navegador:
```
http://localhost:5173/diagnostico-sicas-sync.html
```

Esta página te mostrará:
- El resultado de la sincronización
- Estadísticas detalladas
- Errores específicos

### Opción 3: CLI de Supabase

```bash
# Ver logs en tiempo real
supabase functions logs sicas-sync --follow

# En otra terminal, ejecuta la sincronización desde tu app
```

## Posibles Causas del Error

### 1. SICAS devuelve un error XML en lugar de datos

SICAS podría estar respondiendo con un mensaje de error como:
```xml
<RESPONSETXT>DENIED</RESPONSETXT>
<MESSAGE>Usuario no tiene permisos para leer este catálogo</MESSAGE>
```

**Solución**: Verificar permisos del usuario en SICAS para el catálogo específico

### 2. La respuesta está vacía o malformada

SICAS podría estar devolviendo una respuesta vacía o con formato incorrecto.

**Solución**: Revisar los logs para ver el contenido exacto de `ReadInfoDataResult`

### 3. PropertyData_TypeDataReturn incorrecto

El valor `2` indica JSON, pero SICAS podría estar devolviendo XML.

**Solución**: Probar con otros valores:
- `0` = XML
- `1` = Texto plano
- `2` = JSON

### 4. Catálogo ID incorrecto

El ID 11 (Despachos) o 32 (Vendedores) podría no existir o estar deshabilitado.

**Solución**: Probar con otros IDs de catálogo (1-61)

## Próximos Pasos

1. **Ver los logs** usando cualquiera de las 3 opciones arriba
2. **Compartir el contenido de los logs** que empieza con:
   - `[SICAS Sync] Análisis de respuesta:`
   - `[SICAS Parser]`

3. Con esa información podré:
   - Identificar el formato exacto de la respuesta
   - Ajustar el parser para manejar el caso específico
   - Corregir los parámetros del request si es necesario

## Información Adicional Necesaria

Para ayudarte mejor, necesito saber:

1. ¿Qué dice la sección de logs que empieza con `[SICAS Sync] Análisis de respuesta:`?
2. ¿Ves algún mensaje con `RESPONSETXT` o `MESSAGE`?
3. ¿El XML contiene `ReadInfoDataResult`?
4. ¿Cuál es el contenido de `ReadInfoDataResult` (primeros 200 caracteres)?

## Prueba Manual Rápida

Ejecuta esto en la consola del navegador mientras estás en la app:

```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const token = (await supabase.auth.getSession()).data.session?.access_token;

const response = await fetch(`${supabaseUrl}/functions/v1/sicas-sync`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ catalog_type_id: 11 }),
});

const result = await response.json();
console.log('Result:', result);
```

Luego ve a los logs de Supabase para ver el output completo.
