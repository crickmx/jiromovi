# MOVI — Plataforma de Gestión para Seguros JIRO

Sistema integral de gestión: trámites, producción, bonos, tienda, aula virtual y comunicaciones para JIRO y su red de agentes/despachos.

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + RLS + Edge Functions)
- **Deploy:** `main` → Plesk vía Git+webhook (beta.movi.digital) | `produccion` → Plesk (produccion.movi.digital)
- **GitHub:** https://github.com/crickmx/jiromovi

---

## Inicio rápido

```bash
npm install
cp .env.example .env   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (`https://qhwvuuyjhcennqccgvse.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Clave pública anon de Supabase |

---

## Edge Functions

Las edge functions viven en `supabase/functions/` y se despliegan manualmente desde el dashboard de Supabase.

### `sicas-ccj-export`

Proxy server-to-server autenticado sobre la tabla `sicas_ccj_records`. Permite a Central de Producción (bonos_jiro) consumir los datos de SICAS sincronizados por MOVI sin descargar XLSX manualmente.

**URL:** `https://qhwvuuyjhcennqccgvse.supabase.co/functions/v1/sicas-ccj-export`

**Auth:** Header `X-Bonos-Secret` con el valor de la variable `BONOS_EXPORT_SECRET` en Supabase Dashboard → Settings → Edge Functions → Environment Variables.

**Parámetros GET:**

| Parámetro | Default | Descripción |
|---|---|---|
| `report_type` | `efectuada` | `efectuada` o `pendiente` |
| `fecha_desde` | — | Filtro inicio en `report_date` (YYYY-MM-DD) |
| `fecha_hasta` | — | Filtro fin en `report_date` (YYYY-MM-DD) |
| `limit` | `1000` | Registros por página (máx 5000) |
| `offset` | `0` | Paginación |

**Respuesta:**
```json
{
  "rows": [...],
  "total": 1234,
  "limit": 1000,
  "offset": 0,
  "has_more": true
}
```

**Configurar en Supabase:**

1. Dashboard → Settings → Edge Functions → Environment Variables
2. Agregar: `BONOS_EXPORT_SECRET = <secreto-compartido-con-bonos_jiro>`

### `sicas-ccj-reports`

Sincroniza datos de SICAS CCJ a `sicas_ccj_records` cada 4 horas vía cron. ⚠️ El filtro de fecha de "efectuada" no funciona todavía vía el endpoint REST de SICAS (`/Report/ReadData`) — ver `CLAUDE.md` para el diagnóstico completo y el plan (probable solución: SOAP `ProcesarWS`, cliente ya existente en `_shared/sicasSoapReportClient.ts`).

### `process-poliza-pdf`

Extrae datos de pólizas PDF (GNP, Qualitas) y genera un Excel acumulado en el bucket `ticket-archivos`. Llama al extractor en `lector.movi.digital`.

---

## Módulos principales

| Módulo | Ruta | Descripción |
|---|---|---|
| Trámites | `/tramites` | Kanban de trámites internos/externos con FormBuilder |
| Central de Producción | `/central` | Iframe embebido de cp.movi.digital |
| Mercadotecnia | `/mercadotecnia` | Recursos de marca, fotos de estudio |
| Tienda | `/store` | Pedidos de materiales con variantes y pagos |
| Aula Virtual | `/aula-virtual` | Videoconferencias con 100ms |
| Centro de Contacto | `/contacto` | Gestión de comunicaciones |
| WhatsApp | — | Integración de mensajería |

---

## Ramas y deploy

| Rama | Destino | Descripción |
|---|---|---|
| `main` | Netlify (beta.movi.digital) | Rama principal / Christofer |
| `produccion` | Plesk (produccion.movi.digital) | Rama de Ricardo |

Push a `main` → deploy automático en Netlify (~3–5 min).
Push a `produccion` → deploy en Plesk vía Git (manual o auto-deploy configurado).

---

## Migraciones Supabase

Las migraciones están en `supabase/migrations/`. Para aplicarlas en producción usar el SQL Editor del dashboard de Supabase o `supabase db push`.

---

## Tabla `sicas_ccj_records`

Almacena cobranza SICAS sincronizada cada 4h por `sicas-ccj-reports`. Columnas clave:

| Columna | Tipo | Descripción |
|---|---|---|
| `report_type` | text | `efectuada` o `pendiente` |
| `report_date` | date | Fecha de Pago (efectuada) o FLimPago (pendiente) |
| `row_data` | jsonb | Fila completa de SICAS (mismo formato que el XLSX) |
| `is_active` | boolean | Soft-delete: solo `true` son datos vigentes |
| `source_page` | int | Página de donde se extrajo (para ordenamiento) |
| `source_index` | int | Índice dentro de la página |

---

## Notas de desarrollo

- El README de la raíz era el boilerplate de Vite — se reemplazó en sept 2026.
- Para probar RLS, el usuario debe iniciar sesión con su propia cuenta; la impersonación ("Vista Admin — Viendo como") solo simula la UI, el JWT real sigue siendo el del admin.
- `@100mslive/react-sdk` requiere `react >= 16.8 <19.0.0` — pendiente actualizar cuando el SDK soporte React 19.
