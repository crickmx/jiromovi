# Ejemplos cURL para Testing del Servicio SICAS

Este documento contiene ejemplos prácticos en formato cURL que pueden ejecutarse directamente desde la línea de comandos para probar el servicio SICAS.

---

## 1. AUTENTICACIÓN (AutentificarWS)

### Request cURL

```bash
curl -X POST 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/AutentificarWS' \
  -d '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>TU_USUARIO</UserName>
        <Password>TU_PASSWORD</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>'
```

### Request cURL con formato mejorado (para debugging)

```bash
curl -v -X POST 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/AutentificarWS' \
  --data-binary @- << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>TU_USUARIO</UserName>
        <Password>TU_PASSWORD</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>
EOF
```

### Ejemplo de Response Exitosa

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
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

---

## 2. LECTURA DE CATÁLOGO - OFICINAS (ID: 10)

### Request cURL - Formato JSON

```bash
curl -X POST 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/ReadInfoData' \
  -d '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>10</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>TU_USUARIO</UserName>
        <Password>TU_PASSWORD</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>'
```

### Request cURL - Formato XML

```bash
curl -X POST 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/ReadInfoData' \
  -d '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>1</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>10</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>TU_USUARIO</UserName>
        <Password>TU_PASSWORD</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>'
```

---

## 3. LECTURA DE CATÁLOGO - AGENTES (ID: 13)

```bash
curl -v -X POST 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/ReadInfoData' \
  --data-binary @- << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>13</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>TU_USUARIO</UserName>
        <Password>TU_PASSWORD</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>
EOF
```

---

## 4. LECTURA DE CATÁLOGO - VENDEDORES (ID: 32)

```bash
curl -X POST 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/ReadInfoData' \
  -d '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>32</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>TU_USUARIO</UserName>
        <Password>TU_PASSWORD</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>'
```

---

## 5. SCRIPT DE PRUEBA COMPLETO (Bash)

Guarda este script como `test-sicas.sh` y ejecútalo:

```bash
#!/bin/bash

# Configuración
SICAS_ENDPOINT="https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx"
SICAS_USERNAME="TU_USUARIO"
SICAS_PASSWORD="TU_PASSWORD"

echo "========================================="
echo "SICAS Test Script"
echo "========================================="
echo ""

# Test 1: Autenticación
echo "Test 1: Autenticación..."
curl -s -X POST "$SICAS_ENDPOINT" \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/AutentificarWS' \
  -d "<?xml version=\"1.0\" encoding=\"utf-8\"?>
<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">
  <soap:Body>
    <AutentificarWS xmlns=\"http://tempuri.org/\">
      <wsAuthConfig>
        <UserName>$SICAS_USERNAME</UserName>
        <Password>$SICAS_PASSWORD</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>" > sicas_auth_response.xml

echo "Response guardada en: sicas_auth_response.xml"
echo ""

# Test 2: Catálogo de Oficinas (ID: 10)
echo "Test 2: Catálogo de Oficinas (ID: 10)..."
curl -s -X POST "$SICAS_ENDPOINT" \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/ReadInfoData' \
  -d "<?xml version=\"1.0\" encoding=\"utf-8\"?>
<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">
  <soap:Body>
    <ReadInfoData xmlns=\"http://tempuri.org/\">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>10</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>$SICAS_USERNAME</UserName>
        <Password>$SICAS_PASSWORD</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>" > sicas_catalog_10_response.xml

echo "Response guardada en: sicas_catalog_10_response.xml"
echo ""

# Test 3: Catálogo de Agentes (ID: 13)
echo "Test 3: Catálogo de Agentes (ID: 13)..."
curl -s -X POST "$SICAS_ENDPOINT" \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/ReadInfoData' \
  -d "<?xml version=\"1.0\" encoding=\"utf-8\"?>
<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">
  <soap:Body>
    <ReadInfoData xmlns=\"http://tempuri.org/\">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>13</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>$SICAS_USERNAME</UserName>
        <Password>$SICAS_PASSWORD</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>" > sicas_catalog_13_response.xml

echo "Response guardada en: sicas_catalog_13_response.xml"
echo ""

echo "========================================="
echo "Tests completados"
echo "Revisa los archivos .xml generados"
echo "========================================="
```

**Uso:**
```bash
chmod +x test-sicas.sh
./test-sicas.sh
```

---

## 6. EJEMPLOS CON Postman

### Configuración de Request en Postman

1. **Método:** POST
2. **URL:** `https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx`

3. **Headers:**
```
Content-Type: text/xml; charset=utf-8
SOAPAction: http://tempuri.org/ReadInfoData
```

4. **Body (raw, XML):**
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>10</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>{{SICAS_USERNAME}}</UserName>
        <Password>{{SICAS_PASSWORD}}</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>
```

### Variables de Entorno en Postman

Crea variables de entorno:
- `SICAS_USERNAME`: Tu usuario
- `SICAS_PASSWORD`: Tu contraseña

---

## 7. EJEMPLOS CON Python

```python
import requests

# Configuración
SICAS_ENDPOINT = 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx'
SICAS_USERNAME = 'TU_USUARIO'
SICAS_PASSWORD = 'TU_PASSWORD'

# Autenticación
auth_soap = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>{SICAS_USERNAME}</UserName>
        <Password>{SICAS_PASSWORD}</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>"""

headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': 'http://tempuri.org/AutentificarWS'
}

response = requests.post(SICAS_ENDPOINT, headers=headers, data=auth_soap)
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text[:500]}")

# Lectura de catálogo
catalog_soap = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>10</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>{SICAS_USERNAME}</UserName>
        <Password>{SICAS_PASSWORD}</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>"""

headers['SOAPAction'] = 'http://tempuri.org/ReadInfoData'
response = requests.post(SICAS_ENDPOINT, headers=headers, data=catalog_soap)
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text[:1000]}")
```

---

## 8. NOTAS IMPORTANTES

### Para Testing
- Reemplaza `TU_USUARIO` y `TU_PASSWORD` con tus credenciales reales
- La opción `-v` en cURL muestra información detallada del request/response
- La opción `-s` en cURL ejecuta en modo silencioso (sin barra de progreso)

### Guardar Responses
Para guardar la respuesta en un archivo:
```bash
curl -X POST [...] > response.xml
```

### Ver Headers de Response
```bash
curl -i -X POST [...]
```

### Ver Request y Response Completos
```bash
curl -v -X POST [...] 2>&1 | tee full_log.txt
```

---

**Estos ejemplos pueden ejecutarse directamente y generar logs que pueden compartirse con el proveedor SICAS.**
