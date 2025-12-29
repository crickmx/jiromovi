# Conocimiento Institucional en Mi Asistente

## Objetivo Logrado

Mi Asistente ahora puede responder preguntas institucionales sobre JIRO y Asociados, Agente Total y MOVI Digital usando **solo conocimiento validado y curado**.

## Qué Se Implementó

### 1. Nuevos Tipos de Consultas (Intents)

Se agregaron dos nuevos intents:

- **`institutional_info`**: Información sobre JIRO y Agente Total
- **`brand_relationship`**: Relación entre JIRO, Agente Total y MOVI

### 2. Detección Automática de Preguntas Institucionales

El sistema detecta automáticamente cuando el usuario pregunta sobre:
- "JIRO", "JIRO y Asociados"
- "Agente Total", "promotoría"
- "Quiénes somos", "qué empresa"
- "Respaldo institucional"
- "Relación entre MOVI/JIRO/Agente Total"

### 3. Conocimiento Institucional Validado

El asistente tiene conocimiento estructurado sobre:

#### JIRO y Asociados
- Empresa mexicana intermediaria de seguros
- Más de 50 años de experiencia
- Opera en todos los ramos de seguros
- Brinda respaldo institucional
- Sitio oficial: https://www.jiro.mx

#### Agente Total
- Plataforma y promotoría para agentes
- Modelo híbrido: promotoría + tecnología + mercadotecnia
- Alta directa en aseguradoras
- Soporte back office, comisiones, capacitación
- Tres modelos: Agente Individual, Promotoría Asociada, Promotor Agente Total
- Sitio oficial: https://www.promotoriadeseguros.com.mx

#### Relación entre Marcas
- JIRO y Asociados → Respaldo institucional
- Agente Total → Modelo de negocio
- MOVI Digital → Plataforma tecnológica

### 4. Sugerencias Institucionales

Se agregaron sugerencias que aparecerán en:
- Dashboard
- Perfil
- Todas las rutas (con prioridad baja)

Ejemplos de sugerencias:
- "¿Qué es Agente Total?"
- "¿Quiénes son JIRO y Asociados?"
- "¿Cuál es la relación entre JIRO y MOVI?"
- "¿Qué respaldo institucional tengo?"
- "¿Cómo me apoya Agente Total?"

### 5. Modo de Operación Inteligente

Cuando detecta una pregunta institucional:
- **Usa Modo MOVI** (no ChatGPT genérico)
- **NO hace búsquedas web**
- **Solo usa conocimiento validado**
- **Peso alto (50)** en el router para priorizar este modo

### 6. Reglas Estrictas

El asistente:
- NO inventa información institucional
- NO busca en internet sobre JIRO/Agente Total/MOVI
- Si no tiene la respuesta, dice: "No tengo esa información específica" y sugiere consultar el sitio oficial
- Mantiene tono institucional, claro y confiable

## Archivos Modificados

### Frontend
- `src/lib/assistantTypes.ts` - Nuevos tipos de intents
- `src/lib/intentMapper.ts` - Detección de keywords y clasificación

### Backend (Edge Function)
- `supabase/functions/assistant-send-message/index.ts`:
  - Router con keywords institucionales
  - Bloque de conocimiento institucional en system prompt
  - Peso alto (50) para preguntas institucionales

### Base de Datos
- Nueva migración: `add_institutional_knowledge_suggestions.sql`
  - 2 nuevos intents
  - 7 nuevas sugerencias institucionales

## Cómo Funciona

### Flujo de una Pregunta Institucional

1. Usuario pregunta: "¿Qué es Agente Total?"
2. Router detecta keyword "agente total" → peso 50 para Modo MOVI
3. Se activa intent `institutional_info`
4. System prompt incluye conocimiento institucional validado
5. GPT responde SOLO con información del bloque de conocimiento
6. NO se hace búsqueda web
7. Respuesta con tono institucional y acciones relevantes

### Ejemplo de Respuesta Esperada

**Pregunta:** "¿Qué es Agente Total?"

**Respuesta:**
```json
{
  "type": "text",
  "text": "Agente Total es una plataforma y promotoría de seguros diseñada para agentes y promotorías. Opera con un modelo híbrido que combina promotoría, tecnología y mercadotecnia. Te ofrece alta directa en aseguradoras, soporte de back office, administración de comisiones, capacitación continua, publicidad incluida y herramientas digitales a través de MOVI Digital. Existen tres modelos: Agente Individual, Promotoría Asociada y Promotor Agente Total.",
  "actions": [
    {"type": "external", "label": "Visitar Agente Total", "destination": "https://www.promotoriadeseguros.com.mx", "icon": "ExternalLink"}
  ]
}
```

## Beneficios

### Para MOVI Digital
- Un solo asistente que resuelve operación Y dudas institucionales
- Mensaje corporativo consistente
- Refuerzo de identidad de marca

### Para el Usuario
- Respuestas rápidas sobre respaldo institucional
- Claridad en la relación entre marcas
- Confianza en el ecosistema

### Para el Negocio
- Reduce preguntas repetitivas
- Elimina confusión entre JIRO/Agente Total/MOVI
- Refuerza autoridad y respaldo institucional

## Verificación

Para verificar que funciona correctamente:

1. Abre Mi Asistente
2. En Dashboard o Perfil verás sugerencias como:
   - "¿Qué es Agente Total?"
   - "¿Quiénes son JIRO y Asociados?"
3. Haz clic en una sugerencia o escribe manualmente
4. Deberías recibir una respuesta institucional clara
5. Revisa los logs del router para confirmar:
   - Modo usado: `movi`
   - Keywords detectados: `institucional`
   - Confidence alto (>40)

## Fuentes Oficiales

Las únicas fuentes de verdad para información institucional:
- https://www.jiro.mx
- https://www.promotoriadeseguros.com.mx

Si el usuario pregunta algo no cubierto, el asistente lo refiere a estas fuentes.

## Próximos Pasos (Opcionales)

Si quieres expandir este conocimiento en el futuro:

1. Agregar más información sobre modelos de Agente Total
2. Incluir beneficios específicos por modelo
3. Agregar historia y trayectoria de JIRO
4. Incluir casos de éxito o testimonios
5. Información sobre convenios con aseguradoras

**Regla de oro:** Todo conocimiento nuevo debe ser validado y agregado explícitamente al system prompt. NUNCA permitir búsquedas web dinámicas para temas institucionales.
