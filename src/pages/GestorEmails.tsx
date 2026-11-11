import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Mail, CircleAlert as AlertCircle, RefreshCw, Settings, EyeOff, ArrowLeft, Menu, X, ContactRound } from 'lucide-react';
import { cnSistema as cn } from '@/lib/utils';
import { IniciarTramiteEmailModal } from '@/components/email/IniciarTramiteEmailModal';
import { AgregarAEmailTramiteModal } from '@/components/email/AgregarAEmailTramiteModal';
import { getRoundcubeHandoffUrl } from '../lib/roundcubeSso';
import { ContactosMovi } from '../components/email/ContactosMovi';
import { normalizarCorreo } from '@/lib/correo/identidadRemitente';
import { planearReglas, type ReglaCorreo } from '@/lib/correo/reglasCorreo';
import {
  type ImapFolder, type EmailHeader, type EmailFull,
  callWebmail, carpetaPorRol, etiquetaCarpeta, rolCarpeta, normalizarCarpetas,
} from '@/components/email/gestor/tipos';
import { AvisosProvider, useAvisos } from '@/components/email/gestor/avisos';
import { PanelCarpetas, type Cuota } from '@/components/email/gestor/PanelCarpetas';
import { InicioCorreo } from '@/components/email/gestor/InicioCorreo';
import { ListaCorreos } from '@/components/email/gestor/ListaCorreos';
import { LecturaCorreo } from '@/components/email/gestor/LecturaCorreo';
import { VentanaRedactar, type ModoRedactar } from '@/components/email/gestor/VentanaRedactar';
import { ReglasCorreo } from '@/components/email/gestor/ReglasCorreo';
import { useIdentidades, useTramitesLigados } from '@/components/email/gestor/useIdentidades';
import type { AccionCorreo } from '@/components/email/gestor/MenuCorreo';

// Traduce los códigos de error del SSO de Roundcube a un mensaje claro en
// español (el edge function responde con códigos crudos tipo "RATE_LIMITED").
function friendlyRoundcubeError(code?: string): string {
  switch (code) {
    case 'RATE_LIMITED':
      return 'Abriste el correo demasiadas veces seguidas. Reintentando en unos segundos...';
    case 'MAILBOX_NOT_CONFIGURED':
      return 'Tu correo aún no está configurado.';
    case 'MAILBOX_CREDENTIAL_MISSING':
      return 'No encontramos la contraseña de tu correo. Vuelve a configurarlo.';
    case 'NO_SESSION':
    case 'UNAUTHORIZED':
    case 'INVALID_SESSION':
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    default:
      return code || 'No se pudo abrir el correo.';
  }
}

const PER_PAGE = 30;

// ── Componente ──────────────────────────────────────────────────────

export function GestorEmails() {
  return (
    <AvisosProvider>
      <GestorEmailsInterno />
    </AvisosProvider>
  );
}

interface Redaccion { mode: ModoRedactar; replyTo: EmailFull | null; initialTo?: string; key: number }
interface ColaTramite { tipo: 'crear' | 'agregar'; uids: number[]; folder: string; idx: number }

function GestorEmailsInterno() {
  const { usuario, isMasked } = useAuth();
  const { avisar, conDeshacer } = useAvisos();

  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [configEmail, setConfigEmail] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [mailView, setMailView] = useState<'roundcube' | 'legacy'>('legacy');
  const [roundcubeUrl, setRoundcubeUrl] = useState('');
  const [roundcubeLoading, setRoundcubeLoading] = useState(false);

  const [folders, setFolders] = useState<ImapFolder[]>([]);
  const [vista, setVista] = useState<'inicio' | 'carpeta'>('inicio');
  const [currentFolder, setCurrentFolder] = useState('INBOX');

  const [messages, setMessages] = useState<EmailHeader[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [inboxRecientes, setInboxRecientes] = useState<EmailHeader[]>([]);

  const [selectedMessage, setSelectedMessage] = useState<EmailFull | null>(null);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [loadingMessage, setLoadingMessage] = useState(false);

  const [redaccion, setRedaccion] = useState<Redaccion | null>(null);

  const [consulta, setConsulta] = useState('');
  const [searchResults, setSearchResults] = useState<EmailHeader[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [error, setError] = useState('');
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [openingRoundcube, setOpeningRoundcube] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [carpetasMovil, setCarpetasMovil] = useState(false);
  const [showReglas, setShowReglas] = useState(false);
  const [cuota, setCuota] = useState<Cuota | null>(null);
  const [ocultos, setOcultos] = useState<Set<number>>(new Set());

  // Trámite desde correo (uno o varios en cola)
  const [tramiteEmail, setTramiteEmail] = useState<{ email: EmailFull; folder: string } | null>(null);
  const [showTramiteModal, setShowTramiteModal] = useState(false);
  const [showAddTramiteModal, setShowAddTramiteModal] = useState(false);
  const [cola, setCola] = useState<ColaTramite | null>(null);
  const [tramitesVersion, setTramitesVersion] = useState(0);

  // Control de aperturas del iframe SSO: evita quemar tokens contra el límite
  // de tasa del edge function (5+/min ⇒ RATE_LIMITED).
  const openingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRetryCountRef = useRef(0);
  const reglasAplicadas = useRef(false);

  // Solo depende del id del usuario: un refresh de token de Supabase entrega un
  // objeto `usuario` nuevo con el mismo id.
  useEffect(() => {
    checkConfig();
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  const checkConfig = async () => {
    // Con la máscara no se carga nada: el servidor de correo ve la sesión REAL
    // del admin y abriría su buzón con el nombre de la persona enmascarada.
    if (!usuario || isMasked) return;
    const { data } = await supabase
      .from('email_configuraciones')
      .select('email')
      .eq('usuario_id', usuario.id)
      .eq('activa', true)
      .maybeSingle();

    if (data) {
      setHasConfig(true);
      setConfigEmail(data.email);
      loadFolders(true);
    } else {
      setHasConfig(false);
      setShowSetup(true);
      setInitialLoading(false);
    }
  };

  const refreshFolders = useCallback(async () => {
    try { setFolders(normalizarCarpetas((await callWebmail('list-folders')) || [])); } catch { /* el contador se queda como estaba */ }
  }, []);

  const loadCuota = useCallback(async () => {
    try { setCuota(await callWebmail('quota')); } catch { setCuota({ usedBytes: null, limitBytes: null }); }
  }, []);

  const loadMessages = useCallback(async (folder: string, p: number) => {
    setLoadingMessages(true);
    setListError(null);
    try {
      const data = await callWebmail('list-messages', { folder, page: p, perPage: PER_PAGE, withSnippet: true });
      const msgs: EmailHeader[] = data.messages || [];
      setMessages(msgs);
      setTotalMessages(data.total || 0);
      setCurrentFolder(folder);
      setPage(p);
      setOcultos(new Set());
      if (folder === 'INBOX' && p === 1) setInboxRecientes(msgs.slice(0, 6));
      return msgs;
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Error al cargar');
      return null;
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Reglas del usuario: se aplican una vez al abrir el correo (decisión de Ricardo).
  const aplicarReglas = useCallback(async (inbox: EmailHeader[]) => {
    if (reglasAplicadas.current) return;
    reglasAplicadas.current = true;
    const { data, error: e } = await supabase.from('correo_reglas').select('*').eq('activa', true);
    if (e || !data?.length) return;
    const plan = planearReglas(data as ReglaCorreo[], inbox, 'INBOX');
    if (plan.length === 0) return;
    let hechas = 0;
    for (const a of plan) {
      try {
        if (a.regla.accion === 'mover') await callWebmail('move-message', { uid: a.uid, fromFolder: 'INBOX', toFolder: a.regla.carpeta_destino });
        else await callWebmail('mark-read', { uid: a.uid, folder: 'INBOX', read: true });
        hechas++;
      } catch { /* una regla que falla no detiene a las demás */ }
    }
    if (hechas > 0) {
      avisar(`Tus reglas organizaron ${hechas} correo${hechas !== 1 ? 's' : ''}.`);
      await Promise.all([loadMessages('INBOX', 1), refreshFolders()]);
    }
  }, [avisar, loadMessages, refreshFolders]);

  const loadFolders = async (primeraVez = false) => {
    try {
      const data = await callWebmail('list-folders');
      setFolders(normalizarCarpetas(data || []));
      setConnectionFailed(false);
      setInitialLoading(false);
      const inbox = await loadMessages('INBOX', 1);
      if (primeraVez) { void loadCuota(); if (inbox) void aplicarReglas(inbox); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
      setConnectionFailed(true);
      setInitialLoading(false);
    }
  };

  const abrirCarpeta = (path: string) => {
    setVista('carpeta');
    setSelectedMessage(null);
    setSearchResults(null);
    setConsulta('');
    setCarpetasMovil(false);
    void loadMessages(path, 1);
  };

  const irInicio = () => {
    setVista('inicio');
    setSelectedMessage(null);
    setSearchResults(null);
    setConsulta('');
    setCarpetasMovil(false);
    if (currentFolder !== 'INBOX' || page !== 1) void loadMessages('INBOX', 1);
  };

  const openMessage = async (m: Pick<EmailHeader, 'uid' | 'seen' | 'folder'>) => {
    const folder = m.folder || currentFolder;
    setVista('carpeta');
    setLoadingMessage(true);
    setSelectedFolder(folder);
    setSelectedMessage(prev => (prev && prev.uid === m.uid ? prev : null));
    try {
      const data = await callWebmail('get-message', { uid: m.uid, folder });
      if (!data) throw new Error('El correo ya no existe en esta carpeta.');
      setSelectedMessage(data);
      if (folder === currentFolder) setMessages(prev => prev.map(x => (x.uid === m.uid ? { ...x, seen: true } : x)));
      setSearchResults(prev => prev && prev.map(x => (x.uid === m.uid && (x.folder || currentFolder) === folder ? { ...x, seen: true } : x)));
      if (!m.seen) setFolders(fs => fs.map(f => (f.path === folder ? { ...f, unseen: Math.max(0, f.unseen - 1) } : f)));
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'No se pudo abrir el correo', 'error');
    } finally {
      setLoadingMessage(false);
    }
  };

  const handleSearch = async (q: string, enContenido: boolean) => {
    setConsulta(q);
    setSearching(true);
    setSelectedMessage(null);
    try {
      const data = await callWebmail('search', { query: q, folder: currentFolder, maxResults: 50, inBody: enContenido, withSnippet: true });
      setSearchResults(data.messages || []);
    } catch (err) {
      avisar(err instanceof Error ? err.message : 'No se pudo buscar', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleRefresh = () => {
    void refreshFolders();
    if (searchResults && consulta) void handleSearch(consulta, true);
    else void loadMessages(currentFolder, page);
  };

  // ── Acciones sobre correos ──────────────────────────────────────────

  const carpetaArchivo = carpetaPorRol(folders, 'archive');
  const puedeArchivar = !!carpetaArchivo && rolCarpeta({ path: currentFolder, flags: folders.find(f => f.path === currentFolder)?.flags || [] }) !== 'archive';

  const ocultar = (uids: number[], v: boolean) => setOcultos(s => {
    const n = new Set(s);
    uids.forEach(u => (v ? n.add(u) : n.delete(u)));
    return n;
  });

  const ejecutarSobre = async (uids: number[], fn: (uid: number) => Promise<unknown>) => {
    const r = await Promise.allSettled(uids.map(fn));
    const fallos = r.filter(x => x.status === 'rejected').length;
    if (fallos) avisar(`${fallos} de ${uids.length} no se pudieron procesar. Actualiza para ver el estado real.`, 'error');
    return uids.length - fallos;
  };

  const accion = async (a: AccionCorreo, uids: number[], folder = currentFolder) => {
    if (uids.length === 0) return;
    const n = uids.length;
    const plural = n === 1 ? 'Correo' : `${n} correos`;
    switch (a.tipo) {
      case 'crear_tramite':
      case 'agregar_tramite': {
        const tipo = a.tipo === 'crear_tramite' ? 'crear' : 'agregar';
        if (n === 1 && selectedMessage?.uid === uids[0] && selectedFolder === folder) {
          setTramiteEmail({ email: selectedMessage, folder });
          if (tipo === 'crear') setShowTramiteModal(true); else setShowAddTramiteModal(true);
        } else {
          setCola({ tipo, uids, folder, idx: 0 });
        }
        return;
      }
      case 'leido': {
        setMessages(prev => prev.map(m => (uids.includes(m.uid) ? { ...m, seen: a.valor } : m)));
        if (selectedMessage && uids.includes(selectedMessage.uid)) setSelectedMessage({ ...selectedMessage, seen: a.valor });
        await ejecutarSobre(uids, uid => callWebmail('mark-read', { uid, folder, read: a.valor }));
        void refreshFolders();
        return;
      }
      case 'mover':
      case 'archivar':
      case 'eliminar': {
        const destino = a.tipo === 'mover' ? a.destino : a.tipo === 'archivar' ? carpetaArchivo?.path : null;
        if (a.tipo !== 'eliminar' && !destino) return;
        ocultar(uids, true);
        if (selectedMessage && uids.includes(selectedMessage.uid)) setSelectedMessage(null);
        const s = n === 1 ? '' : 's';
        const etiqueta = a.tipo === 'eliminar' ? `enviado${s} a la papelera`
          : a.tipo === 'archivar' ? `archivado${s}`
          : `movido${s} a ${etiquetaCarpeta({ path: destino!, flags: folders.find(f => f.path === destino)?.flags || [] })}`;
        conDeshacer(
          `${plural} ${etiqueta}`,
          async () => {
            const ok = await ejecutarSobre(uids, uid => (a.tipo === 'eliminar'
              ? callWebmail('delete-message', { uid, folder })
              : callWebmail('move-message', { uid, fromFolder: folder, toFolder: destino })));
            if (ok > 0) {
              setMessages(prev => prev.filter(m => !uids.includes(m.uid)));
              setSearchResults(prev => prev && prev.filter(m => !uids.includes(m.uid)));
              setInboxRecientes(prev => (folder === 'INBOX' ? prev.filter(m => !uids.includes(m.uid)) : prev));
              setTotalMessages(t => Math.max(0, t - ok));
              void refreshFolders();
            }
          },
          () => ocultar(uids, false),
        );
        return;
      }
    }
  };

  // Cola de trámites en lote: un correo a la vez, con el mismo modal de siempre.
  useEffect(() => {
    if (!cola) return;
    if (cola.idx >= cola.uids.length) { setCola(null); setTramitesVersion(v => v + 1); return; }
    let vivo = true;
    (async () => {
      try {
        const email: EmailFull | null = await callWebmail('get-message', { uid: cola.uids[cola.idx], folder: cola.folder });
        if (!vivo) return;
        if (!email) { setCola(c => (c ? { ...c, idx: c.idx + 1 } : c)); return; }
        if (cola.uids.length > 1) avisar(`Correo ${cola.idx + 1} de ${cola.uids.length}: ${email.subject || '(Sin asunto)'}`);
        setTramiteEmail({ email, folder: cola.folder });
        if (cola.tipo === 'crear') setShowTramiteModal(true); else setShowAddTramiteModal(true);
      } catch (err) {
        avisar(err instanceof Error ? err.message : 'No se pudo abrir el correo', 'error');
        setCola(null);
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cola?.idx, cola?.uids.join(',')]);

  const cerrarModalTramite = () => {
    setShowTramiteModal(false);
    setShowAddTramiteModal(false);
    setTramitesVersion(v => v + 1);
    if (cola) setCola(c => (c ? { ...c, idx: c.idx + 1 } : c));
  };

  // ── Roundcube ("Vista alternativa") ────────────────────────────────

  const openRoundcubeEmbedded = async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }

    setOpeningRoundcube(true);
    setRoundcubeLoading(true);
    setError('');
    try {
      setRoundcubeUrl(await getRoundcubeHandoffUrl());
      autoRetryCountRef.current = 0;
    } catch (err: any) {
      const code: string | undefined = err?.code;
      setError(friendlyRoundcubeError(code));
      setRoundcubeLoading(false);
      if (code === 'RATE_LIMITED' && autoRetryCountRef.current < 2) {
        const delayMs = autoRetryCountRef.current === 0 ? 15000 : 30000;
        autoRetryCountRef.current += 1;
        retryTimerRef.current = setTimeout(() => { openRoundcubeEmbedded(); }, delayMs);
      }
    } finally {
      setOpeningRoundcube(false);
      openingRef.current = false;
    }
  };

  const showRoundcube = () => { setMailView('roundcube'); setCarpetasMovil(false); openRoundcubeEmbedded(); };
  const showLegacyMail = () => {
    setMailView('legacy');
    if (folders.length === 0) { setInitialLoading(true); loadFolders(); }
  };

  // ── Redactar ───────────────────────────────────────────────────────
  const redactar = (mode: ModoRedactar, replyTo: EmailFull | null = null, initialTo?: string) =>
    setRedaccion({ mode, replyTo, initialTo, key: Date.now() });
  const composeToContact = (email: string) => { setShowContacts(false); redactar('new', null, email); };

  // Atajo "c" para redactar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|textarea|select/i.test(t.tagName) && !t.isContentEditable && !redaccion) {
        e.preventDefault();
        redactar('new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redaccion]);

  // ── Datos derivados ────────────────────────────────────────────────
  const enBusqueda = searchResults !== null;
  const lista = useMemo(() => (searchResults ?? messages).filter(m => !ocultos.has(m.uid)), [searchResults, messages, ocultos]);
  const totalPages = Math.ceil(totalMessages / PER_PAGE);
  const inbox = folders.find(f => f.path === 'INBOX');
  const enviados = carpetaPorRol(folders, 'sent');

  const correosVisibles = useMemo(() => [
    ...lista.map(m => m.fromEmail),
    ...inboxRecientes.map(m => m.fromEmail),
    selectedMessage?.fromEmail || '',
  ], [lista, inboxRecientes, selectedMessage?.fromEmail]);
  const identidades = useIdentidades(correosVisibles);
  const tramites = useTramitesLigados(lista.map(m => m.messageId), tramitesVersion);

  // ── Pantallas previas ──────────────────────────────────────────────
  if (isMasked) {
    return <AvisoCorreoEnMascara nombre={usuario?.nombre_completo || usuario?.nombre || 'este usuario'} />;
  }

  if (showSetup || hasConfig === false) {
    return <SetupScreen onSuccess={() => { setShowSetup(false); checkConfig(); }} onClose={() => setShowSetup(false)} />;
  }

  if (initialLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-canvas" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-[var(--radius-md)] bg-accent-soft dark:bg-accent/20 flex items-center justify-center animate-pulse">
            <Mail className="w-6 h-6 text-accent-ink" aria-hidden />
          </div>
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400">Conectando con tu correo…</p>
        </div>
      </div>
    );
  }

  if (showContacts) {
    return <ContactosMovi onClose={() => setShowContacts(false)} onCompose={composeToContact} />;
  }

  if (mailView === 'roundcube') {
    return (
      <div className="h-full flex flex-col bg-surface-canvas overflow-hidden">
        <div className="bg-surface-card border-b border-soft px-2 sm:px-3 py-2 flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={showLegacyMail} className="min-h-[40px] flex items-center gap-2 px-3 rounded-[var(--radius-sm)] text-caption font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <ArrowLeft className="w-4 h-4" aria-hidden /> Volver al correo
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">Vista alternativa</p>
            <p className="text-micro text-neutral-500 dark:text-neutral-400 truncate">{configEmail}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowContacts(true)}
            aria-label="Contactos"
            title="Contactos"
            className="min-h-[40px] flex items-center gap-2 px-3 rounded-[var(--radius-sm)] border border-strong text-caption font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ContactRound className="w-4 h-4" aria-hidden /> <span className="max-sm:hidden">Contactos</span>
          </button>
          <button
            type="button"
            onClick={openRoundcubeEmbedded}
            disabled={roundcubeLoading || openingRoundcube}
            aria-label="Actualizar vista alternativa"
            className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-500 hover:bg-surface-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RefreshCw className={cn('w-5 h-5', (roundcubeLoading || openingRoundcube) && 'animate-spin')} />
          </button>
        </div>
        {error && (
          <div role="alert" className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/30 px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" aria-hidden />
            <span className="text-caption text-red-700 dark:text-red-300 flex-1">{error}</span>
            <button type="button" onClick={openRoundcubeEmbedded} className="text-caption font-semibold text-red-700 dark:text-red-300">Reintentar</button>
          </div>
        )}
        <div className="relative flex-1 min-h-0 bg-white dark:bg-neutral-900">
          {roundcubeLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-card/90">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 text-accent-ink animate-spin" aria-hidden />
                <p className="text-body-sm font-medium text-neutral-600 dark:text-neutral-300">Abriendo tu correo…</p>
              </div>
            </div>
          )}
          {roundcubeUrl && (
            <iframe
              key={roundcubeUrl}
              src={roundcubeUrl}
              title="Correo MOVI — vista alternativa"
              className="w-full h-full border-0 bg-white"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setRoundcubeLoading(false)}
            />
          )}
        </div>
        {redaccion && (
          <VentanaRedactar
            key={redaccion.key}
            mode={redaccion.mode}
            replyTo={redaccion.replyTo}
            initialTo={redaccion.initialTo}
            onClose={() => setRedaccion(null)}
            onSent={() => { setRedaccion(null); avisar('Correo enviado'); }}
            usuarioId={usuario?.id}
            configEmail={configEmail}
          />
        )}
      </div>
    );
  }

  if (connectionFailed) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-canvas p-4">
        <div role="alert" className="bg-surface-card border border-soft rounded-[var(--radius-lg)] shadow-e2 max-w-md w-full p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-[var(--radius-md)] bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" aria-hidden />
          </div>
          <h2 className="font-display text-title font-semibold text-neutral-900 dark:text-white mb-2">No se pudo conectar</h2>
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mb-2">No se pudo establecer conexión con el servidor de correo.</p>
          <p className="text-caption text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-[var(--radius-sm)] px-3 py-2 mb-6 break-words">{error}</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { setConnectionFailed(false); setError(''); setInitialLoading(true); loadFolders(); }}
              className="w-full min-h-[44px] border border-strong text-neutral-700 dark:text-neutral-200 rounded-[var(--radius-sm)] font-semibold hover:bg-surface-muted transition text-body-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" aria-hidden /> Reintentar
            </button>
            <button
              type="button"
              onClick={() => { setConnectionFailed(false); setError(''); setShowSetup(true); setHasConfig(false); }}
              className="w-full min-h-[44px] bg-accent text-accent-foreground rounded-[var(--radius-sm)] font-semibold hover:bg-accent-hover transition text-body-sm"
            >
              Reconfigurar correo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Módulo ─────────────────────────────────────────────────────────
  const panel = (
    <PanelCarpetas
      carpetas={folders}
      actual={vista === 'inicio' ? null : currentFolder}
      correo={configEmail}
      cuota={cuota}
      onInicio={irInicio}
      onCarpeta={abrirCarpeta}
      onRedactar={() => { setCarpetasMovil(false); redactar('new'); }}
      onContactos={() => { setCarpetasMovil(false); setShowContacts(true); }}
      onReglas={() => { setCarpetasMovil(false); setShowReglas(true); }}
      onConfiguracion={() => setShowSetup(true)}
      onVistaAlternativa={showRoundcube}
      abriendoAlternativa={openingRoundcube}
    />
  );

  const tituloCarpeta = etiquetaCarpeta({ path: currentFolder, flags: folders.find(f => f.path === currentFolder)?.flags || [] });
  const leyendo = !!selectedMessage || loadingMessage;

  return (
    <div className="relative h-full flex bg-surface-canvas overflow-hidden">
      {/* Carpetas: columna fija en escritorio */}
      <aside className="hidden md:block w-60 lg:w-64 flex-shrink-0 border-r border-soft">{panel}</aside>

      {/* Carpetas: panel deslizable en celular (dentro del módulo, no tapa el menú de MOVI) */}
      {carpetasMovil && (
        <div className="md:hidden absolute inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Carpetas">
          <div className="w-[min(18rem,85%)] h-full shadow-e4 animate-fade-in">{panel}</div>
          <button type="button" className="flex-1 bg-neutral-950/40 animate-overlay" aria-label="Cerrar carpetas" onClick={() => setCarpetasMovil(false)} />
        </div>
      )}

      {vista === 'inicio' ? (
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="md:hidden flex items-center gap-1 px-2 py-2 bg-surface-card border-b border-soft">
            <button type="button" onClick={() => setCarpetasMovil(true)} aria-label="Abrir carpetas" className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <Menu className="w-5 h-5" />
            </button>
            <p className="font-display text-body font-semibold text-neutral-900 dark:text-white">Correo</p>
          </div>
          <div className="flex-1 min-h-0">
            <InicioCorreo
              nombre={usuario?.nombre || usuario?.nombre_completo || ''}
              sinLeer={inbox?.unseen ?? 0}
              enRecibidos={inbox?.total ?? totalMessages}
              recientes={inboxRecientes}
              cargando={loadingMessages && inboxRecientes.length === 0}
              onBandeja={() => abrirCarpeta('INBOX')}
              onEnviados={enviados ? () => abrirCarpeta(enviados.path) : null}
              onRedactar={() => redactar('new')}
              onAbrir={m => { setCurrentFolder('INBOX'); void openMessage({ ...m, folder: 'INBOX' }); }}
            />
          </div>
        </main>
      ) : (
        <>
          <section
            aria-label="Lista de correos"
            className={cn(
              'flex-shrink-0 border-r border-soft min-w-0',
              'w-full lg:w-[380px] xl:w-[420px]',
              leyendo ? 'hidden lg:flex lg:flex-col' : 'flex flex-col',
              'max-md:flex-1 md:max-lg:flex-1',
            )}
          >
            <ListaCorreos
              titulo={tituloCarpeta}
              mensajes={lista}
              total={enBusqueda ? (searchResults?.length ?? 0) : totalMessages}
              page={page}
              totalPages={totalPages}
              cargando={loadingMessages}
              error={listError}
              seleccionadoUid={selectedMessage?.uid ?? null}
              carpetas={folders}
              carpetaActual={currentFolder}
              puedeArchivar={puedeArchivar}
              identidades={identidades}
              tramites={tramites}
              consulta={consulta}
              enBusqueda={enBusqueda}
              buscando={searching}
              onBuscar={handleSearch}
              onLimpiarBusqueda={() => { setSearchResults(null); setConsulta(''); }}
              onAbrir={m => void openMessage(m)}
              onAccion={(a, uids) => void accion(a, uids)}
              onPagina={p => { setSelectedMessage(null); void loadMessages(currentFolder, p); }}
              onActualizar={handleRefresh}
              onMenuCarpetas={() => setCarpetasMovil(true)}
            />
          </section>
          <main className={cn('flex-1 min-w-0', leyendo ? 'flex flex-col' : 'hidden lg:flex lg:flex-col')}>
            {leyendo && selectedMessage ? (
              <LecturaCorreo
                key={`${selectedFolder}:${selectedMessage.uid}:${tramitesVersion}`}
                mensaje={selectedMessage}
                cargando={loadingMessage}
                carpetaActual={selectedFolder}
                carpetas={folders}
                puedeArchivar={!!carpetaArchivo && rolCarpeta({ path: selectedFolder, flags: folders.find(f => f.path === selectedFolder)?.flags || [] }) !== 'archive'}
                identidad={identidades.has(normalizarCorreo(selectedMessage.fromEmail)) ? identidades.get(normalizarCorreo(selectedMessage.fromEmail)) : undefined}
                usuarioId={usuario?.id}
                onVolver={() => setSelectedMessage(null)}
                onAccion={a => void accion(a, [selectedMessage.uid], selectedFolder)}
                onResponder={() => redactar('reply', selectedMessage)}
                onResponderTodos={() => redactar('replyAll', selectedMessage)}
                onReenviar={() => redactar('forward', selectedMessage)}
                onAbrirDelHilo={h => void openMessage(h)}
              />
            ) : leyendo ? (
              <div className="flex-1 flex items-center justify-center" aria-busy="true">
                <RefreshCw className="w-6 h-6 animate-spin text-accent-ink" aria-hidden />
                <span className="sr-only">Abriendo correo…</span>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-xs">
                  <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-surface-card shadow-e1 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-7 h-7 text-accent-ink" aria-hidden />
                  </div>
                  <p className="font-display text-title-sm font-semibold text-neutral-800 dark:text-neutral-100">Selecciona un correo</p>
                  <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mt-1">Ábrelo para leerlo, responder o ligarlo a un trámite.</p>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {redaccion && (
        <VentanaRedactar
          key={redaccion.key}
          mode={redaccion.mode}
          replyTo={redaccion.replyTo}
          initialTo={redaccion.initialTo}
          onClose={() => setRedaccion(null)}
          onSent={() => { setRedaccion(null); avisar('Correo enviado'); void refreshFolders(); if (vista === 'carpeta') handleRefresh(); }}
          usuarioId={usuario?.id}
          configEmail={configEmail}
        />
      )}

      {tramiteEmail && (
        <IniciarTramiteEmailModal
          isOpen={showTramiteModal}
          onClose={cerrarModalTramite}
          email={tramiteEmail.email}
          emailAccount={configEmail}
          currentFolder={tramiteEmail.folder}
          onSuccess={(_ticketId, folio) => { avisar(`Trámite ${folio} listo`); }}
        />
      )}
      {tramiteEmail && (
        <AgregarAEmailTramiteModal
          isOpen={showAddTramiteModal}
          onClose={cerrarModalTramite}
          email={tramiteEmail.email}
          emailAccount={configEmail}
          currentFolder={tramiteEmail.folder}
        />
      )}

      <ReglasCorreo
        isOpen={showReglas}
        onClose={() => setShowReglas(false)}
        carpetas={folders}
        onCambio={() => { reglasAplicadas.current = false; }}
      />
    </div>
  );
}

// ── Setup Screen ────────────────────────────────────────────────────

interface ConfiguredAccount {
  email: string;
  nombre_remitente: string | null;
  estado_conexion: string | null;
}

// El correo vive en el edge function `ionos-webmail`, que identifica al usuario
// por el JWT del navegador. En "ver como" ese JWT sigue siendo el del admin, así
// que mostrar el buzón —o configurarlo— actuaría sobre la cuenta del admin con
// el nombre de otra persona encima. Mejor decirlo que hacerlo mal.
function AvisoCorreoEnMascara({ nombre }: { nombre: string }) {
  return (
    <div className="h-full flex items-start justify-center bg-neutral-50 dark:bg-neutral-900 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg max-w-md w-full p-8 my-auto text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
          <EyeOff className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Correo no disponible en "ver como"</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          El correo se abre con tu sesión real, no con la de {nombre}. Aquí no se puede ver ni configurar su buzón.
          Sal de la vista para usar tu correo.
        </p>
      </div>
    </div>
  );
}

function SetupScreen({ onSuccess, onClose }: { onSuccess: () => void; onClose?: () => void }) {
  const { usuario } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [accounts, setAccounts] = useState<ConfiguredAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!usuario) { setLoadingAccounts(false); return; }
    supabase
      .from('email_configuraciones')
      .select('email, nombre_remitente, estado_conexion, activa')
      .eq('usuario_id', usuario.id)
      .then(({ data }) => {
        const activas = ((data as any[]) || [])
          .filter(a => a.activa !== false)
          .map(a => ({ email: a.email, nombre_remitente: a.nombre_remitente ?? null, estado_conexion: a.estado_conexion ?? null }));
        setAccounts(activas);
        setShowForm(activas.length === 0); // sin cuentas: mostrar el form directo
        setLoadingAccounts(false);
      });
  }, [usuario?.id]);

  const hasAccounts = accounts.length > 0;

  const handleVerify = async () => {
    if (!email || !password) { setError('Ingresa correo y contrasena'); return; }
    setVerifying(true);
    setError('');
    try {
      // La contraseña viaja solo en este request al edge function, que la
      // verifica contra IONOS y la cifra server-side antes de guardarla —
      // nunca se escribe en texto plano desde el navegador.
      await callWebmail('save-config', { email, password });
      setVerified(true);
    } catch (err: any) {
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setVerifying(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 text-neutral-900 dark:text-white text-sm';

  return (
    <div className="h-full flex items-start justify-center bg-neutral-50 dark:bg-neutral-900 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg max-w-md w-full p-8 my-auto relative">
        {/* Cerrar / volver — solo si ya hay una cuenta a la que regresar */}
        {onClose && hasAccounts && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            {hasAccounts ? 'Cuentas de correo' : 'Configura tu correo'}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            {hasAccounts ? 'Cuentas conectadas a tu Correo MOVI' : 'Ingresa tus credenciales IONOS'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        {verified ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="font-semibold text-neutral-900 dark:text-white">Conexion exitosa</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Tu cuenta {email} esta lista</p>
            <button
              onClick={onSuccess}
              className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition"
            >
              Ir a mi correo
            </button>
          </div>
        ) : loadingAccounts ? (
          <div className="flex justify-center py-6">
            <RefreshCw className="w-5 h-5 animate-spin text-neutral-300" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cuentas ya conectadas */}
            {hasAccounts && (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div key={acc.email} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-700/30">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 dark:text-white truncate">{acc.email}</p>
                      {acc.nombre_remitente && <p className="text-[11px] text-neutral-400 truncate">{acc.nombre_remitente}</p>}
                    </div>
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-[10px] font-semibold text-green-700 dark:text-green-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Conectada
                    </span>
                  </div>
                ))}
              </div>
            )}

            {hasAccounts && !showForm ? (
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => { setShowForm(true); setEmail(accounts[0]?.email || ''); setPassword(''); setError(''); }}
                  className="w-full py-2.5 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition text-sm flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" /> Reconfigurar / cambiar contrasena
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition text-sm"
                  >
                    Volver a mi correo
                  </button>
                )}
              </div>
            ) : (
              <>
                {hasAccounts && (
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 pt-1">Reconfigurar cuenta</p>
                )}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Correo electronico</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="nombre@jiro.mx" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Contrasena</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Tu contrasena de IONOS" />
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-700/30 rounded-lg p-3 text-[11px] text-neutral-500 dark:text-neutral-400 space-y-0.5">
                  <p className="font-medium">Servidores preconfigurados:</p>
                  <p>IMAP: imap.ionos.mx:993 (SSL/TLS)</p>
                  <p>SMTP: smtp.ionos.mx:465 (SSL/TLS)</p>
                </div>
                <button
                  onClick={handleVerify}
                  disabled={verifying || !email || !password}
                  className="w-full py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition disabled:opacity-50"
                >
                  {verifying ? 'Verificando...' : 'Verificar y conectar'}
                </button>
                {hasAccounts && (
                  <button
                    onClick={() => { setShowForm(false); setError(''); }}
                    className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition"
                  >
                    Cancelar
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export default GestorEmails;
