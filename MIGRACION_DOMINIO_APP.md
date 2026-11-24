# Migración de dominio: movi.digital → app.movi.digital

**Objetivo:** Mover la plataforma MOVI que actualmente está en `movi.digital` al subdominio
`app.movi.digital`, dejando el dominio raíz libre para el sitio de marketing (WordPress).

**Tiempo estimado:** 20–30 minutos  
**Requiere acceso a:** Plesk, Dashboard de Supabase  
**Requiere acceso a:** Terminal / SSH del servidor (solo para el rebuild)

---

## ¿Qué es lo que vamos a hacer?

Actualmente, cuando alguien entra a `movi.digital`, ve la plataforma interna de JIRO.
Al terminar estos pasos, la plataforma va a vivir en `app.movi.digital` y `movi.digital`
quedará libre para usarlo como sitio web de presentación (landing page, WordPress, etc.).

---

## PASO 1 — Crear el subdominio en Plesk

**¿Qué hace este paso?**
Le dice al servidor que el subdominio `app.movi.digital` existe y que debe mostrar
la plataforma cuando alguien lo visita.

**Cómo hacerlo:**

1. Entra a tu panel de **Plesk**
2. En el menú de la izquierda, haz clic en **"Dominios"**
3. Haz clic en **`movi.digital`**
4. Busca la opción **"Subdominios"** y haz clic en **"Agregar subdominio"**
5. En el campo **"Nombre del subdominio"** escribe: `app`
6. En **"Raíz del documento"** (Document Root), escribe exactamente la misma carpeta
   que usa `movi.digital` hoy — por ejemplo: `/var/www/vhosts/movi.digital/httpdocs`
   > Si no sabes cuál es esa carpeta, entra a `movi.digital` en Plesk,
   > ve a "Hosting & DNS" y ahí aparece la ruta del Document Root.
7. Haz clic en **"Aceptar"** o **"Guardar"**

Al terminar este paso, el subdominio `app.movi.digital` ya existe en el servidor,
aunque todavía no tiene certificado de seguridad (HTTPS).

---

## PASO 2 — Activar HTTPS en el subdominio (certificado SSL)

**¿Qué hace este paso?**
Sin esto, el navegador mostraría una advertencia de "sitio no seguro" al entrar a
`app.movi.digital`. Plesk tiene una herramienta gratuita llamada **Let's Encrypt**
que instala el certificado en segundos.

**Cómo hacerlo:**

1. En Plesk, entra al subdominio **`app.movi.digital`** que acabas de crear
2. Busca la sección **"Certificados SSL/TLS"** o **"Seguridad"**
3. Haz clic en **"Let's Encrypt"**
4. Marca la casilla **"Proteger el subdominio"** si aparece
5. Marca también **"Redirigir de HTTP a HTTPS"** (esto hace que siempre use la versión segura)
6. Haz clic en **"Instalar"** o **"Obtener"**

Plesk lo instala automáticamente. Cuando termine, la plataforma ya se puede visitar
en `https://app.movi.digital` con el candado verde.

---

## PASO 3 — Actualizar las URLs de autenticación en Supabase

**¿Qué hace este paso?**
La plataforma usa Supabase como base de datos y sistema de login. Supabase tiene una
lista de dominios autorizados desde donde se puede iniciar sesión. Si no actualizamos
esta lista, los usuarios verán un error al intentar entrar por el nuevo subdominio.

**Cómo hacerlo:**

1. Entra al **Dashboard de Supabase**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona el proyecto **jiromovi** (el que tiene el ID `qhwvuuyjhcennqccgvse`)
3. En el menú de la izquierda, ve a **"Authentication"**
4. Haz clic en **"URL Configuration"**
5. En el campo **"Site URL"**, cambia `https://movi.digital` por `https://app.movi.digital`
6. En la sección **"Redirect URLs"**, agrega esta línea nueva:
   ```
   https://app.movi.digital/**
   ```
   > El `**` al final es importante, significa "cualquier página dentro de ese dominio".
7. Haz clic en **"Save"**

---

## PASO 4 — Reconstruir y redesplegar la plataforma

**¿Qué hace este paso?**
La plataforma fue construida (compilada) con la URL antigua. Necesitamos reconstruirla
indicándole que su nueva dirección es `app.movi.digital`. Esto genera los archivos
finales que el servidor va a servir.

**Cómo hacerlo:**

Desde una terminal conectada al servidor (SSH), o desde tu computadora si tienes
el proyecto localmente con acceso SSH a Plesk:

1. Ve a la carpeta del proyecto `jiromovi-main`
2. Asegúrate de que la variable de entorno `VITE_APP_URL` esté configurada como
   `https://app.movi.digital`.
   > En Plesk esto se configura en: `app.movi.digital` → "Variables de entorno" o
   > en el archivo `.env` del proyecto.
3. Ejecuta el comando de construcción:
   ```
   npm run build
   ```
4. Cuando termine, los archivos nuevos estarán en la carpeta `dist/`
5. Copia (o despliega) esos archivos a la carpeta raíz del subdominio en el servidor

> Si el deploy en Plesk ya está configurado como "Git + build automático", solo
> ejecuta el build y Plesk toma los archivos de `dist/` automáticamente.

---

## PASO 5 — Redirigir el dominio antiguo al nuevo

**¿Qué hace este paso?**
Para que los usuarios que todavía entren a `movi.digital` lleguen solos al nuevo
subdominio sin ver un error. También le avisa a Google que el sitio se movió
permanentemente (redirección 301), lo que preserva el posicionamiento.

**Cómo hacerlo:**

1. En Plesk, entra al dominio **`movi.digital`** (el raíz, no el subdominio)
2. Busca la sección **"Hosting & DNS"** → **"Redirecciones"** (o "Hosting Settings")
3. Activa la opción de **redirigir a otro dominio**
4. Tipo de redirección: **301 (Movido permanentemente)**
5. URL de destino: `https://app.movi.digital`
6. Guarda

Desde este momento, cualquiera que entre a `movi.digital` será enviado automáticamente
a `app.movi.digital`.

---

## PASO 6 — Verificar que todo funciona

Antes de considerar la migración terminada, revisa estas cosas:

- [ ] Entrar a `https://app.movi.digital` y ver que la plataforma carga correctamente
- [ ] Intentar iniciar sesión con un usuario real
- [ ] Verificar que el candado de seguridad (HTTPS) aparece en el navegador
- [ ] Entrar a `https://movi.digital` y confirmar que redirige a `app.movi.digital`
- [ ] Abrir una notificación para confirmar que los links dentro de la plataforma
      apuntan al nuevo subdominio

---

## Resumen visual

```
ANTES:
  movi.digital  →  Plataforma MOVI (jiromovi)

DESPUÉS:
  movi.digital      →  redirige a app.movi.digital
  app.movi.digital  →  Plataforma MOVI (jiromovi)
  (movi.digital libre para WordPress / landing)
```

---

## ¿Qué NO cambia con esta migración?

- La base de datos (Supabase): sin cambios, todos los datos se conservan
- Los usuarios y contraseñas: sin cambios
- El sistema de WhatsApp: sin cambios
- El CP (Central de Producción en `produccion.movi.digital`): sin cambios
- Los archivos e imágenes del sitio WordPress: sin cambios

---

*Documento generado el 2026-06-23*
