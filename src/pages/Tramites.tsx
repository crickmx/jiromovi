import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Plus, Search, AlertCircle, Clock, CheckCircle2, FileText, Settings, Users, BarChart3 } from 'lucide-react';
import { NuevoTramiteModal } from '../components/tramites/NuevoTramiteModal';
import { GestionCatalogosRegistro } from '../components/tramites/GestionCatalogosRegistro';
import { GestionGruposVisualizacion } from '../components/tramites/GestionGruposVisualizacion';
import { AgenteDashboard } from '../components/tramites/AgenteDashboard';
import {
  TIPO_TRAMITE_OPTIONS,
  getTipoTramiteLabel as centralGetLabel,
  getTipoTramiteArea,
  getTipoTramitesByArea,
  AREA_CONFIG,
} from '../lib/registroActividadesTypes';

interface TramiteEstatus {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  tipo_aplicable: string[] | null;
}

interface TramiteItem {
  id: string;
  folio: string;
  tipo_tramite: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  poliza: string | null;
  instrucciones: string;
  fecha_creacion: string;
  ultima_modificacion: string;
  cerrado_en: string | null;
  agente_id: string | null;
  creado_por: string | null;
  assigned_to_user_id: string | null;
  agente: { nombre_completo: string; oficina_id: string | null; oficina: { nombre: string } | null } | null;
  responsable: { nombre_completo: string } | null;
  estatus: TramiteEstatus | null;
  ticket_asignaciones: Array<{
    ejecutivo: { nombre_completo: string } | null;
  }>;
}

const TRAMITE_OPTIONS_FOR_FILTER = TIPO_TRAMITE_OPTIONS.filter(
  t => t.value !== 'cambio_bancario' && t.value !== 'formulario_cotizacion'
);

const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const;

export function Tramites() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'activos' | 'cerrados'>('activos');
  const [tramites, setTramites] = useState<TramiteItem[]>([]);
  const [estatusList, setEstatusList] = useState<TramiteEstatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipo, setSelectedTipo] = useState<string>('todos');
  const [selectedEstatus, setSelectedEstatus] = useState<string>('todos');
  const [selectedPrioridad, setSelectedPrioridad] = useState<string>('todas');
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [showCatalogosModal, setShowCatalogosModal] = useState(false);
  const [showGruposModal, setShowGruposModal] = useState(false);
  const [userArea, setUserArea] = useState<string | null>(null);
  const [userAreaLoaded, setUserAreaLoaded] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isAgente = usuario?.rol === 'Agente';
  const canManageCatalogs = isAdmin || isGerente;

  // Estatus filtered by selected tipo_tramite
  const filteredEstatusList = (() => {
    if (selectedTipo === 'todos') return estatusList;
    const tipoOpt = TIPO_TRAMITE_OPTIONS.find(t => t.value === selectedTipo);
    if (!tipoOpt) return estatusList;
    return estatusList.filter(e =>
      e.tipo_aplicable === null || e.tipo_aplicable.includes(tipoOpt.tipoAplicable)
    );
  })();

  // All 3 prioridades always available
  // We keep all 3 always, just show them filtered to what makes sense
  const availablePrioridades = PRIORIDADES;

  useEffect(() => {
    loadUserArea();
  }, [usuario?.id]);

  useEffect(() => {
    if (userAreaLoaded) loadData();
  }, [activeTab, userAreaLoaded]);

  // Reset estatus/prioridad when tipo changes
  useEffect(() => {
    setSelectedEstatus('todos');
    setSelectedPrioridad('todas');
  }, [selectedTipo]);

  const loadUserArea = async () => {
    if (!usuario?.id) return;
    if (isAdmin) {
      setUserArea(null);
      setUserAreaLoaded(true);
      return;
    }
    const { data } = await supabase.rpc('get_user_tramite_area', { p_user_id: usuario.id });
    setUserArea(data || null);
    setUserAreaLoaded(true);
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadEstatus(), loadTramites()]);
    setLoading(false);
  };

  const loadEstatus = async () => {
    const { data } = await supabase
      .from('ticket_estatus')
      .select('*')
      .eq('activo', true)
      .order('orden');

    if (data) setEstatusList(data);
  };

  const loadTramites = async () => {
    if (!usuario) return;

    try {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          agente:agente_id(nombre_completo, oficina_id, oficina:oficina_id(nombre)),
          responsable:assigned_to_user_id(nombre_completo),
          estatus:estatus_id(*),
          ticket_asignaciones(ejecutivo:ejecutivo_id(nombre_completo))
        `)
        .order('fecha_creacion', { ascending: false });

      if (activeTab === 'cerrados') {
        query = query.not('cerrado_en', 'is', null);
      } else {
        query = query.is('cerrado_en', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading tramites:', error);
        return;
      }

      if (data && data.length > 0) {
        const ticketIds = data.map(t => t.id);
        const { data: asignaciones } = await supabase
          .from('ticket_asignaciones')
          .select('ticket_id, ejecutivo:ejecutivo_id(nombre_completo)')
          .in('ticket_id', ticketIds);

        const tramitesWithAsignaciones = data.map(tramite => ({
          ...tramite,
          ticket_asignaciones: asignaciones?.filter(a => a.ticket_id === tramite.id) || []
        }));

        setTramites(tramitesWithAsignaciones as TramiteItem[]);
      } else {
        setTramites([]);
      }
    } catch (error) {
      console.error('Exception loading tramites:', error);
    }
  };

  const getTipoTramiteLabel = (tipo: string) => centralGetLabel(tipo);

  // Operational types that commercial employees can also view (read-only)
  const OPERATIONAL_CROSS_VISIBLE = ['correccion_comisiones', 'correccion_poliza_registrada'];

  // Visibility filter based on user's group area
  const visibleTramites = tramites.filter(tramite => {
    if (isAdmin) return true;

    if (userArea === 'Comercial') {
      const tipoArea = getTipoTramiteArea(tramite.tipo_tramite);
      const agenteOficinaId = tramite.agente?.oficina_id ?? null;
      const sameOffice = agenteOficinaId === usuario?.oficina_id;

      if (tipoArea === 'Comercial') return sameOffice;
      if (OPERATIONAL_CROSS_VISIBLE.includes(tramite.tipo_tramite)) return sameOffice;
      return false;
    }

    if (userArea === 'Operaciones') {
      const tipoArea = getTipoTramiteArea(tramite.tipo_tramite);
      return tipoArea === 'Operaciones';
    }

    // Users not in any group: see tramites they created or are assigned to
    return (
      tramite.creado_por === usuario?.id ||
      tramite.assigned_to_user_id === usuario?.id ||
      tramite.agente_id === usuario?.id
    );
  });

  const filteredTramites = visibleTramites.filter(tramite => {
    const term = (searchTerm ?? '').toLowerCase();
    const matches = (value: string | null | undefined) =>
      (value ?? '').toLowerCase().includes(term);
    const matchSearch =
      matches(tramite.folio) ||
      matches(tramite.instrucciones) ||
      matches(tramite.poliza) ||
      matches(tramite.agente?.nombre_completo) ||
      matches(tramite.responsable?.nombre_completo) ||
      matches(getTipoTramiteLabel(tramite.tipo_tramite));

    const matchTipo = selectedTipo === 'todos' || tramite.tipo_tramite === selectedTipo;
    const matchEstatus = selectedEstatus === 'todos' || tramite.estatus?.id === selectedEstatus;
    const matchPrioridad = selectedPrioridad === 'todas' || tramite.prioridad === selectedPrioridad;

    return matchSearch && matchTipo && matchEstatus && matchPrioridad;
  });

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return 'bg-red-100 text-red-700 border-red-300';
      case 'Media': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Baja': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-neutral-100 text-neutral-700 border-neutral-300';
    }
  };

  const getPrioridadIcon = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return <AlertCircle className="w-4 h-4" />;
      case 'Media': return <Clock className="w-4 h-4" />;
      case 'Baja': return <CheckCircle2 className="w-4 h-4" />;
      default: return null;
    }
  };

  const hasActiveFilters = selectedTipo !== 'todos' || selectedEstatus !== 'todos' || selectedPrioridad !== 'todas' || searchTerm !== '';

  const clearFilters = () => {
    setSelectedTipo('todos');
    setSelectedEstatus('todos');
    setSelectedPrioridad('todas');
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-accent mb-2">
              Gestión de Trámites
            </h1>
            <p className="text-neutral-600 flex items-center gap-2">
              Gestiona solicitudes y soporte interno
              {userArea && !isAdmin && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${AREA_CONFIG[userArea as keyof typeof AREA_CONFIG]?.bg} ${AREA_CONFIG[userArea as keyof typeof AREA_CONFIG]?.color}`}>
                  Vista: {userArea}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setShowGruposModal(true)}
                className="flex items-center space-x-2 bg-neutral-100 text-neutral-700 px-4 py-3 rounded-xl hover:bg-neutral-200 transition-all duration-200 font-semibold"
              >
                <Users className="w-5 h-5" />
                <span>Gestionar Equipos</span>
              </button>
            )}
            {canManageCatalogs && (
              <button
                onClick={() => setShowCatalogosModal(true)}
                className="flex items-center space-x-2 bg-neutral-100 text-neutral-700 px-4 py-3 rounded-xl hover:bg-neutral-200 transition-all duration-200 font-semibold"
              >
                <Settings className="w-5 h-5" />
                <span>Catálogos</span>
              </button>
            )}
            {(isAdmin || isGerente) && (
              <button
                onClick={() => navigate('/tramites/reportes')}
                className="flex items-center space-x-2 bg-neutral-100 text-neutral-700 px-4 py-3 rounded-xl hover:bg-neutral-200 transition-all duration-200 font-semibold"
              >
                <BarChart3 className="w-5 h-5" />
                <span>Reportes</span>
              </button>
            )}
            <button
              onClick={() => navigate('/tramites/formularios')}
              className="flex items-center space-x-2 bg-neutral-100 text-neutral-700 px-4 py-3 rounded-xl hover:bg-neutral-200 transition-all duration-200 font-semibold"
            >
              <FileText className="w-5 h-5" />
              <span>Formularios</span>
            </button>
            <button
              onClick={() => setShowNuevoModal(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-5 py-3 rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold"
            >
              <Plus className="w-5 h-5" />
              <span>Nuevo Trámite</span>
            </button>
          </div>
        </div>

        <div className="flex space-x-2 border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('activos')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'activos'
                ? 'text-accent border-b-2 border-accent'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ClipboardList className="w-5 h-5" />
              <span>Trámites Activos</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('cerrados')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'cerrados'
                ? 'text-accent border-b-2 border-accent'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Trámites Concluidos</span>
            </div>
          </button>
        </div>
      </div>

      {isAgente && <AgenteDashboard />}

      {/* KPI Summary for non-agent users */}
      {!isAgente && visibleTramites.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(() => {
            const activos = visibleTramites.filter(t => !t.cerrado_en);
            const byType: Record<string, number> = {};
            for (const t of activos) {
              byType[t.tipo_tramite] = (byType[t.tipo_tramite] || 0) + 1;
            }
            const kpiTypes = TIPO_TRAMITE_OPTIONS.filter(
              opt => opt.value !== 'cambio_bancario'
            );
            const kpis = kpiTypes
              .map(opt => ({ ...opt, count: byType[opt.value] || 0 }))
              .filter(k => k.count > 0);

            if (kpis.length === 0) return null;

            return kpis.map(kpi => {
              const ac = AREA_CONFIG[kpi.area];
              return (
                <button
                  key={kpi.value}
                  onClick={() => setSelectedTipo(kpi.value)}
                  className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${
                    selectedTipo === kpi.value
                      ? `${ac.bg} ${ac.border} ring-2 ring-offset-1 ring-current ${ac.color}`
                      : 'bg-white border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <p className="text-2xl font-bold text-neutral-900">{kpi.count}</p>
                  <p className={`text-xs font-medium mt-0.5 ${ac.color}`}>{kpi.label}</p>
                </button>
              );
            });
          })()}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-4">
        <div className="flex flex-col gap-3">
          {/* Search row */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por folio, descripción, póliza o agente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
            />
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Tipo de trámite */}
            <div className="flex flex-col gap-1 min-w-[200px] flex-1">
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1">
                Tipo de trámite
              </label>
              <select
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all text-sm bg-white"
              >
                <option value="todos">Todos los tipos</option>
                <optgroup label="Comercial">
                  {getTipoTramitesByArea('Comercial').filter(t => TRAMITE_OPTIONS_FOR_FILTER.some(f => f.value === t.value)).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Operaciones">
                  {getTipoTramitesByArea('Operaciones').filter(t => TRAMITE_OPTIONS_FOR_FILTER.some(f => f.value === t.value)).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Estatus — filtered by tipo */}
            <div className="flex flex-col gap-1 min-w-[180px] flex-1">
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1">
                Estatus
                {selectedTipo !== 'todos' && (
                  <span className="ml-1 text-accent normal-case font-normal">
                    ({filteredEstatusList.length} disponibles)
                  </span>
                )}
              </label>
              <select
                value={selectedEstatus}
                onChange={(e) => setSelectedEstatus(e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all text-sm bg-white"
              >
                <option value="todos">Todos los estatus</option>
                {filteredEstatusList.map(estatus => (
                  <option key={estatus.id} value={estatus.id}>{estatus.nombre}</option>
                ))}
              </select>
            </div>

            {/* Prioridad */}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1">
                Prioridad
              </label>
              <select
                value={selectedPrioridad}
                onChange={(e) => setSelectedPrioridad(e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all text-sm bg-white"
              >
                <option value="todas">Todas las prioridades</option>
                {availablePrioridades.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-transparent select-none">.</label>
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all whitespace-nowrap"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {/* Active filter summary */}
          {selectedTipo !== 'todos' && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 pt-1 border-t border-neutral-100">
              <span className="font-medium">Filtrando por tipo:</span>
              <span className={`px-2 py-0.5 rounded-full font-semibold ${AREA_CONFIG[getTipoTramiteArea(selectedTipo)].bg} ${AREA_CONFIG[getTipoTramiteArea(selectedTipo)].color}`}>
                {getTipoTramiteLabel(selectedTipo)}
              </span>
              <span className="text-neutral-400">
                ({getTipoTramiteArea(selectedTipo)}) — Mostrando {filteredEstatusList.length} estatus aplicables
              </span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredTramites.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-12 text-center">
          <ClipboardList className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-neutral-700 mb-2">
            {hasActiveFilters ? 'Sin resultados para los filtros aplicados' : `No hay trámites ${activeTab === 'cerrados' ? 'concluidos' : 'activos'}`}
          </h3>
          <p className="text-neutral-500">
            {hasActiveFilters
              ? 'Intenta ajustar o limpiar los filtros de búsqueda'
              : activeTab === 'activos' ? 'Crea tu primer trámite para comenzar' : 'No tienes trámites concluidos'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 text-sm text-accent border border-accent rounded-lg hover:bg-accent/5 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Results count */}
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-neutral-500">
              {filteredTramites.length} {filteredTramites.length === 1 ? 'trámite' : 'trámites'}
              {hasActiveFilters && ' encontrados'}
            </p>
          </div>

          {filteredTramites.map(tramite => (
            <div
              key={tramite.id}
              onClick={() => navigate(`/tramites/${tramite.id}`)}
              className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-5 hover:shadow-medium transition-all duration-200 cursor-pointer"
            >
              <div className="space-y-3">
                {/* Primera línea: Folio + Fecha */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-lg font-bold text-accent">{tramite.folio}</span>
                  </div>
                  <div className="text-right text-sm text-neutral-500 ml-4 flex-shrink-0">
                    <div>
                      {new Date(tramite.fecha_creacion).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="text-xs mt-1">
                      {new Date(tramite.fecha_creacion).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                {/* Segunda línea: Badges y etiquetas */}
                <div className="flex items-center flex-wrap gap-2">
                  {(() => {
                    const area = getTipoTramiteArea(tramite.tipo_tramite);
                    const ac = AREA_CONFIG[area];
                    return (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${ac.bg} ${ac.color} ${ac.border}`}>
                        {getTipoTramiteLabel(tramite.tipo_tramite)}
                      </span>
                    );
                  })()}
                  {tramite.estatus && (
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold border"
                      style={{
                        backgroundColor: tramite.estatus.color + '20',
                        color: tramite.estatus.color,
                        borderColor: tramite.estatus.color,
                      }}
                    >
                      {tramite.estatus.nombre}
                    </span>
                  )}
                  <span className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold border ${getPrioridadColor(tramite.prioridad)}`}>
                    {getPrioridadIcon(tramite.prioridad)}
                    <span>{tramite.prioridad}</span>
                  </span>
                </div>

                {/* Tercera línea: Descripción */}
                <p className="text-neutral-900 font-medium line-clamp-2">
                  {tramite.instrucciones}
                </p>

                {/* Cuarta línea: Información adicional */}
                <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
                  <span className="flex items-center space-x-1">
                    <span className="font-medium">Agente:</span>
                    <span>{tramite.agente?.nombre_completo || 'Sin asignar'}</span>
                  </span>
                  {tramite.poliza && (
                    <span className="flex items-center space-x-1">
                      <FileText className="w-4 h-4" />
                      <span className="font-medium">Póliza:</span>
                      <span>{tramite.poliza}</span>
                    </span>
                  )}
                  <span className="flex items-center space-x-1">
                    <span className="font-medium">Responsable:</span>
                    <span>{tramite.responsable?.nombre_completo || 'Sin asignar'}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NuevoTramiteModal
        isOpen={showNuevoModal}
        onClose={() => setShowNuevoModal(false)}
        onSuccess={() => {
          setShowNuevoModal(false);
          loadData();
        }}
        estatusList={estatusList}
      />

      {showCatalogosModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Catálogos de Trámites</h2>
                <p className="text-sm text-neutral-500 mt-1">Gestiona los tipos de seguro disponibles en los trámites</p>
              </div>
              <button
                onClick={() => setShowCatalogosModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-500 hover:text-neutral-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <GestionCatalogosRegistro />
            </div>
          </div>
        </div>
      )}

      {showGruposModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Gestión de Equipos de Trabajo</h2>
                <p className="text-sm text-neutral-500 mt-1">Asigna usuarios a los equipos para controlar la visibilidad de trámites</p>
              </div>
              <button
                onClick={() => setShowGruposModal(false)}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-500 hover:text-neutral-700"
              >
                <span className="sr-only">Cerrar</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <GestionGruposVisualizacion />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
