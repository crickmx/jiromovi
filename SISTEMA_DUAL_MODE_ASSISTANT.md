# Sistema "1 Chat, 2 Cerebros" - Asistente Inteligente

## Resumen Ejecutivo

Se ha implementado exitosamente un sistema de asistente inteligente dual-mode que combina **ChatGPT** (conocimiento general) y **MOVI** (datos del sistema) en una sola interfaz de chat. El sistema decide automáticamente qué modo usar basándose en el análisis inteligente de cada pregunta del usuario.

## 🎯 Características Principales

### 1. **Router Inteligente de 3 Capas**
Sistema que analiza cada pregunta y decide automáticamente qué "cerebro" usar:

#### Capa 1: Keyword Matching (Análisis Rápido)
- Detecta palabras clave específicas (comisiones, producción, CRM, etc.)
- Asigna scores ponderados a cada modo según las palabras encontradas
- Identifica el contexto de la consulta

#### Capa 2: Intent Classification (Análisis Contextual)
- Clasifica la intención del usuario:
  - `DATA_QUERY`: Consultar datos del sistema → MOVI
  - `ACTION_REQUEST`: Crear/modificar datos → MOVI
  - `NAVIGATION`: Navegar en la plataforma → MOVI
  - `EXPLANATION`: Explicaciones generales → ChatGPT
  - `COMPARISON`: Comparaciones de conceptos → ChatGPT
  - `RECOMMENDATION`: Consejos y estrategias → ChatGPT

#### Capa 3: Confidence Scoring (Decisión Final)
- Calcula scores finales (0-100) para cada modo
- Determina el nivel de confianza en la decisión
- Aplica reglas especiales (búsqueda web, contexto histórico)

### 2. **Integración con Búsqueda Web (Tavily)**
- Búsqueda automática de información actualizada cuando es necesario
- Se activa para preguntas sobre:
  - Noticias recientes
  - Tendencias actuales
  - Información de 2024-2025
  - Precios y valores actualizados
- Muestra fuentes consultadas con enlaces clickeables

### 3. **UI Diferenciada por Modo**

#### Badges Visuales
- 🤖 **ChatGPT** (Conocimiento General): Badge morado
- 📊 **MOVI** (Datos del Sistema): Badge azul
- Muestra el nivel de confianza del router (%)

#### Fuentes Web
Cuando ChatGPT consulta la web, se muestran:
- Título del artículo/fuente
- Snippet del contenido
- Enlace directo a la fuente

### 4. **Sistema de Analytics**
Componente `AssistantAnalytics` que muestra:
- Total de consultas procesadas
- Distribución entre modos (ChatGPT vs MOVI)
- Confianza promedio del router
- Historial de decisiones recientes con detalles

### 5. **Base de Datos y Tracking**

#### Nuevas Tablas
- `assistant_routing_logs`: Log completo de cada decisión del router
- `assistant_mode_analytics`: Métricas agregadas por usuario y modo

#### Nuevos Campos en `mensajes_chatgpt`
- `modo_usado`: 'chatgpt' o 'movi'
- `router_confidence`: Nivel de confianza (0-100)
- `web_sources`: Array JSON con fuentes web consultadas

## 📊 Flujo de Funcionamiento

```
Usuario escribe pregunta
        ↓
Router analiza la pregunta (3 capas)
        ↓
Decide modo: ChatGPT o MOVI
        ↓
Si ChatGPT y requiere info actualizada
        ↓
Busca en web (Tavily)
        ↓
Genera respuesta con contexto apropiado
        ↓
Muestra badge de modo + fuentes (si aplica)
        ↓
Guarda logs y analytics
```

## 🔧 Archivos Modificados/Creados

### Base de Datos
- `supabase/migrations/create_dual_mode_assistant_system.sql`
  - Tablas de routing logs y analytics
  - Funciones de actualización automática
  - RLS policies

### Servicios del Frontend
- `src/lib/routerService.ts` (NUEVO)
  - Clase `IntelligentRouter` con lógica de 3 capas
  - Reglas de keywords y patrones de intención
  - Cálculo de scores y confianza

- `src/lib/webSearchService.ts` (NUEVO)
  - Integración con Tavily API
  - Formateo de resultados
  - Detección automática de necesidad de búsqueda

- `src/lib/assistantTypes.ts`
  - Agregados: `WebSource`, `modo_usado`, `router_confidence`

### Edge Function
- `supabase/functions/assistant-send-message/index.ts`
  - Integrado router inteligente
  - Búsqueda web con Tavily
  - Logging de decisiones
  - Prompts diferenciados por modo

### Componentes UI
- `src/components/AssistantModal.tsx`
  - Badges de modo
  - Sección de fuentes web
  - Indicador de confianza

- `src/components/AssistantAnalytics.tsx` (NUEVO)
  - Dashboard de métricas
  - Gráficos de distribución
  - Historial de decisiones

## 🚀 Cómo Funciona para el Usuario

### Para Datos del Sistema (MOVI)
**Pregunta:** "¿Cuánto gané en comisiones este mes?"

**Resultado:**
- Router detecta: keywords "comisiones", "gané" → MOVI mode
- Badge: 📊 Datos del Sistema (85% confianza)
- Respuesta con datos reales del usuario

### Para Conocimiento General (ChatGPT)
**Pregunta:** "¿Qué es el coaseguro en seguros de salud?"

**Resultado:**
- Router detecta: intent "EXPLANATION" → ChatGPT mode
- Badge: 🤖 Conocimiento General (92% confianza)
- Respuesta explicativa profesional

### Con Búsqueda Web
**Pregunta:** "¿Cuáles son las tendencias en seguros GMM para 2025?"

**Resultado:**
- Router detecta: "tendencias", "2025" → ChatGPT + Web Search
- Badge: 🤖 Conocimiento General (78% confianza)
- Respuesta enriquecida con información actual
- Sección de fuentes web con 3 artículos relevantes

## 🎛️ Variables de Entorno

Para habilitar búsqueda web, agregar:
```env
TAVILY_API_KEY=tu_api_key_aqui
```

**Nota:** Sin Tavily configurado, el sistema funciona perfectamente pero sin búsqueda web.

## 📈 Mejoras Futuras

1. **Feedback del Usuario**
   - Botones "útil/no útil" en cada respuesta
   - Mejora continua del router basado en feedback

2. **A/B Testing**
   - Probar diferentes umbrales de confianza
   - Optimizar reglas de keywords

3. **Modo Híbrido**
   - Para preguntas complejas que requieren ambos modos
   - Combinar datos del sistema con conocimiento general

4. **Caché de Búsquedas Web**
   - Reducir llamadas a Tavily
   - Mejorar tiempos de respuesta

## ✅ Testing

El sistema ha pasado:
- ✅ Build exitoso sin errores
- ✅ TypeScript sin errores de tipos
- ✅ Migración de BD aplicada correctamente
- ✅ Edge function actualizada y desplegable

## 🎉 Resultado Final

Un asistente verdaderamente inteligente que:
- Decide automáticamente el mejor modo para cada pregunta
- Combina conocimiento general con datos específicos del usuario
- Enriquece respuestas con información actualizada de la web
- Proporciona transparencia total sobre su funcionamiento
- Mejora continuamente con analytics y métricas

**1 Chat, 2 Cerebros = Experiencia de usuario superior**
