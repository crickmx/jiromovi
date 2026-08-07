// ============================================================================
// Onboarding público de agentes — wizard de 3 pasos (Datos / Documentos /
// Identidad y firma). Guardado automático, subida de documentos, verificación
// de identidad + firma (Cincel), alta automática al aprobar. 100% responsivo.
//
// Variantes de marca (prop `brand`):
//   'movi'         → /alta            (MOVI, azul)
//   'agente_total' → /registro-at     (Agente Total, rojo; auto-asigna oficina)
// Aislado: ruta pública, sin Layout ni sesión. Persistencia vía edge functions.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Loader as Loader2, CircleAlert as AlertCircle, Check, ArrowLeft, ArrowRight,
  Upload, ShieldCheck, FileText, User, CreditCard, RefreshCw,
} from 'lucide-react';
import {
  iniciarAlta, guardarPaso, subirDocumento, retomarAlta, reconciliar, iniciarVerificacion as iniciarVerificacionApi,
  leerSesionLocal, guardarSesionLocal, limpiarSesionLocal,
  type AltaSession, type AltaDatos, type AltaTipo, type AltaEstado, type TipoDocumento,
} from '../lib/alta/altaApi';

type BrandKey = 'movi' | 'agente_total';
interface BrandCfg {
  key: BrandKey; color: string; titulo: string; subtitulo: string;
  logoUrl?: string; logoTexto?: string; sesionKeySuffix: string;
}
const BRANDS: Record<BrandKey, BrandCfg> = {
  movi: {
    key: 'movi', color: '#164281',
    titulo: 'Alta de agente · MOVI',
    subtitulo: 'Proceso guiado, seguro y en pocos minutos.',
    logoTexto: 'M', sesionKeySuffix: 'movi',
  },
  agente_total: {
    key: 'agente_total', color: '#E94947',
    titulo: 'Registro de agente · Agente Total',
    subtitulo: 'Más que una Promotoría de Seguros.',
    logoUrl: 'https://qhwvuuyjhcennqccgvse.supabase.co/storage/v1/object/public/oficinas-logos/8cf898b3-165a-48b3-a762-afa0859ed79a/logo.png',
    sesionKeySuffix: 'at',
  },
};

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

function useRecaptchaLoader() {
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return;
    const id = 'recaptcha-v3-script';
    if (document.getElementById(id)) return;
    const s = document.createElement('script');
    s.id = id;
    s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    s.async = true;
    document.head.appendChild(s);
  }, []);
}
async function ejecutarRecaptcha(): Promise<string> {
  const g = (window as unknown as { grecaptcha?: { ready: (cb: () => void) => void; execute: (k: string, o: object) => Promise<string> } }).grecaptcha;
  if (!RECAPTCHA_SITE_KEY || !g) return '';
  return new Promise<string>((resolve) => {
    g.ready(() => g.execute(RECAPTCHA_SITE_KEY!, { action: 'submit_alta' }).then(resolve).catch(() => resolve('')));
  });
}

interface Paso { id: string; label: string; icon: React.ElementType; }
const PASOS: Paso[] = [
  { id: 'personales', label: 'Personales', icon: User },
  { id: 'fiscal', label: 'Fiscal y RC', icon: CreditCard },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'verificacion', label: 'Identidad', icon: ShieldCheck },
];

// Régimen fiscal: principales para personas físicas en México.
const REGIMENES: { v: string; t: string }[] = [
  { v: 'honorarios', t: 'Servicios profesionales (honorarios)' },
  { v: 'actividad_empresarial', t: 'Actividad empresarial y profesional' },
  { v: 'resico', t: 'RESICO (Régimen Simplificado de Confianza)' },
  { v: 'otro', t: 'Otro' },
];

const DOCS_REQUERIDOS: { tipo: TipoDocumento; label: string; soloConCedula?: boolean }[] = [
  { tipo: 'ine_frente', label: 'INE / identificación oficial (ambos lados, en un solo archivo)' },
  { tipo: 'csf', label: 'Constancia de Situación Fiscal (CSF)' },
  { tipo: 'caratula_bancaria', label: 'Carátula bancaria' },
  { tipo: 'poliza_rc', label: 'Póliza de Responsabilidad Civil' },
  { tipo: 'cedula', label: 'Cédula vigente', soloConCedula: true },
  { tipo: 'comprobante_domicilio', label: 'Comprobante de domicilio (opcional)' },
];
const DOCS_OBLIGATORIOS: TipoDocumento[] = ['ine_frente', 'csf', 'caratula_bancaria', 'poliza_rc'];

function inputCls(err?: boolean): string {
  return `w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 dark:text-gray-100 ${
    err ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
  } focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)] focus:border-[color:var(--brand)]`;
}

interface AltaProps { brand?: BrandKey; }

export default function Alta({ brand = 'movi' }: AltaProps) {
  useRecaptchaLoader();
  const b = BRANDS[brand] || BRANDS.movi;
  const MARCA = b.color;
  const [searchParams] = useSearchParams();

  const [session, setSession] = useState<AltaSession | null>(null);
  const [tipo, setTipo] = useState<AltaTipo | null>(null);
  const [form, setForm] = useState<AltaDatos>({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [docsSubidos, setDocsSubidos] = useState<Set<string>>(new Set());
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<AltaEstado | null>(null);
  const [folio, setFolio] = useState<string | null>(null);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [subEstados, setSubEstados] = useState<{ verif: string; firma: string }>({ verif: 'no_iniciada', firma: 'no_iniciada' });
  const [sesionUrls, setSesionUrls] = useState<{ identidad?: string | null; firma?: string | null }>({});

  const sessionRef = useRef<AltaSession | null>(null);
  const creandoRef = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const setSess = (s: AltaSession | null) => { sessionRef.current = s; setSession(s); };

  // #root tiene overflow:hidden por defecto (app shell) → marcar como pública.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('public-page');
    return () => root?.classList.remove('public-page');
  }, []);

  // Retomar por URL (?alta=&token=) o localStorage.
  useEffect(() => {
    const idUrl = searchParams.get('alta');
    const tokUrl = searchParams.get('token');
    const local = leerSesionLocal();
    const candidate: AltaSession | null = idUrl && tokUrl
      ? { id: idUrl, resume_token: tokUrl, folio: '' }
      : local;
    if (!candidate) return;
    (async () => {
      try {
        const r = await retomarAlta(candidate);
        const s: AltaSession = { id: r.alta.id, folio: r.alta.folio, resume_token: candidate.resume_token };
        setSess(s); guardarSesionLocal(s);
        setFolio(r.alta.folio);
        setTipo((r.alta.tipo_agente as AltaTipo) || null);
        setEstado(r.alta.estado);
        const { id: _i, folio: _f, estado: _e, paso_actual: _p, ...datos } = r.alta;
        setForm(datos as AltaDatos);
        setDocsSubidos(new Set((r.documentos || []).map((d) => d.tipo_documento)));
        if (['identity_pending', 'signature_pending', 'approved', 'awaiting_review'].includes(r.alta.estado)) {
          setStep(3); iniciarPolling(s);
        } else if (['completed', 'needs_retry', 'human_review', 'rejected'].includes(r.alta.estado)) {
          setStep(3);
        }
      } catch { limpiarSesionLocal(); }
    })();
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureSession = useCallback(async (datos: AltaDatos): Promise<AltaSession> => {
    if (sessionRef.current) return sessionRef.current;
    if (creandoRef.current) { await new Promise((r) => setTimeout(r, 400)); if (sessionRef.current) return sessionRef.current; }
    creandoRef.current = true;
    try {
      const token = await ejecutarRecaptcha();
      const s = await iniciarAlta(datos, token, brand);
      setSess(s); setFolio(s.folio);
      return s;
    } finally { creandoRef.current = false; }
  }, [brand]);

  const persistir = useCallback(async (paso?: string, extra?: AltaDatos) => {
    const datos = { ...form, ...(extra || {}), ...(tipo ? { tipo_agente: tipo } : {}) };
    try {
      setSaving(true);
      const s = await ensureSession(datos);
      await guardarPaso(s, { datos, paso, paso_actual: PASOS[step]?.id });
      setLastSaved(new Date());
    } catch (e) { setErrorGlobal((e as Error).message); }
    finally { setSaving(false); }
  }, [form, tipo, step, ensureSession]);

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { persistir(); }, 5000);
  }, [persistir]);

  const upd = (campo: keyof AltaDatos, valor: string) => {
    setForm((p) => ({ ...p, [campo]: valor }));
    setErrors((p) => { const n = { ...p }; delete n[campo as string]; return n; });
    triggerAutoSave();
  };

  function validar(id: string): boolean {
    const e: Record<string, string> = {};
    if (id === 'personales') {
      if (!tipo) e.tipo = 'Elige el tipo de agente';
      if (!form.nombre?.trim()) e.nombre = 'Requerido';
      if (!form.apellidos?.trim()) e.apellidos = 'Requerido';
      if (!form.email?.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Correo válido requerido';
      if (!form.whatsapp?.trim() || form.whatsapp.replace(/\D/g, '').length < 10) e.whatsapp = 'WhatsApp a 10 dígitos';
      if (tipo === 'con_cedula' && !form.rfc?.trim()) e.rfc = 'RFC requerido';
    }
    if (id === 'fiscal') {
      if (!form.regimen_fiscal?.trim()) e.regimen_fiscal = 'Requerido';
      if (!form.codigo_postal_fiscal?.trim()) e.codigo_postal_fiscal = 'Requerido';
      if (!form.banco?.trim()) e.banco = 'Requerido';
      if (!form.clabe?.trim() || form.clabe.replace(/\D/g, '').length !== 18) e.clabe = 'CLABE de 18 dígitos';
      if (tipo === 'con_cedula' && !form.cedula?.trim()) e.cedula = 'Cédula requerida';
      if (!form.poliza_rc_numero?.trim()) e.poliza_rc_numero = 'Número de póliza RC requerido';
      if (!form.poliza_rc_aseguradora?.trim()) e.poliza_rc_aseguradora = 'Aseguradora requerida';
    }
    if (id === 'documentos') {
      const faltan = DOCS_OBLIGATORIOS.filter((d) => !docsSubidos.has(d));
      if (tipo === 'con_cedula' && !docsSubidos.has('cedula')) faltan.push('cedula');
      if (faltan.length) e.documentos = `Faltan ${faltan.length} documento(s) obligatorio(s)`;
    }
    setErrors(e);
    if (Object.keys(e).length && (id === 'personales' || id === 'fiscal')) window.scrollTo({ top: 0, behavior: 'smooth' });
    return Object.keys(e).length === 0;
  }

  async function siguiente() {
    const p = PASOS[step];
    if (!validar(p.id)) return;
    await persistir(p.id);
    setStep((s) => Math.min(s + 1, PASOS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const anterior = () => { setStep((s) => Math.max(s - 1, 0)); window.scrollTo({ top: 0 }); };

  async function onFile(tipoDoc: TipoDocumento, file: File | null) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setErrorGlobal('El archivo supera 15 MB'); return; }
    setSubiendo(tipoDoc); setErrorGlobal(null);
    try {
      const s = await ensureSession({ ...form, ...(tipo ? { tipo_agente: tipo } : {}) });
      await subirDocumento(s, tipoDoc, file);
      setDocsSubidos((prev) => new Set(prev).add(tipoDoc));
    } catch (e) { setErrorGlobal((e as Error).message); }
    finally { setSubiendo(null); }
  }

  function iniciarPolling(s: AltaSession) {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const r = await reconciliar(s);
        setEstado(r.estado);
        if (r.verificacion || r.firma) setSubEstados({ verif: r.verificacion || 'no_iniciada', firma: r.firma || 'no_iniciada' });
        if (['completed', 'rejected', 'human_review', 'needs_retry'].includes(r.estado)) {
          if (pollTimer.current) clearInterval(pollTimer.current);
        }
      } catch { /* reintenta */ }
    }, 4000);
  }

  async function arrancarVerificacion() {
    setEnviando(true); setErrorGlobal(null);
    try {
      const s = await ensureSession({ ...form, ...(tipo ? { tipo_agente: tipo } : {}) });
      await guardarPaso(s, { datos: { ...form, ...(tipo ? { tipo_agente: tipo } : {}) } });
      const r = await iniciarVerificacionApi(s);
      setEstado('identity_pending');
      setSubEstados({ verif: 'pendiente', firma: 'enviada' });
      setSesionUrls({ identidad: r.identidad?.url || null, firma: r.firma?.signUrl || null });
      // Abrir ambos procesos (identidad Sumsub / firma SignWell) en pestañas.
      if (r.identidad?.url) window.open(r.identidad.url, '_blank', 'noopener');
      if (r.firma?.signUrl) window.open(r.firma.signUrl, '_blank', 'noopener');
      iniciarPolling(s);
    } catch (e) { setErrorGlobal((e as Error).message); }
    finally { setEnviando(false); }
  }

  const p = PASOS[step];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-gray-950 dark:to-gray-900 py-6 sm:py-8 px-3 sm:px-4"
      style={{ ['--brand' as string]: MARCA }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 sm:mb-6">
          {b.logoUrl ? (
            <img src={b.logoUrl} alt="" className="h-10 w-auto max-w-[140px] object-contain" />
          ) : (
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold shrink-0" style={{ background: MARCA }}>{b.logoTexto}</div>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">{b.titulo}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{b.subtitulo}</p>
          </div>
          {folio && <span className="ml-auto text-[11px] font-mono text-gray-400 shrink-0 hidden sm:block">{folio}</span>}
        </div>

        {estado === 'completed' ? (
          <Exito folio={folio} marca={MARCA} />
        ) : (
          <>
            {/* Progreso */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4">
              <div className="flex items-center justify-between gap-1">
                {PASOS.map((ps, idx) => {
                  const Icon = ps.icon; const activo = idx === step; const hecho = idx < step;
                  return (
                    <button key={ps.id} onClick={() => idx <= step && setStep(idx)} disabled={idx > step}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activo ? 'text-white' : hecho ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'
                      }`} style={activo ? { background: MARCA } : undefined}>
                      {hecho ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                      <span>{ps.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / PASOS.length) * 100}%`, background: MARCA }} />
              </div>
            </div>

            {/* Contenido */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-4">
              {p.id === 'personales' && <PasoPersonales marca={MARCA} tipo={tipo} setTipo={(t) => { setTipo(t); setErrors((e) => ({ ...e, tipo: '' })); triggerAutoSave(); }} form={form} errors={errors} upd={upd} />}
              {p.id === 'fiscal' && <PasoFiscal tipo={tipo} form={form} errors={errors} upd={upd} />}
              {p.id === 'documentos' && (
                <PasoDocumentos marca={MARCA} tipo={tipo} docsSubidos={docsSubidos} subiendo={subiendo} onFile={onFile} error={errors.documentos} />
              )}
              {p.id === 'verificacion' && (
                <PasoVerificacion marca={MARCA} estado={estado} enviando={enviando} sub={subEstados} urls={sesionUrls}
                  onIniciar={arrancarVerificacion} onReintentar={() => session && arrancarVerificacion()} />
              )}
            </div>

            {errorGlobal && (
              <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{errorGlobal}</span>
              </div>
            )}

            {/* Navegación */}
            {p.id !== 'verificacion' && (
              <div className="flex items-center justify-between gap-2">
                <button onClick={anterior} disabled={step === 0}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40">
                  <ArrowLeft className="w-4 h-4" /> Atrás
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-400 hidden sm:flex items-center gap-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : lastSaved ? <Check className="w-3 h-3 text-emerald-500" /> : null}
                    {lastSaved ? `Guardado ${lastSaved.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                  <button onClick={siguiente} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg" style={{ background: MARCA }}>
                    {step === PASOS.length - 2 ? 'Ir a verificación' : 'Siguiente'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            <p className="text-center text-[11px] text-gray-400 mt-6">
              Tu avance se guarda automáticamente. Puedes cerrar y continuar después desde el mismo dispositivo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────

function Campo({ label, req, error, children }: { label: string; req?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label} {req && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Subtitulo({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-2">{children}</h3>;
}

function PasoPersonales({ marca, tipo, setTipo, form, errors, upd }: {
  marca: string; tipo: AltaTipo | null; setTipo: (t: AltaTipo) => void;
  form: AltaDatos; errors: Record<string, string>; upd: (c: keyof AltaDatos, v: string) => void;
}) {
  const opciones: { v: AltaTipo; t: string }[] = [
    { v: 'con_cedula', t: 'Con Cédula' },
    { v: 'en_desarrollo', t: 'En Desarrollo' },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Datos personales</h2>
      {/* Tipo de agente (segmentado) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tipo de agente <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          {opciones.map((o) => {
            const activo = tipo === o.v;
            return (
              <button key={o.v} onClick={() => setTipo(o.v)}
                className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${activo ? 'text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                style={activo ? { background: marca, borderColor: marca } : undefined}>
                {o.t}
              </button>
            );
          })}
        </div>
        {errors.tipo && <p className="mt-1 text-xs text-red-600">{errors.tipo}</p>}
        <p className="mt-1 text-[11px] text-gray-400">{tipo === 'en_desarrollo' ? 'Aún no tienes cédula; inicias tu desarrollo con nosotros.' : tipo === 'con_cedula' ? 'Ya cuentas con tu cédula de agente vigente.' : 'Elige una opción para continuar.'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="Nombre(s)" req error={errors.nombre}><input className={inputCls(!!errors.nombre)} value={form.nombre || ''} onChange={(e) => upd('nombre', e.target.value)} /></Campo>
        <Campo label="Apellidos" req error={errors.apellidos}><input className={inputCls(!!errors.apellidos)} value={form.apellidos || ''} onChange={(e) => upd('apellidos', e.target.value)} /></Campo>
        <Campo label="Correo electrónico" req error={errors.email}><input type="email" className={inputCls(!!errors.email)} value={form.email || ''} onChange={(e) => upd('email', e.target.value)} /></Campo>
        <Campo label="WhatsApp (10 dígitos)" req error={errors.whatsapp}><input inputMode="numeric" className={inputCls(!!errors.whatsapp)} value={form.whatsapp || ''} onChange={(e) => upd('whatsapp', e.target.value)} /></Campo>
        {tipo === 'con_cedula' && (
          <Campo label="RFC" req error={errors.rfc}><input className={inputCls(!!errors.rfc)} value={form.rfc || ''} onChange={(e) => upd('rfc', e.target.value.toUpperCase())} /></Campo>
        )}
        <Campo label="CURP"><input className={inputCls()} value={form.curp || ''} onChange={(e) => upd('curp', e.target.value.toUpperCase())} /></Campo>
        <Campo label="Fecha de nacimiento"><input type="date" className={inputCls()} value={form.fecha_nacimiento || ''} onChange={(e) => upd('fecha_nacimiento', e.target.value)} /></Campo>
      </div>
    </div>
  );
}

function PasoFiscal({ tipo, form, errors, upd }: {
  tipo: AltaTipo | null; form: AltaDatos; errors: Record<string, string>; upd: (c: keyof AltaDatos, v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Datos fiscales y bancarios</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="Régimen fiscal" req error={errors.regimen_fiscal}>
          <select className={inputCls(!!errors.regimen_fiscal)} value={form.regimen_fiscal || ''} onChange={(e) => upd('regimen_fiscal', e.target.value)}>
            <option value="">Selecciona…</option>
            {REGIMENES.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
          </select>
        </Campo>
        <Campo label="Código postal fiscal" req error={errors.codigo_postal_fiscal}><input inputMode="numeric" className={inputCls(!!errors.codigo_postal_fiscal)} value={form.codigo_postal_fiscal || ''} onChange={(e) => upd('codigo_postal_fiscal', e.target.value)} /></Campo>
        <Campo label="Banco" req error={errors.banco}><input className={inputCls(!!errors.banco)} value={form.banco || ''} onChange={(e) => upd('banco', e.target.value)} /></Campo>
        <Campo label="CLABE interbancaria (18 dígitos)" req error={errors.clabe}><input inputMode="numeric" className={inputCls(!!errors.clabe)} value={form.clabe || ''} onChange={(e) => upd('clabe', e.target.value)} /></Campo>
        <Campo label="Número de cuenta (opcional)"><input inputMode="numeric" className={inputCls()} value={form.cuenta_banco || ''} onChange={(e) => upd('cuenta_banco', e.target.value)} /></Campo>
      </div>

      <Subtitulo>{tipo === 'con_cedula' ? 'Cédula y Póliza RC' : 'Póliza de Responsabilidad Civil'}</Subtitulo>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tipo === 'con_cedula' && (
          <>
            <Campo label="Número de cédula" req error={errors.cedula}><input className={inputCls(!!errors.cedula)} value={form.cedula || ''} onChange={(e) => upd('cedula', e.target.value)} /></Campo>
            <Campo label="Vigencia de la cédula"><input type="date" className={inputCls()} value={form.cedula_vigencia || ''} onChange={(e) => upd('cedula_vigencia', e.target.value)} /></Campo>
          </>
        )}
        <Campo label="Número de póliza RC" req error={errors.poliza_rc_numero}><input className={inputCls(!!errors.poliza_rc_numero)} value={form.poliza_rc_numero || ''} onChange={(e) => upd('poliza_rc_numero', e.target.value)} /></Campo>
        <Campo label="Aseguradora de la RC" req error={errors.poliza_rc_aseguradora}><input className={inputCls(!!errors.poliza_rc_aseguradora)} value={form.poliza_rc_aseguradora || ''} onChange={(e) => upd('poliza_rc_aseguradora', e.target.value)} /></Campo>
        <Campo label="Vigencia de la póliza RC"><input type="date" className={inputCls()} value={form.poliza_rc_vigencia || ''} onChange={(e) => upd('poliza_rc_vigencia', e.target.value)} /></Campo>
      </div>
    </div>
  );
}

function PasoDocumentos({ marca, tipo, docsSubidos, subiendo, onFile, error }: {
  marca: string; tipo: AltaTipo | null; docsSubidos: Set<string>; subiendo: string | null;
  onFile: (t: TipoDocumento, f: File | null) => void; error?: string;
}) {
  const lista = DOCS_REQUERIDOS.filter((d) => !d.soloConCedula || tipo === 'con_cedula');
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Documentos</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">PDF o imagen, hasta 15 MB por archivo.</p>
      {lista.map((d) => {
        const hecho = docsSubidos.has(d.tipo); const cargando = subiendo === d.tipo;
        return (
          <label key={d.tipo} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40"
            style={hecho ? { borderColor: '#10b981', background: '#10b98111' } : undefined}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={hecho ? { background: '#d1fae5', color: '#059669' } : { background: '#f3f4f6', color: '#6b7280' }}>
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : hecho ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
            </div>
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{d.label}</span>
            <span className="text-xs text-gray-400 shrink-0">{hecho ? 'Cargado' : 'Subir'}</span>
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" disabled={cargando}
              onChange={(e) => onFile(d.tipo, e.target.files?.[0] || null)} />
          </label>
        );
      })}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function estadoSubMeta(s: string): { txt: string; cls: string; ok?: boolean; fail?: boolean } {
  if (s === 'aprobada' || s === 'firmada') return { txt: s === 'aprobada' ? 'Aprobada' : 'Firmado', cls: 'text-emerald-600', ok: true };
  if (s === 'rechazada' || s === 'error') return { txt: 'Con problema', cls: 'text-red-600', fail: true };
  if (s === 'no_iniciada') return { txt: 'Sin iniciar', cls: 'text-gray-400' };
  return { txt: 'En proceso…', cls: 'text-amber-600' };
}

function ProcesoCard({ marca, titulo, desc, estado, url }: { marca: string; titulo: string; desc: string; estado: string; url?: string | null }) {
  const m = estadoSubMeta(estado);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${marca}15`, color: marca }}>
        {m.ok ? <Check className="w-4 h-4 text-emerald-600" /> : m.fail ? <AlertCircle className="w-4 h-4 text-red-600" /> : <Loader2 className="w-4 h-4 animate-spin" />}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{titulo}</p>
        <p className={`text-xs ${m.cls}`}>{m.txt}</p>
      </div>
      {url && !m.ok && (
        <button onClick={() => window.open(url, '_blank', 'noopener')} className="text-xs font-medium px-2.5 py-1.5 rounded-lg border shrink-0" style={{ borderColor: marca, color: marca }}>
          Abrir
        </button>
      )}
    </div>
  );
}

function PasoVerificacion({ marca, estado, enviando, sub, urls, onIniciar, onReintentar }: {
  marca: string; estado: AltaEstado | null; enviando: boolean;
  sub: { verif: string; firma: string }; urls: { identidad?: string | null; firma?: string | null };
  onIniciar: () => void; onReintentar: () => void;
}) {
  const enProceso = estado === 'identity_pending' || estado === 'signature_pending' || estado === 'approved' || estado === 'awaiting_review';
  if (estado === 'human_review') {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3"><AlertCircle className="w-7 h-7" /></div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Lo revisará una persona del equipo</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tuvimos algunos intentos fallidos. Nuestro equipo revisará tu caso y te contactará. No pierdes tu avance.</p>
      </div>
    );
  }
  if (estado === 'needs_retry' || estado === 'rejected') {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3"><AlertCircle className="w-7 h-7" /></div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">No pudimos verificar o firmar</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">Puedes intentar de nuevo ahora, o cerrar y retomar más tarde desde el mismo dispositivo.</p>
        <button onClick={onReintentar} disabled={enviando} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg" style={{ background: marca }}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Reintentar
        </button>
      </div>
    );
  }
  if (enProceso) {
    return (
      <div className="py-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white text-center">Verificación de identidad y firma</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4 text-center">Completa ambos procesos en las ventanas que abrimos. Esta pantalla se actualiza sola.</p>
        <div className="space-y-2.5">
          <ProcesoCard marca={marca} titulo="Verificación de identidad" desc="INE + selfie + prueba de vida" estado={sub.verif} url={urls.identidad} />
          <ProcesoCard marca={marca} titulo="Firma del contrato" desc="Firma con validez legal" estado={sub.firma} url={urls.firma} />
        </div>
      </div>
    );
  }
  return (
    <div className="text-center py-6">
      <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: `${marca}15`, color: marca }}><ShieldCheck className="w-7 h-7" /></div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Verificación de identidad y firma del contrato</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">En un solo paso validamos tu identidad (INE + selfie) y firmas tu contrato con validez legal. Es rápido y seguro.</p>
      <button onClick={onIniciar} disabled={enviando} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg" style={{ background: marca }}>
        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Iniciar verificación y firma
      </button>
    </div>
  );
}

function Exito({ folio, marca }: { folio: string | null; marca: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 text-center shadow-sm">
      <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: `${marca}15`, color: marca }}>
        <Check className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¡Bienvenido!</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Tu alta como agente quedó completa. Te enviamos un correo de bienvenida con los siguientes pasos para ingresar a la plataforma.</p>
      {folio && <div className="inline-block bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-2 text-sm"><span className="text-gray-500">Folio: </span><span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{folio}</span></div>}
    </div>
  );
}
