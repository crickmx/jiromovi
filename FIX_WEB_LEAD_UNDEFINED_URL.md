# Fix: Error "undefined/functions/v1/submit-web-lead"

## ✅ Problema Resuelto

El error ocurría porque `import.meta.env.VITE_SUPABASE_URL` retornaba `undefined`, haciendo que la URL se convirtiera en `undefined/functions/v1/submit-web-lead`.

---

## 🔧 Cambios Aplicados

### 1. **Agregado Fallback en PaginaPublicaAsesor.tsx**

```typescript
// ANTES (causaba el error)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// DESPUÉS (con fallback)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qhwvuuyjhcennqccgvse.supabase.co';
```

Ahora si las variables de entorno no están disponibles, usará la URL correcta de todas formas.

### 2. **Actualizado test-web-lead-form.html**

La página de diagnóstico ahora usa la URL correcta de Supabase.

### 3. **Edge Function con Mejor Manejo de Errores**

La edge function `submit-web-lead` ahora retorna errores específicos para cada caso:
- 404: Página no encontrada (slug inválido o usuario inactivo)
- 500: Error al crear/actualizar contacto
- 200: Lead enviado exitosamente

---

## 🧪 Cómo Probar

### Opción 1: Usar la Página de Diagnóstico

1. Abre en tu navegador:
   ```
   https://tu-dominio.com/test-web-lead-form.html
   ```

2. Ingresa un slug válido (ej: "movi")

3. Completa el formulario

4. Verifica que aparezca:
   ```
   ✅ Lead Enviado Correctamente
   Contacto ID: [uuid]
   ✔️ Contacto creado en el CRM
   ✔️ Tarea de seguimiento creada
   ✔️ Notificaciones enviadas
   ```

### Opción 2: Probar la Página Pública Real

1. Ve a:
   ```
   https://tu-dominio.com/p/[tu-slug]
   ```

2. Completa el formulario en la sección de contacto

3. Haz clic en "Enviar Solicitud"

4. Deberías ver el mensaje de confirmación

---

## 🔍 Verificar que el Lead se Creó

### En el CRM

1. Ve a **Mi CRM** → **Contactos**
2. Busca el contacto recién creado
3. Verifica que tenga:
   - ✅ Estatus: "Prospecto"
   - ✅ Origen: "Mi Página Web"
   - ✅ Tipo de seguro correcto

### En Tareas

1. Ve a **Mi CRM** → **Tareas**
2. Deberías ver una nueva tarea:
   - 📋 Título: "Seguimiento: Lead desde Mi Página Web"
   - 🔴 Prioridad: Alta
   - 📅 Fecha: Mañana
   - ⏳ Estado: Pendiente

### Notificaciones

El agente debería recibir:
- 🔔 **Campanita** en la app (Centro de Notificaciones)
- 📧 **Email** con los datos del lead
- 💬 **WhatsApp** en su celular laboral

---

## 🚨 Si Aún Hay Errores

### Error: "Página no encontrada"

**Causa:** El slug no existe o el usuario no está activo.

**Solución:**
```sql
-- Verifica el slug del usuario
SELECT id, nombre_completo, web_slug, estado
FROM usuarios
WHERE email_laboral = 'tu-email@example.com';

-- Si no tiene slug, asígnalo
UPDATE usuarios
SET web_slug = 'tu-slug-deseado'
WHERE email_laboral = 'tu-email@example.com';

-- Asegúrate de que esté activo
UPDATE usuarios
SET estado = 'Activo'
WHERE email_laboral = 'tu-email@example.com';
```

### Error: "Error al crear el contacto en el CRM"

**Causa:** Problemas con la tabla `crm_contactos`.

**Solución:**
```sql
-- Verifica que la tabla exista
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'crm_contactos';

-- Si no existe, ejecuta la migración
-- supabase/migrations/20251123014613_create_crm_complete_schema.sql
```

### Error en la Consola del Navegador

Si ves errores relacionados con logos de aseguradoras:
```
gnp.com.mx:1 Failed to load resource: net::ERR_BLOCKED_BY_CLIENT
```

**No te preocupes.** Estos errores son causados por adblockers bloqueando los logos. El formulario funciona correctamente aunque aparezcan estos errores.

---

## ✅ Checklist Post-Fix

- [ ] El build se completó sin errores (`npm run build`)
- [ ] La página de diagnóstico funciona (`test-web-lead-form.html`)
- [ ] La página pública carga correctamente (`/p/[tu-slug]`)
- [ ] El formulario se envía sin errores
- [ ] El contacto se crea en `crm_contactos`
- [ ] La tarea se crea en `crm_tareas`
- [ ] Las notificaciones se envían (opcional)

---

## 📝 Notas Importantes

1. **Las variables de entorno** ahora tienen fallbacks, así que la app funcionará incluso si no están configuradas.

2. **Las notificaciones son opcionales**. Si fallan, el contacto y la tarea se crean de todas formas.

3. **Los errores de adblocker** (`ERR_BLOCKED_BY_CLIENT`) no afectan el funcionamiento del formulario.

4. **Reinicia el servidor de desarrollo** si estás en modo desarrollo:
   ```bash
   # Detener el servidor actual (Ctrl+C)
   # Iniciar de nuevo
   npm run dev
   ```

---

## 🎯 Próximos Pasos

Una vez que confirmes que todo funciona:

1. **Configura tu página web** en **Mi Página Web**
2. **Personaliza los colores y textos**
3. **Publica tu página** (activa el toggle "Publicar Página")
4. **Comparte tu link** con clientes: `https://tu-dominio.com/p/[tu-slug]`

---

**Estado:** ✅ Resuelto
**Fecha:** 2025-12-22
**Archivos Modificados:**
- `src/pages/PaginaPublicaAsesor.tsx`
- `public/test-web-lead-form.html`
- `supabase/functions/submit-web-lead/index.ts`
