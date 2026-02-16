# Guía de SICAS REST API

## Resumen

El sistema ha sido actualizado para usar la **API REST oficial de SICAS** en lugar del método SOAP legacy. Esta actualización se basa en la documentación oficial (`API-Servicios_REST.pdf`, páginas 27-31).

## Cambios Realizados

### 1. Cliente REST Actualizado (`_shared/sicasRestClient.ts`)

**ANTES**: Marcado como DEPRECADO con advertencias de que no funcionaba.

**AHORA**: Cliente oficial actualizado y funcional según documentación SICAS.

- ✅ Autenticación mediante `/Security/GetToken`
- ✅ Validación y renovación de tokens mediante `/Security/ValidateToken`
- ✅ Consulta de reportes/catálogos mediante `/Report/ReadData`

### 2. Nueva Función: `sicas-sync-rest`

Edge function que implementa la sincronización de catálogos usando REST API:

```typescript
POST /functions/v1/sicas-sync-rest
{
  "catalog_type_id": 11,
  "page_requested": 1,
  "items_per_page": -1,
  "dryRun": false,
  "debug": false
}
```

### 3. Base de Datos: Soporte para REST KeyCodes

Nueva migración agrega campos a `sicas_catalog_types`:

- `rest_keycode`: KeyCode para usar con REST API (formato: `HWS#####_###`)
- `sync_method`: Método preferido (`rest`, `soap`, `both`)

## Arquitectura REST API

### Endpoints SICAS

**Producción**:
```
https://security-services.sicasonline.info/api
```

**QA/Testing**:
```
https://www.sicasonline.net/security-services/api
```

### Flujo de Autenticación

1. **Obtener Token Inicial**
   ```
   POST /Security/GetToken?sUserName={user}&sPassword={pass}&sCodeAuth={code}
   ```

2. **Validar/Renovar Token**
   ```
   GET /Security/ValidateToken?ReactiveIf=true
   Headers: Authorization: {token}
   ```

3. **Duración del Token**
   - Válido por 3 minutos
   - Renovable hasta 10 minutos
   - Caché automático en el cliente

### Consumo de Reportes/Catálogos

**Endpoint**: `POST /Report/ReadData`

**Headers Requeridos**:
```
Authorization: {token}
Prop_KeyCode: {report_keycode}
Content-Type: application/x-www-form-urlencoded
```

**Parámetros del Body** (form data):
- `PageRequested`: Número de página (default: 1)
- `ItemsForPage`: Registros por página (-1 = todos)
- `SortFields`: Campos para ordenar (opcional)
- `FieldsRequested`: Campos específicos (opcional)
- `FormatResponse`: 0 = JSON, 2 = XML (default: 0)
- `Conditions`: Condiciones de filtro (opcional)
- `ConditionsDirect`: Condiciones directas (opcional)

**Ejemplo de Request**:
```bash
curl -X POST "https://security-services.sicasonline.info/api/Report/ReadData" \
  -H "Authorization: XXXXXXXXXX" \
  -H "Prop_KeyCode: HWS03668_001" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "PageRequested=1" \
  -d "ItemsForPage=-1" \
  -d "FormatResponse=0"
```

### Estructura de Respuesta

```json
{
  "Response": [
    {
      "TableInfo": [
        {
          "ID": 15959,
          "Nombre": "SOL-0000000233/GNP",
          "Campo1": "valor1",
          "Campo2": "valor2"
        }
      ]
    },
    {
      "TableControl": [
        {
          "MaxRecords": 69,
          "Pages": 3,
          "Page": 1,
          "ItemForPage": 25
        }
      ]
    }
  ],
  "Sucess": true
}
```

**Componentes de la Respuesta**:
- `TableInfo`: Array con los registros de datos
- `TableControl`: Información de paginación
- `Sucess`: Indicador de éxito (boolean)
- `Error`: Mensaje de error (si aplica)

## Comparación: SOAP vs REST

| Aspecto | SOAP (Legacy) | REST (Actual) |
|---------|---------------|---------------|
| **Endpoint** | `WS_SICASOnline.asmx` | `/api/Report/ReadData` |
| **Método** | `ReadInfoData` | `ReadData` |
| **Formato Request** | XML SOAP Envelope | HTTP POST + Headers |
| **Autenticación** | En cada request | Token con caché |
| **Identificador** | `enum_name` (ej: `eDespachos`) | `rest_keycode` (ej: `HWS03668_001`) |
| **Formato Response** | XML escapado en SOAP | JSON directo |
| **Paginación** | No soportada | Soportada (TableControl) |
| **Rendimiento** | Más lento | Más rápido |
| **Parsing** | Complejo (XML anidado) | Sencillo (JSON) |

## Migración de SOAP a REST

### Paso 1: Identificar el REST KeyCode

Cada catálogo necesita su `rest_keycode` correspondiente. Formato típico: `HWS#####_###`

**Actualizar en la base de datos**:
```sql
UPDATE sicas_catalog_types
SET rest_keycode = 'HWS03668_001',
    sync_method = 'rest'
WHERE id = 11; -- Despachos
```

### Paso 2: Usar la Nueva Función

```typescript
// Antes (SOAP)
POST /functions/v1/sicas-sync
{ "catalog_type_id": 11, "typeReturn": 2 }

// Ahora (REST)
POST /functions/v1/sicas-sync-rest
{ "catalog_type_id": 11 }
```

### Paso 3: Verificar Resultados

La función retorna:
```json
{
  "success": true,
  "catalog_name": "Despachos",
  "method": "REST",
  "rest_keycode": "HWS03668_001",
  "stats": {
    "totalRows": 150,
    "inserted": 10,
    "updated": 140,
    "failed": 0
  },
  "pagination": {
    "MaxRecords": 150,
    "Pages": 1,
    "Page": 1,
    "ItemForPage": -1
  }
}
```

## Ventajas del REST API

1. **Más Rápido**: Menos overhead que SOAP
2. **Más Simple**: JSON directo sin parsing XML complejo
3. **Paginación**: Soporte nativo para grandes datasets
4. **Caché de Tokens**: Reduce llamadas de autenticación
5. **Mejor Debugging**: Respuestas más claras
6. **Estándar**: REST es el estándar moderno

## Manejo de Errores

### Errores Comunes

1. **KeyCode Inválido**
   ```json
   {
     "success": false,
     "catalog_status": "invalid_keycode",
     "error": "Codigo de reporte no encontrado: HWS99999_999"
   }
   ```

2. **Token Expirado**
   - El cliente automáticamente renueva el token
   - Reintentos automáticos en caso de fallo

3. **Catálogo Sin Datos**
   ```json
   {
     "success": true,
     "catalog_status": "not_available",
     "warning": "Catálogo sin datos disponibles"
   }
   ```

4. **Credenciales Inválidas**
   ```json
   {
     "success": false,
     "catalog_status": "denied",
     "error": "SICAS: Acceso denegado"
   }
   ```

## Configuración

### Variables de Entorno

```bash
# Credenciales SICAS
SICAS_USERNAME=usuario
SICAS_PASSWORD=contraseña

# Endpoint REST (Producción por default)
SICAS_REST_API_URL=https://security-services.sicasonline.info/api
```

### Testing

Para probar en ambiente QA:
```bash
SICAS_REST_API_URL=https://www.sicasonline.net/security-services/api
```

## Próximos Pasos

1. **Identificar REST KeyCodes**: Obtener los KeyCodes correctos para cada catálogo
2. **Actualizar Configuración**: Poblar `rest_keycode` en todos los catálogos
3. **Migrar Funciones**: Actualizar otras funciones que usen SOAP
4. **Deprecar SOAP**: Una vez validado REST, deprecar funciones SOAP legacy

## Documentación de Referencia

- **Archivo**: `API-Servicios_REST.pdf`
- **Secciones clave**:
  - Páginas 27-31: Especificación de `/Report/ReadData`
  - Páginas 8-15: Autenticación y tokens
  - Página 30: Ejemplos de Request/Response

## Soporte

Para problemas o dudas:
1. Revisar logs de la función: `sicas-sync-rest`
2. Verificar `sicas_sync_history` para historial detallado
3. Consultar `SICAS_ERROR_HANDLING_ESTRUCTURADO.md` para códigos de error
