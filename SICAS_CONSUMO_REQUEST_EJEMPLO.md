# Documentación Técnica: Consumo del Servicio SICAS

**Documento para el Proveedor**
**Fecha:** 14 de enero de 2026
**Sistema:** MOVI Digital - Módulo SICAS Integration

---

## 1. INFORMACIÓN GENERAL

### Endpoint del Servicio
```
URL: https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx
Protocolo: HTTPS
Método: SOAP 1.1 Web Service
```

### Credenciales de Autenticación
- **UserName:** `j1r0%25$` (codificado URL: representa `j1r0%$`)
- **Password:** `$45oc14d05$`
- **Nota:** Las credenciales se almacenan en variables de entorno por seguridad

---

## 2. OPERACIONES IMPLEMENTADAS

### 2.1 Autenticación (AutentificarWS)

**SOAPAction:** `http://tempuri.org/AutentificarWS`

#### Request HTTP Headers
```
POST /SICASOnline/WS_SICASOnline.asmx HTTP/1.1
Host: www.sicasonline.com.mx
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://tempuri.org/AutentificarWS"
Content-Length: [calculado]
```

#### Request Body (SOAP Envelope)
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>j1r0%25$</UserName>
        <Password>$45oc14d05$</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>
```

#### Response Esperada (Exitosa)
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWSResponse xmlns="http://tempuri.org/">
      <AutentificarWSResult>
        &lt;PROCESSDATA&gt;
          &lt;RESPONSETXT&gt;SUCESS&lt;/RESPONSETXT&gt;
          &lt;MESSAGE&gt;Autenticación exitosa&lt;/MESSAGE&gt;
          &lt;RESPONSENBR&gt;1&lt;/RESPONSENBR&gt;
        &lt;/PROCESSDATA&gt;
      </AutentificarWSResult>
    </AutentificarWSResponse>
  </soap:Body>
</soap:Envelope>
```

---

### 2.2 Lectura de Catálogos (ReadInfoData)

**SOAPAction:** `http://tempuri.org/ReadInfoData`

Esta operación se utiliza para sincronizar los 61 catálogos disponibles en SICAS.

#### Request HTTP Headers
```
POST /SICASOnline/WS_SICASOnline.asmx HTTP/1.1
Host: www.sicasonline.com.mx
Content-Type: text/xml; charset=utf-8
SOAPAction: "http://tempuri.org/ReadInfoData"
Content-Length: [calculado]
```

#### Request Body (SOAP Envelope)
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>10</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>j1r0%25$</UserName>
        <Password>$45oc14d05$</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>
```

#### Parámetros del Request

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `PropertyData_TypeDataReturn` | 0, 1, 2 | **0** = DataSet, **1** = XML, **2** = JSON (utilizamos JSON) |
| `PropertyTypeReadData` | 1-61 | ID del catálogo a consultar (ver tabla de catálogos) |
| `UserName` | string | Usuario de autenticación |
| `Password` | string | Contraseña de autenticación |

#### Catálogos Principales Consumidos

| ID | Nombre | Descripción |
|----|--------|-------------|
| 10 | eOficias | Catálogo de Oficinas |
| 11 | eDespachos | Catálogo de Despachos |
| 12 | eCompanias | Catálogo de Compañías |
| 13 | eAgentes | Catálogo de Agentes |
| 18 | ePromotorias | Catálogo de Promotorías |
| 32 | eVendedores | Catálogo de Vendedores |
| 33 | eEjecutivos | Catálogo de Ejecutivos |

#### Response Esperada (Catálogo Disponible)
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoDataResponse xmlns="http://tempuri.org/">
      <ReadInfoDataResult>
        &lt;NewDataSet&gt;
          &lt;PROCESSDATA&gt;
            &lt;RESPONSETXT&gt;SUCESS&lt;/RESPONSETXT&gt;
            &lt;MESSAGE&gt;Consulta exitosa&lt;/MESSAGE&gt;
            &lt;RESPONSENBR&gt;1&lt;/RESPONSENBR&gt;
          &lt;/PROCESSDATA&gt;
          &lt;eOficias&gt;
            &lt;ID&gt;001&lt;/ID&gt;
            &lt;NOMBRE&gt;Oficina Central&lt;/NOMBRE&gt;
            &lt;DIRECCION&gt;Av. Principal 123&lt;/DIRECCION&gt;
          &lt;/eOficias&gt;
          &lt;eOficias&gt;
            &lt;ID&gt;002&lt;/ID&gt;
            &lt;NOMBRE&gt;Oficina Norte&lt;/NOMBRE&gt;
            &lt;DIRECCION&gt;Calle Norte 456&lt;/DIRECCION&gt;
          &lt;/eOficias&gt;
          ...
        &lt;/NewDataSet&gt;
      </ReadInfoDataResult>
    </ReadInfoDataResponse>
  </soap:Body>
</soap:Envelope>
```

#### Response Esperada (Catálogo No Disponible)
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoDataResponse xmlns="http://tempuri.org/">
      <ReadInfoDataResult>
        &lt;PROCESSDATA&gt;
          &lt;RESPONSETXT&gt;SUCESS&lt;/RESPONSETXT&gt;
          &lt;MESSAGE&gt;Error en Ejecución del Proceso Interno de SICASOnline&lt;/MESSAGE&gt;
          &lt;RESPONSENBR&gt;0&lt;/RESPONSENBR&gt;
        &lt;/PROCESSDATA&gt;
      </ReadInfoDataResult>
    </ReadInfoDataResponse>
  </soap:Body>
</soap:Envelope>
```

---

## 3. PROCESO DE SINCRONIZACIÓN

### 3.1 Flujo de Trabajo

```
1. Autenticación (AutentificarWS)
   ↓
2. Para cada catálogo (1-61):
   ↓
3. Enviar request ReadInfoData con:
   - PropertyData_TypeDataReturn = 2 (JSON)
   - PropertyTypeReadData = [ID del catálogo]
   - Credenciales en wsAuthConfig
   ↓
4. Procesar respuesta:
   - RESPONSENBR = 1: Catálogo disponible → Insertar/Actualizar registros
   - RESPONSENBR = 0: Catálogo no disponible → Registrar como "not_available"
   - RESPONSETXT = "DENIED": Acceso denegado → Error de autenticación
```

### 3.2 Manejo de Respuestas

#### Respuesta Exitosa (RESPONSENBR = 1)
- El catálogo contiene datos válidos
- Se procesan todos los registros encontrados
- Se insertan nuevos registros o se actualizan existentes
- Se registra el timestamp de sincronización

#### Catálogo No Disponible (RESPONSENBR = 0)
- El catálogo no tiene datos o no está disponible
- No se considera un error
- Se registra como "not_available" en el historial
- Mensaje típico: "Error en Ejecución del Proceso Interno de SICASOnline"

#### Acceso Denegado (RESPONSETXT = "DENIED")
- Las credenciales son inválidas o han expirado
- Se detiene la sincronización
- Se requiere revisión de credenciales

---

## 4. EJEMPLO DE CÓDIGO (JavaScript/TypeScript con Deno)

### 4.1 Autenticación

```typescript
const sicasEndpoint = 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';
const sicasUsername = 'j1r0%25$';
const sicasPassword = '$45oc14d05$';

const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>${sicasUsername}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>`;

const response = await fetch(sicasEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': 'http://tempuri.org/AutentificarWS',
  },
  body: soapEnvelope,
});

const responseText = await response.text();
console.log('HTTP Status:', response.status);
console.log('Response:', responseText);
```

### 4.2 Lectura de Catálogo

```typescript
const catalogId = 10; // eOficias
const typeReturn = 2; // JSON format

const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>${typeReturn}</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>${catalogId}</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>${sicasUsername}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

const response = await fetch(sicasEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': 'http://tempuri.org/ReadInfoData',
  },
  body: soapEnvelope,
});

const responseText = await response.text();
```

---

## 5. CARACTERÍSTICAS DE IMPLEMENTACIÓN

### 5.1 Manejo de Encoding
- Las respuestas SOAP contienen XML escapado dentro del XML principal
- Se requiere decodificación de entidades HTML: `&lt;`, `&gt;`, `&amp;`, etc.
- Ejemplo de decodificación:
```typescript
const decoded = responseText
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");
```

### 5.2 Detección de Estados

#### Catálogo Disponible
```xml
<RESPONSETXT>SUCESS</RESPONSETXT>
<RESPONSENBR>1</RESPONSENBR>
```

#### Catálogo No Disponible
```xml
<RESPONSETXT>SUCESS</RESPONSETXT>
<RESPONSENBR>0</RESPONSENBR>
<MESSAGE>Error en Ejecución del Proceso Interno de SICASOnline</MESSAGE>
```

#### Acceso Denegado
```xml
<RESPONSETXT>DENIED</RESPONSETXT>
<MESSAGE>Credenciales inválidas</MESSAGE>
```

### 5.3 Parseo de Datos
- El servicio puede retornar datos en formato JSON (typeReturn=2)
- Los datos pueden estar en diferentes estructuras: Array, Object, XML anidado, CSV-like
- Se implementa un parser universal que detecta y procesa automáticamente cada formato

---

## 6. FRECUENCIA Y VOLUMEN DE REQUESTS

### Uso Actual
- **Autenticación:** 1 request al inicio de cada sincronización
- **Lectura de Catálogos:** Hasta 61 requests por sincronización completa
- **Frecuencia:** Configurable (típicamente 1-2 veces al día)
- **Timeout por request:** 30 segundos
- **Reintentos:** No automáticos (se registran fallos para revisión manual)

### Estadísticas Típicas
- **Duración promedio por catálogo:** 1-3 segundos
- **Duración sincronización completa:** 2-5 minutos
- **Registros procesados:** Variable según catálogo (0-10,000 registros)

---

## 7. REGISTRO Y AUDITORÍA

Cada sincronización se registra con:
- Timestamp de inicio y fin
- Catálogo consultado
- Estado de la respuesta (available, not_available, denied, error)
- Número de registros encontrados
- Número de registros insertados/actualizados
- Fragmento de la respuesta XML/JSON para auditoría
- Mensajes de error si aplica

---

## 8. CONTACTO TÉCNICO

**Sistema:** MOVI Digital
**Módulo:** SICAS Integration
**Arquitectura:** Edge Functions (Deno Runtime)
**Base de Datos:** PostgreSQL (Supabase)
**Documentación completa disponible en:** `/supabase/functions/`

---

## NOTAS ADICIONALES PARA EL PROVEEDOR

1. **Formato de respuesta preferido:** JSON (PropertyData_TypeDataReturn=2)
2. **Manejo de catálogos no disponibles:** Se espera RESPONSENBR=0 con mensaje descriptivo
3. **Encoding:** UTF-8 en todos los requests y responses
4. **Autenticación:** Se envía en cada request dentro del bloque `<wsAuthConfig>`
5. **Timeout:** Configurado a 30 segundos por request

**Si requieren logs específicos de requests/responses reales, podemos proporcionarlos previa coordinación.**

---

**Fin del Documento**
