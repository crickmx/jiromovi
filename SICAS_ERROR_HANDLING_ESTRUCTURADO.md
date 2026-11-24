# SICAS - Sistema de Manejo de Errores Estructurado

## Implementación de Error Handling por Stages

Este documento detalla el sistema completo de manejo de errores implementado para diagnóstico preciso.

---

## Problema Original

Errores genéricos sin información útil:
```json
{
  "success": false,
  "error": "Internal Server Error"
}
```

No era posible saber:
- ¿En qué etapa falló?
- ¿Cuál fue el status HTTP real de SICAS?
- ¿Qué contenía el body de error?
- ¿Era problema de auth, config, network, o parser?

---

## Solución: ErrorResponse Estructurado

### Tipo de Error

```typescript
interface ErrorResponse {
  success: false;
  error: string;                // Mensaje de error claro
  stage: 'AUTH' | 'CONFIG' | 'FETCH_SICAS' | 'PARSE_XML' | 'DB_SAVE' | 'UNKNOWN';
  http_status?: number;         // Status HTTP real de SICAS
  http_body?: string;           // Body de error de SICAS (primeros caracteres)
  details?: string;             // Stack trace (solo primeros 500 chars)
  timestamp: string;            // ISO timestamp del error
}
```

### Stages Definidos

| Stage | Descripción | Status Code |
|-------|-------------|-------------|
| `CONFIG` | Error en configuración (env vars, DB config) | 400 |
| `AUTH` | Error de autenticación | 401 |
| `FETCH_SICAS` | Error en request HTTP a SICAS | Varía (401, 403, 500, 504) |
| `PARSE_XML` | Error parseando XML de respuesta | 500 |
| `DB_SAVE` | Error guardando en base de datos | 500 |
| `UNKNOWN` | Error no categorizado | 500 |

---

## Implementación en Edge Functions

### 1. Logging de Status Code Real y Body

**Antes:**
```typescript
const response = await fetch(endpoint, {...});
const responseText = await response.text();
```

**Después:**
```typescript
const response = await fetch(endpoint, {...});

// LOGGING CRÍTICO
console.log(`[SICAS] HTTP Status: ${response.status} ${response.statusText}`);

try {
  responseText = await response.text();
  console.log(`[SICAS] Response length: ${responseText.length} bytes`);
  console.log(`[SICAS] Response preview:`, responseText.substring(0, 500));
} catch (textError) {
  throw new Error(`FETCH_SICAS: No se pudo leer el body de la respuesta`);
}

if (!response.ok) {
  console.error(`[SICAS] HTTP Error ${response.status}: ${response.statusText}`);
  console.error(`[SICAS] Body de error:`, responseText.substring(0, 1000));

  throw new Error(
    `HTTP ${response.status}: ${response.statusText} | Body: ${responseText.substring(0, 200)}`
  );
}
```

**Beneficios:**
- Ver el status HTTP real en logs
- Ver el contenido del error en logs
- Propagar el status y body en el error

---

### 2. Try-Catch por Etapa

```typescript
const startedAt = new Date();
let currentStage: ErrorResponse['stage'] = 'UNKNOWN';

try {
  // STAGE: CONFIG
  currentStage = 'CONFIG';
  console.log('[Sync] STAGE: CONFIG - Inicializando configuración...');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('CONFIG: SUPABASE_URL no configurada');
  }
  // ... validaciones de config

  // STAGE: FETCH_SICAS
  currentStage = 'FETCH_SICAS';
  console.log('[Sync] STAGE: FETCH_SICAS - Consultando datos de SICAS...');

  const result = await consultarPolizasVigentesSICAS(...);
  // ... procesar resultado

  // STAGE: DB_SAVE
  currentStage = 'DB_SAVE';
  console.log('[Sync] STAGE: DB_SAVE - Guardando en base de datos...');

  const saveStats = await guardarPolizasCache(supabase, polizas);
  // ... resultado

} catch (error: any) {
  // Catch principal con stage tracking
  console.error(`[Sync] Error fatal en STAGE: ${currentStage}`, error);

  // Extraer información del error
  const errorMessage = error.message || 'Error desconocido';
  let httpStatus: number | undefined;
  let httpBody: string | undefined;

  // Detectar HTTP errors
  const httpMatch = errorMessage.match(/HTTP (\d+):/);
  if (httpMatch) {
    httpStatus = parseInt(httpMatch[1]);
    const bodyMatch = errorMessage.match(/Body: (.*)/);
    if (bodyMatch) {
      httpBody = bodyMatch[1];
    }
  }

  // Determinar status code de respuesta basado en stage
  let responseStatusCode = 500;
  if (currentStage === 'CONFIG') responseStatusCode = 400;
  if (currentStage === 'AUTH') responseStatusCode = 401;
  if (httpStatus) responseStatusCode = httpStatus;

  // Construir respuesta de error estructurada
  const errorResponse: ErrorResponse = {
    success: false,
    error: errorMessage,
    stage: currentStage,
    http_status: httpStatus,
    http_body: httpBody,
    details: error.stack?.substring(0, 500),
    timestamp: new Date().toISOString(),
  };

  return new Response(
    JSON.stringify(errorResponse),
    {
      status: responseStatusCode,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}
```

---

### 3. Detección de Stage en Sub-funciones

En funciones como `consultarPolizasVigentesSICAS`, los errores se marcan con prefijo:

```typescript
try {
  const decoded = responseText.replace(/&lt;/g, '<')...;
  const resultMatch = decoded.match(/<ProcesarWSResult>...);

  if (!resultMatch) {
    throw new Error('PARSE_XML: No se encontró ProcesarWSResult');
  }

  // ...
} catch (parseError) {
  throw new Error(`PARSE_XML: ${parseError.message}`);
}
```

En el catch principal:

```typescript
catch (error: any) {
  // Determinar el stage del error
  if (error.message?.includes('FETCH_SICAS')) {
    currentStage = 'FETCH_SICAS';
  } else if (error.message?.includes('PARSE_XML')) {
    currentStage = 'PARSE_XML';
  }

  throw error; // Re-lanzar para catch principal
}
```

---

## Ejemplos de Respuestas de Error

### Error de Configuración

```json
{
  "success": false,
  "error": "Usuario o password no configurados. Configure las credenciales en Admin > SICAS",
  "stage": "CONFIG",
  "details": null,
  "timestamp": "2024-02-13T10:30:00.000Z"
}
```

**HTTP Status:** 400

---

### Error HTTP de SICAS (401)

```json
{
  "success": false,
  "error": "HTTP 401: Unauthorized | Body: <soap:Fault><faultstring>Authentication failed</faultstring></soap:Fault>",
  "stage": "FETCH_SICAS",
  "http_status": 401,
  "http_body": "<soap:Fault><faultstring>Authentication failed</faultstring></soap:Fault>",
  "details": "Error: HTTP 401: Unauthorized\n    at consultarPolizasVigentesSICAS...",
  "timestamp": "2024-02-13T10:30:00.000Z"
}
```

**HTTP Status:** 401

**Diagnóstico:** Credenciales incorrectas o expiradas.

---

### Error HTTP de SICAS (500)

```json
{
  "success": false,
  "error": "HTTP 500: Internal Server Error | Body: <PROCESSDATA><MESSAGE>Error en Ejecución de WS o Proceso Interno...</MESSAGE></PROCESSDATA>",
  "stage": "FETCH_SICAS",
  "http_status": 500,
  "http_body": "<PROCESSDATA><MESSAGE>Error en Ejecución de WS o Proceso Interno de SICASOnline --Variable de objeto o de bloque With no establecida.</MESSAGE></PROCESSDATA>",
  "details": "Error: HTTP 500: Internal Server Error\n    at consultarPolizasVigentesSICAS...",
  "timestamp": "2024-02-13T10:30:00.000Z"
}
```

**HTTP Status:** 500

**Diagnóstico:** Error interno de SICAS. Contactar proveedor con el mensaje de error.

---

### Error de Timeout (504)

```json
{
  "success": false,
  "error": "HTTP 504: Gateway Timeout | Body: <html><body>Gateway Timeout</body></html>",
  "stage": "FETCH_SICAS",
  "http_status": 504,
  "http_body": "<html><body>Gateway Timeout</body></html>",
  "details": "Error: HTTP 504: Gateway Timeout\n    at fetch...",
  "timestamp": "2024-02-13T10:30:00.000Z"
}
```

**HTTP Status:** 504

**Diagnóstico:** Timeout. Reducir itemsPerPage o verificar conectividad.

---

### Error de Parsing XML

```json
{
  "success": false,
  "error": "PARSE_XML: No se encontró ProcesarWSResult en la respuesta de SICAS",
  "stage": "PARSE_XML",
  "details": "Error: PARSE_XML: No se encontró ProcesarWSResult\n    at consultarPolizasVigentesSICAS...",
  "timestamp": "2024-02-13T10:30:00.000Z"
}
```

**HTTP Status:** 500

**Diagnóstico:** La respuesta de SICAS no tiene la estructura esperada. Ver logs para raw preview.

---

### Error de Base de Datos

```json
{
  "success": false,
  "error": "DB_SAVE: Error al guardar pólizas - duplicate key value violates unique constraint",
  "stage": "DB_SAVE",
  "details": "Error: DB_SAVE: duplicate key value...\n    at guardarPolizasCache...",
  "timestamp": "2024-02-13T10:30:00.000Z"
}
```

**HTTP Status:** 500

**Diagnóstico:** Problema de constraint en base de datos. Revisar estructura de tabla.

---

## Diagnóstico Rápido por Stage

| Stage | Causa Común | Acción |
|-------|-------------|--------|
| **CONFIG** | Env vars faltantes, credenciales no configuradas | Verificar `.env` y tabla `sicas_config` |
| **AUTH** | Credenciales incorrectas | Verificar usuario/password en SICAS |
| **FETCH_SICAS (401/403)** | Credenciales expiradas o sin permisos | Renovar credenciales con SICAS |
| **FETCH_SICAS (500)** | Error interno de SICAS | Contactar proveedor con mensaje de error |
| **FETCH_SICAS (504)** | Timeout | Reducir itemsPerPage, verificar red |
| **PARSE_XML** | Estructura de respuesta inesperada | Ver `raw_preview` en logs, actualizar parser |
| **DB_SAVE** | Constraint violation, RLS | Verificar estructura de tabla y permisos |

---

## Logs en Supabase Functions

Para ver los logs detallados en Supabase:

1. Ir a **Functions** en el dashboard
2. Seleccionar la función (`sync-sicas-polizas-vigentes` o `sicas-test-simple`)
3. Click en **Logs**
4. Buscar por timestamp del error

**Los logs ahora incluyen:**
```
[SICAS] STAGE: FETCH_SICAS - Enviando request a: https://...
[SICAS] HTTP Status: 500 Internal Server Error
[SICAS] Response length: 1234 bytes
[SICAS] Response preview: <PROCESSDATA>...
[SICAS] HTTP Error 500: Internal Server Error
[SICAS] Body de error: <PROCESSDATA><MESSAGE>Error en Ejecución...
[Sync] Error fatal en STAGE: FETCH_SICAS
```

---

## Integración con Frontend

El frontend ahora puede mostrar mensajes específicos:

```typescript
try {
  const response = await fetch(url, {...});
  const data = await response.json();

  if (!data.success) {
    // Error estructurado
    const { error, stage, http_status, http_body } = data;

    let userMessage = '';

    switch (stage) {
      case 'CONFIG':
        userMessage = 'Error de configuración. Contacte al administrador.';
        break;
      case 'AUTH':
        userMessage = 'Credenciales inválidas. Verifique usuario y contraseña.';
        break;
      case 'FETCH_SICAS':
        if (http_status === 401) {
          userMessage = 'Autenticación con SICAS falló. Credenciales incorrectas.';
        } else if (http_status === 500) {
          userMessage = 'SICAS reportó un error interno. Contacte soporte.';
        } else if (http_status === 504) {
          userMessage = 'Timeout al consultar SICAS. Intente con menos registros.';
        } else {
          userMessage = `Error al consultar SICAS (HTTP ${http_status})`;
        }
        break;
      case 'PARSE_XML':
        userMessage = 'Error al procesar respuesta de SICAS. Contacte soporte.';
        break;
      case 'DB_SAVE':
        userMessage = 'Error al guardar datos. Contacte al administrador.';
        break;
      default:
        userMessage = error;
    }

    // Mostrar al usuario
    alert(userMessage);

    // Log técnico para soporte
    console.error('Error técnico:', {
      stage,
      http_status,
      http_body,
      error,
    });
  }
} catch (err) {
  console.error('Error de red:', err);
}
```

---

## Testing de Error Handling

### Test 1: Credenciales Incorrectas

```bash
# Modificar temporalmente en sicas_config
UPDATE sicas_config SET sicas_password = 'incorrect';

# Ejecutar sync
curl -X POST "${SUPABASE_URL}/functions/v1/sync-sicas-polizas-vigentes" \
  -H "Authorization: Bearer ${TOKEN}"

# Esperado:
{
  "success": false,
  "stage": "FETCH_SICAS",
  "http_status": 401,
  "error": "HTTP 401: Unauthorized | Body: ..."
}
```

### Test 2: Endpoint Inválido

```bash
# Modificar endpoint
UPDATE sicas_config SET endpoint = 'https://invalid-url.com';

# Ejecutar sync
# Esperado:
{
  "success": false,
  "stage": "FETCH_SICAS",
  "error": "FETCH_SICAS: getaddrinfo ENOTFOUND invalid-url.com"
}
```

### Test 3: Timeout Simulado

```bash
# Usar endpoint lento o modificar timeout
curl -X POST "${SUPABASE_URL}/functions/v1/sync-sicas-polizas-vigentes?itemsPerPage=10000" \
  -H "Authorization: Bearer ${TOKEN}"

# Esperado (si hay timeout):
{
  "success": false,
  "stage": "FETCH_SICAS",
  "http_status": 504,
  "error": "HTTP 504: Gateway Timeout"
}
```

---

## Resumen de Mejoras

| Antes | Después |
|-------|---------|
| ❌ Error genérico | ✅ Error con stage específico |
| ❌ Sin status HTTP | ✅ `http_status` con código real |
| ❌ Sin body de error | ✅ `http_body` con contenido |
| ❌ Stack trace completo | ✅ Primeros 500 chars de details |
| ❌ Status 500 siempre | ✅ Status code apropiado (400, 401, 500, 504) |
| ❌ Logs sin contexto | ✅ Logs con stage, status, preview |
| ❌ Frontend no sabe qué pasó | ✅ Frontend puede mostrar mensaje específico |

---

## Archivos Modificados

1. ✅ `sync-sicas-polizas-vigentes/index.ts`
   - Interfaz `ErrorResponse`
   - Tracking de `currentStage`
   - Logging de HTTP status y body
   - Try-catch por stage
   - Error response estructurado

2. ✅ `sicas-test-simple/index.ts`
   - Mismas mejoras
   - Ideal para diagnóstico rápido

---

## Próximos Pasos

1. **Monitorear logs en producción** para ver qué errores son más comunes
2. **Ajustar mensajes de error** basados en feedback de usuarios
3. **Crear alertas** para errores recurrentes (especialmente AUTH y FETCH_SICAS 500)
4. **Documentar** errores conocidos de SICAS y sus soluciones

---

## Conclusión

El sistema ahora proporciona **visibilidad completa** en cada etapa:

1. **CONFIG:** Validación estricta de configuración
2. **FETCH_SICAS:** Status HTTP real + body de error
3. **PARSE_XML:** Detección clara de problemas de parsing
4. **DB_SAVE:** Errores de base de datos identificables

Con esta información, puedes:
- Diagnosticar en segundos dónde está el problema
- Proporcionar mensajes útiles al usuario
- Contactar a SICAS con información precisa
- Identificar patrones de errores recurrentes
