# Cómo Probar el Sistema "1 Chat, 2 Cerebros"

## 🔍 Verificación Rápida

### 1. Verificar que la Migración se Aplicó
```sql
-- Ejecutar en Supabase SQL Editor
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('assistant_routing_logs', 'assistant_mode_analytics');
```

Deberías ver ambas tablas listadas.

### 2. Verificar Columnas Nuevas
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mensajes_chatgpt'
AND column_name IN ('modo_usado', 'router_confidence', 'web_sources');
```

Deberías ver las 3 columnas nuevas.

## 🧪 Pruebas Funcionales

### Prueba 1: Modo MOVI (Datos del Sistema)

**Abrir el asistente y probar estas preguntas:**

1. "¿Cuánto gané en comisiones este mes?"
2. "Muéstrame mis últimas tareas pendientes"
3. "¿Cuánta producción tengo?"
4. "Dame un resumen de mis contactos en el CRM"

**Resultado esperado:**
- Badge: 📊 Datos del Sistema
- Color azul
- Respuesta con datos reales del usuario
- Confianza típicamente > 70%

### Prueba 2: Modo ChatGPT (Conocimiento General)

**Probar estas preguntas:**

1. "¿Qué es el coaseguro?"
2. "Dame consejos para vender seguros de vida"
3. "Explícame la diferencia entre póliza y prima"
4. "¿Cuáles son las mejores prácticas en CRM?"

**Resultado esperado:**
- Badge: 🤖 Conocimiento General
- Color morado
- Respuesta explicativa/educativa
- Confianza típicamente > 70%

### Prueba 3: Búsqueda Web (requiere Tavily API Key)

**Configurar primero:**
```bash
# En Supabase Dashboard → Project Settings → Edge Functions → Environment Variables
TAVILY_API_KEY=tu_api_key_aqui
```

**Probar estas preguntas:**

1. "¿Cuáles son las tendencias en seguros para 2025?"
2. "¿Cuál es el precio promedio de seguros GMM en México?"
3. "Últimas noticias sobre regulación de seguros"

**Resultado esperado:**
- Badge: 🤖 Conocimiento General
- Respuesta enriquecida con información actual
- Sección "🌐 Fuentes consultadas" con 3 enlaces
- Cada fuente clickeable

### Prueba 4: Analytics (solo admins)

**Ver métricas del router:**

1. Agregar el componente a Configuración:
```tsx
import { AssistantAnalytics } from '../components/AssistantAnalytics';

// En Configuracion.tsx, agregar:
{user?.rol === 'admin' && (
  <div className="mt-6">
    <AssistantAnalytics />
  </div>
)}
```

2. Ir a `/configuracion`
3. Hacer scroll hasta la sección de Analytics

**Resultado esperado:**
- 4 cards con métricas:
  - Total consultas
  - % ChatGPT
  - % MOVI
  - Confianza promedio
- Lista de últimas 10 decisiones
- Información explicativa del sistema

## 🐛 Debugging

### Logs en la Consola del Navegador

Al enviar un mensaje, deberías ver en la consola:
```
Executing intelligent router...
Routing decision: {
  mode: "chatgpt",
  chatgptScore: 75,
  moviScore: 25,
  confidence: 50,
  intent: "EXPLANATION"
}
```

### Logs en Supabase Edge Functions

En Supabase Dashboard → Edge Functions → Logs:
```
Executing intelligent router...
Routing decision: { mode: "movi", ... }
Saving routing log...
```

Si requiere web search:
```
Performing web search...
Web search completed: 3 results
```

### Verificar Logs en la Base de Datos

```sql
-- Ver últimas decisiones del router
SELECT
  selected_mode,
  confidence_score,
  router_reasoning,
  created_at
FROM assistant_routing_logs
ORDER BY created_at DESC
LIMIT 10;
```

```sql
-- Ver mensajes con modo usado
SELECT
  id,
  rol,
  modo_usado,
  router_confidence,
  contenido,
  created_at
FROM mensajes_chatgpt
WHERE modo_usado IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

## 🎯 Casos de Prueba Específicos

### Caso 1: Transición Entre Modos
```
Usuario: "¿Cuánto gané en comisiones?" → MOVI
Usuario: "¿Qué estrategias me recomiendas para aumentarlas?" → ChatGPT
Usuario: "¿Cuáles fueron mis mejores meses?" → MOVI
```

El sistema debe cambiar de modo correctamente en cada pregunta.

### Caso 2: Confianza Baja
```
Usuario: "información"
```
Pregunta ambigua → Confianza baja → Defaultea a ChatGPT (60-40)

### Caso 3: Keywords Múltiples
```
Usuario: "¿Cómo puedo mejorar mi producción de comisiones?"
```
Tiene "producción" (MOVI) y "cómo mejorar" (ChatGPT) → El router debe ponderar correctamente

## 📊 Métricas de Éxito

**Después de 50+ preguntas, deberías ver:**

- **Distribución esperada:**
  - 40-60% ChatGPT
  - 40-60% MOVI

- **Confianza promedio:** > 60%

- **Sin errores en:**
  - Guardar mensajes
  - Logs de routing
  - Analytics

## 🔄 Rollback (si es necesario)

Si algo falla, puedes revertir:

```sql
-- Revertir campos nuevos (CUIDADO: Perderás datos)
ALTER TABLE mensajes_chatgpt
DROP COLUMN IF EXISTS modo_usado,
DROP COLUMN IF EXISTS router_confidence,
DROP COLUMN IF EXISTS web_sources;

-- Eliminar tablas nuevas (CUIDADO: Perderás datos)
DROP TABLE IF EXISTS assistant_routing_logs;
DROP TABLE IF EXISTS assistant_mode_analytics;
```

## ✅ Checklist de Verificación

- [ ] Migración aplicada sin errores
- [ ] Columnas nuevas existen en `mensajes_chatgpt`
- [ ] Tablas de logs y analytics creadas
- [ ] Build del proyecto exitoso sin errores
- [ ] Badges de modo se muestran correctamente
- [ ] Modo MOVI funciona con datos reales
- [ ] Modo ChatGPT da respuestas generales
- [ ] Web search funciona (si Tavily configurado)
- [ ] Analytics muestra métricas correctas
- [ ] Logs se guardan en la base de datos

## 🎓 Tips para Testing

1. **Alterna tipos de preguntas** para ver el router en acción
2. **Revisa los badges** en cada respuesta
3. **Verifica la confianza** - números altos = buenas decisiones
4. **Checa los logs** en Supabase para debugging
5. **Prueba preguntas ambiguas** para ver cómo maneja casos límite

## 🚀 ¡Listo para Producción!

El sistema está completamente funcional y listo para usar. Los usuarios no necesitan hacer nada diferente - el router trabaja transparentemente en el background.
