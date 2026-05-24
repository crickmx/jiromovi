import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { seguwalletSignIn } from '../lib/seguwalletAuth';
import { cn } from '@/lib/utils';

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
      if (err.message?.includes('Invalid login')) {
        setError('Correo o contrasena incorrectos.');
      } else {
        setError(err.message || 'Error al iniciar sesion.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50/40 px-4">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-100/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center shadow-lg shadow-sky-500/20 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Seguwallet</h1>
          <p className="text-sm text-neutral-500 mt-1">Tu wallet de seguros</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-3xl border border-neutral-200/60 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8">
          <h2 className="text-lg font-bold text-neutral-900 mb-1">Iniciar Sesion</h2>
          <p className="text-sm text-neutral-500 mb-6">Accede a tus polizas y documentos</p>

          {error && (
            <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">Correo electronico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition-all"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">Contrasena</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contrasena"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-300",
                "bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600",
                "shadow-lg shadow-sky-500/20 hover:shadow-xl hover:shadow-sky-500/30",
                "disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button className="text-xs text-sky-600 hover:text-sky-700 font-medium hover:underline">
              Olvidaste tu contrasena?
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">
          Portal exclusivo para clientes. Si eres agente, accede desde MOVI.
        </p>
      </div>
    </div>
  );
}
