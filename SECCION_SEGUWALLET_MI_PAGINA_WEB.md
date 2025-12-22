# Sección Seguwallet en Mi Página Web

**Fecha:** 22 de Diciembre de 2024
**Estado:** ✅ IMPLEMENTADO

## Resumen

Se agregó una nueva sección promocional de Seguwallet a todas las páginas públicas de usuario (landing pages personales). La sección aparece después de "Sobre Mí" y antes de "¿Listo para proteger lo que más valoras?".

## Ubicación en la Landing

**Orden de bloques:**
1. Hero (foto del asesor + formulario)
2. Aseguradoras de Confianza
3. Ramos que Ofrezco
4. Sobre Mí
5. ✅ **Seguwallet (NUEVA)**
6. ¿Listo para proteger lo que más valoras?
7. Footer

## Contenido de la Sección

### Título
**"Descarga Seguwallet, nuestra app"**

### Textos
- "Todas tus pólizas contratadas en Grupo JIRO, en un solo lugar."
- "Accede, consulta y mantente al día con tus pólizas desde tu celular."

### Elementos Visuales

#### Logo de Seguwallet
- **URL:** `https://movi.digital/wp-content/uploads/2025/12/Recurso-1.png`
- **Alt:** "Seguwallet"
- **Link:** `https://www.seguwallet.mx`
- **Interacción:** Hover scale 105%

#### Imagen Mockup
- **URL:** `https://movi.digital/wp-content/uploads/2025/02/seguwallet-movidigital.png`
- **Alt:** "Seguwallet app en iOS y Android"
- **Lazy loading:** Habilitado
- **Interacción:** Hover scale 105%

### Botones de Descarga

#### App Store
- **URL:** `https://apps.apple.com/mx/app/seguwallet-by-movi-digital/id6744545607`
- **Icono:** Apple logo SVG
- **Estilo:** Botón negro con hover scale y shadow

#### Google Play
- **URL:** `https://play.google.com/store/apps/details?id=com.sicasonline.Seguwallet&pcampaignid=web_share`
- **Icono:** Google Play logo SVG
- **Estilo:** Botón negro con hover scale y shadow

#### CTA Secundario
- **Texto:** "Conoce más sobre Seguwallet"
- **URL:** `https://www.seguwallet.mx`
- **Estilo:** Link con color secundario + flecha
- **Interacción:** Hover aumenta gap entre texto y flecha

## Diseño Responsive

### Desktop/Tablet (lg+)
- **Layout:** 2 columnas (60/40)
- **Columna Izquierda:** Logo + título + texto + botones
- **Columna Derecha:** Imagen mockup
- **Alineación:** Izquierda texto, derecha imagen

### Mobile
- **Layout:** 1 columna vertical
- **Orden:**
  1. Logo (centrado)
  2. Título (centrado)
  3. Textos (centrados)
  4. Botones (full width, apilados verticalmente)
  5. Imagen mockup (centrada, max-width: sm)

## Estilo Visual

### Container
- **Fondo sección:** Color secundario al 5% de opacidad
- **Card interior:** Fondo blanco, rounded-3xl, shadow-xl
- **Borde:** Primary color al 10% de opacidad
- **Padding:** Responsive (6/8/12)

### Tipografía
- **Título:** 2xl/3xl/4xl, font-bold, primary color
- **Texto principal:** base/lg, gray-700
- **Texto secundario:** sm/base, gray-600

### Botones de Store
- **Fondo:** Negro (#000000)
- **Texto:** Blanco
- **Forma:** rounded-xl
- **Padding:** px-6 py-3.5
- **Iconos:** SVG 7x7
- **Hover:** scale-105 + shadow-lg
- **Gap:** 3 (12px)

### Link Secundario
- **Color:** Secondary color dinámico
- **Font:** font-bold
- **Hover:** gap aumenta de 2 a 3

## Accesibilidad

✅ **Alt texts descriptivos:**
- Logo: "Seguwallet"
- Mockup: "Seguwallet app en iOS y Android"

✅ **Enlaces externos:**
- `target="_blank"`
- `rel="noopener noreferrer"`

✅ **Lazy loading:**
- Imagen mockup carga diferida para performance

✅ **Contraste:**
- Textos cumplen WCAG 2.1 AA
- Botones negros con texto blanco (contraste máximo)

## Performance

### Optimizaciones
- **Lazy loading** en imagen mockup
- **URLs externas** para imágenes (CDN de movi.digital)
- **SVG inline** para iconos de stores (reducen requests)
- **Hover transitions** optimizadas con transform

### Tamaño
- Logo Seguwallet: ~20-30 KB (estimado)
- Mockup: ~150-200 KB (estimado, lazy loaded)
- SVG iconos: <5 KB (inline)

## Archivos Modificados

### 1. PaginaPublicaAsesor.tsx
**Ruta:** `src/pages/PaginaPublicaAsesor.tsx`
**Líneas:** 587-677 (nueva sección insertada)
**Función:** Página pública que se accede por `/{slug}`

### 2. PublicWebPagePreview.tsx
**Ruta:** `src/components/webPages/PublicWebPagePreview.tsx`
**Líneas:** 432-522 (nueva sección insertada)
**Función:** Vista previa en módulo "Mi página web"

## Comportamiento

### Visibilidad
- ✅ Aparece en **todas** las páginas públicas `/{slug}`
- ✅ Aparece en la **vista previa** del módulo "Mi página web"
- ✅ **No depende** de configuración del usuario
- ✅ Es **estática** (mismo contenido para todos)

### Links
- ✅ Logo → seguwallet.mx (nueva pestaña)
- ✅ App Store → Link directo a descarga iOS (nueva pestaña)
- ✅ Google Play → Link directo a descarga Android (nueva pestaña)
- ✅ "Conoce más" → seguwallet.mx (nueva pestaña)

## Testing Checklist

Para verificar la implementación:

### Desktop
- [ ] La sección aparece después de "Sobre Mí"
- [ ] Layout de 2 columnas funciona correctamente
- [ ] Logo está alineado a la izquierda
- [ ] Imagen mockup está alineada a la derecha
- [ ] Botones tienen hover effect (scale + shadow)
- [ ] Links abren en nueva pestaña

### Tablet (768px - 1023px)
- [ ] Layout mantiene 2 columnas
- [ ] Elementos mantienen proporciones
- [ ] Textos son legibles
- [ ] Botones son clickeables

### Mobile (<768px)
- [ ] Layout cambia a 1 columna
- [ ] Elementos están centrados
- [ ] Botones son full width
- [ ] Imagen mockup tiene max-width controlado
- [ ] Todos los links funcionan correctamente

### Funcionalidad
- [ ] Logo clickeable → seguwallet.mx
- [ ] Botón App Store → Link iOS funciona
- [ ] Botón Google Play → Link Android funciona
- [ ] Link "Conoce más" → seguwallet.mx
- [ ] Lazy loading de imagen funciona
- [ ] Vista previa en "Mi página web" muestra sección

## Notas Técnicas

### Colores Dinámicos
La sección usa los colores personalizados del usuario:
- `primaryColor` → Título y borde del card
- `secondaryColor` → Fondo de sección (5% opacity) + link "Conoce más"

### Función Helper
Usa `createColorVariant()` de `animationUtils.ts` para generar variantes de color con opacidad controlada.

### Responsive Breakpoints
- `sm:` → 640px
- `md:` → 768px
- `lg:` → 1024px

## Próximos Pasos (Opcional)

Si en el futuro se requiere:
1. **Analytics:** Agregar tracking de clicks en botones
2. **A/B Testing:** Diferentes variantes de copy
3. **Localización:** Versión en inglés
4. **Personalización:** Permitir ocultar la sección por usuario

---

**Implementado por:** Claude Assistant
**Build Status:** ✅ Exitoso (sin errores)
**Tamaño Bundle:** +8 KB aprox (imágenes externas no cuentan)
