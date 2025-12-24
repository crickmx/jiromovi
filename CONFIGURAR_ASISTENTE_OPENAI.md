# Configuración del Asistente con OpenAI

El asistente de MOVI Digital utiliza la API de OpenAI para proporcionar respuestas inteligentes basadas en tus datos reales.

## Problema Actual

El asistente está mostrando mensajes genéricos como:
- "No tengo acceso a tus comisiones"
- "No tengo acceso a tus tareas pendientes"

Esto se debe a que **falta configurar la API Key de OpenAI**.

## Solución

### Paso 1: Obtener tu API Key de OpenAI

1. Ve a https://platform.openai.com/api-keys
2. Inicia sesión o crea una cuenta
3. Haz clic en "Create new secret key"
4. Copia la clave (comienza con `sk-...`)

### Paso 2: Configurar la variable de entorno

Agrega la siguiente línea al archivo `.env` en la raíz del proyecto:

```bash
OPENAI_API_KEY=sk-tu-clave-aqui
```

### Paso 3: Configurar en Supabase

La API key también debe estar disponible en las Edge Functions de Supabase:

1. Ve al dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Edge Functions** → **Secrets**
4. Agrega un nuevo secret:
   - Name: `OPENAI_API_KEY`
   - Value: tu clave que comienza con `sk-...`

## Qué hará el asistente una vez configurado

El asistente podrá acceder y responder sobre:

### ✅ Comisiones
- Tus últimas comisiones
- Total acumulado
- Detalles por póliza

### ✅ Producción
- Tus pólizas emitidas
- Prima total
- Detalles por cliente

### ✅ Tareas CRM
- Tareas pendientes
- Prioridades
- Fechas de vencimiento

### ✅ Contactos
- Tus contactos del CRM
- Estado de cada contacto
- Información de contacto

### ✅ Productos de la Tienda
- Productos disponibles
- Precios
- Categorías

## Correcciones Realizadas

Se corrigieron los siguientes problemas en el código:

1. **Columnas de comisiones**: Ahora usa `movi_user_id` y `commission_neta`
2. **Columnas de producción**: Ahora usa `movi_user_id`
3. **Columnas de tareas**: Ahora usa `creado_por` y `descripcion`
4. **Columnas de contactos**: Ahora usa `creado_por`, `nombre_completo` y `celular`

## Verificar que funciona

Una vez configurada la API key:

1. Abre el asistente desde cualquier página
2. Pregunta: "¿Cuáles son mis tareas pendientes?"
3. El asistente debería responder con tus tareas reales

## Costos de OpenAI

El modelo utilizado es `gpt-4o-mini`, que es muy económico:
- ~$0.15 por 1 millón de tokens de entrada
- ~$0.60 por 1 millón de tokens de salida

Una conversación típica usa ~500 tokens, lo que cuesta menos de $0.001 USD.

## Soporte

Si tienes problemas:
1. Verifica que la API key es correcta
2. Revisa que tienes créditos en tu cuenta de OpenAI
3. Verifica los logs de las Edge Functions en Supabase
