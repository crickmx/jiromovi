# SICAS - Diagnóstico de Autenticación y Filtros

## Problema Identificado

**ERROR RAÍZ:** Las credenciales SICAS no están autenticando correctamente.

**Evidencia:**
```
DATAINFO {
  Sucess: '0',
  MsgError: 'Error: Usuario o Contraseña Incorrecta, Verificar Datos'
}
```

Todas las pruebas de filtros están fallando porque SICAS rechaza la autenticación **antes** de ejecutar cualquier reporte.

---

## Causas Posibles

### 1. Endpoint Incorrecto
SICAS tiene múltiples dominios y las credenciales son específicas por instalación:
- `https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx` (certificado válido)
- `https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx` (certificado puede variar)

**Síntoma:** Usuario/password funcionan en navegador pero no en la API porque estás usando el endpoint equivocado.

### 2. Password con Encoding Incorrecto
Si tu password original tiene caracteres especiales o espacios URL-encoded:
- Password almacenado: `wA5P3R%202020`
- Password real podría ser: `wA5P3R 2020` (con espacio)

**En SOAP:**
- Los caracteres deben ir **sin URL encoding**
- Los caracteres especiales XML deben escaparse (`&`, `<`, `>`, `"`, `'`)

### 3. Credenciales Inválidas
Las credenciales simplemente están mal (menos probable si funcionan en navegador).

---

## Herramientas de Diagnóstico Creadas

### 1. **test-sicas-auth-simple.html**
**Propósito:** Prueba automática de autenticación

**Qué hace:**
Ejecuta 4 combinaciones automáticamente:
1. Endpoint `.com` + password original
2. Endpoint `.com.mx` + password original
3. Endpoint `.com` + password URL-decoded
4. Endpoint `.com.mx` + password URL-decoded

**Cómo usar:**
1. Abre `test-sicas-auth-simple.html` en tu navegador
2. Clic en "Ejecutar 4 Tests de Autenticación"
3. Espera 10-20 segundos
4. Revisa el resumen:
   - **Verde (Exitosos):** Indica qué combinación funciona
   - **Naranja (Auth Errors):** Credenciales rechazadas
   - **Rojo (TLS Errors):** Problemas de certificado

**Resultado esperado:**
```
✅ Usar: https://www.sicasonline.com.mx con password url-decoded
```

**Edge Function:** `sicas-test-auth-simple`
- Endpoint: `https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/sicas-test-auth-simple`
- Método: POST (sin body)

---

### 2. **test-sicas-filtros-debug.html** (Mejorado)
**Propósito:** Diagnóstico incremental de filtros (solo funciona si autenticación está OK)

**Mejoras implementadas:**
- Detecta errores de autenticación (tabla `DATAINFO`)
- Extrae y muestra `PROCESSDATA` completo
- Muestra primer registro con todos los campos
- Identifica nombre de tabla real
- Alerta automática si detecta error de autenticación

**Estructura de respuesta:**
```javascript
{
  processData: {
    RESPONSETXT: 'SUCESS' | 'ERROR' | 'DENIED',
    RESPONSENBR: '0' | '1',
    MESSAGE: 'mensaje del servidor',
    TOTALRECORDS: 'número',
    PROCESSTIME: 'tiempo en ms'
  },
  datasetInfo: {
    tableName: 'DatDocumentos' | 'DATAINFO',
    recordCount: número,
    isErrorResponse: boolean
  },
  firstRecord: {
    // Todos los campos del primer registro
    campo1: 'valor1',
    campo2: 'valor2',
    ...
  },
  analysis: {
    isAuthError: boolean,
    authErrorMessage: 'mensaje si aplica',
    conclusion: 'diagnóstico legible'
  }
}
```

**Secuencia de tests:**
1. Sin filtros → valida si H03400 sirve
2. Solo TipoDocto → valida campo
3. Estatus + TipoDocto → valida combinación
4. + Fecha FCaptura → valida fecha de captura
5. + Fecha FDesde → valida fecha de vigencia

**Edge Function:** `sicas-test-filtros-incrementales`
- Endpoint: `https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/sicas-test-filtros-incrementales`
- Método: POST
- Body: `{ "testNumber": 1 }` (1-5)

---

## Orden de Ejecución Recomendado

### Paso 1: Validar Autenticación
```bash
1. Abre test-sicas-auth-simple.html
2. Ejecuta los 4 tests
3. Identifica la combinación exitosa
4. Actualiza .env con el endpoint correcto
```

**Variables a actualizar en `.env`:**
```bash
SICAS_SOAP_ENDPOINT=https://www.sicasonline.com  # o .com.mx según resultado
SICAS_USERNAME=tu_usuario
SICAS_PASSWORD=password_correcto  # sin o con decoding según resultado
```

### Paso 2: Validar Filtros (solo después de paso 1)
```bash
1. Abre test-sicas-filtros-debug.html
2. Ejecuta Test 1 (sin filtros)
3. Si devuelve datos → prueba Tests 2-5 para ver qué filtros funcionan
4. Si devuelve 0 datos → el reporte H03400 no tiene datos o requiere filtros obligatorios
5. Si devuelve DATAINFO con error → vuelve al paso 1
```

---

## Configuración Actual (.env)

```bash
SICAS_SOAP_ENDPOINT=https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx
SICAS_USERNAME=j1r0%25$
SICAS_PASSWORD=$45oc14d05$
```

**Análisis de credenciales:**
- Username contiene `%25` (que es `%` URL-encoded)
  - Original: `j1r0%25$`
  - Decodificado: `j1r0%$`
- Password contiene caracteres especiales válidos en SOAP: `$`, números
  - En SOAP el `$` se envía tal cual (no requiere escaping XML)

**Nota:** El endpoint `.com` tiene certificado TLS válido esperado por Deno. Si tus credenciales son para `.com.mx`, hay que cambiar el endpoint.

---

## Formato SOAP de Autenticación

### Request Básico
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <Credentials>
        <UserName>USUARIO</UserName>
        <Password>PASSWORD</Password>
      </Credentials>
      <Proceso>
        <NombreProceso>H03400</NombreProceso>
        <Reporte>H03400</Reporte>
        <EsCatalogo>N</EsCatalogo>
        <Company>01</Company>
        <Branch>01</Branch>
        <ConditionsAdd></ConditionsAdd>
      </Proceso>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>
```

### Response Exitoso
```xml
<ProcesarWSResult>
  <PROCESSDATA>
    <RESPONSETXT>SUCESS</RESPONSETXT>
    <RESPONSENBR>1</RESPONSENBR>
    <MESSAGE></MESSAGE>
  </PROCESSDATA>
  <NEWDATASET>
    <DatDocumentos>
      <campo1>valor1</campo1>
      <campo2>valor2</campo2>
      ...
    </DatDocumentos>
  </NEWDATASET>
</ProcesarWSResult>
```

### Response Error de Auth
```xml
<ProcesarWSResult>
  <NEWDATASET>
    <DATAINFO>
      <Sucess>0</Sucess>
      <MsgError>Error: Usuario o Contraseña Incorrecta, Verificar Datos</MsgError>
    </DATAINFO>
  </NEWDATASET>
</ProcesarWSResult>
```

---

## Próximos Pasos

### Si autenticación funciona:
1. Identificar campos disponibles en `firstRecord`
2. Mapear campos a estructura MOVI
3. Implementar filtros de producción real
4. Integrar con Centro Digital

### Si autenticación no funciona después de probar todas las combinaciones:
1. Verificar credenciales en navegador (login web SICAS)
2. Contactar soporte SICAS para validar acceso API
3. Revisar si hay restricción por IP o requiere VPN
4. Verificar si el usuario tiene permisos para el método `ProcesarWS`

---

## Logs de Consola Importantes

En `test-sicas-auth-simple.html`:
```javascript
console.log('Resultados completos:', data);
```

En `test-sicas-filtros-debug.html`:
```javascript
console.log('PROCESSDATA', result.processData);
console.log('DATASET INFO', result.datasetInfo);
console.log('FIRST RECORD', result.firstRecord);
console.log('RESULTADO COMPLETO', result);
```

**Qué buscar:**
- `RESPONSETXT: 'SUCESS'` → autenticación OK
- `recordCount > 0` → el reporte devuelve datos
- `tableName !== 'DATAINFO'` → no es respuesta de error
- `firstRecord` → ver campos disponibles para mapeo

---

## Resumen

**Problema:** Autenticación fallando
**Causa probable:** Endpoint incorrecto o password con encoding mal
**Solución:** Usar `test-sicas-auth-simple.html` para identificar combinación correcta
**Después:** Actualizar `.env` y volver a probar con `test-sicas-filtros-debug.html`

**No tiene sentido probar filtros hasta resolver autenticación.**
