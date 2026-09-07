# Multi-Autos — configuración de entorno y estado de validación

Backend real: `supabase/functions/multi-autos-quote/index.ts`. Este documento
lista qué secretos configurar en Supabase y qué tan validado está cada
integración contra el WSDL/documentación real de cada aseguradora.

## Secretos por aseguradora (`supabase secrets set ...`)

**Qualitas**
- `QUALITAS_NO_NEGOCIO`
- `QUALITAS_AGENTE`
- `QUALITAS_TARIFA`

**GNP**
- `GNP_USUARIO`
- `GNP_PASSWORD`
- `GNP_UNIDAD_OPERABLE`
- `GNP_INTERMEDIARIO`
- `GNP_OFICINA`

**ANA Seguros**
- `ANA_USUARIO`
- `ANA_CLAVE`
- `ANA_NEGOCIO_REF`

**HDI Seguros**
- `HDI_USUARIO`
- `HDI_PASSWORD`
- `HDI_OFICINA`

Los valores reales (usuarios/contraseñas de producción) vienen del documento
de credenciales que ya tiene Ricardo — no se incluyen en este archivo ni en
el repo.

## Estado de validación por aseguradora

| Aseguradora | Endpoint | Método SOAP | Schema interno | Estado |
|---|---|---|---|---|
| Qualitas | ✅ confirmado en vivo (QA) | ✅ `obtenerNuevaEmision` (sin cambio) | ⚠️ best-effort — `<Movimientos><Movimiento TipoMovimiento="2" NoNegocio="...">` confirmado como raíz real; el resto del `<Movimiento>` (Anexo 4 completo) no está documentado, falta el PDF/doc real | Pendiente probar contra QA con credenciales reales |
| ANA Seguros | ✅ confirmado en vivo (pruebas) | ✅ envoltorio SOAP ya coincidía, sin cambio | ⚠️ best-effort — falta el `.eml` "WS AGENTE 17719" para validar `<Cotizacion>` completo | Pendiente probar |
| HDI Seguros | ✅ confirmado en vivo (IMP) | ✅ corregido: `savequote` no existe en el WSDL real → `ObtenerMultiPaquetesExpress` (sí existe) | ❌ bloqueante real: `idMarca`/`idModelo`/`idTransmision`/`idZonaCirculacion`/`idTonelaje`/`idServicio`/`idRiesgoCarga` son catálogos internos de HDI (no el código AMIS) — van hardcodeados en `0`. Sin resolverlos, HDI va a rechazar la cotización con fault de negocio aunque el método y credenciales estén bien | Requiere trabajo adicional (ver abajo) |
| GNP | ❌ pendiente — no tiene WSDL público, la URL real solo está en el Kit GNP - Multicotizador JIRO.xlsx | ✅ corregido: era JSON, el WS real espera XML plano (`<COTIZACION>...</COTIZACION>`) | ⚠️ best-effort, tomado del Kit GNP | **Bloqueante: falta la URL real del endpoint** — pídesela a Ricardo o extráela del Kit GNP y corre el UPDATE manual (ver abajo) |
| Zurich | ❌ sin confirmar | — | — | Desactivada (`disponible=false`) — builder queda en el código marcado `DESACTIVADO` |
| Chubb | ❌ sin confirmar | — | — | Desactivada (`disponible=false`) — builder queda en el código marcado `DESACTIVADO` |
| Potosi | ❌ sin confirmar | — | — | Desactivada (`disponible=false`) — builder queda en el código marcado `DESACTIVADO` |

## Pendiente: URL real de GNP

En cuanto Ricardo la tenga, correr en el SQL Editor de Supabase:

```sql
UPDATE multi_autos_aseguradoras
SET endpoint_url = '<url real del Kit GNP>'
WHERE nombre = 'GNP';
```

## Pendiente: catálogos internos de HDI (bloqueante real, no solo config)

`idMarca`/`idModelo`/`idTransmision`/`idZonaCirculacion`/`idTonelaje`/
`idServicio`/`idRiesgoCarga` en `buildHdiSoap()` van en `0` como placeholder.
Para resolverlos de verdad:
1. Llamar las operaciones de catálogo del mismo WSDL de HDI (`ObtenerMarcas`,
   `ObtenerModelos`, `ObtenerClaveVehiculo`) por vehículo.
2. Guardar el resultado en
   `multi_autos_catalogo_vehiculos.metadata_aseguradoras` (columna JSONB, ya
   existe) con la misma convención que ya usan otras aseguradoras
   (`clave_hdi`, `armadora_gnp`, etc.) para no resolverlo en cada cotización.

## Cómo bajar los WSDL reales de nuevo si hace falta

```bash
curl -s "https://qa.qualitas.com.mx:8443/WsEmision/WsEmision.asmx?WSDL" -o qualitas.wsdl
curl -s "https://server.anaseguros.com.mx/ananetws/service.asmx?WSDL" -o ana.wsdl
curl -s "https://enterpriseservices.implementation.hdi.com.mx/B2B/Partners/WCF/Autos/PublicServicesAutos.asmx?WSDL" -o hdi.wsdl
```

GNP no tiene WSDL público (es REST/XML plano) — su schema real solo viene
del Kit GNP - Multicotizador JIRO.xlsx.
