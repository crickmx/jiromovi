import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { useThemeMode } from '../hooks/useThemeMode';
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
  const { isDarkEffective } = useThemeMode();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [activePath, setActivePath] = useState('/');
  const [perms, setPerms] = useState<BonosPerms>(DEFAULT_PERMS);
  const [ssoFailed, setSsoFailed] = useState(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const embeddedParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('embedded', 'true');
    params.set('theme', isDarkEffective ? 'dark' : 'light');
    if (usuario?.oficina?.accent_color) {
      params.set('accentColor', usuario.oficina.accent_color.replace('#', ''));
    }
    if (usuario?.oficina_id) {
      params.set('officeId', encodeURIComponent(usuario.oficina_id));
    }
    if (usuario?.id) {
      params.set('userId', encodeURIComponent(usuario.id));
    }
    return params.toString();
  }, [isDarkEffective, usuario?.oficina?.accent_color, usuario?.oficina_id, usuario?.id]);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout>;

    async function buildUrl() {
      try {
        if (import.meta.env.DEV) {
          const email = usuario?.email_laboral || 'dev@movi.digital';
          setIframeSrc(`${BONOS_URL}/accounts/dev-login/?email=${encodeURIComponent(email)}&next=${encodeURIComponent('/')}&${embeddedParams}`);
          return;
        }

        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (!token) {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;
            retryTimeout = setTimeout(() => {
              if (!cancelled) buildUrl();
            }, 1500);
            return;
          }
          if (!cancelled) {
            setError('No se pudo obtener la sesion. Intenta cerrar e iniciar sesion de nuevo.');
          }
          return;
        }

        if (!cancelled) {
          retryCountRef.current = 0;
          setIframeSrc(`${BONOS_URL}/accounts/supabase/?token=${encodeURIComponent(token)}&${embeddedParams}`);
        }
      } catch (e) {
        if (!cancelled) {
          setError('Error al conectar con Central de Produccion.');
        }
      }
    }

    buildUrl();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
    };
  }, [usuario?.email_laboral, embeddedParams]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.origin.includes(new URL(BONOS_URL).host)) return;
    const { type, payload } = event.data || {};
    if (type === 'bonos:navigate') {
      const path = payload?.path || '/';
      setActivePath(path);
      if (path.includes('/accounts/login') || path.includes('/accounts/sso')) {
        setSsoFailed(true);
      }
    } else if (type === 'bonos:userinfo') {
      setSsoFailed(false);
      setPerms({
        role: payload?.role || '',
        can_admin: !!payload?.can_admin,
        can_campanias: !!payload?.can_campanias,
        can_users: !!payload?.can_users,
      });
    } else if (type === 'bonos:sso_error') {
      setSsoFailed(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'bonos:theme', payload: { theme: isDarkEffective ? 'dark' : 'light', accentColor: usuario?.oficina?.accent_color || null } },
      BONOS_URL
    );
  }, [isDarkEffective, usuario?.oficina?.accent_color]);

  function navigateTo(path: string) {
    setActivePath(path);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'bonos:navigate', payload: { path } },
      BONOS_URL
    );
  }

  const visibleSections = SECTIONS.filter(s => s.show(perms));

  if (error || ssoFailed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg text-neutral-700 dark:text-neutral-300 text-center">
          {error || 'No se pudo iniciar sesion automaticamente en Central de Produccion. Verifica que tu cuenta tenga acceso.'}
        </p>
        <button
          onClick={() => {
            setSsoFailed(false);
            setError(null);
            setIframeSrc(null);
            setLoading(true);
            retryCountRef.current = 0;
            window.location.reload();
          }}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Vertical sidebar navigation */}
      <aside className="hidden md:flex flex-col w-52 min-w-[208px] bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto shrink-0">
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Central Produccion</h2>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {visibleSections.map(section => {
            const Icon = section.icon;
            const isActive = activePath === section.path;
            return (
              <button
                key={section.path}
                onClick={() => navigateTo(section.path)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Iframe container - seamless, no borders or padding */}
      <div className="flex-1 relative min-w-0 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-900 z-10">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        )}
        {iframeSrc && (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-0 block"
            onLoad={() => setLoading(false)}
            allow="clipboard-write"
            style={{ margin: 0, padding: 0 }}
          />
        )}
      </div>
    </div>
  );
}
