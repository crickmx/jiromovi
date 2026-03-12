import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart3, TrendingUp, Clock, CheckCircle2, AlertCircle, Users, Building2,
  Calendar, Filter, Download, Search, ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface KPIs {
  total_tramites: number;
  tramites_pendientes: number;
  tramites_en_proceso: number;
  tramites_finalizados: number;
  tiempo_promedio_resolucion_dias: number;
  porcentaje_finalizacion: number;
  avance_promedio: number;
}

interface TramiteDetalle {
  id: string;
  folio: string;
  tipo_tramite: string;
  prioridad: string;
  avance: number;
  estatus_calculado: string;
  fecha_solicitud: string;
  fecha_finalizacion: string | null;
  tiempo_resolucion_dias: number | null;
  solicitante_nombre: string;
  asignado_nombre: string;
  oficina_nombre: string;
  estatus_nombre: string;
}

interface ProductividadUsuario {
  usuario_id: string;
  nombre_completo: string;
  oficina_nombre: string;
  total_tramites: number;
  tramites_pendientes: number;
  tramites_en_proceso: number;
  tramites_finalizados: number;
  avance_promedio: number;
  tiempo_promedio_resolucion_dias: number;
  porcentaje_finalizacion: number;
}

interface ProductividadOficina {
  oficina_id: string;
  oficina_nombre: string;
  total_tramites: number;
  tramites_pendientes: number;
  tramites_en_proceso: number;
  tramites_finalizados: number;
  avance_promedio: number;
  tiempo_promedio_resolucion_dias: number;
  porcentaje_finalizacion: number;
  usuarios_activos: number;
}

export default function TramitesReportes() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [tramites, setTramites] = useState<TramiteDetalle[]>([]);
  const [productividadUsuarios, setProductividadUsuarios] = useState<ProductividadUsuario[]>([]);
  const [productividadOficinas, setProductividadOficinas] = useState<ProductividadOficina[]>([]);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [oficinaFiltro, setOficinaFiltro] = useState('');
  const [usuarioFiltro, setUsuarioFiltro] = useState('');
  const [tipoTramiteFiltro, setTipoTramiteFiltro] = useState('');
  const [avanceFiltro, setAvanceFiltro] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Catálogos
  const [oficinas, setOficinas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);

  // Permisos
  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canViewReports = isAdmin || isGerente;

  useEffect(() => {
    if (canViewReports) {
      loadCatalogos();
      aplicarPresetFecha('ultimos30');
    }
  }, [canViewReports]);

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      loadData();
    }
  }, [fechaInicio, fechaFin, oficinaFiltro, usuarioFiltro, tipoTramiteFiltro, avanceFiltro]);

  const loadCatalogos = async () => {
    try {
      // Cargar oficinas
      const { data: oficinasData } = await supabase
        .from('oficinas')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');

      if (oficinasData) {
        setOficinas(oficinasData);

        // Si es gerente, fijar su oficina
        if (isGerente && usuario?.oficina_id) {
          setOficinaFiltro(usuario.oficina_id);
        }
      }

      // Cargar usuarios
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, oficina_id')
        .order('nombre_completo');

      if (usuariosData) setUsuarios(usuariosData);
    } catch (error) {
      console.error('Error loading catalogos:', error);
    }
  };

  const aplicarPresetFecha = (preset: string) => {
    const hoy = new Date();
    let inicio = new Date();

    switch (preset) {
      case 'hoy':
        inicio = new Date(hoy);
        break;
      case 'ultimos7':
        inicio.setDate(hoy.getDate() - 7);
        break;
      case 'ultimos30':
        inicio.setDate(hoy.getDate() - 30);
        break;
      case 'mesActual':
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        break;
    }

    setFechaInicio(inicio.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar KPIs
      const { data: kpisData } = await supabase.rpc('get_tramites_kpis', {
        p_fecha_inicio: fechaInicio ? new Date(fechaInicio).toISOString() : null,
        p_fecha_fin: fechaFin ? new Date(fechaFin + 'T23:59:59').toISOString() : null,
        p_oficina_id: oficinaFiltro || null,
        p_usuario_id: usuarioFiltro || null,
        p_tipo_tramite: tipoTramiteFiltro || null,
        p_avance: avanceFiltro ? parseInt(avanceFiltro) : null
      });

      if (kpisData) setKpis(kpisData);

      // Cargar trámites detallados
      let query = supabase
        .from('tramites_reportes_view')
        .select('*')
        .gte('fecha_solicitud', new Date(fechaInicio).toISOString())
        .lte('fecha_solicitud', new Date(fechaFin + 'T23:59:59').toISOString())
        .order('fecha_solicitud', { ascending: false });

      if (oficinaFiltro) query = query.eq('asignado_oficina_id', oficinaFiltro);
      if (usuarioFiltro) query = query.eq('asignado_id', usuarioFiltro);
      if (tipoTramiteFiltro) query = query.eq('tipo_tramite', tipoTramiteFiltro);
      if (avanceFiltro) query = query.eq('avance', parseInt(avanceFiltro));

      const { data: tramitesData } = await query;
      if (tramitesData) setTramites(tramitesData);

      // Cargar productividad por usuario
      let userQuery = supabase
        .from('tramites_productividad_usuario')
        .select('*')
        .order('total_tramites', { ascending: false })
        .limit(10);

      if (oficinaFiltro) userQuery = userQuery.eq('oficina_id', oficinaFiltro);

      const { data: userProdData } = await userQuery;
      if (userProdData) setProductividadUsuarios(userProdData);

      // Cargar productividad por oficina (solo para admin)
      if (isAdmin) {
        const { data: officeProdData } = await supabase
          .from('tramites_productividad_oficina')
          .select('*')
          .order('total_tramites', { ascending: false });

        if (officeProdData) setProductividadOficinas(officeProdData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    const tramitesFiltrados = tramites.filter(t =>
      t.folio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.solicitante_nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.asignado_nombre?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const data = tramitesFiltrados.map(t => ({
      'Folio': t.folio,
      'Tipo': t.tipo_tramite,
      'Prioridad': t.prioridad,
      'Avance': `${t.avance}%`,
      'Estatus': t.estatus_calculado,
      'Solicitante': t.solicitante_nombre,
      'Asignado': t.asignado_nombre,
      'Oficina': t.oficina_nombre,
      'Fecha Solicitud': new Date(t.fecha_solicitud).toLocaleDateString('es-MX'),
      'Fecha Finalización': t.fecha_finalizacion ? new Date(t.fecha_finalizacion).toLocaleDateString('es-MX') : 'Pendiente',
      'Tiempo Resolución (días)': t.tiempo_resolucion_dias?.toFixed(1) || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trámites');
    XLSX.writeFile(wb, `tramites_reportes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!canViewReports) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-neutral-600">
            Solo Administradores y Gerentes pueden acceder a los reportes.
          </p>
        </div>
      </div>
    );
  }

  const tiposTramite = ['correccion_poliza_registrada', 'correccion_comisiones', 'registro_poliza', 'solicitud_comisiones_pendientes', 'registro_actividad'];
  const avances = [0, 25, 50, 75, 100];

  // Calcular datos para gráficas
  const tramitesPorTipo = tiposTramite.map(tipo => ({
    tipo,
    cantidad: tramites.filter(t => t.tipo_tramite === tipo).length
  })).filter(t => t.cantidad > 0);

  const tramitesPorEstatus = [
    { estatus: 'Pendiente', cantidad: tramites.filter(t => t.estatus_calculado === 'Pendiente').length },
    { estatus: 'En Proceso', cantidad: tramites.filter(t => t.estatus_calculado === 'En Proceso').length },
    { estatus: 'Finalizado', cantidad: tramites.filter(t => t.estatus_calculado === 'Finalizado').length }
  ];

  const tramitesFiltrados = tramites.filter(t =>
    t.folio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.solicitante_nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.asignado_nombre?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Dashboard de Trámites</h1>
          <p className="text-neutral-600 mt-1">Análisis y métricas de productividad</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <TrendingUp className="w-5 h-5" />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-neutral-600" />
          <h2 className="text-lg font-semibold text-neutral-900">Filtros</h2>
        </div>

        {/* Presets de fecha */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => aplicarPresetFecha('hoy')} className="px-3 py-1.5 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
            Hoy
          </button>
          <button onClick={() => aplicarPresetFecha('ultimos7')} className="px-3 py-1.5 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
            Últimos 7 días
          </button>
          <button onClick={() => aplicarPresetFecha('ultimos30')} className="px-3 py-1.5 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
            Últimos 30 días
          </button>
          <button onClick={() => aplicarPresetFecha('mesActual')} className="px-3 py-1.5 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
            Mes actual
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Oficina
              </label>
              <select
                value={oficinaFiltro}
                onChange={(e) => setOficinaFiltro(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                {oficinas.map(o => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Usuario
            </label>
            <select
              value={usuarioFiltro}
              onChange={(e) => setUsuarioFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {usuarios
                .filter(u => !oficinaFiltro || u.oficina_id === oficinaFiltro)
                .map(u => (
                  <option key={u.id} value={u.id}>{u.nombre_completo}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Tipo de Trámite
            </label>
            <select
              value={tipoTramiteFiltro}
              onChange={(e) => setTipoTramiteFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {tiposTramite.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Avance
            </label>
            <select
              value={avanceFiltro}
              onChange={(e) => setAvanceFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {avances.map(a => (
                <option key={a} value={a}>{a}%</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Total Trámites</span>
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">{kpis.total_tramites}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Pendientes</span>
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">{kpis.tramites_pendientes}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">En Proceso</span>
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">{kpis.tramites_en_proceso}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Finalizados</span>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">{kpis.tramites_finalizados}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Tiempo Promedio</span>
              <Clock className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">
              {kpis.tiempo_promedio_resolucion_dias.toFixed(1)}
              <span className="text-base text-neutral-500 ml-1">días</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">% Finalización</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">{kpis.porcentaje_finalizacion.toFixed(1)}%</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Avance Promedio</span>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">{kpis.avance_promedio.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfica de Tipos de Trámite */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Trámites por Tipo</h3>
          <div className="space-y-3">
            {tramitesPorTipo.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-700">{item.tipo.replace(/_/g, ' ')}</span>
                  <span className="font-semibold">{item.cantidad}</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(item.cantidad / Math.max(...tramitesPorTipo.map(t => t.cantidad))) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfica de Estatus */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Trámites por Estatus</h3>
          <div className="space-y-3">
            {tramitesPorEstatus.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-700">{item.estatus}</span>
                  <span className="font-semibold">{item.cantidad}</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      item.estatus === 'Pendiente' ? 'bg-yellow-500' :
                      item.estatus === 'En Proceso' ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${(item.cantidad / Math.max(...tramitesPorEstatus.map(t => t.cantidad))) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Productividad por Usuario */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-neutral-600" />
          <h3 className="text-lg font-semibold text-neutral-900">Top 10 Productividad por Usuario</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Usuario</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Oficina</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Total</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Finalizados</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">% Finalización</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Avance Promedio</th>
              </tr>
            </thead>
            <tbody>
              {productividadUsuarios.map((user, idx) => (
                <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-3 px-4 text-sm text-neutral-900">{user.nombre_completo}</td>
                  <td className="py-3 px-4 text-sm text-neutral-600">{user.oficina_nombre || 'N/A'}</td>
                  <td className="py-3 px-4 text-sm text-neutral-900 text-right font-semibold">{user.total_tramites}</td>
                  <td className="py-3 px-4 text-sm text-green-600 text-right font-semibold">{user.tramites_finalizados}</td>
                  <td className="py-3 px-4 text-sm text-neutral-900 text-right">{user.porcentaje_finalizacion?.toFixed(1) || 0}%</td>
                  <td className="py-3 px-4 text-sm text-neutral-900 text-right">{user.avance_promedio?.toFixed(1) || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Productividad por Oficina (solo Admin) */}
      {isAdmin && productividadOficinas.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-neutral-600" />
            <h3 className="text-lg font-semibold text-neutral-900">Productividad por Oficina</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Oficina</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Total</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Finalizados</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">% Finalización</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Usuarios Activos</th>
                </tr>
              </thead>
              <tbody>
                {productividadOficinas.map((office, idx) => (
                  <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 px-4 text-sm text-neutral-900">{office.oficina_nombre}</td>
                    <td className="py-3 px-4 text-sm text-neutral-900 text-right font-semibold">{office.total_tramites}</td>
                    <td className="py-3 px-4 text-sm text-green-600 text-right font-semibold">{office.tramites_finalizados}</td>
                    <td className="py-3 px-4 text-sm text-neutral-900 text-right">{office.porcentaje_finalizacion?.toFixed(1) || 0}%</td>
                    <td className="py-3 px-4 text-sm text-neutral-900 text-right">{office.usuarios_activos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla de Detalle */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Detalle de Trámites ({tramitesFiltrados.length})</h3>
          <button
            onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>

        {/* Búsqueda */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar por folio, solicitante o asignado..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Folio</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Tipo</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Solicitante</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Asignado</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Oficina</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-neutral-700">Avance</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Estatus</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {tramitesFiltrados.slice(0, 50).map((tramite, idx) => (
                <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-3 px-4 text-sm font-mono text-neutral-900">{tramite.folio}</td>
                  <td className="py-3 px-4 text-sm text-neutral-600">{tramite.tipo_tramite?.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4 text-sm text-neutral-900">{tramite.solicitante_nombre}</td>
                  <td className="py-3 px-4 text-sm text-neutral-900">{tramite.asignado_nombre || 'Sin asignar'}</td>
                  <td className="py-3 px-4 text-sm text-neutral-600">{tramite.oficina_nombre || 'N/A'}</td>
                  <td className="py-3 px-4 text-sm text-neutral-900 text-right">{tramite.avance}%</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                      tramite.estatus_calculado === 'Finalizado' ? 'bg-green-100 text-green-700' :
                      tramite.estatus_calculado === 'En Proceso' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {tramite.estatus_calculado}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-neutral-600">
                    {new Date(tramite.fecha_solicitud).toLocaleDateString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tramitesFiltrados.length > 50 && (
          <div className="mt-4 text-center text-sm text-neutral-600">
            Mostrando 50 de {tramitesFiltrados.length} trámites. Usa los filtros para refinar la búsqueda.
          </div>
        )}
      </div>
    </div>
  );
}
