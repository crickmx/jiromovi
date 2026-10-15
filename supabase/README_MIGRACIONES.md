# Migraciones de Supabase — cómo funcionan desde el 2026-10-15

## Qué pasó

Las ramas de preview de Supabase (supabase[bot] en los PRs) fallaban, y la rama
`main` de la integración estaba en `MIGRATIONS_FAILED` desde el 2026-09-01.

La causa: el historial de migraciones de producción ya no coincidía con el repo.

- Producción tenía 1,180 versiones registradas; el repo tenía 1,326 archivos.
- 274 archivos del repo nunca se registraron (se corrieron a mano en el SQL Editor).
- 128 versiones registradas en producción no tenían archivo en el repo.
- 4 timestamps estaban repetidos (dos archivos con la misma versión).
- Había migraciones duplicadas (`20251027175310_20251027175253_...`) que, al
  correr todo desde cero en una rama de preview, truenan con
  `policy ... already exists` (PR #67).

## Qué se hizo

1. **Baseline:** `migrations/20261015000000_baseline_produccion.sql` es el esquema
   real de producción al 2026-10-15 (extensiones, `public`, `private`, tipos,
   tablas, funciones, constraints, índices, vistas, triggers, RLS, 1,843 políticas
   incluyendo `storage`, grants, publicación realtime y los 47 buckets).
   Se probó aplicándolo completo en una base vacía en una sola transacción y se
   comparó objeto por objeto contra producción: 15,005 firmas, 0 diferencias
   (salvo las 3 funciones de abajo).
2. **Archivo:** las 1,330 migraciones viejas están en `migrations_archive/`
   solo como referencia. Supabase ya no las lee.
3. **Historial:** en producción, `supabase_migrations.schema_migrations` quedó con
   una sola versión (`20261015000000`). El historial anterior está respaldado en
   `supabase_migrations.schema_migrations_backup_20261015`.

## Qué NO trae el baseline (a propósito)

- **Datos** (catálogos, usuarios, configuraciones): las ramas de preview nacen vacías.
- **Jobs de pg_cron** (17): llaman Edge Functions de producción; no deben correr
  en una rama de preview. En producción siguen intactos.
- **Secretos de vault.**
- La llave `service_role` que está escrita dentro de
  `trigger_notification_dispatcher`, `trigger_sicas_bulk_sync_continue` y
  `trigger_sicas_incremental_sync` se reemplazó por `SERVICE_ROLE_KEY_REDACTADA`
  en el baseline. En producción las funciones siguen igual.
  ⚠️ Esa llave sigue en el historial de git (migraciones viejas): conviene rotarla
  y leerla desde vault.

## Reglas desde ahora

1. **Toda migración nueva va en `supabase/migrations/` y llega a producción por
   merge a `main`**, no pegándola a mano en el SQL Editor. Si se corre a mano, hay
   que registrarla: `supabase migration repair --status applied <version>`.
2. **Timestamp único** (`YYYYMMDDHHMMSS`), nunca repetido. Usar
   `supabase migration new <nombre>`.
3. **Idempotente cuando se pueda:** `create table if not exists`,
   `drop policy if exists` antes de `create policy`, `create or replace function`.
4. Nunca copiar un archivo de migración con otro prefijo (así nacieron los duplicados).
5. Si alguna vez se vuelve a desincronizar: comparar
   `select version from supabase_migrations.schema_migrations` contra
   `ls supabase/migrations`, y reparar con `supabase migration repair`.
