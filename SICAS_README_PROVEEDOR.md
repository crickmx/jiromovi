# Documentación SICAS para el Proveedor

Esta carpeta contiene toda la evidencia técnica del consumo del servicio web SICAS por parte de MOVI Digital.

---

## 📋 ARCHIVOS INCLUIDOS

### 1. SICAS_RESUMEN_PROVEEDOR.md ⭐ **EMPEZAR AQUÍ**
**Descripción:** Resumen ejecutivo de 2-3 páginas con lo más importante.

**Contenido:**
- Endpoint y operaciones utilizadas
- Estructura básica de requests
- Estadísticas de uso
- Ejemplos rápidos en cURL

**Ideal para:** Gerentes, coordinadores, soporte técnico nivel 1

---

### 2. SICAS_CONSUMO_REQUEST_EJEMPLO.md 📘 **DOCUMENTACIÓN COMPLETA**
**Descripción:** Documentación técnica detallada de 8-10 páginas.

**Contenido:**
- Especificación completa de requests
- Headers HTTP utilizados
- Estructura SOAP detallada
- Parámetros y sus valores
- Proceso de sincronización completo
- Manejo de respuestas (exitosas, no disponibles, denegadas)
- Flujo de trabajo paso a paso
- Características de implementación
- Registro y auditoría

**Ideal para:** Desarrolladores, arquitectos, soporte técnico nivel 2-3

---

### 3. SICAS_EJEMPLOS_CURL.md 💻 **EJEMPLOS EJECUTABLES**
**Descripción:** Comandos listos para copiar y ejecutar.

**Contenido:**
- Ejemplos en cURL para testing
- Scripts en Bash
- Ejemplos en Python
- Configuración para Postman
- Scripts de prueba automatizados

**Ideal para:** Testing, QA, debugging, replicar requests

---

### 4. SICAS_EJEMPLOS_RESPONSES.md 📤 **RESPUESTAS Y PROCESAMIENTO**
**Descripción:** Ejemplos reales de responses y cómo los procesamos.

**Contenido:**
- Respuestas exitosas (con datos)
- Respuestas de catálogos no disponibles
- Respuestas de acceso denegado
- Decodificación de XML escapado
- Parseo de diferentes formatos
- Pseudocódigo de procesamiento
- Manejo de casos especiales

**Ideal para:** Entender qué recibimos del servicio y cómo lo usamos

---

## 🚀 GUÍA DE USO

### Para una revisión rápida (5-10 minutos)
1. Leer **SICAS_RESUMEN_PROVEEDOR.md**
2. Ver ejemplos de cURL en **SICAS_EJEMPLOS_CURL.md** (sección 1 y 2)

### Para validación técnica completa (30-45 minutos)
1. Leer **SICAS_RESUMEN_PROVEEDOR.md**
2. Leer **SICAS_CONSUMO_REQUEST_EJEMPLO.md**
3. Revisar **SICAS_EJEMPLOS_RESPONSES.md**
4. Ejecutar ejemplos de **SICAS_EJEMPLOS_CURL.md**

### Para debugging o soporte técnico
1. Ir directo a **SICAS_EJEMPLOS_CURL.md**
2. Copiar y ejecutar los comandos reemplazando credenciales
3. Comparar responses con **SICAS_EJEMPLOS_RESPONSES.md**

---

## ✅ PUNTOS CLAVE PARA EL PROVEEDOR

### Lo que estamos haciendo correctamente:
- ✅ Autenticación en cada request con credenciales válidas
- ✅ Headers SOAP correctos (`Content-Type`, `SOAPAction`)
- ✅ Estructura XML válida según especificación SOAP 1.1
- ✅ PropertyData_TypeDataReturn configurado (usamos 2=JSON)
- ✅ Manejo apropiado de responses (RESPONSENBR 0 y 1)
- ✅ Timeout razonable (30 segundos)
- ✅ Registro completo de auditoría

### Lo que el proveedor debería verificar:
- ❓ ¿Los requests están llegando a su servidor?
- ❓ ¿Las credenciales son válidas y activas?
- ❓ ¿Hay restricciones de IP o firewall?
- ❓ ¿Los catálogos que retornan RESPONSENBR=0 realmente no tienen datos?
- ❓ ¿Hay documentación oficial de la estructura de cada catálogo?

---

## 📊 ESTADÍSTICAS DE USO

**Volumen de requests:**
- 65-130 requests por día
- Distribuidos en 1-2 sincronizaciones diarias
- Autenticación + hasta 61 catálogos por sincronización

**Tiempos de respuesta:**
- Autenticación: 0.5-2 segundos
- Catálogos: 1-10 segundos
- Timeout: 30 segundos

**Tasa de éxito:**
- 100% en autenticación (cuando credenciales válidas)
- ~65% catálogos retornan datos
- ~35% catálogos retornan RESPONSENBR=0 (no disponible)
- <1% errores de conexión

---

## 🔧 PRUEBAS RÁPIDAS

### Test 1: Autenticación

**Con Variables de Entorno (RECOMENDADO):**
```bash
export SICAS_USER='j1r0%25$'
export SICAS_PASS='$45oc14d05$'

curl -sS -X POST "https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx" \
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
```

**Formato inline (para copiar/pegar rápido):**
```bash
curl -X POST 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/AutentificarWS' \
  -d '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>j1r0%25$</UserName>
        <Password>$45oc14d05$</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>'
```

**Respuesta esperada:** XML con `<RESPONSETXT>SUCESS</RESPONSETXT>` y `<RESPONSENBR>1</RESPONSENBR>`

### Test 2: Catálogo de Despachos (ID: 11)

**Con Variables de Entorno (RECOMENDADO):**
```bash
export SICAS_USER='j1r0%25$'
export SICAS_PASS='$45oc14d05$'

curl -sS -X POST "https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx" \
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
        <PropertyTypeReadData>11</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>'"$SICAS_USER"'</UserName>
        <Password>'"$SICAS_PASS"'</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>
XML
```

**Formato inline:**
```bash
curl -X POST 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx' \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: http://tempuri.org/ReadInfoData' \
  -d '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>11</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>j1r0%25$</UserName>
        <Password>$45oc14d05$</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>'
```

**Respuesta esperada:**
- Si disponible: `<RESPONSENBR>1</RESPONSENBR>` + datos del catálogo
- Si no disponible: `<RESPONSENBR>0</RESPONSENBR>` + mensaje explicativo

---

## 📞 INFORMACIÓN DE CONTACTO

**Cliente:** MOVI Digital
**Módulo:** Integración SICAS
**Ambiente:** Producción

**Para consultas técnicas:**
- Podemos proporcionar logs anonimizados
- Podemos hacer demostraciones en vivo
- Disponible para sesiones de debugging conjunto

---

## 🎯 OBJETIVO DE ESTA DOCUMENTACIÓN

Proporcionar al proveedor SICAS evidencia clara y completa de cómo estamos consumiendo su servicio web, incluyendo:

1. ✅ Estructura exacta de los requests SOAP
2. ✅ Headers HTTP utilizados
3. ✅ Parámetros y valores enviados
4. ✅ Cómo procesamos las respuestas
5. ✅ Ejemplos ejecutables para replicar nuestros requests
6. ✅ Estadísticas de uso y performance
7. ✅ Manejo de diferentes escenarios (éxito, no disponible, denegado)

---

## 📦 ENTREGA AL PROVEEDOR

**Recomendación:** Enviar todos los archivos en un ZIP o carpeta compartida con el siguiente orden:

1. **SICAS_README_PROVEEDOR.md** (este archivo) - Índice y guía
2. **SICAS_RESUMEN_PROVEEDOR.md** - Para lectura ejecutiva
3. **SICAS_CONSUMO_REQUEST_EJEMPLO.md** - Documentación completa
4. **SICAS_EJEMPLOS_CURL.md** - Ejemplos ejecutables
5. **SICAS_EJEMPLOS_RESPONSES.md** - Respuestas y procesamiento

**Correo sugerido al proveedor:**
```
Asunto: Evidencia de consumo del servicio web SICAS - MOVI Digital

Estimado equipo de SICAS,

Como parte del soporte técnico solicitado, adjunto documentación completa
de cómo estamos consumiendo su servicio web de catálogos.

La documentación incluye:
- Resumen ejecutivo (2-3 páginas)
- Documentación técnica detallada
- Ejemplos de requests en cURL listos para ejecutar
- Ejemplos de responses y su procesamiento
- Estadísticas de uso

Por favor revisar el archivo SICAS_README_PROVEEDOR.md primero para
una guía de navegación de los documentos.

Quedamos atentos a sus comentarios y disponibles para aclaraciones
o demostraciones adicionales.

Saludos cordiales,
Equipo Técnico MOVI Digital
```

---

**Fecha de creación:** 14 de enero de 2026
**Versión:** 1.0
**Autores:** Equipo de desarrollo MOVI Digital
