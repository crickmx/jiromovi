# Diagnóstico: Error en Reporte SICAS H03117

## Estado: Identificado - Requiere acción con proveedor SICAS

## Resumen del Problema

La sincronización de pólizas vigentes con SICAS se ejecuta correctamente, pero el reporte H03117 devuelve 0 registros con un error interno de SICAS.

## Detalles Técnicos

### Respuesta de SICAS
```json
{
  "responsenbr": "0",
  "responsetxt": "SUCESS",
  "message": "Error en Ejecución de WS o Proceso Interno de SICASOnline --Variable de objeto o de bloque With no establecida."
}
```

### Análisis
- ✅ La conexión a SICAS funciona correctamente
- ✅ Las credenciales son válidas
- ✅ El servicio web responde
- ❌ El reporte H03117 tiene un error interno en SICAS

### Causa Probable

El mensaje de error "Variable de objeto o de bloque With no establecida" es un error de Visual Basic/VBScript que indica:

1. **Configuración incorrecta**: El reporte H03117 no está configurado correctamente para tu usuario en SICAS
2. **Permisos insuficientes**: Tu usuario no tiene acceso completo a este reporte
3. **Reporte no disponible**: El reporte H03117 no está disponible para tu tipo de cuenta
4. **Bug en SICAS**: Existe un problema en el código del reporte en el lado de SICAS

## Acción Requerida

### 1. Contactar al Proveedor de SICAS

**Información a proporcionar:**
- **Usuario**: [Tu usuario de SICAS]
- **Código de reporte**: H03117
- **Mensaje de error**: "Error en Ejecución de WS o Proceso Interno de SICASOnline --Variable de objeto o de bloque With no establecida."

**Preguntas a realizar:**
1. ¿El reporte H03117 está disponible para mi usuario?
2. ¿Cuál es el código de reporte correcto para obtener pólizas vigentes con detalle de vendedores?
3. ¿Qué permisos adicionales necesita mi usuario?
4. ¿Existe un reporte alternativo recomendado para producción por vendedor?

### 2. Reportes Alternativos Comunes

Solicita información sobre estos reportes que suelen estar disponibles:
- **H03100**: Reporte de producción general
- **H03101**: Reporte de pólizas emitidas
- **H03102**: Reporte de producción por vendedor
- **H03115**: Reporte de pólizas vigentes (versión alternativa)
- **H03120**: Reporte de cobranza

### 3. Información Adicional a Solicitar

- **Documentación del API**: Lista completa de reportes disponibles
- **Estructura de datos**: Campos que devuelve cada reporte
- **Códigos de error**: Documentación de mensajes de error
- **Permisos requeridos**: Lista de permisos necesarios por reporte

## Verificación Actual

La aplicación ya está configurada para:
- ✅ Capturar el error completo de SICAS
- ✅ Registrarlo en los logs (`sicas_production_sync_log`)
- ✅ Mostrar el mensaje de error en la interfaz
- ✅ Permitir configurar credenciales alternativas

## Próximos Pasos

1. **Contacta a SICAS** con la información anterior
2. **Obtén el código de reporte correcto**
3. Una vez que tengas el código correcto:
   - Actualízalo en la configuración: **Admin > SICAS > Configuración**
   - La aplicación funcionará automáticamente con el nuevo código

## Logs de Diagnóstico

Toda la información de diagnóstico se guarda en:
```sql
SELECT
  status,
  records_fetched,
  error_message,
  metadata,
  started_at,
  completed_at
FROM sicas_production_sync_log
ORDER BY started_at DESC
LIMIT 10;
```

Los detalles completos incluyen:
- `metadata->responsenbr`: Código de respuesta de SICAS
- `metadata->responsetxt`: Texto de estado
- `metadata->message`: Mensaje de error detallado

## Notas Técnicas

### El error NO es de la aplicación
Este error proviene directamente de SICAS. La aplicación está funcionando correctamente:
- La conexión SOAP se establece
- La autenticación es exitosa
- El reporte se solicita correctamente
- SICAS procesa la solicitud pero falla internamente

### Alternativa Temporal
Si SICAS tarda en resolver el problema, considera:
1. Usar la carga manual de archivos Excel de producción
2. Configurar la integración con Google Sheets
3. Importar datos desde otros sistemas disponibles
