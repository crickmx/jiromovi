import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { Clock, Save } from 'lucide-react';
import { invalidarCacheDiasHabiles } from '../../lib/diasHabiles';

interface Jornada {
  id: string;
  hora_inicio: string;
  hora_fin: string;
  horas_productivas_dia: number;
}

export default function ConfigJornada() {
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('18:00');
  const [horasProducivas, setHorasProductivas] = useState(8);

  useEffect(() => {
    supabase
      .from('configuracion_jornada')
      .select('*')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setJornada(data as Jornada);
          setHoraInicio((data as Jornada).hora_inicio.slice(0, 5));
          setHoraFin((data as Jornada).hora_fin.slice(0, 5));
          setHorasProductivas((data as Jornada).horas_productivas_dia);
        }
        setLoading(false);
      });
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const guardar = async () => {
    if (!jornada) return;
    if (horaFin <= horaInicio) { showToast('La hora de fin debe ser mayor a la de inicio', 'error'); return; }
    if (horasProducivas < 1 || horasProducivas > 24) { showToast('Horas productivas debe estar entre 1 y 24', 'error'); return; }

    setSaving(true);
    const { error } = await supabase
      .from('configuracion_jornada')
      .update({ hora_inicio: horaInicio, hora_fin: horaFin, horas_productivas_dia: horasProducivas, updated_at: new Date().toISOString() })
      .eq('id', jornada.id);

    setSaving(false);
    if (error) { showToast('Error al guardar: ' + error.message, 'error'); return; }
    invalidarCacheDiasHabiles();
    showToast('Configuración guardada correctamente');
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Configuración de Jornada"
        description="Define el horario laboral para el cálculo de días hábiles y SLA"
        icon={Clock}
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3 max-w-lg">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="max-w-lg space-y-6">
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Hora de inicio de jornada
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={e => setHoraInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Hora de fin de jornada
                </label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={e => setHoraFin(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Horas productivas por día
                  <span className="ml-2 text-xs text-neutral-400 font-normal">(tiempo neto de trabajo, sin descansos)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={horasProducivas}
                  onChange={e => setHorasProductivas(Math.max(1, Math.min(24, Number(e.target.value))))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                <p className="mt-1 text-xs text-neutral-400">
                  Ejemplo: jornada 9:00–18:00 con 1 h de comida = 8 horas productivas
                </p>
              </div>
            </div>

            <button
              onClick={guardar}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </button>

            {toast && (
              <div className={`px-4 py-3 rounded-xl text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {toast.msg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
