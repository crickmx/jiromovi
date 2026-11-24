import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Minus, Maximize2, Minimize2, Paperclip, Send, Loader2, FileText, CircleAlert, Save, LayoutTemplate, Trash2, Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cnSistema as cn } from '@/lib/utils';
import { getRenderedSignature, stripExistingSignature } from '@/lib/emailSignatureUtils';
import { RecipientsInput } from '../RecipientsInput';
import { RichTextEditor } from '../RichTextEditor';
import { useEmailContacts } from '../useEmailContacts';
import {
  type EmailFull, callWebmail, formatSize, fileToBase64, escapeHtml, MAX_FILE_SIZE, MAX_TOTAL_SIZE,
} from './tipos';
import { leerBorrador, leerAdjuntos, guardarBorrador, borrarBorrador, base64AFile, type AdjuntoBorrador } from './borrador';

export type ModoRedactar = 'new' | 'reply' | 'replyAll' | 'forward';

interface Props {
  mode: ModoRedactar;
  replyTo: EmailFull | null;
  initialTo?: string;
  onClose: () => void;
  onSent: () => void;
  usuarioId?: string;
  configEmail?: string;
  esAdmin?: boolean;
}

interface Adjunto { file: File; base64: string }
interface Plantilla { id: string; nombre: string; asunto: string | null; cuerpo: string; propia: boolean }

const campo = 'w-full h-10 px-3 rounded-[var(--radius-sm)] border border-soft bg-surface-card text-body-sm text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25';
const btnIcono = 'w-10 h-10 flex items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400 hover:bg-surface-muted hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent flex-shrink-0';

export function VentanaRedactar({ mode, replyTo, initialTo, onClose, onSent, usuarioId, configEmail: senderEmail }: Props) {
  const [to, setTo] = useState<string[]>(initialTo ? [initialTo] : []);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [signatureHtml, setSignatureHtml] = useState('');
  const [signatureLoading, setSignatureLoading] = useState(true);
  const [attachments, setAttachments] = useState<Adjunto[]>([]);
  const [attachError, setAttachError] = useState('');
  const [draftMsg, setDraftMsg] = useState('');
  const [minimizada, setMinimizada] = useState(false);
  const [maximizada, setMaximizada] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [verPlantillas, setVerPlantillas] = useState(false);
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { contacts } = useEmailContacts();

  // Hilo: al responder se cita el correo original y sus referencias.
  const inReplyTo = (mode === 'reply' || mode === 'replyAll') ? replyTo?.messageId || undefined : undefined;
  const references = inReplyTo ? [replyTo?.references, inReplyTo].filter(Boolean).join(' ').trim() : undefined;

  // Mismo nombre de borrador que antes para correos nuevos; respuestas y
  // reenvíos tienen el suyo, ligado al correo original.
  const baseKey = `movi_email_draft_${senderEmail || 'default'}`;
  const draftKey = mode === 'new' ? baseKey : `${baseKey}:${mode}:${replyTo?.messageId || replyTo?.uid || ''}`;
  const draftReady = useRef(false);
  const enviado = useRef(false);

  // Prellenado por modo (igual que antes)
  useEffect(() => {
    if (!replyTo) return;
    if (mode === 'reply') {
      setTo([replyTo.fromEmail].filter(Boolean));
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
    } else if (mode === 'replyAll') {
      setTo([replyTo.fromEmail].filter(Boolean));
      const others = [...replyTo.to, ...replyTo.cc]
        .filter(Boolean)
        .filter(e => e !== senderEmail && !e.includes(senderEmail || '__none__'));
      if (others.length > 0) { setCc(others); setShowCc(true); }
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
    } else if (mode === 'forward') {
      setSubject(replyTo.subject.startsWith('Fwd:') ? replyTo.subject : `Fwd: ${replyTo.subject}`);
      const quotedHtml = replyTo.bodyHtml || (replyTo.bodyText ? replyTo.bodyText.replace(/\n/g, '<br/>') : '');
      setBodyHtml(
        `<br/><br/><div>---------- Mensaje reenviado ----------</div>` +
        `<div>De: ${escapeHtml(replyTo.from)} &lt;${escapeHtml(replyTo.fromEmail)}&gt;</div>` +
        `<div>Fecha: ${escapeHtml(replyTo.date)}</div>` +
        `<div>Asunto: ${escapeHtml(replyTo.subject)}</div><br/>${quotedHtml}`
      );
    }
  }, [mode, replyTo, senderEmail]);

  // Firma asignada (la misma de siempre)
  useEffect(() => {
    if (!usuarioId) { setSignatureLoading(false); return; }
    setSignatureLoading(true);
    getRenderedSignature(usuarioId).then(sig => {
      if (sig) setSignatureHtml(sig);
      setSignatureLoading(false);
    }).catch(() => setSignatureLoading(false));
  }, [usuarioId]);

  // Restaurar borrador (texto + adjuntos)
  useEffect(() => {
    let vivo = true;
    (async () => {
      const d = leerBorrador(draftKey);
      if (d && vivo) {
        if ((!initialTo || mode !== 'new') && Array.isArray(d.to) && d.to.length) setTo(d.to);
        if (Array.isArray(d.cc) && d.cc.length) { setCc(d.cc); setShowCc(true); }
        if (Array.isArray(d.bcc) && d.bcc.length) { setBcc(d.bcc); setShowBcc(true); }
        if (typeof d.subject === 'string' && d.subject) setSubject(d.subject);
        if (typeof d.bodyHtml === 'string' && d.bodyHtml) setBodyHtml(d.bodyHtml);
      }
      const adj = await leerAdjuntos(draftKey);
      if (vivo && adj.length) setAttachments(adj.map(a => ({ file: base64AFile(a), base64: a.base64 })));
      draftReady.current = true;
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estaVacio = useCallback(() => {
    const text = bodyHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, '').trim();
    return to.length === 0 && cc.length === 0 && bcc.length === 0 && !subject.trim() && !text && !/<img/i.test(bodyHtml) && attachments.length === 0;
  }, [to, cc, bcc, subject, bodyHtml, attachments]);

  const persistir = useCallback(async (manual: boolean) => {
    if (!draftReady.current || enviado.current) return;
    if (estaVacio()) { await borrarBorrador(draftKey); return; }
    const adj: AdjuntoBorrador[] = attachments.map(a => ({ name: a.file.name, type: a.file.type, size: a.file.size, base64: a.base64 }));
    const ok = await guardarBorrador(draftKey, { to, cc, bcc, subject, bodyHtml, inReplyTo, references, savedAt: Date.now() }, adj);
    if (manual || !ok) {
      setDraftMsg(ok ? 'Borrador guardado' : 'No se pudo guardar todo el borrador en este navegador');
      setTimeout(() => setDraftMsg(''), 2500);
    }
  }, [attachments, to, cc, bcc, subject, bodyHtml, inReplyTo, references, draftKey, estaVacio]);

  // Autoguardado (texto, destinatarios, CCO, hilo y adjuntos)
  useEffect(() => {
    if (!draftReady.current) return;
    const t = setTimeout(() => { void persistir(false); }, 800);
    return () => clearTimeout(t);
  }, [persistir]);

  // Plantillas: corporativas (email_templates) + propias
  const cargarPlantillas = async () => {
    const [corp, propias] = await Promise.all([
      supabase.from('email_templates').select('id, nombre, asunto, cuerpo').eq('activo', true).order('nombre'),
      supabase.from('correo_plantillas_respuesta').select('id, nombre, asunto, cuerpo_html').order('nombre'),
    ]);
    setPlantillas([
      ...((propias.data || []) as { id: string; nombre: string; asunto: string | null; cuerpo_html: string }[]).map(p => ({ id: p.id, nombre: p.nombre, asunto: p.asunto, cuerpo: p.cuerpo_html, propia: true })),
      ...((corp.data || []) as { id: string; nombre: string; asunto: string | null; cuerpo: string }[]).map(p => ({ id: p.id, nombre: p.nombre, asunto: p.asunto, cuerpo: p.cuerpo, propia: false })),
    ]);
  };
  const usarPlantilla = (p: Plantilla) => {
    if (p.asunto && !subject.trim()) setSubject(p.asunto);
    const cuerpo = /<[a-z][\s\S]*>/i.test(p.cuerpo) ? p.cuerpo : `<p>${escapeHtml(p.cuerpo).replace(/\n/g, '<br/>')}</p>`;
    setBodyHtml(prev => (prev.replace(/<[^>]*>|&nbsp;/g, '').trim() ? `${cuerpo}${prev}` : cuerpo));
    setVerPlantillas(false);
  };
  const guardarComoPlantilla = async () => {
    const nombre = window.prompt('Nombre de la plantilla:', subject || 'Mi plantilla');
    if (!nombre?.trim()) return;
    const { error: e } = await supabase.from('correo_plantillas_respuesta').insert({ nombre: nombre.trim(), asunto: subject || null, cuerpo_html: bodyHtml });
    if (e) { setError(`No se guardó la plantilla: ${e.message}`); return; }
    setDraftMsg('Plantilla guardada');
    setTimeout(() => setDraftMsg(''), 2500);
    setPlantillas(null);
  };
  const borrarPlantilla = async (p: Plantilla) => {
    if (!window.confirm(`¿Eliminar la plantilla «${p.nombre}»?`)) return;
    const { error: e } = await supabase.from('correo_plantillas_respuesta').delete().eq('id', p.id);
    if (e) { setError(e.message); return; }
    setPlantillas(ps => (ps || []).filter(x => x.id !== p.id));
  };

  // Adjuntos (por botón o arrastrando)
  const totalAttachmentSize = attachments.reduce((sum, a) => sum + a.file.size, 0);
  const agregarArchivos = async (files: File[]) => {
    if (files.length === 0) return;
    setAttachError('');
    const nuevos: Adjunto[] = [];
    let total = totalAttachmentSize;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) { setAttachError(`"${file.name}" excede el límite de ${formatSize(MAX_FILE_SIZE)} por archivo.`); continue; }
      total += file.size;
      if (total > MAX_TOTAL_SIZE) { setAttachError(`El total de adjuntos excede ${formatSize(MAX_TOTAL_SIZE)}.`); break; }
      nuevos.push({ file, base64: await fileToBase64(file) });
    }
    if (nuevos.length) setAttachments(prev => [...prev, ...nuevos]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (to.length === 0 || !subject.trim()) { setError('Destinatario y asunto son requeridos'); return; }
    setSending(true);
    setError('');
    try {
      let finalBody = bodyHtml || '';
      if (signatureHtml) {
        finalBody = stripExistingSignature(finalBody);
        finalBody = `${finalBody}\n<br/>\n${signatureHtml}`;
      }
      const htmlContent = finalBody.includes('<') ? finalBody : `<p>${finalBody.replace(/\n/g, '<br/>')}</p>`;
      const payload: Record<string, unknown> = {
        to, cc, bcc, subject,
        bodyHtml: htmlContent,
        bodyText: finalBody.replace(/<[^>]*>/g, ''),
      };
      if (inReplyTo) { payload.inReplyTo = inReplyTo; payload.references = references; }
      if (attachments.length > 0) {
        payload.attachments = attachments.map(a => ({ filename: a.file.name, contentType: a.file.type || 'application/octet-stream', content: a.base64 }));
      }
      await callWebmail('send-message', payload);
      enviado.current = true;
      await borrarBorrador(draftKey);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  };

  const descartar = async () => {
    if (!estaVacio() && !window.confirm('¿Descartar este borrador?')) return;
    enviado.current = true;
    await borrarBorrador(draftKey);
    onClose();
  };
  const cerrar = async () => { await persistir(false); onClose(); };

  // Atajos: Ctrl/Cmd+Enter envía, Escape minimiza
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void handleSend(); }
    if (e.key === 'Escape' && !verPlantillas) { e.stopPropagation(); setMinimizada(true); }
  };

  const titulo = mode === 'new' ? 'Nuevo correo' : mode === 'forward' ? 'Reenviar' : 'Responder';

  if (minimizada) {
    return (
      <div className="fixed z-50 right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-4 w-[min(20rem,calc(100vw-2rem))] animate-rise">
        <button
          type="button"
          onClick={() => setMinimizada(false)}
          className="w-full min-h-[48px] flex items-center gap-2 px-4 rounded-[var(--radius-md)] bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-e4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Abrir borrador: ${subject || titulo}`}
        >
          <Maximize2 className="w-4 h-4 flex-shrink-0" aria-hidden />
          <span className="flex-1 truncate text-body-sm font-semibold">{subject || titulo}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed z-50 flex',
        maximizada
          ? 'inset-0 sm:inset-6 items-stretch justify-center sm:bg-neutral-950/40 sm:backdrop-blur-sm'
          : 'inset-0 sm:inset-auto sm:right-6 sm:bottom-6',
      )}
    >
      <section
        role="dialog"
        aria-modal="false"
        aria-label={titulo}
        onKeyDown={onKeyDown}
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setArrastrando(true); } }}
        onDragLeave={e => { if (e.currentTarget === e.target) setArrastrando(false); }}
        onDrop={e => { e.preventDefault(); setArrastrando(false); void agregarArchivos(Array.from(e.dataTransfer.files || [])); }}
        className={cn(
          'relative flex flex-col bg-surface-card shadow-e4 border border-soft w-full animate-scale-in',
          'h-[100dvh] sm:h-auto rounded-none sm:rounded-[var(--radius-lg)]',
          maximizada ? 'sm:max-w-5xl sm:h-full' : 'sm:w-[600px] sm:max-h-[min(720px,calc(100vh-3rem))]',
          'pt-[env(safe-area-inset-top)] sm:pt-0',
        )}
      >
        {/* Encabezado */}
        <header className="flex items-center gap-1 pl-4 pr-1 py-1 border-b border-soft flex-shrink-0">
          <h2 className="flex-1 min-w-0 truncate font-display text-body font-semibold text-neutral-900 dark:text-white">{titulo}</h2>
          <button type="button" onClick={() => setMinimizada(true)} aria-label="Minimizar" title="Minimizar" className={cn(btnIcono, 'max-sm:hidden')}><Minus className="w-5 h-5" /></button>
          <button type="button" onClick={() => setMaximizada(v => !v)} aria-label={maximizada ? 'Restaurar tamaño' : 'Maximizar'} className={cn(btnIcono, 'max-sm:hidden')}>
            {maximizada ? <Minimize2 className="w-[18px] h-[18px]" /> : <Maximize2 className="w-[18px] h-[18px]" />}
          </button>
          <button type="button" onClick={cerrar} aria-label="Cerrar (se guarda el borrador)" title="Cerrar" className={btnIcono}><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-2.5">
          {error && (
            <div role="alert" className="p-2.5 rounded-[var(--radius-sm)] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-caption text-red-700 dark:text-red-300 flex items-center gap-2">
              <CircleAlert className="w-4 h-4 flex-shrink-0" aria-hidden /> {error}
            </div>
          )}

          <RecipientsInput label="Para" value={to} onChange={setTo} contacts={contacts} autoFocus={mode === 'new' && !initialTo} />
          {(!showCc || !showBcc) && (
            <div className="flex justify-end gap-1 -mt-1">
              {!showCc && <button type="button" onClick={() => setShowCc(true)} className="min-h-[32px] px-2 text-caption font-semibold text-accent-ink hover:bg-accent-softer dark:hover:bg-accent/10 rounded-[var(--radius-xs)]">+ CC</button>}
              {!showBcc && <button type="button" onClick={() => setShowBcc(true)} className="min-h-[32px] px-2 text-caption font-semibold text-accent-ink hover:bg-accent-softer dark:hover:bg-accent/10 rounded-[var(--radius-xs)]">+ CCO</button>}
            </div>
          )}
          {showCc && <RecipientsInput label="CC" value={cc} onChange={setCc} contacts={contacts} />}
          {showBcc && <RecipientsInput label="CCO" value={bcc} onChange={setBcc} contacts={contacts} />}

          <label className="block">
            <span className="sr-only">Asunto</span>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto" className={campo} />
          </label>

          <RichTextEditor value={bodyHtml} onChange={setBodyHtml} onError={setAttachError} placeholder="Escribe tu mensaje…" />

          {attachments.length > 0 && (
            <ul aria-label="Adjuntos" className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2">
              {attachments.map((att, i) => (
                <li key={`${att.file.name}-${i}`} className="flex items-center gap-2 p-2 rounded-[var(--radius-sm)] bg-surface-muted min-w-0">
                  <FileText className="w-4 h-4 text-accent-ink flex-shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-caption font-semibold text-neutral-800 dark:text-neutral-100">{att.file.name}</span>
                    <span className="block text-micro text-neutral-500 dark:text-neutral-400">{formatSize(att.file.size)}</span>
                  </span>
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} aria-label={`Quitar ${att.file.name}`} className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-500 hover:text-red-600 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {attachError && (
            <p role="alert" className="text-caption text-amber-700 dark:text-amber-300 flex items-center gap-2"><CircleAlert className="w-4 h-4 flex-shrink-0" aria-hidden /> {attachError}</p>
          )}

          {signatureLoading ? (
            <div className="border-t border-dashed border-soft pt-2"><div className="h-12 bg-surface-muted rounded animate-pulse" /></div>
          ) : signatureHtml ? (
            <div className="border-t border-dashed border-soft pt-2">
              <p className="text-micro text-neutral-500 dark:text-neutral-400 mb-1">Firma (se agrega al enviar)</p>
              <div className="text-[11px] text-neutral-600 dark:text-neutral-300 overflow-hidden max-h-24 rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: signatureHtml }} />
            </div>
          ) : null}
        </div>

        {/* Pie */}
        <footer className="flex items-center gap-1 px-3 py-2.5 border-t border-soft flex-shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            aria-keyshortcuts="Control+Enter"
            className="min-h-[44px] inline-flex items-center gap-2 px-5 rounded-full bg-accent text-accent-foreground font-display font-semibold text-body-sm hover:bg-accent-hover disabled:opacity-60 shadow-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => void agregarArchivos(Array.from(e.target.files || []))} />
          <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Adjuntar archivo" title="Adjuntar (o arrastra archivos)" className={btnIcono}><Paperclip className="w-5 h-5" /></button>
          <div className="relative">
            <button
              type="button"
              onClick={() => { setVerPlantillas(v => !v); if (!plantillas) void cargarPlantillas(); }}
              aria-label="Plantillas"
              aria-expanded={verPlantillas}
              title="Plantillas"
              className={cn(btnIcono, verPlantillas && 'bg-accent-softer dark:bg-accent/10 text-accent-ink')}
            >
              <LayoutTemplate className="w-5 h-5" />
            </button>
            {verPlantillas && (
              <div className="absolute bottom-full left-0 mb-2 w-[min(18rem,calc(100vw-2rem))] max-h-80 overflow-y-auto rounded-[var(--radius-md)] bg-surface-card border border-soft shadow-e3 p-1 z-10 animate-scale-in">
                {plantillas === null ? (
                  <p className="p-3 text-caption text-neutral-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Cargando…</p>
                ) : plantillas.length === 0 ? (
                  <p className="p-3 text-caption text-neutral-500 dark:text-neutral-400">Aún no tienes plantillas.</p>
                ) : (
                  <ul>
                    {plantillas.map(pl => (
                      <li key={`${pl.propia}-${pl.id}`} className="flex items-center gap-1">
                        <button type="button" onClick={() => usarPlantilla(pl)} className="flex-1 min-w-0 min-h-[40px] text-left px-3 rounded-[var(--radius-xs)] hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                          <span className="block truncate text-body-sm font-medium text-neutral-800 dark:text-neutral-100">{pl.nombre}</span>
                          <span className="block text-micro text-neutral-500 dark:text-neutral-400">{pl.propia ? 'Mía' : 'De la empresa'}</span>
                        </button>
                        {pl.propia && (
                          <button type="button" onClick={() => borrarPlantilla(pl)} aria-label={`Eliminar plantilla ${pl.nombre}`} className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-600 hover:bg-surface-muted"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={guardarComoPlantilla} className="w-full mt-1 min-h-[40px] flex items-center gap-2 px-3 rounded-[var(--radius-xs)] border-t border-soft text-caption font-semibold text-accent-ink hover:bg-accent-softer dark:hover:bg-accent/10">
                  <Save className="w-4 h-4" aria-hidden /> Guardar este correo como plantilla
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => void persistir(true)} aria-label="Guardar borrador" title="Guardar borrador" className={btnIcono}><Save className="w-5 h-5" /></button>
          <span className="flex-1 min-w-0 truncate text-micro text-neutral-500 dark:text-neutral-400 px-1" aria-live="polite">
            {draftMsg || (totalAttachmentSize > 0 ? `${attachments.length} adjunto${attachments.length !== 1 ? 's' : ''} · ${formatSize(totalAttachmentSize)}` : '')}
          </span>
          <button type="button" onClick={descartar} aria-label="Descartar borrador" title="Descartar" className={cn(btnIcono, 'hover:text-red-600 dark:hover:text-red-400')}><Trash2 className="w-5 h-5" /></button>
        </footer>

        {arrastrando && (
          <div aria-hidden className="absolute inset-0 rounded-[inherit] bg-accent/10 border-2 border-dashed border-accent flex flex-col items-center justify-center gap-2 text-accent-ink pointer-events-none">
            <Upload className="w-8 h-8" />
            <p className="font-semibold text-body">Suelta aquí para adjuntar</p>
          </div>
        )}
      </section>
    </div>
  );
}
