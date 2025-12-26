# Solución: Manejo de Catálogos No Disponibles en SICAS

## Problema Identificado

SICAS devuelve respuestas **contradictorias** cuando un catálogo no está disponible:

```xml
<RESPONSETXT>SUCESS</RESPONSETXT>
<RESPONSENBR>0</RESPONSENBR>
<MESSAGE>Error en Ejecución de WS o Proceso Interno de SICASOnline --</MESSAGE>
```

### Regla de Detección (según documentación SICAS)

Un catálogo está **no disponible** cuando:
- ✅ `RESPONSETXT` = "SUCESS" (proceso ejecutado)
- ✅ `RESPONSENBR` = "0" (sin registros/proceso interno falló)
- ❌ `MESSAGE` contiene "Error" (mensaje de error interno)

**Nota**: Cuando hay éxito real, `RESPONSENBR` trae un número > 0.

### Catálogos Probados
- **ID 11: eDespachos** - ❌ No disponible (RESPONSENBR=0)

## Solución Implementada

### 1. Parser Mejorado (`sicasParser.ts`)
- **Regla precisa**: Solo marca como "no disponible" cuando `RESPONSETXT=SUCESS + RESPONSENBR=0 + Error en MESSAGE`
- **Detección de DENIED**: Si `RESPONSETXT=DENIED`, es error fatal de autenticación
- **Retorno con estado**: `{ __empty_catalog: true, status: 'not_available', responseNbr: '0' }`
- **Logs detallados**: Incluye RESPONSETXT, RESPONSENBR y MESSAGE

### 2. Edge Function Actualizada (`sicas-sync`)
- **Sistema de estados**: Guarda `catalog_status` en historial:
  - `available`: Catálogo sincronizado OK
  - `not_available`: Sin permisos o no habilitado (RESPONSENBR=0)
  - `denied`: Autenticación denegada
  - `error`: Timeout, conexión, o parse error
- **Auditoría completa**: Guarda `response_nbr` y `xml_snippet` para debugging
- **HTTP 200 con warning**: No falla la request, solo advierte

### 3. Nueva Edge Function de Prueba (`sicas-test-catalog`)
- **Prueba rápida**: Testea cualquier catálogo por ID sin registrarlo
- **Sin efectos secundarios**: No guarda datos, solo reporta disponibilidad
- **Respuesta con samples**: Incluye primeros 5 registros si está disponible

### 4. Página de Diagnóstico (`test-sicas-catalogs-availability.html`)
- **Prueba automática**: Testea 12 catálogos sugeridos en secuencia
- **UI visual**: Color-coded por estado (verde=disponible, naranja=no disponible, rojo=denied)
- **Resumen agregado**: Muestra cuántos catálogos están disponibles vs. no disponibles

## Catálogos según Documentación SICAS

Según el enum `eDatatoRead` de la documentación oficial:

### 🎯 Catálogos Prioritarios (para tu sistema)
| ID | Nombre | Uso en Sistema |
|----|--------|----------------|
| 10 | eOficias | **Plan B** para mapeo oficinas (si eDespachos no funciona) |
| 11 | eDespachos | Mapeo despachos ↔ oficinas (actualmente no disponible) |
| 18 | ePromotorias | **Plan B alternativo** para mapeo operativo |
| 32 | eVendedores | **CRÍTICO** - Mapeo vendedores ↔ usuarios |
| 33 | eEjecutivos | Estructura organizacional |

### 📋 Catálogos Generales
| ID | Nombre | Descripción |
|----|--------|-------------|
| 1  | eUsuarios | Usuarios del sistema |
| 2  | eProductos | Productos de seguro |
| 3  | eClientes | Base de clientes |
| 4  | ePolizas | Pólizas |
| 5  | eAseguradoras | Aseguradoras |
| 12 | eCompanias | Compañías |
| 13 | eAgentes | Agentes |

**⚠️ Importante**: Que un catálogo esté en el enum NO garantiza que tu usuario tenga permiso ni que esté habilitado en tu instancia.

## Cómo Probar Catálogos

### Opción 1: Herramienta de Diagnóstico (Recomendado)

Abre en tu navegador:
```
http://localhost:5173/test-sicas-catalogs-availability.html
```

Esta herramienta:
- ✅ Prueba 12 catálogos automáticamente
- ✅ Muestra estado visual (disponible/no disponible/denied)
- ✅ Reporta cuántos registros encontró en cada uno
- ✅ Incluye resumen agregado

### Opción 2: Prueba Individual (vía API)

```bash
curl -X POST https://tu-proyecto.supabase.co/functions/v1/sicas-test-catalog \
  -H "Content-Type: application/json" \
  -d '{"catalog_id": 32}'
```

Respuesta esperada:
```json
{
  "success": true,
  "catalog_id": 32,
  "catalog_status": "available",
  "stats": { "totalRows": 150, "records": 150 },
  "sample_records": [...]
}
```

## Logs de Diagnóstico

El sistema ahora genera logs claros:

```
[SICAS Parser] RESPONSETXT: SUCESS
[SICAS Parser] MESSAGE encontrado: Error en Ejecución de WS...
[SICAS Parser] ⚠️ Catálogo no disponible o vacío: Error en Ejecución...
[SICAS Sync] ⚠️ Catálogo vacío o no disponible: Error en Ejecución...
```

## Plan de Acción

### Paso 1: Ejecutar Diagnóstico Completo
```
http://localhost:5173/test-sicas-catalogs-availability.html
```
Esto te dirá **exactamente** qué catálogos tienes disponibles.

### Paso 2: Estrategia según Resultados

**Si eVendedores (ID: 32) está disponible**:
✅ Usarlo directamente para mapeo vendedores ↔ usuarios

**Si eDespachos (ID: 11) NO está disponible** (como ahora):
- 🔄 Plan B: Usar **eOficias (ID: 10)** para mapeo oficinas
- 🔄 Plan C: Usar **ePromotorias (ID: 18)** si representa tu estructura operativa

**Si eVendedores (ID: 32) NO está disponible**:
- 🔄 Probar **eEjecutivos (ID: 33)** como alternativa
- 🔄 Probar **eAgentes (ID: 13)** si tus vendedores son "agentes"

### Paso 3: Contactar Soporte SICAS

Si los catálogos críticos (32, 10, 18) no están disponibles:
- Solicitar habilitación de **eVendedores (ID: 32)** - CRÍTICO
- Solicitar habilitación de **eDespachos (ID: 11)** o **eOficias (ID: 10)**
- Preguntar qué permisos adicionales necesitas

### Paso 4: Implementar Plan B

Si algunos catálogos nunca estarán disponibles, considerar:
- **Mapeo manual**: UI para que usuarios mapeen vendedores manualmente
- **Cache local**: Guardar mapeos manuales en tu BD

## Impacto

✅ **El sistema ahora maneja correctamente**:
- Catálogos no disponibles sin lanzar errores
- Respuestas inconsistentes de SICAS
- Diferenciación entre errores de autenticación y catálogos no disponibles

✅ **Beneficios**:
- Mejor experiencia de usuario
- Logs más claros para debugging
- Sincronización resiliente
