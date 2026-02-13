# SICAS: Diferencia entre Códigos SOAP y REST

## Resumen Ejecutivo

El Manual oficial de SICAS documenta códigos para **WebService SOAP**, pero MOVI usa **API REST**. Los códigos de reporte son **diferentes** entre ambas interfaces.

---

## Códigos Oficiales SOAP (Del Manual WS SICASOnline)

Estos códigos están **confirmados y documentados** en el Manual oficial (páginas 14-19):

### Producción / Pólizas

| Código | Descripción | Campos Clave |
|--------|-------------|--------------|
| `H03117` | **Pólizas Vigentes** | IDDocto, Documento, FCaptura, VendNombre, DespNombre, PrimaTotal, Status |

### Cobranza

| Código | Descripción | Campos Clave |
|--------|-------------|--------------|
| `HAPPDATAL_D004` | **Cobranza Pendiente** | IDRecibo, IDDocto, FechaVencimiento, ImportePendiente, StatusCobranza |
| `H03120_001` | **Cobranza Efectuada/Pagada** | IDRecibo, IDDocto, FechaPago, ImportePagado |
| `H03846_Cob` | **Toda la Cobranza** | Historial completo (pagada + pendiente) |

### Comisiones

| Código | Descripción | Campos Clave |
|--------|-------------|--------------|
| `H03492_ALL` | **Comisiones Pendientes** | IDDocto, VendNombre, Importe, Comisión, StatusComisión |
| `H03797` | **Comisiones Pagadas** | Comisiones liquidadas |

---

## El Problema: SOAP vs REST

### WebService SOAP
- **Endpoint**: `WS_SICASOnline.asmx`
- **Método**: `KeyProcess=REPORT`, `KeyCode=H03117`
- **Formato**: XML con `<KeyProcess>` y `<KeyCode>`
- **Documentación**: Manual oficial completo

### API REST (MOVI usa esto)
- **Endpoint**: `https://security-services.sicasonline.info/api/readreport`
- **Método**: POST JSON con `keyCode`, `pageRequested`, `formatResponse`
- **Formato**: JSON request/response
- **Documentación**: Limitada o inexistente

### La Diferencia Crítica

**Los códigos de reporte NO son necesariamente los mismos entre SOAP y REST.**

Tu proveedor SICAS configura qué códigos están disponibles en cada interfaz. Es posible que:
- `H03117` funcione en SOAP pero no en REST
- REST use códigos completamente diferentes (ej: `POL001`, `PROD2025`)
- Algunos códigos estén habilitados en una interfaz pero no en la otra

---

## Qué Hacer Ahora

### 1. Probar Códigos SOAP en REST

MOVI ya tiene una herramienta automática que probará:
- Los 6 códigos oficiales SOAP
- 20+ variaciones comunes
- Total: ~30 códigos

**Accede a**: SICAS Admin → Diagnóstico → "Identificar Códigos Disponibles"

### 2. Probar Códigos Manualmente

Si conoces códigos específicos de tu instalación:

**Accede a**: SICAS Admin → Diagnóstico → "Probar Código Manual"

Ingresa el código y presiona "Probar Código".

### 3. Contactar a Tu Proveedor SICAS

Si ningún código funciona, solicita:

```
¿Cuáles son los códigos de reporte disponibles para API REST
en mi instalación de SICAS?

Necesito específicamente:
- Código para consultar Pólizas Vigentes
- Código para consultar Comisiones Pendientes
- Código para consultar Cobranza Pendiente
```

### 4. Alternativa: Usar SOAP en Lugar de REST

Si REST no funciona, MOVI puede migrar a SOAP:
- Usar el cliente SOAP existente
- Implementar los códigos oficiales del manual
- Garantizar compatibilidad 100% con documentación

---

## Códigos que MOVI Probará Automáticamente

### Oficiales SOAP
```
H03117, HAPPDATAL_D004, H03120_001, H03846_Cob, H03492_ALL, H03797
```

### Variaciones REST Comunes
```
H03117_001, H03117_ALL, H03117_VIGENTES
H03492, H03492_001, H03797_ALL, H03797_001
H03120, H03846, HAPPDATAL_D004_ALL
POLIZAS, VIGENTES, PRODUCCION, COBRANZA, COMISIONES
POL_VIGENTES, PROD_VIGENTES, COM_PEND, COM_PAG
```

---

## Estructura de Petición REST (Actual)

MOVI usa este formato para consultar reportes:

```json
POST https://security-services.sicasonline.info/api/readreport
Authorization: Bearer <token>

{
  "keyCode": "H03117",
  "pageRequested": 1,
  "itemsForPage": 100,
  "formatResponse": 2
}
```

**Respuesta esperada**:
```json
{
  "Sucess": true,
  "Error": null,
  "Response": [
    {
      "TableInfo": [
        { "IDDocto": "12345", "Documento": "POL-2025-001", ... }
      ]
    }
  ]
}
```

---

## Flujo Ideal para MOVI + SICAS

Una vez que identifiques los códigos correctos:

### Para Producción de Vendedores
1. **Usar código de Pólizas Vigentes** (ej: `H03117` o equivalente REST)
2. Filtrar por `VendNombre` o `DespNombre`
3. Agrupar por vendedor y calcular totales

### Para Comisiones Pendientes
1. **Usar código de Comisiones Pendientes** (ej: `H03492_ALL` o equivalente REST)
2. Filtrar por vendedor
3. Mostrar en widget de Dashboard

### Para Documentos Digitales
1. Obtener `IDDocto` de cualquier reporte
2. Usar `KeyProcess=CDIGITAL` con `IDValuePK=IDDocto`
3. Descargar PDFs y archivos asociados

---

## Próximos Pasos

### Si Encuentras Códigos REST Válidos
1. Actualiza `sicas_config.alternate_report_codes` en la BD
2. MOVI los usará automáticamente
3. Todo funcionará sin cambios de código

### Si Solo Funcionan Códigos SOAP
1. Notifica al equipo de desarrollo
2. Se implementará cliente SOAP completo
3. Migración automática a códigos oficiales del manual

### Si Nada Funciona
1. Solicita documentación REST a tu proveedor
2. O solicita habilitar códigos SOAP en REST
3. O migra completamente a interface SOAP

---

## Resumen Visual

```
┌─────────────────────────────────────────────────────────┐
│                    MANUAL SICAS                         │
│                                                         │
│  ✅ Códigos SOAP Oficiales (Documentados)              │
│     H03117, H03492_ALL, HAPPDATAL_D004, etc.          │
│                                                         │
│  ❓ Códigos REST (No Documentados)                     │
│     Pueden ser iguales, diferentes, o inexistentes     │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           │
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    TU INSTALACIÓN                       │
│                                                         │
│  🔧 Configuración de Proveedor                         │
│     Define qué códigos están activos                   │
│     Puede diferir del manual oficial                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           │
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    MOVI (ESTA APP)                      │
│                                                         │
│  🔍 Herramientas de Diagnóstico                        │
│     1. Prueba automática 30+ códigos                   │
│     2. Prueba manual código específico                 │
│     3. Recomendaciones basadas en resultados           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Conclusión

Los códigos del manual oficial son **válidos pero para SOAP**. MOVI usa **REST**, que puede tener códigos diferentes.

**Usa las herramientas de diagnóstico de MOVI** para identificar los códigos correctos para tu instalación específica.
