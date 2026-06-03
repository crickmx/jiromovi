import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, BarChart2, DollarSign, Target, BookOpen,
  UploadCloud, Trophy, Loader2, AlertCircle, FileText,
  Calculator, Filter, Tag, Users, UserCheck, Settings,
  Clock, RefreshCw, MapPin,
} from 'lucide-react';

const BONOS_URL = import.meta.env.VITE_BONOS_URL || 'http://localhost:8003';

interface BonosPerms {
  role:          string;
  can_admin:     boolean;
  can_campanias: boolean;
  can_users:     boolean;
}

const DEFAULT_PERMS: BonosPerms = { role: '', can_admin: false, can_campanias: false, can_users: false };

type SectionDef = {
  label: string;
  path:  string;
  icon:  React.ComponentType<{ className?: string }>;
  show:  (p: BonosPerms) => boolean;
};

const no_dirreg = (p: BonosPerms) => p.can_admin && p.role !== 'dirreg';

const SECTIONS: SectionDef[] = [
  { label: 'Inicio',            path: '/',                       icon: Home,       show: () => true },
  { label: 'Dashboard',         path: '/reporting/dashboard/',   icon: BarChart2,  show: () => true },
  { label: 'Pólizas',           path: '/etl/polizas/',           icon: FileText,   show: () => true },
  { label: 'Cob. Pendiente',    path: '/etl/cobranza-pendiente/',icon: Clock,      show: () => true },
  { label: 'Renovaciones',      path: '/reporting/renovaciones/',icon: RefreshCw,  show: () => true },
  { label: 'Producción',        path: '/calculations/results/',  icon: DollarSign, show: () => true },
  { label: 'Metas',             path: '/metas/',                 icon: Target,     show: p => p.can_admin },
  { label: 'Config. Metas',     path: '/metas/config/',          icon: Target,     show: no_dirreg },
  { label: 'Config. de Bonos',  path: '/catalogs/',              icon: BookOpen,   show: no_dirreg },
  { label: 'Cargar Producción', path: '/etl/upload/',            icon: UploadCloud,show: no_dirreg },
  { label: 'Cargar Pendiente',  path: '/etl/upload/pendiente/',  icon: Clock,      show: no_dirreg },
  { label: 'Enriquecer CP/RFC', path: '/etl/upload/emitidas/',   icon: MapPin,     show: no_dirreg },
  { label: 'Cálculo de Bonos',  path: '/calculations/run/',      icon: Calculator, show: p => p.can_admin },
  { label: 'Campañas',          path: '/campanias/',             icon: Trophy,     show: p => p.can_campanias },
  { label: 'Config. Filtros',   path: '/filters/config/',        icon: Filter,     show: no_dirreg },
  { label: 'Etiq. de Bandas',   path: '/filters/band-labels/',   icon: Tag,        show: no_dirreg },
  { label: 'Usuarios',          path: '/accounts/users/',        icon: Users,      show: p => p.can_users },
  { label: 'Usuarios MOVI',     path: '/accounts/movi/',         icon: UserCheck,  show: p => p.can_users },
  { label: 'Panel Admin',       path: '/admin/',                 icon: Settings,   show: p => p.can_users },
];

export function BonosPage() {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [src,        setSrc]        = useState<string | null>(null);
  const [error,      setError]      = useState(false);
  const [active,     setActive]     = useState('/');
  const [bonosPerms, setBonosPerms] = useState<BonosPerms>(DEFAULT_PERMS);

  const { isMasked, usuario } = useAuth();

  /* ── 1. Construir URL del iframe ────────────────────────────────────── */
  useEffect(() => {
    setError(false);

    if (import.meta.env.DEV) {
      const email = usuario?.email_laboral;
      if (!email) { setError(true); return; }
      const devUrl = new URL('/accounts/dev-login/', BONOS_URL);
      devUrl.searchParams.set('email', email);
      devUrl.searchParams.set('next', '/');
      setSrc(devUrl.toString());
      return;
    }

    setSrc(null);
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError || !session?.access_token) { setError(true); return; }
      const url = new URL('/accounts/supabase/', BONOS_URL);
      url.searchParams.set('token', session.access_token);
      url.searchParams.set('next', '/');
      setSrc(url.toString());
    });
  }, [isMasked, usuario?.email_laboral]);

  /* ── 2. Escuchar mensajes desde el iframe ───────────────────────── */
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'bonos:pagechange') {
        const p: string = e.data.path || '/';
        const match = SECTIONS.slice().reverse().find(s => p.startsWith(s.path) && s.path !== '/')
          ?? (p === '/' ? SECTIONS[0] : null);
        if (match) setActive(match.path);
      }
      if (e.data?.type === 'bonos:userinfo') {
        setBonosPerms({
          role:          e.data.role        ?? '',
          can_admin:     !!e.data.can_admin,
          can_campanias: !!e.data.can_campanias,
          can_users:     !!e.data.can_users,
        });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /* ── 3. Enviar comando de navegación al iframe ───────────────────── */
  function navigateTo(path: string) {
    setActive(path);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'bonos:navigate', url: path },
      BONOS_URL,
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 p-8">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-center">
          No se pudo iniciar sesión en la plataforma de bonos.<br />
          Vuelve a iniciar sesión en MOVI e intenta de nuevo.
        </p>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Conectando con Central de Producción…</span>
      </div>
    );
  }

  const visibleSections = SECTIONS.filter(s => s.show(bonosPerms));

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Sub-nav ─────────────────────────────────────────── */}
      <nav className="flex items-center gap-1 px-4 border-b border-neutral-200/60
                      bg-white/90 backdrop-blur-xl flex-shrink-0 overflow-x-auto"
           style={{ height: 44 }}>
        {visibleSections.map(({ label, path, icon: Icon }) => {
          const isActive = active === path;
          return (
            <button
              key={path}
              onClick={() => navigateTo(path)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                'transition-all duration-200 whitespace-nowrap flex-shrink-0',
                isActive
                  ? 'bg-[#164281] text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100',
              ].join(' ')}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* ── Iframe ──────────────────────────────────────────── */}
      <iframe
        ref={iframeRef}
        src={src}
        title="Central de Producción"
        className="flex-1 w-full border-none"
        allow="clipboard-write"
      />
    </div>
  );
}
