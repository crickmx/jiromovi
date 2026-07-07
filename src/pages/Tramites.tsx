import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCached, setCached, invalidateCacheByPrefix } from '../lib/sessionCache';
import { useTiposTramite } from '../hooks/useTiposTramite';
import { supabase } from '../lib/supabase';
import { subscribeResilientChannel } from '../lib/resilientRealtime';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { ClipboardList, Plus, Search, CircleAlert as AlertCircle, Clock, CircleCheck as CheckCircle2, FileText, Settings, Users, ChartBar as BarChart3, X, Paperclip, Trash2, RotateCcw, UserCheck, UserPlus, Check, UsersRound, LayoutList, LayoutGrid, ChevronDown, ArrowUpDown, Flag, UserMinus, Activity, Copy } from 'lucide-react';
import { crearNotificacion } from '../lib/notificationHelpers';
import { NuevoTramiteModal } from '../components/tramites/NuevoTramiteModal';
import { GestionCatalogosRegistro } from '../components/tramites/GestionCatalogosRegistro';
import { GestionGruposVisualizacion } from '../components/tramites/GestionGruposVisualizacion';
import { PanelLider } from '../components/tramites/PanelLider';
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
  eliminado_at: string | null;
  eliminado_por: string | null;
  ultima_accion_por: string | null;
  agente_id: string | null;
  agente_usuario_id: string | null;
  creado_por: string | null;
  assigned_to_user_id: string | null;
  grupo_asignado_id: string | null;
  agente: { nombre_completo: string; oficina_id: string | null; oficina: { nombre: string } | null } | null;
  responsable: { nombre_completo: string } | null;
  estatus: TramiteEstatus | null;
  custom_estatus_label: string | null;
  custom_estatus_color: string | null;
  ticket_asignaciones: Array<{
    ejecutivo: { nombre_completo: string } | null;
  }>;
  ticket_archivos: Array<{ id: string; nombre: string }>;
}

interface TicketTipoDB {
  value: string;
  label: string;
  area: string;
  color: string;
}

const TRAMITE_OPTIONS_FOR_FILTER = TIPO_TRAMITE_OPTIONS.filter(
  t => t.value !== 'cambio_bancario'
);

const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const;

function getSlaInfo(fechaCreacion: string, slaHoras: number | null | undefined) {
  const daysOpen = Math.max(0, Math.floor((Date.now() - new Date(fechaCreacion).getTime()) / 86_400_000));
  const HPD = 8; // horas por día (hardcoded; configuracion_jornada no está cargada aquí)
  if (!slaHoras) return { daysOpen, slaDias: null as number | null, color: 'text-neutral-400 dark:text-white/30', bg: 'bg-neutral-100 dark:bg-white/5', pulsing: false };
  const horasUsadas = daysOpen * HPD;
  const pct = horasUsadas / slaHoras;
  const slaDias = Math.ceil(slaHoras / HPD);
  if (pct <= 0.70) return { daysOpen, slaDias, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', pulsing: false };
  if (pct <= 0.90) return { daysOpen, slaDias, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', pulsing: false };
  if (pct <= 1.00) return { daysOpen, slaDias, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', pulsing: false };
  return { daysOpen, slaDias, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', pulsing: true };
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── Multi-select dropdown component ─────────────────────────────────────────
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  const only = (val: string) => { onChange([val]); setOpen(false); };

  const buttonLabel =
    selected.length === 0 ? label
    : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label ?? `1 ${label}`)
    : `${label} (${selected.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all whitespace-nowrap ${
          selected.length > 0
            ? 'bg-accent/10 text-accent border-accent/30'
            : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-white/60 border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/8'
        }`}
      >
        {buttonLabel}
        <ChevronDown className={`w-3 h-3 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-white/10 shadow-xl overflow-hidden">
          {selected.length > 0 && (
            <button
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-neutral-500 dark:text-white/40 hover:bg-neutral-50 dark:hover:bg-white/5 border-b border-neutral-100 dark:border-white/8 transition-colors"
            >
              <X className="w-3 h-3" />
              Limpiar selección
            </button>
          )}
          <div className="max-h-56 overflow-y-auto">
            {options.map(opt => {
              const isSel = selected.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center justify-between px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-white/5 group">
                  <button onClick={() => toggle(opt.value)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                    <span className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                      isSel ? 'bg-accent border-accent' : 'border-neutral-300 dark:border-white/20'
                    }`}>
                      {isSel && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="text-xs text-neutral-700 dark:text-white/80 truncate">{opt.label}</span>
                  </button>
                  <button
                    onClick={() => only(opt.value)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-accent px-1.5 py-0.5 rounded transition-all ml-2 shrink-0 hover:bg-accent/10"
                  >
                    Sólo
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function Tramites() {
  const { usuario } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'activos' | 'cerrados' | 'papelera'>('activos');
  const [tramites, setTramites] = useState<TramiteItem[]>([]);
  const [tramitesPapelera, setTramitesPapelera] = useState<TramiteItem[]>([]);
  const [estatusList, setEstatusList] = useState<TramiteEstatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [selectedEstatuses, setSelectedEstatuses] = useState<string[]>([]);
  const [selectedPrioridades, setSelectedPrioridades] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedOficinas, setSelectedOficinas] = useState<string[]>([]);
  const [selectedAgentes, setSelectedAgentes] = useState<string[]>([]);
  const [selectedEquipos, setSelectedEquipos] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'fecha_creacion' | 'requiere_atencion' | 'prioridad' | 'ultima_modificacion'>('fecha_creacion');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [grupos, setGrupos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [duplicarPreload, setDuplicarPreload] = useState<{ tipoTramite?: string; descripcion?: string; prioridad?: string } | null>(null);
  const [showCatalogosModal, setShowCatalogosModal] = useState(false);
  const [showGruposModal, setShowGruposModal] = useState(false);
  const [showPanelLider, setShowPanelLider] = useState(false);
  const [userArea, setUserArea] = useState<string | null>(null);
  const [userAreaLoaded, setUserAreaLoaded] = useState(false);
  // scope: area → allowed office IDs (null = all offices for that area)
  const [userScope, setUserScope] = useState<Array<{ area_categoria: string; office_ids: string[] | null; all_offices: boolean }>>([]);

  // ── Dos sistemas de rol independientes — no confundir ──────────────────────
  // 1) Rol de SISTEMA (usuarios.rol): permisos generales de toda la plataforma.
  //    'Agente' aquí significa CLIENTE EXTERNO — debe ver solo lo que él solicitó.
  // 2) Rol de EQUIPO (tramites_grupos_miembros.rol_en_equipo), solo en Trámites:
  //    'lider' | 'ejecutivo' | 'miembro'. Es independiente del rol de sistema:
  //    un Empleado o un Gerente pueden ser líder de un equipo. Nunca asumir que
  //    un chequeo de rol de sistema determina el rol de equipo, ni viceversa.
  const esRolSistemaAdmin = usuario?.rol === 'Administrador';
  const esRolSistemaGerente = usuario?.rol === 'Gerente';
  const esRolSistemaAgente = usuario?.rol === 'Agente'; // cliente externo, no confundir con rol de equipo 'ejecutivo'
  const canManageCatalogs = esRolSistemaAdmin || esRolSistemaGerente;

  // Assignment UI state
  const [myOperacionesRole, setMyOperacionesRole] = useState<'lider' | 'ejecutivo' | 'miembro' | null>(null);
  const [myGrupoRoles, setMyGrupoRoles] = useState<Map<string, string>>(new Map()); // grupo_id -> rol_en_equipo (rol de EQUIPO)
  const esLiderDeAlgunEquipo = [...myGrupoRoles.values()].some(r => r === 'lider');
  const [myGrupoIds, setMyGrupoIds] = useState<string[]>([]);
  const [assigningTramiteId, setAssigningTramiteId] = useState<string | null>(null);
  const [teamEjecutivos, setTeamEjecutivos] = useState<Array<{ id: string; nombre_completo: string }>>([]);
  const [assignTargetId, setAssignTargetId] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban');
  const [tramitesCerrados20, setTramitesCerrados20] = useState<TramiteItem[]>([]);

  // Estatus filtered by selected tipos (cascade)
  const filteredEstatusList = useMemo(() => {
    if (selectedTipos.length === 0) return estatusList;
    const aplicables = selectedTipos
      .map(v => TIPO_TRAMITE_OPTIONS.find(t => t.value === v)?.tipoAplicable)
      .filter((x): x is string => Boolean(x));
    if (aplicables.length === 0) return estatusList;
    return estatusList.filter(e =>
      e.tipo_aplicable === null || aplicables.some(ta => e.tipo_aplicable!.includes(ta))
    );
  }, [selectedTipos, estatusList]);

  const unsubscribeRealtimeRef = useRef<(() => void) | null>(null);
  const { tiposMap: tiposDb, loading: tiposLoading } = useTiposTramite();

  useEffect(() => {
    supabase.from('tramites_grupos_visualizacion').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => {
      if (data) setGrupos(data as Array<{ id: string; nombre: string }>);
    });
  }, []);

  useEffect(() => {
    loadUserArea();
    loadMyOperacionesRole();
  }, [usuario?.id]);

  useEffect(() => {
    if (userAreaLoaded) loadData();
  }, [activeTab, userAreaLoaded]);

  // Live updates — subscribe once userAreaLoaded so loadTramites has the right scope
  useEffect(() => {
    if (!userAreaLoaded) return;

    unsubscribeRealtimeRef.current = subscribeResilientChannel({
      channelName: 'tramites_list_changes',
      configure: (channel) =>
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tickets' },
          () => { loadTramites(true); } // bypass cache on realtime change
        ),
      onReconnect: () => loadTramites(true),
    });

    return () => {
      unsubscribeRealtimeRef.current?.();
      unsubscribeRealtimeRef.current = null;
    };
  }, [userAreaLoaded, activeTab]);

  // SLA overdue notifications — once per session, after tramites and tipos are loaded
  useEffect(() => {
    if (!esRolSistemaAdmin || tiposLoading || !tramites.length) return;
    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    const overdue = tramites.filter(t => {
      if (t.cerrado_en || t.eliminado_at) return false;
      const td = tiposDb.get(t.tipo_tramite);
      if (!td?.sla_horas) return false;
      const days = Math.floor((now - new Date(t.fecha_creacion).getTime()) / 86_400_000);
      return days > td.sla_horas && !localStorage.getItem(`sla_notified_${t.id}_${today}`);
    });
    if (!overdue.length) return;

    (async () => {
      const { data: adminsData } = await supabase.from('usuarios').select('id').eq('rol', 'Administrador').eq('activo', true);
      const adminIds: string[] = (adminsData ?? []).map((u: { id: string }) => u.id);

      for (const ticket of overdue) {
        const td = tiposDb.get(ticket.tipo_tramite)!;
        const days = Math.floor((now - new Date(ticket.fecha_creacion).getTime()) / 86_400_000);
        const recipients = new Set<string>(adminIds);

        if (ticket.grupo_asignado_id) {
          const { data: lideresData } = await supabase
            .from('tramites_grupos_miembros')
            .select('usuario_id')
            .eq('grupo_id', ticket.grupo_asignado_id)
            .eq('rol_en_equipo', 'lider');
          (lideresData ?? []).forEach((l: { usuario_id: string }) => recipients.add(l.usuario_id));
        }

        const titulo = `Trámite vencido: ${ticket.folio}`;
        const mensaje = `"${td.label}" lleva ${days} días abierto (SLA: ${td.sla_horas}h ≈ ${Math.ceil((td.sla_horas ?? 0) / 8)} días hábiles).`;
        for (const uid of recipients) {
          await crearNotificacion({ user_id: uid, titulo, mensaje, modulo: 'tramites', accion_url: `/tramites/${ticket.id}`, accion_texto: 'Ver trámite', enviar_whatsapp: false });
        }
        localStorage.setItem(`sla_notified_${ticket.id}_${today}`, '1');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramites.length, tiposLoading, esRolSistemaAdmin]);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadUserArea = async () => {
    if (!usuario?.id) return;
    setUserAreaLoaded(false); // Reset so the loadData effect re-fires after impersonation state settles
    if (esRolSistemaAdmin) {
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

  const loadCerrados20 = async () => {
    if (!usuario) return;
    const desde = new Date();
    desde.setDate(desde.getDate() - 20);
    try {
      let q = supabase
        .from('tickets')
        .select(`*, agente:agente_id(nombre_completo, oficina_id, oficina:oficina_id(nombre)), responsable:assigned_to_user_id(nombre_completo), estatus:estatus_id(*), ticket_asignaciones(ejecutivo:ejecutivo_id(nombre_completo)), ticket_archivos(id)`)
        .is('eliminado_at', null)
        .not('cerrado_en', 'is', null)
        .gte('cerrado_en', desde.toISOString())
        .order('cerrado_en', { ascending: false });

      if (isImpersonating && impersonatedUser) {
        const impersonatedRol = impersonatedUser.rol || '';
        if (!['Administrador'].includes(impersonatedRol)) {
          const uid = impersonatedUser.id;
          const { data: gruposData } = await supabase
            .from('tramites_grupos_miembros').select('grupo_id').eq('usuario_id', uid);
          const grupIds = (gruposData || []).map(g => g.grupo_id);
          let orFilter = `agente_id.eq.${uid},creado_por.eq.${uid},assigned_to_user_id.eq.${uid},agente_usuario_id.eq.${uid},attending_user_id.eq.${uid}`;
          if (grupIds.length > 0) orFilter += `,and(assigned_to_user_id.is.null,attending_user_id.is.null,grupo_asignado_id.in.(${grupIds.join(',')}))`;
          q = q.or(orFilter);
        }
      }

      const { data } = await q;
      if (data) setTramitesCerrados20(data as TramiteItem[]);
    } catch {}
  };

  const loadData = async () => {
    setLoading(true);
    const tasks: Promise<void>[] = [loadEstatus(), loadTramites(), loadCerrados20()];
    if (esRolSistemaAdmin) tasks.push(loadPapelera());
    await Promise.all(tasks);
    setLoading(false);
  };

  const loadEstatus = async () => {
    const ESTATUS_CACHE_KEY = 'tramites_estatus';
    const cached = getCached<TramiteEstatus[]>(ESTATUS_CACHE_KEY);
    if (cached) { setEstatusList(cached); return; }

    const { data } = await supabase
      .from('ticket_estatus')
      .select('*')
      .eq('activo', true)
      .order('orden');

    if (data) {
      setEstatusList(data);
      setCached(ESTATUS_CACHE_KEY, data, 10 * 60 * 1000); // 10 min — estatus rarely changes
    }
  };

  const loadTramites = async (bypassCache = false) => {
    if (!usuario) return;

    // Include impersonation context in cache key so admin vs. impersonated views never share the same cache entry
    const cacheKey = `tramites_${activeTab}_${isImpersonating ? (impersonatedUser?.id ?? 'imp') : 'self'}`;

    if (!bypassCache) {
      const cached = getCached<TramiteItem[]>(cacheKey);
      if (cached) { setTramites(cached); return; }
    }

    try {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          agente:agente_id(nombre_completo, oficina_id, oficina:oficina_id(nombre)),
          responsable:assigned_to_user_id(nombre_completo),
          estatus:estatus_id(*),
          ticket_asignaciones(ejecutivo:ejecutivo_id(nombre_completo)),
          ticket_archivos(id, nombre)
        `)
        .order('fecha_creacion', { ascending: false });

      // Always exclude soft-deleted tramites from activos/cerrados
      query = query.is('eliminado_at', null);

      if (activeTab === 'cerrados') {
        query = query.not('cerrado_en', 'is', null);
      } else {
        query = query.is('cerrado_en', null);
      }

      // When admin is impersonating a non-admin/gerente user, RLS still runs as the real admin
      // (auth.uid() = admin). Apply an explicit filter to replicate the impersonated user's visibility.
      if (isImpersonating && impersonatedUser) {
        const impersonatedRol = impersonatedUser.rol || '';
        if (!['Administrador'].includes(impersonatedRol)) {
          const uid = impersonatedUser.id;
          // Also include pool tramites (unassigned) for groups the user belongs to.
          // Query inline to avoid myGrupoIds timing dependency.
          const { data: gruposData } = await supabase
            .from('tramites_grupos_miembros')
            .select('grupo_id')
            .eq('usuario_id', uid);
          const grupIds = (gruposData || []).map(g => g.grupo_id);
          let orFilter = `agente_id.eq.${uid},creado_por.eq.${uid},assigned_to_user_id.eq.${uid},agente_usuario_id.eq.${uid},attending_user_id.eq.${uid}`;
          if (grupIds.length > 0) {
            orFilter += `,and(assigned_to_user_id.is.null,attending_user_id.is.null,grupo_asignado_id.in.(${grupIds.join(',')}))`;
          }
          query = query.or(orFilter);
        }
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
        setCached(cacheKey, tramitesWithAsignaciones as TramiteItem[], 3 * 60 * 1000); // 3 min
      } else {
        setTramites([]);
        setCached(cacheKey, [], 3 * 60 * 1000);
      }
    } catch (error) {
      console.error('Exception loading tramites:', error);
    }
  };

  const loadPapelera = async () => {
    if (!esRolSistemaAdmin) return;
    try {
      const { data } = await supabase
        .from('tickets')
        .select(`
          *,
          agente:agente_id(nombre_completo, oficina_id, oficina:oficina_id(nombre)),
          responsable:assigned_to_user_id(nombre_completo),
          estatus:estatus_id(*),
          ticket_asignaciones(ejecutivo:ejecutivo_id(nombre_completo)),
          ticket_archivos(id, nombre)
        `)
        .not('eliminado_at', 'is', null)
        .order('eliminado_at', { ascending: false });

      if (data) setTramitesPapelera(data as TramiteItem[]);
    } catch (error) {
      console.error('Exception loading papelera:', error);
    }
  };

  const handleSoftDelete = async (e: React.MouseEvent, tramiteId: string) => {
    e.stopPropagation();
    if (!usuario) return;
    await supabase.from('tickets').update({
      eliminado_at: new Date().toISOString(),
      eliminado_por: usuario.id,
    }).eq('id', tramiteId);
    invalidateCacheByPrefix('tramites_');
    setTramites(prev => prev.filter(t => t.id !== tramiteId));
    loadPapelera();
  };

  const handleDuplicar = async (e: React.MouseEvent, tramite: TramiteItem) => {
    e.stopPropagation();
    // Fetch descripcion desde el ticket completo si no está en el resumen
    let descripcion = '';
    const { data } = await supabase
      .from('tickets')
      .select('descripcion')
      .eq('id', tramite.id)
      .single();
    if (data) descripcion = data.descripcion ?? '';
    setDuplicarPreload({
      tipoTramite: tramite.tipo_tramite,
      descripcion,
      prioridad: tramite.prioridad,
    });
    setShowNuevoModal(true);
  };

  const handleRestore = async (tramiteId: string) => {
    await supabase.from('tickets').update({
      eliminado_at: null,
      eliminado_por: null,
    }).eq('id', tramiteId);
    invalidateCacheByPrefix('tramites_');
    setTramitesPapelera(prev => prev.filter(t => t.id !== tramiteId));
    loadTramites(true);
  };

  const handlePermanentDelete = async (tramiteId: string) => {
    if (!confirm('¿Eliminar definitivamente este trámite? Esta acción no se puede deshacer.')) return;
    await supabase.from('tickets').delete().eq('id', tramiteId);
    setTramitesPapelera(prev => prev.filter(t => t.id !== tramiteId));
  };

  const handleMarkAsRead = async (e: React.MouseEvent, tramiteId: string) => {
    e.stopPropagation();
    if (!usuario) return;
    await supabase.from('tickets').update({ ultima_accion_por: usuario.id }).eq('id', tramiteId);
    setTramites(prev => prev.map(t => t.id === tramiteId ? { ...t, ultima_accion_por: usuario.id } : t));
  };

  const handleVaciarPapelera = async () => {
    if (tramitesPapelera.length === 0) return;
    if (!confirm(`¿Vaciar la papelera? Se eliminarán permanentemente ${tramitesPapelera.length} trámite(s). Esta acción no se puede deshacer.`)) return;
    const ids = tramitesPapelera.map(t => t.id);
    // Delete one-by-one to avoid RLS/FK issues with bulk .in() deletes
    const errors: string[] = [];
    for (const id of ids) {
      const { error } = await supabase.from('tickets').delete().eq('id', id);
      if (error) errors.push(error.message);
    }
    invalidateCacheByPrefix('tramites_');
    // Always re-fetch from DB so state matches reality (catches silent failures)
    await loadPapelera();
    if (errors.length > 0) {
      alert(`No se pudieron eliminar ${errors.length} trámite(s). Verifica los permisos.`);
    }
  };

  const loadMyOperacionesRole = async () => {
    if (!usuario?.id) return;
    const { data } = await supabase
      .from('tramites_grupos_miembros')
      .select('grupo_id, rol_en_equipo, grupo:grupo_id(area_categoria, activo)')
      .eq('usuario_id', usuario.id);
    if (data) {
      type Row = { grupo_id: string; rol_en_equipo: string; grupo: { area_categoria: string; activo: boolean } | null };
      const allActive = (data as Row[]).filter(m => m.grupo?.activo);
      const opsEntries = allActive.filter(m => m.grupo?.area_categoria === 'Operaciones');
      const opsEntry = opsEntries[0] ?? null;
      setMyOperacionesRole(opsEntry ? (opsEntry.rol_en_equipo as 'lider' | 'ejecutivo' | 'miembro') : null);
      setMyGrupoIds(allActive.map(m => m.grupo_id)); // all areas, not just Operaciones
      const rolesMap = new Map<string, string>();
      for (const m of allActive) rolesMap.set(m.grupo_id, m.rol_en_equipo);
      setMyGrupoRoles(rolesMap);
    }
  };

  const loadTeamEjecutivos = async (grupoId?: string | null) => {
    if (grupoId) {
      const { data } = await supabase.rpc('get_grupo_miembros_ejecutivos', { p_grupo_id: grupoId });
      if (data) setTeamEjecutivos(data as Array<{ id: string; nombre_completo: string }>);
      return;
    }
    // Fallback: todos los ejecutivos de grupos Operaciones activos
    const { data: grupos } = await supabase
      .from('tramites_grupos_visualizacion')
      .select('id')
      .eq('area_categoria', 'Operaciones')
      .eq('activo', true);
    if (!grupos || grupos.length === 0) return;
    const grupoIds = grupos.map((g: { id: string }) => g.id);
    const { data: miembros } = await supabase
      .from('tramites_grupos_miembros')
      .select('usuario_id, usuarios!inner(nombre_completo)')
      .in('grupo_id', grupoIds)
      .in('rol_en_equipo', ['lider', 'ejecutivo']);
    if (miembros) {
      type MRow = { usuario_id: string; usuarios: { nombre_completo: string } };
      const unique = new Map<string, string>();
      for (const m of miembros as MRow[]) {
        if (!unique.has(m.usuario_id)) unique.set(m.usuario_id, m.usuarios.nombre_completo);
      }
      setTeamEjecutivos([...unique.entries()].map(([id, nombre_completo]) => ({ id, nombre_completo })));
    }
  };

  const handleTakeTramite = async (tramiteId: string) => {
    if (!usuario) return;
    await supabase.from('tickets').update({ assigned_to_user_id: usuario.id, attending_user_id: usuario.id }).eq('id', tramiteId);
    await supabase.from('ticket_asignaciones').insert({
      ticket_id: tramiteId, ejecutivo_id: usuario.id, asignado_por: usuario.id,
    });
    invalidateCacheByPrefix('tramites_');
    loadTramites(true);
  };

  const handleAssignTramite = async (tramiteId: string, ejecutivoId: string) => {
    if (!usuario || !ejecutivoId) return;
    await supabase.from('tickets').update({ assigned_to_user_id: ejecutivoId, attending_user_id: ejecutivoId }).eq('id', tramiteId);
    await supabase.from('ticket_asignaciones').insert({
      ticket_id: tramiteId, ejecutivo_id: ejecutivoId, asignado_por: usuario.id,
    });
    setAssigningTramiteId(null);
    setAssignTargetId('');
    invalidateCacheByPrefix('tramites_');
    loadTramites(true);
  };

  const getTipoTramiteLabel = (tipo: string) => centralGetLabel(tipo);

  // Visibility filter — ORDEN IMPORTA. El rol de EQUIPO (líder/ejecutivo) se evalúa
  // antes que los cortes por rol de SISTEMA (Gerente/Agente), porque son ejes
  // independientes: un usuario con rol de sistema 'Agente' (cliente externo)
  // también puede ser 'lider' de un equipo de trámites, y en ese caso debe ver
  // todo lo de su equipo, no solo lo suyo. Ver comentario junto a esRolSistemaAdmin/
  // esRolSistemaGerente/esRolSistemaAgente arriba para la explicación completa.
  // - Admin (sistema): todo
  // - Gerente (sistema): trámites de su oficina (agente.oficina_id) + grupos a los que pertenece + directamente involucrado
  // - Líder (equipo, cualquier rol de sistema): todos los trámites de su equipo
  // - Agente (sistema, cliente externo): solo los propios
  // - Todos los demás: solo los propios (directamente involucrado) + trámites de sus grupos/equipos
  const visibleTramites = tramites.filter(tramite => {
    if (esRolSistemaAdmin) return true;

    const tramiteOficinaId = tramite.agente?.oficina_id ?? null;

    const isDirectlyInvolved =
      tramite.creado_por === usuario?.id ||
      tramite.assigned_to_user_id === usuario?.id ||
      tramite.agente_id === usuario?.id;

    const isInMyGroup =
      tramite.grupo_asignado_id !== null &&
      myGrupoIds.includes(tramite.grupo_asignado_id);

    // Pool del equipo: trámites SIN asignar en grupos del usuario (para autoasignarse)
    const isPoolOfMyGroup =
      !tramite.assigned_to_user_id &&
      isInMyGroup;

    // Gerente: su oficina + sus equipos + directamente involucrado
    if (esRolSistemaGerente) {
      return tramiteOficinaId === usuario?.oficina_id || isInMyGroup || isDirectlyInvolved;
    }

    // Lider: todos los tramites de su grupo (asignados o no) — se evalúa antes que el
    // corte de Agente, porque el rol de líder es por equipo, no por rol global del usuario
    const esLiderDeEsteEquipo =
      tramite.grupo_asignado_id !== null &&
      myGrupoRoles.get(tramite.grupo_asignado_id) === 'lider';
    if (esLiderDeEsteEquipo) return true;

    // Agente: solo sus propios trámites
    if (esRolSistemaAgente) return isDirectlyInvolved;

    // Ejecutivo y demás: propios + pool sin asignar de sus equipos (para autoasignarse)
    return isDirectlyInvolved || isPoolOfMyGroup;
  });

  // ── Kanban helpers ────────────────────────────────────────────────────────
  const needsAttentionFn = (t: TramiteItem) => {
    if (esRolSistemaAdmin && !isImpersonating) {
      // Admin: solo cuando el agente fue el último en actuar (empleado necesita responder)
      if (!t.ultima_accion_por) return false;
      return (
        t.ultima_accion_por === t.agente_id ||
        (!!t.agente_usuario_id && t.ultima_accion_por === t.agente_usuario_id)
      );
    }
    // Ejecutivos / agentes: sin acción aún (null) también requiere atención
    const effectiveId = isImpersonating && impersonatedUser ? impersonatedUser.id : usuario?.id;
    return !t.ultima_accion_por || t.ultima_accion_por !== effectiveId;
  };

  const filteredTramites = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const term = norm(searchTerm ?? '');

    let result = visibleTramites.filter(tramite => {
      const matches = (v: string | null | undefined) => norm(v ?? '').includes(term);
      const matchSearch = !term || (
        matches(tramite.folio) ||
        matches(tramite.instrucciones) ||
        matches(tramite.poliza) ||
        matches(tramite.agente?.nombre_completo) ||
        matches(tramite.responsable?.nombre_completo) ||
        matches(getTipoTramiteLabel(tramite.tipo_tramite))
      );
      const matchAreas     = selectedAreas.length === 0 || selectedAreas.includes(getTipoTramiteArea(tramite.tipo_tramite));
      const matchTipos     = selectedTipos.length === 0 || selectedTipos.includes(tramite.tipo_tramite);
      const matchEstatuses = selectedEstatuses.length === 0 || (tramite.estatus != null && selectedEstatuses.includes(tramite.estatus.id));
      const matchPrioridades = selectedPrioridades.length === 0 || selectedPrioridades.includes(tramite.prioridad);
      const matchOficinas  = selectedOficinas.length === 0 || (tramite.agente?.oficina_id != null && selectedOficinas.includes(tramite.agente.oficina_id));
      const matchAgentes   = selectedAgentes.length === 0 || (tramite.agente_id != null && selectedAgentes.includes(tramite.agente_id));
      const matchEquipos   = selectedEquipos.length === 0 || (tramite.grupo_asignado_id != null && selectedEquipos.includes(tramite.grupo_asignado_id));
      return matchSearch && matchAreas && matchTipos && matchEstatuses && matchPrioridades && matchOficinas && matchAgentes && matchEquipos;
    });

    result = [...result].sort((a, b) => {
      let comp = 0;
      if (sortBy === 'fecha_creacion') {
        comp = new Date(a.fecha_creacion).getTime() - new Date(b.fecha_creacion).getTime();
      } else if (sortBy === 'requiere_atencion') {
        comp = (needsAttentionFn(b) ? 1 : 0) - (needsAttentionFn(a) ? 1 : 0);
      } else if (sortBy === 'prioridad') {
        const ord: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };
        comp = (ord[a.prioridad] ?? 1) - (ord[b.prioridad] ?? 1);
      } else if (sortBy === 'ultima_modificacion') {
        comp = new Date(a.ultima_modificacion).getTime() - new Date(b.ultima_modificacion).getTime();
      }
      return sortDir === 'asc' ? comp : -comp;
    });

    return result;
  }, [visibleTramites, searchTerm, selectedAreas, selectedTipos, selectedEstatuses, selectedPrioridades, selectedOficinas, selectedAgentes, selectedEquipos, sortBy, sortDir]);

  // Derive available options for dropdowns from visibleTramites
  const oficinaOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of visibleTramites) {
      if (t.agente?.oficina_id && t.agente?.oficina?.nombre) map.set(t.agente.oficina_id, t.agente.oficina.nombre);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [visibleTramites]);

  const agenteOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of visibleTramites) {
      if (t.agente_id && t.agente?.nombre_completo) map.set(t.agente_id, t.agente.nombre_completo);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [visibleTramites]);

  const grupoOptions = useMemo(() => {
    if (esRolSistemaAdmin) return grupos.map(g => ({ value: g.id, label: g.nombre }));
    return grupos.filter(g => myGrupoIds.includes(g.id)).map(g => ({ value: g.id, label: g.nombre }));
  }, [grupos, esRolSistemaAdmin, myGrupoIds]);

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

  const hasActiveFilters = searchTerm !== '' || selectedAreas.length > 0 || selectedTipos.length > 0 || selectedEstatuses.length > 0 || selectedPrioridades.length > 0 || selectedOficinas.length > 0 || selectedAgentes.length > 0 || selectedEquipos.length > 0;

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedAreas([]);
    setSelectedTipos([]);
    setSelectedEstatuses([]);
    setSelectedPrioridades([]);
    setSelectedOficinas([]);
    setSelectedAgentes([]);
    setSelectedEquipos([]);
  };

  const kanbanAtención = filteredTramites.filter(t => needsAttentionFn(t));
  const kanbanProceso  = filteredTramites.filter(t => !needsAttentionFn(t));

  // Terminados: apply the same user-facing filters as filteredTramites
  const kanbanCerrados = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const term = norm(searchTerm ?? '');
    return tramitesCerrados20.filter(t => {
      const matches = (v: string | null | undefined) => norm(v ?? '').includes(term);
      const matchSearch = !term || matches(t.folio) || matches(t.instrucciones) || matches(t.poliza) || matches(t.agente?.nombre_completo) || matches(t.responsable?.nombre_completo) || matches(getTipoTramiteLabel(t.tipo_tramite));
      const matchAreas      = selectedAreas.length === 0 || selectedAreas.includes(getTipoTramiteArea(t.tipo_tramite));
      const matchTipos      = selectedTipos.length === 0 || selectedTipos.includes(t.tipo_tramite);
      const matchEstatuses  = selectedEstatuses.length === 0 || (t.estatus != null && selectedEstatuses.includes(t.estatus.id));
      const matchPrioridades = selectedPrioridades.length === 0 || selectedPrioridades.includes(t.prioridad);
      const matchOficinas   = selectedOficinas.length === 0 || (t.agente?.oficina_id != null && selectedOficinas.includes(t.agente.oficina_id));
      const matchAgentes    = selectedAgentes.length === 0 || (t.agente_id != null && selectedAgentes.includes(t.agente_id));
      const matchEquipos    = selectedEquipos.length === 0 || (t.grupo_asignado_id != null && selectedEquipos.includes(t.grupo_asignado_id));
      return matchSearch && matchAreas && matchTipos && matchEstatuses && matchPrioridades && matchOficinas && matchAgentes && matchEquipos;
    });
  }, [tramitesCerrados20, searchTerm, selectedAreas, selectedTipos, selectedEstatuses, selectedPrioridades, selectedOficinas, selectedAgentes, selectedEquipos]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gestion de Tramites"
        description="Gestiona solicitudes y soporte interno"
        icon={ClipboardList}
        badge={userArea && !esRolSistemaAdmin ? (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${AREA_CONFIG[userArea as keyof typeof AREA_CONFIG]?.bg} ${AREA_CONFIG[userArea as keyof typeof AREA_CONFIG]?.color}`}>
            {userArea}
          </span>
        ) : undefined}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {esRolSistemaAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/tramites')}>
                <Users className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Admin Trámites</span>
              </Button>
            )}
            {esLiderDeAlgunEquipo && !esRolSistemaAdmin && (
              <Button variant="outline" size="sm" onClick={() => setShowPanelLider(true)}>
                <Users className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Mi equipo</span>
              </Button>
            )}
            {canManageCatalogs && (
              <Button variant="outline" size="sm" onClick={() => setShowCatalogosModal(true)}>
                <Settings className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Catalogos</span>
              </Button>
            )}
            {(esRolSistemaAdmin || esRolSistemaGerente) && (
              <Button variant="outline" size="sm" onClick={() => navigate('/tramites/reportes')}>
                <BarChart3 className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Reportes</span>
              </Button>
            )}
            {esRolSistemaAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/cotizar/formularios')}>
                <FileText className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Formularios</span>
              </Button>
            )}
            <div className="flex rounded-lg border border-neutral-200 dark:border-white/10 overflow-hidden">
              <button
                onClick={() => setViewMode('lista')}
                className={`p-2 transition-colors ${viewMode === 'lista' ? 'bg-accent text-white' : 'bg-white dark:bg-neutral-800 text-neutral-500 dark:text-white/50 hover:bg-neutral-100 dark:hover:bg-white/8'}`}
                title="Vista lista"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 transition-colors ${viewMode === 'kanban' ? 'bg-accent text-white' : 'bg-white dark:bg-neutral-800 text-neutral-500 dark:text-white/50 hover:bg-neutral-100 dark:hover:bg-white/8'}`}
                title="Vista tablero"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
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
          {esRolSistemaAdmin && (
            <button
              onClick={() => setActiveTab('papelera')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === 'papelera'
                  ? 'text-red-500 border-red-500'
                  : 'text-neutral-500 dark:text-white/50 border-transparent hover:text-neutral-700 dark:hover:text-white/70'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Papelera
              {tramitesPapelera.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {tramitesPapelera.length}
                </span>
              )}
            </button>
          )}
        </div>
      </PageHeader>

      {esRolSistemaAgente && <AgenteDashboard />}

      {/* KPI Summary — métricas operativas */}
      {!esRolSistemaAgente && activeTab !== 'papelera' && (
        (() => {
          const today = new Date().toISOString().split('T')[0];
          const activos = visibleTramites.filter(t => !t.cerrado_en && !t.eliminado_at);
          const oldestAtención = kanbanAtención.reduce<TramiteItem | null>(
            (acc, t) => (!acc || t.fecha_creacion < acc.fecha_creacion ? t : acc), null
          );
          const oldestDays = oldestAtención
            ? Math.floor((Date.now() - new Date(oldestAtención.fecha_creacion).getTime()) / 86_400_000)
            : 0;

          const kpis = [
            {
              key: 'atencion',
              accent: '#E84422',
              icon: <AlertCircle className="w-[15px] h-[15px]" />,
              count: kanbanAtención.length,
              label1: 'Requiere',
              label2: 'Atención',
              sub: oldestAtención ? `Más antiguo: hace ${oldestDays}d` : 'Sin pendientes',
              active: false,
              onClick: undefined as (() => void) | undefined,
            },
            {
              key: 'prioridad',
              accent: '#B91C6E',
              icon: <Flag className="w-[15px] h-[15px]" />,
              count: activos.filter(t => t.prioridad === 'Alta').length,
              label1: 'Alta',
              label2: 'Prioridad',
              sub: selectedPrioridades.includes('Alta') ? 'Filtro activo' : 'Clic para filtrar',
              active: selectedPrioridades.includes('Alta'),
              onClick: () => setSelectedPrioridades(prev =>
                prev.includes('Alta') ? prev.filter(p => p !== 'Alta') : [...prev, 'Alta']
              ),
            },
            {
              key: 'riesgo',
              accent: '#B45309',
              icon: <Clock className="w-[15px] h-[15px]" />,
              count: activos.filter(t =>
                Math.floor((Date.now() - new Date(t.fecha_creacion).getTime()) / 86_400_000) > 7
              ).length,
              label1: 'En Riesgo',
              label2: '+7 días',
              sub: 'Abiertos más de una semana',
              active: false,
              onClick: undefined as (() => void) | undefined,
            },
            {
              key: 'sinasignar',
              accent: '#4F35B3',
              icon: <UserMinus className="w-[15px] h-[15px]" />,
              count: activos.filter(t => !t.assigned_to_user_id).length,
              label1: 'Sin',
              label2: 'Asignar',
              sub: 'Sin responsable directo',
              active: false,
              onClick: undefined as (() => void) | undefined,
            },
            {
              key: 'proceso',
              accent: '#0B6FAB',
              icon: <Activity className="w-[15px] h-[15px]" />,
              count: kanbanProceso.length,
              label1: 'En',
              label2: 'Proceso',
              sub: `de ${activos.length} activos totales`,
              active: false,
              onClick: undefined as (() => void) | undefined,
            },
            {
              key: 'cerrados',
              accent: '#1B7A47',
              icon: <CheckCircle2 className="w-[15px] h-[15px]" />,
              count: tramitesCerrados20.filter(t => t.cerrado_en?.startsWith(today)).length,
              label1: 'Cerrados',
              label2: 'Hoy',
              sub: `${tramitesCerrados20.length} en los últimos 20d`,
              active: activeTab === 'cerrados',
              onClick: () => setActiveTab('cerrados'),
            },
          ];

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {kpis.map(kpi => (
                <button
                  key={kpi.key}
                  onClick={kpi.onClick}
                  className={`relative group overflow-hidden bg-white dark:bg-neutral-800 rounded-2xl text-left transition-all duration-200 hover:-translate-y-0.5 ${kpi.onClick ? 'cursor-pointer' : 'cursor-default'}`}
                  style={{
                    border: kpi.active ? `1.5px solid ${kpi.accent}` : '1.5px solid #E5E7EB',
                    boxShadow: kpi.active
                      ? `0 0 0 3px ${kpi.accent}22, 0 4px 16px ${kpi.accent}18`
                      : undefined,
                  }}
                  onMouseEnter={e => { if (!kpi.active) (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${kpi.accent}22`; }}
                  onMouseLeave={e => { if (!kpi.active) (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                >
                  {/* Top accent stripe */}
                  <div
                    className="absolute top-0 inset-x-0 h-[3.5px] group-hover:h-[5px] transition-all duration-200"
                    style={{ background: kpi.accent }}
                  />

                  <div className="p-4 pt-5">
                    {/* Icon badge */}
                    <div
                      className="absolute top-[18px] right-3.5 w-[30px] h-[30px] rounded-lg flex items-center justify-center"
                      style={{ background: kpi.accent + '18', color: kpi.accent }}
                    >
                      {kpi.icon}
                    </div>

                    {/* Count */}
                    <p
                      className="text-[2.1rem] font-extrabold leading-none mt-0.5 mb-1.5 tabular-nums"
                      style={{ color: kpi.accent }}
                    >
                      {kpi.count}
                    </p>

                    {/* Label */}
                    <p className="text-[11px] font-bold text-neutral-600 dark:text-white/60 leading-snug">
                      {kpi.label1}<br />{kpi.label2}
                    </p>

                    {/* Sub */}
                    <p className="mt-2.5 pt-2.5 border-t border-neutral-100 dark:border-white/8 text-[10px] text-neutral-400 dark:text-white/30 leading-snug">
                      {kpi.sub}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          );
        })()
      )}

      {/* Filters — hidden in papelera mode */}
      {activeTab !== 'papelera' && (
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-3.5">
          <div className="flex flex-col gap-3">
            {/* Search row */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-white/30 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por folio, descripción, póliza o agente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-neutral-400 dark:placeholder:text-white/30 text-neutral-900 dark:text-white"
              />
            </div>

            {/* Filter chips row */}
            <div className="flex flex-wrap gap-2 items-center">
              <MultiSelectDropdown
                label="Área"
                options={[{ value: 'Comercial', label: 'Comercial' }, { value: 'Operaciones', label: 'Operaciones' }]}
                selected={selectedAreas}
                onChange={setSelectedAreas}
              />
              <MultiSelectDropdown
                label="Tipo"
                options={TRAMITE_OPTIONS_FOR_FILTER.map(o => ({ value: o.value, label: o.label }))}
                selected={selectedTipos}
                onChange={setSelectedTipos}
              />
              <MultiSelectDropdown
                label="Estatus"
                options={filteredEstatusList.map(e => ({ value: e.id, label: e.nombre }))}
                selected={selectedEstatuses}
                onChange={setSelectedEstatuses}
              />
              <MultiSelectDropdown
                label="Prioridad"
                options={PRIORIDADES.map(p => ({ value: p, label: p }))}
                selected={selectedPrioridades}
                onChange={setSelectedPrioridades}
              />
              {oficinaOptions.length > 0 && (
                <MultiSelectDropdown
                  label="Oficina"
                  options={oficinaOptions}
                  selected={selectedOficinas}
                  onChange={setSelectedOficinas}
                />
              )}
              {agenteOptions.length > 0 && (
                <MultiSelectDropdown
                  label="Agente"
                  options={agenteOptions}
                  selected={selectedAgentes}
                  onChange={setSelectedAgentes}
                />
              )}
              {grupoOptions.length > 0 && (
                <MultiSelectDropdown
                  label="Equipo"
                  options={grupoOptions}
                  selected={selectedEquipos}
                  onChange={setSelectedEquipos}
                />
              )}

              {/* Sort button */}
              <div ref={sortRef} className="relative ml-auto">
                <button
                  onClick={() => setSortOpen(o => !o)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all whitespace-nowrap ${
                    sortBy !== 'fecha_creacion' || sortDir !== 'desc'
                      ? 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-white/60 border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/8'
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  Ordenar
                </button>
                {sortOpen && (
                  <div className="absolute top-full right-0 mt-1 z-50 min-w-[220px] bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-white/10 shadow-xl overflow-hidden">
                    {([
                      { value: 'fecha_creacion', label: 'Fecha de creación' },
                      { value: 'requiere_atencion', label: 'Requieren atención primero' },
                      { value: 'prioridad', label: 'Prioridad (Alta → Baja)' },
                      { value: 'ultima_modificacion', label: 'Última modificación' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          if (sortBy === opt.value) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                          else { setSortBy(opt.value); setSortDir('desc'); }
                          setSortOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-neutral-50 dark:hover:bg-white/5 ${
                          sortBy === opt.value ? 'text-accent font-semibold' : 'text-neutral-700 dark:text-white/70'
                        }`}
                      >
                        {opt.label}
                        {sortBy === opt.value && (
                          <span className="text-[10px] font-bold ml-2">{sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Limpiar
                </button>
              )}
            </div>

            {/* Active filter chips display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100 dark:border-white/5">
                {selectedAreas.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                    {v} <button onClick={() => setSelectedAreas(prev => prev.filter(x => x !== v))}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
                {selectedTipos.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent">
                    {TRAMITE_OPTIONS_FOR_FILTER.find(o => o.value === v)?.label ?? v}
                    <button onClick={() => setSelectedTipos(prev => prev.filter(x => x !== v))}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
                {selectedEstatuses.map(v => {
                  const e = estatusList.find(s => s.id === v);
                  return (
                    <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: e?.color ?? '#888' }}>
                      {e?.nombre ?? v} <button onClick={() => setSelectedEstatuses(prev => prev.filter(x => x !== v))}><X className="w-2.5 h-2.5" /></button>
                    </span>
                  );
                })}
                {selectedPrioridades.map(v => (
                  <span key={v} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${v === 'Alta' ? 'bg-red-100 text-red-700' : v === 'Media' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {v} <button onClick={() => setSelectedPrioridades(prev => prev.filter(x => x !== v))}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
                {selectedOficinas.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {oficinaOptions.find(o => o.value === v)?.label ?? v}
                    <button onClick={() => setSelectedOficinas(prev => prev.filter(x => x !== v))}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
                {selectedAgentes.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                    {agenteOptions.find(o => o.value === v)?.label ?? v}
                    <button onClick={() => setSelectedAgentes(prev => prev.filter(x => x !== v))}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
                {selectedEquipos.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {grupoOptions.find(o => o.value === v)?.label ?? v}
                    <button onClick={() => setSelectedEquipos(prev => prev.filter(x => x !== v))}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Papelera tab content */}
      {activeTab === 'papelera' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-neutral-500 dark:text-white/40 font-medium">
              {tramitesPapelera.length} {tramitesPapelera.length === 1 ? 'trámite' : 'trámites'} en papelera
            </p>
            {tramitesPapelera.length > 0 && (
              <button
                onClick={handleVaciarPapelera}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-lg transition-colors border border-red-200 dark:border-red-800/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Vaciar papelera
              </button>
            )}
          </div>
          {tramitesPapelera.length === 0 ? (
            <EmptyState
              icon={Trash2}
              title="Papelera vacía"
              description="Los trámites eliminados aparecerán aquí"
            />
          ) : (
            <div className="space-y-3">
              {tramitesPapelera.map(tramite => {
                const area = getTipoTramiteArea(tramite.tipo_tramite);
                const ac = AREA_CONFIG[area];
                const tipoDb = tiposDb.get(tramite.tipo_tramite);
                const dbColor = tipoDb?.color;
                const fallbackBarClass = area === 'Comercial' ? 'bg-sky-700' : 'bg-amber-600';
                return (
                  <div
                    key={tramite.id}
                    className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-hidden flex opacity-70"
                  >
                    <div
                      className={`w-1.5 shrink-0 ${!dbColor ? fallbackBarClass : ''}`}
                      style={dbColor ? { backgroundColor: dbColor } : undefined}
                    />
                    <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:divide-x divide-neutral-100 dark:divide-white/8">
                      <div className="px-4 pt-4 pb-3 sm:pb-4 flex flex-col gap-2 sm:w-[38%] sm:shrink-0">
                        <div>
                          <p
                            className={`font-extrabold text-sm uppercase tracking-wide leading-tight ${!dbColor ? ac.color : ''}`}
                            style={dbColor ? { color: dbColor } : undefined}
                          >
                            {tramite.agente?.nombre_completo || 'Sin asignar'}
                          </p>
                          <p
                            className={`text-[11px] font-semibold mt-0.5 uppercase tracking-wide opacity-80 ${!dbColor ? ac.color : ''}`}
                            style={dbColor ? { color: dbColor } : undefined}
                          >
                            {tipoDb?.label ?? getTipoTramiteLabel(tramite.tipo_tramite)}
                          </p>
                        </div>
                        <div className="space-y-0.5 text-xs">
                          <p className="text-neutral-600 dark:text-white/60">
                            <span className="text-neutral-400 dark:text-white/35">Eliminado: </span>
                            <span className="font-medium">
                              {new Date(tramite.eliminado_at!).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </p>
                          <p className="text-neutral-600 dark:text-white/60">
                            <span className="text-neutral-400 dark:text-white/35">Creado: </span>
                            <span className="font-medium">
                              {new Date(tramite.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </p>
                        </div>
                        <p
                          className={`text-[11px] font-extrabold uppercase tracking-widest mt-auto ${!dbColor ? ac.color : ''}`}
                          style={dbColor ? { color: dbColor } : undefined}
                        >
                          Folio: {tramite.folio}
                        </p>
                      </div>
                      <div className="flex-1 px-4 pt-3 sm:pt-4 pb-4 flex flex-col justify-between gap-3 min-w-0">
                        <p className="text-xs text-neutral-700 dark:text-white/75 leading-relaxed line-clamp-3">
                          <span className="font-semibold text-neutral-500 dark:text-white/50">Mensaje: </span>
                          {tramite.instrucciones}
                        </p>
                        <div className="flex items-center gap-2 justify-end mt-auto">
                          <button
                            onClick={() => handleRestore(tramite.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-400 rounded-lg transition-colors border border-green-200 dark:border-green-800/40"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restaurar
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(tramite.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-lg transition-colors border border-red-200 dark:border-red-800/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar definitivamente
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── KANBAN VIEW ────────────────────────────────────────────────────── */}
      {activeTab === 'activos' && viewMode === 'kanban' && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Columna 1: Requiere atención */}
          <div className="flex flex-col gap-3">
            <div className="pb-2 border-b-2 border-orange-400">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
                </span>
                <h3 className="text-sm font-bold text-neutral-700 dark:text-white/80">Requiere atención</h3>
                <span className="ml-auto text-xs font-bold bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full">{kanbanAtención.length}</span>
              </div>
              <p className="text-xs text-neutral-400 dark:text-white/25 mt-0.5 pl-5">Esperan tu respuesta o acción</p>
            </div>
            {kanbanAtención.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-white/30 text-center py-8">Sin trámites pendientes</p>
            ) : kanbanAtención.map(tramite => {
              const area = getTipoTramiteArea(tramite.tipo_tramite);
              const ac = AREA_CONFIG[area];
              const tipoDb = tiposDb.get(tramite.tipo_tramite);
              const dbColor = tipoDb?.color;
              const fbc = area === 'Comercial' ? 'bg-sky-700' : 'bg-amber-600';
              const preview = tramite.instrucciones?.trim()
                ? tramite.instrucciones
                : tramite.ticket_archivos.length > 0
                  ? `Se adjuntó un archivo: ${tramite.ticket_archivos[tramite.ticket_archivos.length - 1].nombre}`
                  : null;
              const estatusLabel = tramite.custom_estatus_label ?? tramite.estatus?.nombre;
              const estatusColor = tramite.custom_estatus_color ?? tramite.estatus?.color;
              const sla = getSlaInfo(tramite.fecha_creacion, tipoDb?.sla_horas);
              return (
                <div key={tramite.id} onClick={() => navigate(`/tramites/${tramite.id}`)} className="relative bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-visible hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex">
                  {!tramite.cerrado_en && (
                    <button onClick={(e) => handleMarkAsRead(e, tramite.id)} className="absolute -top-1.5 -right-1.5 z-10" title="Marcar como leído">
                      <span className="relative flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex h-4 w-4 rounded-full bg-orange-500 shadow-sm shadow-orange-300/60" />
                      </span>
                    </button>
                  )}
                  <div className={`w-1.5 group-hover:w-2 shrink-0 transition-all duration-200 rounded-l-xl ${!dbColor ? fbc : ''}`} style={dbColor ? { backgroundColor: dbColor } : undefined} />
                  <div className="flex-1 min-w-0 px-3 py-3 flex flex-col gap-1">
                    <p className={`font-extrabold text-xs uppercase tracking-wide leading-tight truncate ${!dbColor ? ac.color : ''}`} style={dbColor ? { color: dbColor } : undefined}>{tramite.agente?.nombre_completo || 'Sin asignar'}</p>
                    <p className={`text-xs font-semibold uppercase opacity-75 truncate ${!dbColor ? ac.color : ''}`} style={dbColor ? { color: dbColor } : undefined}>{tipoDb?.label ?? getTipoTramiteLabel(tramite.tipo_tramite)}</p>
                    {estatusLabel && <span className="text-xs font-bold uppercase" style={{ color: estatusColor ?? undefined }}>{estatusLabel}</span>}
                    {preview && (
                      <p className="text-xs text-neutral-500 dark:text-white/40 leading-snug line-clamp-2 mt-0.5 break-words">{preview}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-neutral-400 dark:text-white/30">{fmtFecha(tramite.fecha_creacion)}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${sla.bg} ${sla.color} ${sla.pulsing ? 'animate-pulse' : ''}`}>
                        {sla.daysOpen}d{sla.slaDias ? ` / ${sla.slaDias}d` : ''}
                      </span>
                    </div>
                    {tramite.responsable?.nombre_completo ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <UserCheck className="w-2.5 h-2.5 text-neutral-300 dark:text-white/25 shrink-0" />
                        <span className="text-xs text-neutral-400 dark:text-white/30 truncate">{tramite.responsable.nombre_completo}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-0.5">
                        <UserCheck className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                        <span className="text-xs text-amber-500 dark:text-amber-400/70">Sin responsable</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-0.5 gap-1">
                      <span className={`text-xs font-extrabold uppercase tracking-widest truncate ${!dbColor ? ac.color : ''}`} style={dbColor ? { color: dbColor } : undefined}>{tramite.folio}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tramite.prioridad === 'Alta' ? 'bg-red-100 text-red-600' : tramite.prioridad === 'Media' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>{tramite.prioridad}</span>
                        <button onClick={(e) => handleDuplicar(e, tramite)} className="p-0.5 rounded text-neutral-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-0 group-hover:opacity-100" title="Duplicar trámite">
                          <Copy className="w-3 h-3" />
                        </button>
                        {esRolSistemaAdmin && (
                          <button onClick={(e) => handleSoftDelete(e, tramite.id)} className="p-0.5 rounded text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Mover a papelera">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Columna 2: En proceso */}
          <div className="flex flex-col gap-3">
            <div className="pb-2 border-b-2 border-blue-400">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <h3 className="text-sm font-bold text-neutral-700 dark:text-white/80">En proceso</h3>
                <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">{kanbanProceso.length}</span>
              </div>
              <p className="text-xs text-neutral-400 dark:text-white/25 mt-0.5 pl-5">Siendo atendidos por el equipo</p>
            </div>
            {kanbanProceso.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-white/30 text-center py-8">Sin trámites en proceso</p>
            ) : kanbanProceso.map(tramite => {
              const area = getTipoTramiteArea(tramite.tipo_tramite);
              const ac = AREA_CONFIG[area];
              const tipoDb = tiposDb.get(tramite.tipo_tramite);
              const dbColor = tipoDb?.color;
              const fbc = area === 'Comercial' ? 'bg-sky-700' : 'bg-amber-600';
              const preview = tramite.instrucciones?.trim()
                ? tramite.instrucciones
                : tramite.ticket_archivos.length > 0
                  ? `Se adjuntó un archivo: ${tramite.ticket_archivos[tramite.ticket_archivos.length - 1].nombre}`
                  : null;
              const estatusLabel = tramite.custom_estatus_label ?? tramite.estatus?.nombre;
              const estatusColor = tramite.custom_estatus_color ?? tramite.estatus?.color;
              const sla = getSlaInfo(tramite.fecha_creacion, tipoDb?.sla_horas);
              return (
                <div key={tramite.id} onClick={() => navigate(`/tramites/${tramite.id}`)} className="relative bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-visible hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex">
                  <div className={`w-1.5 group-hover:w-2 shrink-0 transition-all duration-200 rounded-l-xl ${!dbColor ? fbc : ''}`} style={dbColor ? { backgroundColor: dbColor } : undefined} />
                  <div className="flex-1 min-w-0 px-3 py-3 flex flex-col gap-1">
                    <p className={`font-extrabold text-xs uppercase tracking-wide leading-tight truncate ${!dbColor ? ac.color : ''}`} style={dbColor ? { color: dbColor } : undefined}>{tramite.agente?.nombre_completo || 'Sin asignar'}</p>
                    <p className={`text-xs font-semibold uppercase opacity-75 truncate ${!dbColor ? ac.color : ''}`} style={dbColor ? { color: dbColor } : undefined}>{tipoDb?.label ?? getTipoTramiteLabel(tramite.tipo_tramite)}</p>
                    {estatusLabel && <span className="text-xs font-bold uppercase" style={{ color: estatusColor ?? undefined }}>{estatusLabel}</span>}
                    {preview && (
                      <p className="text-xs text-neutral-500 dark:text-white/40 leading-snug line-clamp-2 mt-0.5 break-words">{preview}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-neutral-400 dark:text-white/30">{fmtFecha(tramite.fecha_creacion)}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${sla.bg} ${sla.color} ${sla.pulsing ? 'animate-pulse' : ''}`}>
                        {sla.daysOpen}d{sla.slaDias ? ` / ${sla.slaDias}d` : ''}
                      </span>
                    </div>
                    {tramite.responsable?.nombre_completo ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <UserCheck className="w-2.5 h-2.5 text-neutral-300 dark:text-white/25 shrink-0" />
                        <span className="text-xs text-neutral-400 dark:text-white/30 truncate">{tramite.responsable.nombre_completo}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-0.5">
                        <UserCheck className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                        <span className="text-xs text-amber-500 dark:text-amber-400/70">Sin responsable</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-0.5 gap-1">
                      <span className={`text-xs font-extrabold uppercase tracking-widest truncate ${!dbColor ? ac.color : ''}`} style={dbColor ? { color: dbColor } : undefined}>{tramite.folio}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tramite.prioridad === 'Alta' ? 'bg-red-100 text-red-600' : tramite.prioridad === 'Media' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>{tramite.prioridad}</span>
                        <button onClick={(e) => handleDuplicar(e, tramite)} className="p-0.5 rounded text-neutral-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-0 group-hover:opacity-100" title="Duplicar trámite">
                          <Copy className="w-3 h-3" />
                        </button>
                        {esRolSistemaAdmin && (
                          <button onClick={(e) => handleSoftDelete(e, tramite.id)} className="p-0.5 rounded text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Mover a papelera">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Columna 3: Terminados — últimos 20 días */}
          <div className="flex flex-col gap-3">
            <div className="pb-2 border-b-2 border-green-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <h3 className="text-sm font-bold text-neutral-700 dark:text-white/80">Terminados</h3>
                <span className="ml-auto text-xs font-bold bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">{kanbanCerrados.length}</span>
              </div>
              <p className="text-xs text-neutral-400 dark:text-white/25 mt-0.5 pl-5">Cerrados en los últimos 20 días</p>
            </div>
            {kanbanCerrados.length === 0 ? (
              <p className="text-xs text-neutral-400 dark:text-white/30 text-center py-8">Sin cierres recientes</p>
            ) : kanbanCerrados.slice(0, 10).map(tramite => {
              const area = getTipoTramiteArea(tramite.tipo_tramite);
              const ac = AREA_CONFIG[area];
              const tipoDb = tiposDb.get(tramite.tipo_tramite);
              const dbColor = tipoDb?.color;
              const fbc = area === 'Comercial' ? 'bg-sky-700' : 'bg-amber-600';
              const preview = tramite.instrucciones?.trim()
                ? tramite.instrucciones
                : tramite.ticket_archivos.length > 0
                  ? `Se adjuntó un archivo: ${tramite.ticket_archivos[tramite.ticket_archivos.length - 1].nombre}`
                  : null;
              const totalDays = Math.max(0, Math.floor((new Date(tramite.cerrado_en!).getTime() - new Date(tramite.fecha_creacion).getTime()) / 86_400_000));
              return (
                <div key={tramite.id} onClick={() => navigate(`/tramites/${tramite.id}`)} className="relative bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-visible hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex opacity-75">
                  <div className={`w-1.5 group-hover:w-2 shrink-0 transition-all duration-200 rounded-l-xl ${!dbColor ? fbc : ''}`} style={dbColor ? { backgroundColor: dbColor } : undefined} />
                  <div className="flex-1 min-w-0 px-3 py-3 flex flex-col gap-1">
                    <p className={`font-extrabold text-xs uppercase tracking-wide leading-tight truncate ${!dbColor ? ac.color : ''}`} style={dbColor ? { color: dbColor } : undefined}>{tramite.agente?.nombre_completo || 'Sin asignar'}</p>
                    <p className={`text-xs font-semibold uppercase opacity-75 truncate ${!dbColor ? ac.color : ''}`} style={dbColor ? { color: dbColor } : undefined}>{tipoDb?.label ?? getTipoTramiteLabel(tramite.tipo_tramite)}</p>
                    {(tramite.custom_estatus_label ?? tramite.estatus?.nombre) && <span className="text-xs font-bold uppercase" style={{ color: tramite.custom_estatus_color ?? tramite.estatus?.color ?? undefined }}>{tramite.custom_estatus_label ?? tramite.estatus?.nombre}</span>}
                    {preview && (
                      <p className="text-xs text-neutral-500 dark:text-white/40 leading-snug line-clamp-2 mt-0.5 break-words">{preview}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-neutral-400 dark:text-white/30">{fmtFecha(tramite.fecha_creacion)}</span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-white/5 text-neutral-400 dark:text-white/30">{totalDays}d</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={`text-xs font-extrabold uppercase tracking-widest truncate ${!dbColor ? ac.color : ''}`} style={dbColor ? { color: dbColor } : undefined}>{tramite.folio}</span>
                      <span className="text-xs text-neutral-400 dark:text-white/30 shrink-0">{new Date(tramite.cerrado_en!).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => { setActiveTab('cerrados'); setViewMode('lista'); }}
              className="mt-1 text-xs font-semibold text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70 py-2 border border-neutral-200 dark:border-white/10 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
            >
              {kanbanCerrados.length > 10 ? `Ver todos (${kanbanCerrados.length}) →` : 'Ver en tablero →'}
            </button>
          </div>

        </div>
      )}

      {/* Normal activos/cerrados list — oculto cuando Kanban está activo en tab activos */}
      {activeTab !== 'papelera' && !(activeTab === 'activos' && viewMode === 'kanban') && (loading ? (
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

          {filteredTramites.map(tramite => {
            const area = getTipoTramiteArea(tramite.tipo_tramite);
            const ac = AREA_CONFIG[area];
            const tipoDb = tiposDb.get(tramite.tipo_tramite);
            const dbColor = tipoDb?.color;
            const fallbackBarClass = area === 'Comercial' ? 'bg-sky-700' : 'bg-amber-600';
            const hasArchivos = (tramite.ticket_archivos?.length ?? 0) > 0;
            const needsAttention = !!tramite.ultima_accion_por && tramite.ultima_accion_por !== usuario?.id;

            return (
              <div
                key={tramite.id}
                onClick={() => navigate(`/tramites/${tramite.id}`)}
                className="relative bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-visible hover:shadow-lg hover:-translate-y-0.5 hover:border-neutral-300 dark:hover:border-white/20 transition-all duration-200 cursor-pointer group flex"
              >
                {/* Globito animado — requiere atención */}
                {needsAttention && (
                  <button
                    onClick={(e) => handleMarkAsRead(e, tramite.id)}
                    className="absolute -top-1.5 -right-1.5 z-10"
                    title="Marcar como leído"
                  >
                    <span className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                      <span className="relative inline-flex h-4 w-4 rounded-full bg-orange-500 shadow-sm shadow-orange-300/60" />
                    </span>
                  </button>
                )}

                {/* Colored left strip — grows slightly on hover */}
                <div
                  className={`w-1.5 group-hover:w-2 shrink-0 transition-all duration-200 rounded-l-xl ${!dbColor ? fallbackBarClass : ''}`}
                  style={dbColor ? { backgroundColor: dbColor } : undefined}
                />

                {/* Card body */}
                <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:divide-x divide-neutral-100 dark:divide-white/8">

                  {/* Left: meta info */}
                  <div className="px-4 pt-4 pb-3 sm:pb-4 flex flex-col gap-2 sm:w-[38%] sm:shrink-0">
                    {/* Agent name + tipo */}
                    <div>
                      <p
                        className={`font-extrabold text-sm uppercase tracking-wide leading-tight ${!dbColor ? ac.color : ''}`}
                        style={dbColor ? { color: dbColor } : undefined}
                      >
                        {tramite.agente?.nombre_completo || 'Sin asignar'}
                      </p>
                      <p
                        className={`text-[11px] font-semibold mt-0.5 uppercase tracking-wide opacity-80 ${!dbColor ? ac.color : ''}`}
                        style={dbColor ? { color: dbColor } : undefined}
                      >
                        {tipoDb?.label ?? getTipoTramiteLabel(tramite.tipo_tramite)}
                      </p>
                    </div>

                    {/* Status / priority / dates */}
                    <div className="space-y-0.5 text-xs">
                      {(tramite.custom_estatus_label ?? tramite.estatus?.nombre) && (
                        <p className="text-neutral-600 dark:text-white/60">
                          <span className="text-neutral-400 dark:text-white/35">Estatus: </span>
                          <span className="font-bold uppercase" style={{ color: tramite.custom_estatus_color ?? tramite.estatus?.color ?? undefined }}>
                            {tramite.custom_estatus_label ?? tramite.estatus?.nombre}
                          </span>
                        </p>
                      )}
                      {!esRolSistemaAgente && (
                        <p className="text-neutral-600 dark:text-white/60">
                          <span className="text-neutral-400 dark:text-white/35">Prioridad: </span>
                          <span className={`font-bold uppercase ${tramite.prioridad === 'Alta' ? 'text-red-600' : tramite.prioridad === 'Media' ? 'text-amber-600' : 'text-green-600'}`}>
                            {tramite.prioridad}
                          </span>
                        </p>
                      )}
                      <p className="text-neutral-600 dark:text-white/60">
                        <span className="text-neutral-400 dark:text-white/35">Fecha creación: </span>
                        <span className="font-medium">
                          {new Date(tramite.fecha_creacion).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      </p>
                      {tramite.cerrado_en && (
                        <p className="text-neutral-600 dark:text-white/60">
                          <span className="text-neutral-400 dark:text-white/35">Fecha finalización: </span>
                          <span className="font-bold">
                            {new Date(tramite.cerrado_en).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Folio + clip indicator + delete */}
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <p
                        className={`text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 ${!dbColor ? ac.color : ''}`}
                        style={dbColor ? { color: dbColor } : undefined}
                      >
                        Folio: {tramite.folio}
                        {hasArchivos && <Paperclip className="w-3 h-3 shrink-0" title={`${tramite.ticket_archivos.length} archivo(s) adjunto(s)`} />}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => handleDuplicar(e, tramite)}
                          className="p-1 rounded-md text-neutral-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-0 group-hover:opacity-100"
                          title="Duplicar trámite"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {esRolSistemaAdmin && (
                          <button
                            onClick={(e) => handleSoftDelete(e, tramite.id)}
                            className="p-1 rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                            title="Mover a papelera"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: message + responsable */}
                  <div className="flex-1 px-4 pt-3 sm:pt-4 pb-4 flex flex-col justify-between gap-3 min-w-0">
                    <p className="text-xs text-neutral-700 dark:text-white/75 leading-relaxed line-clamp-4 sm:line-clamp-5">
                      <span className="font-semibold text-neutral-500 dark:text-white/50">Mensaje: </span>
                      {tramite.instrucciones}
                    </p>
                    <div className="flex items-end justify-between gap-2 mt-auto flex-wrap">
                      <div className="flex items-center gap-2">
                        {tramite.poliza && (
                          <span className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-white/35">
                            <FileText className="w-3 h-3" />
                            {tramite.poliza}
                          </span>
                        )}
                        {hasArchivos && (
                          <span className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-white/35">
                            <Paperclip className="w-3 h-3" />
                            {tramite.ticket_archivos.length}
                          </span>
                        )}
                      </div>
                      {(() => {
                        const isPool = !tramite.assigned_to_user_id && !!tramite.grupo_asignado_id;
                        const myRoleInGroup = tramite.grupo_asignado_id ? myGrupoRoles.get(tramite.grupo_asignado_id) : null;
                        const canAssignOrTake = !!myRoleInGroup || esRolSistemaAdmin || esRolSistemaGerente;
                        const isSelfOnly = !!myRoleInGroup && myRoleInGroup === 'ejecutivo' && !esRolSistemaAdmin && !esRolSistemaGerente;
                        if (isPool && activeTab === 'activos' && canAssignOrTake) {
                          return (
                            <div className="flex items-center gap-1.5 flex-wrap justify-end" onClick={e => e.stopPropagation()}>
                              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/40">
                                Sin Asignar
                              </span>
                              {assigningTramiteId === tramite.id ? (
                                <div className="flex items-center gap-1">
                                  <select
                                    value={assignTargetId}
                                    onChange={e => setAssignTargetId(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className="text-xs border border-neutral-200 dark:border-white/15 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none max-w-[150px] bg-white dark:bg-neutral-800 dark:text-white"
                                  >
                                    <option value="">Ejecutivo...</option>
                                    {teamEjecutivos.map(u => (
                                      <option key={u.id} value={u.id}>{u.nombre_completo}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); void handleAssignTramite(tramite.id, assignTargetId); }}
                                    disabled={!assignTargetId}
                                    className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setAssigningTramiteId(null); setAssignTargetId(''); }}
                                    className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors text-neutral-400"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssigningTramiteId(tramite.id);
                                    setAssignTargetId('');
                                    if (isSelfOnly && usuario) {
                                      setTeamEjecutivos([{ id: usuario.id, nombre_completo: (usuario as any).nombre_completo || `${usuario.nombre} ${usuario.apellidos}`.trim() }]);
                                    } else {
                                      void loadTeamEjecutivos(tramite.grupo_asignado_id);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  {isSelfOnly ? 'Tomar' : 'Asignar'}
                                </button>
                              )}
                            </div>
                          );
                        }
                        return (
                          <p className="text-[11px] font-extrabold uppercase tracking-wide text-neutral-400 dark:text-white/35 text-right shrink-0">
                            Responsable: {tramite.responsable?.nombre_completo || 'Sin asignar'}
                          </p>
                        );
                      })()}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      ))}

      <NuevoTramiteModal
        isOpen={showNuevoModal}
        onClose={() => { setShowNuevoModal(false); setDuplicarPreload(null); }}
        onSuccess={() => {
          setShowNuevoModal(false);
          setDuplicarPreload(null);
          invalidateCacheByPrefix('tramites_');
          loadData();
        }}
        estatusList={estatusList}
        preloadedData={duplicarPreload ?? undefined}
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

      {showPanelLider && <PanelLider onClose={() => setShowPanelLider(false)} />}

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
export default Tramites;
