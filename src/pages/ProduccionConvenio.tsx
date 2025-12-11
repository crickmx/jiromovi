import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Award, Download, Filter, Settings, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import GraficaColumnas from '../components/comisiones/GraficaColumnas';
import GraficaCircular from '../components/comisiones/GraficaCircular';
import GraficaLinea from '../components/produccion/GraficaLinea';
import GraficaColumnasAgrupadas from '../components/produccion/GraficaColumnasAgrupadas';

interface ProductionRecord {
  id: string;
  fecha: string;
  periodo_mes: string;
  desp_nombre_raw: string;
  gerencia_nombre_raw: string;
  region_raw: string | null;
  agente_nombre: string;
  aseguradora_nombre: string;
  ramo_nombre: string;
  subramo_nombre: string | null;
  prima_convenio: number;
  prima_ponderada: number;
  bono: number;
  porcentaje_bono: number | null;
}

export default function ProduccionConvenio() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastImport, setLastImport] = useState<any>(null);

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    management: '',
    office: '',
    agent: '',
    ramo: '',
    subramo: '',
    aseguradora: '',
  });

  const [offices, setOffices] = useState<string[]>([]);
  const [managements, setManagements] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [ramos, setRamos] = useState<string[]>([]);
  const [aseguradoras, setAseguradoras] = useState<string[]>([]);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadData();
  }, [usuario]);

  useEffect(() => {
    applyFilters();
  }, [records, filters]);

  const loadData = async () => {
    if (!usuario) {
      console.log('[ProduccionConvenio] No hay usuario');
      return;
    }

    console.log('[ProduccionConvenio] Iniciando carga de datos...');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-production-sheets?convenio_only=true`;

      console.log('[ProduccionConvenio] Llamando a:', apiUrl);

      const headers = {
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, { headers });

      console.log('[ProduccionConvenio] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ProduccionConvenio] Error response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Error al obtener datos de Google Sheets');
        } catch (e) {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }

      const result = await response.json();
      console.log('[ProduccionConvenio] Result:', { success: result.success, total: result.total, hasRecords: !!result.records });

      if (!result.success) {
        throw new Error(result.error || 'Error desconocido');
      }

      if (!result.records || !Array.isArray(result.records)) {
        throw new Error('No se recibieron registros del servidor');
      }

      console.log('[ProduccionConvenio] Procesando', result.records.length, 'registros...');

      let processedData = result.records.map((record: any) => ({
        id: `${record.fecha}-${record.agente_nombre}-${Math.random()}`,
        ...record,
        prima_convenio: Number(record.prima_convenio) || 0,
        prima_ponderada: Number(record.prima_ponderada) || 0,
        bono: Number(record.bono) || 0,
        porcentaje_bono: record.porcentaje_bono ? Number(record.porcentaje_bono) : null,
      }));

      console.log('[ProduccionConvenio] Datos procesados:', processedData.length);

      if (usuario.rol === 'Gerente' && usuario.production_office_id) {
        const { data: office } = await supabase
          .from('oficinas')
          .select('nombre')
          .eq('id', usuario.production_office_id)
          .maybeSingle();

        if (office) {
          const beforeFilter = processedData.length;
          processedData = processedData.filter((r: any) => r.desp_nombre_raw === office.nombre);
          console.log('[ProduccionConvenio] Filtrado por oficina:', beforeFilter, '→', processedData.length);
        }
      }

      setRecords(processedData);
      console.log('[ProduccionConvenio] Records establecidos en state:', processedData.length);

      const uniqueOffices = [...new Set(processedData.map((r: any) => r.desp_nombre_raw).filter(Boolean))] as string[];
      const uniqueManagements = [...new Set(processedData.map((r: any) => r.gerencia_nombre_raw).filter(Boolean))] as string[];
      const uniqueAgents = [...new Set(processedData.map((r: any) => r.agente_nombre).filter(Boolean))] as string[];
      const uniqueRamos = [...new Set(processedData.map((r: any) => r.ramo_nombre).filter(Boolean))] as string[];
      const uniqueAseguradoras = [...new Set(processedData.map((r: any) => r.aseguradora_nombre).filter(Boolean))] as string[];

      setOffices(uniqueOffices.sort());
      setManagements(uniqueManagements.sort());
      setAgents(uniqueAgents.sort());
      setRamos(uniqueRamos.sort());
      setAseguradoras(uniqueAseguradoras.sort());

      setLastImport({ imported_at: result.fetched_at });

      console.log('[ProduccionConvenio] Carga completada exitosamente');

    } catch (error: any) {
      console.error('[ProduccionConvenio] Error completo:', error);
      alert('Error al cargar los datos de producción:\n\n' + error.message + '\n\nAbre la consola del navegador (F12) para más detalles.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...records];

    if (filters.dateFrom) {
      filtered = filtered.filter(r => r.fecha >= filters.dateFrom);
    }

    if (filters.dateTo) {
      filtered = filtered.filter(r => r.fecha <= filters.dateTo);
    }

    if (filters.management) {
      filtered = filtered.filter(r =>
        r.gerencia_nombre_raw?.toLowerCase().includes(filters.management.toLowerCase())
      );
    }

    if (filters.office) {
      filtered = filtered.filter(r =>
        r.desp_nombre_raw?.toLowerCase().includes(filters.office.toLowerCase())
      );
    }

    if (filters.agent) {
      filtered = filtered.filter(r =>
        r.agente_nombre?.toLowerCase().includes(filters.agent.toLowerCase())
      );
    }

    if (filters.ramo) {
      filtered = filtered.filter(r =>
        r.ramo_nombre?.toLowerCase().includes(filters.ramo.toLowerCase())
      );
    }

    if (filters.subramo) {
      filtered = filtered.filter(r =>
        r.subramo_nombre?.toLowerCase().includes(filters.subramo.toLowerCase())
      );
    }

    if (filters.aseguradora) {
      filtered = filtered.filter(r =>
        r.aseguradora_nombre?.toLowerCase().includes(filters.aseguradora.toLowerCase())
      );
    }

    setFilteredRecords(filtered);
  };

  const calculateKPIs = () => {
    const totalConvenio = filteredRecords.reduce((sum, r) => sum + (r.prima_convenio || 0), 0);
    const totalPonderada = filteredRecords.reduce((sum, r) => sum + (r.prima_ponderada || 0), 0);
    const totalBono = filteredRecords.reduce((sum, r) => sum + (r.bono || 0), 0);

    const relacion = totalConvenio > 0 ? (totalPonderada / totalConvenio) : 0;

    return {
      totalConvenio,
      totalPonderada,
      totalBono,
      recordsCount: filteredRecords.length,
      relacion
    };
  };

  const exportToExcel = () => {
    const dataToExport = filteredRecords.map(r => ({
      'Fecha': r.fecha,
      'Dirección Regional': r.region_raw || '',
      'Gerencia': r.gerencia_nombre_raw || '',
      'Oficina': r.desp_nombre_raw || '',
      'Agente': r.agente_nombre,
      'Aseguradora': r.aseguradora_nombre,
      'Ramo': r.ramo_nombre,
      'Subramo': r.subramo_nombre || '',
      'Prima Convenio': r.prima_convenio,
      'Prima Ponderada': r.prima_ponderada,
      'Bono': r.bono,
      '% Bono': r.porcentaje_bono || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producción Convenio');
    XLSX.writeFile(wb, `Produccion_Convenio_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const chartDataByAseguradora = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, r) => {
      const aseg = r.aseguradora_nombre;
      if (!acc[aseg]) acc[aseg] = 0;
      acc[aseg] += r.prima_convenio;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRecords]);

  const chartDataByRamo = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, r) => {
      const ramo = r.ramo_nombre;
      if (!acc[ramo]) acc[ramo] = 0;
      acc[ramo] += r.prima_convenio;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRecords]);

  const chartDataByMonth = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, r) => {
      const month = r.periodo_mes || r.fecha.substring(0, 7);
      if (!acc[month]) acc[month] = 0;
      acc[month] += r.prima_convenio;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredRecords]);

  const chartDataBono = useMemo(() => {
    if (isAdmin) {
      const grouped = filteredRecords.reduce((acc, r) => {
        const office = r.desp_nombre_raw;
        if (!acc[office]) acc[office] = 0;
        acc[office] += r.bono;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
    } else {
      const grouped = filteredRecords.reduce((acc, r) => {
        const agent = r.agente_nombre;
        if (!acc[agent]) acc[agent] = 0;
        acc[agent] += r.bono;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
    }
  }, [filteredRecords, isAdmin]);

  const chartDataComparativo = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, r) => {
      const aseg = r.aseguradora_nombre;
      if (!acc[aseg]) acc[aseg] = { value1: 0, value2: 0 };
      acc[aseg].value1 += r.prima_convenio;
      acc[aseg].value2 += r.prima_ponderada;
      return acc;
    }, {} as Record<string, { value1: number; value2: number }>);

    return Object.entries(grouped)
      .map(([label, { value1, value2 }]) => ({ label, value1, value2 }))
      .sort((a, b) => b.value1 - a.value1)
      .slice(0, 8);
  }, [filteredRecords]);

  const kpis = calculateKPIs();
  const formatCurrency = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-neutral-600 hover:text-primary-600 transition-colors mb-4 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Regresar</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-neutral-900 mb-2">
                Producción Convenio
              </h1>
              <p className="text-neutral-600">
                Métrica base: Prima de convenio (solo registros en convenio)
              </p>
              {lastImport && (
                <p className="text-sm text-neutral-500 mt-1">
                  Datos actualizados al: {new Date(lastImport.imported_at).toLocaleString('es-MX')}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {isAdmin && (
                <button
                  onClick={() => navigate('/produccion/configuracion')}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Settings className="w-4 h-4" />
                  <span>Configuración</span>
                </button>
              )}
              <Award className="w-12 h-12 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-blue-700 mb-1">Prima Convenio</p>
            <p className="text-2xl font-bold text-blue-900">
              ${kpis.totalConvenio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <p className="text-sm text-purple-700 mb-1">Prima Ponderada</p>
            <p className="text-2xl font-bold text-purple-900">
              ${kpis.totalPonderada.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
            <p className="text-sm text-orange-700 mb-1">Bono Total</p>
            <p className="text-2xl font-bold text-orange-900">
              ${kpis.totalBono.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <p className="text-sm text-green-700 mb-1">Registros</p>
            <p className="text-2xl font-bold text-green-900">
              {kpis.recordsCount.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-neutral-600" />
            <h3 className="font-semibold text-neutral-900">Filtros</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Fecha Desde
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Fecha Hasta
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Gerencia
              </label>
              <select
                value={filters.management}
                onChange={(e) => setFilters({ ...filters, management: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Todas</option>
                {managements.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Oficina
              </label>
              <select
                value={filters.office}
                onChange={(e) => setFilters({ ...filters, office: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Todas</option>
                {offices.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Agente
              </label>
              <select
                value={filters.agent}
                onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {agents.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Ramo
              </label>
              <select
                value={filters.ramo}
                onChange={(e) => setFilters({ ...filters, ramo: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                {ramos.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Aseguradora
              </label>
              <select
                value={filters.aseguradora}
                onChange={(e) => setFilters({ ...filters, aseguradora: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Todas</option>
                {aseguradoras.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end space-x-3">
            <button
              onClick={() => setFilters({
                dateFrom: '',
                dateTo: '',
                management: '',
                office: '',
                agent: '',
                ramo: '',
                subramo: '',
                aseguradora: '',
              })}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
            >
              Limpiar Filtros
            </button>

            <button
              onClick={exportToExcel}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>
      </div>

      {filteredRecords.length > 0 && (
        <>
          <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-4 sm:mb-6">
              Análisis de Convenios
            </h2>

            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <GraficaColumnas
                  data={chartDataByAseguradora}
                  title="Prima de Convenio por Aseguradora"
                  valueFormatter={formatCurrency}
                  height={240}
                />
                <GraficaColumnas
                  data={chartDataByRamo}
                  title="Prima de Convenio por Ramo"
                  valueFormatter={formatCurrency}
                  height={240}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <GraficaLinea
                  data={chartDataByMonth}
                  title="Prima de Convenio en el Tiempo"
                  valueFormatter={formatCurrency}
                  height={240}
                  color="#3b82f6"
                />
                <GraficaCircular
                  data={chartDataBono}
                  title={isAdmin ? "Distribución de Bono por Oficina" : "Distribución de Bono por Agente"}
                  valueFormatter={formatCurrency}
                  size={220}
                />
              </div>

              <GraficaColumnasAgrupadas
                data={chartDataComparativo}
                title="Comparativo Prima Convenio vs Prima Ponderada (Top 8)"
                series1Label="Prima Convenio"
                series2Label="Prima Ponderada"
                series1Color="#3b82f6"
                series2Color="#9ca3af"
                valueFormatter={formatCurrency}
                height={240}
              />
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-neutral-900">
            Registros en Convenio
          </h2>
          <span className="text-xs sm:text-sm text-neutral-600">
            {filteredRecords.length} {filteredRecords.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">Fecha</th>
                {isAdmin && <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">Región</th>}
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">Gerencia</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">Oficina</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">Agente</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">Aseguradora</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">Ramo</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-700">Prima Convenio</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-700">Prima Ponderada</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-700">Bono</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.slice(0, 100).map((record) => (
                <tr key={record.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {new Date(record.fecha).toLocaleDateString('es-MX')}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {record.region_raw || '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-neutral-600">{record.gerencia_nombre_raw}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{record.desp_nombre_raw}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{record.agente_nombre}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{record.aseguradora_nombre}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{record.ramo_nombre}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">
                    ${record.prima_convenio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-purple-600">
                    ${record.prima_ponderada.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-orange-600">
                    ${record.bono.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRecords.length === 0 && (
            <div className="text-center py-12">
              <p className="text-neutral-500">No hay registros en convenio que coincidan con los filtros</p>
            </div>
          )}

          {filteredRecords.length > 100 && (
            <div className="mt-4 text-center text-sm text-neutral-600">
              Mostrando 100 de {filteredRecords.length} registros. Usa los filtros o exporta a Excel para ver todos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
