import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  SlidersHorizontal,
  UserCheck,
  Upload,
  LayoutTemplate,
  Database,
  HardDrive,
  ClipboardList,
  Calendar,
  Clock,
  Percent,
  Receipt,
  GitBranch,
  FileSpreadsheet,
  HeartPulse,
  Wallet,
  PenLine,
  ArrowLeftRight,
  SearchCode,
  UserCog,
  Phone,
  LayoutGrid,
  Rocket,
  PanelLeft,
  LayoutDashboard,
  Bug,
  Zap,
  BrainCircuit,
  LibraryBig,
  Bot,
  Workflow,
  Brain,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isItemVisible, WORKSPACES, type UserRole } from '../lib/workspaceConfig';
import { useModuleVisibility } from '../lib/useModuleVisibility';
import { PageHeader } from '../components/ui/page-header';

interface AdminModule {
  path: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'Usuarios y Accesos' | 'Operaciones y Comisiones' | 'Inteligencia Artificial' | 'Sistema y Configuración';
  color: string;
}

const ADMIN_MODULES: AdminModule[] = [
  // ── Usuarios y Accesos ──
  { path: '/directorio', label: 'Usuarios', description: 'Gestión de cuentas, roles, oficinas y perfiles.', icon: Users, category: 'Usuarios y Accesos', color: 'text-blue-500' },
  { path: '/actividad-usuarios', label: 'Actividad', description: 'Registro de accesos y bitácora de actividad.', icon: UserCheck, category: 'Usuarios y Accesos', color: 'text-indigo-500' },
  { path: '/carga-masiva-usuarios', label: 'Carga Masiva', description: 'Importación por lotes de nuevos usuarios.', icon: Upload, category: 'Usuarios y Accesos', color: 'text-cyan-500' },
  { path: '/admin/mascara', label: 'Máscara de Usuario', description: 'Impersonación segura para diagnóstico.', icon: UserCog, category: 'Usuarios y Accesos', color: 'text-amber-500' },

  // ── Operaciones y Comisiones ──
  { path: '/admin/tramites', label: 'Trámites Admin', description: 'Configuración de tipos, flujos y reglas.', icon: ClipboardList, category: 'Operaciones y Comisiones', color: 'text-emerald-500' },
  { path: '/comisiones', label: 'Comisiones Admin', description: 'Lotes de comisiones y pagos a agentes.', icon: Percent, category: 'Operaciones y Comisiones', color: 'text-teal-500' },
  { path: '/comisiones/regimen-fiscal', label: 'Régimen Fiscal', description: 'Catálogo de regímenes y retenciones.', icon: Receipt, category: 'Operaciones y Comisiones', color: 'text-green-500' },
  { path: '/comisiones/mapeo-vendedores', label: 'Mapeo Vendedores', description: 'Vinculación de claves y agentes.', icon: GitBranch, category: 'Operaciones y Comisiones', color: 'text-lime-500' },
  { path: '/produccion/reportes-sicas-ccj', label: 'Reportes SICAS', description: 'Reportes de producción y cobranza.', icon: FileSpreadsheet, category: 'Operaciones y Comisiones', color: 'text-emerald-600' },
  { path: '/sicas/salud', label: 'SICAS Salud', description: 'Integración especializada de salud.', icon: HeartPulse, category: 'Operaciones y Comisiones', color: 'text-rose-500' },
  { path: '/seguwallet-admin', label: 'Seguwallet', description: 'Supervisión de clientes y pólizas app.', icon: Wallet, category: 'Operaciones y Comisiones', color: 'text-teal-600' },
  { path: '/admin/seguros-express', label: 'Seguros Express', description: 'Distribución geográfica de prospectos.', icon: Zap, category: 'Operaciones y Comisiones', color: 'text-amber-500' },

  // ── Inteligencia Artificial ──
  { path: '/admin/chava-inteligencia', label: 'Dashboard IA', description: 'Métricas y rendimiento de Chava IA.', icon: BrainCircuit, category: 'Inteligencia Artificial', color: 'text-sky-500' },
  { path: '/admin/base-conocimiento', label: 'Base Conocimiento', description: 'Documentos vectorizados para RAG.', icon: LibraryBig, category: 'Inteligencia Artificial', color: 'text-blue-500' },
  { path: '/admin/asistentes', label: 'Entrenamiento IA', description: 'Instrucciones y prompts de agentes.', icon: Bot, category: 'Inteligencia Artificial', color: 'text-violet-500' },
  { path: '/admin/automatizacion-ia', label: 'Robots IA', description: 'Flujos automáticos con modelos de IA.', icon: Workflow, category: 'Inteligencia Artificial', color: 'text-purple-500' },
  { path: '/admin/chava-ia', label: 'Auditoría IA', description: 'Historial y trazabilidad de respuestas.', icon: Brain, category: 'Inteligencia Artificial', color: 'text-fuchsia-500' },

  // ── Sistema y Configuración ──
  { path: '/configuracion', label: 'Configuración', description: 'Ajustes globales de la plataforma.', icon: SlidersHorizontal, category: 'Sistema y Configuración', color: 'text-neutral-500' },
  { path: '/admin-digital', label: 'Admin Digital', description: 'Monitoreo web y conciliación.', icon: LayoutTemplate, category: 'Sistema y Configuración', color: 'text-slate-500' },
  { path: '/admin/base-datos', label: 'Base de Datos', description: 'Catálogos maestros y convenios.', icon: HardDrive, category: 'Sistema y Configuración', color: 'text-indigo-500' },
  { path: '/admin/dias-no-habiles', label: 'Días No Hábiles', description: 'Calendario de asuetos y festivos.', icon: Calendar, category: 'Sistema y Configuración', color: 'text-rose-500' },
  { path: '/admin/config-jornada', label: 'Jornada Laboral', description: 'Horarios de atención operativa.', icon: Clock, category: 'Sistema y Configuración', color: 'text-amber-500' },
  { path: '/admin/modulos', label: 'Control de Módulos', description: 'Permisos de visibilidad por rol/usuario.', icon: LayoutGrid, category: 'Sistema y Configuración', color: 'text-blue-600' },
  { path: '/admin/deploy', label: 'Deploy', description: 'Actualización de código y despliegues.', icon: Rocket, category: 'Sistema y Configuración', color: 'text-purple-600' },
  { path: '/admin/sidebar-editor', label: 'Editor de Sidebar', description: 'Orden y badges de menús laterales.', icon: PanelLeft, category: 'Sistema y Configuración', color: 'text-sky-600' },
  { path: '/admin/dashboard-editor', label: 'Editor Dashboard', description: 'Organización de widgets y cards.', icon: LayoutDashboard, category: 'Sistema y Configuración', color: 'text-teal-600' },
  { path: '/admin/reportes-bugs', label: 'Reportes de Bugs', description: 'Centro de atención a fallas técnicas.', icon: Bug, category: 'Sistema y Configuración', color: 'text-red-500' },
  { path: '/firmas-email', label: 'Firmas Email', description: 'Plantillas de firmas corporativas.', icon: PenLine, category: 'Sistema y Configuración', color: 'text-blue-500' },
  { path: '/admin/telefonia', label: 'Telefonía', description: 'Integración de PBX y extensiones.', icon: Phone, category: 'Sistema y Configuración', color: 'text-green-600' },
];

const adminWorkspace = WORKSPACES.find(w => w.id === 'administracion')!;

export default function AdminHub() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { isVisible } = useModuleVisibility();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  const rol = (usuario?.rol || '') as UserRole;
  const oficinaId = usuario?.oficina_id ?? null;

  const visibleModules = ADMIN_MODULES.filter(mod => {
    const navItem = adminWorkspace.items.find(item => item.path === mod.path || mod.path.startsWith(item.path + '/'));
    if (navItem && !isItemVisible(navItem, rol)) return false;
    if (!isVisible(mod.path, rol, oficinaId, usuario?.id)) return false;
    return true;
  });

  const categories = ['Todos', 'Usuarios y Accesos', 'Operaciones y Comisiones', 'Inteligencia Artificial', 'Sistema y Configuración'];

  const filteredModules = selectedCategory === 'Todos'
    ? visibleModules
    : visibleModules.filter(m => m.category === selectedCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <PageHeader
        title="Panel de Administración"
        badge={`${visibleModules.length} herramientas`}
        description="Configuración global, permisos, inteligencia artificial, despliegues y control operativo de MOVI."
        icon={Settings}
      >
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/80 dark:hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className="group text-left p-4 rounded-2xl bg-surface-card dark:bg-neutral-900/80 border border-soft dark:border-white/[0.08] hover:border-accent/40 hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center transition-transform group-hover:scale-110">
                    <Icon className={`w-5 h-5 ${mod.color}`} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity group-hover:translate-x-0.5" />
                </div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-accent transition-colors">
                  {mod.label}
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  {mod.description}
                </p>
              </div>
              <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mt-3 pt-2 border-t border-neutral-100 dark:border-white/5 uppercase tracking-wider">
                {mod.category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
