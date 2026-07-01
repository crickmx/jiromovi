# jiromovi — instrucciones para Claude Code

## Rama de trabajo
- **Siempre usar `origin/produccion`** — el servidor de producción (Plesk) despliega desde esta rama.
- La rama local activa es `FUSION!!!`, que trackea `origin/main` por defecto. Eso es incorrecto para deploy.
- **Comando correcto para push:** `git push origin HEAD:produccion`
- Nunca pushear solo a `origin/main` — los cambios no llegarán al servidor.

## Stack
- React 18 + TypeScript + Vite + Tailwind CSS
- Backend: Supabase (PostgreSQL + RLS + Edge Functions)
- Repo: https://github.com/crickmx/jiromovi
- Deploy: Plesk (rama `produccion`)

## Reglas de arquitectura
- La tabla de tickets se llama `tickets`, NO `tramites` — crítico para SQL
- Tipos de trámite en `ticket_tipos` (columna `value`)
- `assignment_mode` fue eliminado de `ticket_tipos` en 2026-06-24 — no referenciar
- Campos por tipo de trámite: `tramite_tipo_campos`; respuestas: `tramite_respuestas`
