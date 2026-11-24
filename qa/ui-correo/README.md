# Banco de pruebas del Correo y WhatsApp (datos simulados)

Sirve para ver y probar las pantallas **sin sesión real**: la sesión, Supabase
y el servidor de correo se sustituyen por simulaciones (`mockAuth.tsx`,
`mockSupabase.ts` y el `fetch` de `correo.tsx`). Nada sale a internet.

## Prueba automática

```
node qa/ui-correo/prueba.mjs
```

Revisa que, con el correo rediseñado:

- **Agregar a trámite** sigue llamando a `add-email-to-tramite` con uid, carpeta,
  Message-ID, remitente, cuenta y adjuntos del correo (también **en lote**: un
  modal por correo).
- **Crear trámite** sigue pasando por `analyze-email-for-tramite` y
  `create-tramite-from-email` con los mismos datos.
- El **remitente** se identifica (tarjeta en la lectura, etiqueta en la lista).
- No hay errores de JavaScript.

Lógica pura con su propia autocomprobación:

```
npx tsx src/lib/correo/correo.test.mjs
npx tsx src/lib/buzonWhatsApp.test.mjs
npx tsx src/lib/unifiedContactCenter.test.mjs
npx tsx supabase/functions/ionos-webmail/snippet.test.mjs
```

## Verlo en el navegador

```
npx vite --config qa/ui-correo/vite.config.ts
```

- Correo: http://localhost:5199/qa/ui-correo/correo.html (`?dark=1` para modo oscuro)
- Lista de WhatsApp: http://localhost:5199/qa/ui-correo/wa.html

Playwright: el de `qa/` (`npm install` dentro de `qa/`) o el instalado en el equipo.
