import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  TrendingUp,
  DollarSign,
  FileText,
  Users,
  ArrowLeft,
  BarChart3,
  PieChart,
  Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ReporteData {
  totalContactos: number;
  totalClientes: number;
  tasaConversion: number;
  primaTotal: number;
  totalCotizaciones: number;
  totalPolizas: number;
  porEstatus: Record<string, number>;
  porFuente: Record<string, number>;
}

export default function CRMReportes() {
  const navigate = useNavigate();
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);
  const [reporteData, setReporteData] = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  useEffect(() => {
    if (!autoLoaded) {
      generarReporte();
      setAutoLoaded(true);
    }
  }, []);

  const generarReporte = async () => {
    try {
      setLoading(true);

      let query = supabase.from('crm_contactos').select('*');
      if (fechaInicio) query = query.gte('fecha_creacion', fechaInicio);
      if (fechaFin) query = query.lte('fecha_creacion', fechaFin + 'T23:59:59');

      const { data: contactos } = await query;

      const totalContactos = contactos?.length || 0;
      const totalClientes = contactos?.filter((c) => c.estatus === 'Cliente').length || 0;
      const tasaConversion = totalContactos > 0 ? (totalClientes / totalContactos) * 100 : 0;

      const porEstatus: Record<string, number> = {};
      contactos?.forEach((c) => {
        porEstatus[c.estatus] = (porEstatus[c.estatus] || 0) + 1;
      });

      const porFuente: Record<string, number> = {};
      contactos?.forEach((c) => {
        const fuente = c.fuente_origen || 'Sin fuente';
        porFuente[fuente] = (porFuente[fuente] || 0) + 1;
      });

      const ids = contactos?.map((c) => c.id) || [];

      const [polizasRes, cotizacionesRes] = await Promise.all([
        ids.length > 0
          ? supabase.from('crm_polizas').select('prima_total').in('contacto_id', ids)
          : Promise.resolve({ data: [] }),
        ids.length > 0
          ? supabase.from('crm_cotizaciones').select('id').in('contacto_id', ids)
          : Promise.resolve({ data: [] }),
      ]);

      const polizas = polizasRes.data || [];
      const primaTotal = polizas.reduce((sum, p) => sum + parseFloat(p.prima_total as any || '0'), 0);

      setReporteData({
        totalContactos,
        totalClientes,
        tasaConversion,
        primaTotal,
        totalCotizaciones: cotizacionesRes.data?.length || 0,
        totalPolizas: polizas.length,
        porEstatus,
        porFuente,
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    if (!reporteData) return;

    const csv = `Reporte CRM\nFecha Generacion,${new Date().toLocaleDateString('es-MX')}\nPeriodo,${fechaInicio} a ${fechaFin}\n\nMetricas Generales\nTotal Contactos,${reporteData.totalContactos}\nTotal Clientes,${reporteData.totalClientes}\nTasa Conversion,${reporteData.tasaConversion.toFixed(2)}%\nTotal Cotizaciones,${reporteData.totalCotizaciones}\nTotal Polizas,${reporteData.totalPolizas}\nPrima Total,$${reporteData.primaTotal.toLocaleString('es-MX')}\n\nPor Estatus\n${Object.entries(reporteData.porEstatus).map(([k, v]) => `${k},${v}`).join('\n')}\n\nPor Fuente\n${Object.entries(reporteData.porFuente).map(([k, v]) => `${k},${v}`).join('\n')}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-crm-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const estatusColors: Record<string, string> = {
    'Prospecto': 'bg-blue-500',
    'Cotización Presentada': 'bg-amber-500',
    'Negociación': 'bg-orange-500',
    'Cliente': 'bg-green-500',
    'Perdido': 'bg-red-400',
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <button
          onClick={() => navigate('/mi-crm')}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-3 transition"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Mi CRM
        </button>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Reportes y Analiticas</h1>
            <p className="text-sm text-gray-500 mt-0.5">Analiza el desempeno de tu CRM</p>
          </div>
          {reporteData && (
            <button
              onClick={exportarCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium shadow-sm"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha Fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={generarReporte}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
          >
            <Filter className="h-4 w-4" />
            {loading ? 'Cargando...' : 'Aplicar'}
          </button>
        </div>
      </div>

      {loading && !reporteData && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
        </div>
      )}

      {reporteData && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            <MetricCard label="Contactos" value={reporteData.totalContactos} icon={<Users className="h-4 w-4" />} color="blue" />
            <MetricCard label="Clientes" value={reporteData.totalClientes} icon={<Users className="h-4 w-4" />} color="green" />
            <MetricCard label="Conversion" value={`${reporteData.tasaConversion.toFixed(1)}%`} icon={<TrendingUp className="h-4 w-4" />} color="emerald" />
            <MetricCard label="Cotizaciones" value={reporteData.totalCotizaciones} icon={<FileText className="h-4 w-4" />} color="orange" />
            <MetricCard label="Polizas" value={reporteData.totalPolizas} icon={<FileText className="h-4 w-4" />} color="teal" />
            <MetricCard label="Prima Total" value={`$${(reporteData.primaTotal / 1000).toFixed(0)}k`} icon={<DollarSign className="h-4 w-4" />} color="blue" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Distribution by Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Distribucion por Estatus</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(reporteData.porEstatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([estatus, count]) => {
                    const pct = reporteData.totalContactos > 0
                      ? Math.round((count / reporteData.totalContactos) * 100)
                      : 0;
                    return (
                      <div key={estatus}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600">{estatus}</span>
                          <span className="text-xs text-gray-500">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${estatusColors[estatus] || 'bg-gray-400'}`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(reporteData.porEstatus).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Sin datos en este periodo</p>
                )}
              </div>
            </div>

            {/* Distribution by Source */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Distribucion por Fuente</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(reporteData.porFuente)
                  .sort(([, a], [, b]) => b - a)
                  .map(([fuente, count]) => {
                    const pct = reporteData.totalContactos > 0
                      ? Math.round((count / reporteData.totalContactos) * 100)
                      : 0;
                    return (
                      <div key={fuente}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600">{fuente}</span>
                          <span className="text-xs text-gray-500">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-400 transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(reporteData.porFuente).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Sin datos en este periodo</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label, value, icon, color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange' | 'emerald' | 'teal';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
  };

  return (
    <div className={`p-3 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] font-medium opacity-80">{label}</span></div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
