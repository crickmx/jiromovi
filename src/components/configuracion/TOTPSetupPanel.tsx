import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldOff, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateSecret, buildOtpUri, verifyTOTP } from '../../lib/totp';
import { useMoviAuth as useAuth } from '../../contexts/MoviAuthContext';

type Step = 'idle' | 'setup' | 'verify' | 'done';

export default function TOTPSetupPanel() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activo, setActivo] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [secret, setSecret] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [code, setCode] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { checkExisting(); }, [usuario?.id]);

  async function checkExisting() {
    if (!usuario?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('usuario_totp_secrets')
      .select('verificado')
      .eq('user_id', usuario.id)
      .maybeSingle();
    setActivo(data?.verificado === true);
    setLoading(false);
  }

  async function iniciarSetup() {
    const s = generateSecret();
    setSecret(s);
    const email = (usuario as any)?.email ?? usuario?.id ?? 'usuario';
    const uri = buildOtpUri(s, email);
    const url = await QRCode.toDataURL(uri, { width: 200, margin: 1 });
    setQrUrl(url);
    setStep('setup');
    setErrMsg('');
    setCode('');
  }

  function pasarAVerificar() {
    setStep('verify');
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function confirmar() {
    if (code.length !== 6) { setErrMsg('Ingresa los 6 dígitos'); return; }
    setSaving(true);
    setErrMsg('');

    const ok = await verifyTOTP(secret, code);
    if (!ok) { setErrMsg('Código incorrecto, intenta de nuevo'); setSaving(false); return; }

    const { error } = await supabase
      .from('usuario_totp_secrets')
      .upsert({ user_id: usuario?.id, encrypted_secret: secret, verificado: true }, { onConflict: 'user_id' });

    setSaving(false);
    if (error) { setErrMsg('Error al guardar, intenta de nuevo'); return; }
    setActivo(true);
    setStep('done');
  }

  async function revocar() {
    if (!confirm('¿Desactivar el autenticador? Perderás acceso a reportes cifrados.')) return;
    await supabase.from('usuario_totp_secrets').delete().eq('user_id', usuario?.id);
    setActivo(false);
    setStep('idle');
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-neutral-400 py-2">
      <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
    </div>
  );

  // ── Idle / Done ────────────────────────────────────────────────────────────
  if (step === 'idle' || step === 'done') return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activo ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
          {activo
            ? <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            : <ShieldOff className="w-5 h-5 text-neutral-400" />}
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
            {activo ? 'Autenticador configurado' : 'Autenticador no configurado'}
          </p>
          <p className="text-xs text-neutral-500">
            {activo
              ? 'Puedes ver reportes cifrados en trámites asignados.'
              : 'Necesario para descifrar reportes protegidos.'}
          </p>
        </div>
      </div>

      {step === 'done' && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Autenticador activado correctamente.
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={iniciarSetup}
          className="px-4 py-2 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-700 transition-colors"
        >
          {activo ? 'Reconfigurar' : 'Configurar autenticador'}
        </button>
        {activo && (
          <button onClick={revocar} className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
            Desactivar
          </button>
        )}
      </div>
    </div>
  );

  // ── Setup (QR) ─────────────────────────────────────────────────────────────
  if (step === 'setup') return (
    <div className="space-y-4 max-w-sm">
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Escanea este código con <strong>Microsoft Authenticator</strong> u otra app TOTP.
      </p>
      <div className="flex justify-center p-3 bg-white rounded-xl border border-neutral-200 dark:border-neutral-700 w-fit">
        {qrUrl && <img src={qrUrl} alt="QR TOTP" width={200} height={200} />}
      </div>
      <details className="text-xs text-neutral-500">
        <summary className="cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300">Ingresar clave manualmente</summary>
        <p className="mt-2 font-mono bg-neutral-100 dark:bg-neutral-800 rounded-lg px-3 py-2 break-all select-all">{secret}</p>
      </details>
      <button onClick={pasarAVerificar} className="w-full py-2.5 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-700 transition-colors">
        Ya escaneé — ingresar código
      </button>
      <button onClick={() => setStep('idle')} className="w-full text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
        Cancelar
      </button>
    </div>
  );

  // ── Verify ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-sm">
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Ingresa el código de 6 dígitos que muestra tu app para confirmar la configuración.
      </p>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErrMsg(''); }}
        onKeyDown={e => e.key === 'Enter' && confirmar()}
        placeholder="000000"
        className="w-full text-center text-2xl font-mono tracking-[0.5em] px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
      {errMsg && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />{errMsg}
        </div>
      )}
      <button
        onClick={confirmar}
        disabled={code.length !== 6 || saving}
        className="w-full py-2.5 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Verificando…</> : 'Confirmar'}
      </button>
      <button onClick={() => setStep('setup')} className="w-full text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
        Volver al QR
      </button>
    </div>
  );
}
