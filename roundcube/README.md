# Roundcube para MOVI Digital — Fase 1 (infra)

Esta carpeta levanta un Roundcube funcional contra IONOS, aislado en su
propio contenedor y su propia base de datos (NO Supabase — Roundcube solo
guarda ahí su estado interno: preferencias, caché, sesiones).

**Qué SÍ hace esta fase:** un Roundcube que abre, se conecta a
`imap.ionos.mx`/`smtp.ionos.mx`, y tiene los plugins oficiales del MVP
activos (`archive`, `zipdownload`, `newmail_notifier`, `markasjunk`) más los
3 plugins propios de MOVI como esqueleto (sin lógica todavía).

**Qué NO hace todavía:** no está embebido en MOVI, no tiene SSO (el login
sigue pidiendo la contraseña de IONOS normal, como el Roundcube de
cualquier hosting), la firma no viene de MOVI, y el autocompletado de
contactos es el de Roundcube, no el de MOVI. Eso es Fase 2 (SSO), Fase 3
(embed) y Fase 4 (plugins con lógica real).

## 1. Requisitos

- Un host con Docker + Docker Compose. **No asumas que tu Plesk actual lo
  soporta** — si no tiene la extensión Docker habilitada, esto necesita un
  VPS aparte (o un plan de Plesk que sí la tenga). Confirmar esto antes de
  desplegar en real.
- Un subdominio propio apuntando a ese host (sugerido: `mail-engine.movi.digital`
  o similar — no tiene que ser bonito, nunca lo ve el usuario final, vive
  detrás de un iframe/proxy).
- HTTPS en ese subdominio (Let's Encrypt vía el reverse proxy que uses, o el
  propio Plesk si el Docker corre en la misma máquina).

## 2. Configurar

```bash
cp .env.example .env
# Editar .env con contraseñas reales de la BD de Roundcube y, cuando
# llegue la Fase 2, el secreto MOVI_SSO_SHARED_SECRET
# (generar con: openssl rand -base64 32 — NUNCA reusar
# EMAIL_CREDENTIALS_MASTER_KEY para esto, son secretos distintos).
```

## 3. Levantar

```bash
docker compose build
docker compose up -d
docker compose logs -f roundcube   # confirmar que arrancó sin errores
```

Roundcube queda escuchando solo en `127.0.0.1:8080` del host — a propósito,
para que nunca quede expuesto a internet sin TLS. Un reverse proxy en el
mismo host (o Plesk, si comparte máquina) es quien lo publica en HTTPS:

- Proxy `https://<tu-subdominio>/` → `http://127.0.0.1:8080/`
- Encabezados de seguridad mínimos en el proxy: `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`. El `Content-Security-Policy:
  frame-ancestors` ya lo pone el propio contenedor (ver
  `docker-entrypoint-hooks.d/before-starting/10-movi-config.sh`) — hoy
  mismo restringido a `app.movi.digital`/`beta.movi.digital`; ajustar esa
  lista si se agrega otro dominio.

## 4. Verificar

1. Entra a `https://<tu-subdominio>/` — debe verse el login de Roundcube
   (con el skin `movi`, heredado de `elastic`).
2. Inicia sesión con una cuenta real de IONOS (correo completo + su
   contraseña actual del buzón).
3. Confirma bandeja de entrada, envío, carpetas, y que los plugins oficiales
   aparezcan (ej. botón de archivar, "Descargar todo" como ZIP en un correo
   con varios adjuntos, marcar como spam).

Si algo de esto falla, es infra (DNS/TLS/conexión a IONOS/BD de Roundcube),
no lógica de MOVI — este Roundcube todavía es standalone.

## 5. Respaldo

Dos volúmenes con estado real:
- `roundcube_db_data`: la base de datos de Roundcube (preferencias,
  caché). Prescindible en el sentido de que se puede reconstruir, pero
  perderla es mala experiencia para los usuarios (pierden preferencias
  locales, no su correo — ese vive en IONOS).
- `roundcube_data`: `/var/www/html` completo, incluye los plugins/skin
  copiados en el build; si usas `docker compose build` para reconstruir
  no hace falta respaldar esto, se regenera del repo.

## 6. Siguiente paso (Fase 2)

SSO real: un edge function en Supabase que, validando la sesión real de
MOVI, descifra la contraseña de IONOS del usuario (ver
`supabase/functions/_shared/emailCredentials.ts`) y se la entrega al plugin
`movi_auth` de forma segura y de un solo uso — para que el usuario nunca
vuelva a teclear su contraseña de IONOS dentro de MOVI.
