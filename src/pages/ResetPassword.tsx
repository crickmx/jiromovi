import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, Loader as Loader2, Lock, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { describePasswordError, failingRules, isPasswordValid } from '../lib/passwordPolicy';
import PasswordRules, { PasswordStrengthBar } from '../components/PasswordRules';

/**
 * Restablecer contraseña — la pantalla que faltaba.
 *
 * El correo de recuperación (`reset-password-request`) manda al usuario a
 * `/reset-password` con la sesión de recuperación en el enlace. Antes esta ruta
 * no existía: el componente se limitaba a redirigir a `/login` sin dejar al
 * usuario establecer la contraseña, así que quien no podía entrar con su
 * contraseña no tenía forma de arreglarlo desde el navegador.
 *
 * Aquí el enlace se usa tal cual: si supabase-js lo procesó, hay sesión (evento
 * `PASSWORD_RECOVERY`) y basta con escribir la nueva contraseña; si no hay
 * sesión, el enlace expiró y se ofrece pedir otro.
 */
/**
 * El token de recuperación se canjea UNA vez. React monta los efectos dos veces
 * en modo estricto (desarrollo), y un segundo `verifyOtp` con el mismo token
 * contesta "ya usado" y pintaba "el enlace no sirve" aunque el primero hubiera
 * funcionado. Esta marca sobrevive al re-montaje porque vive en el módulo.
 */
let tokenEnCanje: string | null = null;

export function ResetPassword() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<'verificando' | 'listo' | 'sin-enlace' | 'guardado'>('verificando');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Restablecer contraseña · MOVI';
  }, []);

  useEffect(() => {
    let cancelado = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (cancelado) return;
      if (evento === 'PASSWORD_RECOVERY' || (sesion && evento !== 'SIGNED_OUT')) {
        setEstado('listo');
      }
    });

    // Enlace actual: la app recibe `?token_hash=…&type=recovery` y canjea el
    // token por POST. Se hace así porque el enlace directo de Supabase
    // (`/auth/v1/verify?...`) se gasta con la PRIMERA visita: la vista previa de
    // WhatsApp o el escáner del correo lo abren antes que la persona, y al
    // abrirlo de verdad contesta "enlace inválido o expirado". Un GET al token
    // no lo consume; solo lo consume este canje.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');

    if (tokenHash) {
      // Segundo montaje o refresco con el mismo token: ya se canjeó, así que no
      // se repite la llamada; basta con mirar si quedó sesión.
      if (tokenEnCanje === tokenHash) {
        supabase.auth
          .getSession()
          .then(({ data: { session } }) => { if (!cancelado) setEstado(session ? 'listo' : 'sin-enlace'); })
          .catch(() => { if (!cancelado) setEstado('sin-enlace'); });
        return () => { cancelado = true; subscription.unsubscribe(); };
      }
      tokenEnCanje = tokenHash;

      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        .then(async ({ error: err }) => {
          if (cancelado) return;
          // El token fuera de la barra de direcciones: un refresco no puede
          // reintentar un canje ya usado (y la sesión ya está creada).
          window.history.replaceState({}, '', window.location.pathname);
          if (!err) { setEstado('listo'); return; }
          // Si el canje se rechazó pero hay sesión (por ejemplo la acabó de
          // crear el primer montaje), la pantalla sirve igual.
          const { data: { session } } = await supabase.auth.getSession();
          if (cancelado) return;
          setEstado(session ? 'listo' : 'sin-enlace');
        })
        .catch(() => { if (!cancelado) setEstado('sin-enlace'); });
      return () => { cancelado = true; subscription.unsubscribe(); };
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelado) return;
        if (session) { setEstado('listo'); return; }
        // Enlaces antiguos (tokens en el fragmento) los procesa supabase-js al
        // arrancar; si no hay sesión, el enlace no sirve.
        setTimeout(() => {
          if (!cancelado) setEstado((prev) => (prev === 'verificando' ? 'sin-enlace' : prev));
        }, 1500);
      })
      .catch(() => { if (!cancelado) setEstado('sin-enlace'); });

    return () => { cancelado = true; subscription.unsubscribe(); };
  }, []);

  const faltantes = failingRules(newPw);
  const puedeGuardar = isPasswordValid(newPw) && newPw === confirmPw;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isPasswordValid(newPw)) {
      setError(`La contraseña no cumple las reglas: ${faltantes.map((r) => r.label.toLowerCase()).join(', ')}.`);
      return;
    }
    if (newPw !== confirmPw) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({
        password: newPw,
        data: { password_set: true },
      });
      if (err) {
        setError(describePasswordError(err));
        return;
      }
      setEstado('guardado');
    } catch (e) {
      setError(describePasswordError(e as { message?: string }));
    } finally {
      setLoading(false);
    }
  }

  async function irAlLogin() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  const inputCls = 'w-full h-11 rounded-xl text-sm pl-10 pr-11 outline-none border border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all';
  const btnPrimario = 'w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-accent-foreground bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50';

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent/10">
            <Lock className="w-5 h-5 text-accent-ink" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900">Restablecer contraseña</h1>
            <p className="text-xs text-neutral-500">MOVI · Mi Oficina Virtual</p>
          </div>
        </div>

        {estado === 'verificando' && (
          <div className="flex items-center gap-3 text-sm text-neutral-600 py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            Comprobando tu enlace…
          </div>
        )}

        {estado === 'sin-enlace' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-sm">
                Este enlace ya no sirve: expiró o se usó antes. Pide uno nuevo desde el inicio de sesión, en
                «¿Olvidaste tu contraseña?», o entra con Ingreso Express.
              </p>
            </div>
            <Link to="/login" className={btnPrimario}>
              Volver al inicio de sesión
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-center text-neutral-500">
              ¿No tienes contraseña todavía? Ingresa con el código de Ingreso Express desde la pantalla de acceso.
            </p>
          </div>
        )}

        {estado === 'guardado' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-800">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-sm font-medium">
                Contraseña actualizada. Ya puedes iniciar sesión con tu correo y esta contraseña.
              </p>
            </div>
            <button onClick={irAlLogin} className={btnPrimario}>
              Iniciar sesión con mi contraseña
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <Zap className="w-4 h-4" />
              Seguir en la app con esta sesión
            </button>
          </div>
        )}

        {estado === 'listo' && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <p className="text-sm text-neutral-600">
              Escribe tu nueva contraseña. Se usará para entrar con tu correo; el código de Ingreso Express sigue
              funcionando.
            </p>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm font-medium bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Nueva contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className={inputCls}
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  tabIndex={-1}
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthBar value={newPw} className="mt-2" />
            </div>

            <PasswordRules value={newPw} />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repite la contraseña"
                  className={inputCls}
                  autoComplete="new-password"
                />
              </div>
              {confirmPw.length > 0 && confirmPw !== newPw && (
                <p className="text-xs text-red-600">Las dos contraseñas no coinciden.</p>
              )}
            </div>

            <button type="submit" disabled={loading || !puedeGuardar} className={btnPrimario}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar contraseña
            </button>

            <Link to="/login" className="block text-xs text-center text-neutral-500 hover:text-neutral-800 transition-colors">
              Cancelar y volver al inicio de sesión
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
