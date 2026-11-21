import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail, RefreshCw, Search, Trash2, RotateCcw, Star, ArrowLeft, Send, Settings,
  Paperclip, Inbox, SendHorizontal, Reply, CircleAlert as AlertCircle, ImageOff,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cnSistema as cn } from '@/lib/utils';

// El buzón del canal externo: lo que POP3 ya bajó a nuestra base.
//
// Aquí NO se lee del servidor. A diferencia del gestor de IONOS —que consulta
// IMAP en cada acción— este buzón mira `correo_externo_mensajes`, porque POP3
// no permite volver a preguntar. "Traer correo" es lo único que habla con el
// servidor.
//
// Recibidos / Enviados / Papelera son NUESTROS: POP3 no tiene carpetas ni
// marcas. Y por eso mismo lo que se marca como leído aquí no lo ve ningún otro
// cliente de correo.

interface Canal {
  id: string;
  nombre: string;
  email: string;
  dejar_copia: boolean;
  estado_conexion: string | null;
  ultimo_error: string | null;
  ultima_sincronizacion: string | null;
}

interface Mensaje {
  id: string;
  canal_id: string;
  message_id: string | null;
  remitente_nombre: string | null;
  remitente_email: string | null;
  destinatarios: string[];
  cc: string[];
  asunto: string | null;
  fecha: string | null;
  cuerpo_texto: string | null;
  cuerpo_html: string | null;
  tiene_adjuntos: boolean;
  leido: boolean;
  marcado: boolean;
  eliminado_en: string | null;
  es_enviado: boolean;
}

type Vista = 'recibidos' | 'enviados' | 'papelera';

interface Borrador {
  para: string;
  cc: string;
  asunto: string;
  cuerpo: string;
  inReplyTo?: string;
}

const VISTAS: Array<{ id: Vista; label: string; icono: typeof Inbox }> = [
  { id: 'recibidos', label: 'Recibidos', icono: Inbox },
  { id: 'enviados', label: 'Enviados', icono: SendHorizontal },
  { id: 'papelera', label: 'Papelera', icono: Trash2 },
];

const inputCls = 'w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 text-neutral-900 dark:text-white text-sm';

const corto = (f: string | null) => {
  if (!f) return '';
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

const quien = (m: Mensaje) => m.remitente_nombre || m.remitente_email || '(sin remitente)';

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** El texto que se escribe se manda como HTML simple: sin editor, sin sorpresas. */
const aHtml = (s: string) => escapar(s).replace(/\n/g, '<br>');

/**
 * El HTML de un correo externo NO se puede meter tal cual en la página: es de
 * un tercero y puede traer scripts. Se pinta dentro de un iframe con
 * `sandbox` sin `allow-scripts` (así no corre nada aunque lo traiga) y con una
 * CSP que, por omisión, deja cargar imágenes solo de `data:` — o sea que ni
 * los píxeles de rastreo entran hasta que la persona lo pide.
 */
function CuerpoSeguro({ html, conImagenes }: { html: string; conImagenes: boolean }) {
  const doc = useMemo(() => {
    const csp = conImagenes
      ? "default-src 'none'; img-src * data: cid:; style-src 'unsafe-inline'; font-src data:;"
      : "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:;";
    const estilo = 'body{margin:0;padding:12px;font:14px/1.5 system-ui,-apple-system,sans-serif;color:#171717;word-break:break-word}'
      + 'img{max-width:100%;height:auto}a{color:#0f766e}table{max-width:100%!important}*{max-width:100%}';
    return `<!doctype html><html><head><meta charset="utf-8">`
      + `<meta http-equiv="Content-Security-Policy" content="${csp}">`
      + `<base target="_blank"><style>${estilo}</style></head><body>${html}</body></html>`;
  }, [html, conImagenes]);

  return (
    <iframe
      title="Contenido del mensaje"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      className="w-full h-[58vh] border-0 bg-white rounded-xl"
    />
  );
}

export default function CorreoExternoBuzon() {
  const { usuario } = useAuth();
  const [canales, setCanales] = useState<Canal[]>([]);
  const [canalId, setCanalId] = useState<string>('');
  const [vista, setVista] = useState<Vista>('recibidos');
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<Mensaje | null>(null);
  const [consulta, setConsulta] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [progreso, setProgreso] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [conImagenes, setConImagenes] = useState(false);

  const canal = canales.find((c) => c.id === canalId) ?? null;

  const llamar = async (cuerpo: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/correo-externo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const datos = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(datos.error || 'No se pudo completar la operación.');
    return datos;
  };

  const cargarCanales = useCallback(async () => {
    if (!usuario) return;
    const { data, error } = await supabase
      .from('correo_externo_canales')
      .select('id,nombre,email,dejar_copia,estado_conexion,ultimo_error,ultima_sincronizacion')
      .eq('activo', true)
      .order('created_at', { ascending: true });
    if (error) {
      setAviso({ tipo: 'error', texto: error.message });
      setCargando(false);
      return;
    }
    const lista = (data as Canal[]) ?? [];
    setCanales(lista);
    setCanalId((actual) => actual || lista[0]?.id || '');
    setCargando(false);
  }, [usuario]);

  const cargarMensajes = useCallback(async () => {
    if (!canalId) { setMensajes([]); return; }
    setCargando(true);
    let q = supabase
      .from('correo_externo_mensajes')
      .select('id,canal_id,message_id,remitente_nombre,remitente_email,destinatarios,cc,asunto,fecha,cuerpo_texto,cuerpo_html,tiene_adjuntos,leido,marcado,eliminado_en,es_enviado')
      .eq('canal_id', canalId)
      .order('fecha', { ascending: false, nullsFirst: false })
      .limit(80);

    if (vista === 'papelera') {
      q = q.not('eliminado_en', 'is', null);
    } else {
      q = q.is('eliminado_en', null).eq('es_enviado', vista === 'enviados');
    }

    // La búsqueda va al servidor. Los caracteres que arman la sintaxis de
    // PostgREST (, % ( ) * " \) se quitan: con uno de ellos la consulta
    // devuelve un error de sintaxis en vez de resultados.
    const t = consulta.trim().replace(/[%,()*"'\\]/g, ' ').trim().slice(0, 60);
    if (t) {
      q = q.or(`asunto.ilike.%${t}%,remitente_email.ilike.%${t}%,remitente_nombre.ilike.%${t}%`);
    }

    const { data, error } = await q;
    if (error) setAviso({ tipo: 'error', texto: error.message });
    setMensajes((data as Mensaje[]) ?? []);
    setCargando(false);
  }, [canalId, vista, consulta]);

  // Cargar al montar y cuando cambian canal/vista/búsqueda. La regla se
  // desactiva igual que en `SegurosEducation.tsx` y `SalaAula.tsx`: el estado
  // que se toca aquí es el de "cargando" de una consulta, no un rebote de
  // renders.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargarCanales(); }, [cargarCanales]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void cargarMensajes(); }, [cargarMensajes]);

  const abrir = async (m: Mensaje) => {
    setAbierto(m);
    setConImagenes(false);
    if (!m.leido) {
      setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, leido: true } : x)));
      setAbierto({ ...m, leido: true });
      await supabase.from('correo_externo_mensajes').update({ leido: true }).eq('id', m.id);
    }
  };

  const alternar = async (m: Mensaje, campo: 'leido' | 'marcado') => {
    const valor = !m[campo];
    setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, [campo]: valor } : x)));
    if (abierto?.id === m.id) setAbierto({ ...abierto, [campo]: valor });
    const { error } = await supabase.from('correo_externo_mensajes').update({ [campo]: valor }).eq('id', m.id);
    if (error) setAviso({ tipo: 'error', texto: error.message });
  };

  const aPapelera = async (m: Mensaje) => {
    const { error } = await supabase
      .from('correo_externo_mensajes')
      .update({ eliminado_en: new Date().toISOString() })
      .eq('id', m.id);
    if (error) { setAviso({ tipo: 'error', texto: error.message }); return; }
    setAbierto(null);
    await cargarMensajes();
  };

  const restaurar = async (m: Mensaje) => {
    const { error } = await supabase
      .from('correo_externo_mensajes')
      .update({ eliminado_en: null })
      .eq('id', m.id);
    if (error) { setAviso({ tipo: 'error', texto: error.message }); return; }
    setAbierto(null);
    await cargarMensajes();
  };

  // Ojo con borrar de verdad: si el canal "deja copia" en el servidor, el
  // próximo "traer correo" lo vuelve a bajar y aparece otra vez. Por eso aquí
  // solo se manda a la papelera; el borrado definitivo es cosa de la
  // retención, que se decide aparte.

  const traerCorreo = async () => {
    if (!canalId || sincronizando) return;
    setSincronizando(true);
    setAviso(null);
    let bajados = 0;
    try {
      for (let vuelta = 0; vuelta < 6; vuelta++) {
        setProgreso(vuelta === 0 ? 'Conectando…' : `Bajando… ${bajados} mensaje(s)`);
        const r = await llamar({ accion: 'sincronizar', canalId });
        bajados += Number(r.bajados ?? 0);
        if (r.aviso) setAviso({ tipo: 'ok', texto: String(r.aviso) });
        if (!r.quedan) {
          setAviso({ tipo: 'ok', texto: bajados === 0 ? 'No había correo nuevo.' : `${bajados} mensaje(s) nuevo(s).` });
          break;
        }
        if (vuelta === 5) {
          setAviso({ tipo: 'ok', texto: `Bajados ${bajados}. Quedan más: vuelve a darle a Traer correo.` });
        }
      }
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo traer el correo.' });
    } finally {
      setSincronizando(false);
      setProgreso('');
      await Promise.all([cargarCanales(), cargarMensajes()]);
    }
  };

  const enviar = async () => {
    if (!borrador || !canalId) return;
    const para = borrador.para.split(',').map((d) => d.trim()).filter((d) => d.includes('@'));
    if (para.length === 0 || !borrador.asunto.trim()) {
      setAviso({ tipo: 'error', texto: 'Hacen falta destinatario y asunto.' });
      return;
    }
    setEnviando(true);
    try {
      await llamar({
        accion: 'enviar', canalId,
        para,
        cc: borrador.cc.split(',').map((d) => d.trim()).filter((d) => d.includes('@')),
        asunto: borrador.asunto.trim(),
        html: aHtml(borrador.cuerpo),
        texto: borrador.cuerpo,
        inReplyTo: borrador.inReplyTo,
      });
      setBorrador(null);
      setAviso({ tipo: 'ok', texto: 'Enviado. Queda copia en Enviados.' });
      if (vista === 'recibidos') setVista('enviados'); else await cargarMensajes();
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo enviar.' });
    } finally {
      setEnviando(false);
    }
  };

  const responder = (m: Mensaje) => {
    const asunto = (m.asunto ?? '').trim();
    setBorrador({
      para: m.remitente_email ?? '',
      cc: '',
      asunto: /^re:/i.test(asunto) ? asunto : `RE: ${asunto}`,
      cuerpo: `\n\n--- Mensaje original ---\n${(m.cuerpo_texto ?? '').slice(0, 2000)}`,
      // El Message-ID se guarda sin los <> (así viene del encabezado) y SMTP
      // lo necesita CON ellos: sin eso, el otro lado no arma el hilo.
      inReplyTo: m.message_id ? `<${m.message_id}>` : undefined,
    });
  };

  const traeImagenes = useMemo(
    () => /<img[^>]+src=["']https?:/i.test(abierto?.cuerpo_html ?? ''),
    [abierto],
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-title-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-accent" /> Correo externo
          </h1>
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Tus otras cuentas. Este buzón vive en MOVI: POP3 no tiene carpetas ni marcas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/centro-contacto/correo-externo/cuentas"
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-300"
          >
            <Settings className="w-4 h-4" /> Cuentas
          </a>
          <button
            onClick={traerCorreo}
            disabled={sincronizando || !canalId}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            <RefreshCw className={cn('w-4 h-4', sincronizando && 'animate-spin')} />
            {sincronizando ? (progreso || 'Trayendo…') : 'Traer correo'}
          </button>
          <button
            onClick={() => setBorrador({ para: '', cc: '', asunto: '', cuerpo: '' })}
            disabled={!canalId}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-300 disabled:opacity-40"
          >
            <Send className="w-4 h-4" /> Redactar
          </button>
        </div>
      </header>

      {aviso && (
        <div className={cn(
          'mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2',
          aviso.tipo === 'ok'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300',
        )}>
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{aviso.texto}</span>
        </div>
      )}

      {!cargando && canales.length === 0 && (
        <div className="border border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-10 text-center">
          <Mail className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
          <p className="text-body-sm text-neutral-500">Todavía no tienes cuentas externas.</p>
          <a href="/centro-contacto/correo-externo/cuentas" className="inline-block mt-3 text-sm text-accent underline">
            Agregar una cuenta
          </a>
        </div>
      )}

      {canales.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {canales.length > 1 && (
              <select className={cn(inputCls, 'w-auto')} value={canalId} onChange={(e) => { setCanalId(e.target.value); setAbierto(null); }}>
                {canales.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.email}</option>)}
              </select>
            )}
            <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {VISTAS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setVista(v.id); setAbierto(null); }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 text-sm',
                    vista === v.id ? 'bg-accent text-white' : 'text-neutral-600 dark:text-neutral-300',
                  )}
                >
                  <v.icono className="w-4 h-4" /> {v.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={cn(inputCls, 'pl-9')}
                placeholder="Buscar por asunto o remitente"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
              />
            </div>
          </div>

          {canal?.estado_conexion === 'error' && canal.ultimo_error && (
            <p className="mb-3 text-caption text-red-600 dark:text-red-400">
              Último intento contra el servidor: {canal.ultimo_error}
            </p>
          )}

          <div className="grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4">
            <section className={cn('space-y-1.5', abierto && 'hidden lg:block')}>
              {cargando && <p className="text-body-sm text-neutral-500 p-2">Cargando…</p>}
              {!cargando && mensajes.length === 0 && (
                <p className="text-body-sm text-neutral-500 p-2">
                  {vista === 'recibidos' ? 'Nada todavía. Dale a "Traer correo".' : 'Aquí no hay nada.'}
                </p>
              )}
              {mensajes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => abrir(m)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl border',
                    abierto?.id === m.id
                      ? 'border-accent bg-accent/5'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn('text-body-sm truncate', !m.leido && 'font-semibold text-neutral-900 dark:text-white')}>
                      {vista === 'enviados' ? `Para: ${m.destinatarios?.[0] ?? '—'}` : quien(m)}
                    </span>
                    <span className="text-caption text-neutral-400 shrink-0">{corto(m.fecha)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m.marcado && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                    {m.tiene_adjuntos && <Paperclip className="w-3 h-3 text-neutral-400 shrink-0" />}
                    <span className="text-body-sm text-neutral-500 truncate">{m.asunto || '(sin asunto)'}</span>
                  </div>
                </button>
              ))}
            </section>

            <section className={cn(!abierto && 'hidden lg:block')}>
              {!abierto ? (
                <div className="h-full min-h-[16rem] border border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl grid place-items-center text-body-sm text-neutral-400">
                  Elige un mensaje
                </div>
              ) : (
                <article className="border border-neutral-200 dark:border-neutral-700 rounded-2xl bg-white dark:bg-neutral-900 overflow-hidden">
                  <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-body font-semibold text-neutral-900 dark:text-white break-words">{abierto.asunto || '(sin asunto)'}</h2>
                        <p className="text-body-sm text-neutral-500 mt-1 break-words">
                          {quien(abierto)} {abierto.remitente_email && <span className="text-neutral-400">&lt;{abierto.remitente_email}&gt;</span>}
                        </p>
                        <p className="text-caption text-neutral-400 mt-0.5">
                          {abierto.fecha ? new Date(abierto.fecha).toLocaleString('es-MX') : 'sin fecha'}
                          {abierto.destinatarios?.length ? ` · para ${abierto.destinatarios.join(', ')}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => alternar(abierto, 'marcado')} className="p-2 rounded-lg text-neutral-500 hover:text-amber-500" aria-label="Destacar">
                          <Star className={cn('w-4 h-4', abierto.marcado && 'text-amber-500 fill-amber-500')} />
                        </button>
                        <button onClick={() => alternar(abierto, 'leido')} className="p-2 rounded-lg text-neutral-500 hover:text-neutral-800" aria-label="Leído">
                          <Mail className="w-4 h-4" />
                        </button>
                        {vista === 'papelera'
                          ? <button onClick={() => restaurar(abierto)} className="p-2 rounded-lg text-neutral-500 hover:text-emerald-600" aria-label="Restaurar"><RotateCcw className="w-4 h-4" /></button>
                          : <button onClick={() => aPapelera(abierto)} className="p-2 rounded-lg text-neutral-500 hover:text-red-600" aria-label="Eliminar"><Trash2 className="w-4 h-4" /></button>}
                        <button onClick={() => setAbierto(null)} className="p-2 rounded-lg text-neutral-500 lg:hidden" aria-label="Cerrar"><ArrowLeft className="w-4 h-4" /></button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button onClick={() => responder(abierto)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-white text-sm">
                        <Reply className="w-4 h-4" /> Responder
                      </button>
                      {traeImagenes && !conImagenes && (
                        <button onClick={() => setConImagenes(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-300">
                          <ImageOff className="w-4 h-4" /> Mostrar imágenes
                        </button>
                      )}
                    </div>

                    {abierto.tiene_adjuntos && (
                      <p className="text-caption text-amber-700 dark:text-amber-400 mt-2">
                        Este mensaje trae adjuntos que no se descargan: POP3 los entrega dentro del mensaje y guardarlos necesita otro paso.
                      </p>
                    )}
                  </div>

                  <CuerpoSeguro html={abierto.cuerpo_html || `<pre>${escapar(abierto.cuerpo_texto ?? '')}</pre>`} conImagenes={conImagenes} />
                </article>
              )}
            </section>
          </div>
        </>
      )}

      {borrador && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-neutral-900 w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-5">
            <h2 className="text-title font-semibold text-neutral-900 dark:text-white mb-4">
              {borrador.asunto ? 'Responder' : 'Mensaje nuevo'} · desde {canal?.email ?? ''}
            </h2>
            <div className="space-y-3">
              <input className={inputCls} placeholder="Para (separa con comas)" value={borrador.para} onChange={(e) => setBorrador({ ...borrador, para: e.target.value })} />
              <input className={inputCls} placeholder="CC (opcional)" value={borrador.cc} onChange={(e) => setBorrador({ ...borrador, cc: e.target.value })} />
              <input className={inputCls} placeholder="Asunto" value={borrador.asunto} onChange={(e) => setBorrador({ ...borrador, asunto: e.target.value })} />
              <textarea
                className={cn(inputCls, 'min-h-[180px] resize-y')}
                placeholder="Escribe tu mensaje…"
                value={borrador.cuerpo}
                onChange={(e) => setBorrador({ ...borrador, cuerpo: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setBorrador(null)} className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm">Cancelar</button>
              <button
                onClick={enviar}
                disabled={enviando}
                className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-40"
              >
                {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-caption text-neutral-400 mt-6">
        Recibidos, Enviados y Papelera son de MOVI: POP3 no tiene carpetas ni marcas, así que ningún otro
        cliente de correo va a ver lo que marques aquí. El correo se guarda en MOVI; el borrado definitivo
        depende de la política de retención.
      </p>
    </div>
  );
}
