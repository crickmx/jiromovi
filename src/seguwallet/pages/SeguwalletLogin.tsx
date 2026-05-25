import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { seguwalletSignIn } from '../lib/seguwalletAuth';
import { cn } from '@/lib/utils';

const LOGO_URL = 'https://movi.digital/wp-content/uploads/2025/12/moviRecurso-5.png';

export function SeguwalletLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await seguwalletSignIn(email.trim(), password);
      navigate('/seguwallet/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid')) {
        setError('Correo o contraseña incorrectos.');
      } else if (msg.includes('blocked') || msg.includes('disabled') || msg.includes('banned')) {
        setError('Tu cuenta está inactiva. Contacta a tu agente.');
      } else {
        setError(msg || 'Error al iniciar sesión. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setForgotSent(true);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0a1628 0%, #0e2050 40%, #0d1f4a 70%, #07101f 100%)',
      }}
    >
      {/* Background decorative blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #1a56db 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)' }}
        />
      </div>

      {/* Spacer top */}
      <div className="flex-1" />

      {/* ── Main card ── */}
      <main className="relative z-10 w-full flex flex-col items-center px-5 py-8">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div
            className="rounded-2xl p-3 mb-1"
            style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}
          >
            <img
              src={LOGO_URL}
              alt="MOVI Digital"
              className="h-14 w-auto object-contain"
              style={{ maxWidth: '160px' }}
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
            Bienvenido
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: 'rgba(148,185,255,0.8)' }}>
            Accede a tu wallet de seguros
          </p>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-sm rounded-3xl p-7 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Error */}
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5',
              }}
            >
              {error}
            </div>
          )}

          {forgotMode ? (
            forgotSent ? (
              <div className="text-center py-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
                >
                  <Mail className="w-7 h-7" style={{ color: '#86efac' }} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Revisa tu correo</h3>
                <p className="text-sm mb-6" style={{ color: 'rgba(148,185,255,0.75)' }}>
                  Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.
                </p>
                <button
                  onClick={() => { setForgotMode(false); setForgotSent(false); setError(''); }}
                  className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                  }}
                >
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-5" noValidate>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Recuperar contraseña</h3>
                  <p className="text-xs mb-4" style={{ color: 'rgba(148,185,255,0.7)' }}>
                    Ingresa tu correo y te enviaremos un enlace para restablecerla.
                  </p>
                  <div className="relative">
                    <Mail
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: 'rgba(148,185,255,0.5)' }}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm text-white placeholder:text-[rgba(148,185,255,0.35)] outline-none transition-all duration-200 focus:ring-1"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: loading ? 'rgba(59,130,246,0.5)' : 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(29,78,216,0.4)',
                  }}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Enviar enlace'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(''); }}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all duration-200"
                  style={{ color: 'rgba(148,185,255,0.7)' }}
                >
                  Cancelar
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'rgba(148,185,255,0.7)' }}>
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'rgba(148,185,255,0.4)' }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm text-white placeholder:text-[rgba(148,185,255,0.3)] outline-none transition-all duration-200 focus:ring-1"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.10)',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid rgba(59,130,246,0.5)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold mb-2 tracking-wide" style={{ color: 'rgba(148,185,255,0.7)' }}>
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'rgba(148,185,255,0.4)' }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3.5 rounded-2xl text-sm text-white placeholder:text-[rgba(148,185,255,0.3)] outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.10)',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.border = '1px solid rgba(59,130,246,0.5)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: 'rgba(148,185,255,0.45)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.85)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.45)')}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white mt-2',
                  'transition-all duration-200 active:scale-[0.98]',
                  'disabled:opacity-60 disabled:cursor-not-allowed'
                )}
                style={{
                  background: loading
                    ? 'rgba(59,130,246,0.5)'
                    : 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                  boxShadow: loading ? 'none' : '0 4px 24px rgba(29,78,216,0.45)',
                }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Iniciar sesión'
                )}
              </button>
            </form>
          )}

          {/* Forgot password link */}
          {!forgotMode && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(''); }}
                className="text-xs font-semibold transition-colors"
                style={{ color: 'rgba(148,185,255,0.65)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,185,255,1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.65)')}
              >
                Olvidé mi contraseña
              </button>
            </div>
          )}
        </div>

        {/* Bottom note */}
        <p className="mt-6 text-center text-[11px]" style={{ color: 'rgba(148,185,255,0.35)' }}>
          Portal exclusivo para clientes asegurados.
        </p>
      </main>

      {/* Spacer bottom */}
      <div className="flex-1" />

      {/* ── Footer ── */}
      <footer className="relative z-10 w-full py-5 px-6 text-center">
        <p className="text-[11px]" style={{ color: 'rgba(148,185,255,0.35)' }}>
          Powered by{' '}
          <a
            href="https://movi.digital"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold transition-colors"
            style={{ color: 'rgba(148,185,255,0.55)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.9)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.55)')}
          >
            MOVI Digital
          </a>
          {' · '}
          <a
            href="https://grupojiro.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold transition-colors"
            style={{ color: 'rgba(148,185,255,0.55)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.9)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.55)')}
          >
            Grupo JIRO
          </a>
        </p>
      </footer>
    </div>
  );
}
