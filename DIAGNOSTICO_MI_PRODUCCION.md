# Diagnóstico: Mi Producción

## Problema Reportado
La página "Mi Producción" no muestra información correctamente.

## Análisis Realizado

### 1. ✅ Sistema de Mapeo de Vendedores
El sistema de mapeo entre usuarios y vendedores está funcionando correctamente:
- Tabla `production_vendors_cache` existe y tiene datos
- Usuario "Christofer Prueba" tiene vendedor asignado: "CRUZ CHOUSAL JIMENEZ CHRISTOFER DAMIAN"
- Total de registros del vendedor: verificados en la base de datos

### 2. ✅ Configuración de Google Sheets
- Existe configuración activa en `production_google_sheets_config`
- Sheet ID: `1FladEQiSlbwHQoBKGtPMq5WI-MSXYPm2HcfUZsEadbk`
- URL CSV: `https://docs.google.com/spreadsheets/d/1FladEQiSlbwHQoBKGtPMq5WI-MSXYPm2HcfUZsEadbk/export?format=csv&gid=0`

### 3. ✅ Políticas RLS
Las políticas de Row Level Security están correctamente configuradas:
- `production_vendors_cache`: usuarios autenticados pueden leer
- Edge Function usa service role key para acceso completo

### 4. Edge Function `get-my-production`
La función está correctamente implementada:
- Autentica al usuario
- Busca vendedor en `production_vendors_cache` por `movi_user_id`
- Descarga datos de Google Sheets
- Filtra registros por nombre de vendedor normalizado
- Calcula KPIs y gráficas

## Causas Posibles del Problema

### 1. Google Sheets No Pública (MÁS PROBABLE)
Si la hoja de cálculo no tiene permisos públicos de lectura, la función no podrá acceder:

**Solución:**
1. Abrir la hoja de cálculo en Google Sheets
2. Clic en "Compartir" (botón superior derecho)
3. En "Acceso general" cambiar a "Cualquier persona con el enlace"
4. Asegurarse que el permiso sea "Lector"
5. Guardar cambios

### 2. Nombre de Vendedor No Coincide
El sistema normaliza nombres (quita acentos, convierte a minúsculas), pero si el nombre en el Excel es muy diferente al registrado, no habrá coincidencia.

**Verificar:**
- En el Excel, buscar cómo aparece el nombre en la columna "VendNombre"
- Debe coincidir (normalizado) con "CRUZ CHOUSAL JIMENEZ CHRISTOFER DAMIAN"

### 3. Formato del Excel Incorrecto
La función espera columnas específicas:
- `FechaSimp` o `Fecha`
- `NombreCompleto` (nombre del cliente)
- `VendNombre` (nombre del vendedor)
- `Nombre Compañía` (aseguradora)
- `Sub Ramo` o `RamosNombre`
- `IMPORTE PESOS`
- `Prima de convenio`

## Herramienta de Diagnóstico Creada

He creado una página de diagnóstico completa: `/test-mi-produccion.html`

**Cómo usarla:**
1. Acceder a: `https://tu-dominio.netlify.app/test-mi-produccion.html`
2. Iniciar sesión con tus credenciales
3. Ejecutar cada prueba en orden:
   - Verificar mapeo de vendedor
   - Verificar configuración de Google Sheets
   - Probar acceso a Google Sheets (IMPORTANTE)
   - Llamar a la Edge Function

Esta herramienta te mostrará exactamente dónde está el problema.

## Próximos Pasos

1. **Usar la página de diagnóstico** para identificar el problema exacto
2. **Si el problema es Google Sheets:** Hacer la hoja pública (ver instrucciones arriba)
3. **Si el problema es el mapeo:** Verificar que el nombre del vendedor coincida
4. **Si persiste:** Revisar el formato del Excel para asegurar que tiene todas las columnas requeridas

## Notas Técnicas

- La Edge Function `get-my-production` lee directamente de Google Sheets en tiempo real
- No hay caché de datos (cada consulta lee el CSV completo)
- La normalización de nombres es automática (quita acentos, minúsculas, espacios extras)
- Los filtros se aplican después de obtener todos los datos del vendedor
