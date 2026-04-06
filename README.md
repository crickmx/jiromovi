# MOVI Digital - Plataforma Integral de Gestión

Sistema completo de gestión empresarial con control de acceso basado en roles, desarrollado completamente en español.

**Plataforma:** Bolt.new + Supabase
**Arquitectura:** React SPA + PostgreSQL + Edge Functions

## 📚 Documentación Principal

- 📖 **[CONFIGURACION_BOLT_SUPABASE.md](CONFIGURACION_BOLT_SUPABASE.md)** - Arquitectura y configuración completa
- 🔐 **[CREDENCIALES_LOGIN.md](CREDENCIALES_LOGIN.md)** - Usuarios de prueba
- 🏗️ **[AUDITORIA_CONFIGURACION_BOLT_SUPABASE.md](AUDITORIA_CONFIGURACION_BOLT_SUPABASE.md)** - Última auditoría de configuración

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar en desarrollo
npm run dev

# Build para producción
npm run build
```

La aplicación estará disponible en `http://localhost:5173`

## 🎯 Funcionalidades Principales

### Gestión de Usuarios y Permisos
- Sistema de roles: Administrador, Gerente, Empleado, Agente
- Gestión completa de usuarios con soft delete
- Directorio de usuarios con filtros avanzados
- Perfiles personalizados con logotipos
- Gestión de oficinas

### Sistema de Comisiones
- Carga masiva de archivos Excel
- Cálculos fiscales automáticos (ISR, IVA, retenciones)
- Soporte para Asimilados, Honorarios y RESICO
- Mapeo inteligente de vendedores
- Generación de PDFs con desglose fiscal
- Notificaciones automáticas por email y WhatsApp

### CRM Completo
- Gestión de contactos con campos personalizados
- Sistema de tareas con tablero Kanban
- Gestión de cotizaciones y pólizas
- Recordatorios automáticos de cumpleaños
- Historial completo de interacciones

### Producción y Reportes
- Sincronización con Google Sheets
- Reportes por vendedor y oficina
- Gráficas dinámicas y estadísticas
- Ranking de vendedores
- Filtros avanzados por período

### Cotizador GMM (Gastos Médicos Mayores)
- Cotización multi-plan BX+
- Comparativas de coberturas
- Cálculo dinámico de primas
- Generación de PDFs comparativos
- Historial de cotizaciones

### Comunicación
- Centro de notificaciones en tiempo real
- Chat interno con archivos adjuntos
- Videollamadas (MoviMeet)
- Sistema de comunicados con categorías
- Emails transaccionales con Resend
- WhatsApp con Wazzup

### Otros Módulos
- Seguros Education (videos y cursos)
- Aula Virtual para capacitaciones
- Calendario de eventos
- Gestión de vacaciones
- Store interno
- Páginas web públicas personalizadas

## 🛠️ Stack Tecnológico

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- React Router v7
- Tailwind CSS
- Radix UI + shadcn/ui
- Lucide Icons

### Backend (Supabase)
- PostgreSQL con Row Level Security (RLS)
- 80+ tablas con políticas de seguridad
- 40+ Edge Functions (Deno runtime)
- Storage buckets para archivos

### Integraciones
- **Resend** - Emails transaccionales
- **Wazzup** - WhatsApp API
- **Google Sheets** - Sincronización de producción
- **jsPDF** - Generación de PDFs

## ⚙️ Configuración

### Variables de Entorno

El archivo `.env` contiene:
```env
VITE_SUPABASE_URL=https://qhwvuuyjhcennqccgvse.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Estas variables son leídas automáticamente por Vite en Bolt.new.

### Base de Datos

La base de datos incluye:
- 80+ tablas con RLS habilitado
- Migraciones en `/supabase/migrations`
- Tipos TypeScript generados en `/src/lib/database.types.ts`

### Edge Functions

40+ funciones serverless para:
- Gestión de usuarios
- Procesamiento de comisiones
- Notificaciones (email + WhatsApp)
- Sincronización de producción
- Y más...

## 👥 Usuarios de Prueba

Ver archivo `CREDENCIALES_LOGIN.md` para usuarios de prueba disponibles.

## 🔒 Seguridad

- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Políticas restrictivas por rol
- ✅ Autenticación JWT con Supabase Auth
- ✅ Soft delete en tablas críticas
- ✅ Auditoría de acciones de usuarios
- ✅ Variables de entorno seguras

## 📁 Estructura del Proyecto

```
/
├── src/
│   ├── components/         # Componentes React
│   │   ├── ui/            # Componentes de UI (shadcn)
│   │   ├── chat/          # Componentes de chat
│   │   ├── comisiones/    # Sistema de comisiones
│   │   └── ...
│   ├── contexts/          # Context API
│   │   ├── AuthContext.tsx
│   │   └── NotificationContext.tsx
│   ├── lib/              # Utilidades y helpers
│   │   ├── supabase.ts
│   │   ├── database.types.ts
│   │   └── ...
│   ├── pages/            # Páginas/rutas
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Comisiones.tsx
│   │   ├── GMMCotizador.tsx
│   │   └── ...
│   └── main.tsx          # Entry point
├── supabase/
│   ├── functions/        # Edge Functions (Deno)
│   └── migrations/       # Migraciones SQL
├── public/               # Assets estáticos
├── .env                  # Variables de entorno
└── vite.config.ts        # Configuración Vite
```

## 📊 Arquitectura

```
┌─────────────────────────────────────────┐
│         Frontend (React + Vite)          │
│         Bolt.new                         │
└─────────────┬───────────────────────────┘
              │
              │ HTTPS
              ▼
┌─────────────────────────────────────────┐
│         Backend (Supabase)               │
├─────────────────────────────────────────┤
│  • PostgreSQL (80+ tablas)              │
│  • Storage (9 buckets)                  │
│  • Auth (JWT)                            │
│  • Edge Functions (40+)                 │
└─────────────┬───────────────────────────┘
              │
              │ Integraciones
              ▼
┌─────────────────────────────────────────┐
│  • Resend (emails)                      │
│  • Wazzup (WhatsApp)                    │
│  • Google Sheets (producción)           │
└─────────────────────────────────────────┘
```

## 🚀 Deployment

Esta aplicación está configurada para **Bolt.new** con todas las variables pre-configuradas.

Si deseas desplegar en otra plataforma, consulta `CONFIGURACION_BOLT_SUPABASE.md`.

## 📝 Licencia

Sistema propietario para uso interno.
