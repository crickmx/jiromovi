# Actualización: Estructura SOAP Correcta para SICAS

## Cambio Realizado

Se actualizó la estructura del SOAP request en la función `sicas-sync` para que coincida con la documentación oficial de SICAS según la imagen de referencia.

## Request ANTERIOR (Incorrecto)

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>1</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>11</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>usuario</UserName>
        <Password>password</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>
```

**Problemas:**
- Usaba `wsReadData` y `wsAuthConfig` sin el namespace `tem:`
- Enviaba el ID numérico del catálogo en lugar del enum_name
- El valor de `PropertyData_TypeDataReturn` era numérico en lugar de string

## Request NUEVO (Correcto)

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:ReadInfoData>
      <tem:oConfigData>
        <tem:PropertyTypeReadData>eOficias</tem:PropertyTypeReadData>
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

**Correcciones:**
- Usa `tem:oConfigData` y `tem:oConfigAuth` con el namespace correcto
- Envía el `enum_name` del catálogo (ej: `eOficias`, `eDespachos`, `eAgentes`)
- El valor de `PropertyData_TypeDataReturn` es un string: `Data_XML` o `Data_JSON`

## Response Esperado de SICAS

```xml
<soap:Envelope>
  <soap:Body>
    <ReadInfoDataResponse xmlns="http://tempuri.org/">
      <ReadInfoDataResult>
        <![CDATA[
          <Datos>
            <VCatOficinas>
              <IDOfna>1</IDOfna>
              <OfnaNombre>MARSELLA CORPORATIVO</OfnaNombre>
              <OfnaAbreviacion>Matriz</OfnaAbreviacion>
              <CCosto></CCosto>
            </VCatOficinas>
          </Datos>
        ]]>
      </ReadInfoDataResult>
    </ReadInfoDataResponse>
  </soap:Body>
</soap:Envelope>
```

## Valores de PropertyData_TypeDataReturn

| Valor | Descripción |
|-------|-------------|
| `Data_XML` | Respuesta en formato XML (recomendado) |
| `Data_JSON` | Respuesta en formato JSON (si está disponible) |

## Enum Names de los 96 Catálogos

Los catálogos se identifican por su `enum_name` (no por ID numérico):

| ID | Enum Name | Descripción |
|----|-----------|-------------|
| 10 | `eOficias` | Catálogo de Oficinas |
| 11 | `eDespachos` | Catálogo de Despachos |
| 13 | `eAgentes` | Catálogo de Agentes |
| 32 | `eVendedores` | Catálogo de Vendedores |
| 33 | `eEjecutivos` | Catálogo de Ejecutivos |
| 12 | `eCompanias` | Catálogo de Compañías |
| 50 | `eRamos` | Catálogo de Ramos |
| 51 | `eSubRamos` | Catálogo de Sub-Ramos |

Ver el archivo `sicas_96_catalogos_update.sql` para la lista completa de los 96 catálogos.

## Archivos Modificados

1. **supabase/functions/sicas-sync/index.ts**
   - Actualizado el SOAP envelope para usar la estructura correcta
   - Usa `catalogType.enum_name` en lugar del ID numérico
   - Implementa el namespace `tem:` correctamente

2. **sicas_96_catalogos_update.sql**
   - Define los 96 catálogos con sus `enum_name` oficiales
   - Listo para ejecutarse en Supabase SQL Editor

## Cómo Probar

1. Ejecutar el script SQL:
   ```bash
   # Copiar y pegar sicas_96_catalogos_update.sql en Supabase SQL Editor
   ```

2. Probar la sincronización desde la UI:
   ```
   SICAS Admin → Seleccionar catálogo → Sincronizar
   ```

3. O probar directamente desde el frontend:
   ```typescript
   import { syncCatalogById } from '@/lib/sicasUtils';

   // Sincronizar catálogo de Oficinas (ID 10)
   const result = await syncCatalogById(10);
   console.log(result);
   ```

## Notas Importantes

- La función `sicas-test-connection` NO fue modificada porque usa un endpoint diferente (`AutentificarWS`)
- Todos los catálogos ahora usan el mismo formato SOAP correcto
- El parser de respuestas ya maneja XML, JSON y PROCESSDATA correctamente

## Edge Function Deployada

La función `sicas-sync` ha sido deployada automáticamente con los cambios. No se requiere configuración adicional.

## Próximos Pasos

1. **Ejecutar el script SQL**: `sicas_96_catalogos_update.sql` en Supabase SQL Editor
2. **Probar la conexión**: Ir a SICAS Admin y probar la autenticación
3. **Sincronizar un catálogo**: Seleccionar "Oficinas" (ID 10) y hacer clic en "Sincronizar"
4. **Verificar resultados**: Revisar el historial de sincronización y los registros insertados

## Troubleshooting

### Error: "Invalid catalog_type_id"
- Asegúrate de ejecutar el script SQL primero para actualizar los catálogos

### Error: "DENIED" de SICAS
- Verifica que las credenciales en `.env` sean correctas
- Prueba la conexión desde SICAS Admin primero

### No se reciben datos
- Verifica que el catálogo esté disponible en SICAS
- Algunos catálogos retornan `PROCESSDATA` indicando que no están disponibles
- Esto es normal y no es un error

### Response XML malformado
- El parser maneja múltiples formatos automáticamente
- Si persiste el error, verifica el `response_preview` en el historial de sincronización
