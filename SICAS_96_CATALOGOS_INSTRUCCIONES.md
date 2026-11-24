# Actualización de Catálogos SICAS a 96 Tipos Oficiales

## Cambios Importantes

1. **96 Catálogos Oficiales**: Se actualizó el sistema para soportar los 96 catálogos oficiales de SICAS (anteriormente eran 61)
2. **Estructura SOAP Corregida**: El request SOAP ahora usa la estructura correcta según documentación oficial de SICAS (ver `SICAS_SOAP_ACTUALIZACION.md`)

## Resumen de Cambios

### IDs de Catálogos Clave

| ID | Enum Name | Nombre | Mapeable |
|----|-----------|--------|----------|
| 1 | eTipo_Ejecutivo | Tipo_Ejecutivo | No |
| 2 | eTipo_Vendedor | Tipo_Vendedor | No |
| 10 | **eOficias** | **Oficias** | **✅ Sí** |
| 11 | **eDespachos** | **Despachos** | **✅ Sí** |
| 13 | **eAgentes** | **Agentes** | **✅ Sí** |
| 32 | **eVendedores** | **Vendedores** | **✅ Sí** |
| 33 | **eEjecutivos** | **Ejecutivos** | **✅ Sí** |
| 50 | eRamos | Ramos | No |
| 51 | eSubRamos | SubRamos | No |

## Instrucciones de Instalación

### IMPORTANTE - Este script limpiará los datos existentes

El script hace `TRUNCATE` en la tabla `sicas_catalog_types`, eliminando todos los catálogos actuales y reemplazándolos con los 96 oficiales de SICAS. Si tienes datos de sincronización en `sicas_sync_history`, se preservarán.

### Opción 1: Ejecutar en Supabase SQL Editor (Recomendado)

1. Abre tu proyecto en Supabase
2. Ve a **SQL Editor** en el panel lateral
3. Crea una nueva query
4. Copia y pega todo el contenido del archivo `sicas_96_catalogos_update.sql`
5. Haz clic en **Run** (o presiona Ctrl/Cmd + Enter)
6. Verifica que aparezcan estos mensajes:
   - `✓ Restricción de unicidad en name eliminada`
   - `✓ Tabla limpiada`
   - `✅ Validación completa: Los 96 catálogos SICAS están correctamente configurados`

### Opción 2: Usar la CLI de Supabase

```bash
# Si tienes la CLI de Supabase instalada
supabase db execute -f sicas_96_catalogos_update.sql
```

## Validación Post-Instalación

Ejecuta la siguiente query para verificar la instalación:

```sql
-- Verificar total de catálogos
SELECT COUNT(*) as total_catalogos
FROM sicas_catalog_types
WHERE id BETWEEN 1 AND 96;
-- Debe retornar: 96

-- Ver catálogos mapeables
SELECT id, enum_name, name, description
FROM sicas_catalog_types
WHERE is_mappable = true
ORDER BY id;
-- Debe retornar 5 registros: IDs 10, 11, 13, 32, 33
```

## Archivos Actualizados

### Frontend (TypeScript)
- ✅ `src/lib/sicasTypes.ts` - Actualizado con 96 constantes
- ✅ `src/lib/sicasUtils.ts` - Compatible con nuevos IDs

### Backend (Edge Functions)
- ✅ `supabase/functions/sicas-sync/index.ts` - Valida IDs de 1 a 96
- ✅ Function deployada exitosamente

### Build
- ✅ Proyecto compilado sin errores
- ✅ TypeScript validation passed

## Uso del Sistema

### Sincronizar un Catálogo

Desde el código TypeScript:

```typescript
import { syncCatalogById } from '@/lib/sicasUtils';

// Sincronizar Despachos (ID 11)
const result = await syncCatalogById(11);

// Sincronizar Vendedores (ID 32)
const result = await syncCatalogById(32);

// Sincronizar Agentes (ID 13)
const result = await syncCatalogById(13);
```

### IDs Disponibles

Puedes sincronizar cualquier catálogo del 1 al 96. Los más comunes son:

- **ID 10**: Oficinas (mapeable a `oficinas` de Movi)
- **ID 11**: Despachos (mapeable a `oficinas` de Movi)
- **ID 13**: Agentes (mapeable a `usuarios` de Movi)
- **ID 32**: Vendedores (mapeable a `usuarios` de Movi)
- **ID 33**: Ejecutivos (mapeable a `usuarios` de Movi)

## Próximos Pasos

1. ✅ Ejecutar el script SQL en Supabase
2. ✅ Validar que los 96 catálogos existan
3. 🔄 Probar sincronización con SICAS
4. 🔄 Configurar mapeos entre SICAS y Movi

## Soporte

Si encuentras algún error durante la ejecución:

1. Verifica que tengas permisos de administrador en Supabase
2. Revisa que la tabla `sicas_catalog_types` exista
3. Consulta los logs en Supabase Dashboard > Database > Logs

## Changelog

### v2.0 - 96 Catálogos Oficiales
- ✨ Agregados 35 nuevos catálogos (62-96)
- 🔄 Renombrados todos los catálogos existentes con nombres oficiales SICAS
- 🔧 Actualizado constraint para validar IDs 1-96
- 📝 Mejoradas descripciones de catálogos
- ✅ Identificados correctamente los 5 catálogos mapeables

### v1.0 - 61 Catálogos Base
- 🎉 Sistema base con 61 catálogos
