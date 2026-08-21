import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { useThemeMode } from '../hooks/useThemeMode';
import { supabase } from '../lib/supabase';
import { Hop as Home, ChartBar as BarChart2, DollarSign, Target, BookOpen, CloudUpload as UploadCloud, Trophy, CircleAlert as AlertCircle, FileText, FileSpreadsheet, Calculator, ListFilter as Filter, Tag, Users, UserCheck, Settings, Clock, RefreshCw, MapPin, Paintbrush, LayoutDashboard, Menu, X } from 'lucide-react';
import { LoadingOrb } from '../components/loading/LoadingOrb';
import { LoadingFactCard } from '../components/loading/LoadingFactCard';
import SicasCCJReports from './SicasCCJReports';

const BONOS_URL = import.meta.env.VITE_BONOS_URL || 'http://localhost:8003';
const IS_LOCAL_BONOS = BONOS_URL.includes('localhost') || BONOS_URL.includes('127.0.');

const SSO_CACHE_KEY = 'bonos_sso_ts';
const SSO_CACHE_TTL_MS = 45 * 60 * 1000; // 45 min
const SICAS_CCJ_REPORTS_PATH = 'movi://reportes-sicas-ccj';

function readSsoCache(): boolean {
  try {
    const ts = sessionStorage.getItem(SSO_CACHE_KEY);
    return !!ts && Date.now() - parseInt(ts) < SSO_CACHE_TTL_MS;
  } catch { return false; }
}

function writeSsoCache(): void {
  try { sessionStorage.setItem(SSO_CACHE_KEY, Date.now().toString()); } catch {}
}

function clearSsoCacheStorage(): void {
  try { sessionStorage.removeItem(SSO_CACHE_KEY); } catch {}
}

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
  { label: 'Reportes SICAS CCJ', path: SICAS_CCJ_REPORTS_PATH, icon: FileSpreadsheet, show: p => p.can_admin },
  { label: 'Campanias', path: '/campanias/', icon: Trophy, show: p => p.can_campanias },
  { label: 'Config. Filtros', path: '/filters/config/', icon: Filter, show: no_dirreg },
  { label: 'Etiq. de Bandas', path: '/filters/band-labels/', icon: Tag, show: no_dirreg },
  { label: 'Usuarios Bonos', path: '/accounts/users/', icon: Users, show: p => p.can_users },
  { label: 'Usuarios MOVI', path: '/accounts/movi/', icon: UserCheck, show: p => p.can_users },
  { label: 'Diseno', path: '/design/', icon: Paintbrush, show: no_dirreg },
  { label: 'Config. Inicio', path: '/config/home/', icon: Home, show: no_dirreg },
  { label: 'Config. Dashboard', path: '/config/dashboard/', icon: LayoutDashboard, show: no_dirreg },
  { label: 'Panel Admin', path: '/admin/', icon: Settings, show: p => p.can_users },
];

export default function BonosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario } = useMoviAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const { isDarkEffective } = useThemeMode();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [activePath, setActivePath] = useState(
    location.pathname === '/produccion/reportes-sicas-ccj' ? SICAS_CCJ_REPORTS_PATH : '/',
  );
  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;
  const [perms, setPerms] = useState<BonosPerms>(DEFAULT_PERMS);
  const [retryCount, setRetryCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Initialize from cache so the loading overlay is skipped on re-navigation
  const [ssoConfirmed, setSsoConfirmed] = useState<boolean>(() => readSsoCache());
  // ssoConfirmedRef stays false so the SSO useEffect always runs to build the URL
  const ssoConfirmedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRetries = 2;
  const SSO_TIMEOUT_MS = 20000;
  type ErrorReason = 'no_session' | 'timeout' | 'login_redirect' | null;
  const [errorReason, setErrorReason] = useState<ErrorReason>(null);

  const clearSsoTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const buildSsoUrl = useCallback(async (retry: number): Promise<string | null> => {
    if (IS_LOCAL_BONOS) {
      const impersonating = isImpersonating && impersonatedUser;
      const email = impersonating ? impersonatedUser.email_laboral : usuario?.email_laboral;
      if (!email && !impersonating) return null;
      const devUrl = new URL('/accounts/dev-login/', BONOS_URL);
      if (email) devUrl.searchParams.set('email', email);
      if (impersonating) {
        devUrl.searchParams.set('supabase_uuid', impersonatedUser.id);
        if (impersonatedUser.nombre) devUrl.searchParams.set('first_name', impersonatedUser.nombre);
        if (impersonatedUser.apellidos) devUrl.searchParams.set('last_name', impersonatedUser.apellidos);
      }
      devUrl.searchParams.set('next', '/');
      return devUrl.toString();
    }
    if (retry > 0) {
      await supabase.auth.refreshSession();
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) return null;
    const url = new URL('/accounts/supabase/', BONOS_URL);
    url.searchParams.set('token', session.access_token);
    url.searchParams.set('next', '/');
    if (isImpersonating && impersonatedUser?.email_laboral) {
      url.searchParams.set('impersonate_email', impersonatedUser.email_laboral);
    }
    return url.toString();
  }, [usuario?.email_laboral, isImpersonating, impersonatedUser?.email_laboral]);

  // Reset SSO state when impersonation changes — different Django session context
  const prevImpersonating = useRef(isImpersonating);
  useEffect(() => {
    if (prevImpersonating.current !== isImpersonating) {
      prevImpersonating.current = isImpersonating;
      ssoConfirmedRef.current = false;
      setSsoConfirmed(false);
      setRetryCount(0);
      clearSsoCacheStorage();
    }
  }, [isImpersonating]);

  useEffect(() => {
    if (activePath === SICAS_CCJ_REPORTS_PATH) return;
    if (ssoConfirmedRef.current) return;
    setError(false);
    setErrorReason(null);
    setSrc(null);
    clearSsoTimeout();
    buildSsoUrl(retryCount).then(url => {
      if (!url) { setError(true); setErrorReason('no_session'); return; }
      setSrc(url);
      timeoutRef.current = setTimeout(() => {
        if (!ssoConfirmedRef.current) {
          if (retryCount < maxRetries) {
            setRetryCount(c => c + 1);
          } else {
            setError(true);
            setErrorReason('timeout');
          }
        }
      }, SSO_TIMEOUT_MS);
    });
    return () => clearSsoTimeout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, buildSsoUrl, retryCount, clearSsoTimeout]);

  const retryCountRef = useRef(retryCount);
  retryCountRef.current = retryCount;

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data?.type) return;
      const { type } = event.data;

      if (type === 'bonos:pagechange') {
        ssoConfirmedRef.current = true;
        setSsoConfirmed(true);
        writeSsoCache();
        clearSsoTimeout();
        if (activePathRef.current === SICAS_CCJ_REPORTS_PATH) return;
        const p: string = event.data.path || '/';
        const match = SECTIONS.slice().reverse().find(s => p.startsWith(s.path) && s.path !== '/')
          ?? (p === '/' ? SECTIONS[0] : null);
        if (match) setActivePath(match.path);
      }

      if (type === 'bonos:navigate') {
        const path = event.data.payload?.path || event.data.path || '/';
        if (path.includes('/accounts/login')) {
          clearSsoTimeout();
          clearSsoCacheStorage();
          if (retryCountRef.current < maxRetries) {
            setRetryCount(c => c + 1);
          } else {
            setError(true);
            setErrorReason('login_redirect');
          }
          return;
        }
        ssoConfirmedRef.current = true;
        setSsoConfirmed(true);
        writeSsoCache();
        clearSsoTimeout();
        if (activePathRef.current === SICAS_CCJ_REPORTS_PATH) return;
        setActivePath(path);
      }

      if (type === 'bonos:userinfo') {
        ssoConfirmedRef.current = true;
        setSsoConfirmed(true);
        writeSsoCache();
        clearSsoTimeout();
        setPerms({
          role: event.data.role ?? event.data.payload?.role ?? '',
          can_admin: !!(event.data.can_admin ?? event.data.payload?.can_admin),
          can_campanias: !!(event.data.can_campanias ?? event.data.payload?.can_campanias),
          can_users: !!(event.data.can_users ?? event.data.payload?.can_users),
        });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearSsoTimeout]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'bonos:theme', payload: { theme: isDarkEffective ? 'dark' : 'light', accentColor: usuario?.oficina?.accent_color || null } },
      BONOS_URL
    );
  }, [isDarkEffective, usuario?.oficina?.accent_color]);

  function navigateTo(path: string) {
    setActivePath(path);
    if (path === SICAS_CCJ_REPORTS_PATH) {
      navigate('/produccion/reportes-sicas-ccj');
      return;
    }
    if (location.pathname !== '/produccion') navigate('/produccion');
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'bonos:navigate', url: path },
      BONOS_URL
    );
  }

  if (error && activePath !== SICAS_CCJ_REPORTS_PATH) {
    const REASON_MESSAGES: Record<Exclude<ErrorReason, null>, string> = {
      no_session: 'No se encontró una sesión activa de MOVI. Cierra sesión y vuelve a entrar, luego intenta de nuevo.',
      timeout: `Central de Producción no respondió a tiempo (más de ${Math.round(SSO_TIMEOUT_MS / 1000)} segundos esperando confirmación). El servidor puede estar lento o temporalmente caído.`,
      login_redirect: 'Central de Producción no reconoció la sesión y regresó a su pantalla de login — tu cuenta ahí puede no estar vinculada, o el navegador bloqueó la cookie de sesión dentro del iframe.',
    };

    const diagItems = IS_LOCAL_BONOS
      ? ['CP local no está corriendo en localhost:8003', 'El usuario no existe en la BD local de CP']
      : [
          'CP bloqueó el iframe por CSP (frame-ancestors) — agrega el origen de MOVI en Configuración del Sitio de CP',
          'El navegador bloqueó cookies de terceros — prueba abrir en nueva ventana',
          'Tu cuenta de admin no existe o no tiene rol admin en CP',
          isImpersonating ? `El usuario ${impersonatedUser?.email_laboral ?? '?'} no existe en CP` : null,
        ].filter(Boolean);

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg text-neutral-700 dark:text-neutral-300 text-center">
          No se pudo conectar con Central de Produccion
        </p>
        <div className="text-sm text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 max-w-lg w-full space-y-1">
          {errorReason && (
            <p className="font-semibold text-red-500 dark:text-red-400 mb-3">{REASON_MESSAGES[errorReason]}</p>
          )}
          <p className="font-semibold text-neutral-600 dark:text-neutral-300 mb-2">Otras causas posibles:</p>
          {diagItems.map((item, i) => (
            <p key={i} className="flex gap-2"><span className="text-red-400 shrink-0">•</span>{item}</p>
          ))}
          <p className="mt-3 text-xs text-neutral-400">Servidor: <code className="font-mono">{BONOS_URL}</code>{isImpersonating ? ` · Impersonando: ${impersonatedUser?.email_laboral ?? '?'}` : ''}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setError(false); setErrorReason(null); setRetryCount(0); setSsoConfirmed(false); ssoConfirmedRef.current = false; clearSsoCacheStorage(); }}
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

  if (!src && activePath !== SICAS_CCJ_REPORTS_PATH) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-8"
        style={{ background: 'rgba(248, 250, 255, 0.97)' }}
      >
        <LoadingOrb size={120} theme="light" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-neutral-800 font-semibold text-sm tracking-wide">Conectando con Central de Produccion</span>
          <div className="flex gap-1 mt-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-blue-700"
                style={{ animation: `lo-dot-bounce 1.2s ease-in-out infinite ${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
        <LoadingFactCard />
        <style>{`
          @keyframes lo-dot-bounce {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  const visibleSections = SECTIONS.filter(s =>
    s.path === SICAS_CCJ_REPORTS_PATH
      ? activePath === SICAS_CCJ_REPORTS_PATH || s.show(perms)
      : s.show(perms),
  );
  const activeSection = visibleSections.find(s => s.path === activePath);

  const SectionNav = ({ onSelect }: { onSelect?: () => void }) => (
    <>
      {visibleSections.map(section => {
        const Icon = section.icon;
        const isActive = activePath === section.path;
        return (
          <button
            key={section.path}
            onClick={() => { navigateTo(section.path); onSelect?.(); }}
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
    </>
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-neutral-900 shadow-xl flex flex-col">
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
              <h2 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Central Produccion</h2>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 p-2 overflow-y-auto flex-1">
              <SectionNav onSelect={() => setMobileNavOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-52 min-w-[208px] bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto shrink-0">
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Central Produccion</h2>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          <SectionNav />
        </nav>
      </aside>

      {/* Right column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">
            {activeSection?.label || 'Central de Produccion'}
          </span>
        </div>

        {/* Content area: MOVI-native SICAS reports or embedded Central de Produccion */}
        <div className="flex-1 relative min-w-0 overflow-hidden">
          {activePath === SICAS_CCJ_REPORTS_PATH && (
            <div className="absolute inset-0 z-30 bg-neutral-50 dark:bg-neutral-950">
              <SicasCCJReports />
            </div>
          )}
          {activePath !== SICAS_CCJ_REPORTS_PATH && !ssoConfirmed && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-8"
              style={{ background: 'rgba(248, 250, 255, 0.97)', backdropFilter: 'blur(8px)' }}
            >
              <LoadingOrb size={120} theme="light" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-neutral-800 font-semibold text-sm tracking-wide">Cargando Central de Produccion</span>
                <div className="flex gap-1 mt-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-blue-700"
                      style={{ animation: `lo-dot-bounce 1.2s ease-in-out infinite ${i * 0.2}s` }}
                    />
                  ))}
                </div>
              </div>
              <LoadingFactCard />
              <style>{`
                @keyframes lo-dot-bounce {
                  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                  40% { transform: scale(1); opacity: 1; }
                }
              `}</style>
            </div>
          )}
          {activePath !== SICAS_CCJ_REPORTS_PATH && (
            <iframe
              ref={iframeRef}
              src={src || undefined}
              className="w-full h-full border-0 block"
              allow="clipboard-write"
              style={{ margin: 0, padding: 0 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
