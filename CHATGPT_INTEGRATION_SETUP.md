# Integración ChatGPT - Instrucciones de Configuración

## Estado de Implementación: ✅ COMPLETADO

La conexión con ChatGPT ha sido completamente implementada y está lista para usar.

## Lo que se ha implementado:

### 1. Base de Datos ✅
- Tabla `conversaciones_chatgpt`: Almacena las conversaciones de cada usuario
- Tabla `mensajes_chatgpt`: Almacena todos los mensajes (usuario y asistente)
- Políticas RLS: Los usuarios solo pueden ver sus propias conversaciones
- Índices de rendimiento para consultas rápidas
- Trigger automático para actualizar timestamps

### 2. Edge Function ✅
- Función `chatgpt-query` desplegada en Supabase
- Manejo seguro de la API key de OpenAI (backend)
- Soporte para múltiples modelos de OpenAI
- Historial de conversación completo
- Conteo de tokens utilizados
- Manejo robusto de errores

### 3. Servicio Frontend ✅
- Archivo: `src/lib/chatgptService.ts`
- Funciones disponibles:
  - `sendMessage()` - Enviar mensajes a ChatGPT
  - `getConversations()` - Listar conversaciones del usuario
  - `getMessages()` - Obtener mensajes de una conversación
  - `deleteConversation()` - Eliminar conversación
  - `updateConversationTitle()` - Actualizar título

### 4. Componente de Prueba ✅
- Página: `/chatgpt-test`
- Interfaz sencilla para probar la conexión
- Muestra respuestas y tokens utilizados
- Maneja errores de forma clara

---

## Configuración Requerida

### Variable de Entorno Obligatoria

Para que la integración funcione, necesitas configurar la API key de OpenAI en Supabase:

1. Ve al Dashboard de Supabase
2. Navega a Project Settings → Edge Functions
3. Agrega la siguiente variable de entorno:
   ```
   OPENAI_API_KEY=sk-...tu-api-key-aqui...
   ```

### Obtener tu API Key de OpenAI

1. Ve a https://platform.openai.com/
2. Inicia sesión o crea una cuenta
3. Ve a API Keys en tu perfil
4. Crea una nueva API key
5. Copia la key y agrégala a Supabase

---

## Cómo Probar la Conexión

1. **Accede a la página de prueba:**
   - URL: `/chatgpt-test`
   - Solo usuarios autenticados pueden acceder

2. **Escribe un mensaje:**
   - Ingresa cualquier pregunta o mensaje
   - Presiona "Enviar Mensaje" o Enter

3. **Verifica la respuesta:**
   - Deberías ver la respuesta de ChatGPT
   - Se mostrará el número de tokens utilizados
   - La conversación se guarda automáticamente en la BD

---

## Uso Programático

### Enviar un mensaje nuevo

```typescript
import { chatgptService } from '../lib/chatgptService';

const response = await chatgptService.sendMessage(
  'Hola, ¿cómo estás?',
  undefined, // conversacionId (undefined = nueva conversación)
  'gpt-4o-mini' // modelo (opcional, por defecto gpt-4o-mini)
);

console.log(response.mensaje); // Respuesta de ChatGPT
console.log(response.conversacion_id); // ID de la conversación
console.log(response.tokens_usados); // Tokens consumidos
```

### Continuar una conversación existente

```typescript
const response = await chatgptService.sendMessage(
  '¿Y tú?',
  'uuid-de-conversacion-existente'
);
```

### Listar conversaciones del usuario

```typescript
const conversaciones = await chatgptService.getConversations();
conversaciones.forEach(conv => {
  console.log(conv.titulo);
  console.log(conv.updated_at);
});
```

### Obtener mensajes de una conversación

```typescript
const mensajes = await chatgptService.getMessages('conversacion-id');
mensajes.forEach(msg => {
  console.log(`${msg.rol}: ${msg.contenido}`);
});
```

---

## Modelos Disponibles

Puedes usar cualquiera de los siguientes modelos de OpenAI:

- `gpt-4o-mini` (por defecto) - Más económico
- `gpt-4o` - Más potente
- `gpt-4-turbo` - Equilibrio precio/rendimiento
- `gpt-3.5-turbo` - Más rápido y económico

Ejemplo:
```typescript
await chatgptService.sendMessage('Pregunta', undefined, 'gpt-4o');
```

---

## Seguridad

- ✅ La API key de OpenAI nunca se expone al frontend
- ✅ Todas las peticiones requieren autenticación
- ✅ Los usuarios solo pueden ver sus propias conversaciones
- ✅ RLS aplicado en todas las tablas
- ✅ Validación de tokens JWT en la Edge Function

---

## Costos

Los costos dependen del modelo y el uso:

- **gpt-4o-mini**: ~$0.15 por 1M tokens input / $0.60 por 1M tokens output
- **gpt-4o**: ~$2.50 por 1M tokens input / $10 por 1M tokens output

Cada mensaje incluye el historial completo de la conversación, por lo que el consumo de tokens aumenta con conversaciones largas.

---

## Próximos Pasos

Una vez que pruebes la conexión y confirmes que funciona, podemos proceder a:

1. Crear una interfaz de chat completa
2. Implementar streaming de respuestas
3. Agregar funciones especiales (análisis de seguros, cotizaciones, etc.)
4. Integrar con otros módulos del sistema
5. Agregar límites de uso y monitoreo de costos

---

## Troubleshooting

### Error: "OPENAI_API_KEY not configured"
- Verifica que agregaste la variable de entorno en Supabase
- Asegúrate de que la key empiece con `sk-`

### Error: "Unauthorized"
- Verifica que estés autenticado en la aplicación
- Intenta cerrar sesión e iniciar sesión nuevamente

### Error al guardar en BD
- Verifica las políticas RLS en Supabase
- Revisa los logs de la Edge Function

---

## Archivos Creados

- `/supabase/migrations/[timestamp]_create_chatgpt_system.sql`
- `/supabase/functions/chatgpt-query/index.ts`
- `/src/lib/chatgptService.ts`
- `/src/pages/ChatGPTTest.tsx`

¡La integración está lista para usar! 🚀
