import { useEffect, useRef, useState } from 'react';
import { Building2, Loader2, Mail, UserRound, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { callWebmail } from '../../lib/ionosWebmail';
import { emailCache } from '../../lib/emailCache';

// Campo de destinatario con autocompletado multi-fuente para el correo nativo:
//   • MOVI      — directorio de usuarios (email_laboral)
//   • Guardado  — tabla `contactos` (personales / compartidos por RLS)
//   • IONOS     — recientes de tu buzón + libreta CardDAV (edge `list-contacts`)
// Trabaja sobre un string separado por comas (igual que el resto del compose):
// sólo se reemplaza el último token al elegir una sugerencia.

type Source = 'MOVI' | 'Guardado' | 'IONOS';

interface Suggestion {
  email: string;
  name: string;
  source: Source;
  detail?: string;
}

interface RecipientPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const SOURCE_PRIORITY: Record<Source, number> = { MOVI: 0, Guardado: 1, IONOS: 2 };

// ── Carga compartida entre instancias (Para/CC/CCO montan varios pickers) ──

let directoryCache: Suggestion[] | null = null;
let directoryPromise: Promise<Suggestion[]> | null = null;
let ionosPromise: Promise<Suggestion[]> | null = null;

async function loadDirectory(usuario: any): Promise<Suggestion[]> {
  if (directoryCache) return directoryCache;
  if (directoryPromise) return directoryPromise;

  directoryPromise = (async () => {
    let dirQuery = supabase
      .from('usuarios')
      .select('id,nombre,apellidos,nombre_completo,email_laboral,puesto,oficina_id,oficina:oficinas!oficina_id(nombre)')
      .eq('activo', true)
      .eq('is_deleted', false)
      .not('email_laboral', 'is', null)
      .order('nombre');
    if (usuario?.rol !== 'Administrador' && usuario?.oficina_id) {
      dirQuery = dirQuery.eq('oficina_id', usuario.oficina_id);
    }

    const [dirRes, savedRes] = await Promise.all([
      dirQuery,
      supabase.from('contactos').select('nombre,apellido,email,empresa').eq('eliminado', false).order('nombre'),
    ]);

    const out: Suggestion[] = [];
    for (const u of ((dirRes.data as any[]) || [])) {
      if (!u.email_laboral) continue;
      out.push({
        email: String(u.email_laboral).toLowerCase(),
        name: u.nombre_completo || `${u.nombre || ''} ${u.apellidos || ''}`.trim() || u.email_laboral,
        source: 'MOVI',
        detail: [u.puesto, u.oficina?.nombre].filter(Boolean).join(' · '),
      });
    }
    for (const c of ((savedRes.data as any[]) || [])) {
      if (!c.email) continue;
      out.push({
        email: String(c.email).toLowerCase(),
        name: `${c.nombre || ''} ${c.apellido || ''}`.trim() || c.email,
        source: 'Guardado',
        detail: c.empresa || undefined,
      });
    }
    directoryCache = out;
    return out;
  })();

  try { return await directoryPromise; }
  finally { directoryPromise = null; }
}

async function loadIonos(): Promise<Suggestion[]> {
  const cached = emailCache.getContacts<Suggestion[]>();
  if (cached) return cached;
  if (ionosPromise) return ionosPromise;

  ionosPromise = (async () => {
    const data = await callWebmail('list-contacts');
    const out: Suggestion[] = ((data?.contacts as any[]) || []).map((c) => ({
      email: String(c.email).toLowerCase(),
      name: c.name || c.email,
      source: 'IONOS' as const,
      detail: c.source === 'libreta' ? 'Libreta IONOS' : 'Reciente',
    }));
    emailCache.setContacts(out);
    return out;
  })();

  try { return await ionosPromise; }
  finally { ionosPromise = null; }
}

function dedupe(list: Suggestion[]): Suggestion[] {
  const byEmail = new Map<string, Suggestion>();
  for (const s of list) {
    const prev = byEmail.get(s.email);
    if (!prev || SOURCE_PRIORITY[s.source] < SOURCE_PRIORITY[prev.source]) {
      byEmail.set(s.email, prev && !s.name ? { ...s, name: prev.name } : s);
    }
  }
  return [...byEmail.values()];
}

const SOURCE_META: Record<Source, { icon: typeof Users; cls: string }> = {
  MOVI: { icon: Building2, cls: 'bg-accent/10 text-accent' },
  Guardado: { icon: Users, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  IONOS: { icon: Mail, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};

export function RecipientPicker({ value, onChange, placeholder, className, autoFocus }: RecipientPickerProps) {
  const { usuario } = useAuth();
  const [all, setAll] = useState<Suggestion[]>([]);
  const [ionosLoading, setIonosLoading] = useState(false);
  const [filtered, setFiltered] = useState<Suggestion[]>([]);
  const [show, setShow] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);

  const ensureLoaded = () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    if (usuario) {
      loadDirectory(usuario).then((dir) => setAll((prev) => dedupe([...prev, ...dir]))).catch(() => {});
    }
    setIonosLoading(true);
    loadIonos()
      .then((ionos) => setAll((prev) => dedupe([...prev, ...ionos])))
      .catch(() => {})
      .finally(() => setIonosLoading(false));
  };

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const currentToken = () => {
    const parts = value.split(',');
    return parts[parts.length - 1].trim().toLowerCase();
  };

  useEffect(() => {
    const token = currentToken();
    if (token.length < 2) { setFiltered([]); setShow(false); return; }
    const matches = all
      .filter((s) => s.email.includes(token) || s.name.toLowerCase().includes(token) || (s.detail || '').toLowerCase().includes(token))
      .slice(0, 8);
    setFiltered(matches);
    setShow(matches.length > 0);
    setHighlighted(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, all]);

  const select = (s: Suggestion) => {
    const parts = value.split(',');
    parts[parts.length - 1] = parts.length > 1 ? ` ${s.email}` : s.email;
    onChange(parts.join(','));
    setShow(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!show || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((p) => (p + 1) % filtered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((p) => (p - 1 + filtered.length) % filtered.length); }
    else if (e.key === 'Enter') {
      if (filtered[highlighted]) { e.preventDefault(); select(filtered[highlighted]); }
    } else if (e.key === 'Escape') { setShow(false); }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { ensureLoaded(); if (filtered.length > 0) setShow(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
      />

      {show && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {ionosLoading && (
            <div className="px-3 py-1.5 text-[10px] text-neutral-400 flex items-center gap-1.5 border-b border-neutral-100 dark:border-neutral-700/50">
              <Loader2 className="w-3 h-3 animate-spin" /> Cargando contactos de IONOS…
            </div>
          )}
          {filtered.map((s, i) => {
            const Meta = SOURCE_META[s.source];
            const Icon = Meta.icon;
            return (
              <button
                type="button"
                key={`${s.source}:${s.email}`}
                onClick={() => select(s)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition ${
                  i === highlighted ? 'bg-accent/10' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/40'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                  <UserRound className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-neutral-800 dark:text-white truncate">{s.name}</p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{s.email}</p>
                </div>
                <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${Meta.cls}`}>
                  <Icon className="w-2.5 h-2.5" /> {s.source}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
