import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Target
} from 'lucide-react';

interface KPIs {
  total_tramites: number;
  total_emitidos: number;
  total_no_emitidos: number;
  total_en_proceso: number;
  tasa_conversion: number | null;
}

interface RankingItem {
  agente_id: string;
  agente_nombre: string;
  oficina_nombre: string;
  total_tramites: number;
  total_emitidos: number;
  total_no_emitidos: number;
  total_en_proceso: number;
  tasa_conversion: number | null;
}

interface Props {
  fechaInicio: string;
  fechaFin: string;
  oficinaId?: string;
  usuarioId?: string;
}

export function ConversionDashboard({ fechaInicio, fechaFin, oficinaId, usuarioId }: Props) {
  const [kpis, setKpis] = useState<KPIs>({
    total_tramites: 0,
    total_emitidos: 0,
    total_no_emitidos: 0,
    total_en_proceso: 0,
    tasa_conversion: 0
  });
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      loadKPIs();
      loadRanking();
    }
  }, [fechaInicio, fechaFin, oficinaId, usuarioId]);

  const loadKPIs = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        p_fecha_inicio: new Date(fechaInicio + 'T00:00:00').toISOString(),
        p_fecha_fin: new Date(fechaFin + 'T23:59:59').toISOString(),
      };
      if (oficinaId) params.p_oficina_id = oficinaId;
      if (usuarioId) params.p_usuario_id = usuarioId;

      const { data, error } = await supabase.rpc('get_conversion_kpis', params);
      if (error) {
        console.error('Error loading conversion KPIs:', error);
        return;
      }
      if (data && data.length > 0) {
        setKpis({
          total_tramites: Number(data[0].total_tramites) || 0,
          total_emitidos: Number(data[0].total_emitidos) || 0,
          total_no_emitidos: Number(data[0].total_no_emitidos) || 0,
          total_en_proceso: Number(data[0].total_en_proceso) || 0,
          tasa_conversion: data[0].tasa_conversion ? Number(data[0].tasa_conversion) : 0
        });
      }
    } catch (error) {
      console.error('Exception loading conversion KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRanking = async () => {
    try {
      const params: Record<string, unknown> = {
        p_fecha_inicio: new Date(fechaInicio + 'T00:00:00').toISOString(),
        p_fecha_fin: new Date(fechaFin + 'T23:59:59').toISOString(),
      };
      if (oficinaId) params.p_oficina_id = oficinaId;

      const { data, error } = await supabase.rpc('get_conversion_ranking', params);
      if (error) {
        console.error('Error loading ranking:', error);
        return;
      }
      if (data) setRanking(data);
    } catch (error) {
      console.error('Exception loading ranking:', error);
    }
  };

  const getTasaColor = (tasa: number | null): string => {
    if (!tasa) return 'text-gray-500';
    if (tasa >= 70) return 'text-green-600';
    if (tasa >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-neutral-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-neutral-900">{kpis.total_tramites}</p>
          <p className="text-xs text-neutral-600 mt-0.5">Total cotizaciones</p>
        </div>

        <div className="bg-neutral-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{kpis.total_emitidos}</p>
          <p className="text-xs text-neutral-600 mt-0.5">Emitidos</p>
        </div>

        <div className="bg-neutral-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">{kpis.total_no_emitidos}</p>
          <p className="text-xs text-neutral-600 mt-0.5">No emitidos</p>
        </div>

        <div className="bg-neutral-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{kpis.total_en_proceso}</p>
          <p className="text-xs text-neutral-600 mt-0.5">En proceso</p>
        </div>

        <div className="bg-neutral-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <p className={`text-2xl font-bold ${getTasaColor(kpis.tasa_conversion)}`}>
            {kpis.tasa_conversion ? `${kpis.tasa_conversion}%` : '0%'}
          </p>
          <p className="text-xs text-neutral-600 mt-0.5">Tasa de conversión</p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-neutral-900 mb-3">Distribución de resultados</h4>
        <div className="space-y-3">
          {[
            { label: 'Emitidos', value: kpis.total_emitidos, color: 'bg-green-600', text: 'text-green-600' },
            { label: 'No emitidos', value: kpis.total_no_emitidos, color: 'bg-red-600', text: 'text-red-600' },
            { label: 'En proceso', value: kpis.total_en_proceso, color: 'bg-amber-500', text: 'text-amber-600' },
          ].map((row) => {
            const pct = kpis.total_tramites > 0 ? Math.round((row.value / kpis.total_tramites) * 100) : 0;
            return (
              <div key={row.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-neutral-700">{row.label}</span>
                  <span className={`text-sm font-semibold ${row.text}`}>{row.value} ({pct}%)</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2.5">
                  <div className={`${row.color} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {ranking.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-neutral-900 mb-3">Ranking de conversión por agente</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">#</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Agente</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Oficina</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-neutral-700">Total</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-green-700">Emitidos</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-red-700">No emit.</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-amber-700">Proceso</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-blue-700">Tasa</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((item, index) => (
                  <tr key={item.agente_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                        index === 0 ? 'bg-amber-100 text-amber-700' :
                        index === 1 ? 'bg-neutral-200 text-neutral-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-neutral-900 font-medium">{item.agente_nombre}</td>
                    <td className="py-2 px-3 text-sm text-neutral-600">{item.oficina_nombre}</td>
                    <td className="py-2 px-3 text-center text-sm font-semibold text-neutral-900">{item.total_tramites}</td>
                    <td className="py-2 px-3 text-center text-sm font-semibold text-green-600">{item.total_emitidos}</td>
                    <td className="py-2 px-3 text-center text-sm font-semibold text-red-600">{item.total_no_emitidos}</td>
                    <td className="py-2 px-3 text-center text-sm font-semibold text-amber-600">{item.total_en_proceso}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        item.tasa_conversion === null ? 'bg-neutral-100 text-neutral-600' :
                        item.tasa_conversion >= 70 ? 'bg-green-100 text-green-700' :
                        item.tasa_conversion >= 40 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.tasa_conversion ? `${item.tasa_conversion}%` : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
