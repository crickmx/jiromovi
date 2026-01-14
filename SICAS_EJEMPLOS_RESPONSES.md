# Ejemplos de Responses del Servicio SICAS

Este documento muestra ejemplos de las respuestas que recibimos del servicio SICAS y cómo las procesamos.

---

## 1. RESPUESTA DE AUTENTICACIÓN EXITOSA

### Response XML Crudo (como lo recibimos)

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <AutentificarWSResponse xmlns="http://tempuri.org/">
      <AutentificarWSResult>
        &lt;PROCESSDATA&gt;
          &lt;RESPONSETXT&gt;SUCESS&lt;/RESPONSETXT&gt;
          &lt;MESSAGE&gt;Autenticación Correcta&lt;/MESSAGE&gt;
          &lt;RESPONSENBR&gt;1&lt;/RESPONSENBR&gt;
        &lt;/PROCESSDATA&gt;
      </AutentificarWSResult>
    </AutentificarWSResponse>
  </soap:Body>
</soap:Envelope>
```

### Después de decodificar entidades HTML

```xml
<PROCESSDATA>
  <RESPONSETXT>SUCESS</RESPONSETXT>
  <MESSAGE>Autenticación Correcta</MESSAGE>
  <RESPONSENBR>1</RESPONSENBR>
</PROCESSDATA>
```

### Interpretación
- **RESPONSETXT:** `SUCESS` → Autenticación exitosa
- **MESSAGE:** Mensaje descriptivo del servidor
- **RESPONSENBR:** `1` → Operación exitosa

---

## 2. RESPUESTA DE AUTENTICACIÓN FALLIDA (DENIED)

### Response XML

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWSResponse xmlns="http://tempuri.org/">
      <AutentificarWSResult>
        &lt;PROCESSDATA&gt;
          &lt;RESPONSETXT&gt;DENIED&lt;/RESPONSETXT&gt;
          &lt;MESSAGE&gt;Usuario o contraseña inválidos&lt;/MESSAGE&gt;
          &lt;RESPONSENBR&gt;0&lt;/RESPONSENBR&gt;
        &lt;/PROCESSDATA&gt;
      </AutentificarWSResult>
    </AutentificarWSResponse>
  </soap:Body>
</soap:Envelope>
```

### Interpretación
- **RESPONSETXT:** `DENIED` → Acceso denegado
- **MESSAGE:** Razón del rechazo
- **RESPONSENBR:** `0` → Operación fallida

---

## 3. CATÁLOGO DISPONIBLE (Ejemplo: Oficinas - ID 10)

### Response XML Crudo

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoDataResponse xmlns="http://tempuri.org/">
      <ReadInfoDataResult>
        &lt;NewDataSet&gt;
          &lt;PROCESSDATA&gt;
            &lt;RESPONSETXT&gt;SUCESS&lt;/RESPONSETXT&gt;
            &lt;MESSAGE&gt;Consulta Exitosa&lt;/MESSAGE&gt;
            &lt;RESPONSENBR&gt;1&lt;/RESPONSENBR&gt;
          &lt;/PROCESSDATA&gt;
          &lt;eOficias&gt;
            &lt;ID&gt;001&lt;/ID&gt;
            &lt;NOMBRE&gt;OFICINA CENTRAL&lt;/NOMBRE&gt;
            &lt;DIRECCION&gt;AV INSURGENTES SUR 1234&lt;/DIRECCION&gt;
            &lt;CIUDAD&gt;CIUDAD DE MEXICO&lt;/CIUDAD&gt;
            &lt;ESTADO&gt;CDMX&lt;/ESTADO&gt;
            &lt;CP&gt;03100&lt;/CP&gt;
            &lt;TELEFONO&gt;5555551234&lt;/TELEFONO&gt;
          &lt;/eOficias&gt;
          &lt;eOficias&gt;
            &lt;ID&gt;002&lt;/ID&gt;
            &lt;NOMBRE&gt;OFICINA MONTERREY&lt;/NOMBRE&gt;
            &lt;DIRECCION&gt;AV CONSTITUCION 567&lt;/DIRECCION&gt;
            &lt;CIUDAD&gt;MONTERREY&lt;/CIUDAD&gt;
            &lt;ESTADO&gt;NUEVO LEON&lt;/ESTADO&gt;
            &lt;CP&gt;64000&lt;/CP&gt;
            &lt;TELEFONO&gt;8181112233&lt;/TELEFONO&gt;
          &lt;/eOficias&gt;
        &lt;/NewDataSet&gt;
      </ReadInfoDataResult>
    </ReadInfoDataResponse>
  </soap:Body>
</soap:Envelope>
```

### Después de decodificar

```xml
<NewDataSet>
  <PROCESSDATA>
    <RESPONSETXT>SUCESS</RESPONSETXT>
    <MESSAGE>Consulta Exitosa</MESSAGE>
    <RESPONSENBR>1</RESPONSENBR>
  </PROCESSDATA>
  <eOficias>
    <ID>001</ID>
    <NOMBRE>OFICINA CENTRAL</NOMBRE>
    <DIRECCION>AV INSURGENTES SUR 1234</DIRECCION>
    <CIUDAD>CIUDAD DE MEXICO</CIUDAD>
    <ESTADO>CDMX</ESTADO>
    <CP>03100</CP>
    <TELEFONO>5555551234</TELEFONO>
  </eOficias>
  <eOficias>
    <ID>002</ID>
    <NOMBRE>OFICINA MONTERREY</NOMBRE>
    <DIRECCION>AV CONSTITUCION 567</DIRECCION>
    <CIUDAD>MONTERREY</CIUDAD>
    <ESTADO>NUEVO LEON</ESTADO>
    <CP>64000</CP>
    <TELEFONO>8181112233</TELEFONO>
  </eOficias>
</NewDataSet>
```

### Cómo lo procesamos

1. **Extraer PROCESSDATA:** Verificamos que `RESPONSENBR=1` (disponible)
2. **Extraer registros:** Cada nodo `<eOficias>` es un registro
3. **Parsear campos:** Cada campo XML se convierte en una columna de base de datos
4. **Normalizar datos:** Los nombres se convierten a formato estándar
5. **Guardar en BD:** Insert o Update según si el ID ya existe

---

## 4. CATÁLOGO NO DISPONIBLE

### Response XML

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoDataResponse xmlns="http://tempuri.org/">
      <ReadInfoDataResult>
        &lt;PROCESSDATA&gt;
          &lt;RESPONSETXT&gt;SUCESS&lt;/RESPONSETXT&gt;
          &lt;MESSAGE&gt;Error en Ejecución del Proceso Interno de SICASOnline. Favor de Verificar con la Variable de Objeto.&lt;/MESSAGE&gt;
          &lt;RESPONSENBR&gt;0&lt;/RESPONSENBR&gt;
        &lt;/PROCESSDATA&gt;
      </ReadInfoDataResult>
    </ReadInfoDataResponse>
  </soap:Body>
</soap:Envelope>
```

### Interpretación
- **RESPONSETXT:** `SUCESS` → La autenticación fue exitosa
- **MESSAGE:** Mensaje indicando que el catálogo no está disponible
- **RESPONSENBR:** `0` → No hay datos disponibles

**Nota importante:** Este NO es un error de autenticación. Es un estado normal que indica que el catálogo particular no tiene datos o no está disponible en este momento.

---

## 5. CATÁLOGO CON FORMATO JSON (TypeReturn=2)

### Response XML con JSON embebido

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoDataResponse xmlns="http://tempuri.org/">
      <ReadInfoDataResult>
        &lt;PROCESSDATA&gt;
          &lt;RESPONSETXT&gt;SUCESS&lt;/RESPONSETXT&gt;
          &lt;MESSAGE&gt;Consulta Exitosa&lt;/MESSAGE&gt;
          &lt;RESPONSENBR&gt;1&lt;/RESPONSENBR&gt;
        &lt;/PROCESSDATA&gt;
        &lt;eAgentes&gt;[
          {
            &quot;ID&quot;: &quot;AGT001&quot;,
            &quot;NOMBRE&quot;: &quot;JUAN PEREZ GARCIA&quot;,
            &quot;CEDULA&quot;: &quot;A123456&quot;,
            &quot;VIGENCIA&quot;: &quot;2025-12-31&quot;,
            &quot;TIPO&quot;: &quot;CEDULA_A&quot;
          },
          {
            &quot;ID&quot;: &quot;AGT002&quot;,
            &quot;NOMBRE&quot;: &quot;MARIA LOPEZ SANCHEZ&quot;,
            &quot;CEDULA&quot;: &quot;A789012&quot;,
            &quot;VIGENCIA&quot;: &quot;2026-06-30&quot;,
            &quot;TIPO&quot;: &quot;CEDULA_A&quot;
          }
        ]&lt;/eAgentes&gt;
      </ReadInfoDataResult>
    </ReadInfoDataResponse>
  </soap:Body>
</soap:Envelope>
```

### Después de decodificar

```xml
<PROCESSDATA>
  <RESPONSETXT>SUCESS</RESPONSETXT>
  <MESSAGE>Consulta Exitosa</MESSAGE>
  <RESPONSENBR>1</RESPONSENBR>
</PROCESSDATA>
<eAgentes>[
  {
    "ID": "AGT001",
    "NOMBRE": "JUAN PEREZ GARCIA",
    "CEDULA": "A123456",
    "VIGENCIA": "2025-12-31",
    "TIPO": "CEDULA_A"
  },
  {
    "ID": "AGT002",
    "NOMBRE": "MARIA LOPEZ SANCHEZ",
    "CEDULA": "A789012",
    "VIGENCIA": "2026-06-30",
    "TIPO": "CEDULA_A"
  }
]</eAgentes>
```

### Cómo lo procesamos

1. Extraer el contenido del nodo `<eAgentes>`
2. Parsear como JSON usando `JSON.parse()`
3. Iterar sobre el array de objetos
4. Guardar cada objeto como un registro en la base de datos

---

## 6. EJEMPLO DE PROCESAMIENTO COMPLETO

### Pseudocódigo de nuestro proceso

```javascript
// 1. Enviar request SOAP
const response = await fetch(SICAS_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': 'http://tempuri.org/ReadInfoData'
  },
  body: soapEnvelope
});

// 2. Obtener respuesta como texto
const responseText = await response.text();

// 3. Decodificar entidades HTML
const decoded = responseText
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

// 4. Extraer ReadInfoDataResult
const resultMatch = decoded.match(/<ReadInfoDataResult>(.*?)<\/ReadInfoDataResult>/is);
const xmlContent = resultMatch ? resultMatch[1] : '';

// 5. Verificar estado de la respuesta
const processDataMatch = xmlContent.match(/<PROCESSDATA>(.*?)<\/PROCESSDATA>/is);
const responseTxt = processDataMatch[1].match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1];
const responseNbr = processDataMatch[1].match(/<RESPONSENBR>(.*?)<\/RESPONSENBR>/i)?.[1];

if (responseTxt === 'SUCESS' && responseNbr === '1') {
  // Catálogo disponible - procesar registros

  // 6. Extraer registros (ejemplo: eOficias)
  const catalogRegex = /<eOficias>(.*?)<\/eOficias>/gis;
  const records = [];
  let match;

  while ((match = catalogRegex.exec(xmlContent)) !== null) {
    const recordXml = match[1];

    // 7. Parsear campos del registro
    const record = {
      id_sicas: recordXml.match(/<ID>(.*?)<\/ID>/i)?.[1]?.trim(),
      nombre: recordXml.match(/<NOMBRE>(.*?)<\/NOMBRE>/i)?.[1]?.trim(),
      // ... más campos
    };

    records.push(record);
  }

  // 8. Guardar en base de datos
  for (const record of records) {
    await supabase
      .from('sicas_catalogos')
      .upsert({
        catalog_type_id: catalogId,
        id_sicas: record.id_sicas,
        nombre: record.nombre,
        raw: record,
        last_sync_at: new Date().toISOString()
      });
  }

} else if (responseTxt === 'SUCESS' && responseNbr === '0') {
  // Catálogo no disponible - registrar estado
  console.log('Catálogo no disponible');

} else if (responseTxt === 'DENIED') {
  // Error de autenticación
  throw new Error('Acceso denegado - Credenciales inválidas');
}
```

---

## 7. MANEJO DE DIFERENTES FORMATOS DE DATOS

Hemos identificado que SICAS puede retornar datos en varios formatos:

### Formato 1: XML con múltiples nodos
```xml
<eOficias>...</eOficias>
<eOficias>...</eOficias>
<eOficias>...</eOficias>
```

### Formato 2: JSON Array
```xml
<eOficias>[{"ID": "001", ...}, {"ID": "002", ...}]</eOficias>
```

### Formato 3: JSON Object único
```xml
<eOficias>{"ID": "001", "NOMBRE": "..."}</eOficias>
```

### Formato 4: Tabla NewDataSet
```xml
<NewDataSet>
  <Table>
    <ID>001</ID>
    <NOMBRE>...</NOMBRE>
  </Table>
  <Table>
    <ID>002</ID>
    <NOMBRE>...</NOMBRE>
  </Table>
</NewDataSet>
```

**Nuestro parser universal detecta automáticamente el formato y lo procesa correctamente.**

---

## 8. REGISTRO DE SINCRONIZACIÓN

Cada sincronización se registra en nuestra base de datos con:

```json
{
  "id": "uuid-generado",
  "catalog_type_id": 10,
  "sync_started_at": "2026-01-14T10:30:00Z",
  "sync_completed_at": "2026-01-14T10:30:05Z",
  "status": "completed",
  "catalog_status": "available",
  "response_nbr": "1",
  "records_found": 25,
  "records_inserted": 3,
  "records_updated": 22,
  "records_failed": 0,
  "request_payload": {
    "catalog_type_id": 10,
    "catalog_name": "eOficias",
    "typeReturn": 2
  },
  "response_preview": "<?xml version=\"1.0\"...(primeros 1000 caracteres)",
  "xml_snippet": "<?xml version=\"1.0\"...(primeros 1000 caracteres)",
  "error_message": null
}
```

### Estados posibles de catalog_status

- `available`: Catálogo tiene datos y fueron procesados exitosamente
- `not_available`: Catálogo no tiene datos disponibles (RESPONSENBR=0)
- `denied`: Acceso denegado (credenciales inválidas)
- `error`: Error técnico en el procesamiento

---

## 9. MÉTRICAS Y ESTADÍSTICAS

### Ejemplo de respuesta de nuestra API después de sincronizar

```json
{
  "success": true,
  "catalog_type_id": 10,
  "catalog_name": "eOficias",
  "catalog_status": "available",
  "typeReturn": 2,
  "dryRun": false,
  "stats": {
    "totalRows": 25,
    "inserted": 3,
    "updated": 22,
    "failed": 0
  },
  "errors": []
}
```

### Ejemplo de catálogo no disponible

```json
{
  "success": true,
  "catalog_type_id": 45,
  "catalog_name": "eCatalogo45",
  "catalog_status": "not_available",
  "typeReturn": 2,
  "dryRun": false,
  "warning": "Error en Ejecución del Proceso Interno de SICASOnline",
  "stats": {
    "totalRows": 0,
    "inserted": 0,
    "updated": 0,
    "failed": 0
  }
}
```

---

## 10. TROUBLESHOOTING

### Problema: Response vacío o HTML en lugar de XML

**Causa posible:** Endpoint incorrecto o servicio no disponible

**Verificación:**
```bash
curl -I https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx
```

Debe retornar `Content-Type: text/xml`

### Problema: SOAP Fault

**Ejemplo de response:**
```xml
<soap:Fault>
  <faultcode>soap:Server</faultcode>
  <faultstring>Server was unable to process request...</faultstring>
</soap:Fault>
```

**Acción:** Revisar formato del SOAP envelope y parámetros

### Problema: Timeout

**Configuración actual:** 30 segundos por request

**Solución:** Algunos catálogos grandes pueden tardar más, considerar aumentar timeout o implementar paginación si está disponible

---

## CONCLUSIÓN

Este documento muestra exactamente cómo consumimos el servicio SICAS:

1. ✅ Autenticación mediante SOAP con credenciales en cada request
2. ✅ Lectura de catálogos con PropertyData_TypeDataReturn=2 (JSON preferido)
3. ✅ Manejo robusto de diferentes estados (available, not_available, denied)
4. ✅ Parseo universal que soporta múltiples formatos
5. ✅ Registro completo de auditoría y métricas
6. ✅ Manejo de errores y reintentos

**Para cualquier duda técnica o ejemplos adicionales, estamos disponibles para compartir logs reales de producción (anonimizados).**
