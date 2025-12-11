import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, Download, FileDown, Filter, Calendar, Users, Building, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';
import GraficaColumnas from '../components/comisiones/GraficaColumnas';
import GraficaCircular from '../components/comisiones/GraficaCircular';
import GraficaLinea from '../components/produccion/GraficaLinea';

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
  importe_pesos: number;
  prima_convenio: number;
  prima_ponderada: number;
  bono: number;
  convenio_flag: boolean;
  porcentaje_bono: number | null;
}

export default function ProduccionTotal() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastImport, setLastImport] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;

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
      region: '',
      management: '',
      office: '',
      agent: '',
      ramo: '',
      subramo: '',
      aseguradora: '',
      convenio: 'all',
    };
  });

  const [offices, setOffices] = useState<string[]>([]);
  const [managements, setManagements] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [ramos, setRamos] = useState<string[]>([]);
  const [aseguradoras, setAseguradoras] = useState<string[]>([]);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadData();
  }, [usuario]);

  useEffect(() => {
    applyFilters();
    setCurrentPage(1);
  }, [records, filters]);

  const loadData = async () => {
    if (!usuario) {
      console.log('[ProduccionTotal] No hay usuario');
      return;
    }

    console.log('[ProduccionTotal] Iniciando carga de datos...');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-production-sheets`;

      console.log('[ProduccionTotal] Llamando a:', apiUrl);

      const headers = {
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, { headers });

      console.log('[ProduccionTotal] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ProduccionTotal] Error response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Error al obtener datos de Google Sheets');
        } catch (e) {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }

      const result = await response.json();
      console.log('[ProduccionTotal] Result:', { success: result.success, total: result.total, hasRecords: !!result.records });

      if (!result.success) {
        throw new Error(result.error || 'Error desconocido');
      }

      if (!result.records || !Array.isArray(result.records)) {
        throw new Error('No se recibieron registros del servidor');
      }

      console.log('[ProduccionTotal] Procesando', result.records.length, 'registros...');

      let processedData = result.records.map((record: any) => ({
        id: `${record.fecha}-${record.agente_nombre}-${Math.random()}`,
        ...record,
        importe_pesos: Number(record.importe_pesos) || 0,
        prima_convenio: Number(record.prima_convenio) || 0,
        prima_ponderada: Number(record.prima_ponderada) || 0,
        bono: Number(record.bono) || 0,
        porcentaje_bono: record.porcentaje_bono ? Number(record.porcentaje_bono) : null,
      }));

      console.log('[ProduccionTotal] Datos procesados:', processedData.length);

      if (usuario.rol === 'Gerente' && usuario.oficina_id) {
        const { data: mapping } = await supabase
          .from('production_office_mapping')
          .select('excel_office_name, oficinas(nombre)')
          .eq('oficina_id', usuario.oficina_id)
          .maybeSingle();

        console.log('[ProduccionTotal] Gerente detectado - Oficina:', mapping?.oficinas?.nombre, 'Mapeo Excel:', mapping?.excel_office_name);

        if (mapping && mapping.excel_office_name) {
          const beforeFilter = processedData.length;
          processedData = processedData.filter((r: any) => {
            const matches = r.desp_nombre_raw === mapping.excel_office_name;
            if (!matches) {
              console.log('[ProduccionTotal] Registro filtrado:', r.desp_nombre_raw, '!==', mapping.excel_office_name);
            }
            return matches;
          });
          console.log('[ProduccionTotal] Filtrado por oficina (con mapeo):', beforeFilter, '→', processedData.length);
        } else {
          const { data: office } = await supabase
            .from('oficinas')
            .select('nombre')
            .eq('id', usuario.oficina_id)
            .maybeSingle();

          console.log('[ProduccionTotal] Sin mapeo, usando nombre directo:', office?.nombre);

          if (office) {
            const beforeFilter = processedData.length;
            processedData = processedData.filter((r: any) => {
              const matches = r.desp_nombre_raw === office.nombre;
              if (!matches) {
                console.log('[ProduccionTotal] Registro filtrado:', r.desp_nombre_raw, '!==', office.nombre);
              }
              return matches;
            });
            console.log('[ProduccionTotal] Filtrado por oficina (sin mapeo):', beforeFilter, '→', processedData.length);
          } else {
            console.warn('[ProduccionTotal] No se encontró oficina ni mapeo para el gerente');
          }
        }
      }

      setRecords(processedData);
      console.log('[ProduccionTotal] Records establecidos en state:', processedData.length);

      const uniqueOffices = isAdmin ? [...new Set(processedData.map((r: any) => r.desp_nombre_raw).filter(Boolean))] as string[] : [];
      const uniqueManagements = [...new Set(processedData.map((r: any) => r.gerencia_nombre_raw).filter(Boolean))] as string[];
      const uniqueRegions = isAdmin ? [...new Set(processedData.map((r: any) => r.region_raw).filter(Boolean))] as string[] : [];
      const uniqueAgents = [...new Set(processedData.map((r: any) => r.agente_nombre).filter(Boolean))] as string[];
      const uniqueRamos = [...new Set(processedData.map((r: any) => r.ramo_nombre).filter(Boolean))] as string[];
      const uniqueAseguradoras = [...new Set(processedData.map((r: any) => r.aseguradora_nombre).filter(Boolean))] as string[];

      setOffices(uniqueOffices.sort());
      setManagements(uniqueManagements.sort());
      setRegions(uniqueRegions.sort());
      setAgents(uniqueAgents.sort());
      setRamos(uniqueRamos.sort());
      setAseguradoras(uniqueAseguradoras.sort());

      setLastImport({ imported_at: result.fetched_at });

      console.log('[ProduccionTotal] Carga completada exitosamente');

    } catch (error: any) {
      console.error('[ProduccionTotal] Error completo:', error);
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

    if (filters.region && isAdmin) {
      filtered = filtered.filter(r =>
        r.region_raw?.toLowerCase().includes(filters.region.toLowerCase())
      );
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

    if (filters.convenio === 'with') {
      filtered = filtered.filter(r => r.convenio_flag);
    } else if (filters.convenio === 'without') {
      filtered = filtered.filter(r => !r.convenio_flag);
    }

    setFilteredRecords(filtered);
  };

  const calculateKPIs = () => {
    const totalImporte = filteredRecords.reduce((sum, r) => sum + (r.importe_pesos || 0), 0);
    const totalConvenio = filteredRecords.reduce((sum, r) => sum + (r.prima_convenio || 0), 0);
    const totalPonderada = filteredRecords.reduce((sum, r) => sum + (r.prima_ponderada || 0), 0);
    const totalBono = filteredRecords.reduce((sum, r) => sum + (r.bono || 0), 0);

    const metricaPrincipal = totalImporte > 0 ? totalImporte : totalConvenio;

    const uniqueAgents = new Set(filteredRecords.map(r => r.agente_nombre));
    const avgPerAgent = uniqueAgents.size > 0 ? metricaPrincipal / uniqueAgents.size : 0;

    const withConvenio = filteredRecords.filter(r => r.convenio_flag).length;
    const withoutConvenio = filteredRecords.length - withConvenio;

    return {
      totalImporte,
      totalConvenio,
      totalPonderada,
      totalBono,
      metricaPrincipal,
      recordsCount: filteredRecords.length,
      avgPerAgent,
      withConvenio,
      withoutConvenio
    };
  };

  const exportToExcel = () => {
    const dataToExport = filteredRecords.map(r => ({
      'Fecha': r.fecha,
      'Dirección Regional': r.region_raw || '',
      'Gerencia': r.gerencia_nombre_raw || '',
      'Oficina': r.desp_nombre_raw || '',
      'Agente': r.agente_nombre,
      'Ramo': r.ramo_nombre,
      'Subramo': r.subramo_nombre || '',
      'Aseguradora': r.aseguradora_nombre,
      'Importe Pesos': r.importe_pesos,
      'Prima Convenio': r.prima_convenio,
      'Prima Ponderada': r.prima_ponderada,
      'Bono': r.bono,
      'Convenio': r.convenio_flag ? 'Sí' : 'No',
      '% Bono': r.porcentaje_bono || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producción Total');
    XLSX.writeFile(wb, `Produccion_Total_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const chartDataByRamo = useMemo(() => {
    const useImporte = filteredRecords.some(r => r.importe_pesos > 0);
    const grouped = filteredRecords.reduce((acc, r) => {
      const ramo = r.ramo_nombre;
      if (!acc[ramo]) acc[ramo] = 0;
      acc[ramo] += useImporte ? r.importe_pesos : r.prima_convenio;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRecords]);

  const chartDataByAseguradora = useMemo(() => {
    const useImporte = filteredRecords.some(r => r.importe_pesos > 0);
    const grouped = filteredRecords.reduce((acc, r) => {
      const aseg = r.aseguradora_nombre;
      if (!acc[aseg]) acc[aseg] = 0;
      acc[aseg] += useImporte ? r.importe_pesos : r.prima_convenio;
      return acc;
    }, {} as Record<string, number>);

    const sorted = Object.entries(grouped)
      .sort(([, a], [, b]) => b - a);

    if (sorted.length > 10) {
      const top10 = sorted.slice(0, 10);
      const others = sorted.slice(10).reduce((sum, [, val]) => sum + val, 0);
      return [...top10.map(([label, value]) => ({ label, value })), { label: 'Otras', value: others }];
    }

    return sorted.map(([label, value]) => ({ label, value }));
  }, [filteredRecords]);

  const chartDataByOfficeOrAgent = useMemo(() => {
    const useImporte = filteredRecords.some(r => r.importe_pesos > 0);
    if (isAdmin) {
      const grouped = filteredRecords.reduce((acc, r) => {
        const office = r.desp_nombre_raw;
        if (!acc[office]) acc[office] = 0;
        acc[office] += useImporte ? r.importe_pesos : r.prima_convenio;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
    } else {
      const grouped = filteredRecords.reduce((acc, r) => {
        const agent = r.agente_nombre;
        if (!acc[agent]) acc[agent] = 0;
        acc[agent] += useImporte ? r.importe_pesos : r.prima_convenio;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
    }
  }, [filteredRecords, isAdmin]);

  const chartDataByMonth = useMemo(() => {
    const useImporte = filteredRecords.some(r => r.importe_pesos > 0);
    const grouped = filteredRecords.reduce((acc, r) => {
      const month = r.periodo_mes || r.fecha.substring(0, 7);
      if (!acc[month]) acc[month] = 0;
      acc[month] += useImporte ? r.importe_pesos : r.prima_convenio;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredRecords]);

  const chartDataConvenioVsNoConvenio = useMemo(() => {
    const useImporte = filteredRecords.some(r => r.importe_pesos > 0);
    const withConvenio = filteredRecords
      .filter(r => r.convenio_flag)
      .reduce((sum, r) => sum + (useImporte ? r.importe_pesos : r.prima_convenio), 0);
    const withoutConvenio = filteredRecords
      .filter(r => !r.convenio_flag)
      .reduce((sum, r) => sum + (useImporte ? r.importe_pesos : r.prima_convenio), 0);

    return [
      { label: 'Con Convenio', value: withConvenio },
      { label: 'Sin Convenio', value: withoutConvenio }
    ].filter(d => d.value > 0);
  }, [filteredRecords]);

  const chartDataByYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];
    const useImporte = records.some(r => r.importe_pesos > 0);

    const yearlyData = years.map(year => {
      const yearRecords = records.filter(r => {
        const recordYear = new Date(r.fecha).getFullYear();
        return recordYear === year;
      });

      const total = yearRecords.reduce((sum, r) =>
        sum + (useImporte ? r.importe_pesos : r.prima_convenio), 0
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

  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 mb-1 sm:mb-2">
                Producción Total
              </h1>
              <p className="text-sm sm:text-base text-neutral-600">
                Métrica base: {kpis.totalImporte > 0 ? 'IMPORTE PESOS' : 'PRIMA CONVENIO'}
              </p>
              {lastImport && (
                <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                  Datos actualizados: {new Date(lastImport.imported_at).toLocaleDateString('es-MX')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {isAdmin && (
                <button
                  onClick={() => navigate('/produccion/configuracion')}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Configuración</span>
                  <span className="sm:hidden">Cargar</span>
                </button>
              )}
              <TrendingUp className="w-10 h-10 sm:w-12 sm:h-12 text-primary-600 flex-shrink-0" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-green-200">
            <p className="text-xs sm:text-sm text-green-700 mb-1 font-medium">Producción Total</p>
            <p className="text-lg sm:text-2xl font-bold text-green-900 truncate">
              ${(kpis.metricaPrincipal / 1000000).toFixed(1)}M
            </p>
            <p className="text-xs text-green-600 mt-0.5 hidden sm:block">
              ${kpis.metricaPrincipal.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200">
            <p className="text-xs sm:text-sm text-blue-700 mb-1 font-medium">Registros</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-900">
              {kpis.recordsCount.toLocaleString()}
            </p>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-teal-200">
            <p className="text-xs sm:text-sm text-teal-700 mb-1 font-medium">Prima Convenio</p>
            <p className="text-lg sm:text-2xl font-bold text-teal-900 truncate">
              ${(kpis.totalConvenio / 1000000).toFixed(1)}M
            </p>
            <p className="text-xs text-teal-600 mt-0.5 hidden sm:block">
              ${kpis.totalConvenio.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-orange-200">
            <p className="text-xs sm:text-sm text-orange-700 mb-1 font-medium">Prima Ponderada</p>
            <p className="text-lg sm:text-2xl font-bold text-orange-900 truncate">
              ${(kpis.totalPonderada / 1000000).toFixed(1)}M
            </p>
            <p className="text-xs text-orange-600 mt-0.5 hidden sm:block">
              ${kpis.totalPonderada.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="bg-neutral-50 rounded-xl p-3 sm:p-4 border border-neutral-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-between w-full mb-3 sm:mb-4"
          >
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-600" />
              <h3 className="font-semibold text-neutral-900 text-sm sm:text-base">Filtros</h3>
              <span className="text-xs text-neutral-500">
                ({Object.values(filters).filter(v => v && v !== 'all').length} activos)
              </span>
            </div>
            <span className="text-neutral-600 text-sm sm:text-base">
              {showFilters ? '−' : '+'}
            </span>
          </button>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {isAdmin && (
                <>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                      Dirección Regional
                    </label>
                    <select
                      value={filters.region}
                      onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Todas</option>
                      {regions.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                      Oficina
                    </label>
                    <select
                      value={filters.office}
                      onChange={(e) => setFilters({ ...filters, office: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Todas</option>
                      {offices.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Gerencia
                </label>
                <select
                  value={filters.management}
                  onChange={(e) => setFilters({ ...filters, management: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Todas</option>
                  {aseguradoras.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-neutral-700 mb-1">
                  Convenio
                </label>
                <select
                  value={filters.convenio}
                  onChange={(e) => setFilters({ ...filters, convenio: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">Todos</option>
                  <option value="with">Con convenio</option>
                  <option value="without">Sin convenio</option>
                </select>
              </div>
            </div>
          )}

          {showFilters && (
            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => setFilters({
                  dateFrom: '',
                  dateTo: '',
                  region: '',
                  management: '',
                  office: '',
                  agent: '',
                  ramo: '',
                  subramo: '',
                  aseguradora: '',
                  convenio: 'all',
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
          )}
        </div>
      </div>

      {filteredRecords.length > 0 ? (
        <>
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-neutral-900 mb-4 sm:mb-6">
              Análisis de Producción
            </h2>

            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <GraficaColumnas
                  data={chartDataByRamo}
                  title={`Producción por Ramo (${kpis.totalImporte > 0 ? 'Importe Pesos' : 'Prima Convenio'})`}
                  valueFormatter={formatCurrency}
                  height={240}
                />
                <GraficaColumnas
                  data={chartDataByAseguradora}
                  title="Producción por Aseguradora (Top 10)"
                  valueFormatter={formatCurrency}
                  height={240}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <GraficaLinea
                  data={chartDataByMonth}
                  title="Producción en el Tiempo"
                  valueFormatter={formatCurrency}
                  height={240}
                  color="#10b981"
                />
                <GraficaCircular
                  data={chartDataConvenioVsNoConvenio}
                  title="Convenio vs Sin Convenio"
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

              <GraficaColumnas
                data={chartDataByOfficeOrAgent}
                title={isAdmin ? "Producción por Oficina" : "Producción por Agente"}
                valueFormatter={formatCurrency}
                height={240}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-8 sm:p-12">
          <div className="text-center">
            <TrendingUp className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              No hay datos para mostrar
            </h3>
            <p className="text-neutral-600 mb-4">
              Ajusta los filtros para ver registros de producción
            </p>
            <button
              onClick={() => setShowFilters(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              <Filter className="w-4 h-4" />
              <span>Mostrar Filtros</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-soft border border-neutral-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-neutral-900">
            Registros de Producción
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
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 min-w-[140px] sm:min-w-[180px]">Ubicación</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 min-w-[120px]">Agente</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-neutral-700 min-w-[140px] sm:min-w-[180px]">Producto</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-neutral-700 whitespace-nowrap">Importe</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-neutral-700 whitespace-nowrap">Convenio</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => (
                  <tr key={record.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-900 font-medium whitespace-nowrap">
                      {new Date(record.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3">
                      <div className="flex flex-col space-y-0.5">
                        {isAdmin && record.region_raw && (
                          <span className="text-[10px] sm:text-xs text-neutral-500 font-medium uppercase tracking-wide">
                            {record.region_raw}
                          </span>
                        )}
                        <span className="text-xs sm:text-sm text-neutral-900 font-medium line-clamp-1">
                          {record.desp_nombre_raw}
                        </span>
                        <span className="text-[10px] sm:text-xs text-neutral-600 line-clamp-1">
                          {record.gerencia_nombre_raw}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-neutral-900 font-medium">
                      <div className="line-clamp-2 max-w-[140px] sm:max-w-none">
                        {record.agente_nombre}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3">
                      <div className="flex flex-col space-y-0.5">
                        <span className="text-xs sm:text-sm text-neutral-900 font-medium line-clamp-1">
                          {record.aseguradora_nombre}
                        </span>
                        <span className="text-[10px] sm:text-xs text-neutral-600">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
                            {record.ramo_nombre}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-green-700 whitespace-nowrap">
                      ${(record.importe_pesos > 0 ? record.importe_pesos : record.prima_convenio).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                      {record.convenio_flag ? (
                        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold">
                          Sí
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 bg-neutral-100 text-neutral-600 rounded-lg text-xs font-medium">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <p className="text-sm sm:text-base text-neutral-500">No hay registros que coincidan con los filtros</p>
            </div>
          )}

          {filteredRecords.length > recordsPerPage && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
              <div className="text-xs sm:text-sm text-neutral-600">
                Mostrando <span className="font-semibold">{startIndex + 1}</span> a{' '}
                <span className="font-semibold">{Math.min(endIndex, filteredRecords.length)}</span> de{' '}
                <span className="font-semibold">{filteredRecords.length}</span> registros
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                >
                  Primera
                </button>

                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                >
                  Anterior
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`w-8 h-8 text-sm rounded-lg font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'border border-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                >
                  Siguiente
                </button>

                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                >
                  Última
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
