# Troubleshooting - Sistema de Leads Web

## 🔍 Diagnóstico del Error

Si ves el mensaje "Error al enviar la solicitud", sigue estos pasos para identificar la causa:

---

## 📝 Paso 1: Usar la Página de Diagnóstico

Abre en tu navegador:
```
https://tu-dominio.com/test-web-lead-form.html
```

Esta página te mostrará:
- ✅ El error exacto que está ocurriendo
- ✅ La respuesta completa de la API
- ✅ Los datos que se están enviando

---

## 🛠️ Paso 2: Verificar la Consola del Navegador

1. Abre las **DevTools** (F12)
2. Ve a la pestaña **Console**
3. Busca mensajes que digan:
   - `Error response:` → Te dirá qué falló exactamente
   - `Error submitting lead:` → Te mostrará el error completo

---

## 🔐 Paso 3: Verificar Permisos RLS

La edge function usa `service_role`, pero verifica que existan las tablas:

### Verificar que las tablas CRM existan:

```sql
-- Ejecuta en Supabase SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('crm_contactos', 'crm_tareas');
```

Deberías ver:
- `crm_contactos`
- `crm_tareas`

### Verificar que la función de notificaciones exista:

```sql
-- Ejecuta en Supabase SQL Editor
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'enviar_notificacion_completa';
```

Deberías ver:
- `enviar_notificacion_completa`

---

## 📊 Paso 4: Verificar Datos del Usuario

Verifica que el usuario tenga un slug configurado:

```sql
-- Reemplaza 'tu-slug' con el slug que estás probando
SELECT id, nombre_completo, web_slug, estado
FROM usuarios
WHERE web_slug = 'tu-slug';
```

Verifica que:
- ✅ El usuario existe
- ✅ `estado` = 'Activo'
- ✅ `web_slug` no es NULL

---

## 🌐 Paso 5: Verificar que la Página Esté Publicada

```sql
-- Reemplaza el ID con el del usuario
SELECT is_published, primary_color, secondary_color
FROM web_page_config
WHERE user_id = 'uuid-del-usuario';
```

Verifica que:
- ✅ `is_published` = true
- ✅ Los colores estén configurados

---

## 🚨 Errores Comunes y Soluciones

### Error: "Página no encontrada"

**Causa:** El slug no existe o el usuario no está activo.

**Solución:**
1. Verifica que el slug sea correcto
2. Verifica que el usuario tenga `estado = 'Activo'`
3. Ve a **Mi Página Web** y verifica el slug asignado

---

### Error: "Error al crear el contacto en el CRM"

**Causa:** Problemas con la tabla `crm_contactos`.

**Solución:**
```sql
-- Verifica que la tabla tenga las columnas correctas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'crm_contactos'
ORDER BY ordinal_position;
```

Columnas requeridas:
- `usuario_id` (uuid)
- `nombre` (text)
- `celular` (text)
- `email` (text)
- `estatus` (text)
- `tipo_seguro` (text)
- `origen` (text)
- `ultima_interaccion` (timestamptz)

---

### Error: "Error al actualizar el contacto"

**Causa:** Contacto duplicado con problemas de RLS.

**Solución:**
La edge function usa `service_role`, así que no debería haber problemas de RLS. Verifica los logs de la edge function:

1. Ve a **Supabase Dashboard**
2. **Edge Functions** → **submit-web-lead**
3. **Logs**
4. Busca errores recientes

---

### Error: Notificaciones no se envían

**Causa:** La función `enviar_notificacion_completa` falla.

**Solución:**
Las notificaciones **no bloquean** el flujo. Si el contacto y la tarea se crean correctamente, las notificaciones son opcionales.

Verifica que la plantilla exista:
```sql
SELECT event_key, name, is_active
FROM transactional_notification_templates
WHERE event_key = 'web_lead_nuevo';
```

---

## 🧪 Paso 6: Probar Manualmente la Edge Function

Usa `curl` o Postman para probar directamente:

```bash
curl -X POST https://kuiddbhsjfxbvyebvxdc.supabase.co/functions/v1/submit-web-lead \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "tu-slug",
    "nombre": "Juan Pérez",
    "celular": "5551234567",
    "email": "juan@example.com",
    "seguro_interes": "Autos"
  }'
```

Respuesta esperada:
```json
{
  "success": true,
  "message": "Solicitud recibida exitosamente",
  "contactId": "uuid-del-contacto"
}
```

---

## 📋 Checklist de Verificación

Antes de contactar soporte, verifica:

- [ ] El slug del usuario existe y está configurado
- [ ] El usuario está activo (`estado = 'Activo'`)
- [ ] La página está publicada (`is_published = true`)
- [ ] Las tablas `crm_contactos` y `crm_tareas` existen
- [ ] La función `enviar_notificacion_completa` existe
- [ ] La plantilla `web_lead_nuevo` existe y está activa
- [ ] La edge function `submit-web-lead` está desplegada
- [ ] La consola del navegador muestra el error exacto
- [ ] La página de diagnóstico `test-web-lead-form.html` funciona

---

## 🆘 Si Todo Falla

Si después de seguir todos los pasos el problema persiste:

1. **Copia el error completo** de la consola del navegador
2. **Toma captura** del mensaje de error
3. **Verifica los logs** de la edge function en Supabase
4. **Contacta soporte** con:
   - El error exacto
   - El slug que estás usando
   - Los logs de la edge function
   - Resultado de las queries SQL de verificación

---

## ✅ Verificación Post-Fix

Después de resolver el problema, verifica que:

1. El formulario se envía sin errores
2. Aparece el mensaje de confirmación
3. El contacto se crea en `crm_contactos`
4. La tarea se crea en `crm_tareas`
5. Las notificaciones se envían (opcional)
6. El agente ve:
   - 🔔 Campanita en la app
   - 📧 Email en su bandeja
   - 💬 WhatsApp en su celular

---

**Nota:** La edge function está configurada para **NO fallar** si las notificaciones no se pueden enviar. El objetivo principal es crear el contacto y la tarea en el CRM.
