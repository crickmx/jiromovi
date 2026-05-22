import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, Download, Filter, Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
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

  const getDefaultDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const dateFrom = `${year}-01-01`;
    const dateTo = now.toISOString().split('T')[0];
    return { dateFrom, dateTo };
  };

  const [filters, setFilters] = useState(() => {
    const { dateFrom, dateTo } = getDefaultDates();
    return {
      dateFrom,
      dateTo,
      management: '',
      office: '',
      agent: '',
      ramo: '',
      subramo: '',
      aseguradora: '',
    };
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

      if (usuario.rol === 'Gerente' && usuario.oficina_id) {
        const { data: mapping } = await supabase
          .from('production_office_mapping')
          .select('excel_office_name, oficinas(nombre)')
          .eq('oficina_id', usuario.oficina_id)
          .maybeSingle();

        console.log('[ProduccionConvenio] Gerente detectado - Oficina:', mapping?.oficinas?.nombre, 'Mapeo Excel:', mapping?.excel_office_name);

        if (mapping && mapping.excel_office_name) {
          const beforeFilter = processedData.length;
          processedData = processedData.filter((r: any) => {
            const matches = r.desp_nombre_raw === mapping.excel_office_name;
            if (!matches) {
              console.log('[ProduccionConvenio] Registro filtrado:', r.desp_nombre_raw, '!==', mapping.excel_office_name);
            }
            return matches;
          });
          console.log('[ProduccionConvenio] Filtrado por oficina (con mapeo):', beforeFilter, '→', processedData.length);
        } else {
          const { data: office } = await supabase
            .from('oficinas')
            .select('nombre')
            .eq('id', usuario.oficina_id)
            .maybeSingle();

          console.log('[ProduccionConvenio] Sin mapeo, usando nombre directo:', office?.nombre);

          if (office) {
            const beforeFilter = processedData.length;
            processedData = processedData.filter((r: any) => {
              const matches = r.desp_nombre_raw === office.nombre;
              if (!matches) {
                console.log('[ProduccionConvenio] Registro filtrado:', r.desp_nombre_raw, '!==', office.nombre);
              }
              return matches;
            });
            console.log('[ProduccionConvenio] Filtrado por oficina (sin mapeo):', beforeFilter, '→', processedData.length);
          } else {
            console.warn('[ProduccionConvenio] No se encontró oficina ni mapeo para el gerente');
          }
        }
      }

      setRecords(processedData);
      console.log('[ProduccionConvenio] Records establecidos en state:', processedData.length);

      const uniqueOffices = isAdmin ? [...new Set(processedData.map((r: any) => r.desp_nombre_raw).filter(Boolean))] as string[] : [];
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

    if (filters.office && isAdmin) {
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

  const chartDataByYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];

    const yearlyData = years.map(year => {
      const yearRecords = records.filter(r => {
        const recordYear = new Date(r.fecha).getFullYear();
        return recordYear === year;
      });

      const total = yearRecords.reduce((sum, r) =>
        sum + r.prima_convenio, 0
      );

      return {
        label: year.toString(),
        value: total
      };
    });

    return yearlyData.reverse();
  }, [records]);

  const kpis = calculateKPIs();
  const formatCurrency = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <PageHeader
            title="Producción Convenio"
            description={`Métrica base: Prima de convenio (solo registros en convenio)${lastImport ? ` | Datos actualizados: ${new Date(lastImport.imported_at).toLocaleDateString('es-MX')}` : ''}`}
            icon={TrendingUp}
            actions={
              isAdmin ? (
                <button
                  onClick={() => navigate('/produccion/configuracion')}
                  className="flex items-center space-x-2 bg-accent text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm sm:text-base"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Configuración</span>
                  <span className="sm:hidden">Config</span>
                </button>
              ) : undefined
            }
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-primary-200">
            <p className="text-xs sm:text-sm text-primary-700 mb-1 font-medium">Prima Convenio</p>
            <p className="text-lg sm:text-2xl font-bold text-primary-900 truncate">
              ${(kpis.totalConvenio / 1000000).toFixed(1)}M
            </p>
            <p className="text-xs text-accent mt-0.5 hidden sm:block">
              ${kpis.totalConvenio.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-teal-200">
            <p className="text-xs sm:text-sm text-teal-700 mb-1 font-medium">Prima Ponderada</p>
            <p className="text-lg sm:text-2xl font-bold text-teal-900 truncate">
              ${(kpis.totalPonderada / 1000000).toFixed(1)}M
            </p>
            <p className="text-xs text-teal-600 mt-0.5 hidden sm:block">
              ${kpis.totalPonderada.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-orange-200">
            <p className="text-xs sm:text-sm text-orange-700 mb-1 font-medium">Bono Total</p>
            <p className="text-lg sm:text-2xl font-bold text-orange-900 truncate">
              ${(kpis.totalBono / 1000000).toFixed(1)}M
            </p>
            <p className="text-xs text-orange-600 mt-0.5 hidden sm:block">
              ${kpis.totalBono.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-green-200">
            <p className="text-xs sm:text-sm text-green-700 mb-1 font-medium">Registros</p>
            <p className="text-lg sm:text-2xl font-bold text-green-900">
              {kpis.recordsCount.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
          <div className="flex items-center space-x-2 mb-3 sm:mb-4">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600" />
            <h3 className="font-semibold text-neutral-900 text-sm sm:text-base">Filtros</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                Fecha Desde
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                Fecha Hasta
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            {isAdmin && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Oficina
                </label>
                <select
                  value={filters.office}
                  onChange={(e) => setFilters({ ...filters, office: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                >
                  <option value="">Todas</option>
                  {offices.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                Gerencia
              </label>
              <select
                value={filters.management}
                onChange={(e) => setFilters({ ...filters, management: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="">Todas</option>
                {managements.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                Agente
              </label>
              <select
                value={filters.agent}
                onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="">Todos</option>
                {agents.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                Ramo
              </label>
              <select
                value={filters.ramo}
                onChange={(e) => setFilters({ ...filters, ramo: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="">Todos</option>
                {ramos.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                Aseguradora
              </label>
              <select
                value={filters.aseguradora}
                onChange={(e) => setFilters({ ...filters, aseguradora: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <option value="">Todas</option>
                {aseguradoras.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
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
              className="w-full sm:w-auto px-4 py-2 text-sm border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium"
            >
              Limpiar
            </button>

            <button
              onClick={exportToExcel}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium sm:ml-auto"
            >
              <Download className="w-4 h-4" />
              <span>Exportar</span>
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

              <GraficaColumnas
                data={chartDataByYear}
                title="Comparación por Año"
                valueFormatter={formatCurrency}
                height={280}
                color="#3b82f6"
              />

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

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-neutral-900">
            Registros en Convenio
          </h2>
          <span className="text-xs sm:text-sm text-neutral-600">
            {filteredRecords.length} {filteredRecords.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-lg">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 whitespace-nowrap">Fecha</th>
                  {isAdmin && <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 min-w-[100px]">Región</th>}
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 min-w-[140px] sm:min-w-[180px]">Gerencia</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 min-w-[140px] sm:min-w-[180px]">Oficina</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 min-w-[120px]">Agente</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 min-w-[140px]">Aseguradora</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 min-w-[100px]">Ramo</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-neutral-700 whitespace-nowrap">Prima Conv.</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-neutral-700 whitespace-nowrap">Prima Pond.</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-neutral-700 whitespace-nowrap">Bono</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.slice(0, 100).map((record) => (
                  <tr key={record.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-900 font-medium whitespace-nowrap">
                      {new Date(record.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    {isAdmin && (
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600">
                        <div className="line-clamp-1">{record.region_raw || '-'}</div>
                      </td>
                    )}
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600">
                      <div className="line-clamp-2">{record.gerencia_nombre_raw}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-900 font-medium">
                      <div className="line-clamp-2">{record.desp_nombre_raw}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600">
                      <div className="line-clamp-2 max-w-[140px] sm:max-w-none">{record.agente_nombre}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600">
                      <div className="line-clamp-2">{record.aseguradora_nombre}</div>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
                        {record.ramo_nombre}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-primary-700 whitespace-nowrap">
                      ${record.prima_convenio.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-teal-700 whitespace-nowrap">
                      ${record.prima_ponderada.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-orange-700 whitespace-nowrap">
                      ${record.bono.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <p className="text-sm sm:text-base text-neutral-500">No hay registros en convenio que coincidan con los filtros</p>
            </div>
          )}

          {filteredRecords.length > 100 && (
            <div className="mt-4 text-center text-xs sm:text-sm text-neutral-600 px-2">
              Mostrando 100 de {filteredRecords.length} registros. Usa los filtros o exporta a Excel para ver todos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
