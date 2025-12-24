# Mi Asistente - Cerebro Inteligente de MOVI Digital

## Visión General

Mi Asistente es un asistente conversacional inteligente integrado en MOVI Digital que ayuda a los agentes de seguros con sus tareas diarias. Utiliza inteligencia artificial para proporcionar respuestas contextuales, realizar análisis de datos y guiar a los usuarios a través de la plataforma.

## Características Principales

### 1. Interfaz Conversacional
- **Botón flotante** siempre visible en la esquina inferior derecha
- **Badge de notificaciones** que muestra eventos no leídos
- **Modal de chat** con interfaz limpia y profesional
- **Historial de conversaciones** persistente con recuperación automática

### 2. Conciencia Contextual
- **Detección automática de módulo** basada en la ruta actual
- **Snapshots de contexto** que capturan el estado actual del usuario
- **Sugerencias dinámicas** que cambian según la página actual
- **Continuación de conversaciones** del mismo módulo en 24 horas

### 3. 12 Intents MVP

#### Intent 1: Dashboard Summary
- **Propósito**: Resumen ejecutivo con KPIs principales
- **Trigger**: "¿Cómo voy hoy?", "Resumen general"
- **Respuesta**: Tarjetas con producción, comisiones, tareas, renovaciones
- **Acciones**: Navegar a módulos específicos

#### Intent 2: Performance Summary
- **Propósito**: Análisis de desempeño y tendencias
- **Trigger**: "Mi desempeño", "¿Cómo va mi producción?"
- **Respuesta**: Gráficas de tendencia, tabla comparativa, insights
- **Acciones**: Ver producción detallada, oportunidades de venta

#### Intent 3: Commission Explain
- **Propósito**: Desglose detallado de comisiones
- **Trigger**: "Explícame mi comisión", "¿Cómo se calculó?"
- **Respuesta**: Tabla con conceptos, explicación de variaciones
- **Acciones**: Ver todas las comisiones, copiar desglose

#### Intent 4: Commission Anomaly Detect
- **Propósito**: Detectar comisiones atípicas
- **Trigger**: "¿Hay errores?", "Comisiones atípicas"
- **Respuesta**: Lista de anomalías con desviación y razones
- **Acciones**: Ver comisiones, crear trámite

#### Intent 5: Daily Priorities
- **Propósito**: Lista priorizada de tareas del día
- **Trigger**: "¿Qué debo hacer hoy?", "Mis prioridades"
- **Respuesta**: Lista con tareas vencidas, renovaciones, seguimientos
- **Acciones**: Ver tareas, ver trámites

#### Intent 6: Client Outreach Plan
- **Propósito**: Identificar clientes prioritarios
- **Trigger**: "¿A quién contactar?", "Plan de contacto"
- **Respuesta**: Lista de clientes con razón de contacto y producto sugerido
- **Acciones**: Ver contactos CRM

#### Intent 7: Cross-Sell Opportunities
- **Propósito**: Sugerir productos adicionales
- **Trigger**: "Oportunidades de venta", "¿Qué más vender?"
- **Respuesta**: Lista de clientes con productos actuales y sugeridos
- **Acciones**: Ver contactos CRM

#### Intent 8: Renewals Forecast
- **Propósito**: Pólizas próximas a vencer
- **Trigger**: "Renovaciones próximas", "¿Quién va a renovar?"
- **Respuesta**: Lista de pólizas con fecha de vencimiento y prima
- **Acciones**: Contactar cliente

#### Intent 9: Message Generator
- **Propósito**: Crear mensajes personalizados
- **Trigger**: "Genera mensaje", "WhatsApp para cliente"
- **Respuesta**: Mensaje pre-escrito con variables personalizadas
- **Acciones**: Copiar mensaje, ir a WhatsApp

#### Intent 10: Tramite Status Helper
- **Propósito**: Estado de trámites y siguientes pasos
- **Trigger**: "Estado del trámite", "¿Qué sigue?"
- **Respuesta**: Timeline visual, siguiente paso sugerido
- **Acciones**: Ver trámite, actualizar estatus

#### Intent 11: Team Insights Manager
- **Propósito**: Análisis del equipo (solo gerentes)
- **Trigger**: "Desempeño del equipo", "Comparar agentes"
- **Respuesta**: Tabla comparativa con gráfica de barras
- **Acciones**: Ver producción por vendedor

#### Intent 12: Navigation Help
- **Propósito**: Ayuda para navegar
- **Trigger**: "¿Cómo navego?", "¿Dónde está...?"
- **Respuesta**: Grid de botones organizados por categoría
- **Acciones**: Navegar a diferentes módulos

### 4. Sugerencias Contextuales

#### Dashboard
1. ¿Qué debo hacer hoy primero?
2. ¿Cómo voy hoy y esta semana?
3. Explícame mi última comisión
4. ¿A quién debo contactar para vender hoy?
5. ¿Tengo renovaciones próximas?

#### Mis Comisiones
1. Explícame mi última comisión
2. ¿Qué comisiones son atípicas?
3. ¿Cómo voy vs mi promedio?
4. Genera reporte de comisiones
5. ¿Por qué mi comisión bajó este mes?

#### Mi Producción
1. ¿Cómo va mi producción este mes?
2. ¿Cuál es mi tendencia de ventas?
3. ¿Qué ramo me genera más producción?
4. ¿Cómo me comparo con mis metas?
5. ¿Con qué aseguradora vendo más?

#### Mi CRM - Contactos
1. ¿Qué contactos debo llamar hoy?
2. ¿Quiénes están por renovar?
3. Oportunidades de venta cruzada
4. ¿Quiénes están inactivos hace tiempo?
5. Genera plan de contacto semanal

#### Mi CRM - Tareas
1. ¿Qué tareas tengo pendientes hoy?
2. ¿Cuáles están vencidas?
3. Prioriza mis pendientes
4. ¿Qué debo hacer primero?
5. Resumen de tareas de la semana

#### Trámites
1. ¿Qué trámites están pendientes?
2. ¿Cuáles tardan más de lo normal?
3. ¿Qué debo actualizar?
4. Estado general de mis trámites
5. ¿Alguno requiere atención urgente?

### 5. Sistema de Snapshots

Los snapshots capturan el contexto del usuario para proporcionar respuestas precisas:

#### Snapshot Base (todos los módulos)
```json
{
  "usuario": {
    "id": "uuid",
    "nombre": "string",
    "rol": "string",
    "oficina_nombre": "string"
  },
  "ruta": "string",
  "parametros": {},
  "modulo": "string",
  "timestamp": "ISO string"
}
```

#### Snapshot de Comisiones
- Últimas 10 comisiones
- Resumen del mes actual
- Comisión seleccionada (si hay ID en ruta)

#### Snapshot de Producción
- Total del mes actual
- Tendencia últimos 3 meses
- Top 5 ramos por prima neta

#### Snapshot de CRM
- 10 tareas pendientes
- 10 renovaciones próximas (30 días)
- Contacto actual (si hay ID en ruta)

#### Snapshot de Trámites
- Trámites activos (no completados)
- Trámite actual (si hay ID en ruta)
- Estadísticas por tipo

#### Snapshot de Dashboard
- Total comisiones del mes
- Total producción del mes
- Tareas de hoy
- Renovaciones próximas (30 días)

### 6. Clasificación Híbrida de Intents

**Nivel 1 - Intent Explícito** (0ms, gratis)
- Mensaje viene de click en sugerencia o botón de acción
- Intent predefinido por el sistema

**Nivel 2 - Ruta + Keywords** (0ms, gratis)
- Combina ruta actual con palabras clave del mensaje
- Ejemplo: "/mis-comisiones" + "explica" = commission_explain

**Nivel 3 - Keyword Dictionary** (0ms, gratis)
- Diccionario de 50+ keywords mapeados a intents
- "producción" → performance_summary
- "renovación" → renewals_forecast

**Nivel 4 - IA Classifier** (500ms, $0.0001)
- Llamada a GPT-4o-mini solo si no hay match anterior
- Clasificación entre 12 intents posibles

**Nivel 5 - Fallback**
- Si hay ambigüedad, usar navigation_help
- Mostrar sugerencias contextuales

### 7. Respuestas Estructuradas

Todos los intents retornan JSON estructurado con estos tipos:

- **dashboard_summary**: KPIs con iconos, valores, tendencias
- **performance_summary**: Gráficas + tablas + insights textuales
- **commission_explain**: Tabla de conceptos + explicación
- **commission_anomaly**: Lista de anomalías con desviación
- **priority_list**: Items con prioridad (alta/media/baja)
- **outreach_plan**: Clientes con razón y producto sugerido
- **cross_sell**: Oportunidades con score y razón
- **renewals_forecast**: Pólizas con fecha y prima
- **message_generator**: Mensaje + variables + botón copiar
- **tramite_status**: Timeline + siguiente paso
- **team_insights**: Tabla + gráfica del equipo
- **navigation_help**: Categorías con botones de navegación
- **text**: Respuesta en texto plano con acciones opcionales

### 8. Acciones y Deep Links

**Tipos de Acciones:**
- **navigate**: Navega a una ruta
- **navigate-with-id**: Navega con parámetro dinámico
- **copy**: Copia texto al portapapeles
- **execute-intent**: Ejecuta otro intent
- **dismiss**: Marca evento como leído
- **download**: Descarga archivo (futuro)
- **external**: Abre URL externa

**Analytics:**
Todas las acciones se registran en `assistant_action_clicks` para métricas.

### 9. Gestión de Conversaciones

- **Continuación automática**: Si existe conversación del módulo en últimas 24h, la recupera
- **Múltiples conversaciones**: Puede tener conversaciones de diferentes módulos simultáneamente
- **Historial persistente**: Últimas 20 conversaciones con preview
- **Títulos auto-generados**: Basados en el primer mensaje del usuario
- **Eliminación selectiva**: Puede eliminar conversaciones individuales

### 10. Sistema de Eventos Proactivos

Base preparada para futuras capacidades proactivas:

**Tipos de Eventos:**
- `comision_atipica`: Comisión >30% diferente al promedio
- `produccion_baja`: Producción <70% del promedio
- `renovacion_proxima`: Póliza vence en 7 días
- `tramite_estancado`: Trámite sin cambios >7 días
- `tarea_vencida`: Tarea pasó fecha de vencimiento

**Prioridades:**
- Alta: Requiere acción inmediata
- Media: Importante pero no urgente
- Baja: Informativo

## Arquitectura Técnica

### Base de Datos

**Tablas Principales:**
- `assistant_intents`: Catálogo de 12 intents
- `assistant_snapshots`: Cache de contexto (TTL 5 min)
- `assistant_suggestions`: Sugerencias por ruta
- `assistant_events`: Eventos detectados
- `assistant_actions`: Acciones disponibles
- `assistant_action_clicks`: Analytics de acciones

**Extensiones:**
- `conversaciones_chatgpt`: Campo `es_asistente`, `modulo_origen`, `intent_detectado`
- `mensajes_chatgpt`: Campo `respuesta_estructurada_json`, `tiene_acciones`

### Frontend

**Servicios:**
- `assistantService.ts`: Comunicación con backend
- `snapshotBuilder.ts`: Construcción de snapshots
- `intentMapper.ts`: Clasificación de intents
- `suggestionsService.ts`: Obtención de sugerencias

**Componentes:**
- `AssistantProvider`: Contexto global
- `FloatingAssistantButton`: Botón flotante con badge
- `AssistantModal`: Modal de chat principal
- `ResponseMessage`: Orquestador de respuestas
- 11 componentes de respuesta especializados

### Backend

**Edge Function:**
- `assistant-send-message`: Orquesta todo el flujo
- Clasifica intent
- Llama a OpenAI con prompt apropiado
- Parsea respuesta JSON
- Guarda mensaje en BD
- Retorna respuesta estructurada

## Configuración

### Variables de Entorno

```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Nota**: Si no hay `OPENAI_API_KEY`, el sistema usa respuestas fallback.

### Límites

- **Mensajes por día**: 50 por usuario
- **Tamaño de snapshot**: Máximo 30KB
- **Longitud de mensaje**: Máximo 2000 caracteres
- **TTL de snapshot**: 5 minutos
- **Recuperación de conversación**: 24 horas

### Costos Estimados

- **Clasificación híbrida**: 80% sin IA = $0
- **Llamada a OpenAI**: ~$0.001 por mensaje
- **Costo promedio por conversación**: ~$0.01

## Uso

### Para Usuarios

1. **Abrir asistente**: Click en botón flotante azul
2. **Ver sugerencias**: 5 sugerencias contextuales al abrir
3. **Hacer pregunta**: Escribir en lenguaje natural
4. **Ejecutar acciones**: Click en botones de acciones
5. **Ver historial**: Click en "Historial" para conversaciones anteriores
6. **Nueva conversación**: Click en "+" para empezar de cero

### Para Administradores

1. **Agregar sugerencias**:
```sql
INSERT INTO assistant_suggestions (intent_codigo, ruta_pattern, orden, texto_pregunta)
VALUES ('commission_explain', '/mis-comisiones', 1, '¿Por qué bajó mi comisión?');
```

2. **Crear eventos proactivos**:
```sql
INSERT INTO assistant_events (usuario_id, tipo_evento, titulo, descripcion, prioridad)
VALUES ('uuid', 'comision_atipica', 'Comisión atípica detectada', 'Tu comisión de enero es 40% menor al promedio', 'alta');
```

3. **Ver analytics**:
```sql
SELECT tipo_accion, COUNT(*)
FROM assistant_action_clicks
GROUP BY tipo_accion
ORDER BY COUNT(*) DESC;
```

## Roadmap Futuro

### Fase 2: Capacidades Proactivas
- Detección automática de eventos
- Notificaciones push cuando se detectan anomalías
- Recordatorios inteligentes basados en patrones
- Predicción de renovaciones con baja probabilidad

### Fase 3: Capacidades Avanzadas
- Generación de PDFs personalizados
- Análisis predictivo con ML
- Integración con calendarios
- Comandos por voz

### Fase 4: Personalización
- Aprendizaje de preferencias del usuario
- Respuestas personalizadas por rol
- Métricas custom por oficina
- Dashboards personalizados

## Troubleshooting

### El asistente no responde
- Verificar que existe `OPENAI_API_KEY` en variables de entorno
- Revisar logs de Edge Function `assistant-send-message`
- Verificar que usuario tiene conversación activa

### Sugerencias no aparecen
- Verificar que existen sugerencias para la ruta en `assistant_suggestions`
- Revisar que campo `activo = true`
- Verificar que rol del usuario coincide con `rol_requerido`

### Badge de eventos no actualiza
- Verificar polling cada 60 segundos en `AssistantProvider`
- Revisar que eventos tienen `leido = false`
- Verificar RLS policies en `assistant_events`

## Soporte

Para reportar issues o sugerir mejoras, contactar al equipo de desarrollo de MOVI Digital.

---

**Versión**: 1.0.0
**Última actualización**: Diciembre 2024
**Autor**: Equipo MOVI Digital
