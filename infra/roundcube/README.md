# Roundcube para MOVI — Fase 1

Infraestructura aislada y reversible para usar Roundcube como motor IMAP/SMTP
de las cuentas corporativas IONOS. Esta fase no cambia todavía la ruta ni la
interfaz de correo de MOVI.

## Decisiones

- Roundcube `1.7.2-apache`, versión estable con correcciones de seguridad,
  fijada explícitamente para que un despliegue no cambie sin revisión.
- MariaDB separada de Supabase. Solo almacena sesión, preferencias e índices de
  Roundcube; MOVI sigue siendo la fuente de verdad de usuarios, permisos,
  contactos, firmas y credenciales.
- IMAP IONOS por SSL/TLS 993 y SMTP por SSL/TLS 465, parametrizables.
- Servicios internos sin exposición pública: MariaDB no publica puertos y
  Roundcube escucha únicamente en `127.0.0.1`.
- Plugins oficiales MVP: `archive`, `zipdownload`, `newmail_notifier` y
  `markasjunk`.
- HTTPS termina en el proxy reverso del dominio de MOVI.

## Preparación

Requisitos del servidor: Docker Engine con Compose v2 y un proxy HTTPS
existente (Nginx o configuración equivalente en Plesk).

```bash
cd infra/roundcube
cp .env.example .env
openssl rand -base64 36
openssl rand -base64 36
openssl rand -hex 12
```

Usar los tres resultados para los dos passwords de MariaDB y
`ROUNDCUBE_DES_KEY`, respectivamente. No reutilizar
`EMAIL_CREDENTIALS_MASTER_KEY` y no subir `.env` al repositorio.

Antes de iniciar:

```bash
docker compose config
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 roundcube
```

Copiar/adaptar `nginx/movi-roundcube.conf.example` al virtual host HTTPS y
recargar Nginx. Verificar desde el servidor:

```bash
curl -I http://127.0.0.1:8080/
curl -I https://DOMINIO_MOVI/correo/
```

El primer arranque crea automáticamente el esquema de Roundcube. Aún no debe
habilitarse `/correo/` para usuarios finales: el SSO de la Fase 2 es el control
de acceso obligatorio.

## Respaldo y reversión

Respaldar antes de actualizar:

```bash
docker compose exec -T database mariadb-dump \
  -u root -p roundcube > roundcube-$(date +%F).sql
```

Para detener sin borrar datos:

```bash
docker compose down
```

No ejecutar `docker compose down -v` en producción: elimina la base persistente.

## Checklist previo a Fase 2

- DNS/HTTPS del dominio de MOVI funcionando.
- `/correo/` accesible solo a través del proxy, nunca por el puerto público.
- Conectividad saliente a `imap.ionos.mx:993` y `smtp.ionos.mx:465`.
- Login manual de una cuenta de prueba validado temporalmente y acceso público
  bloqueado de nuevo al terminar.
- Backups y actualización de imágenes documentados en el servidor.
- Migraciones y Edge Functions de la Fase 0 desplegadas.

La Fase 2 añadirá tokens de un solo uso, autologin desde la sesión Supabase,
expiración/revocación y cierre sincronizado. Las fases posteriores integrarán
contactos, firmas, notificaciones y finalmente la vista en
`/centro-contacto/email`.
