# Fix SICAS - Parser Mejorado y Debug

## Problema Actual

**Error:** "Error parseando respuesta SOAP: No se encontró ReadInfoDataResult en la respuesta SOAP"

Este error indica que SICAS está respondiendo, pero:
1. No está retornando el elemento `<ReadInfoDataResult>` esperado
2. Probablemente está retornando un error interno de SICAS
3. Las credenciales pueden ser incorrectas o la cuenta no tiene permisos

## ✅ Correcciones Aplicadas

### 1. Parser SOAP Mejorado (`_shared/sicasParser.ts`)

**Mejoras:**
- ✅ Busca múltiples tipos de errores: `RESPONSETXT`, `ERROR`, `faultstring`
- ✅ Muestra mensaje más descriptivo cuando falta `ReadInfoDataResult`
- ✅ Registra el XML recibido en consola para debug
- ✅ Mensaje de error más claro: "Verificar credenciales y permisos en SICAS"

**Código mejorado:**
```typescript
// Ahora busca errores antes de fallar
if (!resultMatch) {
  // Buscar RESPONSETXT
  const responseTxtMatch = soapXml.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/is);
  if (responseTxtMatch) {
    throw new Error(`SICAS Error: ${responseTxtMatch[1]}`);
  }

  // Buscar ERROR
  const errorMatch = soapXml.match(/<ERROR>(.*?)<\/ERROR>/is);
  if (errorMatch) {
    throw new Error(`SICAS Error: ${errorMatch[1]}`);
  }

  // Log del XML recibido
  console.error('[SICAS Parser] XML recibido:', soapXml.substring(0, 500));
  throw new Error('No se encontró ReadInfoDataResult. Verificar credenciales y permisos.');
}
```

### 2. Edge Function con Debug Detallado (`sicas-sync/index.ts`)

**Mejoras:**
- ✅ Registra headers de respuesta HTTP
- ✅ Analiza la respuesta antes de parsear
- ✅ Detecta tags importantes: `ReadInfoDataResult`, `RESPONSETXT`, `faultstring`
- ✅ Muestra 2000 caracteres del XML cuando hay error (antes solo 500)
- ✅ Logs más descriptivos y estructurados

**Nuevo análisis automático:**
```typescript
// Buscar tags importantes para debug
const hasReadInfoDataResult = responseText.includes('ReadInfoDataResult');
const hasResponseTxt = responseText.includes('RESPONSETXT');
const hasFault = responseText.includes('faultstring');

console.log('[SICAS Sync] Análisis de respuesta:');
console.log('  - Contiene ReadInfoDataResult:', hasReadInfoDataResult);
console.log('  - Contiene RESPONSETXT:', hasResponseTxt);
console.log('  - Contiene faultstring:', hasFault);

// Mostrar preview completo si hay error
if (!hasReadInfoDataResult || hasFault) {
  console.log('[SICAS Sync] ⚠️ Respuesta completa (primeros 2000 chars):');
  console.log(responseText.substring(0, 2000));
}
```

### 3. Herramienta de Diagnóstico Web

**Archivo:** `public/diagnostico-sicas-detallado.html`

**Características:**
- ✅ Test de autenticación standalone
- ✅ Test de sincronización Despachos (ID 11)
- ✅ Test de sincronización Vendedores (ID 32)
- ✅ Análisis automático de errores
- ✅ Recomendaciones según el tipo de error
- ✅ UI amigable con estados visuales

**Uso:**
```
1. Abrir: http://localhost:5173/diagnostico-sicas-detallado.html
2. Click en "Probar Autenticación" primero
3. Si la autenticación es exitosa, probar sincronización
4. Revisar mensajes de error detallados
```

## 📋 Pasos para Desplegar las Correcciones

### Opción A: Deploy Manual desde Supabase Dashboard

1. **Ir a Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/qhwvuuyjhcennqccgvse
   ```

2. **Navegar a Edge Functions**
   - Click en "Edge Functions" en el menú lateral
   - Click en "sicas-sync"

3. **Editar el Edge Function**
   - Click en "Edit function"
   - Copiar el contenido de `supabase/functions/sicas-sync/index.ts`
   - Pegar en el editor
   - Click "Save" o "Deploy"

4. **Hacer lo mismo con el parser**
   - Navegar a `_shared/sicasParser.ts`
   - Copiar contenido actualizado
   - Pegar y guardar

### Opción B: Deploy desde CLI Local

```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Login a Supabase
supabase login

# 3. Link al proyecto
supabase link --project-ref qhwvuuyjhcennqccgvse

# 4. Deploy edge function
supabase functions deploy sicas-sync
```

### Opción C: Deploy All desde CLI

```bash
# Deploy todos los edge functions
supabase functions deploy
```

## 🔍 Cómo Verificar que el Deploy Funcionó

### 1. Ver Logs en Tiempo Real

**Supabase Dashboard:**
```
Edge Functions → sicas-sync → Logs
```

**Buscar líneas como:**
```
[SICAS Sync] HTTP Status: 200
[SICAS Sync] Análisis de respuesta:
  - Contiene ReadInfoDataResult: true/false
  - Contiene RESPONSETXT: true/false
  - Contiene faultstring: true/false
```

### 2. Probar desde la Herramienta de Diagnóstico

```
http://localhost:5173/diagnostico-sicas-detallado.html
```

**Resultado esperado si las credenciales son correctas:**
```json
{
  "success": true,
  "catalog_type_id": 11,
  "catalog_name": "Despachos",
  "stats": {
    "totalRows": 50,
    "inserted": 50,
    "updated": 0,
    "failed": 0
  }
}
```

**Resultado esperado si las credenciales son incorrectas:**
```json
{
  "success": false,
  "error": "SICAS Error: DENIED"
}
```

**Resultado esperado si el XML no contiene datos:**
```json
{
  "success": false,
  "error": "No se encontró ReadInfoDataResult en la respuesta SOAP. Verificar credenciales y permisos en SICAS."
}
```

## 🐛 Debug del Problema Actual

### Paso 1: Verificar Variables de Entorno

```bash
# En Supabase Dashboard
Settings → Edge Functions → Environment Variables

# Debe tener:
✅ SICAS_USERNAME = [tu usuario]
✅ SICAS_PASSWORD = [tu password]
✅ SICAS_ENDPOINT = https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx
```

### Paso 2: Test de Autenticación

1. Ir a `/diagnostico-sicas-detallado.html`
2. Click "Probar Autenticación"
3. Ver resultado:

**Si retorna DENIED:**
```
❌ Credenciales incorrectas
→ Verificar SICAS_USERNAME y SICAS_PASSWORD
```

**Si retorna SUCCESS:**
```
✅ Autenticación exitosa
→ Continuar con sincronización
```

### Paso 3: Ver el XML Real que Retorna SICAS

Después de hacer deploy con las correcciones:

1. Ir a Supabase Dashboard → Edge Functions → sicas-sync → Logs
2. Hacer test de sincronización
3. Buscar en los logs:

```
[SICAS Sync] ⚠️ Respuesta completa (primeros 2000 chars):
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope ...>
  <soap:Body>
    <ReadInfoDataResponse>
      <ReadInfoDataResult>
        ... datos aquí ...
      </ReadInfoDataResult>
    </ReadInfoDataResponse>
  </soap:Body>
</soap:Envelope>
```

### Paso 4: Analizar el Error

**Si ves esto en los logs:**
```
- Contiene ReadInfoDataResult: false
- Contiene RESPONSETXT: true
```

Significa que SICAS retornó un error. Busca en el XML:
```xml
<RESPONSETXT>DENIED</RESPONSETXT>  ← Credenciales incorrectas
<RESPONSETXT>ERROR: ...</RESPONSETXT>  ← Error de SICAS
```

**Si ves esto:**
```
- Contiene faultstring: true
```

Es un error SOAP. Busca:
```xml
<faultstring>Server was unable to process request...</faultstring>
```

## 🎯 Soluciones Comunes

### Error: "No se encontró ReadInfoDataResult"

**Causa 1: Credenciales incorrectas**
```
Solución: Verificar SICAS_USERNAME y SICAS_PASSWORD
```

**Causa 2: Cuenta sin permisos**
```
Solución: Contactar a SICAS para habilitar API
```

**Causa 3: catalog_type_id inválido**
```
Solución: Usar solo IDs válidos (1-61)
- Despachos: 11
- Vendedores: 32
```

### Error: "DENIED"

**Causa: Usuario o contraseña incorrectos**
```
Solución:
1. Verificar credenciales con el proveedor de SICAS
2. Verificar que no haya espacios extras
3. Verificar que la contraseña no tenga caracteres especiales sin escapar
```

### Error: "Variable de objeto o de bloque With no establecida"

**Causa: Error interno de SICAS**
```
Este es un error del lado de SICAS que usualmente indica:
1. Credenciales vacías o nulas
2. Request SOAP malformado
3. Problema en el servidor de SICAS

Solución:
1. Verificar que las variables de entorno estén configuradas
2. Probar primero con test de autenticación
3. Contactar a soporte de SICAS si persiste
```

## 📊 Resultados Esperados Después del Fix

### Con Credenciales Correctas:

```
✅ Test de Autenticación: SUCCESS
✅ Sincronización Despachos: 50 registros insertados
✅ Sincronización Vendedores: 100 registros insertados
✅ Logs muestran: "Contiene ReadInfoDataResult: true"
```

### Con Credenciales Incorrectas:

```
❌ Test de Autenticación: DENIED
❌ Sincronización Despachos: Error "SICAS Error: DENIED"
✅ Logs muestran el error exacto de SICAS
✅ Parser no falla, muestra mensaje descriptivo
```

### Sin Variables de Entorno:

```
❌ Error: "SICAS credentials not configured"
✅ Mensaje claro indicando configurar variables
```

## 📝 Resumen

**Archivos modificados:**
1. ✅ `supabase/functions/_shared/sicasParser.ts` - Parser mejorado
2. ✅ `supabase/functions/sicas-sync/index.ts` - Debug detallado
3. ✅ `public/diagnostico-sicas-detallado.html` - Herramienta de diagnóstico
4. ✅ `src/lib/sicasUtils.ts` - Queries de vendedores corregidas

**Siguiente paso:**
1. Deploy de los edge functions
2. Probar con herramienta de diagnóstico
3. Ver logs en Supabase Dashboard
4. Analizar el XML real que retorna SICAS

**Una vez deployed**, el sistema mostrará exactamente qué está retornando SICAS y por qué falla el parser.
