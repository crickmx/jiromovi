import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart3, TrendingUp, Clock, CheckCircle2, AlertCircle, Users, Building2,
  Filter, Download, Search, ChevronDown, Eye, X,
  AlertTriangle, Flame, Timer, Inbox, Activity, Target
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TramiteDetalles } from '../components/tramites/TramiteDetalles';
import { TramiteComentarios } from '../components/tramites/TramiteComentarios';
import { TramiteArchivos } from '../components/tramites/TramiteArchivos';
import { TramiteHistorial } from '../components/tramites/TramiteHistorial';
import { GestionGruposVisualizacion } from '../components/tramites/GestionGruposVisualizacion';
import { ConversionDashboard } from '../components/tramites/ConversionDashboard';
import {
  TIPO_TRAMITE_OPTIONS as CENTRAL_TIPO_OPTIONS,
  getTipoTramiteLabel as centralGetLabel,
  getTipoTramiteArea,
  getTipoTramitesByArea,
  AREA_CONFIG,
  type AreaCategoria,
} from '../lib/registroActividadesTypes';

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
  const [expandedTipo, setExpandedTipo] = useState<string | null>('cotizacion_emision');

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

  const getTipoTramiteLabel = (tipo: string) => centralGetLabel(tipo);

  const tiposTramite = CENTRAL_TIPO_OPTIONS.map(t => t.value);
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

  // SLA en días para considerar un trámite como vencido
  const SLA_DIAS = 7;
  const ahora = new Date();
  const diasDesde = (iso: string) =>
    (ahora.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);

  const tramitesAbiertos = tramites.filter(t => t.estatus_calculado !== 'Finalizado');
  const tramitesVencidos = tramitesAbiertos.filter(t => diasDesde(t.fecha_solicitud) > SLA_DIAS);
  const altaPrioridadAbierta = tramitesAbiertos.filter(t => t.prioridad === 'Alta');
  const altaPrioridadVencida = altaPrioridadAbierta.filter(t => diasDesde(t.fecha_solicitud) > SLA_DIAS);
  const antiguedadMaxDias = tramitesAbiertos.reduce(
    (max, t) => Math.max(max, diasDesde(t.fecha_solicitud)),
    0
  );
  const backlog = tramitesAbiertos.length;

  // Tiempo promedio de resolución por tipo
  const tiempoResolucionPorTipo = tiposTramite
    .map(tipo => {
      const cerradosTipo = tramites.filter(
        t => t.tipo_tramite === tipo && t.tiempo_resolucion_dias !== null
      );
      if (cerradosTipo.length === 0) return null;
      const promedio =
        cerradosTipo.reduce((s, t) => s + (t.tiempo_resolucion_dias || 0), 0) /
        cerradosTipo.length;
      return { tipo, promedio, cantidad: cerradosTipo.length };
    })
    .filter((x): x is { tipo: string; promedio: number; cantidad: number } => x !== null)
    .sort((a, b) => b.promedio - a.promedio);

  // Distribución por prioridad
  const porPrioridad = prioridadOptions.map(p => ({
    prioridad: p,
    cantidad: tramites.filter(t => t.prioridad === p).length,
    abiertos: tramitesAbiertos.filter(t => t.prioridad === p).length,
  }));

  // Tendencia últimas 8 semanas: creados vs finalizados
  const semanasTendencia = (() => {
    const buckets: Array<{ label: string; inicio: Date; fin: Date; creados: number; finalizados: number }> = [];
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    for (let i = 7; i >= 0; i--) {
      const fin = new Date(hoy);
      fin.setDate(hoy.getDate() - i * 7);
      const inicio = new Date(fin);
      inicio.setDate(fin.getDate() - 6);
      inicio.setHours(0, 0, 0, 0);
      buckets.push({
        label: `${inicio.getDate()}/${inicio.getMonth() + 1}`,
        inicio,
        fin,
        creados: 0,
        finalizados: 0,
      });
    }
    tramites.forEach(t => {
      const creada = new Date(t.fecha_solicitud);
      const b1 = buckets.find(b => creada >= b.inicio && creada <= b.fin);
      if (b1) b1.creados += 1;
      if (t.fecha_finalizacion) {
        const fin = new Date(t.fecha_finalizacion);
        const b2 = buckets.find(b => fin >= b.inicio && fin <= b.fin);
        if (b2) b2.finalizados += 1;
      }
    });
    return buckets;
  })();
  const maxSemana = Math.max(
    1,
    ...semanasTendencia.map(b => Math.max(b.creados, b.finalizados))
  );
  const maxTiempoResolucion = Math.max(1, ...tiempoResolucionPorTipo.map(t => t.promedio));

  // KPIs por tipo de trámite
  const kpisPorTipo = tiposTramite.map(tipo => {
    const delTipo = tramites.filter(t => t.tipo_tramite === tipo);
    const abiertos = delTipo.filter(t => t.estatus_calculado !== 'Finalizado');
    const cerrados = delTipo.filter(t => t.estatus_calculado === 'Finalizado');
    const vencidos = abiertos.filter(t => diasDesde(t.fecha_solicitud) > SLA_DIAS);
    const conTiempo = delTipo.filter(t => t.tiempo_resolucion_dias !== null);
    const tiempoPromedio = conTiempo.length > 0
      ? conTiempo.reduce((s, t) => s + (t.tiempo_resolucion_dias || 0), 0) / conTiempo.length
      : 0;
    const porcentajeFinalizacion = delTipo.length > 0
      ? (cerrados.length / delTipo.length) * 100
      : 0;
    return {
      tipo,
      total: delTipo.length,
      abiertos: abiertos.length,
      cerrados: cerrados.length,
      vencidos: vencidos.length,
      tiempoPromedio,
      porcentajeFinalizacion,
    };
  });

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
              <optgroup label="Comercial">
                {getTipoTramitesByArea('Comercial').map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Operaciones">
                {getTipoTramitesByArea('Operaciones').map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
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

      {/* Alerta crítica */}
      {altaPrioridadVencida.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border-l-4 border-red-500 rounded-xl p-5 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-base font-semibold text-red-900">
              Atención: {altaPrioridadVencida.length} trámite{altaPrioridadVencida.length !== 1 ? 's' : ''} de alta prioridad vencido{altaPrioridadVencida.length !== 1 ? 's' : ''}
            </h4>
            <p className="text-sm text-red-700 mt-1">
              Superan el SLA de {SLA_DIAS} días sin finalizarse. Requieren atención inmediata.
            </p>
          </div>
        </div>
      )}

      {/* Salud Operativa */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Activity className="w-6 h-6 text-accent" />
          Salud Operativa
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Backlog abierto</span>
              <Inbox className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">{backlog}</div>
            <p className="text-xs text-neutral-500 mt-1">Pendientes + En Proceso</p>
          </div>

          <div className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${tramitesVencidos.length > 0 ? 'border-red-500' : 'border-neutral-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Vencidos (&gt;{SLA_DIAS}d)</span>
              <AlertTriangle className={`w-5 h-5 ${tramitesVencidos.length > 0 ? 'text-red-500' : 'text-neutral-400'}`} />
            </div>
            <div className={`text-3xl font-bold ${tramitesVencidos.length > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
              {tramitesVencidos.length}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              {backlog > 0 ? `${((tramitesVencidos.length / backlog) * 100).toFixed(0)}% del backlog` : 'Sin abiertos'}
            </p>
          </div>

          <div className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${altaPrioridadAbierta.length > 0 ? 'border-orange-500' : 'border-neutral-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Alta prioridad abierta</span>
              <Flame className={`w-5 h-5 ${altaPrioridadAbierta.length > 0 ? 'text-orange-500' : 'text-neutral-400'}`} />
            </div>
            <div className="text-3xl font-bold text-neutral-900">{altaPrioridadAbierta.length}</div>
            <p className="text-xs text-neutral-500 mt-1">
              {altaPrioridadVencida.length > 0
                ? `${altaPrioridadVencida.length} vencido${altaPrioridadVencida.length !== 1 ? 's' : ''}`
                : 'Dentro del SLA'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">Más antiguo abierto</span>
              <Timer className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-neutral-900">
              {antiguedadMaxDias.toFixed(0)}
              <span className="text-base text-neutral-500 ml-1">días</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">Trámite abierto más viejo</p>
          </div>
        </div>
      </div>

      {/* Tendencia y prioridad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">
            Tendencia de carga (últimas 8 semanas)
          </h3>
          <div className="space-y-2">
            {semanasTendencia.map((b, idx) => (
              <div key={idx} className="flex items-center gap-3 text-xs">
                <span className="w-12 text-neutral-500 font-mono">{b.label}</span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-100 rounded h-3 relative overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded"
                        style={{ width: `${(b.creados / maxSemana) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-neutral-700 font-semibold">{b.creados}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-100 rounded h-3 relative overflow-hidden">
                      <div
                        className="bg-green-500 h-full rounded"
                        style={{ width: `${(b.finalizados / maxSemana) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-neutral-700 font-semibold">{b.finalizados}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-neutral-600">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" /> Creados
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-500 rounded-sm inline-block" /> Finalizados
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Distribución por prioridad</h3>
          <div className="space-y-4">
            {porPrioridad.map((item, idx) => {
              const color =
                item.prioridad === 'Alta' ? 'bg-red-500' :
                item.prioridad === 'Media' ? 'bg-amber-500' : 'bg-green-500';
              const total = tramites.length || 1;
              return (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-700 font-medium">{item.prioridad}</span>
                    <span className="text-neutral-600">
                      <span className="font-semibold text-neutral-900">{item.cantidad}</span>
                      {' · '}
                      <span className="text-xs">{item.abiertos} abiertos</span>
                    </span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div
                      className={`${color} h-2 rounded-full`}
                      style={{ width: `${(item.cantidad / total) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tiempo promedio de resolución por tipo */}
      {tiempoResolucionPorTipo.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-neutral-600" />
            <h3 className="text-lg font-semibold text-neutral-900">
              Tiempo promedio de resolución por tipo
            </h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">
            Identifica los tipos de trámite que tardan más en cerrarse
          </p>
          <div className="space-y-3">
            {tiempoResolucionPorTipo.map(item => (
              <div key={item.tipo}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-700">{getTipoTramiteLabel(item.tipo)}</span>
                  <span className="text-neutral-900">
                    <span className="font-semibold">{item.promedio.toFixed(1)}</span>
                    <span className="text-neutral-500 ml-1">días</span>
                    <span className="text-xs text-neutral-400 ml-2">({item.cantidad} cerrados)</span>
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full"
                    style={{ width: `${(item.promedio / maxTiempoResolucion) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análisis por Tipo de Trámite */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-neutral-900">Análisis por Tipo de Trámite</h2>
        </div>
        <p className="text-sm text-neutral-500 mb-5">
          KPIs individuales por cada tipo de trámite. Haz clic en una tarjeta para ver el desglose.
        </p>

        {(['Comercial', 'Operaciones'] as AreaCategoria[]).map(area => {
          const areaItems = kpisPorTipo.filter(item => getTipoTramiteArea(item.tipo) === area);
          if (areaItems.length === 0) return null;
          const ac = AREA_CONFIG[area];
          return (
            <div key={area} className="mb-6 last:mb-0">
              <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg ${ac.bg} border ${ac.border}`}>
                <span className={`text-sm font-bold ${ac.color}`}>{area}</span>
                <span className="text-xs text-neutral-500">
                  ({areaItems.reduce((sum, i) => sum + i.total, 0)} trámites)
                </span>
              </div>
              <div className="space-y-3">
        {areaItems.map(item => {
            const isExpanded = expandedTipo === item.tipo;
            const isCotizacion = item.tipo === 'cotizacion_emision';
            const porcentajeColor =
              item.porcentajeFinalizacion >= 70 ? 'text-green-600' :
              item.porcentajeFinalizacion >= 40 ? 'text-amber-600' : 'text-red-600';
            return (
              <div
                key={item.tipo}
                className={`border rounded-xl overflow-hidden transition-all ${
                  isExpanded ? 'border-blue-400 shadow-md' : 'border-neutral-200'
                }`}
              >
                <button
                  onClick={() => setExpandedTipo(isExpanded ? null : item.tipo)}
                  className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className={`p-2 rounded-lg ${isCotizacion ? 'bg-blue-100' : 'bg-neutral-100'}`}>
                      {isCotizacion
                        ? <TrendingUp className="w-5 h-5 text-blue-600" />
                        : <BarChart3 className="w-5 h-5 text-neutral-600" />}
                    </div>
                    <div>
                      <div className="font-semibold text-neutral-900">{getTipoTramiteLabel(item.tipo)}</div>
                      <div className="text-xs text-neutral-500">
                        {item.total} totales · {item.abiertos} abiertos · {item.cerrados} cerrados
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="hidden md:flex items-center gap-5 text-sm">
                      {item.vencidos > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                          <AlertTriangle className="w-4 h-4" />
                          {item.vencidos} vencidos
                        </span>
                      )}
                      <span className="text-neutral-600">
                        <span className="font-semibold text-neutral-900">{item.tiempoPromedio.toFixed(1)}</span>
                        <span className="text-xs ml-1">días prom.</span>
                      </span>
                      <span className={`font-bold ${porcentajeColor}`}>
                        {item.porcentajeFinalizacion.toFixed(0)}%
                      </span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-neutral-200 p-5 bg-neutral-50/50 space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <div className="text-xs text-neutral-600">Total</div>
                        <div className="text-2xl font-bold text-neutral-900">{item.total}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <div className="text-xs text-neutral-600">Abiertos</div>
                        <div className="text-2xl font-bold text-blue-600">{item.abiertos}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <div className="text-xs text-neutral-600">Cerrados</div>
                        <div className="text-2xl font-bold text-green-600">{item.cerrados}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <div className="text-xs text-neutral-600">Vencidos</div>
                        <div className={`text-2xl font-bold ${item.vencidos > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
                          {item.vencidos}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <div className="text-xs text-neutral-600">Tiempo prom.</div>
                        <div className="text-2xl font-bold text-neutral-900">
                          {item.tiempoPromedio.toFixed(1)}
                          <span className="text-sm text-neutral-500 ml-1">d</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <div className="text-xs text-neutral-600">% Finalización</div>
                        <div className={`text-2xl font-bold ${porcentajeColor}`}>
                          {item.porcentajeFinalizacion.toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    {isCotizacion && fechaInicio && fechaFin && (
                      <div className="bg-white rounded-lg p-5 border border-blue-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Target className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-neutral-900">Conversión: Cotizaciones y Emisiones</h3>
                        </div>
                        <ConversionDashboard
                          fechaInicio={fechaInicio}
                          fechaFin={fechaFin}
                          oficinaId={oficinaFiltro || undefined}
                          usuarioId={usuarioFiltro || undefined}
                        />
                      </div>
                    )}

                    {item.total === 0 && !isCotizacion && (
                      <div className="text-center text-sm text-neutral-500 py-4">
                        No hay trámites de este tipo en el período seleccionado
                      </div>
                    )}

                    {item.total > 0 && (() => {
                      const listaTipo = tramites
                        .filter(t => t.tipo_tramite === item.tipo)
                        .sort((a, b) => new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime());
                      const MAX_INLINE = 20;
                      const visibles = listaTipo.slice(0, MAX_INLINE);
                      return (
                        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
                            <h4 className="text-sm font-semibold text-neutral-900">
                              Trámites de este tipo
                              <span className="ml-2 text-xs font-normal text-neutral-500">
                                {visibles.length} de {listaTipo.length}
                              </span>
                            </h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-neutral-50">
                                <tr>
                                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Folio / Solicitante</th>
                                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Agente</th>
                                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Oficina</th>
                                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Prioridad</th>
                                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Estatus</th>
                                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-700">Fecha</th>
                                  <th className="text-center py-2 px-3 text-xs font-semibold text-neutral-700">Tiempo</th>
                                  <th className="text-center py-2 px-3 text-xs font-semibold text-neutral-700">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {visibles.map((tramite) => (
                                  <tr key={tramite.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                                    <td className="py-2 px-3">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-mono text-blue-700 font-semibold">{tramite.folio}</span>
                                        <span className="text-xs text-neutral-600">{tramite.solicitante_nombre}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-sm text-neutral-700">{tramite.asignado_nombre || 'Sin asignar'}</td>
                                    <td className="py-2 px-3 text-sm text-neutral-600">{tramite.oficina_nombre || 'N/A'}</td>
                                    <td className="py-2 px-3">
                                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                        tramite.prioridad === 'Alta' ? 'bg-red-100 text-red-700' :
                                        tramite.prioridad === 'Media' ? 'bg-amber-100 text-amber-700' :
                                        'bg-neutral-100 text-neutral-700'
                                      }`}>
                                        {tramite.prioridad}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                                        tramite.estatus_calculado === 'Finalizado' ? 'bg-green-100 text-green-700' :
                                        tramite.estatus_calculado === 'En Proceso' ? 'bg-orange-100 text-orange-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {tramite.estatus_calculado}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-xs text-neutral-600">
                                      {new Date(tramite.fecha_solicitud).toLocaleDateString('es-MX')}
                                    </td>
                                    <td className="py-2 px-3 text-center text-xs text-neutral-700">
                                      {tramite.tiempo_resolucion_dias != null
                                        ? `${tramite.tiempo_resolucion_dias.toFixed(1)} d`
                                        : '—'}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        onClick={() => handleVerTramite(tramite.id)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                                      >
                                        <Eye className="w-3 h-3" />
                                        Ver detalles
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {listaTipo.length > MAX_INLINE && (
                            <div className="px-4 py-2 text-xs text-neutral-500 bg-neutral-50 border-t border-neutral-200">
                              Mostrando los {MAX_INLINE} más recientes. Usa la tabla "Detalle de Trámites" para ver el listado completo.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfica de Tipos de Trámite */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Trámites por Tipo</h3>
          <div className="space-y-4">
            {(['Comercial', 'Operaciones'] as AreaCategoria[]).map(area => {
              const items = tramitesPorTipo.filter(i => getTipoTramiteArea(i.tipo) === area);
              if (items.length === 0) return null;
              const ac = AREA_CONFIG[area];
              const maxVal = Math.max(1, ...tramitesPorTipo.map(t => t.cantidad));
              return (
                <div key={area}>
                  <div className={`text-xs font-bold mb-2 px-2 py-1 rounded ${ac.bg} ${ac.color} inline-block`}>{area}</div>
                  <div className="space-y-2 mb-2">
                    {items.map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-neutral-700">{getTipoTramiteLabel(item.tipo)}</span>
                          <span className="font-semibold">{item.cantidad}</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${area === 'Comercial' ? 'bg-sky-500' : 'bg-amber-500'}`}
                            style={{ width: `${(item.cantidad / maxVal) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
