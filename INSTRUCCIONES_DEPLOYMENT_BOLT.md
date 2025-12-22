# Instrucciones de Deployment en Bolt

## Estado Actual ✅

Se han corregido los siguientes archivos para soportar ambos dominios:

1. **`src/main.tsx`**: Configurado para aceptar `app.movi.digital` como dominio principal y `agentedeseguros.online` para páginas públicas
2. **`scripts/postbuild.cjs`**: Actualizado para copiar `_redirects` a `dist/`
3. **`dist/_redirects`**: Generado correctamente con las reglas SPA
4. **`dist/404.html`**: Generado correctamente

## Pasos para Desplegar en Bolt

### 1. Eliminar Deployment Actual

1. En Bolt, ir a la sección de **Deployments** (ícono de cohete 🚀)
2. Localizar el deployment de `agentedeseguros.online`
3. Click en **Delete** o el ícono de basura
4. Confirmar la eliminación

### 2. Crear Nuevo Deployment

1. Click en **"New Deployment"** o **"Deploy"**
2. Bolt detectará automáticamente todos los archivos en `dist/`
3. Esperar 2-3 minutos mientras se completa el deployment

### 3. Configurar Dominios

Necesitas configurar **AMBOS** dominios en Bolt:

#### Dominio 1: app.movi.digital (Aplicación Principal)
- Este dominio será para la aplicación completa
- Login, dashboard, CRM, comisiones, etc.

#### Dominio 2: agentedeseguros.online (Páginas Públicas)
- Este dominio será para las páginas públicas de agentes
- Ejemplo: `agentedeseguros.online/juan-perez`

### 4. Verificar Deployment

Una vez completado, verificar:

- **app.movi.digital** → Debe cargar la aplicación (login)
- **app.movi.digital/dashboard** → Debe funcionar correctamente
- **agentedeseguros.online/ejemplo** → Debe cargar la página pública

## Configuración de Dominios

### En tu proveedor de DNS (ej: Cloudflare, GoDaddy, etc.)

Para **app.movi.digital**:
```
Tipo: CNAME
Nombre: app
Valor: [bolt-deployment-url]
```

Para **agentedeseguros.online**:
```
Tipo: CNAME
Nombre: @
Valor: [bolt-deployment-url]
```

## Archivos Críticos Verificados ✅

```
dist/
├── _redirects ✅          (SPA routing)
├── 404.html ✅            (Fallback)
├── index.html ✅          (Main app)
└── assets/
    ├── index-CgL5ehrM.js ✅
    └── index-D-yvVbPf.css ✅
```

## Lógica de Dominios

La aplicación ahora maneja los dominios así:

1. **app.movi.digital**: Permite todo (login, dashboard, todas las rutas)
2. **agentedeseguros.online**: Solo permite rutas con un slug único (ej: `/juan-perez`)
3. **localhost**: Permite todo (desarrollo)

## Troubleshooting

### Si app.movi.digital no funciona:
- Verificar que el CNAME esté configurado correctamente
- Esperar propagación DNS (puede tardar hasta 48 horas)
- Verificar en Bolt que el dominio esté correctamente asignado

### Si agentedeseguros.online no funciona:
- Mismos pasos que arriba
- Verificar que el slug del agente exista en la base de datos

### Si ambos dominios redirigen a www.movi.digital:
- Verificar que los dominios estén correctamente configurados en Bolt
- Limpiar caché del navegador

## Soporte

Si tienes problemas:
1. Verificar la consola del navegador (F12)
2. Verificar que las variables de entorno en Bolt estén configuradas
3. Verificar que Supabase esté respondiendo correctamente
