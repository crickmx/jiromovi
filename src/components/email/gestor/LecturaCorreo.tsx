import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Reply, ReplyAll, Forward, ClipboardList, Plus, Trash2, Archive, MoreHorizontal, Mail, MailOpen,
  ChevronDown, ChevronUp, Download, Eye, FileText, FileImage, FileSpreadsheet, FileArchive, File as FileIcon,
  ShieldAlert, ImageOff, UserRound, Building2, ExternalLink, MessagesSquare, Loader2, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cnSistema as cn } from '@/lib/utils';
import { fechaRelativa } from '@/lib/correo/filtrosCorreo';
import { type Identidad } from '@/lib/correo/identidadRemitente';
import { motivosSospecha, tieneImagenesExternas, cspCorreo } from '@/lib/correo/seguridadCorreo';
import { correosDelHilo } from '@/lib/correo/hiloCorreo';
import {
  type EmailFull, type EmailHeader, type ImapFolder, callWebmail, formatSize, formatFullDate, getInitials, tonoAvatar, etiquetaCarpeta,
} from './tipos';
import { MenuCorreo, type AccionCorreo } from './MenuCorreo';

interface Props {
  mensaje: EmailFull;
  cargando: boolean;
  carpetaActual: string;
  carpetas: ImapFolder[];
  puedeArchivar: boolean;
  identidad: Identidad | null | undefined;
  usuarioId: string | undefined;
  onVolver: () => void;
  onAccion: (a: AccionCorreo) => void;
  onResponder: () => void;
  onResponderTodos: () => void;
  onReenviar: () => void;
  onAbrirDelHilo: (h: EmailHeader) => void;
  /** Se avisa cuando se conoce el trámite ligado (para que el resto de la pantalla lo use). */
  onTramite?: (t: { id: string; folio: string } | null) => void;
}

const BODY_RENDER_LIMIT = 1_500_000; // ~1.5 MB de HTML: arriba de esto se pide confirmación

const btnIcono = 'w-10 h-10 flex items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-surface-muted hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent flex-shrink-0';
const btnTexto = 'min-h-[40px] inline-flex items-center gap-2 px-3 rounded-[var(--radius-sm)] text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap';

function iconoArchivo(ct: string, nombre: string) {
  const t = `${ct} ${nombre}`.toLowerCase();
  if (/image|\.(png|jpe?g|gif|webp|heic)$/.test(t)) return FileImage;
  if (/sheet|excel|csv|\.xlsx?$/.test(t)) return FileSpreadsheet;
  if (/zip|rar|7z|compressed/.test(t)) return FileArchive;
  if (/pdf|word|text|document/.test(t)) return FileText;
  return FileIcon;
}

const clavePreferencia = (usuarioId: string | undefined) => `movi_correo_imagenes_confiables_${usuarioId || 'anon'}`;
function remitentesConfiables(usuarioId: string | undefined): string[] {
  try { return JSON.parse(localStorage.getItem(clavePreferencia(usuarioId)) || '[]'); } catch { return []; }
}

export function LecturaCorreo(p: Props) {
  const m = p.mensaje;
  const [verDestinatarios, setVerDestinatarios] = useState(false);
  const [tramite, setTramite] = useState<{ id: string; folio: string } | null>(null);
  const [renderGrande, setRenderGrande] = useState(false);
  const [permitirImagenes, setPermitirImagenes] = useState(false);
  const [hilo, setHilo] = useState<EmailHeader[] | null>(null);
  const [verHilo, setVerHilo] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState<{ url: string; nombre: string; tipo: string } | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const cuerpoGrande = !!m.bodyHtml && m.bodyHtml.length > BODY_RENDER_LIMIT && !renderGrande;
  const hayImagenes = useMemo(() => tieneImagenesExternas(m.bodyHtml), [m.bodyHtml]);
  const sospecha = useMemo(() => motivosSospecha(m.from, m.fromEmail), [m.from, m.fromEmail]);

  // Al cambiar de correo: confirmación de cuerpos grandes e imágenes, otra vez.
  useEffect(() => {
    setRenderGrande(false);
    setVerDestinatarios(false);
    setVerHilo(false);
    setErrorAdjunto(null);
    const confiable = remitentesConfiables(p.usuarioId).includes((m.fromEmail || '').toLowerCase());
    setPermitirImagenes(confiable && motivosSospecha(m.from, m.fromEmail).length === 0);
  }, [m.uid, m.fromEmail, m.from, p.usuarioId]);

  // Trámite ligado: misma consulta que antes (correo de origen = este Message-ID).
  useEffect(() => {
    let vivo = true;
    if (!m.messageId) { setTramite(null); p.onTramite?.(null); return; }
    supabase.from('tickets').select('id, folio')
      .eq('canal_origen', 'email').eq('source_email_message_id', m.messageId)
      .limit(1)
      .then(({ data }) => {
        if (!vivo) return;
        const t = (data && data[0]) || null;
        setTramite(t);
        p.onTramite?.(t);
      });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.messageId]);

  // Hilo: el servidor da candidatos por asunto; aquí se quedan los que comparten referencias.
  useEffect(() => {
    let vivo = true;
    setHilo(null);
    if (!m.subject) { setHilo([]); return; }
    callWebmail('thread', { subject: m.subject, folder: p.carpetaActual })
      .then((r: { messages?: EmailHeader[] }) => {
        if (!vivo) return;
        const otros = correosDelHilo({ ...m, folder: p.carpetaActual }, r.messages || [])
          .filter(c => !(c.uid === m.uid && c.folder === p.carpetaActual));
        setHilo(otros);
      })
      .catch(() => { if (vivo) setHilo([]); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.uid, m.messageId, p.carpetaActual]);

  // Pintar el HTML en el iframe aislado (sin scripts; las imágenes externas las controla la CSP).
  useEffect(() => {
    if (cuerpoGrande) return;
    const iframe = iframeRef.current;
    if (!iframe || !m.bodyHtml) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="${cspCorreo(permitirImagenes)}">
      <meta name="referrer" content="no-referrer">
      <base target="_blank"><style>
      html { color-scheme: light; }
      body { font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; color: #1c1917; background: #fff; margin: 20px; word-break: break-word; overflow-wrap: anywhere; }
      img { max-width: 100%; height: auto; }
      a { color: #1d4ed8; }
      table { max-width: 100% !important; }
      pre { white-space: pre-wrap; }
      blockquote { border-left: 3px solid #e7e5e4; margin: 8px 0; padding-left: 12px; color: #57534e; }
    </style></head><body>${m.bodyHtml}</body></html>`);
    doc.close();
    const ajustar = () => {
      const b = iframe.contentDocument?.body;
      if (b) iframe.style.height = `${b.scrollHeight + 40}px`;
    };
    const t1 = setTimeout(ajustar, 150);
    const t2 = setTimeout(ajustar, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [m.bodyHtml, cuerpoGrande, permitirImagenes]);

  const confiarSiempre = () => {
    try {
      const k = clavePreferencia(p.usuarioId);
      const lista = new Set(remitentesConfiables(p.usuarioId));
      lista.add((m.fromEmail || '').toLowerCase());
      localStorage.setItem(k, JSON.stringify([...lista].slice(-500)));
    } catch { /* sin almacenamiento */ }
    setPermitirImagenes(true);
  };

  const bajarAdjunto = async (att: EmailFull['attachments'][number], modo: 'descargar' | 'ver') => {
    setDescargando(att.partId);
    setErrorAdjunto(null);
    try {
      const data = await callWebmail('download-attachment', { uid: m.uid, folder: p.carpetaActual, partId: att.partId });
      if (!data.content) throw new Error('El adjunto llegó vacío');
      const bin = atob(data.content);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const tipo = att.contentType || data.contentType || 'application/octet-stream';
      const blob = new Blob([bytes], { type: tipo });
      const url = URL.createObjectURL(blob);
      if (modo === 'ver') {
        setVistaPrevia({ url, nombre: att.filename, tipo });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = att.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      setErrorAdjunto(`No se pudo ${modo === 'ver' ? 'abrir' : 'descargar'} «${att.filename}». ${e instanceof Error ? e.message : ''}`);
    } finally {
      setDescargando(null);
    }
  };

  const cerrarVista = () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia.url); setVistaPrevia(null); };
  useEffect(() => {
    if (!vistaPrevia) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrarVista(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaPrevia]);

  if (p.cargando) {
    return (
      <div className="flex-1 flex items-center justify-center" aria-busy="true">
        <div className="flex flex-col items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin text-accent-ink" aria-hidden />
          <p className="text-caption">Abriendo correo…</p>
        </div>
      </div>
    );
  }

  const id = p.identidad;
  const previsualizable = (ct: string, n: string) => /^image\/(png|jpe?g|gif|webp)|pdf/i.test(ct) || /\.(png|jpe?g|gif|webp|pdf)$/i.test(n);

  return (
    <div className="flex flex-col h-full min-w-0 bg-surface-canvas">
      {/* Barra de acciones */}
      <div role="toolbar" aria-label="Acciones del correo" className="flex items-center gap-1 px-1.5 sm:px-3 py-2 min-w-0 bg-surface-card border-b border-soft flex-shrink-0">
        <button type="button" onClick={p.onVolver} aria-label="Volver a la lista" className={cn(btnIcono, 'lg:hidden')}>
          <ArrowLeft className="w-5 h-5" />
        </button>

        {tramite ? (
          <Link to={`/tramites/${tramite.id}`} className={cn(btnTexto, 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50')}>
            <ClipboardList className="w-4 h-4" aria-hidden /> <span><span className="max-sm:hidden">Ver trámite </span>{tramite.folio}</span>
          </Link>
        ) : (
          <button type="button" onClick={() => p.onAccion({ tipo: 'crear_tramite' })} className={cn(btnTexto, 'bg-accent text-accent-foreground hover:bg-accent-hover shadow-accent')}>
            <ClipboardList className="w-4 h-4" aria-hidden /> <span>Crear<span className="max-[380px]:hidden"> trámite</span></span>
          </button>
        )}
        <button type="button" onClick={() => p.onAccion({ tipo: 'agregar_tramite' })} aria-label="Agregar a trámite" title="Agregar a trámite" className={cn(btnTexto, 'border border-strong text-neutral-700 dark:text-neutral-200 hover:bg-surface-muted max-xl:px-2.5')}>
          <Plus className="w-4 h-4" aria-hidden /> <span className="max-xl:hidden">Agregar a trámite</span>
        </button>

        <span className="flex-1" />

        <button type="button" onClick={p.onResponder} aria-label="Responder" title="Responder" className={cn(btnIcono, 'max-xl:hidden')}><Reply className="w-5 h-5" /></button>
        <button type="button" onClick={p.onResponderTodos} aria-label="Responder a todos" title="Responder a todos" className={cn(btnIcono, 'max-xl:hidden')}><ReplyAll className="w-5 h-5" /></button>
        <button type="button" onClick={p.onReenviar} aria-label="Reenviar" title="Reenviar" className={cn(btnIcono, 'max-xl:hidden')}><Forward className="w-5 h-5" /></button>
        <button type="button" onClick={() => p.onAccion({ tipo: 'leido', valor: !m.seen })} aria-label={m.seen ? 'Marcar como no leído' : 'Marcar como leído'} title={m.seen ? 'Marcar no leído' : 'Marcar leído'} className={btnIcono}>
          {m.seen ? <Mail className="w-5 h-5" /> : <MailOpen className="w-5 h-5" />}
        </button>
        {p.puedeArchivar && (
          <button type="button" onClick={() => p.onAccion({ tipo: 'archivar' })} aria-label="Archivar" title="Archivar" className={cn(btnIcono, 'max-xl:hidden')}><Archive className="w-5 h-5" /></button>
        )}
        <button type="button" onClick={() => p.onAccion({ tipo: 'eliminar' })} aria-label="Eliminar" title="Eliminar" className={cn(btnIcono, 'hover:text-red-600 dark:hover:text-red-400')}><Trash2 className="w-5 h-5" /></button>
        <MenuCorreo
          trigger={<button type="button" aria-label="Más acciones" className={btnIcono}><MoreHorizontal className="w-5 h-5" /></button>}
          carpetas={p.carpetas} carpetaActual={p.carpetaActual} puedeArchivar={p.puedeArchivar}
          leido={m.seen} sinTramite onAccion={p.onAccion}
          respuestas={{ responder: p.onResponder, todos: p.onResponderTodos, reenviar: p.onReenviar }}
        />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <article className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4" aria-labelledby="asunto-correo">
          <header className="space-y-3">
            <h1 id="asunto-correo" className="font-display text-title sm:text-title-lg font-semibold text-neutral-900 dark:text-white break-words">
              {m.subject || '(Sin asunto)'}
            </h1>
            {tramite && (
              <Link to={`/tramites/${tramite.id}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 hover:underline">
                <ClipboardList className="w-3.5 h-3.5" aria-hidden /> Ligado al trámite {tramite.folio}
              </Link>
            )}
          </header>

          {sospecha.length > 0 && (
            <div role="alert" className="flex gap-3 p-3.5 rounded-[var(--radius-md)] bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-100">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="text-body-sm">
                <p className="font-semibold">Cuidado: este remitente podría no ser quien dice ser.</p>
                <ul className="mt-1 space-y-0.5 list-disc pl-4 text-caption">{sospecha.map(s => <li key={s}>{s}</li>)}</ul>
                <p className="mt-1 text-caption">No abras enlaces ni adjuntos ni compartas datos hasta confirmarlo por otro medio.</p>
              </div>
            </div>
          )}

          {/* Remitente + tarjeta de MOVI */}
          <section className="rounded-[var(--radius-lg)] bg-surface-card border border-soft shadow-e1 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <span aria-hidden className={cn('w-11 h-11 rounded-full flex items-center justify-center text-body-sm font-bold flex-shrink-0', tonoAvatar(m.fromEmail))}>
                {getInitials(m.from || m.fromEmail)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-body font-semibold text-neutral-900 dark:text-white truncate max-w-full">{m.from || m.fromEmail}</p>
                  <p className="text-caption text-neutral-500 dark:text-neutral-400 truncate max-w-full">&lt;{m.fromEmail}&gt;</p>
                </div>
                <p className="text-micro text-neutral-500 dark:text-neutral-400 mt-0.5">
                  <time dateTime={m.date} title={formatFullDate(m.date)}>{formatFullDate(m.date)}</time>
                </p>
                <button
                  type="button"
                  onClick={() => setVerDestinatarios(v => !v)}
                  aria-expanded={verDestinatarios}
                  className="mt-1 inline-flex items-center gap-1 min-h-[28px] text-caption text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent max-w-full"
                >
                  <span className="truncate">Para: {m.to.slice(0, 2).join(', ')}{m.to.length > 2 ? ` +${m.to.length - 2}` : ''}</span>
                  {verDestinatarios ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
                {verDestinatarios && (
                  <dl className="mt-1 space-y-0.5 text-caption text-neutral-600 dark:text-neutral-300 break-words">
                    <div><dt className="inline font-semibold">Para: </dt><dd className="inline">{m.to.join(', ')}</dd></div>
                    {m.cc.length > 0 && <div><dt className="inline font-semibold">CC: </dt><dd className="inline">{m.cc.join(', ')}</dd></div>}
                    {m.bcc.length > 0 && <div><dt className="inline font-semibold">CCO: </dt><dd className="inline">{m.bcc.join(', ')}</dd></div>}
                  </dl>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-soft">
              {id === undefined ? (
                <p className="text-caption text-neutral-400 dark:text-neutral-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Buscando en MOVI…</p>
              ) : id === null ? (
                <p className="text-caption text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                  <UserRound className="w-4 h-4 flex-shrink-0" aria-hidden /> Este correo no corresponde a nadie registrado en MOVI.
                </p>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-[var(--radius-sm)] bg-accent-soft dark:bg-accent/20 text-accent-ink flex items-center justify-center flex-shrink-0">
                    {id.tipo === 'usuario' ? <UserRound className="w-[18px] h-[18px]" aria-hidden /> : <Building2 className="w-[18px] h-[18px]" aria-hidden />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-neutral-900 dark:text-white truncate">{id.nombre}</p>
                    <p className="text-caption text-neutral-500 dark:text-neutral-400 truncate">
                      {[
                        id.tipo === 'usuario' ? (id.rol === 'Agente' ? 'Agente / vendedor' : id.rol) : id.tipo === 'crm' ? 'Contacto del CRM' : 'Mis contactos',
                        id.puesto,
                        id.empresa,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {id.enlace && (
                    <Link to={id.enlace} className={cn(btnTexto, 'text-accent-ink hover:bg-accent-softer dark:hover:bg-accent/10 flex-shrink-0')}>
                      Ver ficha <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Hilo */}
          {hilo && hilo.length > 0 && (
            <section className="rounded-[var(--radius-lg)] bg-surface-card border border-soft">
              <button
                type="button"
                onClick={() => setVerHilo(v => !v)}
                aria-expanded={verHilo}
                className="w-full min-h-[48px] flex items-center gap-2 px-4 text-left text-body-sm font-semibold text-neutral-700 dark:text-neutral-200 rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <MessagesSquare className="w-4 h-4 text-accent-ink" aria-hidden />
                {hilo.length} correo{hilo.length !== 1 ? 's' : ''} más en esta conversación
                {verHilo ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
              </button>
              {verHilo && (
                <ol className="border-t border-soft divide-y divide-[color:var(--border-soft)]">
                  {hilo.map(h => (
                    <li key={`${h.folder}:${h.uid}`}>
                      <button
                        type="button"
                        onClick={() => p.onAbrirDelHilo(h)}
                        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                      >
                        <span aria-hidden className={cn('w-8 h-8 rounded-full flex items-center justify-center text-micro font-bold flex-shrink-0', tonoAvatar(h.fromEmail))}>{getInitials(h.from || h.fromEmail)}</span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-baseline gap-2">
                            <span className="text-caption font-semibold text-neutral-800 dark:text-neutral-100 truncate">{h.from || h.fromEmail}</span>
                            {h.folder && <span className="text-[10.5px] px-1.5 rounded-full bg-surface-muted text-neutral-500 dark:text-neutral-400 flex-shrink-0">{etiquetaCarpeta({ path: h.folder, flags: p.carpetas.find(c => c.path === h.folder)?.flags || [] })}</span>}
                            <span className="ml-auto text-micro text-neutral-500 dark:text-neutral-400 flex-shrink-0">{fechaRelativa(h.date)}</span>
                          </span>
                          <span className="block text-caption text-neutral-500 dark:text-neutral-400 truncate">{h.snippet || h.subject}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {/* Adjuntos */}
          {m.attachments.length > 0 && (
            <section aria-label="Adjuntos">
              <p className="movi-eyebrow text-neutral-500 dark:text-neutral-400 mb-2">
                {m.attachments.length} adjunto{m.attachments.length !== 1 ? 's' : ''}
              </p>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
                {m.attachments.map(att => {
                  const Icon = iconoArchivo(att.contentType, att.filename);
                  const ocupado = descargando === att.partId;
                  return (
                    <li key={att.partId} className="flex items-center gap-3 p-2.5 rounded-[var(--radius-md)] bg-surface-card border border-soft min-w-0">
                      <span className="w-10 h-10 rounded-[var(--radius-sm)] bg-accent-soft dark:bg-accent/20 text-accent-ink flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5" aria-hidden />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-caption font-semibold text-neutral-800 dark:text-neutral-100 truncate" title={att.filename}>{att.filename}</span>
                        <span className="block text-micro text-neutral-500 dark:text-neutral-400">{formatSize(att.size)}</span>
                      </span>
                      {previsualizable(att.contentType, att.filename) && (
                        <button type="button" onClick={() => bajarAdjunto(att, 'ver')} disabled={ocupado} aria-label={`Vista previa de ${att.filename}`} title="Vista previa" className={btnIcono}>
                          <Eye className="w-[18px] h-[18px]" />
                        </button>
                      )}
                      <button type="button" onClick={() => bajarAdjunto(att, 'descargar')} disabled={ocupado} aria-label={`Descargar ${att.filename}`} title="Descargar" className={btnIcono}>
                        {ocupado ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Download className="w-[18px] h-[18px]" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {errorAdjunto && <p role="alert" className="mt-2 text-caption text-red-600 dark:text-red-400">{errorAdjunto}</p>}
            </section>
          )}

          {/* Imágenes externas */}
          {hayImagenes && !permitirImagenes && !cuerpoGrande && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-[var(--radius-md)] bg-surface-card border border-soft">
              <ImageOff className="w-4 h-4 text-neutral-500 flex-shrink-0" aria-hidden />
              <p className="text-caption text-neutral-600 dark:text-neutral-300 flex-1 min-w-[12rem]">
                Se bloquearon las imágenes externas para proteger tu privacidad.
              </p>
              <button type="button" onClick={() => setPermitirImagenes(true)} className={cn(btnTexto, 'min-h-[36px] text-accent-ink hover:bg-accent-softer dark:hover:bg-accent/10')}>Mostrar imágenes</button>
              {sospecha.length === 0 && (
                <button type="button" onClick={confiarSiempre} className={cn(btnTexto, 'min-h-[36px] text-neutral-600 dark:text-neutral-300 hover:bg-surface-muted')}>Siempre de este remitente</button>
              )}
            </div>
          )}

          {/* Cuerpo */}
          <div className="rounded-[var(--radius-lg)] border border-soft overflow-hidden bg-white dark:bg-surface-card shadow-e1">
            {cuerpoGrande ? (
              <div className="p-6 text-center">
                <MailOpen className="w-8 h-8 mx-auto mb-2 text-neutral-400" aria-hidden />
                <p className="text-body-sm text-neutral-700 dark:text-neutral-200 mb-1">Este correo es muy grande y puede tardar en mostrarse.</p>
                <p className="text-caption text-neutral-500 dark:text-neutral-400 mb-3">{formatSize(m.bodyHtml!.length)} de contenido</p>
                <button type="button" onClick={() => setRenderGrande(true)} className={cn(btnTexto, 'bg-accent text-accent-foreground hover:bg-accent-hover')}>Mostrar de todos modos</button>
              </div>
            ) : m.bodyHtml ? (
              <iframe ref={iframeRef} className="w-full min-h-[300px] border-0 bg-white block" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" title="Contenido del correo" />
            ) : m.bodyText ? (
              <pre className="p-4 sm:p-5 whitespace-pre-wrap break-words text-body text-neutral-800 dark:text-neutral-100 font-sans leading-relaxed">{m.bodyText}</pre>
            ) : (
              <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">
                <MailOpen className="w-8 h-8 mx-auto mb-2 opacity-60" aria-hidden />
                <p className="text-body-sm">Este mensaje no tiene contenido visible.</p>
              </div>
            )}
          </div>

          {/* Responder (a la mano en celular) */}
          <div className="flex flex-wrap gap-2 pt-1 pb-[env(safe-area-inset-bottom)]">
            <button type="button" onClick={p.onResponder} className={cn(btnTexto, 'bg-accent text-accent-foreground hover:bg-accent-hover')}><Reply className="w-4 h-4" aria-hidden /> Responder</button>
            <button type="button" onClick={p.onResponderTodos} className={cn(btnTexto, 'border border-strong text-neutral-700 dark:text-neutral-200 hover:bg-surface-muted')}><ReplyAll className="w-4 h-4" aria-hidden /> A todos</button>
            <button type="button" onClick={p.onReenviar} className={cn(btnTexto, 'border border-strong text-neutral-700 dark:text-neutral-200 hover:bg-surface-muted')}><Forward className="w-4 h-4" aria-hidden /> Reenviar</button>
          </div>
        </article>
      </div>

      {vistaPrevia && (
        <div className="fixed inset-0 z-[70] bg-neutral-950/80 backdrop-blur-sm flex flex-col animate-overlay" role="dialog" aria-modal="true" aria-label={`Vista previa de ${vistaPrevia.nombre}`} onClick={cerrarVista}>
          <div className="flex items-center gap-2 px-3 py-2 text-white pt-[max(0.5rem,env(safe-area-inset-top))]" onClick={e => e.stopPropagation()}>
            <p className="flex-1 min-w-0 truncate text-body-sm font-semibold">{vistaPrevia.nombre}</p>
            <a href={vistaPrevia.url} download={vistaPrevia.nombre} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Descargar"><Download className="w-5 h-5" /></a>
            <button type="button" onClick={cerrarVista} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Cerrar vista previa"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
            {/pdf/i.test(vistaPrevia.tipo) || /\.pdf$/i.test(vistaPrevia.nombre)
              ? <iframe src={vistaPrevia.url} title={vistaPrevia.nombre} className="w-full h-full max-w-4xl rounded-[var(--radius-md)] bg-white" />
              : <img src={vistaPrevia.url} alt={vistaPrevia.nombre} className="max-w-full max-h-full object-contain rounded-[var(--radius-md)]" />}
          </div>
        </div>
      )}
    </div>
  );
}
