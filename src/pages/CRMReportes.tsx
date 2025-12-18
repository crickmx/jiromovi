import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, TrendingUp, DollarSign, FileText, Users, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CRMReportes() {
  const navigate = useNavigate();
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [fuenteOrigen, setFuenteOrigen] = useState('');
  const [reporteData, setReporteData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generarReporte = async () => {
    try {
      setLoading(true);

      let query = supabase.from('crm_contactos').select('*');

      if (fechaInicio) query = query.gte('fecha_creacion', fechaInicio);
      if (fechaFin) query = query.lte('fecha_creacion', fechaFin);
      if (fuenteOrigen) query = query.eq('fuente_origen', fuenteOrigen);

      const { data: contactos } = await query;

      const totalContactos = contactos?.length || 0;
      const totalClientes = contactos?.filter((c) => c.estatus === 'Cliente').length || 0;
      const tasaConversion = totalContactos > 0 ? (totalClientes / totalContactos) * 100 : 0;

      const { data: polizas } = await supabase
        .from('crm_polizas')
        .select('prima_total')
        .in('contacto_id', contactos?.map((c) => c.id) || []);

      const primaTotal = polizas?.reduce((sum, p) => sum + parseFloat(p.prima_total as any), 0) || 0;

      const { data: cotizaciones } = await supabase
        .from('crm_cotizaciones')
        .select('id')
        .in('contacto_id', contactos?.map((c) => c.id) || []);

      setReporteData({
        totalContactos,
        totalClientes,
        tasaConversion,
        primaTotal,
        totalCotizaciones: cotizaciones?.length || 0,
        totalPolizas: polizas?.length || 0,
      });
    } catch (error) {
      console.error('Error:', error);
      alert('Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    if (!reporteData) return;

    const csv = `Reporte CRM
Fecha Generación,${new Date().toLocaleDateString('es-MX')}

Métricas Generales
Total Contactos,${reporteData.totalContactos}
Total Clientes,${reporteData.totalClientes}
Tasa Conversión,${reporteData.tasaConversion.toFixed(2)}%
Total Cotizaciones,${reporteData.totalCotizaciones}
Total Pólizas,${reporteData.totalPolizas}
Prima Total,$${reporteData.primaTotal.toLocaleString('es-MX')}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-crm-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/mi-crm')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Volver a Mi CRM
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-primary-600">Reportes y Analíticas</h1>
        <p className="text-gray-600 mt-1">Analiza el desempeño de tu CRM</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuente de Origen</label>
            <input
              type="text"
              value={fuenteOrigen}
              onChange={(e) => setFuenteOrigen(e.target.value)}
              placeholder="Todas"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <button
          onClick={generarReporte}
          disabled={loading}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generando...' : 'Generar Reporte'}
        </button>
      </div>

      {reporteData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Contactos</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{reporteData.totalContactos}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tasa de Conversión</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {reporteData.tasaConversion.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Prima Total</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">
                    ${reporteData.primaTotal.toLocaleString('es-MX')}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Clientes</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{reporteData.totalClientes}</p>
                </div>
                <Users className="h-8 w-8 text-gray-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cotizaciones</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{reporteData.totalCotizaciones}</p>
                </div>
                <FileText className="h-8 w-8 text-orange-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pólizas Emitidas</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{reporteData.totalPolizas}</p>
                </div>
                <FileText className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Exportar Reporte</h2>
              <button
                onClick={exportarCSV}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar CSV
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Exporta los datos del reporte en formato CSV para análisis adicional
            </p>
          </div>
        </>
      )}
    </div>
  );
}
