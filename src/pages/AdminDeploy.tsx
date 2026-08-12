import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshCw, Rocket, Clock, CircleCheck as CheckCircle2, CircleX as XCircle } from 'lucide-react';

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

  useEffect(() => { loadHistorial(); }, []);

  const disparar = async (target: 'beta' | 'produccion') => {
    const label = target === 'beta' ? 'beta.movi.digital' : 'producción (movi.digital)';
    if (!confirm(`¿Actualizar ${label} ahora? Esto jala el último código de GitHub y reconstruye el sitio para todos los usuarios.`)) return;

    setLoading(target);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesión no válida');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ target }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Error desconocido');

      showToast(`Deploy de ${label} disparado correctamente`);
      loadHistorial();
    } catch (err: any) {
      showToast('Error al disparar el deploy: ' + err.message, 'error');
    } finally {
      setLoading(null);
    }
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
          className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-white/10 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          <RefreshCw className={`w-8 h-8 text-purple-500 ${loading === 'beta' ? 'animate-spin' : ''}`} />
          <span className="font-bold text-neutral-800 dark:text-white">Actualizar Beta</span>
          <span className="text-xs text-neutral-400">beta.movi.digital</span>
        </button>
        <button
          onClick={() => disparar('produccion')}
          disabled={loading !== null}
          className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-white/10 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          <Rocket className={`w-8 h-8 text-emerald-500 ${loading === 'produccion' ? 'animate-spin' : ''}`} />
          <span className="font-bold text-neutral-800 dark:text-white">Actualizar Producción</span>
          <span className="text-xs text-neutral-400">movi.digital</span>
        </button>
      </div>

      {historial.length > 0 && (
        <div className="max-w-2xl">
          <h3 className="text-sm font-bold text-neutral-500 dark:text-white/50 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Últimos disparos
          </h3>
          <div className="bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-white/10 rounded-xl divide-y divide-neutral-100 dark:divide-white/5">
            {historial.map(h => (
              <div key={h.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                {h.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                <span className="font-semibold capitalize">{h.target}</span>
                <span className="text-neutral-400 text-xs truncate flex-1">{h.usuarios?.nombre_completo ?? 'Usuario'}</span>
                <span className="text-neutral-400 text-xs shrink-0">
                  {new Date(h.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
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
