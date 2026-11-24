# Relación de Procesos que Envían Notificaciones

Este documento contiene una lista completa de todos los procesos, triggers y edge functions que envían notificaciones en el sistema MOVI Digital.

## Índice
1. [Notificaciones Automáticas (Triggers)](#notificaciones-automáticas-triggers)
2. [Notificaciones Transaccionales (Edge Functions)](#notificaciones-transaccionales-edge-functions)
3. [Notificaciones Departamentales](#notificaciones-departamentales)
4. [Cron Jobs Programados](#cron-jobs-programados)

---

## Notificaciones Automáticas (Triggers)

### 1. **Activación de Cuenta de Usuario**
- **Trigger:** `trigger_send_welcome_on_activation`
- **Tabla:** `usuarios`
- **Evento:** `AFTER UPDATE` cuando estado cambia a 'activo'
- **Función:** `send_welcome_notifications_on_activation()`
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:**
  - `{{nombre}}`, `{{apellidos}}`
  - `{{email_laboral}}`
  - `{{rol}}`, `{{puesto}}`
  - `{{nombre_plataforma}}`
  - `{{password}}` (en plantilla de bienvenida)
  - `{{pagina_web_url}}` (link a página pública del asesor)
- **Destinatario:** Usuario recién activado
- **Plantilla:** `bienvenida`

### 2. **Nuevo Usuario Pendiente de Activación**
- **Trigger:** `trigger_notify_admins_new_user`
- **Tabla:** `usuarios`
- **Evento:** `AFTER INSERT` cuando estado = 'pendiente'
- **Función:** `notify_admins_new_user_pending()`
- **Canales:** Notificación interna (campanita)
- **Variables:**
  - `{{empleado_nombre}}`, `{{empleado_apellidos}}`
  - Usuario creador
- **Destinatario:** Todos los administradores activos
- **Descripción:** Notifica a admins cuando un gerente crea un usuario pendiente

### 3. **Cambios en Trámites/Tickets**
- **Trigger:** `trigger_notify_ticket_changes`
- **Tabla:** `tickets`
- **Evento:** `AFTER UPDATE` o `AFTER INSERT`
- **Función:** `notify_ticket_changes()`
- **Canales:** Notificación interna (campanita)
- **Tipos de cambios notificados:**
  - Cambio de estatus
  - Reasignación a otro usuario
  - Nuevo comentario agregado
- **Variables:**
  - `{{folio_tramite}}`
  - `{{tipo_tramite}}`
  - `{{estatus_nuevo}}`
  - Usuario que realizó el cambio
- **Destinatarios:**
  - Usuario asignado al trámite
  - Usuario que creó el trámite (si es diferente)

### 4. **Solicitud de Cambio de Datos Bancarios**
- **Función:** `crear_ticket_cambio_bancario()`
- **Invocada desde:** Frontend cuando usuario cambia datos de pago
- **Canales:** Notificación interna (campanita)
- **Variables:**
  - `{{regimen_fiscal}}`
  - `{{banco}}`, `{{clabe}}`
  - Nombre del usuario
- **Destinatarios:**
  - Administradores
  - Personal de Mesa de Control
- **Descripción:** Crea ticket automático y notifica cuando usuario solicita cambio de datos bancarios

### 5. **Reservas de Espacio Jiro**

#### 5.1 Nueva Reserva Creada
- **Trigger:** Trigger en `reservas_espacio`
- **Evento:** `AFTER INSERT`
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:**
  - `{{user_name}}`
  - `{{area_name}}`, `{{office_name}}`
  - `{{fecha}}`, `{{hora_inicio}}`, `{{hora_fin}}`
  - `{{notas}}`
  - `{{manager_name}}`
- **Destinatario:** Gerente de la oficina
- **Plantilla:** `space_reservation_created`

#### 5.2 Reserva Aprobada
- **Trigger:** Trigger en `reservas_espacio`
- **Evento:** `AFTER UPDATE` cuando estado cambia a 'aprobada'
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:** Mismas que 5.1 + `{{comentarios_gerente}}`
- **Destinatario:** Usuario que creó la reserva
- **Plantilla:** `space_reservation_approved`

#### 5.3 Reserva Rechazada
- **Trigger:** Trigger en `reservas_espacio`
- **Evento:** `AFTER UPDATE` cuando estado cambia a 'rechazada'
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:** Mismas que 5.2
- **Destinatario:** Usuario que creó la reserva
- **Plantilla:** `space_reservation_rejected`

---

## Notificaciones Transaccionales (Edge Functions)

### 6. **Creación de Usuario por Edge Function**
- **Edge Function:** `create-user`
- **Ruta:** `/functions/v1/create-user`
- **Invocada desde:** Formulario de registro/creación de usuarios
- **Canales:** Configurable (Email, WhatsApp, Push)
- **Variables:**
  - Datos del nuevo usuario
  - Contraseña temporal (si aplica)
- **Destinatario:** Usuario nuevo (si está activo) o Administradores (si está pendiente)

### 7. **Lead desde Página Web Pública**
- **Edge Function:** `submit-web-lead`
- **Ruta:** `/functions/v1/submit-web-lead`
- **Invocada desde:** Formulario de contacto en página pública del asesor
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:**
  - `{{nombre_cliente}}`, `{{telefono}}`, `{{email}}`
  - `{{mensaje}}`
  - `{{asesor_nombre}}`
- **Destinatarios:**
  - Asesor dueño de la página web
  - Administradores (copia)
- **Plantilla:** `web_lead_submission`
- **Acción adicional:** Crea contacto automático en CRM

### 8. **Restablecimiento de Contraseña**
- **Edge Function:** `reset-password-request`
- **Ruta:** `/functions/v1/reset-password-request`
- **Invocada desde:** Formulario "Olvidé mi contraseña"
- **Canales:** Email
- **Variables:**
  - `{{nombre_usuario}}`
  - `{{reset_link}}` (link temporal)
- **Destinatario:** Usuario que solicitó el reset
- **Plantilla:** `password_reset_request`

### 9. **Recordatorio de Cumpleaños**
- **Edge Function/Cron:** `process-birthday-reminders`
- **Ruta:** `/functions/v1/process-birthday-reminders`
- **Ejecutado:** Cron diario (6:00 AM)
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:**
  - `{{nombre_cumpleanero}}`, `{{apellidos_cumpleanero}}`
  - `{{oficina}}`
  - Lista de cumpleaños del día
- **Destinatarios:**
  - Gerentes de oficina
  - RRHH
  - Administradores
- **Plantilla:** `birthday_reminder`

### 10. **Tareas de Renovación de Pólizas**
- **Edge Function/Cron:** `create-renewal-tasks`
- **Ruta:** `/functions/v1/create-renewal-tasks`
- **Ejecutado:** Cron diario
- **Canales:** Notificación interna
- **Variables:**
  - `{{poliza_numero}}`
  - `{{aseguradora}}`
  - `{{fecha_vencimiento}}`
  - `{{dias_restantes}}`
- **Destinatarios:**
  - Agente asignado a la póliza
  - Gerente de la oficina
- **Descripción:** Crea tareas automáticas en CRM cuando una póliza está próxima a vencer

### 11. **Lote de Comisiones Disponible**
- **Edge Function:** `send-commission-batch-notifications`
- **Ruta:** `/functions/v1/send-commission-batch-notifications`
- **Invocada desde:** Proceso de generación de lotes de comisiones
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:**
  - `{{lote_semana}}`
  - `{{lote_anio}}`
  - `{{total_comision}}`
  - `{{fecha_corte}}`
  - `{{link_lote}}`
- **Destinatarios:** Agentes que tienen comisiones en el lote
- **Plantilla:** `commission_batch_available`

---

## Notificaciones Departamentales

Estas notificaciones están configuradas para enviarse a departamentos específicos y pueden tener destinatarios personalizables.

### 12. **Vacaciones Aprobadas (RRHH)**
- **Código:** `vacaciones_aprobadas`
- **Módulo:** Recursos Humanos
- **Trigger:** Manual desde sistema de vacaciones
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:**
  - `{{empleado_nombre}}`, `{{empleado_apellidos}}`
  - `{{empleado_oficina}}`
  - `{{fecha_inicio_vacaciones}}`, `{{fecha_fin_vacaciones}}`
  - `{{aprobado_por}}`
  - `{{fecha_aprobacion}}`
- **Destinatarios:** Personal de RRHH (configurable)
- **Descripción:** Notifica a RRHH cuando se aprueban vacaciones para seguimiento

### 13. **Solicitud de Compra en Store (Mercadotecnia)**
- **Código:** `solicitud_compra_store`
- **Módulo:** Store / Mercadotecnia
- **Trigger:** Cuando usuario crea un pedido en la Store
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:**
  - `{{pedido_id}}`
  - `{{usuario_nombre}}`, `{{usuario_apellidos}}`
  - `{{usuario_oficina}}`
  - `{{fecha_pedido}}`
  - `{{total_productos}}`
  - `{{link_pedido}}`
- **Destinatarios:** Departamento de Mercadotecnia (configurable)
- **Descripción:** Notifica a mercadotecnia para gestión de inventario y logística

### 14. **Nuevo Trámite Generado (Mesa de Control)**
- **Código:** `nuevo_tramite`
- **Módulo:** Mesa de Control / Trámites
- **Trigger:** Cuando se crea cualquier tipo de trámite
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:**
  - `{{tipo_tramite}}`
  - `{{folio_tramite}}`
  - `{{usuario_nombre}}`, `{{usuario_apellidos}}`
  - `{{usuario_oficina}}`
  - `{{fecha_creacion}}`
  - `{{link_tramite}}`
- **Destinatarios:** Mesa de Control (configurable)
- **Descripción:** Notifica cuando se genera un trámite que requiere atención

### 15. **Solicitud de Corrección de Comisiones (Mesa de Control)**
- **Código:** `solicitud_correccion_comisiones`
- **Módulo:** Mesa de Control / Comisiones
- **Trigger:** Cuando usuario solicita corrección en un lote de comisiones
- **Canales:** Email, WhatsApp, Notificación interna
- **Variables:**
  - `{{lote_semana}}`
  - `{{documento}}`
  - `{{usuario_nombre}}`, `{{usuario_apellidos}}`
  - `{{usuario_oficina}}`
  - `{{motivo_correccion}}`
  - `{{link_lote}}`
- **Destinatarios:** Mesa de Control (configurable)
- **Descripción:** Notifica cuando un agente solicita corrección en sus comisiones

---

## Cron Jobs Programados

### 16. **Dispatcher de Notificaciones**
- **Cron Job:** `notification-dispatcher`
- **Frecuencia:** Cada 5 minutos
- **Descripción:** Procesa cola de notificaciones pendientes y las envía
- **Canales procesados:**
  - Correos electrónicos pendientes
  - Mensajes WhatsApp pendientes
  - Notificaciones push pendientes
- **Función:** Lee de tablas `correo_historial_envios`, `whatsapp_historial_envios`

### 17. **Correos Programados**
- **Cron Job:** `check-scheduled-emails`
- **Frecuencia:** Cada hora
- **Descripción:** Envía correos que fueron programados para una fecha/hora específica
- **Función:** Verifica tabla `correo_programacion_automatica`

---

## Notificaciones por Módulo

### RRHH / Recursos Humanos
- Vacaciones aprobadas (#12)
- Cumpleaños de empleados (#9)
- Nuevo usuario pendiente (#2)
- Activación de cuenta (#1)

### Mercadotecnia / Store
- Solicitud de compra en Store (#13)

### Mesa de Control
- Nuevo trámite generado (#14)
- Corrección de comisiones (#15)
- Cambios en tickets (#3)
- Cambio de datos bancarios (#4)

### Comisiones
- Lote de comisiones disponible (#11)
- Corrección de comisiones (#15)

### Espacio Jiro
- Nueva reserva (#5.1)
- Reserva aprobada (#5.2)
- Reserva rechazada (#5.3)

### CRM / Ventas
- Tareas de renovación (#10)
- Lead desde página web (#7)

### Seguridad / Usuarios
- Activación de cuenta (#1)
- Nuevo usuario pendiente (#2)
- Restablecimiento de contraseña (#8)

---

## Canales de Notificación

### 1. Email (SMTP/Resend)
- Configurado globalmente en `correo_configuracion_global`
- Usa plantillas HTML con variables
- Soporta adjuntos y respuestas
- Seguimiento en tabla `correo_historial_envios`

### 2. WhatsApp (Wazzup)
- Configurado globalmente en `whatsapp_configuracion`
- Usa plantillas de texto plano
- Requiere Channel ID de Wazzup
- Seguimiento en tabla `whatsapp_historial_envios`

### 3. Notificación Interna (Campanita)
- Almacenadas en tabla `notificaciones`
- Aparecen en el icono de campana del header
- Incluyen título, mensaje, icono, y link de acción
- Se marcan como leídas al hacer clic

### 4. Push Notifications (Futuro)
- Sistema configurado pero no implementado completamente
- Tabla: `push_historial_envios`

---

## Configuración de Destinatarios

### Tipos de Destinatarios

1. **Individual:** Usuario específico
2. **Por Rol:** Todos los usuarios con rol específico (Admin, Gerente, Agente)
3. **Por Oficina:** Todos los usuarios de una oficina
4. **Por Departamento:** Grupos personalizables (RRHH, Mesa Control, Mercadotecnia)
5. **Custom:** Lista específica de usuarios

### Tabla de Configuración
- `destinatarios_notificacion`: Relaciona tipos de notificación con destinatarios
- Permite activar/desactivar por canal
- Soporta múltiples destinatarios por notificación

---

## Variables Globales Disponibles

Variables que se pueden usar en todas las plantillas:

- `{{nombre}}`, `{{apellidos}}`, `{{nombre_completo}}`
- `{{email}}`, `{{email_laboral}}`
- `{{rol}}`, `{{puesto}}`
- `{{oficina_nombre}}`
- `{{fecha}}` (fecha actual)
- `{{hora}}` (hora actual)
- `{{nombre_plataforma}}` (MOVI Digital)
- `{{link_url}}` (URL de acción)
- `{{logo_url}}` (URL del logo)

---

## Auditoría y Seguimiento

### Tablas de Historial
- `correo_historial_envios`: Registro de emails enviados
- `whatsapp_historial_envios`: Registro de WhatsApp enviados
- `notificaciones_log`: Log de todas las notificaciones procesadas
- `audit_logs`: Cambios importantes en el sistema

### Estados de Envío
- `pendiente`: En cola, esperando procesamiento
- `enviado`: Enviado exitosamente
- `fallido`: Error al enviar
- `entregado`: Confirmación de entrega (solo WhatsApp)
- `leido`: Usuario leyó la notificación (solo interna)

---

## Seguridad y Permisos

### Nivel de Acceso por Rol

**Administrador:**
- Recibe todas las notificaciones administrativas
- Puede configurar plantillas y destinatarios
- Acceso completo al historial de envíos

**Gerente:**
- Recibe notificaciones de su oficina
- Puede ver historial de su oficina
- Notificaciones de reservas de espacio
- Notificaciones de vacaciones de su equipo

**Agente:**
- Recibe notificaciones personales
- Notificaciones de comisiones
- Notificaciones de trámites asignados
- Notificaciones de renovaciones

---

## Notas Técnicas

### Prevención de Duplicados
- Sistema de deduplicación basado en hash de contenido
- Ventana de 15 minutos para notificaciones similares
- Especialmente importante en triggers para evitar loops

### Rate Limiting
- Límite de notificaciones por usuario: 50/hora
- Límite global: 1000/minuto
- Colas para distribución equitativa

### Retry Logic
- 3 intentos para emails fallidos
- 5 intentos para WhatsApp fallidos
- Backoff exponencial entre reintentos

### Logs y Debug
- Todos los envíos se registran con timestamp
- Errores incluyen stack trace completo
- Logs accesibles por administradores

---

**Última actualización:** 2026-03-17
**Versión del sistema:** MOVI Digital v2.0
