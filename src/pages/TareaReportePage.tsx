import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, Hash, Shield,
  CheckCircle, AlertTriangle, Loader2, ClipboardList,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

declare global {
  interface Window { grecaptcha: any; }
}
// Site key propio de MOVI, separado del que usan seguros.express / lead público —
// debe pertenecer al MISMO registro de reCAPTCHA en Google que RECAPTCHA_SECRET_KEY_MOVI
// (edge function procesar-reporte-protegido), o la verificación del token siempre falla.
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY_MOVI as string | undefined;

// ── IndexedDB helpers ──────────────────────────────────────────────────────
const IDB_NAME = 'jiromovi_reportes';
const IDB_STORE = 'drafts';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key: string): Promise<string | undefined> {
  const db = await openIDB();
  return new Promise(res => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    req.onsuccess = () => res(req.result as string | undefined);
    req.onerror = () => res(undefined);
  });
}
async function idbSet(key: string, val: string): Promise<void> {
  const db = await openIDB();
  return new Promise(res => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => res();
  });
}
async function idbDel(key: string): Promise<void> {
  const db = await openIDB();
  return new Promise(res => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => res();
  });
}
// ──────────────────────────────────────────────────────────────────────────

function pct(val: number, max: number) {
  return Math.min(100, max > 0 ? Math.round((val / max) * 100) : 0);
}
function fmtTime(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

interface Cfg {
  instrucciones?: string;
  min_palabras: number;
  tiempo_minimo_segundos: number;
  score_minimo: number;
}
type Fase = 'cargando' | 'instrucciones' | 'escribiendo' | 'enviando' | 'enviado' | 'error';

function Bar({ icon, label, p, done, warn }: {
  icon: React.ReactNode; label: string; p: number; done: boolean; warn?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
        {icon}<span className="truncate">{label}</span>
      </div>
      <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : warn ? 'bg-red-400' : 'bg-violet-500'}`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

export default function TareaReportePage() {
  const { tramiteId, campoId } = useParams<{ tramiteId: string; campoId: string }>();
  const navigate = useNavigate();

  const [fase, setFase] = useState<Fase>('cargando');
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [campoLabel, setCampoLabel] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const [texto, setTexto] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pastedChars, setPastedChars] = useState(0);
  const [pasteWarn, setPasteWarn] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const draftKey = `reporte_${tramiteId}_${campoId}`;

  const wordCount = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  const score = texto.length > 0 ? Math.max(0, 1 - pastedChars / texto.length) : 1;
  const minWords = cfg?.min_palabras ?? 100;
  const minTime = cfg?.tiempo_minimo_segundos ?? 120;
  const minScore = cfg?.score_minimo ?? 0.7;
  const canSubmit = wordCount >= minWords && elapsed >= minTime && score >= minScore;

  useEffect(() => { loadData(); }, [tramiteId, campoId]);

  // Timer
  useEffect(() => {
    if (!startTime) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  // Auto-save draft every 30s
  useEffect(() => {
    if (fase !== 'escribiendo' || !texto) return;
    const id = setInterval(() => idbSet(draftKey, texto), 30_000);
    return () => clearInterval(id);
  }, [fase, texto, draftKey]);

  // Save on unload
  useEffect(() => {
    const save = () => { if (texto && fase === 'escribiendo') idbSet(draftKey, texto); };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [texto, fase, draftKey]);

  // Dismiss paste warning
  useEffect(() => {
    if (!pasteWarn) return;
    const id = setTimeout(() => setPasteWarn(false), 3000);
    return () => clearTimeout(id);
  }, [pasteWarn]);

  async function loadData() {
    if (!tramiteId || !campoId) { setErrMsg('Parámetros inválidos'); setFase('error'); return; }

    const [{ data: campo, error: e1 }, { data: resp }] = await Promise.all([
      supabase.from('tramite_tipo_campos').select('label, config').eq('id', campoId).single(),
      supabase.from('tramite_respuestas').select('valor_json').eq('tramite_id', tramiteId).eq('campo_id', campoId).maybeSingle(),
    ]);

    if (e1 || !campo) { setErrMsg('No se pudo cargar el campo'); setFase('error'); return; }

    setCampoLabel(campo.label);
    setCfg({
      instrucciones: campo.config?.instrucciones,
      min_palabras: Number(campo.config?.min_palabras ?? 100),
      tiempo_minimo_segundos: Number(campo.config?.tiempo_minimo_segundos ?? 120),
      score_minimo: Number(campo.config?.score_minimo ?? 0.7),
    });

    if (resp?.valor_json?.enviado === true) { setFase('enviado'); return; }

    const draft = await idbGet(draftKey);
    if (draft) setTexto(draft);
    setFase('instrucciones');
  }

  function start() {
    setFase('escribiendo');
    setStartTime(Date.now());
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const len = e.clipboardData.getData('text').length;
    if (len > 0) { setPastedChars(p => p + len); setPasteWarn(true); }
  }

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setFase('enviando');
    setErrMsg('');
    await idbSet(draftKey, texto);

    if (!navigator.onLine) { setFase('escribiendo'); setOffline(true); return; }

    const dispositivo = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'móvil' : 'computadora';
    const captchaToken = await getCaptchaToken();
    const { error } = await supabase.functions.invoke('procesar-reporte-protegido', {
      body: {
        tramite_id: tramiteId, campo_id: campoId, texto,
        tiempo_segundos: elapsed,
        score_humano: Math.round(score * 100) / 100,
        chars_pegados: pastedChars,
        dispositivo,
        captcha_token: captchaToken,
      },
    });

    if (error) { setFase('escribiendo'); setErrMsg('Error al enviar. Intenta de nuevo.'); return; }
    await idbDel(draftKey);
    setFase('enviado');
  }, [canSubmit, texto, tramiteId, campoId, draftKey]);

  // Cargar reCAPTCHA v3 cuando pase a fase de escritura
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || document.getElementById('recaptcha-script')) return;
    const s = document.createElement('script');
    s.id = 'recaptcha-script';
    s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    s.async = true;
    document.head.appendChild(s);
  }, [fase === 'instrucciones' || fase === 'escribiendo']);

  async function getCaptchaToken(): Promise<string | null> {
    if (!RECAPTCHA_SITE_KEY || !window.grecaptcha) return null;
    return new Promise(resolve => {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'reporte_submit' })
          .then((token: string) => resolve(token))
          .catch(() => resolve(null));
      });
    });
  }

  // Online/offline
  useEffect(() => {
    const onOnline = () => { setOffline(false); if (canSubmit && fase === 'escribiendo') submit(); };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [canSubmit, fase, submit]);

  // ── Renders ────────────────────────────────────────────────────────────────

  if (fase === 'cargando') return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
    </div>
  );

  if (fase === 'error') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-neutral-50 dark:bg-neutral-900 p-6">
      <AlertTriangle className="w-8 h-8 text-red-500" />
      <p className="text-neutral-700 dark:text-neutral-300 text-center">{errMsg}</p>
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">Volver</button>
    </div>
  );

  if (fase === 'enviado') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8 max-w-md w-full text-center space-y-4">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Reporte enviado</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Cifrado y guardado correctamente.</p>
        <button onClick={() => navigate(-1)} className="w-full py-2.5 bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl text-sm font-medium hover:opacity-80 transition-opacity">
          Volver al trámite
        </button>
      </div>
    </div>
  );

  if (fase === 'instrucciones') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8 max-w-lg w-full space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Reporte protegido</p>
            <h1 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">{campoLabel}</h1>
          </div>
        </div>

        {cfg?.instrucciones && (
          <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-4 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {cfg.instrucciones}
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">Requisitos</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([
              [String(minWords), 'palabras mín.'],
              [fmtTime(minTime), 'tiempo mín.'],
              [`${Math.round(minScore * 100)}%`, 'original mín.'],
            ] as [string, string][]).map(([val, sub]) => (
              <div key={sub} className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl py-3">
                <p className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{val}</p>
                <p className="text-xs text-neutral-500">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {texto && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Tienes un borrador guardado — puedes continuar donde lo dejaste.
          </div>
        )}

        <button onClick={start} className="w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 active:bg-violet-800 transition-colors">
          {texto ? 'Continuar escribiendo' : 'Comenzar'}
        </button>
        <button onClick={() => navigate(-1)} className="w-full text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );

  // Writing / sending
  const wPct = pct(wordCount, minWords);
  const tPct = pct(elapsed, minTime);
  const sPct = Math.round(score * 100);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 flex flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-neutral-400">Reporte protegido</p>
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{campoLabel}</p>
        </div>
        {offline && (
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
            Sin conexión
          </span>
        )}
      </header>

      <div className="px-4 pt-3 pb-2 grid grid-cols-3 gap-3 border-b border-neutral-100 dark:border-neutral-800">
        <Bar icon={<Hash className="w-3 h-3" />} label={`${wordCount} / ${minWords} palabras`} p={wPct} done={wordCount >= minWords} />
        <Bar icon={<Clock className="w-3 h-3" />} label={`${fmtTime(elapsed)} / ${fmtTime(minTime)}`} p={tPct} done={elapsed >= minTime} />
        <Bar icon={<Shield className="w-3 h-3" />} label={`${sPct}% original`} p={sPct} done={score >= minScore} warn={score < minScore && pastedChars > 0} />
      </div>

      {pasteWarn && (
        <div className="mx-4 mt-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Texto pegado detectado — reduce tu score de originalidad.
        </div>
      )}
      {errMsg && (
        <div className="mx-4 mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
          {errMsg}
        </div>
      )}

      <textarea
        ref={taRef}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onPaste={handlePaste}
        placeholder="Escribe tu reporte aquí…"
        spellCheck
        className="flex-1 w-full resize-none p-4 text-sm leading-relaxed text-neutral-800 dark:text-neutral-100 bg-transparent placeholder:text-neutral-300 dark:placeholder:text-neutral-600 focus:outline-none"
      />

      <footer className="sticky bottom-0 px-4 pb-4 pt-2 border-t border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm space-y-1.5">
        {offline ? (
          <p className="text-center text-sm text-amber-600 dark:text-amber-400 py-1">
            Sin conexión — borrador guardado. Se enviará al reconectar.
          </p>
        ) : (
          <button
            onClick={submit}
            disabled={!canSubmit || fase === 'enviando'}
            className="w-full py-3 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 active:bg-violet-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {fase === 'enviando'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando…</>
              : 'Enviar reporte'
            }
          </button>
        )}
        {!canSubmit && fase !== 'enviando' && (
          <p className="text-center text-xs text-neutral-400">
            {wordCount < minWords
              ? `Faltan ${minWords - wordCount} palabras`
              : elapsed < minTime
              ? `Espera ${fmtTime(minTime - elapsed)} más`
              : `Originalidad insuficiente (${sPct}% de ${Math.round(minScore * 100)}% requerido)`}
          </p>
        )}
        {RECAPTCHA_SITE_KEY && (
          <p className="text-center text-[10px] text-neutral-300 dark:text-neutral-600">
            Protegido por reCAPTCHA
          </p>
        )}
      </footer>
    </div>
  );
}
