# Troubleshooting - Mi Asistente

## Problema: Los mensajes no aparecen o no hay respuesta

### Cambios Implementados

Se han realizado las siguientes mejoras para resolver el problema:

1. **Mensaje del usuario aparece inmediatamente** - El mensaje ahora se muestra en la UI tan pronto como el usuario presiona Enter, sin esperar la respuesta del backend.

2. **Mejor manejo de errores** - Si hay un error, el asistente muestra un mensaje de error claro en lugar de quedarse colgado.

3. **Logs mejorados** - Se agregaron console.logs para facilitar la depuración.

### Verificación Paso a Paso

#### 1. Verificar que la API Key de OpenAI está configurada

La edge function requiere que `OPENAI_API_KEY` esté configurada en las variables de entorno de Supabase.

**Cómo verificar:**
1. Ve a tu proyecto en Supabase Dashboard
2. Ve a Settings > Edge Functions
3. Verifica que `OPENAI_API_KEY` esté configurada

Si no está configurada, el asistente responderá con:
```
"Por favor configura la API de OpenAI para usar el asistente."
```

#### 2. Abrir la Consola del Navegador

Cuando envíes un mensaje, deberías ver en la consola:

```
Assistant response: {...}
```

Si ves errores, anótalos:
- `Edge function error:` - Error en la edge function
- `No data received from edge function` - La función no devolvió datos
- `Error sending message:` - Error general en el envío

#### 3. Verificar en la Base de Datos

Verifica que los mensajes se están creando:

```sql
-- Verifica tus conversaciones
SELECT * FROM conversaciones_chatgpt
WHERE usuario_id = 'TU_USER_ID'
ORDER BY updated_at DESC;

-- Verifica los mensajes de una conversación
SELECT * FROM mensajes_chatgpt
WHERE conversacion_id = 'CONVERSATION_ID'
ORDER BY created_at ASC;
```

#### 4. Revisar Logs de Edge Function

1. Ve a Supabase Dashboard > Edge Functions
2. Selecciona `assistant-send-message`
3. Ve a la pestaña "Logs"
4. Busca errores recientes

### Errores Comunes y Soluciones

#### Error: "Failed to create user message"
**Causa:** Problema con permisos RLS o conversación no existe
**Solución:** Verifica que la conversación existe y pertenece al usuario

#### Error: No hay respuesta del asistente
**Causa:** La API de OpenAI está tardando mucho o falló
**Solución:**
- Verifica tu crédito de OpenAI
- Verifica que la API key es válida
- Revisa los logs de la edge function

#### Error: "Edge function error"
**Causa:** Error en la llamada a la edge function
**Solución:** Revisa los logs de la edge function en Supabase Dashboard

### Estructura de la Respuesta Esperada

La edge function debe devolver:

```json
{
  "conversacion_id": "uuid",
  "mensaje_id": "uuid",
  "respuesta": "texto de la respuesta",
  "respuesta_estructurada": {
    "type": "text",
    "text": "respuesta del asistente",
    "actions": [
      {
        "type": "navigate",
        "label": "Ver algo",
        "destination": "/ruta",
        "icon": "IconName"
      }
    ]
  }
}
```

### Flujo Completo del Mensaje

1. **Frontend** - Usuario escribe mensaje y presiona Enter
2. **UI Update** - Mensaje del usuario aparece inmediatamente (temporal)
3. **DB Insert** - Se crea el mensaje del usuario en `mensajes_chatgpt`
4. **Edge Function** - Se invoca `assistant-send-message`
5. **Context Loading** - Se carga todo el contexto del usuario (comisiones, producción, CRM, etc.)
6. **OpenAI Call** - Se llama a OpenAI GPT-4o-mini con el contexto completo
7. **Response Parse** - Se parsea la respuesta JSON de OpenAI
8. **DB Insert** - Se guarda la respuesta del asistente en `mensajes_chatgpt`
9. **Frontend Reload** - Se recargan todos los mensajes de la conversación
10. **UI Update** - La conversación completa se muestra actualizada

### Verificar el Contexto del Usuario

Para verificar que el asistente tiene acceso a los datos:

```sql
-- Comisiones del usuario
SELECT COUNT(*) as total, SUM(commission_neta) as total_neto
FROM commission_details
WHERE movi_user_id = 'TU_USER_ID';

-- Producción del usuario
SELECT COUNT(*) as total, SUM(importe_pesos) as total_importe
FROM production_records
WHERE user_id = 'TU_USER_ID';

-- Tareas pendientes
SELECT COUNT(*) as total_pendientes
FROM crm_tareas
WHERE creado_por = 'TU_USER_ID' AND completada = false;
```

### Contacto con el Asistente de Prueba

Para probar el asistente, puedes usar estos mensajes:

1. "¿Cuánto he generado este mes?"
2. "¿Cuáles son mis últimas comisiones?"
3. "¿Qué tareas tengo pendientes?"
4. "Muéstrame mi producción"
5. "¿Cuáles son mis contactos?"

El asistente debería responder con datos específicos basados en tu información real.

### Variables de Entorno Requeridas

```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Estas variables ya están configuradas automáticamente en Supabase.

### Timeout de la Edge Function

Si el asistente tarda mucho en responder, puede ser que el timeout sea muy corto. El timeout por defecto es 2 minutos, lo cual debería ser suficiente para la mayoría de las consultas.

Si necesitas aumentarlo, contacta con soporte de Supabase.
