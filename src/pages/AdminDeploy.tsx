import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshCw, Rocket, Clock, CircleCheck as CheckCircle2, CircleX as XCircle, ShieldCheck, Hammer, TriangleAlert } from 'lucide-react';
import {
  INTERVALO_SONDEO_MS,
  estadoDeBuild, huellaDeBuild, leerVersionPublicada, puedeSeguirse,
  type EstadoBuild, type VersionPublicada,
} from '../lib/deployWatch';

const RECAPTCHA_SITE_KEY =
  ((import.meta.env.VITE_RECAPTCHA_SITE_KEY_MOVI ?? import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '') as string);

interface DeployTrigger {
  id: string;
  target: 'beta' | 'produccion';
  ok: boolean;
  status_code: number | null;
  created_at: string;
  usuarios: { nombre_completo: string } | null;
}

export function AdminDeploy() {
  const [loading, setLoading] = useState<'beta' | 'produccion' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [historial, setHistorial] = useState<DeployTrigger[]>([]);
  const [totpModal, setTotpModal] = useState<{ rcToken: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  // Seguimiento del build: el disparo solo avisa que arrancó, no que terminó.
  const [seguimiento, setSeguimiento] = useState<{
    target: 'beta' | 'produccion';
    huellaPrevia: string | null;
    desde: number;
    transcurridoMs: number;
    estado: EstadoBuild;
    remoto: VersionPublicada | null;
  } | null>(null);
  const [versionActual, setVersionActual] = useState<VersionPublicada | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  };

  const loadHistorial = async () => {
    const { data } = await supabase
      .from('deploy_triggers')
      .select('id, target, ok, status_code, created_at, usuarios:usuario_id(nombre_completo)')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setHistorial(data as unknown as DeployTrigger[]);
  };

  // Sondea /version.json hasta que el commit cambie. Se corta solo al terminar,
  // al agotarse la espera, o si se sale de la pantalla.
  useEffect(() => {
    if (!seguimiento || seguimiento.estado !== 'esperando') return;
    const { huellaPrevia, desde } = seguimiento;
    let vivo = true;

    const revisar = async () => {
      const remoto = await leerVersionPublicada();
      if (!vivo) return;
      const transcurridoMs = Date.now() - desde;
      setSeguimiento(prev => (prev ? {
        ...prev,
        transcurridoMs,
        estado: estadoDeBuild({ huellaPrevia, remoto, transcurridoMs }),
        remoto: remoto ?? prev.remoto,
      } : prev));
    };

    const id = setInterval(revisar, INTERVALO_SONDEO_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [seguimiento?.estado, seguimiento?.desde, seguimiento?.huellaPrevia]);

  useEffect(() => {
    loadHistorial();
    leerVersionPublicada().then(setVersionActual);
    if (!RECAPTCHA_SITE_KEY || document.getElementById('recaptcha-script')) return;
    const s = document.createElement('script');
    s.id = 'recaptcha-script';
    s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    document.head.appendChild(s);
  }, []);

  const getRecaptchaToken = (): Promise<string> => {
    if (!RECAPTCHA_SITE_KEY) return Promise.resolve('');
    return Promise.race([
      new Promise<string>(resolve => {
        const g = (window as any).grecaptcha;
        if (!g) { resolve(''); return; }
        g.ready(() => g.execute(RECAPTCHA_SITE_KEY, { action: 'deploy' }).then(resolve).catch(() => resolve('')));
      }),
      new Promise<string>(resolve => setTimeout(() => resolve(''), 4000)),
    ]);
  };

  const ejecutarDeploy = async (target: 'beta' | 'produccion', rcToken: string, totp: string) => {
    setLoading(target);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión no válida');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ target, recaptchaToken: rcToken, totpCode: totp }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Error desconocido');

      const label = target === 'beta' ? 'beta.movi.digital' : 'producción (movi.digital)';
      showToast(`Deploy de ${label} disparado correctamente`);
      loadHistorial();

      if (puedeSeguirse(target, window.location.hostname)) {
        // La referencia se lee del servidor, no del bundle cargado: esta
        // pestaña puede llevar rato abierta y venir de un build anterior.
        const antes = await leerVersionPublicada();
        setVersionActual(antes);
        setSeguimiento({
          target,
          huellaPrevia: huellaDeBuild(antes),
          desde: Date.now(),
          transcurridoMs: 0,
          estado: 'esperando',
          remoto: antes,
        });
      } else {
        setSeguimiento(null);
      }
    } catch (err: any) {
      showToast('Error al disparar el deploy: ' + err.message, 'error');
    } finally {
      setLoading(null);
    }
  };

  const disparar = async (target: 'beta' | 'produccion') => {
    const label = target === 'beta' ? 'beta.movi.digital' : 'producción (movi.digital)';
    if (!confirm(`¿Actualizar ${label} ahora? Esto jala el último código de GitHub y reconstruye el sitio para todos los usuarios.`)) return;

    setLoading(target);
    const rcToken = await getRecaptchaToken();
    setLoading(null);

    if (target === 'produccion') {
      setTotpCode('');
      setTotpModal({ rcToken });
      return;
    }

    await ejecutarDeploy(target, rcToken, '');
  };

  const confirmarTotp = async () => {
    if (!totpModal || totpCode.length !== 6 || loading !== null) return;
    const { rcToken } = totpModal;
    setTotpModal(null);
    await ejecutarDeploy('produccion', rcToken, totpCode);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deploy"
        description="Actualiza beta o producción jalando el último código y reconstruyendo el sitio — mismo botón 'Pull Updates' de Plesk, disparado desde aquí."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <button
          onClick={() => disparar('beta')}
          disabled={loading !== null}
          className="flex flex-col items-center gap-2 p-6 bg-surface-card dark:bg-neutral-800/50 border border-soft dark:border-white/10 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          <RefreshCw className={`w-8 h-8 text-purple-500 ${loading === 'beta' ? 'animate-spin' : ''}`} />
          <span className="font-bold text-neutral-800 dark:text-white">Actualizar Beta</span>
          <span className="text-xs text-neutral-500">beta.movi.digital</span>
        </button>

        <button
          onClick={() => disparar('produccion')}
          disabled={loading !== null}
          className="flex flex-col items-center gap-2 p-6 bg-surface-card dark:bg-neutral-800/50 border border-soft dark:border-white/10 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          <Rocket className={`w-8 h-8 text-emerald-500 ${loading === 'produccion' ? 'animate-spin' : ''}`} />
          <span className="font-bold text-neutral-800 dark:text-white">Actualizar Producción</span>
          <span className="text-xs text-neutral-500 flex items-center gap-1">
            movi.digital <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </span>
        </button>
      </div>

      {versionActual && (
        <p className="text-xs text-neutral-500 max-w-2xl">
          Ahora mismo este sitio sirve el commit{' '}
          <span className="font-mono text-neutral-500 dark:text-neutral-300">{versionActual.commitHash?.slice(0, 8) ?? '—'}</span>
          {versionActual.buildTimestamp && (
            <> · construido el {new Date(versionActual.buildTimestamp).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
          )}
        </p>
      )}

      {/* Avance del build. Sin esto el único aviso era "disparado", que no dice
          nada de si el sitio ya se reconstruyó. */}
      {seguimiento && (() => {
        const minutos = Math.floor(seguimiento.transcurridoMs / 60000);
        const hora = seguimiento.remoto?.buildTimestamp
          ? new Date(seguimiento.remoto.buildTimestamp).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : null;

        if (seguimiento.estado === 'listo') {
          return (
            <div className="max-w-2xl rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Build terminado</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300/80 mt-0.5">
                  {seguimiento.target === 'beta' ? 'beta.movi.digital' : 'movi.digital'} ya sirve el commit{' '}
                  <span className="font-mono">{seguimiento.remoto?.commitHash?.slice(0, 8) ?? '—'}</span>
                  {hora && <> · {hora}</>}
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Recargar
              </button>
            </div>
          );
        }

        if (seguimiento.estado === 'esperando') {
          return (
            <div className="max-w-2xl rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 px-4 py-3 flex items-start gap-3">
              <Hammer className="w-5 h-5 text-purple-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-purple-800 dark:text-purple-200">
                  Construyendo… <span className="font-normal">({minutos} min)</span>
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-300/80 mt-0.5">
                  Se avisa aquí en cuanto el sitio cambie de commit. Suele tardar entre 2 y 5 minutos; puedes
                  seguir trabajando, esto no se pierde mientras no salgas de la pantalla.
                </p>
              </div>
            </div>
          );
        }

        return (
          <div className="max-w-2xl rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex items-start gap-3">
            <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                {seguimiento.estado === 'sin_respuesta' ? 'El sitio no respondió' : 'El build sigue sin aparecer'}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
                {seguimiento.estado === 'sin_respuesta'
                  ? 'No se pudo leer /version.json. Revisa el sitio directamente.'
                  : 'Pasaron más de 12 minutos y el commit publicado sigue siendo el mismo. Puede que el build haya fallado — revisa el log en Plesk.'}
              </p>
            </div>
          </div>
        );
      })()}

      {historial.length > 0 && (
        <div className="max-w-2xl">
          <h3 className="text-sm font-bold text-neutral-500 dark:text-white/50 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Últimos disparos
          </h3>
          <div className="bg-surface-card dark:bg-neutral-800/50 border border-soft dark:border-white/10 rounded-xl divide-y divide-neutral-100 dark:divide-white/5">
            {historial.map(h => (
              <div key={h.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                {h.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                <span className="font-semibold capitalize">{h.target}</span>
                <span className="text-neutral-500 text-xs truncate flex-1">{h.usuarios?.nombre_completo ?? 'Usuario'}</span>
                <span className="text-neutral-500 text-xs shrink-0">
                  {new Date(h.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal TOTP para producción */}
      {totpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 backdrop-blur-[3px] animate-overlay backdrop-blur-sm">
          <div className="bg-surface-card dark:bg-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-e4 border border-soft dark:border-white/10 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="font-bold text-neutral-800 dark:text-white text-base">Verificación de dos pasos</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Requerida para actualizar producción</p>
              </div>
            </div>

            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Ingresa el código de 6 dígitos de tu aplicación autenticadora (Microsoft Authenticator, Google Authenticator, etc.)
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && confirmarTotp()}
              placeholder="000000"
              className="w-full text-center text-3xl font-mono tracking-[0.5em] border border-neutral-300 dark:border-white/20 rounded-xl px-4 py-3 bg-neutral-50 dark:bg-neutral-700 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
            />

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setTotpModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarTotp}
                disabled={totpCode.length !== 6 || loading !== null}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default AdminDeploy;
