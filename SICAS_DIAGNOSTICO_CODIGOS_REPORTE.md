# Diagnóstico: Error "Código de reporte no encontrado" en SICAS

## Problema
Al sincronizar desde SICAS aparece el error:
```
Error en SICAS API: Codigo de reporte no encontrado
```

## Causa
Los códigos de reporte configurados (`H05106`, `H05107`, `H05105`, `H03117`) no están disponibles en tu instancia de SICAS. Cada instalación de SICAS puede tener códigos de reporte diferentes según la configuración del proveedor.

## Solución

### Paso 1: Identificar códigos disponibles

Ejecuta la función de diagnóstico para descubrir qué códigos de reporte están activos en tu SICAS:

```bash
curl -X POST \
  'https://[TU-PROJECT].supabase.co/functions/v1/sicas-test-available-reports' \
  -H 'Authorization: Bearer [TU-ANON-KEY]'
```

O desde el navegador:
```javascript
const { data } = await supabase.functions.invoke('sicas-test-available-reports');
console.log('Códigos disponibles:', data.recommendations);
```

### Paso 2: Interpretar resultados

La función te devolverá:

```json
{
  "success": true,
  "summary": {
    "total_tested": 16,
    "available": 5,
    "with_data": 3,
    "not_found": 8,
    "errors": 3
  },
  "recommendations": ["H05106", "D004", "C001"]
}
```

- **available**: Códigos que SICAS reconoce
- **with_data**: Códigos que retornan datos
- **recommendations**: Códigos recomendados para usar

### Paso 3: Actualizar configuración

Una vez identificados los códigos correctos, actualiza la función de sincronización:

**Archivo a modificar:**
`supabase/functions/sync-sicas-polizas-vigentes-rest/index.ts`

**Línea 75-76:**
```typescript
// Reemplaza estos códigos con los que funcionaron en tu SICAS
const reportCodes = ['TU_CODIGO_1', 'TU_CODIGO_2', 'TU_CODIGO_3'];
let successfulReport: string | null = null;
```

**Ejemplo:**
Si el diagnóstico encontró que `H05101` funciona:
```typescript
const reportCodes = ['H05101', 'H05106', 'H05107'];
```

### Paso 4: Redesplegar función

```bash
# Desde el directorio del proyecto
supabase functions deploy sync-sicas-polizas-vigentes-rest
```

## Códigos de reporte comunes

### Pólizas y producción
- `H05106` - Pólizas vigentes (común)
- `H05107` - Pólizas emitidas
- `H05105` - Producción mensual
- `H03117` - Reporte detallado
- `H05101` - Listado general
- `H05102` - Pólizas por vendedor

### Cobranza
- `D004` - Cobranza pendiente
- `D001` - Cuentas por cobrar
- `D002` - Mora
- `D003` - Cartera vencida

### Comisiones
- `C001` - Comisiones pendientes
- `C002` - Comisiones pagadas
- `C003` - Detalle de comisiones
- `C004` - Resumen mensual

## Solución alternativa: Contactar a SICAS

Si ningún código funciona, contacta a tu proveedor de SICAS:

**Información a solicitar:**
1. Código de reporte para "Pólizas Vigentes"
2. Código de reporte para "Cobranza Pendiente"
3. Código de reporte para "Comisiones"
4. Estructura de campos de cada reporte
5. Documentación de la API REST

**Contacto típico:**
- Email: soporte@sicasonline.com.mx
- Teléfono: Consultar con tu agente de ventas
- Portal: www.sicasonline.com.mx

## Mejoras implementadas

### 1. Manejo inteligente de errores
La sincronización ahora:
- Prueba múltiples códigos de reporte automáticamente
- Muestra mensajes claros cuando un código no existe
- Continúa probando otros códigos si uno falla

### 2. Función de diagnóstico
Nueva función `sicas-test-available-reports` que:
- Prueba 16 códigos de reporte comunes
- Identifica cuáles están disponibles
- Verifica cuáles tienen datos
- Recomienda los mejores códigos a usar

### 3. Logs mejorados
Los logs ahora muestran:
```
[Sync REST] Intentando reporte H05106...
[Sync REST] H05106 no está disponible en SICAS, probando siguiente...
[Sync REST] Intentando reporte H05107...
[Sync REST] ✅ Reporte H05107 exitoso con 1234 pólizas
```

## Preguntas frecuentes

**P: ¿Por qué los códigos cambian entre instalaciones?**
R: SICAS es un sistema configurable. Cada broker puede tener reportes personalizados con códigos diferentes.

**P: ¿Puedo agregar más códigos para probar?**
R: Sí, modifica el array `reportCodes` en ambas funciones:
- `sync-sicas-polizas-vigentes-rest/index.ts` (línea 75)
- `sicas-test-available-reports/index.ts` (línea 20)

**P: ¿La sincronización se detiene si un código falla?**
R: No, el sistema prueba todos los códigos hasta encontrar uno que funcione.

**P: ¿Qué pasa si ningún código funciona?**
R: La función devuelve un error detallado indicando que necesitas contactar a SICAS para obtener los códigos correctos.

## Verificación del error actual

Para ver el error completo en los logs:

1. Ve a tu proyecto en Supabase Dashboard
2. Click en "Edge Functions" → "sicas-sync-manual"
3. Click en "Logs"
4. Busca el último error

Deberías ver algo como:
```
[Sync REST] Error con H05106: Codigo de reporte no encontrado
[Sync REST] Error con H05107: Codigo de reporte no encontrado
...
Ningún reporte funcionó. Error en SICAS API: Codigo de reporte no encontrado
```

Esto confirma que los códigos actuales no están en tu SICAS y necesitas ejecutar el diagnóstico.
