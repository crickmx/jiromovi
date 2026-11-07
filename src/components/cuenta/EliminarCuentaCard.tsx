import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * "Eliminar mi cuenta" — requisito de App Store (5.1.1(v)) y Google Play.
 *
 * Manda la solicitud a la edge function `solicitar-eliminacion-cuenta`.
 * En Seguwallet la cuenta queda bloqueada en ese momento y se cierra la sesión;
 * en MOVI la baja la completa un Administrador (la cuenta es de la empresa y
 * lleva comisiones y trámites). En los dos casos el plazo comprometido es 30 días.
 */
interface Props {
  plataforma: 'movi' | 'seguwallet';
  /** Se llama cuando la solicitud quedó registrada (p. ej. para salir). */
  onSolicitada?: (resultado: { cuentaBloqueada: boolean }) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const CONFIRMACION = 'ELIMINAR';

export function EliminarCuentaCard({ plataforma, onSolicitada }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<null | { cuentaBloqueada: boolean }>(null);

  const nombre = plataforma === 'seguwallet' ? 'Seguwallet' : 'MOVI';

  const enviar = async () => {
    setEnviando(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión e inténtalo de nuevo.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/solicitar-eliminacion-cuenta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ plataforma, motivo: motivo.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo enviar la solicitud. Intenta de nuevo.');
      const resultado = { cuentaBloqueada: !!data.cuenta_bloqueada };
      setListo(resultado);
      onSolicitada?.(resultado);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la solicitud.');
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
        <p className="font-bold">Recibimos tu solicitud.</p>
        <p className="mt-1 leading-relaxed">
          {listo.cuentaBloqueada
            ? `Tu cuenta de ${nombre} quedó desactivada y eliminaremos tus datos personales en un plazo máximo de 30 días. Te avisaremos por correo cuando termine.`
            : `Un administrador eliminará tu cuenta de ${nombre} en un plazo máximo de 30 días y te avisará por correo.`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-red-200 bg-white p-6 dark:bg-neutral-800 dark:border-red-900/50">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0 dark:bg-red-900/30">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-neutral-900 dark:text-neutral-100">Eliminar mi cuenta</h4>
          <p className="text-sm text-neutral-500 mt-1 leading-relaxed dark:text-neutral-400">
            Solicita que eliminemos tu cuenta de {nombre} y tus datos personales. Las pólizas y documentos que
            la ley obliga a conservar (por ejemplo, ante la aseguradora o el SAT) se guardan solo por el plazo legal.
          </p>

          {!abierto ? (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Solicitar eliminación
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  {plataforma === 'seguwallet'
                    ? 'Perderás el acceso de inmediato y no podrás recuperar tu cuenta.'
                    : 'Perderás el acceso a MOVI cuando un administrador complete la baja.'}
                </span>
              </div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="eliminar-motivo">
                ¿Nos dices por qué? (opcional)
              </label>
              <textarea
                id="eliminar-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:bg-neutral-900 dark:border-neutral-600"
              />
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="eliminar-confirmacion">
                Escribe <strong>{CONFIRMACION}</strong> para confirmar
              </label>
              <input
                id="eliminar-confirmacion"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 dark:bg-neutral-900 dark:border-neutral-600"
              />
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={enviando || confirmacion.trim().toUpperCase() !== CONFIRMACION}
                  onClick={enviar}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Eliminar mi cuenta
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => { setAbierto(false); setConfirmacion(''); setError(null); }}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
