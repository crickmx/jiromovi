# 🔍 Diagnóstico: Mensaje de Bienvenida

## 📋 Problema Reportado
El mensaje de bienvenida muestra siempre el texto genérico: "Bienvenido a tu plataforma digital. Todo lo que necesitas está a un clic de distancia."

## 🛠️ Sistema Implementado

He desplegado y actualizado completamente el sistema con:

1. ✅ Edge Function `generate-welcome-message` desplegada
2. ✅ Logging detallado en frontend y backend
3. ✅ Manejo robusto de errores
4. ✅ Botón de regeneración de mensajes
5. ✅ Validaciones completas

## 🔎 Cómo Diagnosticar

### Paso 1: Abrir la Consola del Navegador

1. Entrar al Dashboard
2. Presionar `F12` o `Ctrl+Shift+I` (Windows/Linux) o `Cmd+Option+I` (Mac)
3. Ir a la pestaña "Console"

### Paso 2: Identificar el Problema

Buscar estos logs al cargar el Dashboard:

#### ✅ Caso Exitoso (debería verse así):
```
🚀 Iniciando carga de mensaje de bienvenida...
📊 Recopilando contexto para usuario: [UUID]
👤 Usuario encontrado: [Nombre] - [Rol]
✅ Contexto recopilado: { nombre, rol, ... }
📦 Contexto obtenido, generando mensaje...
🎯 Iniciando generación de mensaje de bienvenida...
📍 API URL: https://[proyecto].supabase.co/functions/v1/generate-welcome-message
📦 Contexto enviado: { ... }
🔑 Enviando petición a Edge Function...
📡 Response status: 200 (2500ms)
📦 Response data: { success: true, message: "..." }
✅ Mensaje generado exitosamente: [Mensaje personalizado]
🏁 Carga de mensaje finalizada
```

#### ❌ Caso de Error (probablemente verás esto):
```
🚀 Iniciando carga de mensaje de bienvenida...
...
📡 Response status: 500 (100ms)
❌ Error response: {"success":false,"error":"OPENAI_API_KEY not configured..."}
❌ Edge Function reportó error: OPENAI_API_KEY not configured...
⚠️  Usando mensaje de fallback
```

## 🔧 Solución Según el Error

### Error: "OPENAI_API_KEY not configured"

**Causa:** La variable de entorno no está configurada en Supabase.

**Solución:**

1. Ir al Dashboard de Supabase: https://supabase.com/dashboard
2. Seleccionar el proyecto
3. Ir a `Settings` → `Edge Functions` → `Secrets`
4. Agregar o verificar la variable:
   - Nombre: `OPENAI_API_KEY`
   - Valor: `sk-proj-...` (tu API key de OpenAI)
5. Guardar cambios
6. **Importante:** Redesplegar la función después de agregar la variable:
   - Puedo hacer esto ejecutando nuevamente el deploy

### Error: "Unauthorized" o "Missing Authorization header"

**Causa:** Problema con la sesión del usuario.

**Solución:**
1. Cerrar sesión
2. Limpiar cookies del navegador
3. Volver a iniciar sesión

### Error: "OpenAI API error: 401"

**Causa:** La API key de OpenAI no es válida.

**Solución:**
1. Verificar que la API key sea correcta
2. Verificar que la API key no haya expirado
3. Verificar que tenga fondos disponibles en OpenAI

### Error: "OpenAI API error: 429"

**Causa:** Se excedió el límite de rate limit de OpenAI.

**Solución:**
1. Esperar unos minutos
2. Verificar el plan de OpenAI
3. Considerar aumentar el límite en OpenAI Dashboard

## 📊 Logs de la Edge Function

Para ver los logs de la Edge Function:

1. Ir al Dashboard de Supabase
2. Ir a `Edge Functions` → `generate-welcome-message`
3. Ver la pestaña `Logs`

Buscar logs como:
```
=== GENERATE WELCOME MESSAGE START ===
Environment check:
- SUPABASE_URL: SET
- SUPABASE_SERVICE_ROLE_KEY: SET
- OPENAI_API_KEY: SET (length: 56)
User authenticated: [UUID]
Context received:
- Keys: ['nombre', 'rol', 'oficina', ...]
- Nombre: [Nombre]
- Rol: [Rol]
Calling OpenAI API...
OpenAI Response: 200 (2500ms)
Welcome message generated successfully
Message length: 85
Message preview: [Primeros 100 caracteres]
=== GENERATE WELCOME MESSAGE END ===
```

## 🎯 Próximos Pasos

1. **Revisar los logs en la consola del navegador**
2. **Identificar el error específico**
3. **Aplicar la solución correspondiente**
4. **Si el error es `OPENAI_API_KEY not configured`, avisar para redesplegar la función después de configurar la variable**

## 📞 Información Adicional

- La función ahora tiene temperatura 0.9 para máxima variación
- Usa timestamp + seed aleatorio para garantizar mensajes únicos
- Tiene timeout de 150 tokens máximo
- Usa modelo `gpt-4o-mini` (rápido y económico)
- Incluye validación completa del response de OpenAI

## 🔍 Debugging Rápido

Para probar la función directamente, ejecutar en la consola del navegador:

```javascript
// Obtener el contexto
const userId = '[ID del usuario]';
const context = await getUserWelcomeContext(userId);
console.log('Contexto:', context);

// Generar mensaje
const message = await generateWelcomeMessage(context);
console.log('Mensaje:', message);
```

---

**Fecha:** 2026-01-14
**Estado:** Sistema desplegado con diagnóstico completo
**Acción requerida:** Revisar logs y configurar OPENAI_API_KEY si es necesario
