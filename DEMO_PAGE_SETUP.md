# Página de Demostración - Configuración

## Problema Resuelto

Se identificó y corrigió un problema con la página de demostración en `/demo`. El problema era que:

1. Los enlaces internos usaban rutas relativas (`href="/"`) que estaban causando redirecciones incorrectas
2. El archivo `_redirects` de Netlify estaba redirigiendo todas las rutas (incluido `/demo/*`) al `index.html` de React Router, lo que causaba que la URL se transformara incorrectamente

## Solución Implementada

### 1. Enlaces Absolutos en la Página Demo

Se actualizaron todos los enlaces en `/public/demo/index.html` para usar URLs absolutas:

```html
<!-- Antes -->
<a href="/">Acceder al Sistema</a>

<!-- Después -->
<a href="https://agentedeseguros.online">Acceder al Sistema</a>
```

Esto asegura que los enlaces siempre dirijan correctamente al sistema principal, sin importar desde dónde se acceda a la página de demostración.

### 2. Configuración de Netlify Redirects

Se modificó el archivo `_redirects` para excluir la carpeta `/demo/*` de la redirección catch-all:

```
# Antes
/*    /index.html   200

# Después
/demo/*    /demo/:splat   200
/*    /index.html   200
```

**Explicación:**
- La primera línea `/demo/*` instruye a Netlify para servir los archivos dentro de `/demo/` directamente sin pasar por React Router
- La segunda línea mantiene el comportamiento SPA para todas las demás rutas
- El orden es importante: las reglas más específicas deben ir primero

## Estructura de Archivos

```
public/
  ├── demo/
  │   └── index.html          # Página de demostración HTML estática
  └── _redirects              # Configuración de redirecciones de Netlify

dist/                         # Generado automáticamente con `npm run build`
  ├── demo/
  │   └── index.html
  └── _redirects
```

## Ventajas de Esta Solución

1. **No requiere redespliegue manual**: Los archivos se copian automáticamente a `dist/` durante el build
2. **Página independiente**: No depende de React Router ni de JavaScript del sistema principal
3. **Carga rápida**: HTML estático con Tailwind CSS vía CDN
4. **Fácil mantenimiento**: Un solo archivo HTML que se puede editar directamente

## URLs de Acceso

- **Página de demostración**: `https://agentedeseguros.online/demo`
- **Sistema principal**: `https://agentedeseguros.online`

## Cómo Actualizar la Página de Demostración

1. Editar el archivo: `/public/demo/index.html`
2. Ejecutar build: `npm run build`
3. Los cambios se aplicarán automáticamente en el siguiente despliegue

## Verificación

Después del despliegue, verifica que:

1. `https://agentedeseguros.online/demo` muestra la página de demostración correctamente
2. Los botones "Acceder al Sistema" e "Ingresar al Sistema" redirigen a `https://agentedeseguros.online`
3. La URL no se transforma o corrompe durante la navegación
