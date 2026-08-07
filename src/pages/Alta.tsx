// ============================================================================
// /alta — Onboarding público de agentes (Agente con Cédula / en Desarrollo).
// Wizard por pasos con guardado automático, progreso, subida de documentos,
// verificación de identidad + firma (Cincel) y alta automática al aprobar.
// Aislado: ruta pública, sin Layout ni sesión. Toda persistencia via edge
// functions (ver src/lib/alta/altaApi.ts). Español de México.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Loader as Loader2, CircleAlert as AlertCircle, Check, ArrowLeft, ArrowRight,
  Upload, ShieldCheck, FileText, User, CreditCard, IdCard, RefreshCw,
} from 'lucide-react';
import {
  iniciarAlta, guardarPaso, subirDocumento, retomarAlta, reconciliar, enviarACincel,
  leerSesionLocal, guardarSesionLocal, limpiarSesionLocal,
  type AltaSession, type AltaDatos, type AltaTipo, type AltaEstado, type TipoDocumento,
} from '../lib/alta/altaApi';

const MARCA = '#164281';
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

const DOCS_REQUERIDOS: { tipo: TipoDocumento; label: string; soloConCedula?: boolean }[] = [
  { tipo: 'ine_frente', label: 'INE / identificación oficial (frente)' },
  { tipo: 'ine_reverso', label: 'INE / identificación oficial (reverso)' },
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
  } focus:outline-none focus:ring-2 focus:ring-[#164281]/40`;
}

export default function Alta() {
  useRecaptchaLoader();
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

  const sessionRef = useRef<AltaSession | null>(null);
  const creandoRef = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pasos: Paso[] = [
    { id: 'tipo', label: 'Tipo', icon: User },
    { id: 'datos', label: 'Tus datos', icon: User },
    { id: 'fiscal', label: 'Fiscal y banco', icon: CreditCard },
    { id: 'cedula', label: tipo === 'con_cedula' ? 'Cédula y RC' : 'Póliza RC', icon: IdCard },
    { id: 'documentos', label: 'Documentos', icon: FileText },
    { id: 'verificacion', label: 'Identidad y firma', icon: ShieldCheck },
  ];

  const setSess = (s: AltaSession | null) => { sessionRef.current = s; setSession(s); };

  // #root tiene overflow:hidden por defecto (app shell). Marcar como página
  // pública para permitir el scroll normal del documento.
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
          setStep(5); iniciarPolling(s);
        } else if (['completed', 'needs_retry', 'human_review', 'rejected'].includes(r.alta.estado)) {
          setStep(5);
        }
      } catch { /* sesión inválida: empezar de cero */ limpiarSesionLocal(); }
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
      const s = await iniciarAlta(datos, token);
      setSess(s); setFolio(s.folio);
      return s;
    } finally { creandoRef.current = false; }
  }, []);

  const persistir = useCallback(async (paso?: string, extra?: AltaDatos) => {
    const datos = { ...form, ...(extra || {}), ...(tipo ? { tipo_agente: tipo } : {}) };
    try {
      setSaving(true);
      const s = await ensureSession(datos);
      await guardarPaso(s, { datos, paso, paso_actual: pasos[step]?.id });
      setLastSaved(new Date());
    } catch (e) { setErrorGlobal((e as Error).message); }
    finally { setSaving(false); }
  }, [form, tipo, step, ensureSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { persistir(); }, 5000);
  }, [persistir]);

  const upd = (campo: keyof AltaDatos, valor: string) => {
    setForm((p) => ({ ...p, [campo]: valor }));
    setErrors((p) => { const n = { ...p }; delete n[campo as string]; return n; });
    triggerAutoSave();
  };

  // ─── Validación por paso ─────────────────────────────────────────────
  function validar(id: string): boolean {
    const e: Record<string, string> = {};
    if (id === 'tipo' && !tipo) e.tipo = 'Elige el tipo de agente';
    if (id === 'datos') {
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
    }
    if (id === 'cedula') {
      if (tipo === 'con_cedula' && !form.cedula?.trim()) e.cedula = 'Cédula requerida';
      if (!form.poliza_rc_numero?.trim()) e.poliza_rc_numero = 'Número de póliza RC requerido';
      if (!form.poliza_rc_aseguradora?.trim()) e.poliza_rc_aseguradora = 'Aseguradora requerida';
    }
    if (id === 'documentos') {
      const faltan = DOCS_OBLIGATORIOS.filter((d) => !docsSubidos.has(d));
      if (tipo === 'con_cedula' && !docsSubidos.has('cedula')) faltan.push('cedula');
      if (faltan.length) e.documentos = `Faltan documentos: ${faltan.length}`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function siguiente() {
    const p = pasos[step];
    if (!validar(p.id)) return;
    await persistir(p.id);
    setStep((s) => Math.min(s + 1, pasos.length - 1));
  }
  const anterior = () => setStep((s) => Math.max(s - 1, 0));

  // ─── Subida de documentos ────────────────────────────────────────────
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

  // ─── Identidad + firma ───────────────────────────────────────────────
  function iniciarPolling(s: AltaSession) {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const r = await reconciliar(s);
        setEstado(r.estado);
        if (['completed', 'rejected', 'human_review', 'needs_retry'].includes(r.estado)) {
          if (pollTimer.current) clearInterval(pollTimer.current);
        }
      } catch { /* reintenta en el próximo tick */ }
    }, 4000);
  }

  async function iniciarVerificacion() {
    setEnviando(true); setErrorGlobal(null);
    try {
      const s = await ensureSession({ ...form, ...(tipo ? { tipo_agente: tipo } : {}) });
      await guardarPaso(s, { datos: { ...form, ...(tipo ? { tipo_agente: tipo } : {}) } });
      const r = await enviarACincel(s);
      setEstado('identity_pending');
      if (r.signUrl) window.open(r.signUrl, '_blank', 'noopener');
      iniciarPolling(s);
    } catch (e) { setErrorGlobal((e as Error).message); }
    finally { setEnviando(false); }
  }

  // ─── Render ──────────────────────────────────────────────────────────
  const p = pasos[step];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-gray-950 dark:to-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold" style={{ background: MARCA }}>M</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Alta de agente · MOVI</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Proceso guiado, seguro y en pocos minutos.</p>
          </div>
          {folio && <span className="ml-auto text-[11px] font-mono text-gray-400">{folio}</span>}
        </div>

        {estado === 'completed' ? (
          <Exito folio={folio} />
        ) : (
          <>
            {/* Progreso */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
              <div className="flex items-center justify-between gap-1 overflow-x-auto">
                {pasos.map((ps, idx) => {
                  const Icon = ps.icon; const activo = idx === step; const hecho = idx < step;
                  return (
                    <button key={ps.id} onClick={() => idx <= step && setStep(idx)} disabled={idx > step}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        activo ? 'text-white' : hecho ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'
                      }`} style={activo ? { background: MARCA } : undefined}>
                      {hecho ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{ps.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / pasos.length) * 100}%`, background: MARCA }} />
              </div>
            </div>

            {/* Contenido */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-4">
              {p.id === 'tipo' && <PasoTipo tipo={tipo} setTipo={(t) => { setTipo(t); setErrors({}); triggerAutoSave(); }} error={errors.tipo} />}
              {p.id === 'datos' && <PasoDatos tipo={tipo} form={form} errors={errors} upd={upd} />}
              {p.id === 'fiscal' && <PasoFiscal form={form} errors={errors} upd={upd} />}
              {p.id === 'cedula' && <PasoCedula tipo={tipo} form={form} errors={errors} upd={upd} />}
              {p.id === 'documentos' && (
                <PasoDocumentos tipo={tipo} docsSubidos={docsSubidos} subiendo={subiendo} onFile={onFile} error={errors.documentos} />
              )}
              {p.id === 'verificacion' && (
                <PasoVerificacion estado={estado} enviando={enviando} onIniciar={iniciarVerificacion} onReintentar={() => session && iniciarVerificacion()} />
              )}
            </div>

            {errorGlobal && (
              <div className="flex items-start gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{errorGlobal}</span>
              </div>
            )}

            {/* Navegación */}
            {p.id !== 'verificacion' && (
              <div className="flex items-center justify-between">
                <button onClick={anterior} disabled={step === 0}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40">
                  <ArrowLeft className="w-4 h-4" /> Atrás
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : lastSaved ? <Check className="w-3 h-3 text-emerald-500" /> : null}
                    {lastSaved ? `Guardado ${lastSaved.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </span>
                  <button onClick={siguiente} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg" style={{ background: MARCA }}>
                    {step === pasos.length - 2 ? 'Ir a verificación' : 'Siguiente'} <ArrowRight className="w-4 h-4" />
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

// ─── Sub-componentes de paso ───────────────────────────────────────────

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

function PasoTipo({ tipo, setTipo, error }: { tipo: AltaTipo | null; setTipo: (t: AltaTipo) => void; error?: string }) {
  const opciones: { v: AltaTipo; t: string; d: string }[] = [
    { v: 'con_cedula', t: 'Agente con Cédula', d: 'Ya cuentas con tu cédula de agente vigente ante la CNSF.' },
    { v: 'en_desarrollo', t: 'Agente en Desarrollo', d: 'Aún no tienes cédula. Inicias tu desarrollo con nosotros.' },
  ];
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">¿Qué tipo de agente eres?</h2>
      {opciones.map((o) => (
        <button key={o.v} onClick={() => setTipo(o.v)}
          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
            tipo === o.v ? 'border-[#164281] bg-[#164281]/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full border-2 ${tipo === o.v ? 'border-[#164281] bg-[#164281]' : 'border-gray-300'}`} />
            <span className="font-medium text-gray-900 dark:text-white">{o.t}</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">{o.d}</p>
        </button>
      ))}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function PasoDatos({ tipo, form, errors, upd }: { tipo: AltaTipo | null; form: AltaDatos; errors: Record<string, string>; upd: (c: keyof AltaDatos, v: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Tus datos</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <Campo label="Nombre(s)" req error={errors.nombre}><input className={inputCls(!!errors.nombre)} value={form.nombre || ''} onChange={(e) => upd('nombre', e.target.value)} /></Campo>
        <Campo label="Apellidos" req error={errors.apellidos}><input className={inputCls(!!errors.apellidos)} value={form.apellidos || ''} onChange={(e) => upd('apellidos', e.target.value)} /></Campo>
        <Campo label="Correo electrónico" req error={errors.email}><input type="email" className={inputCls(!!errors.email)} value={form.email || ''} onChange={(e) => upd('email', e.target.value)} /></Campo>
        <Campo label="WhatsApp (10 dígitos)" req error={errors.whatsapp}><input inputMode="numeric" className={inputCls(!!errors.whatsapp)} value={form.whatsapp || ''} onChange={(e) => upd('whatsapp', e.target.value)} /></Campo>
        {/* El RFC solo se solicita para Agente con Cédula. */}
        {tipo === 'con_cedula' && (
          <Campo label="RFC" req error={errors.rfc}><input className={inputCls(!!errors.rfc)} value={form.rfc || ''} onChange={(e) => upd('rfc', e.target.value.toUpperCase())} /></Campo>
        )}
        <Campo label="CURP"><input className={inputCls()} value={form.curp || ''} onChange={(e) => upd('curp', e.target.value.toUpperCase())} /></Campo>
        <Campo label="Fecha de nacimiento"><input type="date" className={inputCls()} value={form.fecha_nacimiento || ''} onChange={(e) => upd('fecha_nacimiento', e.target.value)} /></Campo>
        <Campo label="Teléfono fijo (opcional)"><input inputMode="numeric" className={inputCls()} value={form.telefono || ''} onChange={(e) => upd('telefono', e.target.value)} /></Campo>
      </div>
    </div>
  );
}

function PasoFiscal({ form, errors, upd }: { form: AltaDatos; errors: Record<string, string>; upd: (c: keyof AltaDatos, v: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Datos fiscales y bancarios</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <Campo label="Razón social (o tu nombre)"><input className={inputCls()} value={form.razon_social || ''} onChange={(e) => upd('razon_social', e.target.value)} /></Campo>
        <Campo label="Régimen fiscal" req error={errors.regimen_fiscal}><input className={inputCls(!!errors.regimen_fiscal)} value={form.regimen_fiscal || ''} onChange={(e) => upd('regimen_fiscal', e.target.value)} /></Campo>
        <Campo label="Código postal fiscal" req error={errors.codigo_postal_fiscal}><input inputMode="numeric" className={inputCls(!!errors.codigo_postal_fiscal)} value={form.codigo_postal_fiscal || ''} onChange={(e) => upd('codigo_postal_fiscal', e.target.value)} /></Campo>
        <Campo label="Banco" req error={errors.banco}><input className={inputCls(!!errors.banco)} value={form.banco || ''} onChange={(e) => upd('banco', e.target.value)} /></Campo>
        <Campo label="CLABE interbancaria (18 dígitos)" req error={errors.clabe}><input inputMode="numeric" className={inputCls(!!errors.clabe)} value={form.clabe || ''} onChange={(e) => upd('clabe', e.target.value)} /></Campo>
        <Campo label="Número de cuenta (opcional)"><input inputMode="numeric" className={inputCls()} value={form.cuenta_banco || ''} onChange={(e) => upd('cuenta_banco', e.target.value)} /></Campo>
      </div>
    </div>
  );
}

function PasoCedula({ tipo, form, errors, upd }: { tipo: AltaTipo | null; form: AltaDatos; errors: Record<string, string>; upd: (c: keyof AltaDatos, v: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{tipo === 'con_cedula' ? 'Cédula y Póliza de RC' : 'Póliza de Responsabilidad Civil'}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
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

function PasoDocumentos({ tipo, docsSubidos, subiendo, onFile, error }: {
  tipo: AltaTipo | null; docsSubidos: Set<string>; subiendo: string | null;
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
          <label key={d.tipo} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            hecho ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-700 hover:border-[#164281]/50'
          }`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${hecho ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : hecho ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
            </div>
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{d.label}</span>
            <span className="text-xs text-gray-400">{hecho ? 'Cargado' : 'Subir'}</span>
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" disabled={cargando}
              onChange={(e) => onFile(d.tipo, e.target.files?.[0] || null)} />
          </label>
        );
      })}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function PasoVerificacion({ estado, enviando, onIniciar, onReintentar }: {
  estado: AltaEstado | null; enviando: boolean; onIniciar: () => void; onReintentar: () => void;
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
        <button onClick={onReintentar} disabled={enviando} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg" style={{ background: MARCA }}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Reintentar
        </button>
      </div>
    );
  }
  if (enProceso) {
    return (
      <div className="text-center py-6">
        <Loader2 className="w-10 h-10 mx-auto animate-spin mb-3" style={{ color: MARCA }} />
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Verificando identidad y firma…</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Completa el proceso en la ventana que abrimos. Esta pantalla se actualiza sola cuando termines.</p>
      </div>
    );
  }
  return (
    <div className="text-center py-6">
      <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: `${MARCA}15`, color: MARCA }}><ShieldCheck className="w-7 h-7" /></div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">Verificación de identidad y firma del contrato</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">En un solo paso validamos tu identidad (INE + selfie) y firmas tu contrato con validez legal. Es rápido y seguro.</p>
      <button onClick={onIniciar} disabled={enviando} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg" style={{ background: MARCA }}>
        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Iniciar verificación y firma
      </button>
    </div>
  );
}

function Exito({ folio }: { folio: string | null }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center shadow-sm">
      <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
        <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¡Bienvenido a MOVI!</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Tu alta como agente quedó completa. Te enviamos un correo de bienvenida con los siguientes pasos para ingresar a la plataforma.</p>
      {folio && <div className="inline-block bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-2 text-sm"><span className="text-gray-500">Folio: </span><span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{folio}</span></div>}
    </div>
  );
}
