# Guía: Sistema de Notificaciones Transaccionales de Comisiones

## Descripción General

El sistema de notificaciones transaccionales permite enviar automáticamente notificaciones a los agentes cuando se cierra un lote de comisiones. Las notificaciones se envían por tres canales:

1. **Notificación interna** (campanita en la plataforma)
2. **Correo electrónico**
3. **WhatsApp**

## Ubicación

Para acceder a la configuración de plantillas transaccionales:

1. Ir a **Notificaciones Transaccionales** (solo Administradores)
2. Seleccionar la pestaña **"Tipos de Notificaciones"**
3. En la sección **"Plantillas Transaccionales"** encontrarás las plantillas automáticas

## Plantillas Disponibles

### Lote de comisiones cerrado - Notificación a agente

**Event key:** `commission_batch_closed_agent`

Esta plantilla se dispara automáticamente cuando un administrador cierra un lote de comisiones. Se envía una notificación a cada agente incluido en el lote.

## Variables Dinámicas (Placeholders)

Las plantillas soportan las siguientes variables que se reemplazan automáticamente:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `{{agent_name}}` | Nombre completo del agente | Juan Pérez |
| `{{office_name}}` | Nombre de la oficina del agente | Oficina Centro |
| `{{week_number}}` | Número de semana del lote | 45 |
| `{{period_start}}` | Fecha de inicio del periodo | 1 de noviembre de 2024 |
| `{{period_end}}` | Fecha de fin del periodo | 7 de noviembre de 2024 |
| `{{net_commission_total}}` | Total de comisiones netas | $15,250.00 MXN |
| `{{orden_de_pago_url}}` | URL para descargar el PDF | https://... |

## Cómo Editar una Plantilla

1. En la sección **"Plantillas Transaccionales"**, localiza la plantilla que deseas editar
2. Haz clic en el botón **"Editar Plantilla"**
3. Se abrirá un formulario con los siguientes campos:

### Campos de Edición

#### 1. Asunto del Correo
- Texto corto que aparecerá en la bandeja de entrada
- Ejemplo: `Tus comisiones de la semana {{week_number}} ya están listas`

#### 2. Cuerpo del Correo (HTML)
- Contenido completo del email
- Soporta HTML para formato (negritas, links, colores)
- Ejemplo:
```html
<p>Hola <strong>{{agent_name}}</strong>,</p>
<p>Te informamos que tus comisiones de la semana {{week_number}} han sido calculadas.</p>
<p><strong>Total neto:</strong> ${{net_commission_total}} MXN</p>
<p><a href="{{orden_de_pago_url}}">Descargar Orden de Pago</a></p>
```

#### 3. Mensaje de WhatsApp
- Texto plano (sin HTML)
- Máximo recomendado: 1000 caracteres
- Ejemplo:
```
Hola {{agent_name}} 👋

Tus comisiones de la semana {{week_number}} ya están listas.
Total neto: ${{net_commission_total}} MXN

Ver detalle: {{orden_de_pago_url}}
```

#### 4. Título Notificación Interna
- Texto corto que aparece en la campanita
- Ejemplo: `Comisiones semana {{week_number}} listas`

#### 5. Cuerpo Notificación Interna
- Texto descriptivo para la notificación
- Ejemplo: `Tus comisiones del periodo {{period_start}} al {{period_end}} están disponibles. Total: ${{net_commission_total}} MXN`

### Guardar Cambios

1. Después de editar, haz clic en **"Guardar"**
2. Los cambios se aplicarán inmediatamente
3. La próxima vez que se cierre un lote, se usará la plantilla actualizada

## Activar/Desactivar Plantilla

- Usa el botón **"Activa"** / **"Inactiva"** para controlar si la plantilla está en uso
- Si está **Inactiva**, no se enviarán notificaciones al cerrar lotes
- Por defecto, la plantilla está **Activa**

## Flujo Automático

El proceso completo funciona así:

1. **Administrador cierra un lote** en el módulo de Comisiones
2. **Sistema procesa** el lote y calcula comisiones por agente
3. **Para cada agente:**
   - Se renderiza la plantilla con sus datos específicos
   - Se crea una notificación interna (campanita roja)
   - Se envía un correo electrónico
   - Se envía un mensaje de WhatsApp
4. **Agente recibe** las 3 notificaciones
5. **Agente hace clic** en la notificación → Navega a su orden de pago

## Indicadores Visuales

En la vista de plantillas, verás badges que indican qué canales están configurados:

- 🔵 **Email** - Plantilla de correo configurada
- 🟢 **WhatsApp** - Plantilla de WhatsApp configurada
- 🟡 **InApp** - Notificación interna configurada

## Previsualización

Antes de guardar, puedes revisar cómo se verá la plantilla con las variables reemplazadas. En la sección de edición se muestra una guía con todas las variables disponibles.

## Mejores Prácticas

### Para Correos
- Usa un asunto claro y directo
- Incluye un saludo personalizado con `{{agent_name}}`
- Destaca el total de comisiones
- Incluye un botón o link claro al PDF
- Mantén el diseño simple y legible

### Para WhatsApp
- Mantén el mensaje corto (menos de 1000 caracteres)
- Usa emojis con moderación para hacerlo amigable
- Incluye la información más importante primero
- Asegúrate de incluir el link al PDF

### Para Notificaciones Internas
- Título corto y descriptivo
- Cuerpo con información clave
- Incluye el total de comisiones para llamar la atención

## Solución de Problemas

### Las notificaciones no se envían
- Verifica que la plantilla esté **Activa**
- Revisa que la configuración de SMTP y WhatsApp esté correcta
- Verifica que los agentes tengan email y teléfono registrados

### Las variables no se reemplazan
- Asegúrate de usar la sintaxis correcta: `{{variable}}`
- Las variables son case-sensitive (distinguen mayúsculas/minúsculas)
- Verifica que no haya espacios extra dentro de las llaves

### El formato del correo se ve mal
- Revisa que el HTML esté bien formado
- Prueba primero con HTML simple antes de agregar estilos complejos
- Algunos clientes de correo no soportan CSS avanzado

## Extensión Futura

Este sistema está diseñado para soportar más eventos transaccionales en el futuro. Se pueden agregar nuevas plantillas para:

- Aprobación de vacaciones
- Cambios en trámites
- Nuevos comunicados importantes
- Actualizaciones de pedidos en Store
- Y más...

Cada evento tendría sus propias variables específicas.
