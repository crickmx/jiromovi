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

## Fase 2 — SSO

El repositorio incluye:

- `roundcube-sso-token`: valida el JWT del usuario y emite un token opaco de
  60 segundos.
- `roundcube-sso-redeem`: endpoint exclusivamente servidor-a-servidor que
  consume el token y recupera la credencial cifrada.
- `movi_sso`: plugin Roundcube que realiza el canje y el login IMAP.
- `roundcube_sso_tokens`: almacena únicamente SHA-256 del token, con RLS y sin
  acceso para clientes.

Generar un secreto nuevo:

```bash
openssl rand -base64 48
```

El mismo valor debe configurarse como `ROUNDCUBE_SSO_SHARED_SECRET` en los
secretos de Supabase y en el `.env` privado del contenedor. También configurar:

```text
MOVI_ALLOWED_ORIGINS=https://app.movi.digital,https://beta.movi.digital
IONOS_IMAP_HOST=ssl://imap.ionos.mx
```

Aplicar la migración y desplegar:

```bash
supabase db push
supabase functions deploy roundcube-sso-token
supabase functions deploy roundcube-sso-redeem --no-verify-jwt
```

`roundcube-sso-redeem` desactiva la verificación JWT de plataforma porque
Roundcube no usa un JWT de usuario. La función valida obligatoriamente el
secreto compartido con comparación resistente a diferencias de tiempo. No debe
exponerse sin ese secreto.

En el frontend se puede definir `VITE_ROUNDCUBE_URL=/correo/`; ese es también
el valor predeterminado. El cierre de sesión de MOVI intenta cerrar primero la
sesión Roundcube y continúa aunque el servicio de correo no esté disponible.

Antes de habilitar usuarios:

- Confirmar que una URL de handoff solo funciona una vez.
- Confirmar que el mismo token falla después de 60 segundos.
- Confirmar que el endpoint de canje responde `401` sin el secreto.
- Confirmar que Nginx no registra query strings.
- Confirmar que cerrar MOVI elimina también la sesión Roundcube.

## Contactos MOVI

El canje SSO entrega también el directorio permitido para el usuario y los
contactos personales/compartidos visibles por oficina, grupo o empresa.
`movi_sso` sincroniza esos registros en dos grupos administrados de la libreta
SQL de Roundcube:

- `MOVI — Directorio`
- `MOVI — Compartidos`

Roundcube incluye ambos grupos en el autocompletado nativo de Para, CC y CCO.
Cada inicio SSO reemplaza exclusivamente los contactos dentro de esos grupos;
los contactos y grupos personales creados por el usuario no se alteran.

## Productividad y gestión personal

- El compositor abre en HTML y permite formato, listas y vínculos.
- Los borradores se guardan cada 30 segundos y también se recuperan desde el
  almacenamiento local ante cierres inesperados.
- Imágenes y PDF se abren en la vista previa segura del navegador.
- `j`, `k` y `r` navegan al mensaje siguiente, anterior y responden cuando el
  foco no está dentro de un campo de edición.
- ManageSieve en IONOS habilita filtros, reenvío y respuesta de ausencia sin
  guardar una segunda contraseña.
- La Papelera conserva 30 días; al cerrar sesión se eliminan únicamente
  mensajes anteriores a ese plazo y se expurgan los eliminados.
- La acción nativa **Imprimir** de Roundcube permite guardar un correo como PDF
  desde el diálogo del navegador para adjuntarlo como evidencia a un trámite.
