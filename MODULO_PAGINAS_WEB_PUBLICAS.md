# Módulo de Páginas Web Públicas - MOVI Digital

## Descripción General

Sistema completo que permite a cada usuario de MOVI Digital tener su propia landing page profesional pública bajo el dominio **agentedeseguros.online**, con URL personalizada, diseño moderno y responsivo, optimizado para SEO y enfocado en conversión.

## Características Principales

- **URL personalizada** con slug único: `agentedeseguros.online/soy/{slug}`
- **Configuración por usuario** de colores, aseguradoras, ramos y texto personalizado
- **Vista previa en tiempo real** antes de publicar
- **Diseño totalmente responsivo** (mobile-first)
- **Optimizado para SEO** con meta tags dinámicos
- **Catálogos administrados** centralmente por el admin
- **Botones CTA** enfocados en WhatsApp y cotización
- **Compatibilidad con HelmetProvider** para meta tags

## Estructura del Módulo

### 1. Base de Datos

#### Tablas Creadas

**`web_page_insurers`** - Catálogo de Aseguradoras (Admin)
- `id` (uuid, pk)
- `name` (text) - Nombre de la aseguradora
- `logo_url` (text) - URL del logo
- `website_url` (text, nullable) - Sitio web oficial
- `display_order` (integer) - Orden de visualización
- `is_active` (boolean) - Activa/Inactiva
- `created_at`, `updated_at`

**`web_page_categories`** - Catálogo de Ramos (Admin)
- `id` (uuid, pk)
- `name` (text) - Nombre del ramo
- `slug` (text, unique) - Slug para SEO
- `icon_url` (text, nullable) - URL del icono
- `card_title` (text) - Título para la card
- `card_description` (text) - Descripción corta
- `display_order` (integer) - Orden
- `is_active` (boolean)
- `created_at`, `updated_at`

**`user_web_pages`** - Configuración por Usuario
- `id` (uuid, pk)
- `user_id` (uuid, fk → usuarios.id)
- `primary_color` (text) - Color primario hex
- `secondary_color` (text) - Color secundario hex
- `custom_text` (text[]) - Hasta 5 párrafos
- `is_published` (boolean) - Publicada o no
- `created_at`, `updated_at`

**`user_web_page_insurers`** - Aseguradoras seleccionadas
- `user_web_page_id` (uuid)
- `insurer_id` (uuid)
- PK compuesta

**`user_web_page_categories`** - Ramos seleccionados
- `user_web_page_id` (uuid)
- `category_id` (uuid)
- PK compuesta

#### Campo Agregado a `usuarios`

**`web_slug`** (text, unique, nullable)
- Slug personalizado para URL pública
- Solo minúsculas, números y guiones
- Ejemplo: `segurosstudio`
- **Solo editable por Administradores**

#### Validaciones de Base de Datos

```sql
-- Formato del slug
CHECK (web_slug ~ '^[a-z0-9-]+$' OR web_slug IS NULL)

-- Colores hex válidos
CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$')
CHECK (secondary_color ~ '^#[0-9a-fA-F]{6}$')

-- Máximo 5 párrafos
CHECK (array_length(custom_text, 1) IS NULL OR array_length(custom_text, 1) <= 5)
```

#### Función RPC

**`get_public_web_page_by_slug(p_slug text)`**
- Retorna todos los datos necesarios para renderizar la página pública
- Incluye: usuario, configuración, aseguradoras, ramos
- Solo retorna si `is_published = true` y `estado = activo`

### 2. Storage

**Bucket: `web-page-assets`**
- Público
- Almacena logos de aseguradoras e iconos de ramos
- Admin puede subir/actualizar/eliminar
- Políticas de seguridad configuradas

### 3. Rutas de la Aplicación

| Ruta | Acceso | Descripción |
|------|--------|-------------|
| `/catalogos-web` | Admin | Gestión de aseguradoras y ramos |
| `/mi-pagina-web` | Todos | Configuración personal de página |
| `/soy/:slug` | Público | Página pública del asesor |

### 4. Componentes Principales

#### Admin: CatalogosWeb
**Ubicación:** `src/pages/CatalogosWeb.tsx`

**Funcionalidades:**
- Crear, editar, activar/desactivar aseguradoras
- Crear, editar, activar/desactivar ramos
- Subir logos e iconos
- Reordenar elementos (display_order)
- Solo accesible para administradores

**Features:**
- Tabs para separar Aseguradoras y Ramos
- Formularios modales con validación
- Upload directo de imágenes a storage
- Vista previa de logos/iconos

#### Usuario: MiPaginaWeb
**Ubicación:** `src/pages/MiPaginaWeb.tsx`

**Funcionalidades:**
- Configurar colores primario y secundario
- Seleccionar aseguradoras (multi-select)
- Seleccionar ramos (multi-select)
- Escribir hasta 5 párrafos personalizados
- Publicar/despublicar página
- **Vista previa en vivo** en la misma página

**Features:**
- Layout de 2 columnas (desktop): config + preview
- Preview actualizado en tiempo real
- Validación de slug asignado
- Alerta si no tiene slug configurado
- Link directo a la página pública si está publicada

#### Público: PaginaPublicaAsesor
**Ubicación:** `src/pages/PaginaPublicaAsesor.tsx`

**Funcionalidades:**
- Renderiza la página pública completa
- SEO optimizado con react-helmet-async
- Totalmente responsive
- CTAs prominentes (WhatsApp, cotizar)
- Formulario de contacto
- Footer con información de contacto

**Secciones:**
1. Hero con foto circular y nombre
2. Grid de aseguradoras
3. Formulario de cotización
4. Cards de ramos/servicios
5. Texto personalizado del asesor
6. Texto SEO dinámico
7. Footer
8. Barra sticky mobile (WhatsApp + llamar)

#### Preview: PublicWebPagePreview
**Ubicación:** `src/components/webPages/PublicWebPagePreview.tsx`

**Funcionalidades:**
- Componente reutilizable para vista previa
- Mismo diseño que la página pública real
- Acepta props de configuración
- Se usa en "Mi Página Web" para preview en vivo

### 5. Utilidades y Tipos

#### webPagesTypes.ts
Define todos los tipos TypeScript:
- `WebPageInsurer`
- `WebPageCategory`
- `UserWebPage`
- `PublicWebPageData`
- `UserWebPageConfig`
- Constantes: `DEFAULT_COLORS`, `DEFAULT_TEXT`

#### webPagesUtils.ts
Funciones helper:
- `getActiveInsurers()`, `getAllInsurers()`
- `createInsurer()`, `updateInsurer()`
- `getActiveCategories()`, `getAllCategories()`
- `createCategory()`, `updateCategory()`
- `getUserWebPageConfig(userId)`
- `saveUserWebPageConfig(userId, config)`
- `getPublicWebPageBySlug(slug)`
- `validateSlug(slug)` - Validación formato slug
- `validateHexColor(color)` - Validación colores
- `checkSlugAvailability(slug)` - Verificar disponibilidad

### 6. Reglas de Negocio

#### Slugs
- **Solo administradores** pueden asignar/editar slugs
- Formato: minúsculas, números, guiones
- Único en todo el sistema
- Mínimo 3 caracteres, máximo 50
- No puede comenzar/terminar con guión
- No puede tener guiones consecutivos

#### Colores
- Formato hexadecimal: `#RRGGBB`
- Valores por defecto:
  - Primario: `#2563eb` (azul)
  - Secundario: `#7c3aed` (morado)

#### Contenido
- Texto personalizado: hasta 5 párrafos
- Si no hay texto, se muestra texto por defecto profesional
- Aseguradoras: ilimitadas (solo activas disponibles)
- Ramos: ilimitados (solo activos disponibles)

#### Publicación
- Solo se puede publicar si hay slug asignado
- La página solo es visible si:
  - `is_published = true`
  - Usuario `estado = activo`
  - Slug existe y es válido

#### Foto de Perfil
- Se usa la foto del perfil del usuario en MOVI
- No se configura desde "Mi Página Web"
- Si NO existe foto → no se muestra nada (sin placeholder)
- Forma: círculo
- Tamaños responsivos: 96-120px (mobile), 140-180px (desktop)

### 7. Redirecciones

**Implementadas en el routing:**

| URL | Redirección | Razón |
|-----|-------------|-------|
| `agentedeseguros.online/` | → `www.movi.digital` | Sin slug |
| `agentedeseguros.online/{slug-inválido}` | → `www.movi.digital` | Slug no existe |
| `agentedeseguros.online/soy/{slug}` sin publicar | → `www.movi.digital` | No publicado |

### 8. Defaults del Sistema

#### Ramos por Defecto (Pre-cargados)
1. Auto
2. GMM (Gastos Médicos Mayores)
3. Vida
4. Hogar
5. PYME

#### Texto Default (si usuario no escribe)
```typescript
[
  'Como tu asesor personal de seguros, mi compromiso es brindarte atención especializada y soluciones a la medida de tus necesidades.',
  'Trabajo con las mejores aseguradoras del mercado para ofrecerte opciones competitivas y coberturas completas.',
  'Mi objetivo es que tomes decisiones informadas y encuentres el seguro perfecto para proteger lo que más valoras.',
  'Cuento con años de experiencia en el sector asegurador y estoy certificado por las principales instituciones.',
  'Contáctame por WhatsApp para una cotización personalizada sin compromiso.'
]
```

### 9. SEO y Performance

#### Meta Tags Dinámicos
```typescript
<title>{nombre} | Asesor de Seguros | {oficina}</title>
<meta name="description" content="{texto_seo}" />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:image" content="{foto_perfil}" />
<link rel="canonical" href="https://agentedeseguros.online/soy/{slug}" />
```

#### Texto SEO Generado
```
"{Nombre} de {Oficina} te ayuda a cotizar y contratar seguros de auto, vida y gastos médicos mayores con atención personalizada por WhatsApp."
```

#### Optimizaciones
- Imágenes lazy loading
- Formato WEBP recomendado
- Tamaño de logos optimizado al subir
- Meta tags con react-helmet-async
- URL limpia y amigable

### 10. Diseño y UX

#### Principios de Diseño
- **Mobile-first**: diseñado primero para móvil
- **Espacios amplios**: padding y margin generosos
- **Cards con sombra** suave
- **Bordes redondeados** consistentes
- **Tipografía legible**: mínimo 16px
- **Colores dinámicos**: según configuración del usuario

#### Breakpoints Responsivos
- Mobile: 360px, 390px
- Tablet: 768px
- Desktop: 1024px, 1280px, 1536px

#### Botones CTA
- Tamaño mínimo: 44px (táctil)
- Estados hover y focus claros
- Colores según configuración
- Iconos de Lucide React

#### Barra Sticky Mobile
- Fija en la parte inferior
- Solo visible en móvil
- 2 botones: WhatsApp + Llamar
- Colores: primario + secundario

### 11. Navegación del Sistema

#### Menú Principal
**Para todos los usuarios:**
- "Mi Página Web" (ícono: Globe2)

**Solo para administradores:**
- "Catálogos Web" (ícono: Database)

#### UserModal Actualizado
Campo nuevo visible solo para Admin:
- **Slug Página Web** (opcional)
- Validación en tiempo real
- Preview de URL: `agentedeseguros.online/soy/{slug}`
- Auto-sanitización: solo minúsculas, números, guiones

### 12. Flujo de Uso

#### Como Administrador:
1. Ir a **Catálogos Web**
2. Agregar aseguradoras con logos
3. Agregar ramos con descripciones
4. Ir a **Usuarios**
5. Editar un usuario y asignarle un slug único
6. Guardar

#### Como Usuario/Agente:
1. El admin le asigna un slug
2. Ir a **Mi Página Web**
3. Configurar colores (o dejar defaults)
4. Seleccionar aseguradoras con las que trabaja
5. Seleccionar tipos de seguro que ofrece
6. Escribir texto personalizado (opcional)
7. Ver preview en vivo
8. Activar switch "Publicar"
9. Guardar
10. Compartir URL: `agentedeseguros.online/soy/{su-slug}`

#### Como Visitante Público:
1. Visitar `agentedeseguros.online/soy/{slug}`
2. Ver perfil del asesor
3. Explorar aseguradoras y servicios
4. Llenar formulario de cotización
5. Contactar por WhatsApp o teléfono

### 13. Archivos del Módulo

#### Migraciones
- `create_public_web_pages_module.sql` - Esquema completo
- `create_web_page_assets_storage.sql` - Bucket de storage

#### Frontend - Páginas
- `src/pages/CatalogosWeb.tsx` - Admin
- `src/pages/MiPaginaWeb.tsx` - Usuario
- `src/pages/PaginaPublicaAsesor.tsx` - Público

#### Frontend - Componentes
- `src/components/webPages/PublicWebPagePreview.tsx` - Preview
- `src/components/UserModal.tsx` - Actualizado con slug

#### Frontend - Lib
- `src/lib/webPagesTypes.ts` - Tipos TypeScript
- `src/lib/webPagesUtils.ts` - Funciones helper

#### Configuración
- `src/App.tsx` - Rutas agregadas, HelmetProvider
- `src/components/Layout.tsx` - Menú actualizado
- `package.json` - react-helmet-async instalado

### 14. Seguridad

#### RLS (Row Level Security)
- **Catálogos**: Admin gestiona, todos leen activos, público puede leer
- **Configuración**: Usuario solo ve/edita la suya
- **Páginas públicas**: Lectura pública si `is_published = true`
- **Storage**: Admin sube, todos ven

#### Validaciones
- Slug único validado en DB
- Formato de slug validado con regex
- Colores hex validados
- Máximo 5 párrafos enforced en DB
- Solo admin puede asignar slugs

#### Datos Expuestos Públicamente
- Nombre completo del usuario
- Email laboral
- Celular laboral
- Foto de perfil (si existe)
- Nombre de oficina
- Aseguradoras seleccionadas
- Ramos seleccionados
- Texto personalizado
- **NO se expone**: email personal, celular personal, datos bancarios

### 15. Testing Recomendado

#### QA Checklist
- [ ] Usuario con foto / sin foto
- [ ] Slug válido / inválido
- [ ] Mobile / tablet / desktop
- [ ] Colores extremos (contraste)
- [ ] 1 ramo vs 12 ramos
- [ ] 1 aseguradora vs 20 aseguradoras
- [ ] Aseguradora desactivada por admin (debe desaparecer)
- [ ] Cambio de foto en perfil (debe reflejarse)
- [ ] Preview vs página pública (iguales)
- [ ] Redirecciones correctas
- [ ] SEO meta tags (view source)
- [ ] WhatsApp links funcionan
- [ ] Formulario responsive
- [ ] Barra sticky mobile
- [ ] Texto default si no escribe
- [ ] Slug duplicado (debe rechazarse)
- [ ] Publicar sin slug (debe alertar)

### 16. Próximos Pasos (Opcional)

#### Mejoras Futuras Sugeridas
1. **Analytics**: Tracking de visitas por slug
2. **Formulario funcional**: Capturar leads en DB
3. **Notificación al asesor**: Email/WhatsApp cuando alguien cotiza
4. **Plantillas de diseño**: Múltiples layouts para elegir
5. **Sección testimonios**: Reviews de clientes
6. **Blog personal**: Artículos por asesor
7. **Integración con CRM**: Leads automáticos al CRM
8. **Estadísticas**: Dashboard con métricas de página
9. **A/B Testing**: Probar diferentes CTAs
10. **Chat en vivo**: Widget de chat en página pública

### 17. Soporte y Mantenimiento

#### Para Agregar Nueva Aseguradora
1. Admin → Catálogos Web → Tab Aseguradoras
2. Click "Nueva Aseguradora"
3. Llenar: nombre, subir logo, URL opcional
4. Guardar
5. Aparece disponible para todos los usuarios inmediatamente

#### Para Agregar Nuevo Ramo
1. Admin → Catálogos Web → Tab Ramos
2. Click "Nuevo Ramo"
3. Llenar: nombre, slug, título card, descripción
4. Opcionalmente subir icono
5. Guardar
6. Aparece disponible para todos los usuarios inmediatamente

#### Para Desactivar Aseguradora/Ramo
1. Admin → Catálogos Web
2. Localizar el elemento
3. Toggle switch a "Inactivo"
4. Se oculta automáticamente de:
   - Selector de usuarios en "Mi Página Web"
   - Páginas públicas ya publicadas

#### Troubleshooting Común

**Problema:** Usuario no puede publicar página
- **Solución:** Verificar que admin le haya asignado un slug

**Problema:** Página pública muestra "not found"
- **Soluciones:**
  - Verificar que `is_published = true`
  - Verificar que usuario `estado = activo`
  - Verificar que slug sea correcto y único

**Problema:** Aseguradora no aparece en selector
- **Solución:** Verificar que `is_active = true` en catálogo

**Problema:** Preview no se actualiza
- **Solución:** Es instantáneo, verificar que el estado en React se esté actualizando

**Problema:** Logo distorsionado
- **Solución:** Los logos se optimizan al subir, verificar aspect ratio original

### 18. Conclusión

Este módulo proporciona una solución completa, profesional y escalable para que cada usuario de MOVI Digital tenga su propia presencia web pública, manteniendo consistencia de marca, calidad visual y facilidad de gestión centralizada.

El sistema está diseñado para:
- **Facilitar la adopción**: Interfaz intuitiva
- **Garantizar calidad**: Control centralizado de contenido
- **Optimizar conversión**: CTAs prominentes y formularios
- **Escalar sin esfuerzo**: Arquitectura modular y extensible
- **Mantener seguridad**: RLS y validaciones robustas

**Dominio:** agentedeseguros.online
**Formato URL:** `/soy/{slug}`
**Estado:** Implementado y funcional ✅
