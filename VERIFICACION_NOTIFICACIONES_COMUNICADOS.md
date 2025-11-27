# Verificación de Notificaciones para Comunicados

## Resultado: ✅ SISTEMA FUNCIONANDO CORRECTAMENTE

El sistema de notificaciones para comunicados **está funcionando perfectamente**. Las notificaciones se envían tanto por campanita como por WhatsApp según lo esperado.

---

## Prueba Realizada

### Comunicado de Prueba
- **ID:** `587440a5-147e-4f9f-a744-a6ffad0cbb62`
- **Título:** "Comunicado Demo MOVI"
- **Creado por:** Christofer Cruz-Chousal
- **Fecha:** 2025-11-27 01:26:28
- **Visibilidad:** Para todos (para_todos = true)

---

## Resultados de la Verificación

### 1. Usuarios Activos en el Sistema

```sql
SELECT id, nombre, apellidos, celular_laboral, celular_personal
FROM usuarios
WHERE estado = 'activo';
```

**Total: 5 usuarios activos**

| Usuario | Celular Laboral | Celular Personal | Tiene Teléfono |
|---------|----------------|------------------|----------------|
| Agente Demo | - | - | ❌ No |
| Alejandra Abarca | 4421770611 | 5537023203 | ✅ Sí |
| Christofer Prueba | 5520206922 | 5520206922 | ✅ Sí |
| Christofer Cruz-Chousal (creador) | 5520206922 | - | ✅ Sí (excluido) |
| Criso Gte | - | - | ❌ No |

---

### 2. Notificaciones Campanita (Enviadas)

```sql
SELECT COUNT(*) FROM notificaciones
WHERE created_at > '2025-11-27 01:26:00'
AND modulo = 'Comunicados';

-- Resultado: 4 notificaciones
```

**✅ Total: 4 campanitas enviadas**

| Usuario | Título | Mensaje | Acción URL |
|---------|--------|---------|-----------|
| Agente Demo | Nuevo comunicado: Comunicado Demo MOVI | Se ha publicado un nuevo comunicado... | /comunicados/587440... |
| Alejandra Abarca | Nuevo comunicado: Comunicado Demo MOVI | Se ha publicado un nuevo comunicado... | /comunicados/587440... |
| Christofer Prueba | Nuevo comunicado: Comunicado Demo MOVI | Se ha publicado un nuevo comunicado... | /comunicados/587440... |
| Criso Gte | Nuevo comunicado: Comunicado Demo MOVI | Se ha publicado un nuevo comunicado... | /comunicados/587440... |

**Observación:** El creador (Christofer Cruz-Chousal) NO recibió notificación. ✅ **Correcto**

---

### 3. Notificaciones WhatsApp (Enviadas)

```sql
SELECT COUNT(*) FROM correo_historial_envios
WHERE created_at > '2025-11-27 01:26:00'
AND tipo_notificacion_codigo = 'notificacion_individual'
AND canal_envio = 'whatsapp';

-- Resultado: 2 mensajes de WhatsApp
```

**✅ Total: 2 WhatsApp enviados**

| Usuario | Número Destino | Estado | Error |
|---------|---------------|--------|-------|
| Alejandra Abarca | 5214421770611 | ✅ enviado | - |
| Christofer Prueba | 5215520206922 | ✅ enviado | - |

**Observación:** Solo se enviaron WhatsApp a usuarios con teléfono configurado. ✅ **Correcto**

---

## Análisis del Comportamiento

### ¿Por qué solo 2 WhatsApp y 4 campanitas?

**Respuesta: Esto es el comportamiento CORRECTO.**

#### Lógica del Sistema:

1. **Campanita (notificación interna):**
   - Se envía a TODOS los usuarios que cumplen visibilidad
   - Excepto el creador del comunicado
   - **NO requiere** teléfono

2. **WhatsApp:**
   - Se envía solo a usuarios que tienen **celular_laboral** o **celular_personal**
   - Prioriza celular_laboral
   - Fallback a celular_personal
   - Si no tiene ninguno: **NO se envía** (no falla, simplemente omite)

#### Resumen de Envíos:

| Usuario | Campanita | WhatsApp | Razón |
|---------|-----------|----------|-------|
| Christofer Cruz-Chousal | ❌ | ❌ | Creador del comunicado |
| Agente Demo | ✅ | ❌ | Sin teléfono configurado |
| Alejandra Abarca | ✅ | ✅ | Tiene teléfono (4421770611) |
| Christofer Prueba | ✅ | ✅ | Tiene teléfono (5520206922) |
| Criso Gte | ✅ | ❌ | Sin teléfono configurado |

**Total Esperado:**
- Campanitas: 4 de 5 usuarios ✅
- WhatsApp: 2 de 4 notificados ✅

---

## Código de la Función RPC

### Función: `enviar_notificacion_individual`

```sql
-- Prioridad de teléfonos
v_telefono := COALESCE(
  NULLIF(v_user_record.celular_laboral, ''),
  NULLIF(v_user_record.celular_personal, '')
);

-- Validación antes de enviar WhatsApp
IF p_enviar_whatsapp AND v_telefono IS NOT NULL AND LENGTH(v_telefono) >= 10 THEN
  -- Enviar WhatsApp
  SELECT INTO v_request_id net.http_post(...)
END IF;
```

**Características:**
- ✅ No falla si usuario no tiene teléfono
- ✅ Campanita siempre se crea
- ✅ WhatsApp es opcional según disponibilidad

---

## Código del Editor de Comunicados

### Archivo: `src/pages/ComunicadoEditor.tsx`

```typescript
// Líneas 371-393
// Crear notificaciones con WhatsApp automático
const linkComunicado = `${window.location.origin}/comunicados/${comunicadoId}`;

for (const userId of destinatarios) {
  const { data: userData } = await supabase
    .from('usuarios')
    .select('nombre, apellidos')
    .eq('id', userId)
    .single();

  if (userData) {
    await supabase.rpc('enviar_notificacion_individual', {
      p_user_id: userId,
      p_titulo: `Nuevo comunicado: ${titulo}`,
      p_mensaje: `Se ha publicado un nuevo comunicado que puede ser de tu interés. ${linkComunicado}`,
      p_modulo: 'Comunicados',
      p_accion_url: `/comunicados/${comunicadoId}`,
      p_enviar_whatsapp: true // ✅ WhatsApp activado
    });
  }
}
```

---

## Flujo Completo Verificado

### 1. Usuario crea comunicado
- ✅ Título: "Comunicado Demo MOVI"
- ✅ Visibilidad: Para todos

### 2. Sistema determina destinatarios
- ✅ 5 usuarios activos
- ✅ Excluye creador = 4 destinatarios

### 3. Para cada destinatario
- ✅ Crea notificación (campanita)
- ✅ Llama `enviar_notificacion_individual` con `p_enviar_whatsapp: true`

### 4. Función RPC ejecuta
- ✅ Inserta notificación en tabla `notificaciones`
- ✅ Verifica si usuario tiene teléfono
- ✅ Si tiene: envía WhatsApp vía `net.http_post`
- ✅ Si no tiene: continúa sin error

### 5. Edge Function procesa WhatsApp
- ✅ Busca configuración activa
- ✅ Busca plantilla `notificacion_individual`
- ✅ Reemplaza variables
- ✅ Normaliza número (agrega +521)
- ✅ Envía a Wazzup24
- ✅ Registra en `correo_historial_envios`

### 6. Resultado Final
- ✅ 4 usuarios reciben campanita
- ✅ 2 usuarios reciben WhatsApp
- ✅ 2 usuarios sin teléfono solo reciben campanita
- ✅ Creador no recibe nada

---

## Validación de Datos en Base de Datos

### Notificaciones Creadas

```sql
SELECT usuario_id, titulo, modulo, accion_url
FROM notificaciones
WHERE modulo = 'Comunicados'
AND created_at > '2025-11-27 01:26:00'
ORDER BY created_at DESC;

-- 4 registros con título "Nuevo comunicado: Comunicado Demo MOVI"
```

### Historial de WhatsApp

```sql
SELECT
  destinatario_nombre,
  numero_destino,
  estado,
  canal_envio
FROM correo_historial_envios
WHERE tipo_notificacion_codigo = 'notificacion_individual'
AND created_at > '2025-11-27 01:26:00';

-- 2 registros:
-- Alejandra (5214421770611) - enviado
-- Christofer (5215520206922) - enviado
```

### Visibilidad del Comunicado

```sql
SELECT
  comunicado_id,
  para_todos,
  rol,
  oficina_id
FROM comunicados_visibilidad
WHERE comunicado_id = '587440a5-147e-4f9f-a744-a6ffad0cbb62';

-- para_todos: true
-- rol: NULL
-- oficina_id: NULL
```

---

## Plantilla WhatsApp Utilizada

### Tipo: `notificacion_individual`

```
🔔 *{{titulo}}*

{{mensaje}}

📂 Módulo: {{modulo}}

---
Mensaje desde www.movi.digital
```

### Mensaje Real Enviado:

```
🔔 *Nuevo comunicado: Comunicado Demo MOVI*

Se ha publicado un nuevo comunicado que puede ser de tu interés.
https://...io/comunicados/587440a5-147e-4f9f-a744-a6ffad0cbb62

📂 Módulo: Comunicados

---
Mensaje desde www.movi.digital
```

---

## Recomendaciones para Usuarios sin Teléfono

Si deseas que todos los usuarios reciban WhatsApp, es necesario:

### Opción 1: Agregar Teléfonos
```sql
-- Para Agente Demo
UPDATE usuarios
SET celular_laboral = '5212345678901'
WHERE id = 'e14455f1-5071-4d44-8ec0-e8e56781c220';

-- Para Criso Gte
UPDATE usuarios
SET celular_laboral = '5212345678902'
WHERE id = '44686065-cc00-4e31-b3bf-96028f04a862';
```

### Opción 2: Usar teléfono temporal/genérico
Si los usuarios no tienen teléfono real, puedes:
- Asignarles un número temporal
- O aceptar que solo reciban campanita

---

## Comparación: Antes vs Después

### Antes de la Implementación
❌ Sin notificaciones al crear comunicado
❌ Usuarios debían revisar manualmente
❌ Bajo engagement

### Después de la Implementación
✅ Campanita automática para todos los destinatarios
✅ WhatsApp automático a usuarios con teléfono
✅ Link directo al comunicado
✅ Título del comunicado en el mensaje
✅ Excluye automáticamente al creador
✅ Manejo robusto de usuarios sin teléfono

---

## Pruebas Adicionales Recomendadas

### Prueba 1: Comunicado para Rol Específico
```typescript
// En el editor, seleccionar:
// Visibilidad: "Por rol"
// Rol: "Agente"
```

**Resultado esperado:**
- Solo usuarios con rol "Agente" reciben notificación
- Si tienen teléfono: también WhatsApp

### Prueba 2: Comunicado para Oficina Específica
```typescript
// En el editor, seleccionar:
// Visibilidad: "Por oficina"
// Oficina: "Oficina Centro"
```

**Resultado esperado:**
- Solo usuarios de esa oficina reciben notificación
- Si tienen teléfono: también WhatsApp

### Prueba 3: Verificar Usuario sin Teléfono
1. Verificar campanita en plataforma ✅
2. Confirmar que NO recibió WhatsApp ✅
3. Sin errores en logs ✅

---

## Logs de Verificación

### Campanitas Enviadas ✅
```
Total usuarios activos: 5
Creador (excluido): 1
Destinatarios: 4
Notificaciones creadas: 4
```

### WhatsApp Enviados ✅
```
Destinatarios con teléfono: 2 de 4
WhatsApp enviados: 2
Estado: enviado
Errores: 0
```

---

## Conclusión

### ✅ SISTEMA COMPLETAMENTE FUNCIONAL

El sistema de notificaciones para comunicados funciona **exactamente como debe**:

1. **Campanita:**
   - ✅ Se envía a todos los destinatarios según visibilidad
   - ✅ Excluye automáticamente al creador
   - ✅ Incluye título del comunicado
   - ✅ Incluye link directo

2. **WhatsApp:**
   - ✅ Se envía solo a usuarios con teléfono configurado
   - ✅ Prioriza celular_laboral
   - ✅ Fallback a celular_personal
   - ✅ No falla si usuario no tiene teléfono
   - ✅ Incluye título y link del comunicado

3. **Manejo de Errores:**
   - ✅ Robusto ante usuarios sin teléfono
   - ✅ No bloquea creación del comunicado
   - ✅ Logs claros en historial

**No se requieren cambios adicionales. El sistema está operando correctamente.**

---

## Archivos Relacionados

### Migraciones:
- ✅ `add_comunicados_notification_type_and_template.sql`
- ✅ `fix_pgnet_schema_for_notifications.sql`
- ✅ `update_whatsapp_footer_message.sql`

### Código Frontend:
- ✅ `src/pages/ComunicadoEditor.tsx` (líneas 368-393)

### Funciones RPC:
- ✅ `enviar_notificacion_individual`

### Edge Functions:
- ✅ `enviar-whatsapp`

### Documentación:
- ✅ `NOTIFICACIONES_COMUNICADOS.md`
- ✅ `FIX_WHATSAPP_CENTRO_NOTIFICACIONES.md`

---

## Comando para Nueva Prueba

Si deseas crear otro comunicado de prueba:

1. Ir a Comunicados → Nuevo Comunicado
2. Completar formulario
3. Seleccionar visibilidad
4. Guardar

**Resultado esperado:**
- Campanita a todos los destinatarios (excepto creador)
- WhatsApp solo a quienes tengan teléfono configurado
- Ambos con título y link del comunicado

---

**Estado:** ✅ Verificado y funcionando correctamente
**Build:** ✅ Exitoso sin errores
**Última Verificación:** 2025-11-27 01:26:30
