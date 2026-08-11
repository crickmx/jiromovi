# Módulo `/alta` — Onboarding de agentes

> Plan técnico e implementación. Módulo nuevo, aislado, sin tocar flujos existentes.
> Rama de trabajo: `feat/alta-onboarding` (basada en `produccion`). **Nunca** push directo a `produccion`.

## 1. Objetivo

Alta de agentes en la ruta pública `/alta` con:
- Dos tipos: **Agente con Cédula** y **Agente en Desarrollo (sin cédula)**.
- Captura por pasos con **guardado parcial** (sobrevive al abandono).
- **Verificación de identidad biométrica + firma de contrato** en un solo flujo (Cincel).
- **Alta automática** al aprobar (crea y activa el usuario Agente).
- **Notificaciones internas** (a Administradores) y bienvenida al agente.
- Español de México. Preparado para migrar a **dominio externo** sin reescribir lógica.

## 2. Decisiones tomadas (con el responsable)

| Tema | Decisión |
|---|---|
| Alta final | Crear **Usuario Agente ACTIVO** automáticamente (rol `Agente`). `human_review` solo para fallos. |
| Proveedor identidad + firma | **Cincel para ambos** (fusiona biométrico + firma). Abstracción desacoplada para cambiar a Sumsub/otro después. |
| Credenciales Cincel | Aún sin PAT → se construye la capa real **+ simulador (mock)**; se conectan credenciales al confirmar plan con Cincel. |
| Contrato | Lo provee el equipo como **PDF**; se sube a Cincel. Placeholder configurable hasta recibirlo. |
| Notificaciones | A **Administradores**. |
| Oficina | **La asigna el equipo interno**, NO el agente. El agente se crea con oficina *pendiente* (nullable) y se avisa a Admins para asignarla. |
| Base de datos | Branch de Supabase resultó inviable (drift de 1255 migraciones). Migración **aditiva** aplicada directo a producción (validada con dry-run en transacción revertida). |

## 3. Arquitectura (límites del módulo)

```
Frontend (Vite/React/TS)                     Backend (Supabase)
─────────────────────────                    ──────────────────────────────
src/pages/Alta.tsx  ──────────────┐          supabase/functions/
src/components/alta/               │            alta-crear/           (guardar avance parcial)
  Wizard, pasos, subida docs       │            alta-enviar-cincel/   (crea documento+identidad)
src/lib/alta/                      ├─ invoke ─▶  alta-cincel-webhook/  (verify_jwt=false + secret)
  types.ts   (tipos del dominio)   │            alta-cincel-poll/     (reconciliación por polling)
  api.ts     (wrappers de invoke)  │            alta-finalizar/       (alta automática)
  provider/                        │            _shared/alta/         (código compartido)
    IdentityVerificationProvider   │              providers.ts        (interfaces)
    DocumentSignatureProvider      │              cincelProvider.ts    (adaptador Cincel)
    (implementados por Cincel)     │              mockProvider.ts      (simulador)
                                   ▼          Tablas: alta_* + cincel_webhook_logs
                              Storage: bucket privado `altas-onboarding`
```

**Regla de acceso**: el frontend público **nunca** escribe directo con la anon key. Todo pasa por edge functions con `service_role`. RLS negado por defecto; solo lectura para Administradores.

**Desacople de proveedor**: la UI y el servicio de onboarding dependen de las interfaces `IdentityVerificationProvider` y `DocumentSignatureProvider`, no de Cincel. Cincel implementa ambas (porque fusiona identidad+firma en un documento con `identity_verification: true`). Para cambiar a Sumsub, se agrega otra implementación sin tocar UI ni estados.

## 4. Modelo de datos (aplicado)

Migración `supabase/migrations/20260806120000_alta_onboarding_agentes_esquema.sql`.

| Tabla | Rol |
|---|---|
| `alta_agente` | Registro principal: tipo, datos personales/contacto/fiscales/bancarios, cédula, póliza RC, estado global, proveedor, ids externos Cincel, oficina asignada, auditoría, `resume_token`. |
| `alta_agente_paso` | Estado por paso del wizard (guardado parcial granular). |
| `alta_agente_documento` | Documentos cargados (INE, CSF, carátula, cédula, póliza RC, contrato). Se migran a `expediente_usuario` al crear el usuario. |
| `alta_agente_verificacion` | Verificación de identidad (Cincel biométrico): estado, evidencias, intentos. |
| `alta_agente_firma` | Firma del contrato (Cincel): estados del documento/invite, PDF firmado, constancia NOM-151. |
| `alta_agente_bitacora` | Historial/auditoría de transiciones de estado. |
| `cincel_webhook_logs` | Bitácora cruda de webhooks entrantes de Cincel. |

**Reuso** (no se duplica): documentos → bucket `altas-onboarding` → `expediente_usuario`; notificaciones → `send_transactional_notification` / `crearNotificacionGlobal`; usuario final → tabla `usuarios` (rol `Agente`).

## 5. Máquina de estados

```
draft ─▶ in_progress ─▶ identity_pending ─▶ signature_pending ─▶ awaiting_review ─▶ approved ─▶ completed
                │              │                    │                                    
                │              └──(falla)──▶ needs_retry ──(reintento)──▶ (regresa)       
                │                                    │                                    
                │                            (falla otra vez) ──▶ human_review ──▶ approved | rejected
                │                                                                          
                └──(abandono con datos incompletos)──▶ incomplete  (dispara notificación)
                                                                                          
  El usuario puede marcar resume_later en cualquier punto; retoma vía resume_token.
```

Nota Cincel: `identity_pending` y `signature_pending` ocurren dentro de **una misma sesión Cincel** (identidad primero, firma después). Se modelan explícitos para trazabilidad y reintentos.

## 6. Integración Cincel (API v3 — `https://api.cincel.digital/v3`)

- **Auth**: PAT (planes Business Pro/Enterprise) → `GET /tokens/jwt` con Basic `base64(pat:)` → Bearer JWT de vida corta.
- **Documento + identidad**: `POST /teams/{team}/folders/{folder}/documents` — PDF binario en el body + headers JSON `Metadata`, `Signers`, `Observers`. Firmante con `identity_verification: true` exige biométrico. `signature_coordinates.w` múltiplo de 200, `h` múltiplo de 123.
- **Estados**: documento `unsigned|partially_signed|signed`; invite `idle|sent|opened|completed`.
- **Evidencias identidad**: `GET /identity-verifications/{iv}/{credentialFrontImage|credentialBackImage|selfieImage|selfieLivenessImage}.jpeg` (404 si aún no validado).
- **Constancia legal**: `GET /documents/{document}.zip` (PDF firmado + audit trail + NOM-151 ASN.1 + TSR).
- **Background Check** (robustez fiscal): `GET /vips/ines/{MRZ}`, `GET /vips/{CURP}`, `GET /vips/{CURP}/rfc`, `GET /69b/{RFC}` (lista 69-B SAT).
- **Webhooks**: **no documentados públicamente** → mecanismo primario = **polling** (`alta-cincel-poll`), con receptor `alta-cincel-webhook` listo por si Cincel los habilita en el dashboard.

### Checklist a confirmar con Cincel (bloquea integración real)
1. Plan/PAT disponible (Business Pro/Enterprise) y `user_id`.
2. UUID de `team` y `folder` por defecto (`GET /users/{user}/teams`, `GET /teams/{team}/folders`).
3. URL base del **sandbox** y credenciales.
4. ¿Ofrecen **webhooks** y su validación (HMAC/secret)?
5. Modelo de **resultado del KYC** (aprobado/rechazado/score) y si hay captura headless por API.
6. Créditos por operación (c.Doc + identity verification) y rate limits.

## 7. Notificaciones (reuso de infraestructura)

- **Alta completada / entra alta / escalado / fallos repetidos / abandono** → a Administradores vía `crearNotificacionGlobal(titulo, msg, url, {tipo:'rol', rol:'Administrador'}, actor)` y/o `send_transactional_notification` (multicanal: campanita + email + WhatsApp) con un `event_key` nuevo (ej. `alta_agente_nueva`, `alta_agente_completada`, `alta_agente_incompleta`, `alta_agente_revision`).
- **Bienvenida al agente** al completar (email/WhatsApp).

## 8. Variables de entorno

Frontend (`VITE_*`, en `.env` del servidor Plesk, no versionado):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (existentes)
- `VITE_RECAPTCHA_SITE_KEY` (existente) — protección del formulario público
- `VITE_APP_URL` (existente) — base para links de retorno/callback (dominio externo)

Supabase Edge Functions Secrets (nuevos):
- `CINCEL_API_BASE_URL` (`https://api.cincel.digital/v3`)
- `CINCEL_PAT`, `CINCEL_USER_ID`, `CINCEL_DEFAULT_TEAM_UUID`, `CINCEL_DEFAULT_FOLDER_UUID`
- `CINCEL_WEBHOOK_SECRET` (si se habilitan webhooks)
- `ALTA_PROVIDER_MODE` = `cincel` | `mock` (permite correr end-to-end sin credenciales)
- `RECAPTCHA_SECRET_KEY` (verificación server-side, ya requerido por otras functions)

## 9. Seguridad
- RLS activo en todas las tablas nuevas; sin políticas anón → escritura solo `service_role`.
- Subida de documentos vía **signed upload URL** generada por edge function (bucket privado, no se abre a anón).
- Webhook Cincel: `verify_jwt=false` + validación de secret en tiempo constante + log crudo; responde siempre 200.
- reCAPTCHA v3 en el submit público.
- Datos sensibles (CLABE, cuenta) mínimos; la carátula bancaria real va como documento en bucket privado.

## 10. Preparación para dominio externo
- `App.tsx` ya enruta por dominio (hay sub-apps por host). `/alta` vive hoy en el bloque público de `MoviFullRoutes`; mañana puede promoverse a su propio host con cambios mínimos.
- Todos los links absolutos usan `VITE_APP_URL` (no hardcodear dominio).
- La lógica (servicios, estados, proveedores) es agnóstica del host.

## 11. Fases
1. ✅ Esquema BD + RLS + bucket (aplicado y verificado en producción).
2. Capa de proveedores (interfaces + Cincel + mock) + edge functions.
3. Wizard `/alta` (frontend) con autosave, progreso y subida de documentos.
4. Alta automática + notificaciones + bienvenida.
5. Tests + documentación de entrega + PR.

## 12. Criterios de aceptación
- `/alta` existe, público, aislado; guarda datos parciales; notifica si faltan datos.
- Distingue Agente con Cédula vs en Desarrollo.
- Identidad + firma vía Cincel (o mock) con reintento / retomar / revisión humana.
- Alta automática crea y activa el Agente al aprobar; notifica a Admins; bienvenida al agente.
- Todo en español MX. No rompe nada existente. Listo para dominio externo.
