import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { MapPin, Save, Loader2, ShieldAlert, Zap } from 'lucide-react';

// Panel admin de configuración del motor de matching de seguros.express (Parte C.3).

interface Config {
  id: number;
  anillo_km_inicial: number;
  incremento_km: number;
  intervalo_minutos: number;
  tope_maximo_km: number;
  expiracion_minutos_extra: number;
  activo: boolean;
}

const CAMPOS: { key: keyof Config; label: string; help: string; min: number; max: number }[] = [
  { key: 'anillo_km_inicial', label: 'Anillo inicial (km)', help: 'Radio de búsqueda al crear el lead.', min: 1, max: 100 },
  { key: 'incremento_km', label: 'Incremento por paso (km)', help: 'Cuánto crece el radio en cada expansión.', min: 1, max: 100 },
  { key: 'intervalo_minutos', label: 'Intervalo (min)', help: 'Cada cuánto se expande el anillo si nadie lo toma.', min: 1, max: 120 },
  { key: 'tope_maximo_km', label: 'Tope máximo (km)', help: 'Radio máximo antes de avisar a Admin.', min: 1, max: 500 },
  { key: 'expiracion_minutos_extra', label: 'Expiración extra (min)', help: 'Tiempo tras el tope antes de expirar el lead.', min: 1, max: 1440 },
];

export default function AdminSegurosExpress() {
  useEffect(() => { document.title = 'seguros.express · Configuración'; }, []);
  const { usuario } = useMoviAuth();
  const isAdmin = usuario?.rol === 'Administrador';

  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('express_leads_config').select('*').eq('id', 1).maybeSingle();
    if (data) setConfig(data as Config);
    const { data: leads } = await supabase.from('express_leads').select('estado');
    if (leads) {
      const c: Record<string, number> = {};
      for (const l of leads as { estado: string }[]) c[l.estado] = (c[l.estado] || 0) + 1;
      setCounts(c);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) cargar(); else setLoading(false); }, [isAdmin, cargar]);

  async function guardar() {
    if (!config) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('express_leads_config')
        .update({
          anillo_km_inicial: config.anillo_km_inicial,
          incremento_km: config.incremento_km,
          intervalo_minutos: config.intervalo_minutos,
          tope_maximo_km: config.tope_maximo_km,
          expiracion_minutos_extra: config.expiracion_minutos_extra,
          activo: config.activo,
          updated_by: usuario?.id ?? null,
        })
        .eq('id', 1);
      if (error) throw error;
      showToast('Configuración guardada.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Error al guardar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-neutral-400" />
        <h1 className="mt-4 text-xl font-bold text-neutral-900 dark:text-white">Acceso restringido</h1>
        <p className="mt-2 text-neutral-500 dark:text-white/50">Sólo administradores pueden configurar seguros.express.</p>
      </div>
    );
  }

  if (loading || !config) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-sky-500" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white"><Zap className="h-5 w-5" /></div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">seguros.express — Configuración</h1>
          <p className="text-sm text-neutral-500 dark:text-white/50">Motor de matching por cercanía y escalamiento.</p>
        </div>
      </div>

      {/* Resumen de leads */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {['nuevo', 'notificado', 'contactado', 'convertido', 'expirado'].map((est) => (
          <div key={est} className="rounded-xl border border-neutral-200 bg-white p-3 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{counts[est] || 0}</p>
            <p className="text-xs capitalize text-neutral-500 dark:text-white/50">{est}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-white">
            <MapPin className="h-4 w-4 text-sky-600" /> Parámetros del motor
          </h2>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-white/70">
            <input
              type="checkbox"
              checked={config.activo}
              onChange={(e) => setConfig({ ...config, activo: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500"
            />
            Motor activo
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <div key={c.key}>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-white/70">{c.label}</label>
              <input
                type="number"
                min={c.min}
                max={c.max}
                value={config[c.key] as number}
                onChange={(e) => {
                  const v = Math.max(c.min, Math.min(c.max, parseInt(e.target.value) || c.min));
                  setConfig({ ...config, [c.key]: v });
                }}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <p className="mt-1 text-xs text-neutral-400 dark:text-white/35">{c.help}</p>
            </div>
          ))}
        </div>

        <button
          onClick={guardar}
          disabled={saving}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar configuración
        </button>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
