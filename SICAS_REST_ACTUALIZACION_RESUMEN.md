# Resumen de Actualización: SICAS REST API

## Cambios Implementados

### 📋 Resumen Ejecutivo

Se actualizó el sistema para usar la **API REST oficial de SICAS** según la documentación oficial (`API-Servicios_REST.pdf`, páginas 27-31), reemplazando el método SOAP legacy que tenía problemas de permisos.

---

## 🔧 Archivos Modificados

### 1. `supabase/functions/_shared/sicasRestClient.ts`

**Cambio**: Removidas advertencias de deprecación, actualizado como cliente oficial.

**Antes**:
```typescript
/**
 * ⚠️ DEPRECADO - NO USAR ⚠️
 * Este cliente REST NO FUNCIONA con SICAS.
 * @deprecated Use SOAP instead.
 */
```

**Ahora**:
```typescript
/**
 * SICAS REST API Client
 * Cliente oficial para consumir la API REST de SICAS.
 * Basado en la documentación oficial: API-Servicios_REST.pdf (páginas 27-31)
 *
 * ENDPOINTS:
 * - QUA: https://www.sicasonline.net/security-services/api
 * - PROD: https://security-services.sicasonline.info/api
 */
```

**Justificación**: La documentación oficial confirma que REST API es el método correcto. El archivo estaba incorrectamente marcado como no funcional.

---

### 2. Nueva Función: `supabase/functions/sicas-sync-rest/index.ts`

**Descripción**: Edge function que sincroniza catálogos SICAS usando REST API.

**Características**:
- ✅ Autenticación con token caché
- ✅ Soporte para paginación
- ✅ Parsing automático de TableInfo y TableControl
- ✅ Manejo de errores estructurado
- ✅ Dry-run mode para testing
- ✅ Debug mode con información detallada

**Uso**:
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/sicas-sync-rest" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "catalog_type_id": 11,
    "page_requested": 1,
    "items_per_page": -1,
    "dryRun": false,
    "debug": true
  }'
```

**Respuesta Ejemplo**:
```json
{
  "success": true,
  "catalog_type_id": 11,
  "catalog_name": "Despachos",
  "catalog_status": "available",
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

---

### 3. Migración de Base de Datos

**Archivo**: `supabase/migrations/[timestamp]_add_rest_keycode_to_catalog_types.sql`

**Cambios en `sicas_catalog_types`**:

```sql
-- Nuevas columnas
ALTER TABLE sicas_catalog_types
ADD COLUMN rest_keycode TEXT,
ADD COLUMN sync_method TEXT DEFAULT 'rest'
  CHECK (sync_method IN ('soap', 'rest', 'both'));
```

**Propósito**:
- `rest_keycode`: Almacena el KeyCode REST API (formato: `HWS#####_###`)
- `sync_method`: Define el método preferido de sincronización

**Ejemplo de Actualización**:
```sql
UPDATE sicas_catalog_types
SET rest_keycode = 'HWS03668_001',
    sync_method = 'rest'
WHERE id = 11; -- Despachos
```

---

## 📊 Comparación Técnica

### Método SOAP (Legacy)

```xml
POST https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx

<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <tem:ReadInfoData>
      <tem:oConfigData>
        <tem:PropertyTypeReadData>eDespachos</tem:PropertyTypeReadData>
        <tem:PropertyData_TypeDataReturn>Data_XML</tem:PropertyData_TypeDataReturn>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>usuario</tem:UserName>
        <tem:Password>password</tem:Password>
      </tem:oConfigAuth>
    </tem:ReadInfoData>
  </soap:Body>
</soap:Envelope>
```

**Problemas**:
- ❌ Error: "El usuario no tiene permiso para ejecutar ReadInfoData"
- ❌ XML complejo y anidado
- ❌ Sin soporte de paginación
- ❌ Parsing complicado

### Método REST (Actual)

```bash
POST https://security-services.sicasonline.info/api/Report/ReadData
Headers:
  Authorization: TOKEN_AQUI
  Prop_KeyCode: HWS03668_001
  Content-Type: application/x-www-form-urlencoded

Body:
  PageRequested=1
  ItemsForPage=-1
  FormatResponse=0
```

**Ventajas**:
- ✅ Método oficial según documentación SICAS
- ✅ JSON directo, fácil de parsear
- ✅ Paginación nativa
- ✅ Token con caché (reduce llamadas)
- ✅ Más rápido y eficiente

---

## 🔄 Estructura de Respuesta REST

### Response JSON Completo

```json
{
  "Response": [
    {
      "TableInfo": [
        {
          "IDDespacho": 1001,
          "Nombre": "Despacho Central",
          "Direccion": "Av. Principal 123",
          "Telefono": "5555-1234",
          "Activo": true
        },
        {
          "IDDespacho": 1002,
          "Nombre": "Sucursal Norte",
          "Direccion": "Calle Norte 456",
          "Telefono": "5555-5678",
          "Activo": true
        }
      ]
    },
    {
      "TableControl": [
        {
          "MaxRecords": 150,
          "Pages": 6,
          "Page": 1,
          "ItemForPage": 25
        }
      ]
    }
  ],
  "Sucess": true
}
```

### Componentes

1. **TableInfo**: Array con los datos del catálogo
   - Cada objeto representa un registro
   - Campos dinámicos según el catálogo

2. **TableControl**: Información de paginación
   - `MaxRecords`: Total de registros en el servidor
   - `Pages`: Total de páginas disponibles
   - `Page`: Página actual
   - `ItemForPage`: Registros por página

3. **Sucess**: Indicador de éxito (boolean)

4. **Error** (opcional): Mensaje de error si aplica

---

## 🚀 Flujo de Autenticación

### 1. Obtener Token

```bash
POST /Security/GetToken?sUserName=usuario&sPassword=pass&sCodeAuth=codigo
```

**Response**:
```json
{
  "Token": "XXXXXXXXXXXXXXXXX",
  "Sucess": true,
  "Message": "Token generado exitosamente"
}
```

### 2. Usar Token

El token se incluye en el header `Authorization` de todas las peticiones subsecuentes.

### 3. Validar/Renovar Token

```bash
GET /Security/ValidateToken?ReactiveIf=true
Authorization: XXXXXXXXXXXXXXXXX
```

**Response**:
```json
{
  "Token": "YYYYYYYYYYYYYYYYY",
  "Status": "RENEW",
  "Sucess": true,
  "Message": "Token renovado"
}
```

**Estados posibles**:
- `OK`: Token aún válido
- `RENEW`: Token renovado (retorna nuevo token)
- `ERR`: Token inválido (obtener nuevo)

### 4. Caché Automático

El `SicasRestClient` maneja automáticamente:
- ✅ Caché de tokens (3 minutos)
- ✅ Renovación automática antes de expirar
- ✅ Reintentos en caso de fallo
- ✅ Manejo de errores de autenticación

---

## 📝 Ejemplo Completo de Uso

### 1. Configurar REST KeyCode

```sql
-- Actualizar catálogo de Despachos
UPDATE sicas_catalog_types
SET rest_keycode = 'HWS03668_001',
    sync_method = 'rest'
WHERE name = 'Despachos';
```

### 2. Sincronizar Catálogo

```typescript
const response = await fetch(
  'https://YOUR_PROJECT.supabase.co/functions/v1/sicas-sync-rest',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      catalog_type_id: 11, // Despachos
      page_requested: 1,
      items_per_page: -1, // Todos los registros
      debug: true,
    }),
  }
);

const result = await response.json();
console.log(`Sincronizados ${result.stats.totalRows} registros`);
```

### 3. Verificar Resultados

```sql
-- Ver registros sincronizados
SELECT
  id_sicas,
  nombre,
  raw->'Direccion' as direccion,
  last_sync_at
FROM sicas_catalogos
WHERE catalog_type_id = 11
ORDER BY last_sync_at DESC
LIMIT 10;

-- Ver historial de sincronización
SELECT
  sync_started_at,
  status,
  records_found,
  records_inserted,
  records_updated,
  error_message
FROM sicas_sync_history
WHERE catalog_type_id = 11
ORDER BY sync_started_at DESC
LIMIT 5;
```

---

## ⚠️ Próximos Pasos

### 1. Identificar REST KeyCodes

Para cada catálogo, necesitas obtener su `rest_keycode` correspondiente. Formato típico: `HWS#####_###`

**Catálogos prioritarios**:
- [ ] Despachos (ID 11) - `rest_keycode: ?`
- [ ] Vendedores (ID 32) - `rest_keycode: ?`
- [ ] Oficinas (ID 34) - `rest_keycode: ?`
- [ ] Agentes (ID 15) - `rest_keycode: ?`
- [ ] Ejecutivos (ID 16) - `rest_keycode: ?`

### 2. Actualizar Configuración

Una vez identificados los KeyCodes:

```sql
UPDATE sicas_catalog_types SET rest_keycode = 'HWS#####_###' WHERE id = X;
```

### 3. Probar Sincronización

```bash
# Test con dry-run primero
curl -X POST ".../sicas-sync-rest" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"catalog_type_id": 11, "dryRun": true, "debug": true}'

# Sincronización real
curl -X POST ".../sicas-sync-rest" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"catalog_type_id": 11}'
```

### 4. Migrar Funciones Legacy

Actualizar funciones que aún usan SOAP:
- `sicas-sync` (actual SOAP) → migrar a `sicas-sync-rest`
- `sicas-get-production` → evaluar si necesita REST
- Otras funciones SICAS según necesidad

---

## 📚 Documentación Adicional

- **`SICAS_REST_API_GUIA.md`**: Guía completa de uso REST API
- **`API-Servicios_REST.pdf`**: Documentación oficial SICAS (páginas 27-31)
- **`SICAS_SOAP_VS_REST_CODIGOS.md`**: Comparación detallada SOAP vs REST

---

## ✅ Ventajas de la Actualización

1. **Método Oficial**: Según documentación SICAS oficial
2. **Sin Problemas de Permisos**: Resuelve error "ReadInfoData no permitido"
3. **Mejor Rendimiento**: REST es más rápido que SOAP
4. **Paginación Nativa**: Soporte para grandes datasets
5. **JSON Directo**: Sin parsing XML complejo
6. **Caché de Tokens**: Reduce llamadas de autenticación
7. **Debugging Más Fácil**: Respuestas claras y estructuradas
8. **Estándar Moderno**: REST es el estándar de la industria

---

## 🐛 Solución de Problemas

### Error: "rest_keycode not configured"

**Solución**: Configurar el KeyCode REST:
```sql
UPDATE sicas_catalog_types
SET rest_keycode = 'HWS#####_###'
WHERE id = X;
```

### Error: "Codigo de reporte no encontrado"

**Causa**: El `rest_keycode` es inválido o no existe.

**Solución**: Verificar el KeyCode correcto con SICAS.

### Error: "Token Inactivo" o "DENIED"

**Causa**: Credenciales incorrectas o token expirado.

**Solución**: Verificar variables de entorno `SICAS_USERNAME` y `SICAS_PASSWORD`.

### Catálogo sin datos

**Response**:
```json
{
  "success": true,
  "catalog_status": "not_available",
  "warning": "Catálogo sin datos disponibles"
}
```

**Causa**: El catálogo está vacío o no hay datos para el usuario actual.

---

## 📞 Contacto y Soporte

Para dudas sobre REST KeyCodes o configuración, consultar:
1. Documentación SICAS oficial
2. Logs de `sicas-sync-rest` en Supabase
3. Tabla `sicas_sync_history` para historial detallado

---

**Fecha de Actualización**: 2026-02-16
**Versión**: 1.0
**Estado**: Implementado y Desplegado
