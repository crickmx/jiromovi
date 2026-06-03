import { useState } from 'react';
import { X, Mail, ArrowRight, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Loader as Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  redirectTo?: string;
}

type Step = 'email' | 'code' | 'success';

export function SELoginModal({ onClose, onSuccess, redirectTo }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  async function handleSendCode() {
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'No se encontró una cuenta con ese correo.');
        return;
      }
      setMaskedEmail(data.masked_email || email);
      setStep('code');
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!code.trim() || code.length < 6) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Código incorrecto. Intenta de nuevo.');
        return;
      }
      if (data.access_token) {
        await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      }
      setStep('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
        if (redirectTo) window.location.href = redirectTo;
      }, 1200);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[#0D6EFD] to-[#00c8e0]" />

        <div className="p-7">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-neutral-900 text-lg leading-tight">Ingresar con MOVI Digital</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Usa tu cuenta MOVI para acceder</p>
            </div>
          </div>

          {step === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                    placeholder="tu@correo.com"
                    autoFocus
                    className="w-full pl-9 pr-4 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <button
                onClick={handleSendCode}
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Enviar código <ArrowRight className="w-4 h-4" /></>}
              </button>
              <p className="text-xs text-neutral-500 text-center">
                Solo para usuarios registrados en MOVI Digital
              </p>
            </div>
          )}

          {step === 'code' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600 bg-blue-50 border border-blue-100 rounded-xl p-3 leading-relaxed">
                Enviamos un código de verificación a <strong>{maskedEmail}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Código de acceso
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-sm text-center font-mono text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length < 6}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verificar código <ArrowRight className="w-4 h-4" /></>}
              </button>
              <button
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="w-full text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                Usar otro correo
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <p className="font-semibold text-neutral-900">Acceso verificado</p>
              <p className="text-sm text-neutral-500">Redirigiendo...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
