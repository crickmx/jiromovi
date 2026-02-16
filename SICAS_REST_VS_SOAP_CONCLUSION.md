# SICAS: API REST - Documentación Actualizada

## Fecha
16 de Febrero de 2026

## ACTUALIZACIÓN IMPORTANTE

**SICAS SÍ SOPORTA REST API**

La información previa en este documento era incorrecta. SICAS cuenta con una API REST completamente funcional.

## Confirmación de Funcionamiento

Se ha confirmado que la API REST de SICAS funciona correctamente:

```
✅ Conexión REST exitosa
✅ Token obtenido: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
✅ API: REST
✅ Endpoint: https://security-services.sicasonline.info/api
```

## Documentación Oficial

La documentación oficial se encuentra en el manual **API-Servicios_REST.pdf** proporcionado por SICAS.

### Endpoints REST Funcionales

#### Autenticación
```
POST https://security-services.sicasonline.info/api/Security/GetToken
Parámetros (Query String):
- sUserName: Usuario SICAS
- sPassword: Contraseña SICAS
- sCodeAuth: Código de autenticación (opcional)

Response:
{
  "Token": "eyJhbGc...",
  "Sucess": true,
  "Message": "Token generado exitosamente"
}
```

#### Validación y Renovación de Token
```
GET https://security-services.sicasonline.info/api/Security/ValidateToken?ReactiveIf=true
Headers:
- Authorization: {token}

Response:
{
  "Token": "nuevo_token", // Si se renovó
  "Status": "OK" | "RENEW" | "ERR",
  "Sucess": true
}
```

#### Lectura de Reportes
```
POST https://security-services.sicasonline.info/api/Report/ReadData
Headers:
- Authorization: {token}
- Prop_KeyCode: {código_reporte} // Ej: HWSDOC, HWS_DOCTOS

Body (JSON):
{
  "PageRequested": 1,
  "ItemsForPage": 100,
  "FormatResponse": 2, // 0 = XML, 2 = JSON
  "SortFields": "DatDocumentos.FDesde",
  "FieldsRequested": "...", // Opcional
  "Conditions": "DatDocumentos.Estatus=V AND ...",
  "ConditionsDirect": "DatDocumentos.VendId IN (1,2,3)"
}

Response:
{
  "Response": [{
    "TableInfo": [...], // Array de registros
    "TableControl": [{
      "MaxRecords": 150,
      "Pages": 2,
      "Page": 1,
      "ItemForPage": 100
    }]
  }],
  "Sucess": true
}
```

### KeyCodes Importantes

Según el manual oficial (página 32):

- **HWS_DOCTOS**: Documentos completos (pólizas, órdenes, fianzas)
- **HWSDOC**: Solo pólizas (excluye órdenes y fianzas)
- **H03117**: Reporte de producción (uso legacy SOAP)
- **H03400**: Pólizas vigentes con filtros (uso legacy SOAP)

## Implementación Actual

### REST Client
- ✅ `sicasRestClient.ts` - Cliente REST funcional y actualizado según manual oficial
- ✅ Soporte para autenticación con sCodeAuth opcional
- ✅ Renovación automática de tokens (3 min lifetime, hasta 10 min)
- ✅ Manejo de paginación
- ✅ Filtros avanzados (Conditions y ConditionsDirect)

### Edge Functions REST
- ✅ `sicas-get-polizas-vigentes-rest` - Obtiene pólizas vigentes usando REST
- ✅ Soporte para filtros por fecha
- ✅ Soporte para filtros por vendedor
- ✅ Paginación automática
- ✅ Formato JSON directo

### Páginas Frontend
- ✅ `MiProduccionSICAS.tsx` - Actualizada para usar REST API
- ✅ Carga de pólizas vigentes desde REST
- ✅ Filtros dinámicos por fecha
- ✅ Preparado para filtros por vendedor

## Comparación REST vs SOAP

### REST (Recomendado)
- ✅ Más moderno y estándar
- ✅ JSON nativo
- ✅ Más fácil de usar
- ✅ Mejor documentación
- ✅ Autenticación con JWT
- ✅ Soporte oficial de SICAS

### SOAP (Legacy)
- ✅ Funcional pero legacy
- ⚠️ XML verbose
- ⚠️ Más complejo de implementar
- ⚠️ Menos flexible
- ⚠️ Autenticación en cada request

## Recomendación Actualizada

**Usar REST API para todas las integraciones nuevas con SICAS.**

El REST API es la forma moderna y recomendada de integración. El SOAP sigue funcionando pero es legacy.

## Funciones Migradas a REST

- ✅ Obtención de pólizas vigentes
- ⏳ Cobranza pendiente (siguiente)
- ⏳ Comisiones (siguiente)
- ⏳ Documentos digitales (siguiente)

## Referencias

- **Manual oficial**: API-Servicios_REST.pdf
- **Endpoint producción**: https://security-services.sicasonline.info/api
- **Endpoint QUA**: https://www.sicasonline.net/security-services/api
