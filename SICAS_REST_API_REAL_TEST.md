# SICAS REST API - Prueba Real

## Contexto

SICAS tiene **DOS APIs diferentes**:

1. **SOAP API** (funciona correctamente)
   - URL: `https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx`
   - Método: SOAP con XML Envelope
   - Autenticación: `AutentificarWS`
   - Reportes: `ReadInfoData`

2. **REST API** (nunca probado realmente)
   - URL: `https://security-services.sicasonline.info/api`
   - Método: REST con JSON
   - Autenticación: `GET /Security/GetToken`
   - Reportes: `POST /Report/ReadData`

## Función de Prueba

### Edge Function Desplegada
`sicas-rest-real-test`

### Cómo Llamar

```bash
curl -X POST \
  'https://[tu-proyecto].supabase.co/functions/v1/sicas-rest-real-test' \
  -H 'Authorization: Bearer [tu-anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{
    "endpoint": "all"
  }'
```

### Parámetros

| Parámetro | Descripción | Por defecto |
|-----------|-------------|-------------|
| `endpoint` | Qué probar: `GetToken`, `GetTokenPOST`, `all` | `GetToken` |
| `usuario` | Usuario SICAS (opcional, usa env var) | `SICAS_USUARIO` |
| `password` | Password SICAS (opcional, usa env var) | `SICAS_PASSWORD` |

## Pruebas Ejecutadas

### Test 1: GET /Security/GetToken
Obtener token de autenticación mediante GET con query params.

**Request:**
```
GET /Security/GetToken?Usuario=XXX&Password=YYY&sCodeAuth=ZZZ&CodeAuthSO=AAA
```

**Esperado:**
```json
{
  "Token": "eyJ...",
  "ExpiresIn": 180
}
```

### Test 2: GET /Security/ValidateToken
Validar el token obtenido.

**Request:**
```
GET /Security/ValidateToken?ReactiveIf=true
Authorization: Bearer [token]
```

**Esperado:**
```json
{
  "IsValid": true,
  "ExpiresIn": 175
}
```

### Test 3: POST /Report/ReadData
Obtener datos del reporte H03117 (producción).

**Request:**
```
POST /Report/ReadData
Authorization: Bearer [token]
Prop_KeyCode: H03117
Content-Type: application/json

{
  "FormatResponse": 1,
  "Top": 10
}
```

**Esperado:**
```json
{
  "Data": [...],
  "TotalRecords": 123
}
```

### Test 4: POST /Security/GetToken (alternativo)
Obtener token mediante POST con body JSON.

**Request:**
```
POST /Security/GetToken
Content-Type: application/json

{
  "Usuario": "XXX",
  "Password": "YYY",
  "sCodeAuth": "ZZZ",
  "CodeAuthSO": "AAA"
}
```

## Interpretación de Resultados

### Errores Comunes

#### 401 Unauthorized
```json
{
  "Message": "Invalid credentials",
  "Code": "AUTH_001"
}
```
**Solución:** Verificar credenciales SICAS_USUARIO y SICAS_PASSWORD.

#### 403 Forbidden
```json
{
  "Message": "sCodeAuth required",
  "Code": "AUTH_002"
}
```
**Solución:** Configurar SICAS_CODE_AUTH y/o SICAS_CODE_AUTH_SO.

#### 404 Not Found
```json
{
  "Message": "Endpoint not found"
}
```
**Solución:** La URL base o el endpoint no existen. El REST API podría no estar disponible.

#### 500 Internal Server Error
```html
<html>
  <title>Sólo se puede llamar desde un script...</title>
</html>
```
**Solución:** Se está llamando al ASMX en lugar del REST API. Verificar URL.

### Resultados Esperados

Si el REST API funciona correctamente, deberías ver:

```json
{
  "success": true,
  "results": [
    {
      "test": "GET /Security/GetToken",
      "response": {
        "status": 200,
        "bodyParsed": {
          "Token": "eyJ...",
          "ExpiresIn": 180
        }
      }
    },
    {
      "test": "GET /Security/ValidateToken",
      "response": {
        "status": 200,
        "bodyParsed": {
          "IsValid": true
        }
      }
    },
    {
      "test": "POST /Report/ReadData (H03117)",
      "response": {
        "status": 200,
        "bodyParsed": {
          "Data": [...]
        }
      }
    }
  ]
}
```

## Variables de Entorno Requeridas

Asegúrate de que estas variables estén configuradas en Supabase:

```bash
SICAS_USUARIO=tu_usuario
SICAS_PASSWORD=tu_password
SICAS_CODE_AUTH=tu_code_auth          # Opcional
SICAS_CODE_AUTH_SO=tu_code_auth_so    # Opcional
```

## Próximos Pasos

1. **Ejecutar la prueba** con credenciales reales
2. **Analizar los errores** específicos devueltos por el servidor
3. **Ajustar parámetros** según los mensajes de error
4. **Documentar la API funcional** una vez que tengamos respuestas exitosas

## Diferencias SOAP vs REST

| Característica | SOAP | REST |
|----------------|------|------|
| Base URL | sicasonline.com | security-services.sicasonline.info |
| Formato | XML | JSON |
| Autenticación | AutentificarWS (embebida) | GetToken (token JWT) |
| Validez Token | Por sesión | 3 minutos |
| Reportes | ReadInfoData | Report/ReadData |
| Headers | SOAPAction | Authorization + Prop_KeyCode |
| Centro Digital | No directo | DigitalCenter/GetFiles |

## Notas Importantes

1. El REST API está **documentado por SICAS** y debería funcionar.
2. El error `[ScriptService]` ocurre cuando se intenta usar REST contra el ASMX (SOAP).
3. Las dos APIs son **independientes** y requieren configuraciones diferentes.
4. El REST API usa tokens con expiración corta (3 min).
5. SOAP es más estable pero menos flexible que REST.
