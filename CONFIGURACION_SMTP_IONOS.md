# ✅ Configuración SMTP IONOS - Completada

## 📧 Datos Configurados

La cuenta SMTP de IONOS ha sido configurada exitosamente en el sistema:

### Configuración Actual:

```
Servidor:     smtp.ionos.mx
Puerto:       465
Tipo:         SSL/TLS
Usuario:      noresponder@movi.digital
Remitente:    MOVI Digital
Contraseña:   sacMif-xycjud-koxvy2
Estado:       ✅ ACTIVO
```

---

## 🗄️ Base de Datos

La configuración se encuentra almacenada en:

**Tabla:** `correo_configuracion`

**Registro:**
```json
{
  "id": "1b4988b2-268b-403b-9f67-ed42a6d82f51",
  "tipo_integracion": "smtp",
  "servidor": "smtp.ionos.mx",
  "puerto": 465,
  "usuario": "noresponder@movi.digital",
  "seguridad": "ssl",
  "remitente_nombre": "MOVI Digital",
  "remitente_email": "noresponder@movi.digital",
  "activo": true
}
```

---

## 🚀 Edge Function Actualizada

**Archivo:** `/supabase/functions/enviar-correo-transaccional/index.ts`

**Cambios realizados:**

1. ✅ Integración con **SMTPClient** (denomailer)
2. ✅ Conexión SSL/TLS en puerto 465
3. ✅ Autenticación con usuario y contraseña
4. ✅ Envío de HTML completo
5. ✅ Manejo de errores SMTP
6. ✅ Registro en historial (exitoso/fallido)
7. ✅ Cierre de conexión automático

**Características:**
- Conexión segura SSL
- Validación de configuración activa
- Reemplazo de variables dinámicas
- Registro de errores detallados
- CORS configurado

---

## 🧪 Página de Pruebas

**Ubicación:** `/public/test-email-smtp.html`

**Características:**
- ✅ Interfaz amigable
- ✅ Selección de tipo de notificación
- ✅ Envío en tiempo real
- ✅ Visualización de resultados
- ✅ Manejo de errores

**Tipos de notificación disponibles para prueba:**
1. Bienvenida
2. Recuperación de Contraseña
3. Nuevo Evento
4. Cuenta Activada

---

## 📋 Cómo Probar el Envío

### Opción 1: Página de Prueba

```
1. Abrir: http://localhost:5173/test-email-smtp.html
2. Ingresar correo de destino
3. Ingresar nombre del destinatario
4. Seleccionar tipo de notificación
5. Click en "Enviar Correo de Prueba"
6. Verificar resultado en pantalla
7. Revisar bandeja de entrada del correo
```

### Opción 2: Desde el Módulo de Notificaciones

```
1. Ir a /notificaciones-transaccionales
2. Tab "Configuración SMTP"
3. Scroll hasta "Prueba de Envío"
4. Ingresar correo de destino
5. Click en "Enviar Prueba"
6. Verificar resultado
```

### Opción 3: Via API (Supabase Function)

```javascript
const { data, error } = await supabase.functions.invoke(
  'enviar-correo-transaccional',
  {
    body: {
      tipo: 'bienvenida',
      destinatario: 'usuario@ejemplo.com',
      datos: {
        nombre: 'Juan',
        apellidos: 'Pérez',
        email_laboral: 'usuario@ejemplo.com',
        rol: 'Empleado'
      }
    }
  }
);
```

---

## ✏️ Editar Configuración

Para modificar la configuración SMTP:

### Opción 1: Desde la Interfaz Web

```
1. Ir a /notificaciones-transaccionales
2. Tab "Configuración SMTP"
3. Modificar campos necesarios:
   - Servidor SMTP
   - Puerto
   - Usuario
   - Contraseña
   - Remitente
4. Guardar Configuración
5. Enviar prueba
6. Activar si la prueba es exitosa
```

### Opción 2: Desde Base de Datos

```sql
UPDATE correo_configuracion
SET
  servidor = 'nuevo.servidor.com',
  puerto = 587,
  usuario = 'nuevo@email.com',
  password_encriptado = 'nueva_contraseña',
  seguridad = 'tls',
  remitente_nombre = 'Nuevo Remitente',
  remitente_email = 'nuevo@email.com',
  activo = true
WHERE id = '1b4988b2-268b-403b-9f67-ed42a6d82f51';
```

---

## 🔐 Seguridad

### Contraseña Almacenada:
- ✅ Almacenada en base de datos
- ⚠️ **Nota:** En producción, usar pgcrypto para encriptar
- ✅ Solo visible para administradores
- ✅ RLS aplicado en la tabla

### Recomendaciones:

1. **Encriptar contraseña:**
```sql
-- Usar pgcrypto para encriptar (implementar en futuro)
UPDATE correo_configuracion
SET password_encriptado = encrypt_correo_password('contraseña');
```

2. **Variables de entorno:**
```env
# Alternativamente, usar variables de entorno
SMTP_HOST=smtp.ionos.mx
SMTP_PORT=465
SMTP_USER=noresponder@movi.digital
SMTP_PASS=sacMif-xycjud-koxvy2
```

---

## 📊 Historial de Envíos

Todos los correos enviados se registran en:

**Tabla:** `correo_historial_envios`

**Campos registrados:**
- ✅ Tipo de notificación
- ✅ Destinatario (email y nombre)
- ✅ Asunto
- ✅ Cuerpo HTML
- ✅ Estado (enviado/fallido)
- ✅ Canal (correo/whatsapp/ambos)
- ✅ Mensaje de error (si aplica)
- ✅ Fecha y hora

**Consultar historial:**
```sql
SELECT
  tipo_notificacion_codigo,
  destinatario_email,
  asunto,
  estado,
  fecha_envio
FROM correo_historial_envios
WHERE canal_envio = 'correo'
ORDER BY fecha_envio DESC
LIMIT 50;
```

---

## ⚠️ Solución de Problemas

### Error: "No hay configuración de correo activa"
```
Solución: Verificar que activo = true en correo_configuracion
```

### Error: "Authentication failed"
```
Verificar:
1. Usuario: noresponder@movi.digital
2. Contraseña correcta
3. IONOS permite acceso SMTP
```

### Error: "Connection refused"
```
Verificar:
1. Servidor: smtp.ionos.mx
2. Puerto: 465
3. SSL/TLS habilitado
4. Firewall no bloquea puerto 465
```

### Error: "Tipo de notificación no configurado para correo"
```
Solución:
1. Ir a "Tipos de Notificaciones"
2. Activar switch "Correo" para el tipo deseado
3. Activar la notificación
```

---

## 🎯 Variables de Plantilla

Las plantillas pueden usar estas variables:

**Generales:**
```
{{nombre}}
{{apellidos}}
{{email}}
{{email_laboral}}
{{rol}}
{{oficina}}
{{nombre_plataforma}}
{{fecha}}
```

**Eventos:**
```
{{titulo_evento}}
{{fecha_evento}}
{{hora_evento}}
{{link_evento}}
{{ponente}}
```

**Recuperación:**
```
{{link_recuperacion}}
```

---

## 📧 Tipos de Notificación Configurados

| Código | Nombre | Correo | WhatsApp |
|--------|--------|--------|----------|
| bienvenida | Bienvenida | ✅ | ⚪ |
| recuperacion_password | Recuperación | ✅ | ⚪ |
| nuevo_evento | Nuevo Evento | ✅ | ⚪ |
| cuenta_activada | Cuenta Activada | ✅ | ⚪ |
| capacitacion_obligatoria | Capacitación | ✅ | ⚪ |
| cancelacion_evento | Cancelación | ✅ | ⚪ |
| recordatorio_evento | Recordatorio | ✅ | ⚪ |
| notificacion_personalizada | Personalizada | ✅ | ⚪ |

**Nota:** Activar canales según necesidad en "Tipos de Notificaciones"

---

## 🔄 Próximos Pasos

Para mejorar el sistema:

1. **Encriptación de contraseñas:**
   - Implementar pgcrypto
   - Funciones encrypt/decrypt

2. **Validación de dominio:**
   - SPF records
   - DKIM
   - DMARC

3. **Rate limiting:**
   - Limitar envíos por minuto
   - Prevenir spam

4. **Templates avanzados:**
   - Editor WYSIWYG
   - Previsualización mejorada
   - Imágenes embebidas

5. **Analytics:**
   - Tasa de apertura
   - Clicks en links
   - Bounces

---

## ✅ Estado del Sistema

**Configuración SMTP:** ✅ ACTIVA

**Servidor:** smtp.ionos.mx ✅

**Puerto:** 465 (SSL) ✅

**Autenticación:** Configurada ✅

**Edge Function:** Actualizada ✅

**Pruebas:** Disponibles ✅

---

## 📞 Contacto IONOS

Si hay problemas con la cuenta SMTP:

**Soporte IONOS:**
- Web: https://www.ionos.mx/ayuda
- Teléfono: 01 800 3000 910
- Panel: https://my.ionos.mx/

**Verificar:**
- ✅ Cuenta activa
- ✅ Límites de envío no excedidos
- ✅ Acceso SMTP habilitado
- ✅ Sin reportes de spam

---

El sistema está **completamente configurado** y listo para enviar correos desde **noresponder@movi.digital** usando el servidor SMTP de IONOS. Todas las pruebas pueden realizarse desde la página de prueba o directamente desde el módulo de Notificaciones Transaccionales. 📧✅
