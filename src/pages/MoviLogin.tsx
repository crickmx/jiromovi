import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

function BackgroundLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #040c1f 0%, #061428 40%, #081a38 60%, #04101f 100%)',
      }} />
      <div className="absolute -top-56 -right-56 w-[700px] h-[700px] rounded-full" style={{
        background: 'radial-gradient(circle, #0D6EFD 0%, transparent 65%)',
        opacity: 0.12,
        animation: 'movi-pulse 10s ease-in-out infinite',
      }} />
      <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full" style={{
        background: 'radial-gradient(circle, #0047bb 0%, transparent 65%)',
        opacity: 0.1,
        animation: 'movi-pulse 14s ease-in-out infinite 3s',
      }} />
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />
    </div>
  );
}

export default function MoviLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError('Correo o contraseña incorrectos. Verifica tus datos.');
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  }

  const inputBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'white',
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgba(13,110,253,0.6)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.15)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = inputBase.border as string;
    e.currentTarget.style.background = inputBase.background as string;
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        <BackgroundLayer />

        <div className="relative z-10 flex flex-1 min-h-screen">

          {/* LEFT COLUMN */}
          <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col items-start justify-between px-16 xl:px-24 py-14">
            <div className="flex items-center gap-3">
              <img src="/logojiro.png" alt="MOVI Digital" className="h-10 w-auto" />
            </div>

            <div className="max-w-md">
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-4"
                style={{ color: 'rgba(13,110,253,0.8)' }}>
                Plataforma de gestión
              </p>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                El sistema<br />digital para<br />
                <span style={{ background: 'linear-gradient(90deg, #0D6EFD, #00c8e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  agentes de seguros
                </span>
              </h1>
              <p className="mt-5 text-base leading-relaxed max-w-sm"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Gestiona polizas, comisiones, clientes y produccion desde un solo lugar.
              </p>

              <div className="mt-10 space-y-4">
                {[
                  'CRM y tramites integrados',
                  'Sincronizacion con SICAS en tiempo real',
                  'Reportes de produccion y comisiones',
                ].map((label, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#0D6EFD' }} />
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/60 transition-colors">grupojiro.com</a>
              <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <span>© {new Date().getFullYear()} MOVI Digital</span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px self-stretch my-12" style={{
            background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent)',
          }} />

          {/* RIGHT COLUMN */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-14 xl:px-20">

            <div className="lg:hidden mb-10 text-center">
              <img src="/logojiro.png" alt="MOVI Digital" className="h-10 w-auto mx-auto mb-2" />
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(13,110,253,0.7)' }}>MOVI Digital</p>
            </div>

            <div className="w-full max-w-[380px]">
              <div className="mb-8">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Iniciar sesión</h2>
                <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Ingresa con tus credenciales de acceso
                </p>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2" style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#fca5a5',
                }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold tracking-wide uppercase"
                    style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full h-12 rounded-2xl text-sm outline-none transition-all duration-200 px-4 placeholder:text-white/20"
                    style={inputBase}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold tracking-wide uppercase"
                    style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-12 rounded-2xl text-sm outline-none transition-all duration-200 pl-4 pr-11 placeholder:text-white/20"
                      style={inputBase}
                      onFocus={onFocus}
                      onBlur={onBlur}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  style={{
                    background: loading ? 'rgba(13,110,253,0.5)' : 'linear-gradient(135deg, #0D6EFD, #0047bb)',
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(13,110,253,0.35)',
                  }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Ingresando...</span>
                    </div>
                  ) : 'Ingresar'}
                </button>
              </form>
            </div>

            <div className="lg:hidden mt-12 text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
              © {new Date().getFullYear()} MOVI Digital · Grupo JIRO
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes movi-pulse {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50%       { opacity: 0.2; transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}
