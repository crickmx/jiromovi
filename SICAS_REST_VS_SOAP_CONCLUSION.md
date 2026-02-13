# SICAS: Conclusión sobre REST vs SOAP

## Fecha
13 de Febrero de 2026

## Diagnóstico Realizado

Se realizaron pruebas exhaustivas del endpoint REST de SICAS usando el diagnóstico especial H03117.

## Error Encontrado

```
System.InvalidOperationException: Sólo se puede llamar desde un script a los servicios Web con un atributo [ScriptService] en la definición de clase.
```

### Detalles Técnicos

- **Error**: ASP.NET InvalidOperationException
- **Causa**: El servicio web ASMX de SICAS **NO tiene** el atributo `[ScriptService]`
- **Implicación**: El servidor NO soporta llamadas REST/JSON

## Análisis

Los servicios web ASMX tradicionales de .NET solo soportan SOAP por defecto. Para que un servicio ASMX acepte llamadas REST/JSON, necesita:

```csharp
[System.Web.Script.Services.ScriptService]
public class WS_SICASOnline : System.Web.Services.WebService
{
    // ...
}
```

**SICAS NO tiene este atributo**, por lo tanto:
- ❌ **NO se pueden hacer llamadas REST/JSON**
- ✅ **SOLO funciona SOAP XML**

## Conclusión

**El sistema SICAS SOLO soporta SOAP. No es posible usar REST.**

## Acciones Tomadas

1. ✅ Se mantiene el sistema SOAP que ya funciona correctamente
2. ✅ Se depreca `sicasRestClient.ts`
3. ✅ Todas las funciones usan SOAP exclusivamente
4. ✅ Documentado en esta guía

## Endpoints Funcionales (SOAP)

### Endpoint Principal
```
POST https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx
Content-Type: text/xml; charset=utf-8
SOAPAction: http://tempuri.org/ProcesarWS
```

### Estructura SOAP que Funciona

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <wsProcesarData>
        <KeyProcess>REPORT</KeyProcess>
        <KeyCode>H03117</KeyCode>
        <Page>1</Page>
        <ItemForPage>10</ItemForPage>
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>usuario</UserName>
        <Password>password</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>
```

## Funciones Actuales (Todas SOAP)

### Funcionales
- ✅ `sicas-test-simple` - Prueba básica SOAP
- ✅ `sicas-test-catalog` - Catálogos SOAP
- ✅ `sicas-get-production` - Producción SOAP
- ✅ `sicas-sync` - Sincronización completa
- ✅ `sicas-sync-basic` - Sincronización básica
- ✅ `sicas-sync-commissions` - Comisiones
- ✅ `sicas-sync-receivables` - Cobranza

### Deprecadas (REST no funciona)
- ❌ `sicas-rest-test` - No funciona (REST)
- ❌ `sync-sicas-polizas-vigentes-rest` - No funciona (REST)
- ❌ `sicasRestClient.ts` - Deprecado

## Recomendación Final

**Usar exclusivamente SOAP para todas las integraciones con SICAS.**

No intentar usar REST porque el servidor no lo soporta a nivel de configuración del servicio web ASMX.
