import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart3, TrendingUp, Clock, CheckCircle2, AlertCircle, Users, Building2,
  Calendar, Filter, Download, Search, ChevronDown, Eye, X, Settings
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TramiteDetalles } from '../components/tramites/TramiteDetalles';
import { TramiteComentarios } from '../components/tramites/TramiteComentarios';
import { TramiteArchivos } from '../components/tramites/TramiteArchivos';
import { TramiteHistorial } from '../components/tramites/TramiteHistorial';
import { GestionGruposVisualizacion } from '../components/tramites/GestionGruposVisualizacion';
import { ConversionDashboard } from '../components/tramites/ConversionDashboard';

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

interface TramiteCompleto {
  id: string;
  folio: string;
  tipo_tramite: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  poliza: string | null;
  instrucciones: string;
  fecha_creacion: string;
  ultima_modificacion: string;
  cerrado_en: string | null;
  cerrado: boolean | null;
  estatus_id: string;
  agente: any;
  estatus: any;
  creado_por_usuario: any;
  modificado_por_usuario: any;
  cerrado_por_usuario: any;
}

interface TramitesPorUsuario {
  usuario_id: string;
  nombre_completo: string;
  oficina_nombre: string;
  tramites: TramiteDetalle[];
}

export default function TramitesReportes() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [tramites, setTramites] = useState<TramiteDetalle[]>([]);
  const [productividadUsuarios, setProductividadUsuarios] = useState<ProductividadUsuario[]>([]);
  const [productividadOficinas, setProductividadOficinas] = useState<ProductividadOficina[]>([]);
  const [tramitesPorUsuario, setTramitesPorUsuario] = useState<TramitesPorUsuario[]>([]);

  // Modal de vista previa
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTramite, setSelectedTramite] = useState<TramiteCompleto | null>(null);
  const [previewTab, setPreviewTab] = useState<'detalles' | 'comentarios' | 'archivos' | 'historial'>('detalles');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Vista de trámites por usuario
  const [showTramitesPorUsuario, setShowTramitesPorUsuario] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // Modal de gestión de grupos
  const [showGruposModal, setShowGruposModal] = useState(false);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [oficinaFiltro, setOficinaFiltro] = useState('');
  const [usuarioFiltro, setUsuarioFiltro] = useState('');
  const [grupoFiltro, setGrupoFiltro] = useState('');
  const [tipoTramiteFiltro, setTipoTramiteFiltro] = useState('');
  const [estatusFiltro, setEstatusFiltro] = useState('');
  const [prioridadFiltro, setPrioridadFiltro] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Catálogos
  const [oficinas, setOficinas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [usuariosDelGrupo, setUsuariosDelGrupo] = useState<string[]>([]);

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
  }, [fechaInicio, fechaFin, oficinaFiltro, usuarioFiltro, grupoFiltro, tipoTramiteFiltro, estatusFiltro, prioridadFiltro]);

  useEffect(() => {
    if (grupoFiltro) {
      loadUsuariosDelGrupo(grupoFiltro);
    } else {
      setUsuariosDelGrupo([]);
    }
  }, [grupoFiltro]);

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

      // Cargar grupos
      const { data: gruposData } = await supabase
        .from('tramites_grupos_visualizacion')
        .select('id, nombre, color')
        .eq('activo', true)
        .order('nombre');

      if (gruposData) setGrupos(gruposData);
    } catch (error) {
      console.error('Error loading catalogos:', error);
    }
  };

  const loadUsuariosDelGrupo = async (grupoId: string) => {
    try {
      const { data, error } = await supabase
        .from('tramites_grupos_miembros')
        .select('usuario_id')
        .eq('grupo_id', grupoId);

      if (error) throw error;

      const ids = data?.map(m => m.usuario_id) || [];
      setUsuariosDelGrupo(ids);
    } catch (error) {
      console.error('Error loading usuarios del grupo:', error);
      setUsuariosDelGrupo([]);
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
        p_avance: null
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
      if (grupoFiltro && usuariosDelGrupo.length > 0) {
        query = query.in('asignado_id', usuariosDelGrupo);
      }
      if (tipoTramiteFiltro) query = query.eq('tipo_tramite', tipoTramiteFiltro);
      if (estatusFiltro) query = query.eq('estatus_calculado', estatusFiltro);
      if (prioridadFiltro) query = query.eq('prioridad', prioridadFiltro);

      const { data: tramitesData } = await query;
      if (tramitesData) setTramites(tramitesData);

      // Cargar productividad por usuario
      let userQuery = supabase
        .from('tramites_productividad_usuario')
        .select('*')
        .order('total_tramites', { ascending: false })
        .limit(10);

      if (oficinaFiltro) userQuery = userQuery.eq('oficina_id', oficinaFiltro);
      if (grupoFiltro && usuariosDelGrupo.length > 0) {
        userQuery = userQuery.in('usuario_id', usuariosDelGrupo);
      }

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

      // Cargar trámites agrupados por usuario
      await loadTramitesPorUsuario();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTramitesPorUsuario = async () => {
    try {
      let query = supabase
        .from('tramites_reportes_view')
        .select('*')
        .gte('fecha_solicitud', new Date(fechaInicio).toISOString())
        .lte('fecha_solicitud', new Date(fechaFin + 'T23:59:59').toISOString())
        .not('asignado_id', 'is', null)
        .order('asignado_nombre')
        .order('fecha_solicitud', { ascending: false });

      if (oficinaFiltro) query = query.eq('asignado_oficina_id', oficinaFiltro);
      if (usuarioFiltro) query = query.eq('asignado_id', usuarioFiltro);
      if (grupoFiltro && usuariosDelGrupo.length > 0) {
        query = query.in('asignado_id', usuariosDelGrupo);
      }
      if (tipoTramiteFiltro) query = query.eq('tipo_tramite', tipoTramiteFiltro);

      const { data } = await query;

      if (data) {
        // Agrupar trámites por usuario
        const grouped = data.reduce((acc: Record<string, TramitesPorUsuario>, tramite: any) => {
          const userId = tramite.asignado_id;
          if (!acc[userId]) {
            acc[userId] = {
              usuario_id: userId,
              nombre_completo: tramite.asignado_nombre,
              oficina_nombre: tramite.oficina_nombre || 'Sin oficina',
              tramites: []
            };
          }
          acc[userId].tramites.push(tramite);
          return acc;
        }, {});

        // Ordenar los trámites dentro de cada usuario por fecha descendente (más reciente primero)
        const groupedArray = Object.values(grouped);
        groupedArray.forEach(userGroup => {
          userGroup.tramites.sort((a, b) => {
            return new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime();
          });
        });

        setTramitesPorUsuario(groupedArray);
      }
    } catch (error) {
      console.error('Error loading tramites por usuario:', error);
    }
  };

  const handleVerTramite = async (tramiteId: string) => {
    setLoadingPreview(true);
    setShowPreviewModal(true);

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          agente:agente_id(id, nombre_completo),
          estatus:estatus_id(*),
          creado_por_usuario:creado_por(id, nombre_completo),
          modificado_por_usuario:modificado_por(id, nombre_completo),
          cerrado_por_usuario:cerrado_por(id, nombre_completo),
          activity_subtype:activity_subtype_id(id, nombre),
          agente_usuario:agente_usuario_id(id, nombre_completo),
          insurance_type:insurance_type_id(id, nombre),
          attending_user:attending_user_id(id, nombre_completo)
        `)
        .eq('id', tramiteId)
        .single();

      if (error) throw error;
      if (data) setSelectedTramite(data as TramiteCompleto);
    } catch (error) {
      console.error('Error loading tramite details:', error);
      alert('Error al cargar los detalles del trámite');
      setShowPreviewModal(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
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
      'Estatus': t.estatus_calculado,
      'Ejecutivo': t.solicitante_nombre,
      'Agente': t.asignado_nombre,
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

  const getTipoTramiteLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      cotizacion_emision: 'Cotización / Emisión',
      correccion_poliza_registrada: 'Corrección de póliza',
      correccion_comisiones: 'Corrección de comisiones',
      registro_poliza: 'Registro de póliza',
      solicitud_comisiones_pendientes: 'Solicitud de comisiones',
      registro_actividad: 'Registro de actividades',
    };
    return labels[tipo] || tipo.replace(/_/g, ' ');
  };

  const tiposTramite = ['cotizacion_emision', 'correccion_poliza_registrada', 'correccion_comisiones', 'registro_poliza', 'solicitud_comisiones_pendientes', 'registro_actividad'];
  const estatusOptions = ['Pendiente', 'En Proceso', 'Finalizado'];
  const prioridadOptions = ['Alta', 'Media', 'Baja'];

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGruposModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Users className="w-5 h-5" />
            Gestionar Grupos
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <TrendingUp className="w-5 h-5" />
            Actualizar
          </button>
        </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              Grupo
            </label>
            <select
              value={grupoFiltro}
              onChange={(e) => {
                setGrupoFiltro(e.target.value);
                if (e.target.value) {
                  setUsuarioFiltro(''); // Limpiar filtro individual si se selecciona grupo
                }
              }}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin filtro de grupo</option>
              {grupos.map(g => (
                <option key={g.id} value={g.id}>
                  <span style={{ color: g.color }}>●</span> {g.nombre}
                </option>
              ))}
            </select>
            {grupoFiltro && usuariosDelGrupo.length > 0 && (
              <p className="text-xs text-neutral-500 mt-1">
                {usuariosDelGrupo.length} usuario{usuariosDelGrupo.length !== 1 ? 's' : ''} en el grupo
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Usuario Individual
            </label>
            <select
              value={usuarioFiltro}
              onChange={(e) => {
                setUsuarioFiltro(e.target.value);
                if (e.target.value) {
                  setGrupoFiltro(''); // Limpiar filtro de grupo si se selecciona usuario individual
                }
              }}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!!grupoFiltro}
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
                <option key={t} value={t}>{getTipoTramiteLabel(t)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Estatus
            </label>
            <select
              value={estatusFiltro}
              onChange={(e) => setEstatusFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {estatusOptions.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Prioridad
            </label>
            <select
              value={prioridadFiltro}
              onChange={(e) => setPrioridadFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {prioridadOptions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Dashboard de Conversión de Cotizaciones/Emisiones */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-sm p-6 border-2 border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-blue-600" />
              Dashboard de Conversión: Cotizaciones y Emisiones
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Análisis específico de trámites tipo Cotización/Emisión con métricas de conversión
            </p>
          </div>
        </div>
        <ConversionDashboard />
      </div>

      {/* Sección de Métricas Generales de Productividad */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-purple-600" />
          Métricas Generales de Productividad (Todos los Trámites)
        </h2>
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
              <span className="text-sm text-neutral-600">Tasa de Éxito</span>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">
              {kpis.total_tramites > 0
                ? ((kpis.tramites_finalizados / kpis.total_tramites) * 100).toFixed(1)
                : 0}%
            </div>
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

      {/* Trámites por Usuario Asignado */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-neutral-600" />
            <h3 className="text-lg font-semibold text-neutral-900">Trámites por Usuario (Asignado a)</h3>
          </div>
          <button
            onClick={() => setShowTramitesPorUsuario(!showTramitesPorUsuario)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showTramitesPorUsuario ? 'rotate-180' : ''}`} />
            {showTramitesPorUsuario ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {showTramitesPorUsuario && (
          <div className="space-y-3">
            {tramitesPorUsuario.map((userGroup) => (
              <div key={userGroup.usuario_id} className="border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleUserExpanded(userGroup.usuario_id)}
                  className="w-full px-4 py-3 bg-neutral-50 hover:bg-neutral-100 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-neutral-600" />
                    <div className="text-left">
                      <div className="font-semibold text-neutral-900">{userGroup.nombre_completo}</div>
                      <div className="text-sm text-neutral-600">{userGroup.oficina_nombre}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                      {userGroup.tramites.length} trámites
                    </span>
                    <ChevronDown className={`w-5 h-5 text-neutral-600 transition-transform ${
                      expandedUsers.has(userGroup.usuario_id) ? 'rotate-180' : ''
                    }`} />
                  </div>
                </button>

                {expandedUsers.has(userGroup.usuario_id) && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-neutral-100">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Solicitante / Folio</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Tipo</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Estatus</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Fecha</th>
                          <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userGroup.tramites.map((tramite) => (
                          <tr key={tramite.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="text-sm text-neutral-900 font-medium">{tramite.solicitante_nombre}</span>
                                <span className="text-sm font-mono text-accent font-semibold">{tramite.folio}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-neutral-600">{tramite.tipo_tramite?.replace(/_/g, ' ')}</td>
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
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleVerTramite(tramite.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
            {tramitesPorUsuario.length === 0 && (
              <div className="text-center py-8 text-neutral-600">
                No hay trámites asignados en el período seleccionado
              </div>
            )}
          </div>
        )}
      </div>

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
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Solicitante / Folio</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Tipo</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Agente</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Oficina</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Estatus</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700">Fecha</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-neutral-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tramitesFiltrados.slice(0, 50).map((tramite, idx) => (
                <tr key={idx} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-neutral-900 font-medium">{tramite.solicitante_nombre}</span>
                      <span className="text-sm font-mono text-accent font-semibold">{tramite.folio}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-neutral-600">{tramite.tipo_tramite?.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4 text-sm text-neutral-900">{tramite.asignado_nombre || 'Sin asignar'}</td>
                  <td className="py-3 px-4 text-sm text-neutral-600">{tramite.oficina_nombre || 'N/A'}</td>
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
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleVerTramite(tramite.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      Ver
                    </button>
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

      {/* Modal de Vista Previa */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">
                  Vista Previa - {selectedTramite?.folio || 'Cargando...'}
                </h2>
                {selectedTramite && (
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="px-3 py-1 rounded-full text-sm font-semibold"
                      style={{
                        backgroundColor: selectedTramite.estatus?.color + '20',
                        color: selectedTramite.estatus?.color,
                        borderColor: selectedTramite.estatus?.color,
                        borderWidth: '1px'
                      }}
                    >
                      {selectedTramite.estatus?.nombre}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setSelectedTramite(null);
                  setPreviewTab('detalles');
                }}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-neutral-600" />
              </button>
            </div>

            {/* Tabs */}
            {selectedTramite && (
              <div className="flex space-x-2 px-6 pt-4 border-b border-neutral-200">
                {(['detalles', 'comentarios', 'archivos', 'historial'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setPreviewTab(tab)}
                    className={`px-4 py-2 font-semibold transition-all capitalize ${
                      previewTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingPreview ? (
                <div className="flex justify-center items-center h-64">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : selectedTramite ? (
                <>
                  {previewTab === 'detalles' && (
                    <TramiteDetalles
                      tramite={selectedTramite}
                      editing={false}
                      estatusList={[]}
                      selectedEstatus=""
                      setSelectedEstatus={() => {}}
                      selectedPrioridad={selectedTramite.prioridad}
                      setSelectedPrioridad={() => {}}
                    />
                  )}
                  {previewTab === 'comentarios' && (
                    <TramiteComentarios tramiteId={selectedTramite.id} />
                  )}
                  {previewTab === 'archivos' && (
                    <TramiteArchivos tramiteId={selectedTramite.id} />
                  )}
                  {previewTab === 'historial' && (
                    <TramiteHistorial tramiteId={selectedTramite.id} />
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-neutral-600">
                  Error al cargar el trámite
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Grupos */}
      {showGruposModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Gestión de Grupos de Visualización</h2>
              <button
                onClick={() => {
                  setShowGruposModal(false);
                  loadCatalogos(); // Recargar grupos después de cerrar
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <GestionGruposVisualizacion />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
