import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, BarChart2, DollarSign, Target, BookOpen,
  UploadCloud, Trophy, Loader2, AlertCircle, FileText,
} from 'lucide-react';

const BONOS_URL = import.meta.env.VITE_BONOS_URL || 'http://localhost:8000';

const SECTIONS = [
  { label: 'Inicio',       path: '/',                      icon: Home },
  { label: 'Dashboard',    path: '/reporting/dashboard/',   icon: BarChart2 },
  { label: 'Pólizas',      path: '/etl/polizas/',           icon: FileText },
  { label: 'Resultados',   path: '/calculations/results/',  icon: DollarSign },
  { label: 'Metas',        path: '/metas/',                 icon: Target },
  { label: 'Catálogos',    path: '/catalogs/',              icon: BookOpen },
  { label: 'Cargas',       path: '/etl/upload/',            icon: UploadCloud },
  { label: 'Campañas',     path: '/campanias/',             icon: Trophy },
];

const ADMIN_SECTIONS = new Set(['/catalogs/', '/etl/upload/', '/campanias/']);

export function BonosPage() {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [src,  setSrc]    = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState('/');
  const [bonosRole, setBonosRole] = useState<string>('');

  const { isMasked, usuario } = useAuth();

  /* ── 1. Construir URL del iframe ────────────────────────────────────── */
  useEffect(() => {
    setError(false);

    if (import.meta.env.DEV) {
      // En desarrollo siempre usar dev-login con el email del usuario actual
      // (usuario ya refleja el enmascarado cuando hay máscara activa)
      const email = usuario?.email_laboral;
      if (!email) { setError(true); return; }
      const devUrl = new URL('/accounts/dev-login/', BONOS_URL);
      devUrl.searchParams.set('email', email);
      devUrl.searchParams.set('next', '/');
      setSrc(devUrl.toString());
      return;
    }

    // Producción: SSO con JWT de Supabase
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
      if (e.data?.type === 'bonos:userinfo' && e.data.role) {
        setBonosRole(e.data.role);
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

  /* ── Estados de carga / error ────────────────────────────────────── */
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
        <span className="text-sm">Conectando con Bonos JIRO…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Sub-nav ─────────────────────────────────────────── */}
      <nav className="flex items-center gap-1 px-4 border-b border-neutral-200/60
                      bg-white/90 backdrop-blur-xl flex-shrink-0"
           style={{ height: 44 }}>
        {SECTIONS.filter(s =>
          !ADMIN_SECTIONS.has(s.path) || bonosRole === 'admin' || bonosRole === 'dirreg'
        ).map(({ label, path, icon: Icon }) => {
          const isActive = active === path;
          return (
            <button
              key={path}
              onClick={() => navigateTo(path)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                'transition-all duration-200 whitespace-nowrap',
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
        title="Plataforma de Bonos JIRO"
        className="flex-1 w-full border-none"
        allow="clipboard-write"
      />
    </div>
  );
}
