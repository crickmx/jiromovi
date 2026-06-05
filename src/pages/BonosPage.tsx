import { useState, useRef, useEffect, useCallback } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
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
  const { isImpersonating } = useImpersonation();
  const { isDarkEffective } = useThemeMode();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [activePath, setActivePath] = useState('/');
  const [perms, setPerms] = useState<BonosPerms>(DEFAULT_PERMS);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const buildSsoUrl = useCallback(async (): Promise<string | null> => {
    if (import.meta.env.DEV) {
      const email = usuario?.email_laboral;
      if (!email) return null;
      const devUrl = new URL('/accounts/dev-login/', BONOS_URL);
      devUrl.searchParams.set('email', email);
      devUrl.searchParams.set('next', '/');
      return devUrl.toString();
    }
    // Force refresh token on retry to ensure we send a valid JWT
    if (retryCount > 0) {
      await supabase.auth.refreshSession();
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) return null;
    const url = new URL('/accounts/supabase/', BONOS_URL);
    url.searchParams.set('token', session.access_token);
    url.searchParams.set('next', '/');
    return url.toString();
  }, [usuario?.email_laboral, retryCount]);

  useEffect(() => {
    setError(false);
    setSrc(null);
    buildSsoUrl().then(url => {
      if (!url) { setError(true); return; }
      setSrc(url);
    });
  }, [isImpersonating, buildSsoUrl, retryCount]);

  const handleIframeLoad = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      if (!iframe) return;
      // Cross-origin will throw - that's expected when SSO succeeds (different origin)
      const iframePath = iframe.contentWindow?.location?.pathname;
      if (iframePath && iframePath.includes('/accounts/login')) {
        if (retryCount < maxRetries) {
          setRetryCount(c => c + 1);
        } else {
          setError(true);
        }
      }
    } catch {
      // Cross-origin error means iframe loaded CP successfully (different origin scenario)
      // No action needed
    }
  }, [retryCount]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.data?.type) return;
    const { type } = event.data;

    if (type === 'bonos:pagechange') {
      const p: string = event.data.path || '/';
      const match = SECTIONS.slice().reverse().find(s => p.startsWith(s.path) && s.path !== '/')
        ?? (p === '/' ? SECTIONS[0] : null);
      if (match) setActivePath(match.path);
    }

    if (type === 'bonos:navigate') {
      const path = event.data.payload?.path || event.data.path || '/';
      setActivePath(path);
      if (path.includes('/accounts/login')) {
        if (retryCount < maxRetries) {
          setRetryCount(c => c + 1);
        } else {
          setError(true);
        }
      }
    }

    if (type === 'bonos:userinfo') {
      setPerms({
        role: event.data.role ?? event.data.payload?.role ?? '',
        can_admin: !!(event.data.can_admin ?? event.data.payload?.can_admin),
        can_campanias: !!(event.data.can_campanias ?? event.data.payload?.can_campanias),
        can_users: !!(event.data.can_users ?? event.data.payload?.can_users),
      });
    }
  }, [retryCount]);

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
      { type: 'bonos:navigate', url: path },
      BONOS_URL
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg text-neutral-700 dark:text-neutral-300 text-center max-w-md">
          No se pudo iniciar sesion en Central de Produccion.
          <br />
          <span className="text-base text-neutral-500 dark:text-neutral-400">
            El servidor de CP no acepto la sesion actual. Verifica que tu cuenta tenga acceso configurado en cp.movi.digital.
          </span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { setError(false); setRetryCount(0); }}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Reintentar
          </button>
          <a
            href={BONOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-slate-300 dark:border-neutral-600 text-slate-700 dark:text-neutral-300 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Abrir en nueva ventana
          </a>
        </div>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Conectando con Central de Produccion...</p>
      </div>
    );
  }

  const visibleSections = SECTIONS.filter(s => s.show(perms));

  return (
    <div className="flex h-full w-full overflow-hidden">
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

      <div className="flex-1 relative min-w-0 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={src}
          onLoad={handleIframeLoad}
          className="w-full h-full border-0 block"
          allow="clipboard-write"
          style={{ margin: 0, padding: 0 }}
        />
      </div>
    </div>
  );
}
