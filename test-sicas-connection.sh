#!/bin/bash

# Script de prueba para conexión SICAS
# Uso: ./test-sicas-connection.sh

# Configurar credenciales
export SICAS_USER='j1r0%25$'
export SICAS_PASS='$45oc14d05$'

echo "========================================="
echo "SICAS Connection Test"
echo "========================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Autenticación
echo -e "${YELLOW}Test 1: Autenticación...${NC}"
response=$(curl -sS -X POST "https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx" \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H "SOAPAction: \"http://tempuri.org/AutentificarWS\"" \
  --data-binary @- <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>'"$SICAS_USER"'</UserName>
        <Password>'"$SICAS_PASS"'</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>
XML
)

if echo "$response" | grep -q "SUCESS"; then
  echo -e "${GREEN}✓ Autenticación exitosa${NC}"
else
  echo -e "${RED}✗ Autenticación fallida${NC}"
  echo "Response: $response"
  exit 1
fi

echo ""

# Test 2: Catálogo de Oficinas (ID: 10)
echo -e "${YELLOW}Test 2: Catálogo de Oficinas (ID: 10)...${NC}"
response=$(curl -sS -X POST "https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx" \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H "SOAPAction: \"http://tempuri.org/ReadInfoData\"" \
  --data-binary @- <<'XML'
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
        <UserName>'"$SICAS_USER"'</UserName>
        <Password>'"$SICAS_PASS"'</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>
XML
)

if echo "$response" | grep -q "RESPONSENBR"; then
  echo -e "${GREEN}✓ Catálogo consultado exitosamente${NC}"
  echo "Response (primeros 500 caracteres):"
  echo "$response" | head -c 500
  echo ""
else
  echo -e "${RED}✗ Error al consultar catálogo${NC}"
  echo "Response: $response"
fi

echo ""
echo "========================================="
echo -e "${GREEN}Tests completados${NC}"
echo "========================================="
