import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, FileText, Bell } from 'lucide-react';
import { seguwalletSignIn } from '../lib/seguwalletAuth';
import { cn } from '@/lib/utils';

import logoDark from '../assets/logo-dark.svg';

const FEATURES = [
  { icon: ShieldCheck, label: 'Todas tus polizas en un solo lugar' },
  { icon: FileText, label: 'Documentos disponibles en cualquier momento' },
  { icon: Bell, label: 'Avisos de vencimiento y renovacion' },
];

export function SeguwalletLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Ingresa tu correo y contrasena.');
      return;
    }

    setLoading(true);
    try {
      await seguwalletSignIn(email.trim(), password);
      navigate('/seguwallet/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid')) {
        setError('Correo o contrasena incorrectos.');
      } else {
        setError(msg || 'Error al iniciar sesion. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex flex-1 flex-col lg:flex-row">

        {/* ── Left panel (brand) ─────────────────────────────── */}
        <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col relative overflow-hidden bg-[#0E2BB8]">
          {/* Subtle grid texture */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
          {/* Glow orbs */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-16 w-80 h-80 bg-[#3B58F0]/30 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col justify-between h-full px-12 py-12">
            {/* Logo */}
            <div>
              <img src={logoDark} alt="Seguwallet" className="h-16 w-auto" />
            </div>

            {/* Central content */}
            <div>
              <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
                Tu billetera<br />de seguros personal
              </h1>
              <p className="mt-4 text-blue-200 text-base leading-relaxed max-w-sm">
                Accede a todas tus polizas, documentos y coberturas desde un solo lugar, cuando lo necesites.
              </p>

              {/* Features */}
              <ul className="mt-8 space-y-4">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-blue-200" />
                    </div>
                    <span className="text-sm text-blue-100 font-medium">{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Bottom badge */}
            <div className="flex items-center gap-2 text-blue-300/70 text-xs">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Seguro · Privado · Siempre disponible
            </div>
          </div>
        </div>

        {/* ── Right panel (form) ─────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:py-0 relative bg-neutral-50">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#0E2BB8] flex items-center justify-center shadow-lg shadow-blue-900/20 mb-3">
              <img src={logoDark} alt="Seguwallet" className="h-9 w-9 object-contain" />
            </div>
            <span className="text-xl font-extrabold text-[#0E2BB8] tracking-tight">seguwallet</span>
          </div>

          <div className="w-full max-w-sm">
            {/* Heading */}
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Bienvenido</h2>
              <p className="mt-1 text-sm text-neutral-500">Ingresa a tu portal de seguros</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-600 tracking-wide uppercase">
                  Correo electronico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full px-4 py-3 rounded-2xl border border-neutral-200 bg-white text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-600 tracking-wide uppercase">
                  Contrasena
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 rounded-2xl border border-neutral-200 bg-white text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-bold text-white mt-2 transition-all duration-200',
                  'bg-[#0E2BB8] hover:bg-[#0C24A0] active:scale-[0.98]',
                  'shadow-md shadow-blue-900/20 hover:shadow-lg hover:shadow-blue-900/25',
                  'disabled:opacity-60 disabled:cursor-not-allowed'
                )}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Iniciar sesion'
                )}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button className="text-xs text-[#0E2BB8] hover:text-blue-900 font-semibold hover:underline transition-colors">
                Olvidaste tu contrasena?
              </button>
            </div>

            <p className="mt-8 text-center text-[11px] text-neutral-400 leading-relaxed">
              Portal exclusivo para clientes asegurados.<br />
              Si eres agente, accede desde MOVI.
            </p>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 w-full border-t border-neutral-200/60 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-400">
          <span>© {new Date().getFullYear()} Seguwallet. Todos los derechos reservados.</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-neutral-300" />
            Una herramienta de{' '}
            <span className="font-semibold text-neutral-500">MOVI Digital</span>
            {' '}|{' '}
            <span className="font-semibold text-neutral-500">Grupo JIRO</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
