import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Plus, Search, AlertCircle, Clock, CheckCircle2, FileText, Settings, Users, BarChart3, X } from 'lucide-react';
import { NuevoTramiteModal } from '../components/tramites/NuevoTramiteModal';
import { GestionCatalogosRegistro } from '../components/tramites/GestionCatalogosRegistro';
import { GestionGruposVisualizacion } from '../components/tramites/GestionGruposVisualizacion';
import { AgenteDashboard } from '../components/tramites/AgenteDashboard';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
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
  t => t.value !== 'cambio_bancario'
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
  // scope: area → allowed office IDs (null = all offices for that area)
  const [userScope, setUserScope] = useState<Array<{ area_categoria: string; office_ids: string[] | null; all_offices: boolean }>>([]);

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
      setUserScope([]);
      setUserAreaLoaded(true);
      return;
    }
    // Use new scope function that returns area + office IDs
    const { data: scopeData } = await supabase.rpc('get_user_tramite_scope', { p_user_id: usuario.id });
    if (scopeData && scopeData.length > 0) {
      setUserScope(scopeData);
      // Derive primary area for display (first area found, or 'both' if multi-area)
      const areas = [...new Set((scopeData as Array<{ area_categoria: string }>).map(s => s.area_categoria))];
      setUserArea(areas.length === 1 ? areas[0] : 'Ambas');
    } else {
      // Fallback to legacy function
      const { data } = await supabase.rpc('get_user_tramite_area', { p_user_id: usuario.id });
      setUserArea(data || null);
      setUserScope([]);
    }
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

  // Visibility filter:
  // - Comercial tramites: visible to users of the SAME office (by role, no team needed)
  // - Operaciones tramites: visible via Operaciones team membership (team controls which offices)
  // - Admins see everything
  const visibleTramites = tramites.filter(tramite => {
    if (isAdmin) return true;

    const tramiteOficinaId = tramite.agente?.oficina_id ?? null;
    const tipoArea = getTipoTramiteArea(tramite.tipo_tramite);

    // Always show tramites the user created or is directly assigned to
    const isDirectlyInvolved =
      tramite.creado_por === usuario?.id ||
      tramite.assigned_to_user_id === usuario?.id ||
      tramite.agente_id === usuario?.id;

    // ── Comercial area: role+office based, no team required ──
    if (tipoArea === 'Comercial') {
      // Gerentes see their own office's commercial tramites
      if (isGerente) return tramiteOficinaId === usuario?.oficina_id;
      // Empleados/Agentes see commercial tramites of their office
      return tramiteOficinaId === usuario?.oficina_id || isDirectlyInvolved;
    }

    // ── Operaciones area: team-based scope ──
    // Gerentes also see their office's operaciones tramites without needing a team
    if (isGerente && tramiteOficinaId === usuario?.oficina_id) return true;

    // Check Operaciones team scope
    const opsScopes = userScope.filter(s => s.area_categoria === 'Operaciones');
    if (opsScopes.length > 0) {
      for (const scope of opsScopes) {
        if (scope.all_offices) return true;
        const officeIds = scope.office_ids || [];
        if (tramiteOficinaId && officeIds.includes(tramiteOficinaId)) return true;
      }
      return isDirectlyInvolved;
    }

    // Legacy fallback for users with userArea set but no scope array
    if (userArea === 'Operaciones') return true;

    // No team, no special role: only see own tramites
    return isDirectlyInvolved;
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
    <div className="space-y-5">
      <PageHeader
        title="Gestion de Tramites"
        description="Gestiona solicitudes y soporte interno"
        icon={ClipboardList}
        badge={userArea && !isAdmin ? (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${AREA_CONFIG[userArea as keyof typeof AREA_CONFIG]?.bg} ${AREA_CONFIG[userArea as keyof typeof AREA_CONFIG]?.color}`}>
            {userArea}
          </span>
        ) : undefined}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setShowGruposModal(true)}>
                <Users className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Equipos</span>
              </Button>
            )}
            {canManageCatalogs && (
              <Button variant="outline" size="sm" onClick={() => setShowCatalogosModal(true)}>
                <Settings className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Catalogos</span>
              </Button>
            )}
            {(isAdmin || isGerente) && (
              <Button variant="outline" size="sm" onClick={() => navigate('/tramites/reportes')}>
                <BarChart3 className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Reportes</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/cotizar/formularios')}>
              <FileText className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Formularios</span>
            </Button>
            <Button size="sm" onClick={() => setShowNuevoModal(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nuevo
            </Button>
          </div>
        }
      >
        {/* Tabs */}
        <div className="flex gap-1 border-b border-neutral-200 dark:border-white/8">
          <button
            onClick={() => setActiveTab('activos')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === 'activos'
                ? 'text-accent border-accent'
                : 'text-neutral-500 dark:text-white/50 border-transparent hover:text-neutral-700 dark:hover:text-white/70'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Activos
          </button>
          <button
            onClick={() => setActiveTab('cerrados')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === 'cerrados'
                ? 'text-accent border-accent'
                : 'text-neutral-500 dark:text-white/50 border-transparent hover:text-neutral-700 dark:hover:text-white/70'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Concluidos
          </button>
        </div>
      </PageHeader>

      {isAgente && <AgenteDashboard />}

      {/* KPI Summary for non-agent users */}
      {!isAgente && visibleTramites.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
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
                  className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                    selectedTipo === kpi.value
                      ? `${ac.bg} ${ac.border} ring-2 ring-offset-1 ring-current ${ac.color}`
                      : 'bg-white dark:bg-neutral-800/50 border-neutral-200 dark:border-white/8 hover:border-neutral-300 dark:hover:border-white/15 hover:shadow-sm'
                  }`}
                >
                  <p className="text-2xl font-bold text-neutral-900 dark:text-white">{kpi.count}</p>
                  <p className={`text-xs font-medium mt-0.5 ${ac.color}`}>{kpi.label}</p>
                </button>
              );
            });
          })()}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-white/30 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por folio, descripcion, poliza o agente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-neutral-400 dark:placeholder:text-white/30 text-neutral-900 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 items-end">
            <div className="flex flex-col gap-1 min-w-[180px] flex-1">
              <label className="text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider px-0.5">
                Tipo
              </label>
              <select
                value={selectedTipo}
                onChange={(e) => setSelectedTipo(e.target.value)}
                className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
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

            <div className="flex flex-col gap-1 min-w-[160px] flex-1">
              <label className="text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider px-0.5">
                Estatus
              </label>
              <select
                value={selectedEstatus}
                onChange={(e) => setSelectedEstatus(e.target.value)}
                className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
              >
                <option value="todos">Todos</option>
                {filteredEstatusList.map(estatus => (
                  <option key={estatus.id} value={estatus.id}>{estatus.nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider px-0.5">
                Prioridad
              </label>
              <select
                value={selectedPrioridad}
                onChange={(e) => setSelectedPrioridad(e.target.value)}
                className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
              >
                <option value="todas">Todas</option>
                {availablePrioridades.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-600 dark:text-white/60 bg-neutral-100 dark:bg-white/8 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/12 transition-colors"
              >
                <X className="w-3 h-3" />
                Limpiar
              </button>
            )}
          </div>

          {selectedTipo !== 'todos' && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-white/40 pt-2 border-t border-neutral-100 dark:border-white/5">
              <span className="font-medium">Filtro:</span>
              <span className={`px-2 py-0.5 rounded-full font-semibold ${AREA_CONFIG[getTipoTramiteArea(selectedTipo)].bg} ${AREA_CONFIG[getTipoTramiteArea(selectedTipo)].color}`}>
                {getTipoTramiteLabel(selectedTipo)}
              </span>
              <span className="text-neutral-400 dark:text-white/30">
                {filteredEstatusList.length} estatus
              </span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState text="Cargando tramites..." />
      ) : filteredTramites.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasActiveFilters ? 'Sin resultados' : `No hay tramites ${activeTab === 'cerrados' ? 'concluidos' : 'activos'}`}
          description={hasActiveFilters
            ? 'Intenta ajustar o limpiar los filtros'
            : activeTab === 'activos' ? 'Crea tu primer tramite para comenzar' : 'No tienes tramites concluidos'}
          action={hasActiveFilters ? { label: 'Limpiar filtros', onClick: clearFilters, variant: 'outline' } : undefined}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-neutral-500 dark:text-white/40 font-medium">
              {filteredTramites.length} {filteredTramites.length === 1 ? 'tramite' : 'tramites'}
              {hasActiveFilters && ' encontrados'}
            </p>
          </div>

          {filteredTramites.map(tramite => (
            <div
              key={tramite.id}
              onClick={() => navigate(`/tramites/${tramite.id}`)}
              className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4 sm:p-5 hover:border-neutral-300 dark:hover:border-white/15 hover:shadow-sm transition-all duration-200 cursor-pointer group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-accent">{tramite.folio}</span>
                  <span className="text-xs text-neutral-400 dark:text-white/30">
                    {new Date(tramite.fecha_creacion).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-1.5">
                  {(() => {
                    const area = getTipoTramiteArea(tramite.tipo_tramite);
                    const ac = AREA_CONFIG[area];
                    return (
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${ac.bg} ${ac.color}`}>
                        {getTipoTramiteLabel(tramite.tipo_tramite)}
                      </span>
                    );
                  })()}
                  {tramite.estatus && (
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                      style={{
                        backgroundColor: tramite.estatus.color + '15',
                        color: tramite.estatus.color,
                      }}
                    >
                      {tramite.estatus.nombre}
                    </span>
                  )}
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${getPrioridadColor(tramite.prioridad)}`}>
                    {getPrioridadIcon(tramite.prioridad)}
                    <span>{tramite.prioridad}</span>
                  </span>
                </div>

                <p className="text-sm text-neutral-800 dark:text-white/80 font-medium line-clamp-2">
                  {tramite.instrucciones}
                </p>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-white/40">
                  <span>
                    <span className="font-medium">Agente:</span> {tramite.agente?.nombre_completo || 'Sin asignar'}
                  </span>
                  {tramite.poliza && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {tramite.poliza}
                    </span>
                  )}
                  <span>
                    <span className="font-medium">Responsable:</span> {tramite.responsable?.nombre_completo || 'Sin asignar'}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-hidden flex flex-col border border-neutral-200/60 dark:border-white/10">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-white/5">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Catalogos de Tramites</h2>
                <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">Gestiona los tipos de seguro disponibles</p>
              </div>
              <button
                onClick={() => setShowCatalogosModal(false)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-white/8 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600 dark:text-white/40 dark:hover:text-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <GestionCatalogosRegistro />
            </div>
          </div>
        </div>
      )}

      {showGruposModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-6xl my-8 max-h-[90vh] overflow-hidden flex flex-col border border-neutral-200/60 dark:border-white/10">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-white/5">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Equipos de Trabajo</h2>
                <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">Asigna usuarios para controlar la visibilidad de tramites</p>
              </div>
              <button
                onClick={() => setShowGruposModal(false)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-white/8 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600 dark:text-white/40 dark:hover:text-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <GestionGruposVisualizacion />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
