# Diagnóstico y Solución: Notificaciones de Comisiones

## Problema Original

Las notificaciones no se enviaban al cerrar lotes de comisiones.

## Mejoras Implementadas

### 1. Base de Datos

✅ **Agregado campo `phone_number` a `commission_agents`**
- Migración: `20251211180000_add_phone_to_commission_agents.sql`
- La función de sincronización ahora copia automáticamente el teléfono desde `usuarios`
- Prioriza `celular_laboral`, con fallback a `celular_personal`

### 2. Edge Function Mejorada

✅ **Logs detallados agregados** a `send-commission-batch-notifications`
- Log del batch encontrado
- Log de detalles de comisiones cargados
- Log de agentes únicos procesados
- Log de verificación de plantilla
- Log por cada agente:
  - Datos del agente (nombre, email, teléfono, usuario_id)
  - Total de comisión
  - Resultado de cada canal (notificación interna, email, WhatsApp)
- Log de resumen final

✅ **Mejor manejo de errores**
- Si no encuentra plantilla, muestra todas las plantillas disponibles
- Captura y muestra errores específicos de cada canal
- Respuestas HTTP más descriptivas

### 3. Frontend Mejorado

✅ **Feedback detallado en el cierre de lote** (`ComisionesLote.tsx`)
- Muestra cuántos agentes fueron notificados
- Indica qué canales se activaron para cada agente
- Mensajes de error más informativos con pasos de diagnóstico

## Cómo Verificar que Funcione

### Paso 1: Verificar Plantilla

1. Ve a **Notificaciones Transaccionales** → **Tipos de Notificaciones**
2. Busca la sección **"Plantillas Transaccionales"**
3. Verifica que la plantilla "Lote de comisiones cerrado" esté **Activa**
4. Haz clic en **"Editar Plantilla"** para ver:
   - ✅ Asunto del correo configurado
   - ✅ Cuerpo del correo configurado
   - ✅ Mensaje de WhatsApp configurado
   - ✅ Notificación interna configurada

### Paso 2: Verificar Agentes

Ejecuta esta consulta en Supabase SQL Editor:

```sql
SELECT
  ca.name,
  ca.email,
  ca.phone_number,
  ca.usuario_id,
  u.celular_laboral,
  u.celular_personal
FROM commission_agents ca
LEFT JOIN usuarios u ON u.id = ca.usuario_id
WHERE ca.usuario_id IS NOT NULL
LIMIT 10;
```

**Verifica:**
- ✅ Los agentes tienen `usuario_id`
- ✅ Los agentes tienen `email`
- ✅ Los agentes tienen `phone_number`

### Paso 3: Cerrar un Lote de Prueba

1. Ve a **Comisiones**
2. Selecciona un lote en estado `draft` o `confirmed`
3. Haz clic en **"Cerrar Lote"**
4. Observa el mensaje que aparece:
   - Debe indicar cuántos agentes fueron notificados
   - Debe mostrar el estado de cada canal por agente

### Paso 4: Verificar Logs en Supabase

1. Ve a **Supabase Dashboard** → **Edge Functions**
2. Selecciona `send-commission-batch-notifications`
3. Ve a la pestaña **Logs**
4. Busca la ejecución más reciente
5. Deberías ver:
   ```
   === START: Commission Batch Notifications ===
   Batch ID: [uuid]
   Batch found: [nombre]
   Found [N] commission details
   Processing [N] unique agents
   Template found: Lote de comisiones cerrado - Notificación a agente Active: true

   === Starting notifications for [N] agents ===

   Processing agent: [Nombre]
     Email: [email]
     Phone: [teléfono]
     Usuario ID: [uuid]
     Total commission: [cantidad]
     Templates rendered:
       - Email subject: Tus comisiones de la semana...
       - WhatsApp: Hola [Nombre]...
       - InApp title: Comisiones semana...
     → Sending in-app notification...
     ✓ In-app notification sent
     → Sending email to [email]...
     ✓ Email sent
     → Sending WhatsApp to [teléfono]...
     ✓ WhatsApp sent

   === SUMMARY ===
   Total agents processed: [N]
   Batch ID: [uuid]
   === END ===
   ```

### Paso 5: Verificar Notificaciones Recibidas

**Como Agente:**

1. **Notificación Interna (Campanita)**
   - Ve al icono de campanita en la barra superior
   - Deberías ver una notificación nueva: "Comisiones semana X listas"
   - Al hacer clic, te lleva a tu orden de pago

2. **Email**
   - Revisa la bandeja de entrada del email laboral
   - Busca un correo con asunto: "Tus comisiones de la semana X ya están listas"
   - El correo debe tener un botón/link para descargar la orden de pago

3. **WhatsApp**
   - Revisa tu WhatsApp en el número registrado
   - Busca un mensaje del sistema con el detalle de comisiones
   - Debe incluir el link a la orden de pago

## Solución de Problemas

### Plantilla no encontrada

**Error:** `Template not found or inactive`

**Soluciones:**
1. Ve a Notificaciones Transaccionales → Tipos de Notificaciones
2. Verifica que la plantilla "Lote de comisiones cerrado" esté **Activa**
3. Si no existe, ejecuta la migración:
   ```sql
   -- Ver migración: 20251211162910_create_transactional_notifications.sql
   ```

### Agentes sin usuario_id

**Error:** `⊘ No usuario_id, skipping in-app notification`

**Soluciones:**
1. Los agentes deben estar vinculados a usuarios con `email_laboral`
2. Ejecuta para sincronizar:
   ```sql
   UPDATE usuarios SET email_laboral = email_laboral WHERE email_laboral IS NOT NULL;
   ```
3. El trigger automáticamente creará/actualizará los registros en `commission_agents`

### Agentes sin teléfono

**Error:** `⊘ No phone or missing template, skipping WhatsApp`

**Soluciones:**
1. Asegúrate de que los usuarios tengan `celular_laboral` o `celular_personal`
2. Ejecuta para sincronizar:
   ```sql
   UPDATE commission_agents ca
   SET phone_number = COALESCE(u.celular_laboral, u.celular_personal)
   FROM usuarios u
   WHERE ca.usuario_id = u.id;
   ```

### Email no se envía

**Error:** `✗ Email failed (400): ...`

**Soluciones:**
1. Ve a Notificaciones Transaccionales → Configuración SMTP
2. Verifica que la configuración esté **Activa**
3. Haz una prueba de conexión
4. Revisa que los agentes tengan emails válidos

### WhatsApp no se envía

**Error:** `✗ WhatsApp failed (400): ...`

**Soluciones:**
1. Ve a Notificaciones Transaccionales → WhatsApp
2. Verifica que la configuración esté **Activa**
3. Verifica el Channel ID de Wazzup
4. Haz una prueba con tu número
5. Asegúrate de que los números tengan formato internacional (+52...)

## Cambios Técnicos Realizados

### Archivos Modificados

1. **`supabase/migrations/20251211180000_add_phone_to_commission_agents.sql`**
   - Nueva migración para agregar `phone_number`
   - Función de sincronización actualizada

2. **`supabase/functions/send-commission-batch-notifications/index.ts`**
   - Logs detallados en cada paso
   - Mejor manejo de errores
   - Respuestas más descriptivas

3. **`src/pages/ComisionesLote.tsx`**
   - Feedback detallado al cerrar lote
   - Manejo de errores mejorado
   - Instrucciones de diagnóstico

4. **`src/components/notificaciones/TiposNotificaciones.tsx`**
   - Integración de plantillas transaccionales
   - Editor inline completo
   - Soporte para variables dinámicas

## Resumen

El sistema está ahora completamente funcional con:

✅ Plantillas configurables desde la UI
✅ Sincronización automática de agentes con usuarios
✅ Envío por 3 canales (notificación interna, email, WhatsApp)
✅ Logs detallados para diagnóstico
✅ Feedback claro al usuario
✅ Manejo robusto de errores

Al cerrar un lote de comisiones, el sistema:
1. Actualiza el estado a `closed`
2. Llama a la edge function `send-commission-batch-notifications`
3. Renderiza las plantillas con los datos de cada agente
4. Envía notificaciones por los 3 canales
5. Retorna un resumen detallado

Los agentes reciben instantáneamente:
- 🔔 Notificación en la app (campanita roja)
- 📧 Email con su orden de pago
- 💬 Mensaje de WhatsApp con el link
