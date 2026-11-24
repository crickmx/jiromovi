import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import {
  Search, X, Paperclip, ChevronLeft, ChevronRight, MoreHorizontal, Menu, SlidersHorizontal,
  Mail, MailOpen, Archive, Trash2, FolderInput, ClipboardList, Plus, RefreshCw, Inbox, SearchX, CircleAlert,
} from 'lucide-react';
import { cnSistema as cn } from '@/lib/utils';
import {
  type FiltrosCorreo, type FiltroFecha, FILTROS_VACIOS, aplicarFiltros, hayFiltros, resaltar, fechaRelativa,
} from '@/lib/correo/filtrosCorreo';
import { type Identidad, etiquetaIdentidad, normalizarCorreo } from '@/lib/correo/identidadRemitente';
import { type EmailHeader, type ImapFolder, getInitials, tonoAvatar } from './tipos';
import { MenuCorreo, type AccionCorreo } from './MenuCorreo';

interface Props {
  titulo: string;
  mensajes: EmailHeader[];
  total: number;
  page: number;
  totalPages: number;
  cargando: boolean;
  error?: string | null;
  seleccionadoUid: number | null;
  carpetas: ImapFolder[];
  carpetaActual: string;
  puedeArchivar: boolean;
  identidades: Map<string, Identidad | null>;
  tramites: Map<string, { id: string; folio: string }>;
  // búsqueda
  consulta: string;
  enBusqueda: boolean;
  buscando: boolean;
  onBuscar: (q: string, enContenido: boolean) => void;
  onLimpiarBusqueda: () => void;
  // acciones
  onAbrir: (m: EmailHeader) => void;
  onAccion: (a: AccionCorreo, uids: number[]) => void;
  onPagina: (p: number) => void;
  onActualizar: () => void;
  onMenuCarpetas: () => void;
}

const btnIcono = 'w-10 h-10 flex items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-surface-muted hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40';

function Resaltado({ texto, q }: { texto: string; q: string }) {
  if (!q.trim()) return <>{texto}</>;
  return <>{resaltar(texto, q).map((p, i) => p.hit
    ? <mark key={i} className="bg-amber-200/70 dark:bg-amber-400/30 text-inherit rounded-sm px-px">{p.t}</mark>
    : <span key={i}>{p.t}</span>)}</>;
}

// ── Fila con gesto de deslizar (solo táctil) ───────────────────────

const UMBRAL = 88;

function FilaCorreo({
  m, activo, marcado, identidad, tramite, consulta, modoSeleccion,
  onAbrir, onMarcar, onDeslizar, puedeArchivar, menu,
}: {
  m: EmailHeader; activo: boolean; marcado: boolean; identidad: Identidad | null | undefined;
  tramite?: { id: string; folio: string }; consulta: string; modoSeleccion: boolean;
  onAbrir: () => void; onMarcar: (v: boolean) => void; onDeslizar: (dir: 'izq' | 'der') => void;
  puedeArchivar: boolean; menu: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const inicio = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const arrastro = useRef(false);
  const largo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelarLargo = () => { if (largo.current) { clearTimeout(largo.current); largo.current = null; } };

  // Táctil: mantener presionado selecciona; deslizar a los lados archiva o elimina.
  const down = (e: RPointerEvent) => {
    if (e.pointerType !== 'touch') return;
    inicio.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
    arrastro.current = false;
    cancelarLargo();
    largo.current = setTimeout(() => {
      largo.current = null;
      arrastro.current = true; // que el "click" al soltar no abra el correo
      if (navigator.vibrate) navigator.vibrate(15);
      onMarcar(!marcado);
    }, 500);
  };
  const move = (e: RPointerEvent) => {
    const s = inicio.current;
    if (!s || s.id !== e.pointerId) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (s.horizontal === null && (Math.abs(ddx) > 10 || Math.abs(ddy) > 10)) { s.horizontal = Math.abs(ddx) > Math.abs(ddy); cancelarLargo(); }
    if (!s.horizontal) return;
    arrastro.current = true;
    if (modoSeleccion) return;
    setDx(Math.max(-140, Math.min(140, ddx)));
  };
  const up = () => {
    cancelarLargo();
    const s = inicio.current;
    inicio.current = null;
    if (!s?.horizontal) { setDx(0); return; }
    if (dx <= -UMBRAL) onDeslizar('izq');
    else if (dx >= UMBRAL) onDeslizar('der');
    setDx(0);
  };

  const nombre = m.from || m.fromEmail;
  const etiqueta = etiquetaIdentidad(identidad);
  const derecha = dx > 0;

  return (
    <li className="relative overflow-hidden">
      {dx !== 0 && (
        <div aria-hidden className={cn(
          'absolute inset-0 flex items-center px-6 text-white font-semibold text-body-sm',
          derecha ? 'justify-start' : 'justify-end',
          derecha ? (puedeArchivar ? 'bg-emerald-600' : 'bg-sky-600') : 'bg-red-600',
        )}>
          {derecha
            ? (puedeArchivar ? <><Archive className="w-5 h-5 mr-2" /> Archivar</> : <><MailOpen className="w-5 h-5 mr-2" /> Leído</>)
            : <>Eliminar <Trash2 className="w-5 h-5 ml-2" /></>}
        </div>
      )}
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: 'pan-y' }}
        className={cn(
          'relative group flex items-stretch bg-surface-card transition-[background-color] duration-fast',
          dx === 0 && 'transition-transform',
          activo ? 'bg-accent-soft dark:bg-accent/15' : marcado ? 'bg-accent-softer dark:bg-accent/10' : 'hover:bg-surface-muted',
        )}
      >
        {!m.seen && <span aria-hidden className="absolute left-0 inset-y-2 w-[3px] rounded-r-full bg-accent" />}
        <label className={cn(
          'flex items-center justify-center w-11 flex-shrink-0 cursor-pointer',
          !modoSeleccion && !marcado && 'md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100',
          !modoSeleccion && !marcado && 'max-md:hidden',
        )}>
          <input
            type="checkbox"
            checked={marcado}
            onChange={e => onMarcar(e.target.checked)}
            aria-label={`Seleccionar correo de ${nombre}`}
            className="w-[18px] h-[18px] rounded border-strong text-accent focus:ring-accent cursor-pointer"
          />
        </label>
        <button
          type="button"
          onClick={() => { if (arrastro.current) return; if (modoSeleccion) onMarcar(!marcado); else onAbrir(); }}
          aria-current={activo ? 'true' : undefined}
          className={cn(
            'flex-1 min-w-0 flex items-start gap-3 py-3 pr-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent rounded-sm',
            (modoSeleccion || marcado) ? 'pl-0' : 'pl-3 md:pl-0',
          )}
        >
          <span aria-hidden className={cn('w-10 h-10 rounded-full flex items-center justify-center text-caption font-bold flex-shrink-0 mt-0.5', tonoAvatar(m.fromEmail))}>
            {getInitials(nombre)}
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-baseline gap-2 min-w-0">
              <span className={cn('truncate text-body-sm', m.seen ? 'font-medium text-neutral-700 dark:text-neutral-200' : 'font-bold text-neutral-900 dark:text-white')}>
                <Resaltado texto={nombre} q={consulta} />
              </span>
              {etiqueta && (
                <span className="flex-shrink-0 text-[10.5px] leading-4 font-semibold px-1.5 rounded-full bg-accent-soft dark:bg-accent/20 text-accent-ink" title={identidad?.nombre}>
                  {etiqueta}
                </span>
              )}
              <span className={cn('ml-auto text-micro flex-shrink-0 tabular-nums', m.seen ? 'text-neutral-500 dark:text-neutral-400' : 'text-accent-ink font-semibold')}>
                {fechaRelativa(m.date)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 min-w-0 mt-0.5">
              <span className={cn('truncate text-caption', m.seen ? 'text-neutral-600 dark:text-neutral-300' : 'font-semibold text-neutral-900 dark:text-white')}>
                <Resaltado texto={m.subject || '(Sin asunto)'} q={consulta} />
              </span>
              {m.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" aria-label="Con adjunto" />}
            </span>
            {(m.snippet || tramite) && (
              <span className="flex items-center gap-1.5 min-w-0 mt-0.5">
                {tramite && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10.5px] leading-4 font-semibold px-1.5 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <ClipboardList className="w-3 h-3" aria-hidden /> {tramite.folio}
                  </span>
                )}
                {m.snippet && (
                  <span className="truncate text-caption text-neutral-500 dark:text-neutral-400">
                    <Resaltado texto={m.snippet} q={consulta} />
                  </span>
                )}
              </span>
            )}
            <span className="sr-only">{m.seen ? '' : 'No leído.'}</span>
          </span>
        </button>
        <div className="flex items-start pt-2 pr-1 flex-shrink-0">{menu}</div>
      </div>
    </li>
  );
}

// ── Lista ───────────────────────────────────────────────────────────

export function ListaCorreos(p: Props) {
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [filtros, setFiltros] = useState<FiltrosCorreo>(FILTROS_VACIOS);
  const [verFiltros, setVerFiltros] = useState(false);
  const [q, setQ] = useState(p.consulta);
  const [enContenido, setEnContenido] = useState(true);
  const buscarRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQ(p.consulta); }, [p.consulta]);
  // Al cambiar de carpeta o de página, la selección deja de tener sentido.
  useEffect(() => { setMarcados(new Set()); }, [p.carpetaActual, p.page, p.enBusqueda]);

  // Atajo "/" para buscar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        buscarRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibles = useMemo(() => aplicarFiltros(p.mensajes, filtros), [p.mensajes, filtros]);
  const remitentes = useMemo(() => {
    const m = new Map<string, string>();
    p.mensajes.forEach(x => { if (!m.has(x.fromEmail)) m.set(x.fromEmail, x.from || x.fromEmail); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')).slice(0, 50);
  }, [p.mensajes]);

  const sel = [...marcados].filter(u => visibles.some(v => v.uid === u));
  const modoSeleccion = sel.length > 0;
  const todos = visibles.length > 0 && sel.length === visibles.length;
  const todosLeidos = sel.every(u => p.mensajes.find(m => m.uid === u)?.seen);
  const filtrosActivos = hayFiltros(filtros);

  const marcar = (uid: number, v: boolean) => setMarcados(s => { const n = new Set(s); if (v) n.add(uid); else n.delete(uid); return n; });
  const accionLote = (a: AccionCorreo) => { p.onAccion(a, sel); setMarcados(new Set()); };

  const enviarBusqueda = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (q.trim()) p.onBuscar(q.trim(), enContenido);
  };

  const chip = (activo: boolean) => cn(
    'min-h-[32px] px-3 rounded-full text-caption font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap',
    activo ? 'bg-accent-soft dark:bg-accent/20 text-accent-ink border-transparent' : 'bg-surface-card text-neutral-600 dark:text-neutral-300 border-soft hover:border-strong',
  );

  return (
    <div className="flex flex-col h-full bg-surface-card min-w-0">
      {/* Encabezado */}
      <div className="px-2 sm:px-3 pt-2 pb-2 border-b border-soft space-y-2">
        <form role="search" onSubmit={enviarBusqueda} className="flex items-center gap-1">
          <button type="button" onClick={p.onMenuCarpetas} aria-label="Abrir carpetas" className={cn(btnIcono, 'md:hidden flex-shrink-0')}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
            <input
              ref={buscarRef}
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape' && p.enBusqueda) { setQ(''); p.onLimpiarBusqueda(); } }}
              placeholder="Buscar correo"
              aria-label="Buscar por remitente, asunto o contenido"
              aria-keyshortcuts="/"
              className="w-full h-10 pl-9 pr-9 text-body-sm rounded-full bg-surface-muted text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-transparent focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
            />
            {(q || p.enBusqueda) && (
              <button
                type="button"
                onClick={() => { setQ(''); p.onLimpiarBusqueda(); }}
                aria-label="Limpiar búsqueda"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setVerFiltros(v => !v)}
            aria-label="Filtros"
            aria-expanded={verFiltros}
            className={cn(btnIcono, 'flex-shrink-0 relative', (verFiltros || filtrosActivos) && 'text-accent-ink bg-accent-softer dark:bg-accent/10')}
          >
            <SlidersHorizontal className="w-5 h-5" />
            {filtrosActivos && <span aria-hidden className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />}
          </button>
          <button type="button" onClick={p.onActualizar} disabled={p.cargando} aria-label="Actualizar" className={cn(btnIcono, 'flex-shrink-0')}>
            <RefreshCw className={cn('w-5 h-5', p.cargando && 'animate-spin')} />
          </button>
        </form>

        {q.trim() && !p.enBusqueda && (
          <label className="flex items-center gap-2 px-2 text-caption text-neutral-600 dark:text-neutral-300 cursor-pointer select-none">
            <input type="checkbox" checked={enContenido} onChange={e => setEnContenido(e.target.checked)} className="rounded border-strong text-accent focus:ring-accent" />
            Buscar también en el contenido · <span className="text-neutral-400">Enter para buscar</span>
          </label>
        )}

        {verFiltros && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 animate-fade-in" role="group" aria-label="Filtros de la lista">
            <button type="button" aria-pressed={filtros.noLeidos} onClick={() => setFiltros(f => ({ ...f, noLeidos: !f.noLeidos }))} className={chip(filtros.noLeidos)}>No leídos</button>
            <button type="button" aria-pressed={filtros.conAdjuntos} onClick={() => setFiltros(f => ({ ...f, conAdjuntos: !f.conAdjuntos }))} className={chip(filtros.conAdjuntos)}>Con adjuntos</button>
            <select
              value={filtros.fecha}
              onChange={e => setFiltros(f => ({ ...f, fecha: e.target.value as FiltroFecha }))}
              aria-label="Fecha"
              className={cn(chip(filtros.fecha !== 'todas'), 'pr-8 py-0 bg-no-repeat')}
            >
              <option value="todas">Cualquier fecha</option>
              <option value="hoy">Hoy</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
            </select>
            <select
              value={filtros.remitente}
              onChange={e => setFiltros(f => ({ ...f, remitente: e.target.value }))}
              aria-label="Remitente"
              className={cn(chip(!!filtros.remitente), 'pr-8 py-0 max-w-[12rem]')}
            >
              <option value="">Cualquier remitente</option>
              {remitentes.map(([email, nombre]) => <option key={email} value={email}>{nombre}</option>)}
            </select>
            {filtrosActivos && (
              <button type="button" onClick={() => setFiltros(FILTROS_VACIOS)} className="min-h-[32px] px-2 text-caption font-semibold text-accent-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
                Quitar filtros
              </button>
            )}
            <p className="w-full px-1 text-micro text-neutral-400 dark:text-neutral-500">Se aplican a los correos de esta página.</p>
          </div>
        )}

        {/* Título o barra de acciones en lote */}
        {modoSeleccion ? (
          <div className="flex items-center gap-1 px-1 min-h-[40px] animate-fade-in" role="toolbar" aria-label="Acciones para los correos seleccionados">
            <input
              type="checkbox"
              checked={todos}
              ref={el => { if (el) el.indeterminate = !todos && sel.length > 0; }}
              onChange={e => setMarcados(e.target.checked ? new Set(visibles.map(v => v.uid)) : new Set())}
              aria-label="Seleccionar todos"
              className="w-[18px] h-[18px] mx-[11px] rounded border-strong text-accent focus:ring-accent"
            />
            <span className="text-body-sm font-semibold text-neutral-800 dark:text-neutral-100 mr-auto tabular-nums" aria-live="polite">{sel.length}</span>
            <button type="button" onClick={() => accionLote({ tipo: 'crear_tramite' })} aria-label="Crear trámite con los seleccionados" title="Crear trámite" className={btnIcono}><ClipboardList className="w-5 h-5" /></button>
            <button type="button" onClick={() => accionLote({ tipo: 'agregar_tramite' })} aria-label="Agregar los seleccionados a un trámite" title="Agregar a trámite" className={btnIcono}><Plus className="w-5 h-5" /></button>
            <button type="button" onClick={() => accionLote({ tipo: 'leido', valor: !todosLeidos })} aria-label={todosLeidos ? 'Marcar como no leídos' : 'Marcar como leídos'} title={todosLeidos ? 'Marcar no leídos' : 'Marcar leídos'} className={btnIcono}>
              {todosLeidos ? <Mail className="w-5 h-5" /> : <MailOpen className="w-5 h-5" />}
            </button>
            <MenuCorreo
              trigger={<button type="button" aria-label="Mover los seleccionados" title="Mover" className={btnIcono}><FolderInput className="w-5 h-5" /></button>}
              carpetas={p.carpetas} carpetaActual={p.carpetaActual} puedeArchivar={p.puedeArchivar} sinTramite
              onAccion={accionLote}
            />
            {p.puedeArchivar && (
              <button type="button" onClick={() => accionLote({ tipo: 'archivar' })} aria-label="Archivar los seleccionados" title="Archivar" className={btnIcono}><Archive className="w-5 h-5" /></button>
            )}
            <button type="button" onClick={() => accionLote({ tipo: 'eliminar' })} aria-label="Eliminar los seleccionados" title="Eliminar" className={cn(btnIcono, 'hover:text-red-600 dark:hover:text-red-400')}><Trash2 className="w-5 h-5" /></button>
            <button type="button" onClick={() => setMarcados(new Set())} aria-label="Cancelar selección" className={btnIcono}><X className="w-5 h-5" /></button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-2 min-h-[40px]">
            <div className="min-w-0">
              <h2 className="font-display text-title-sm font-semibold text-neutral-900 dark:text-white truncate">
                {p.enBusqueda ? <>Resultados para “{p.consulta}”</> : p.titulo}
              </h2>
              <p className="text-micro text-neutral-500 dark:text-neutral-400 tabular-nums">
                {p.enBusqueda
                  ? `${p.total} resultado${p.total !== 1 ? 's' : ''}`
                  : filtrosActivos ? `${visibles.length} de ${p.mensajes.length} en esta página` : `${p.total.toLocaleString('es-MX')} correo${p.total !== 1 ? 's' : ''}`}
              </p>
            </div>
            {!p.enBusqueda && p.totalPages > 1 && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button type="button" onClick={() => p.onPagina(p.page - 1)} disabled={p.page <= 1} aria-label="Página anterior" className={btnIcono}><ChevronLeft className="w-5 h-5" /></button>
                <span className="text-caption text-neutral-500 dark:text-neutral-400 tabular-nums min-w-[3rem] text-center">{p.page} / {p.totalPages}</span>
                <button type="button" onClick={() => p.onPagina(p.page + 1)} disabled={p.page >= p.totalPages} aria-label="Página siguiente" className={btnIcono}><ChevronRight className="w-5 h-5" /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filas */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {p.error ? (
          <div role="alert" className="px-6 py-12 text-center">
            <CircleAlert className="w-8 h-8 mx-auto text-red-500 mb-2" aria-hidden />
            <p className="text-body-sm font-semibold text-neutral-800 dark:text-neutral-100">No se pudo cargar la carpeta</p>
            <p className="text-caption text-neutral-500 dark:text-neutral-400 mt-1 mb-4 break-words">{p.error}</p>
            <button type="button" onClick={p.onActualizar} className="min-h-[40px] px-4 rounded-[var(--radius-sm)] bg-accent text-accent-foreground text-caption font-semibold hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Reintentar</button>
          </div>
        ) : (p.cargando || p.buscando) && p.mensajes.length === 0 ? (
          <ul aria-busy="true" aria-label="Cargando correos">
            {Array.from({ length: 9 }).map((_, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-surface-muted flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1"><div className="h-2.5 rounded bg-surface-muted w-1/2" /><div className="h-2 rounded bg-surface-muted w-4/5" /><div className="h-2 rounded bg-surface-muted w-2/3" /></div>
              </li>
            ))}
          </ul>
        ) : visibles.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="w-12 h-12 mx-auto rounded-[var(--radius-md)] bg-surface-muted flex items-center justify-center mb-3">
              {p.enBusqueda || filtrosActivos ? <SearchX className="w-5 h-5 text-neutral-400" aria-hidden /> : <Inbox className="w-5 h-5 text-neutral-400" aria-hidden />}
            </div>
            <p className="text-body-sm font-semibold text-neutral-700 dark:text-neutral-200">
              {p.enBusqueda ? 'Sin resultados' : filtrosActivos ? 'Ningún correo cumple los filtros' : 'Carpeta vacía'}
            </p>
            <p className="text-caption text-neutral-500 dark:text-neutral-400 mt-1">
              {p.enBusqueda ? 'Prueba con otras palabras o busca en otra carpeta.' : filtrosActivos ? 'Quita algún filtro para ver más.' : 'No hay correos aquí.'}
            </p>
          </div>
        ) : (
          <ul aria-label={p.titulo} className={cn('divide-y divide-[color:var(--border-soft)]', p.cargando && 'opacity-60 transition-opacity')}>
            {visibles.map(m => (
              <FilaCorreo
                key={`${m.folder || ''}:${m.uid}`}
                m={m}
                activo={p.seleccionadoUid === m.uid}
                marcado={marcados.has(m.uid)}
                modoSeleccion={modoSeleccion}
                identidad={p.identidades.get(normalizarCorreo(m.fromEmail))}
                tramite={p.tramites.get(m.messageId)}
                consulta={p.enBusqueda ? p.consulta : ''}
                puedeArchivar={p.puedeArchivar}
                onAbrir={() => p.onAbrir(m)}
                onMarcar={v => marcar(m.uid, v)}
                onDeslizar={dir => p.onAccion(dir === 'izq' ? { tipo: 'eliminar' } : p.puedeArchivar ? { tipo: 'archivar' } : { tipo: 'leido', valor: true }, [m.uid])}
                menu={(
                  <MenuCorreo
                    trigger={(
                      <button type="button" aria-label={`Más acciones para el correo de ${m.from || m.fromEmail}`} className={cn(btnIcono, 'w-9 h-9 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100')}>
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    )}
                    carpetas={p.carpetas}
                    carpetaActual={p.carpetaActual}
                    puedeArchivar={p.puedeArchivar}
                    tramite={p.tramites.get(m.messageId) || null}
                    leido={m.seen}
                    onAccion={a => p.onAccion(a, [m.uid])}
                  />
                )}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
