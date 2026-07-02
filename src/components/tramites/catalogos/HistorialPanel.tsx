import { useState, useEffect } from 'react';
import { Clock, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface HistorialEntry {
  id: string;
  accion: string;
  detalles: Record<string, any>;
  usuario_nombre: string | null;
  created_at: string;
}

interface Props {
  tipoId: string;
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  tipo_creado:        { label: 'Tipo creado',               color: 'bg-green-100 text-green-700' },
  config_actualizada: { label: 'Configuración actualizada', color: 'bg-blue-100 text-blue-700' },
  campo_agregado:     { label: 'Campo agregado',            color: 'bg-violet-100 text-violet-700' },
  campo_actualizado:  { label: 'Campo actualizado',         color: 'bg-amber-100 text-amber-700' },
  campo_eliminado:    { label: 'Campo eliminado',           color: 'bg-red-100 text-red-700' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days} día${days !== 1 ? 's' : ''}`;
  return new Date(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DetallesSummary({ accion, detalles }: { accion: string; detalles: Record<string, any> }) {
  if (accion === 'tipo_creado') {
    return <p className="text-xs text-neutral-500 mt-0.5">"{detalles.label}" · {detalles.area}</p>;
  }
  if (accion === 'config_actualizada') {
    const partes: string[] = [];
    if (detalles.label_antes) partes.push(`Nombre: "${detalles.label_antes}" → "${detalles.label_despues}"`);
    if (detalles.area_antes) partes.push(`Área: ${detalles.area_antes} → ${detalles.area_despues}`);
    if (detalles.color_antes) partes.push('Color actualizado');
    if (!partes.length) return null;
    return <p className="text-xs text-neutral-500 mt-0.5">{partes.join(' · ')}</p>;
  }
  if (accion === 'campo_agregado') {
    return <p className="text-xs text-neutral-500 mt-0.5">"{detalles.campo_label}" ({detalles.campo_tipo})</p>;
  }
  if (accion === 'campo_actualizado') {
    if (detalles.label_antes) {
      return <p className="text-xs text-neutral-500 mt-0.5">"{detalles.label_antes}" → "{detalles.label_despues}"</p>;
    }
    return <p className="text-xs text-neutral-500 mt-0.5">Campo: {detalles.campo_key}</p>;
  }
  if (accion === 'campo_eliminado') {
    return (
      <p className="text-xs text-neutral-500 mt-0.5">
        "{detalles.campo_label}"{detalles.tenia_datos ? ' (datos conservados)' : ''}
      </p>
    );
  }
  return null;
}

export function HistorialPanel({ tipoId }: Props) {
  const [entries, setEntries] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('tramite_tipo_historial')
      .select('id, accion, detalles, usuario_nombre, created_at')
      .eq('tramite_tipo_id', tipoId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEntries((data as HistorialEntry[]) || []);
        setLoading(false);
      });
  }, [tipoId]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-neutral-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Clock className="w-8 h-8 text-neutral-300 mb-3" />
        <p className="text-sm font-medium text-neutral-500">Sin registros de actividad</p>
        <p className="text-xs text-neutral-400 mt-1 max-w-xs">
          Los cambios futuros en configuración y campos aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-auto">
      <div className="relative pl-4 space-y-0">
        {/* línea vertical de timeline */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-neutral-200" />

        {entries.map((entry) => {
          const meta = ACTION_META[entry.accion] ?? { label: entry.accion, color: 'bg-neutral-100 text-neutral-600' };
          return (
            <div key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
              {/* dot */}
              <div className="absolute left-[-9px] top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white bg-neutral-300 ring-1 ring-neutral-200 flex-shrink-0" />
              <div className="flex-1 min-w-0 bg-white border border-neutral-100 rounded-xl px-3 py-2.5 shadow-sm">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-neutral-400 whitespace-nowrap">{timeAgo(entry.created_at)}</span>
                </div>
                <DetallesSummary accion={entry.accion} detalles={entry.detalles || {}} />
                {entry.usuario_nombre && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <User className="w-3 h-3 text-neutral-300" />
                    <span className="text-[10px] text-neutral-400">{entry.usuario_nombre}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
