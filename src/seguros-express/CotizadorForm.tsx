import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import UbicacionPicker, { type UbicacionValue, UBICACION_VACIA } from '../components/ubicacion/UbicacionPicker';

const TIPOS_SEGURO = [
  'Auto',
  'Gastos Médicos Mayores',
  'Vida',
  'Hogar',
  'Empresarial / PyME',
  'Otro',
];

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://qhwvuuyjhcennqccgvse.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

// Carga perezosa del script de reCAPTCHA v3 (no está inyectado en index.html).
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
  const grecaptcha = (window as any).grecaptcha;
  if (!RECAPTCHA_SITE_KEY || !grecaptcha) return '';
  return new Promise<string>((resolve) => {
    grecaptcha.ready(() => {
      grecaptcha
        .execute(RECAPTCHA_SITE_KEY, { action: 'submit_lead' })
        .then((token: string) => resolve(token))
        .catch(() => resolve(''));
    });
  });
}

interface Props {
  /** Estilo compacto (para embeber en la landing) o standalone (página /cotizar). */
  onSuccess?: () => void;
}

export default function CotizadorForm({ onSuccess }: Props) {
  useRecaptchaLoader();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [tipoSeguro, setTipoSeguro] = useState('');
  const [ubic, setUbic] = useState<UbicacionValue>(UBICACION_VACIA);
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!nombre.trim() || !telefono.trim()) {
      setErrorMsg('Por favor completa tu nombre y teléfono.');
      return;
    }
    setStatus('sending');
    try {
      const recaptchaToken = await ejecutarRecaptcha();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-express-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // El anon key pasa el gateway de la edge function sin depender de verify_jwt.
          ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        },
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim() || null,
          tipo_seguro_interes: tipoSeguro || null,
          lat: ubic.lat,
          lng: ubic.lng,
          direccion_manual: ubic.direccion_manual,
          ubicacion_metodo: ubic.metodo,
          recaptchaToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo enviar tu solicitud.');
      }
      setStatus('ok');
      onSuccess?.();
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Ocurrió un error. Intenta de nuevo.');
    }
  }

  if (status === 'ok') {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-900/5">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h3 className="mt-4 text-xl font-bold text-slate-900">¡Solicitud recibida!</h3>
        <p className="mt-2 text-slate-600">
          Un asesor cercano te contactará muy pronto. Gracias por confiar en seguros.express.
        </p>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5 sm:p-8">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Nombre completo *</label>
        <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Teléfono *</label>
          <input className={inputCls} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="10 dígitos" inputMode="tel" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Correo</label>
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" type="email" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">¿Qué seguro te interesa?</label>
        <select className={inputCls} value={tipoSeguro} onChange={(e) => setTipoSeguro(e.target.value)}>
          <option value="">Selecciona una opción</option>
          {TIPOS_SEGURO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Tu ubicación</label>
        <p className="mb-2 text-xs text-slate-500">
          Nos ayuda a asignarte un asesor cercano. Puedes usar tu ubicación actual o escribir tu dirección/C.P.
        </p>
        <UbicacionPicker value={ubic} onChange={setUbic} gpsLabel="Usar mi ubicación" />
      </div>

      {errorMsg && <p className="text-sm font-medium text-red-600">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'sending' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {status === 'sending' ? 'Enviando…' : 'Solicitar cotización'}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Tus datos están protegidos. Sólo un asesor te contactará.
      </p>
    </form>
  );
}
