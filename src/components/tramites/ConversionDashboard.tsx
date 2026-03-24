import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Calendar,
  Building2,
  User
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

interface Oficina {
  id: string;
  nombre: string;
}

export function ConversionDashboard() {
  const { usuario } = useAuth();
  const [kpis, setKpis] = useState<KPIs>({
    total_tramites: 0,
    total_emitidos: 0,
    total_no_emitidos: 0,
    total_en_proceso: 0,
    tasa_conversion: 0
  });
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState(() => {
    const date = new Date();
    date.setDate(1); // Primer día del mes
    return date.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedOficina, setSelectedOficina] = useState<string>('');
  const [selectedUsuario, setSelectedUsuario] = useState<string>('');
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [usuarios, setUsuarios] = useState<Array<{ id: string; nombre_completo: string }>>([]);

  const isAdmin = usuario?.rol === 'admin';
  const isGerente = usuario?.rol === 'gerente';
  const canViewAllOffices = isAdmin;

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadKPIs();
    loadRanking();
  }, [fechaInicio, fechaFin, selectedOficina, selectedUsuario]);

  const loadInitialData = async () => {
    await Promise.all([loadOficinas(), loadUsuarios()]);
    loadKPIs();
    loadRanking();
  };

  const loadOficinas = async () => {
    if (!canViewAllOffices) return;

    const { data } = await supabase
      .from('oficinas')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre');

    if (data) setOficinas(data);
  };

  const loadUsuarios = async () => {
    let query = supabase
      .from('usuarios')
      .select('id, nombre_completo')
      .eq('estado', 'activo')
      .order('nombre_completo');

    // Si es gerente, solo usuarios de su oficina
    if (isGerente && usuario?.oficina_id) {
      query = query.eq('oficina_id', usuario.oficina_id);
    }

    const { data } = await query;
    if (data) setUsuarios(data);
  };

  const loadKPIs = async () => {
    setLoading(true);

    try {
      const params: any = {};

      if (fechaInicio) params.p_fecha_inicio = new Date(fechaInicio + 'T00:00:00').toISOString();
      if (fechaFin) params.p_fecha_fin = new Date(fechaFin + 'T23:59:59').toISOString();
      if (selectedOficina) params.p_oficina_id = selectedOficina;
      if (selectedUsuario) params.p_usuario_id = selectedUsuario;

      const { data, error } = await supabase.rpc('get_conversion_kpis', params);

      if (error) {
        console.error('Error loading KPIs:', error);
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
      console.error('Exception loading KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRanking = async () => {
    try {
      const params: any = {};

      if (fechaInicio) params.p_fecha_inicio = new Date(fechaInicio + 'T00:00:00').toISOString();
      if (fechaFin) params.p_fecha_fin = new Date(fechaFin + 'T23:59:59').toISOString();
      if (selectedOficina) params.p_oficina_id = selectedOficina;

      const { data, error } = await supabase.rpc('get_conversion_ranking', params);

      if (error) {
        console.error('Error loading ranking:', error);
        return;
      }

      if (data) {
        setRanking(data);
      }
    } catch (error) {
      console.error('Exception loading ranking:', error);
    }
  };

  const getTasaColor = (tasa: number | null): string => {
    if (!tasa) return 'text-gray-500';
    if (tasa >= 70) return 'text-green-600 dark:text-green-400';
    if (tasa >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getTasaBgColor = (tasa: number | null): string => {
    if (!tasa) return 'bg-gray-100 dark:bg-gray-800';
    if (tasa >= 70) return 'bg-green-100 dark:bg-green-900/20';
    if (tasa >= 40) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Filtros
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Fecha Inicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Fecha Fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Oficina (solo para admin) */}
          {canViewAllOffices && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                Oficina
              </label>
              <select
                value={selectedOficina}
                onChange={(e) => setSelectedOficina(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Todas las oficinas</option>
                {oficinas.map((oficina) => (
                  <option key={oficina.id} value={oficina.id}>
                    {oficina.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Usuario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Agente
            </label>
            <select
              value={selectedUsuario}
              onChange={(e) => setSelectedUsuario(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Todos los agentes</option>
              {usuarios.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombre_completo}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total Cotizaciones */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {kpis.total_tramites}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Total Cotizaciones/Emisiones
          </p>
        </div>

        {/* Emitidos */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            {kpis.total_emitidos}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Emitidos (Ganados)
          </p>
        </div>

        {/* No Emitidos */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
            {kpis.total_no_emitidos}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            No Emitidos (Perdidos)
          </p>
        </div>

        {/* En Proceso */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
            {kpis.total_en_proceso}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            En Proceso
          </p>
        </div>

        {/* Tasa de Conversión */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 ${getTasaBgColor(kpis.tasa_conversion)}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white dark:bg-gray-900 rounded-lg">
              <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className={`text-3xl font-bold ${getTasaColor(kpis.tasa_conversion)}`}>
            {kpis.tasa_conversion ? `${kpis.tasa_conversion}%` : '0%'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Tasa de Conversión
          </p>
        </div>
      </div>

      {/* Gráfica de Conversión */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Distribución de Resultados
        </h3>

        <div className="space-y-4">
          {/* Barra Emitidos */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Emitidos
              </span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                {kpis.total_emitidos} ({kpis.total_tramites > 0 ? Math.round((kpis.total_emitidos / kpis.total_tramites) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-green-600 dark:bg-green-500 h-4 rounded-full transition-all duration-300"
                style={{ width: `${kpis.total_tramites > 0 ? (kpis.total_emitidos / kpis.total_tramites) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Barra No Emitidos */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No Emitidos
              </span>
              <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                {kpis.total_no_emitidos} ({kpis.total_tramites > 0 ? Math.round((kpis.total_no_emitidos / kpis.total_tramites) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-red-600 dark:bg-red-500 h-4 rounded-full transition-all duration-300"
                style={{ width: `${kpis.total_tramites > 0 ? (kpis.total_no_emitidos / kpis.total_tramites) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Barra En Proceso */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                En Proceso
              </span>
              <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                {kpis.total_en_proceso} ({kpis.total_tramites > 0 ? Math.round((kpis.total_en_proceso / kpis.total_tramites) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div
                className="bg-yellow-600 dark:bg-yellow-500 h-4 rounded-full transition-all duration-300"
                style={{ width: `${kpis.total_tramites > 0 ? (kpis.total_en_proceso / kpis.total_tramites) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ranking de Agentes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Ranking de Conversión por Agente
        </h3>

        {ranking.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No hay datos para mostrar con los filtros seleccionados
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Posición
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Agente
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Oficina
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Total
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-green-700 dark:text-green-400">
                    Emitidos
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-red-700 dark:text-red-400">
                    No Emitidos
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                    En Proceso
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-purple-700 dark:text-purple-400">
                    Tasa Conversión
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((item, index) => (
                  <tr
                    key={item.agente_id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                        index === 1 ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                        index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' :
                        'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">
                      {item.agente_nombre}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.oficina_nombre}
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                      {item.total_tramites}
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-green-600 dark:text-green-400">
                      {item.total_emitidos}
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-red-600 dark:text-red-400">
                      {item.total_no_emitidos}
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                      {item.total_en_proceso}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                        item.tasa_conversion === null ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                        item.tasa_conversion >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                        item.tasa_conversion >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {item.tasa_conversion ? `${item.tasa_conversion}%` : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
