# Configuración Bolt.new + Supabase

Esta plataforma está configurada para funcionar con **Bolt.new** y **Supabase**.

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    MOVI Digital                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Frontend (React + Vite)                                 │
│  └─ Bolt.new                                             │
│     └─ Lee variables del archivo .env                   │
│        └─ Conecta con Supabase                          │
│                                                          │
│  Backend (Supabase)                                      │
│  ├─ Base de Datos (PostgreSQL)                          │
│  ├─ Autenticación                                       │
│  ├─ Storage (archivos)                                  │
│  └─ Edge Functions (serverless)                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Variables de Entorno

El archivo `.env` en la raíz del proyecto contiene:

```env
VITE_SUPABASE_URL=https://qhwvuuyjhcennqccgvse.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### ¿Dónde se usan?

- **En desarrollo (Bolt.new):** Se leen directamente del archivo `.env`
- **En producción:** Deben configurarse en la plataforma de hosting

## Componentes del Sistema

### 1. Frontend (React)
- **Ubicación:** `/src`
- **Tecnologías:** React 18, TypeScript, Tailwind CSS, Vite
- **Routing:** React Router v7
- **Estado:** Context API
- **UI:** Radix UI + shadcn/ui

### 2. Base de Datos (Supabase)
- **PostgreSQL** con Row Level Security (RLS)
- **Migraciones:** `/supabase/migrations`
- **Tipos:** Generados automáticamente en `/src/lib/database.types.ts`

### 3. Edge Functions (Supabase)
- **Ubicación:** `/supabase/functions`
- **Runtime:** Deno
- **Propósito:**
  - Crear/eliminar usuarios
  - Procesar comisiones
  - Enviar emails (Resend)
  - Enviar WhatsApp (Wazzup)
  - Sincronizar producción con Google Sheets

### 4. Storage (Supabase)
- Documentos de usuarios
- Logos personalizados
- Archivos de comisiones
- Videos educativos
- Imágenes de comunicados

## Funcionalidades Principales

### Gestión de Usuarios
- Autenticación con Supabase Auth
- Roles: Administrador, Gerente, Empleado, Agente
- Perfiles personalizados
- Gestión de oficinas

### Sistema de Comisiones
- Carga de archivos Excel
- Cálculos fiscales automáticos (ISR, IVA, Retenciones)
- Mapeo de vendedores
- Generación de PDFs
- Notificaciones por email y WhatsApp

### CRM
- Gestión de contactos
- Tareas con sistema Kanban
- Cotizaciones
- Pólizas
- Recordatorios de cumpleaños

### Producción
- Sincronización con Google Sheets
- Reportes por vendedor
- Gráficas y estadísticas
- Filtros avanzados

### Comunicación
- Centro de notificaciones
- Chat en tiempo real
- Videollamadas (MoviMeet)
- Comunicados
- Emails transaccionales

### GMM (Gastos Médicos Mayores)
- Cotizador multi-plan
- Tarifas BX+
- PDFs comparativos
- Guardado de cotizaciones

## Desarrollo Local

### Requisitos
- Node.js 18+
- Cuenta de Supabase
- Bolt.new (opcional)

### Comandos

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build
npm run build

# Preview
npm run preview
```

## Deployment

### Opción 1: Bolt.new (Recomendado)
1. La aplicación ya está configurada para Bolt.new
2. Las variables se leen del archivo `.env`
3. Todo funciona automáticamente

### Opción 2: Otro Hosting
Si despliegas en Vercel, Netlify u otro:

1. Configura las variables de entorno:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. Configura el build:
   ```bash
   npm run build
   ```

3. Configura los redirects para SPA (el archivo `public/_redirects` ya está incluido)

## Seguridad

### Variables de Entorno
- ✅ El archivo `.env` está en `.gitignore`
- ✅ La `ANON_KEY` es segura para el frontend (es pública por diseño)
- ✅ Las operaciones sensibles usan `SERVICE_ROLE_KEY` (solo en Edge Functions)

### RLS (Row Level Security)
Todas las tablas tienen políticas de seguridad:
- Los usuarios solo ven sus propios datos
- Los gerentes solo ven su oficina
- Los administradores ven todo

### Autenticación
- JWT tokens gestionados por Supabase
- Sesiones persistentes en localStorage
- Auto-refresh de tokens

## Estructura de Archivos

```
/
├── public/               # Archivos estáticos
├── src/
│   ├── components/      # Componentes React
│   ├── contexts/        # Context API (Auth, Notifications)
│   ├── lib/            # Utilidades y tipos
│   ├── pages/          # Páginas/rutas
│   └── main.tsx        # Entry point
├── supabase/
│   ├── functions/      # Edge Functions
│   └── migrations/     # Migraciones SQL
├── .env                # Variables de entorno
├── vite.config.ts      # Configuración Vite
└── package.json        # Dependencias
```

## Documentación Adicional

- `README.md` - Información general del proyecto
- `CREDENCIALES_LOGIN.md` - Usuarios de prueba
- `SISTEMA_*.md` - Documentación de módulos específicos
- `GMM_*.md` - Documentación del cotizador GMM
- `FIX_*.md` - Registro de correcciones

## Soporte

Para problemas o preguntas:
1. Revisa los archivos de documentación (`.md`)
2. Verifica los logs en la consola del navegador (F12)
3. Revisa los logs de Supabase Edge Functions
4. Verifica las políticas RLS en Supabase Dashboard

## Checklist de Verificación

- [x] Variables de entorno configuradas
- [x] Supabase conectado
- [x] Edge Functions desplegadas
- [x] Migraciones aplicadas
- [x] RLS habilitado en todas las tablas
- [x] Storage buckets creados
- [x] Autenticación funcionando
- [x] Notificaciones configuradas (Resend + Wazzup)
