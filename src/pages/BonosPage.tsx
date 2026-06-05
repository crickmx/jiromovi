import { useState, useRef, useEffect, useCallback } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { supabase } from '../lib/supabase';
import { Hop as Home, ChartBar as BarChart2, DollarSign, Target, BookOpen, CloudUpload as UploadCloud, Trophy, Loader as Loader2, CircleAlert as AlertCircle, FileText, Calculator, ListFilter as Filter, Tag, Users, UserCheck, Settings, Clock, RefreshCw, MapPin } from 'lucide-react';

const BONOS_URL = import.meta.env.VITE_BONOS_URL || 'http://localhost:8003';

interface BonosPerms {
  role: string;
  can_admin: boolean;
  can_campanias: boolean;
  can_users: boolean;
}

const DEFAULT_PERMS: BonosPerms = { role: '', can_admin: false, can_campanias: false, can_users: false };

type SectionDef = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  show: (p: BonosPerms) => boolean;
};

const no_dirreg = (p: BonosPerms) => p.can_admin && p.role !== 'dirreg';

const SECTIONS: SectionDef[] = [
  { label: 'Inicio', path: '/', icon: Home, show: () => true },
  { label: 'Dashboard', path: '/reporting/dashboard/', icon: BarChart2, show: () => true },
  { label: 'Polizas', path: '/etl/polizas/', icon: FileText, show: () => true },
  { label: 'Cob. Pendiente', path: '/etl/cobranza-pendiente/', icon: Clock, show: () => true },
  { label: 'Renovaciones', path: '/reporting/renovaciones/', icon: RefreshCw, show: () => true },
  { label: 'Produccion', path: '/calculations/results/', icon: DollarSign, show: () => true },
  { label: 'Metas', path: '/metas/', icon: Target, show: p => p.can_admin },
  { label: 'Config. Metas', path: '/metas/config/', icon: Target, show: no_dirreg },
  { label: 'Config. de Bonos', path: '/catalogs/', icon: BookOpen, show: no_dirreg },
  { label: 'Cargar Produccion', path: '/etl/upload/', icon: UploadCloud, show: no_dirreg },
  { label: 'Cargar Pendiente', path: '/etl/upload/pendiente/', icon: Clock, show: no_dirreg },
  { label: 'Enriquecer CP/RFC', path: '/etl/upload/emitidas/', icon: MapPin, show: no_dirreg },
  { label: 'Calculo de Bonos', path: '/calculations/run/', icon: Calculator, show: p => p.can_admin },
  { label: 'Campanias', path: '/campanias/', icon: Trophy, show: p => p.can_campanias },
  { label: 'Config. Filtros', path: '/filters/config/', icon: Filter, show: no_dirreg },
  { label: 'Etiq. de Bandas', path: '/filters/band-labels/', icon: Tag, show: no_dirreg },
  { label: 'Usuarios', path: '/accounts/users/', icon: Users, show: p => p.can_users },
  { label: 'Usuarios MOVI', path: '/accounts/movi/', icon: UserCheck, show: p => p.can_users },
  { label: 'Panel Admin', path: '/admin/', icon: Settings, show: p => p.can_users },
];

export default function BonosPage() {
  const { usuario } = useMoviAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [activePath, setActivePath] = useState('/');
  const [perms, setPerms] = useState<BonosPerms>(DEFAULT_PERMS);

  useEffect(() => {
    async function buildUrl() {
      try {
        if (import.meta.env.DEV) {
          const email = usuario?.email || 'dev@movi.digital';
          setIframeSrc(`${BONOS_URL}/accounts/dev-login/?email=${encodeURIComponent(email)}&next=/`);
        } else {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (!token) {
            setError('No se pudo obtener la sesion. Intenta cerrar e iniciar sesion de nuevo.');
            return;
          }
          setIframeSrc(`${BONOS_URL}/accounts/sso/?token=${token}`);
        }
      } catch (e) {
        setError('Error al conectar con Central de Produccion.');
      }
    }
    buildUrl();
  }, [usuario?.email]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.origin.includes(new URL(BONOS_URL).host)) return;
    const { type, payload } = event.data || {};
    if (type === 'bonos:navigate') {
      setActivePath(payload?.path || '/');
    } else if (type === 'bonos:userinfo') {
      setPerms({
        role: payload?.role || '',
        can_admin: !!payload?.can_admin,
        can_campanias: !!payload?.can_campanias,
        can_users: !!payload?.can_users,
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  function navigateTo(path: string) {
    setActivePath(path);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'bonos:navigate', payload: { path } },
      BONOS_URL
    );
  }

  const visibleSections = SECTIONS.filter(s => s.show(perms));

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg text-neutral-700 dark:text-neutral-300 text-center">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Sub-navigation bar */}
      <div className="flex items-center gap-1 px-3 h-11 min-h-[44px] bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto shrink-0 scrollbar-hide">
        {visibleSections.map(section => {
          const Icon = section.icon;
          const isActive = activePath === section.path;
          return (
            <button
              key={section.path}
              onClick={() => navigateTo(section.path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Iframe container */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-900 z-10">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        )}
        {iframeSrc && (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
            allow="clipboard-write"
          />
        )}
      </div>
    </div>
  );
}
