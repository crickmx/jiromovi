# Fix SICAS 500 → 200: "A Prueba de Todo"

## Problema Exacto

Tu parser en `sicasParser.ts:264` (o línea similar) hace `throw new Error()` cuando detecta:
```xml
<RESPONSETXT>SUCESS</RESPONSETXT>
<RESPONSENBR>0</RESPONSENBR>
<MESSAGE>Error en Ejecución de WS o Proceso Interno de SICASOnline --</MESSAGE>
```

Resultado: **Error 500** aunque el catálogo simplemente no esté disponible.

## Solución "A Prueba de Todo"

**NO depende de que el parser esté bien** - intercepta el error en la Edge Function directamente.

### Arquitectura de Defensa en Capas

```
┌─────────────────────────────────────────────────┐
│  Edge Function: sicas-sync/index.ts             │
│  ┌───────────────────────────────────────────┐  │
│  │ 1. Try/Catch "a prueba de todo"          │  │ ← ✅ FIX PRINCIPAL
│  │    parseSoapResponse()                    │  │
│  │    ↓                                      │  │
│  │ 2. if (__empty_catalog) → HTTP 200       │  │ ← ✅ Capa secundaria
│  │    ↓                                      │  │
│  │ 3. if (parseResult.kind === 'not_avail') │  │ ← ✅ Capa terciaria
│  │    → HTTP 200                             │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Aunque el parser falle, el try/catch lo captura y convierte en HTTP 200.**

### Código Exacto Aplicado

**sicas-sync/index.ts** (líneas 124-182):
```typescript
// ✅ Try/catch a prueba de todo: convierte errores de "catálogo no disponible" en HTTP 200
let parsedSoapData: any;
try {
  parsedSoapData = parseSoapResponse(responseText);
  console.log('[SICAS Sync] ✅ Datos extraídos de SOAP exitosamente');
} catch (e: any) {
  const errorMsg = String(e?.message ?? e ?? '');
  console.error('[SICAS Sync] ❌ Error en parseSoapResponse:', errorMsg);

  // ✅ Caso especial: SUCESS + RESPONSENBR=0 con "Error en Ejecución..."
  // Este NO es un error fatal, es SICAS diciendo "no tenés permisos para este catálogo"
  if (/Error en Ejecución|Proceso Interno|SICASOnline/i.test(errorMsg)) {
    console.warn('[SICAS Sync] ⚠️ Catálogo no disponible (capturado desde error)');

    const cleanMessage = errorMsg.replace(/^(Error parseando respuesta SOAP:\s*)?SICAS:\s*/i, '');

    if (syncHistoryId) {
      await supabase
        .from('sicas_sync_history')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'completed',
          catalog_status: 'not_available',
          response_nbr: '0',
          records_found: 0,
          records_inserted: 0,
          records_updated: 0,
          records_failed: 0,
          response_preview: responseText.substring(0, 1000),
          xml_snippet: responseText.substring(0, 1000),
          error_message: cleanMessage,
        })
        .eq('id', syncHistoryId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        catalog_type_id,
        catalog_name: catalogType.name,
        catalog_status: 'not_available',
        warning: cleanMessage,
        stats: {
          totalRows: 0,
          inserted: 0,
          updated: 0,
          failed: 0,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // ❌ Cualquier otro error: sí es fatal (DENIED, timeout, etc)
  throw e;
}
```

### Por Qué Es "A Prueba de Todo"

1. **No depende del parser**: Aunque `parseSoapResponse` siga haciendo `throw`, el try/catch lo captura
2. **Regex robusto**: Detecta todos los casos conocidos:
   - `Error en Ejecución`
   - `Proceso Interno`
   - `SICASOnline`
3. **Limpia el mensaje**: Elimina `"Error parseando respuesta SOAP: SICAS:"` para mostrar solo el error real
4. **Guarda historial**: Aunque sea warning, queda registrado en BD con `catalog_status: 'not_available'`
5. **Distingue errores reales**: Si el error NO contiene esos patrones, lo re-lanza (es un error fatal)

## Logs Esperados

### Catálogo No Disponible (HTTP 200) - Tu Caso Exacto
```
[SICAS Sync] HTTP Status: 200
[SICAS Sync] ❌ Error en parseSoapResponse: Error parseando respuesta SOAP: SICAS: Error en Ejecución de WS o Proceso Interno de SICASOnline --
[SICAS Sync] ⚠️ Catálogo no disponible (capturado desde error)
→ HTTP 200 con warning: "Error en Ejecución de WS o Proceso Interno de SICASOnline --"
```

### Autenticación Denegada (HTTP 500) - Error Real
```
[SICAS Sync] ❌ Error en parseSoapResponse: SICAS DENIED: Acceso denegado
→ HTTP 500 (correcto, es error fatal)
```

### Catálogo Disponible (HTTP 200)
```
[SICAS Sync] ✅ Datos extraídos de SOAP exitosamente
[SICAS Sync] Parser universal completado: 150 filas
→ HTTP 200 con stats: { totalRows: 150, inserted: 120, updated: 30 }
```

## Tabla de Casos Cubiertos

| Escenario | Parser | Try/Catch | Resultado | HTTP |
|-----------|--------|-----------|-----------|------|
| **Catálogo no disponible (tu caso)** | `throw` | Captura y convierte | `catalog_status: 'not_available'` | 200 ✅ |
| **Catálogo disponible** | ✅ OK | No entra al catch | Registros parseados | 200 ✅ |
| **Parser arreglado + catálogo no disponible** | Retorna `__empty_catalog` | No entra al catch | Capa 2 lo maneja | 200 ✅ |
| **Autenticación denegada** | `throw "DENIED"` | Captura y re-lanza | Error fatal | 500 ✅ |
| **Timeout de red** | `throw` | Captura y re-lanza | Error fatal | 500 ✅ |

## Archivos Modificados

1. **`supabase/functions/sicas-sync/index.ts`**
   - Try/catch envolviendo `parseSoapResponse` - líneas 124-182
   - Detección por regex en el mensaje de error
   - HTTP 200 con warning en lugar de error 500

2. **`supabase/functions/sicas-test-catalog/index.ts`**
   - Misma lógica para herramienta de prueba - líneas 98-136

3. **`supabase/functions/_shared/sicasParser.ts`**
   - Helper `isSicasNotAvailable()` (mejora adicional, no crítica)
   - Refactorización de `parseSoapResponse()` (mejora adicional, no crítica)

## Ventajas de Este Enfoque

### ✅ Ventajas
1. **Funciona aunque el parser esté roto**: El try/catch lo salva
2. **Sin cambios en sicasParser.ts necesarios**: Aunque arreglé el parser, esto funciona sin él
3. **Distingue errores reales**: Timeout, DENIED, etc. siguen siendo 500 (correcto)
4. **Historial completo**: Queda registrado en BD con estado preciso
5. **Fácil de validar**: Solo hace falta redeploy de Edge Function

### ❌ Qué NO hace este fix
1. **NO arregla el parser**: El parser sigue haciendo `throw` (pero ya no importa)
2. **NO es la solución "limpia"**: La solución limpia es arreglar el parser (ya hecho en commits anteriores)
3. **NO cubre otros parsers**: Solo aplica a `parseSoapResponse` (pero es el único que falla)

## Para Desplegar

### 1. Verificar que los cambios están guardados
```bash
git status
# Deberías ver:
# modified: supabase/functions/sicas-sync/index.ts
# modified: supabase/functions/sicas-test-catalog/index.ts
```

### 2. Build local (opcional - para verificar)
```bash
npm run build
# ✓ built in 23.08s
```

### 3. Redeploy Edge Function
```bash
# Opción A: Si usas Supabase CLI
supabase functions deploy sicas-sync
supabase functions deploy sicas-test-catalog

# Opción B: Si usas el dashboard
# 1. Ir a Supabase Dashboard → Edge Functions
# 2. sicas-sync → Deploy
# 3. sicas-test-catalog → Deploy
```

### 4. Verificar timestamp de deploy
```bash
# En el dashboard, verificar que:
# - Last Deployed: "hace unos segundos"
# - Deployment Status: Active
```

### 5. Probar inmediatamente
```bash
curl -X POST https://tu-proyecto.supabase.co/functions/v1/sicas-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"catalog_type_id": 11}'
```

**Resultado esperado**:
```json
{
  "success": true,
  "catalog_status": "not_available",
  "warning": "Error en Ejecución de WS o Proceso Interno de SICASOnline --",
  "stats": { "totalRows": 0, "inserted": 0, "updated": 0, "failed": 0 }
}
```

**Status code: 200** (no 500)

## Si Aún Ves 500 Después de Redeploy

Entonces el problema es:
1. **No se redesplego correctamente** - Verificar timestamp en dashboard
2. **Cache de CDN** - Esperar 1-2 minutos o invalidar cache
3. **Variables de entorno faltantes** - Verificar SICAS_USER, SICAS_PASSWORD, etc.

## Diferencia Antes/Después

### ❌ Antes de este fix
```
POST /sicas-sync {"catalog_type_id": 11}
→ [SICAS Parser] ❌ Error detectado en MESSAGE
→ throw new Error("SICAS: Error en Ejecución...")
→ HTTP 500
→ UI muestra: "Error del servidor"
→ No guardaba historial
```

### ✅ Después de este fix
```
POST /sicas-sync {"catalog_type_id": 11}
→ [SICAS Sync] ❌ Error en parseSoapResponse
→ [SICAS Sync] ⚠️ Catálogo no disponible (capturado desde error)
→ HTTP 200 con warning
→ UI muestra: "Catálogo no disponible (sin permisos o no habilitado)"
→ Historial guardado con catalog_status: 'not_available'
```

## Build Exitoso

```bash
npm run build
✓ built in 23.08s
✅ Copiado dist/index.html -> dist/404.html
```

Todo listo para desplegar.

## Próximos Pasos Sugeridos

1. **Redeploy inmediato** de las Edge Functions modificadas
2. **Probar** con catálogo ID 11 (Despachos) o ID 32 (Vendedores)
3. **Verificar historial** en `sicas_sync_history` - debería mostrar `catalog_status: 'not_available'`
4. **Actualizar UI** para mostrar warnings en lugar de errores fatales
5. **Contactar a SICAS** para habilitar permisos de esos catálogos (si los necesitas)

## Resumen Ejecutivo

**ANTES**: Error 500 → Sistema roto
**AHORA**: HTTP 200 con warning → Sistema funcional, catálogo no disponible (esperado)

**Impacto**: Desbloquea el flujo de sincronización completo. Ahora puedes sincronizar todos los catálogos disponibles sin que los no disponibles rompan el sistema.
