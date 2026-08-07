# Handoff — Módulo de alta de agentes (`/registro-at`)

> Documento para que otro agente (Claude Code) continúe el trabajo sin repetir contexto.
> Estado verificado en vivo el **2026-08-07**. Complementa a `PLAN_ALTA.md` (diseño original) y a `CLAUDE.md` (reglas del repo).

---

## 1. Qué estamos construyendo

Un módulo **nuevo y aislado** de onboarding/alta de agentes de seguros para la plataforma **movi.digital** (beta.movi.digital), bajo la marca **Agente Total** (promotoriadeseguros.com.mx).

Flujo público donde un aspirante a agente:
1. Elige tipo: **Agente con Cédula** o **Agente en Desarrollo (Promotor)**.
2. Captura datos personales, fiscales/bancarios y de póliza RC (con guardado parcial).
3. Sube documentos (INE ambos lados en un archivo, CSF, carátula bancaria, póliza RC, y cédula si aplica).
4. Hace **verificación de identidad biométrica (Sumsub)** y **firma del contrato (SignWell)** — en paralelo.
5. Al aprobar ambas, el sistema **crea y activa automáticamente** su usuario con rol `Agente`, migra sus documentos al expediente, le manda bienvenida y notifica a los Administradores (que luego le asignan oficina).

Regla de oro del proyecto: **no romper nada de lo existente**. Todo va prefijado/aislado y es aditivo.

---

## 2. Dónde vive todo

| Cosa | Dónde |
|---|---|
| Repo | `crickmx/jiromovi` (GitHub). Clon local: `/Users/macccj/Documents/JIRO Claude/jiromovi` |
| Stack | Vite + React 19 + TypeScript + Tailwind 3 + Radix + Supabase JS. Router: react-router-dom v7 (domain-based en `src/App.tsx`) |
| Rama de trabajo | `feat/alta-onboarding` (basada en `produccion`). **Local, NO pusheada.** |
| Deploy frontend | Plesk despliega desde la rama **`produccion`**: `git push origin HEAD:produccion`. **Nunca** pushear a `produccion` sin validar. |
| Backend | Supabase, proyecto **"MOVI Digital"** ref `qhwvuuyjhcennqccgvse` (producción; ~300 tablas, datos reales). |
| Doc de diseño | `PLAN_ALTA.md` (raíz del repo). Reglas del repo: `CLAUDE.md`. |
| Memoria persistente | `~/.claude/projects/-Users-macccj-Documents-JIRO-Claude/memory/alta-onboarding-module.md` |

**Nota de arquitectura clave:** `src/App.tsx` enruta por dominio. Hoy `/registro-at` vive como ruta pública dentro de `MoviFullRoutes.tsx`; mañana puede promoverse a su propio dominio con cambios mínimos (usa `VITE_APP_URL` para links absolutos).

---

## 3. Arquitectura del módulo

```
FRONTEND (Vite/React)                          BACKEND (Supabase)
─────────────────────                          ──────────────────────────────
/registro-at  → src/pages/Alta.tsx             Edge functions (supabase/functions/):
  wizard 4 pasos, autosave, docs, brand AT       alta-guardar         (CRUD público + resume_token + reCAPTCHA)
/registro-at/simular → src/pages/AltaSimular    alta-enviar-cincel   (arranca Sumsub + SignWell EN PARALELO)
/admin/registro-at/contratos                    alta-finalizar       (alta automática: crea/activa Agente)
  → src/pages/AdminContratosAlta.tsx (Admin)     alta-cincel-poll     (cron: reconciliación + abandono)
                                                 alta-subir-contrato  (Admin: sube contrato base al bucket)
src/lib/alta/altaApi.ts                          alta-cincel-webhook  (receptor; NO desplegado aún)
  wrappers tipados (supabase.functions.invoke)
                                               _shared/alta/ (código compartido):
                                                 providers.ts   → getIdentityProvider() / getSignatureProvider()
                                                 sumsubProvider / signwellProvider / mockProvider
                                                 reconciliar.ts → decide estado global y dispara finalizar
                                                 service.ts     → service_role, CORS, bitácora, transición, folio, notificar admins

                                               Tablas alta_* + bucket privado `altas-onboarding`
```

**Desacople de proveedores:** la UI y las functions dependen de las interfaces `IdentityVerificationProvider` y `DocumentSignatureProvider`, no de un proveedor concreto. `getIdentityProvider()`/`getSignatureProvider()` auto-detectan por variables de entorno; si no hay credenciales, usan **MockProvider** (simulador) para correr end-to-end. Cambiar de proveedor = nueva implementación de la interfaz, sin tocar UI ni estados.

---

## 4. Lo que YA está hecho (verificado)

### 4.1 Base de datos — APLICADA en producción ✓
- Migración: `supabase/migrations/20260806120000_alta_onboarding_agentes_esquema.sql`. **Aditiva**: no modifica ninguna tabla/función/política existente.
- Tablas nuevas: `alta_agente` (registro principal), `alta_agente_paso`, `alta_agente_documento`, `alta_agente_verificacion`, `alta_agente_firma`, `alta_agente_bitacora`, `cincel_webhook_logs`.
- Enums: `alta_tipo_agente`, `alta_estado` (12 estados), `alta_paso_estado`, `alta_verificacion_estado`, `alta_firma_estado`.
- RLS: activo en todas; **solo lectura para Administradores** (`alta_es_admin(auth.uid())`); escritura exclusiva de `service_role` (edge functions). El frontend público **nunca** escribe directo.
- Storage: bucket privado **`altas-onboarding`**. Docs del alta van a `{alta_id}/...`; contratos base a `_contratos/contrato_{tipo}.pdf`.
- ⚠️ El **branching de Supabase NO sirve** en este proyecto (el historial de 1255 migraciones no re-aplica desde cero por drift). Por eso la migración se validó con un dry-run en transacción revertida y se aplicó directo a prod.

### 4.2 Edge functions — estado en vivo (2026-08-07)
| Función | Status | verify_jwt | Nota |
|---|---|---|---|
| `alta-guardar` | ACTIVE (v3) | true | CRUD público (iniciar/guardar_paso/subir_url/registrar_doc/retomar/estado/reconciliar). Anon key + `resume_token`. |
| `alta-enviar-cincel` | ACTIVE (v2) | true | **Slug legacy** (el nombre quedó de la etapa Cincel). Arranca Sumsub + SignWell en paralelo. |
| `alta-finalizar` | ACTIVE (v1) | false | Interna (service key / `ALTA_INTERNAL_SECRET`). Crea+activa Agente, migra docs, bienvenida, notifica admins. |
| `alta-cincel-poll` | ACTIVE (v1) | false | Reconciliación por lote + detección de abandono. **Falta el cron que la dispare** (ver 6.4). |
| `alta-subir-contrato` | ACTIVE (v1) | true | Solo Administrador. Sube el PDF base al bucket. |
| `alta-cincel-webhook` | **NO desplegada** | (verify_jwt=false al desplegar) | Receptor de webhooks; inerte hasta que el proveedor los emita. |

### 4.3 Frontend — verificado en el navegador
- Ruta pública **`/registro-at`** (`src/pages/Alta.tsx`), registrada en `src/pages/MoviFullRoutes.tsx` (bloque público, sin `ProtectedRoute` ni `LayoutShell`). Marca **Agente Total** (logo AT, color `#164281`… revisar: la UI se ve en rojo AT).
- **Wizard de 4 pasos**: `Datos personales` → `Fiscal y RC` → `Documentos` → `Identidad y firma`. Autosave cada 5s, barra de progreso, `SavedIndicator`, responsivo, español MX. Sin campo "Razón social". Régimen fiscal como **dropdown** (honorarios / actividad empresarial / RESICO / otro). INE en **un solo archivo** (ambos lados). Sin selector de oficina (la asigna el equipo).
- Guardado parcial y **retomar** por `resume_token` (localStorage + `?alta=&token=` en URL).
- Página admin **`/admin/registro-at/contratos`** (`src/pages/AdminContratosAlta.tsx`, `requireAdmin`) para subir el contrato base de cada tipo.
- Simulador **`/registro-at/simular`** (`src/pages/AltaSimular.tsx`) para el modo mock.
- Type-check limpio (`npx tsc --noEmit -p tsconfig.app.json`, filtrando archivos del módulo). Sin errores de consola.

### 4.4 Decisiones del responsable (ya implementadas)
- Alta final = **crear + ACTIVAR** usuario `Agente` automáticamente (rol `Agente` = cliente externo, ver glosario en `CLAUDE.md`). `human_review` solo para fallos.
- **Oficina la asigna el equipo interno**, no el agente → el usuario se crea con `oficina_id` NULL (el esquema lo permite) y se avisa a Administradores.
- Notificar a **Administradores** (vía RPC existente `enviar_notificacion_global` por rol; bienvenida vía `enviar_notificacion_completa` evento `cuenta_activada`).
- **RFC** obligatorio solo para "con cédula".
- Contrato lo provee el equipo como **PDF** (dos: agentes / promotor).

---

## 5. Cómo correrlo en local (para el próximo agente)

```bash
cd "/Users/macccj/Documents/JIRO Claude/jiromovi"
npm install                # el clon NO trae node_modules
npm run dev                # Vite en http://localhost:5173  → abrir /registro-at
```
- `.env` local (gitignored, ya creado) tiene `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Falta `VITE_RECAPTCHA_SITE_KEY` (opcional en dev; si no está, el reCAPTCHA se salta).
- El dev server se lanza con el preview del harness vía `.claude/launch.json` **en la RAÍZ de la sesión** (`/Users/macccj/Documents/JIRO Claude/.claude/launch.json`, config `jiromovi-dev` con `cwd` a `jiromovi`), NO en `jiromovi/.claude`.
- **Modo mock**: sin secrets de Sumsub/SignWell, todo el flujo corre con `MockProvider` (identidad y firma se aprueban solas). Sirve para probar UI + estados + alta automática end-to-end. ⚠️ En mock, completar el flujo **crea un usuario Agente real** en `usuarios` + Auth (usa email de prueba y bórralo después).

---

## 6. LO QUE FALTA — con detalle y pasos concretos

### 6.1 Contratos (PDF) — quitar datos de ejemplo + subir
- El equipo entregó `MACHOTE CONTRATO AGENTES.pdf` (→ `con_cedula`) y `MACHOTE CONTRATO PROMOTOR.pdf` (→ `en_desarrollo`). Instrucción: usarlos **sin los datos de ejemplo** (contenido intacto, formato editable).
- Mecanismo de carga **ya listo**: función `alta-subir-contrato` (ACTIVE) + página `/admin/registro-at/contratos`. Un Administrador sube cada PDF y queda en `altas-onboarding/_contratos/contrato_{tipo}.pdf`. `alta-enviar-cincel → obtenerContrato()` los lee de ahí (si no existen, usa un PDF placeholder).
- **Pendiente:** procesar los PDF para quitar los datos de muestra (usar la skill `pdf`), y subir los limpios. Es un documento legal → hacerlo con cuidado.

### 6.2 Sumsub (identidad) — secrets + montar WebSDK
- Setear en Supabase → Edge Functions → Secrets: `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_BASE_URL` (`https://api.sumsub.com`), `SUMSUB_LEVEL_NAME` (el level de verificación configurado en el dashboard de Sumsub).
- `alta-enviar-cincel` ya crea el applicant y devuelve `identidad.sdkToken` / `identidad.url` (ver `IniciarVerifResp` en `src/lib/alta/altaApi.ts`).
- **Pendiente frontend:** en la tarjeta de "Identidad" del wizard, montar el **Sumsub WebSDK** (`@sumsub/websdk` o el script `snsWebSdk`) usando ese `sdkToken`, en vez de abrir el simulador. El resultado real llega por polling (`reconciliar`) o webhook.
- Confirmar el **modelo de resultado** de Sumsub (approved/rejected/pending) y mapearlo en `sumsubProvider.consultarVerificacion` (revisar el archivo actual en `_shared/alta/`).

### 6.3 SignWell (firma) — secrets
- SignWell ya se validó en vivo (auth OK). Setear secrets: `SIGNWELL_API_KEY`, `SIGNWELL_TEST_MODE` (`true` mientras se prueba), opcional `SIGNWELL_TEMPLATE_ID`.
- Con los secrets, `getSignatureProvider()` deja el mock y usa SignWell real. `alta-enviar-cincel` sube el contrato (de 6.1) y devuelve `firma.signUrl` para que el agente firme.

### 6.4 Cron de reconciliación — CREAR (no existe)
- `alta-cincel-poll` está ACTIVE pero **no hay cron que la llame** (verificado: `cron.job` vacío para el módulo). Sin esto, la reconciliación en segundo plano y la detección de abandono no corren (el wizard sí reconcilia on-demand vía la acción `reconciliar`).
- Crear el job con pg_cron (patrón que ya usa el repo, ver `escalar_express_leads_cron`). SQL de referencia (ajustar el `service_role` JWT y la URL):
  ```sql
  select cron.schedule(
    'alta-cincel-poll-cada-3min',
    '*/3 * * * *',
    $$ select net.http_post(
         url := 'https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/alta-cincel-poll',
         headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_JWT>'),
         body := '{}'::jsonb
       ) $$
  );
  ```

### 6.5 Webhook (opcional)
- Desplegar `alta-cincel-webhook` con `verify_jwt=false` y setear `CINCEL_WEBHOOK_SECRET` (o el secret del proveedor real) SOLO si Sumsub/SignWell van a emitir webhooks. Mientras tanto, el polling (6.4) es el mecanismo primario.

### 6.6 Cierre
- **Tests**: guardado parcial, alta completa (mock), fallback/reintento, abandono, integración mockeada.
- **reCAPTCHA**: registrar el dominio de `/registro-at` en la consola de Google y poner `VITE_RECAPTCHA_SITE_KEY` en el `.env` de Plesk + `RECAPTCHA_SECRET_KEY` en Supabase Secrets.
- **PR / deploy**: abrir PR de `feat/alta-onboarding`; al validar, `git push origin HEAD:produccion` (Plesk despliega). Las edge functions ya están en prod (son globales, no por rama).
- Confirmar que el enrutado de dominio en `src/App.tsx` maneje bien `/registro-at` en el host de producción.

---

## 7. Gotchas / notas para el próximo agente
- **`verbatimModuleSyntax: true`**: importar tipos siempre con `import type { X }` o truena en runtime (TS1484).
- Type-check SOLO con `npx tsc --noEmit -p tsconfig.app.json` (no `tsc` a secas). El repo ya tiene **muchos errores TS preexistentes** → filtrar por los archivos tocados.
- Deno functions NO entran en el `tsc` del frontend; se validan al desplegar por MCP de Supabase (no hay `deno` local).
- **RLS/RPC drift**: en este repo hay políticas/funciones creadas directo en el SQL Editor que no están en migraciones. Antes de asumir que un fix está mal, verificar el estado real en prod.
- El slug de la función `alta-enviar-cincel` es **legacy** (viene de cuando el plan era Cincel-para-todo). Hoy orquesta Sumsub + SignWell. No renombrar sin actualizar `altaApi.ts` (`iniciarVerificacion` la invoca por ese nombre).
- Toda escritura a las tablas `alta_*` es vía edge functions con service_role; el anon key nunca las toca (RLS cerrado).
- Commits del módulo van con `Co-Authored-By: Claude`. Mensajes y commits en español.
