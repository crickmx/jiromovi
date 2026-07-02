import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { User, Users, AlertCircle, FileText, Calendar, Clock, Briefcase, Shield, Building2, TrendingUp, UserCheck, X, UserPlus, Wrench, Link as LinkIcon } from 'lucide-react';
import { addUserToSicas, getSicasMappingStatusForUsers } from '../../lib/sicasUtils';
import { crearNotificacionGlobal } from '../../lib/notificationHelpers';
import { getEstatusColor } from '../../lib/registroActividadesTypes';

interface TramiteEstatus {
  id: string;
  nombre: string;
  color: string;
}

interface Usuario {
  id: string;
  nombre_completo: string;
}

interface TramiteData {
  id: string;
  folio: string;
  tipo_tramite: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  poliza: string | null;
  instrucciones: string;
  fecha_creacion: string;
  ultima_modificacion: string;
  cerrado_en: string | null;
  assigned_to_user_id: string | null;
  agente: Usuario | null;
  responsable: Usuario | null;
  estatus: TramiteEstatus | null;
  creado_por_usuario: Usuario | null;
  modificado_por_usuario: Usuario | null;
  cerrado_por_usuario: Usuario | null;
  // Campos de Registro de Actividades
  activity_subtype?: { id: string; nombre: string } | null;
  agente_usuario?: Usuario | null;
  insurance_type?: { id: string; nombre: string } | null;
  attending_user?: Usuario | null;
  request_datetime?: string | null;
  completion_datetime?: string | null;
  cerrado?: boolean;
  resultado?: string | null;
  insurers?: string[];
  insurers_nombres?: string[];
  fecha_promesa_entrega?: string | null;
}

interface Asignacion {
  id: string;
  ejecutivo: Usuario | null;
}

interface TeamMember {
  id: string;
  nombre_completo: string;
}

interface Grupo {
  id: string;
  nombre: string;
}

interface EstatusOpcion {
  label: string;
  slug: string;
  clasificacion?: string | null;
}

interface EstatusCampoDinamico {
  id: string;
  label: string;
  config: { opciones?: EstatusOpcion[] };
}

interface TramiteDetallesProps {
  tramite: TramiteData;
  estatusList: TramiteEstatus[];
  selectedEstatus: string;
  setSelectedEstatus: (value: string) => void;
  selectedPrioridad: 'Alta' | 'Media' | 'Baja';
  setSelectedPrioridad: (value: 'Alta' | 'Media' | 'Baja') => void;
  canEdit?: boolean;
  canManageAssignment?: boolean;
  canSelfAssignOnly?: boolean;
  grupoAsignadoId?: string | null;
  onResponsableChange?: (userId: string) => void;
  onEquipoChange?: (grupoId: string | null) => void;
  estatusCampoDinamico?: EstatusCampoDinamico | null;
  selectedEstatusSlug?: string;
  onEstatusSlugChange?: (slug: string) => void;
}

export function TramiteDetalles({
  tramite,
  estatusList,
  selectedEstatus,
  setSelectedEstatus,
  selectedPrioridad,
  setSelectedPrioridad,
  canEdit = false,
  canManageAssignment = false,
  canSelfAssignOnly = false,
  grupoAsignadoId,
  onResponsableChange,
  onEquipoChange,
  estatusCampoDinamico,
  selectedEstatusSlug,
  onEstatusSlugChange,
}: TramiteDetallesProps) {
  const { usuario } = useAuth();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedResponsable, setSelectedResponsable] = useState(tramite.responsable?.id ?? '');
  const [addingEjecutivo, setAddingEjecutivo] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>(grupoAsignadoId ?? '');
  const [sicasMappedIds, setSicasMappedIds] = useState<Set<string>>(new Set());
  const [addingToSicas, setAddingToSicas] = useState(false);
  const [sicasMsg, setSicasMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [inicioEspera, setInicioEspera] = useState<string | null>(null);

  useEffect(() => {
    setSelectedGrupoId(grupoAsignadoId ?? '');
  }, [grupoAsignadoId]);

  // Detectar si hay una pausa activa (en_espera) y guardar su inicio
  useEffect(() => {
    const esEnEspera = estatusCampoDinamico
      ? (estatusCampoDinamico.config?.opciones ?? []).find(
          (o: { slug: string; clasificacion?: string | null }) => o.slug === selectedEstatusSlug
        )?.clasificacion === 'en_espera'
      : false;

    if (!esEnEspera) { setInicioEspera(null); return; }

    supabase
      .from('tramite_pausas')
      .select('inicio_pausa')
      .eq('tramite_id', tramite.id)
      .is('fin_pausa', null)
      .order('inicio_pausa', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setInicioEspera(data?.inicio_pausa ?? null));
  }, [tramite.id, selectedEstatusSlug, estatusCampoDinamico]);

  useEffect(() => {
    loadAsignaciones();
  }, [tramite.id]);

  useEffect(() => {
    setSelectedResponsable(tramite.responsable?.id ?? '');
  }, [tramite.responsable?.id]);

  // Load available teams, filtered by the area of this tramite type
  useEffect(() => {
    const loadGrupos = async () => {
      const { data: tipoData } = await supabase
        .from('ticket_tipos')
        .select('area_id')
        .eq('value', tramite.tipo_tramite)
        .maybeSingle();

      if (tipoData?.area_id) {
        const { data: equiposAreas } = await supabase
          .from('tramites_equipos_areas')
          .select('equipo_id')
          .eq('area_id', tipoData.area_id);
        const ids = (equiposAreas ?? []).map((e: { equipo_id: string }) => e.equipo_id);
        if (ids.length) {
          const { data } = await supabase
            .from('tramites_grupos_visualizacion')
            .select('id, nombre')
            .in('id', ids)
            .eq('activo', true)
            .order('nombre');
          if (data?.length) { setGrupos(data as Grupo[]); return; }
        }
      }

      // Fallback: all active groups (legacy tickets or tipo without area mapping)
      const { data: todos } = await supabase
        .from('tramites_grupos_visualizacion')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (todos) setGrupos(todos as Grupo[]);
    };
    loadGrupos();
  }, [tramite.tipo_tramite]);

  // Load team members when selected group changes
  useEffect(() => {
    if (!canManageAssignment) { setTeamMembers([]); return; }
    // Ejecutivo: solo puede asignarse a sí mismo
    if (canSelfAssignOnly && usuario) {
      setTeamMembers([{ id: usuario.id, nombre_completo: (usuario as any).nombre_completo || `${usuario.nombre} ${usuario.apellidos}`.trim() }]);
      return;
    }
    const load = async () => {
      if (selectedGrupoId) {
        const { data } = await supabase.rpc('get_grupo_miembros_ejecutivos', { p_grupo_id: selectedGrupoId });
        if (data) setTeamMembers(data as TeamMember[]);
      } else {
        // No group selected: show lider+ejecutivo from area-filtered groups
        if (!grupos.length) { setTeamMembers([]); return; }
        const { data: miembros } = await supabase
          .from('tramites_grupos_miembros')
          .select('usuario_id, usuarios!inner(id, nombre_completo)')
          .in('grupo_id', grupos.map((g: Grupo) => g.id))
          .in('rol_en_equipo', ['lider', 'ejecutivo']);
        if (miembros) {
          type Row = { usuario_id: string; usuarios: { id: string; nombre_completo: string } };
          const seen = new Set<string>();
          const members: TeamMember[] = [];
          for (const m of miembros as Row[]) {
            if (!seen.has(m.usuario_id)) {
              seen.add(m.usuario_id);
              members.push({ id: m.usuarios.id, nombre_completo: m.usuarios.nombre_completo });
            }
          }
          setTeamMembers(members);
        }
      }
    };
    load();
  }, [selectedGrupoId, canManageAssignment, grupos]);

  // Cargar estado de mapeo SICAS para los miembros del equipo
  useEffect(() => {
    if (!teamMembers.length) return;
    getSicasMappingStatusForUsers(teamMembers.map(m => m.id))
      .then(ids => setSicasMappedIds(ids));
  }, [teamMembers]);

  const handleAgregarResponsableASicas = async (userId: string, userName: string) => {
    if (!usuario) return;
    const isAdmin = usuario.rol === 'Administrador' || usuario.rol === 'Gerente';
    setAddingToSicas(true);
    setSicasMsg(null);
    try {
      const result = await addUserToSicas(userId, usuario.id, userName, isAdmin);
      if (!result.success) {
        setSicasMsg({ type: 'err', text: result.error || 'Error al agregar' });
        return;
      }
      if (result.status === 'active') {
        setSicasMsg({ type: 'ok', text: `${userName} agregado a SICAS.` });
        setSicasMappedIds(prev => new Set([...prev, userId]));
      } else {
        setSicasMsg({ type: 'ok', text: 'Solicitud enviada. El admin revisará el mapeo.' });
        await crearNotificacionGlobal(
          'Solicitud: agregar usuario a SICAS',
          `${(usuario as any).nombre_completo || usuario.nombre} solicita agregar a ${userName} al mapeo SICAS.`,
          '/sicas-admin?tab=vendedores',
          { tipo: 'rol', rol: 'Administrador' },
          usuario.id
        );
      }
    } catch (e: any) {
      setSicasMsg({ type: 'err', text: e.message });
    } finally {
      setAddingToSicas(false);
    }
  };

  const loadAsignaciones = async () => {
    const { data } = await supabase
      .from('ticket_asignaciones')
      .select('id, ejecutivo:ejecutivo_id(id, nombre_completo)')
      .eq('ticket_id', tramite.id);
    if (data) setAsignaciones(data as Asignacion[]);
  };

  const handleRemoverEjecutivo = async (asignacionId: string) => {
    await supabase.from('ticket_asignaciones').delete().eq('id', asignacionId);
    await loadAsignaciones();
  };

  const handleAgregarEjecutivo = async (userId: string) => {
    if (!userId || !usuario) return;
    await supabase.from('ticket_asignaciones').insert({
      ticket_id: tramite.id,
      ejecutivo_id: userId,
      asignado_por: usuario.id,
    });
    setAddingEjecutivo(false);
    await loadAsignaciones();
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return 'bg-red-100 text-red-700 border-red-300';
      case 'Media': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Baja': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-neutral-100 text-neutral-700 border-neutral-300';
    }
  };

  const estatusOpciones = estatusCampoDinamico?.config?.opciones || [];
  const estatusOpcionActual = estatusOpciones.find(o => o.slug === selectedEstatusSlug);
  const getEstatusColor = (clasificacion?: string | null) =>
    clasificacion === 'inicio' ? '#3B82F6'
    : clasificacion === 'terminacion' ? '#059669'
    : '#7C3AED';

  return (
    <div className="space-y-6">
      {/* Estatus FormBuilder — PRIMERO y prominente */}
      {estatusCampoDinamico && (
        <div className="p-4 rounded-2xl border-2" style={{
          borderColor: getEstatusColor(estatusOpcionActual?.clasificacion),
          backgroundColor: getEstatusColor(estatusOpcionActual?.clasificacion) + '10',
        }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: getEstatusColor(estatusOpcionActual?.clasificacion) }}>
            {estatusCampoDinamico.label}
          </p>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {estatusOpciones.map(opt => {
                const c = getEstatusColor(opt.clasificacion);
                const isSel = opt.slug === selectedEstatusSlug;
                return (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => onEstatusSlugChange?.(opt.slug)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                    style={isSel
                      ? { backgroundColor: c, borderColor: c, color: '#fff' }
                      : { backgroundColor: 'transparent', borderColor: c + '60', color: c }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xl font-bold" style={{ color: getEstatusColor(estatusOpcionActual?.clasificacion) }}>
              {estatusOpcionActual?.label ?? selectedEstatusSlug ?? '—'}
            </p>
          )}
        </div>
      )}

      {/* Fila 1: Agente | Equipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Agente
          </label>
          <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            {tramite.agente?.nombre_completo || 'Sin agente asignado'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <Wrench className="w-4 h-4 inline mr-2" />
            Equipo
          </label>
          {canManageAssignment && onEquipoChange ? (
            <select
              value={selectedGrupoId}
              onChange={e => {
                const val = e.target.value;
                setSelectedGrupoId(val);
                setSelectedResponsable('');
                onEquipoChange(val || null);
              }}
              className="w-full px-4 py-3 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all cursor-pointer bg-amber-50 text-amber-900"
            >
              <option value="">Sin equipo asignado</option>
              {grupos.map(g => (
                <option key={g.id} value={g.id}>{g.nombre}</option>
              ))}
            </select>
          ) : (
            <div className={`px-4 py-3 rounded-xl border ${selectedGrupoId ? 'bg-amber-50 border-amber-200 text-amber-900 font-medium' : 'bg-neutral-50 border-neutral-200 text-neutral-500'}`}>
              {grupos.find(g => g.id === selectedGrupoId)?.nombre || 'Sin equipo asignado'}
            </div>
          )}
        </div>
      </div>

      {/* Fila 2: Responsable */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <UserCheck className="w-4 h-4 inline mr-2" />
            Responsable
            {canManageAssignment && selectedGrupoId && (
              <span className="ml-2 text-xs font-normal text-neutral-400">
                — miembros de {grupos.find(g => g.id === selectedGrupoId)?.nombre}
              </span>
            )}
          </label>
          {canManageAssignment && onResponsableChange ? (
            <select
              value={selectedResponsable}
              onChange={e => {
                setSelectedResponsable(e.target.value);
                onResponsableChange(e.target.value);
              }}
              className="w-full px-4 py-3 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-blue-50 text-blue-900"
            >
              <option value="">Sin responsable asignado</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.nombre_completo}</option>
              ))}
            </select>
          ) : (
            <div className={`px-4 py-3 rounded-xl border ${tramite.assigned_to_user_id ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
              {tramite.responsable?.nombre_completo || (
                <span className="text-amber-700 font-medium">Sin responsable — pendiente de asignación</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Indicador SICAS para el responsable seleccionado */}
      {canManageAssignment && selectedResponsable && !sicasMappedIds.has(selectedResponsable) && (() => {
        const member = teamMembers.find(m => m.id === selectedResponsable);
        if (!member) return null;
        return (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <LinkIcon className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-amber-800 flex-1">
              <span className="font-medium">{member.nombre_completo}</span> no tiene mapeo en SICAS.
            </span>
            {sicasMsg ? (
              <span className={sicasMsg.type === 'ok' ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                {sicasMsg.text}
              </span>
            ) : (
              <button
                type="button"
                disabled={addingToSicas}
                onClick={() => handleAgregarResponsableASicas(member.id, member.nombre_completo)}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {addingToSicas ? 'Enviando...' : (usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente') ? 'Agregar a SICAS' : 'Solicitar acceso'}
              </button>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Prioridad
          </label>
          {canEdit ? (
            <select
              value={selectedPrioridad}
              onChange={(e) => setSelectedPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
              className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all cursor-pointer"
            >
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          ) : (
            <div className={`px-4 py-3 rounded-xl border font-semibold ${getPrioridadColor(tramite.prioridad)}`}>
              {tramite.prioridad}
            </div>
          )}
        </div>

        {!estatusCampoDinamico && (
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">Estatus</label>
            {canEdit ? (
              <select
                value={selectedEstatus}
                onChange={(e) => setSelectedEstatus(e.target.value)}
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all cursor-pointer"
              >
                {estatusList.map(estatus => (
                  <option key={estatus.id} value={estatus.id}>{estatus.nombre}</option>
                ))}
              </select>
            ) : (
              <div
                className="px-4 py-3 rounded-xl border font-semibold"
                style={{
                  backgroundColor: tramite.estatus?.color + '20',
                  color: tramite.estatus?.color,
                  borderColor: tramite.estatus?.color
                }}
              >
                {tramite.estatus?.nombre}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            <FileText className="w-4 h-4 inline mr-2" />
            Póliza
          </label>
          <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            {tramite.poliza || 'Sin póliza'}
          </div>
        </div>
      </div>

      {(asignaciones.length > 0 || canManageAssignment) && (
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Ejecutivos Asignados
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {asignaciones.map(asignacion => (
              <span
                key={asignacion.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 font-medium text-sm"
              >
                {asignacion.ejecutivo?.nombre_completo}
                {canManageAssignment && (
                  <button
                    onClick={() => handleRemoverEjecutivo(asignacion.id)}
                    className="ml-0.5 hover:text-red-600 transition-colors"
                    title="Quitar ejecutivo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
            {canManageAssignment && (
              addingEjecutivo ? (
                <select
                  autoFocus
                  defaultValue=""
                  onChange={e => { if (e.target.value) handleAgregarEjecutivo(e.target.value); }}
                  onBlur={() => setAddingEjecutivo(false)}
                  className="px-3 py-1.5 text-sm border border-blue-300 rounded-lg bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                >
                  <option value="" disabled>Seleccionar ejecutivo...</option>
                  {teamMembers
                    .filter(m => !asignaciones.some(a => a.ejecutivo?.id === m.id))
                    .map(m => <option key={m.id} value={m.id}>{m.nombre_completo}</option>)
                  }
                </select>
              ) : (
                <button
                  onClick={() => setAddingEjecutivo(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 border-dashed rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              )
            )}
            {asignaciones.length === 0 && !addingEjecutivo && !canManageAssignment && (
              <span className="text-sm text-neutral-400 italic">Sin ejecutivos asignados</span>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Instrucciones / Descripción
        </label>
        <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl whitespace-pre-wrap">
          {tramite.instrucciones}
        </div>
      </div>

      {/* Sección especial para Cotización / Emisión */}
      {tramite.tipo_tramite === 'cotizacion_emision' && (
        <div className="border-t border-neutral-200 pt-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Detalles de Cotización / Emisión
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Briefcase className="w-4 h-4 inline mr-2" />
                Tipo de Trámite
              </label>
              <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl font-medium text-blue-900">
                {tramite.activity_subtype?.nombre || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Agente
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.agente_usuario?.nombre_completo || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Shield className="w-4 h-4 inline mr-2" />
                Tipo de Seguro
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.insurance_type?.nombre || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Quién Atiende
              </label>
              <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl font-medium text-green-900">
                {tramite.attending_user?.nombre_completo || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Fecha de Inicio
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.request_datetime
                  ? new Date(tramite.request_datetime).toLocaleString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Clock className="w-4 h-4 inline mr-2" />
                Fecha de Finalización
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.completion_datetime
                  ? new Date(tramite.completion_datetime).toLocaleString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Pendiente'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Estatus de Actividad
              </label>
              {tramite.estatus ? (
                <div
                  className="px-4 py-3 rounded-xl font-bold border"
                  style={{
                    backgroundColor: (tramite.estatus.color || getEstatusColor(tramite.estatus.nombre)) + '20',
                    color: tramite.estatus.color || getEstatusColor(tramite.estatus.nombre),
                    borderColor: tramite.estatus.color || getEstatusColor(tramite.estatus.nombre),
                  }}
                >
                  {tramite.estatus.nombre}
                  {tramite.cerrado && (
                    <span className="ml-2 text-xs font-normal opacity-70">(Cerrado)</span>
                  )}
                </div>
              ) : (
                <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-500">
                  N/A
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Aseguradoras
              </label>
              <div className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.insurers_nombres && tramite.insurers_nombres.length > 0
                  ? tramite.insurers_nombres.join(', ')
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {inicioEspera && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 mb-4">
          <Clock className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Trámite en espera</p>
            <p className="text-xs text-amber-600">
              En espera desde{' '}
              {new Date(inicioEspera).toLocaleString('es-MX', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}

      <div className="border-t border-neutral-200 pt-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Información del Tramite</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center space-x-2 text-neutral-600 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">Fecha de Creación:</span>
            </div>
            <div className="text-neutral-900 ml-6">
              {new Date(tramite.fecha_creacion).toLocaleString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            {tramite.creado_por_usuario && (
              <div className="text-neutral-600 ml-6 text-xs">
                por {tramite.creado_por_usuario.nombre_completo}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2 text-neutral-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Última Modificación:</span>
            </div>
            <div className="text-neutral-900 ml-6">
              {new Date(tramite.ultima_modificacion).toLocaleString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            {tramite.modificado_por_usuario && (
              <div className="text-neutral-600 ml-6 text-xs">
                por {tramite.modificado_por_usuario.nombre_completo}
              </div>
            )}
          </div>

          {tramite.fecha_promesa_entrega && (
            <div>
              <div className="flex items-center space-x-2 text-neutral-600 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Fecha Promesa de Entrega:</span>
              </div>
              <div className="text-neutral-900 ml-6">
                {new Date(tramite.fecha_promesa_entrega + 'T00:00:00').toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
            </div>
          )}

          {tramite.cerrado_en && (
            <div>
              <div className="flex items-center space-x-2 text-neutral-600 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Fecha de Terminación:</span>
              </div>
              <div className="text-neutral-900 ml-6">
                {new Date(tramite.cerrado_en).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              {tramite.cerrado_por_usuario && (
                <div className="text-neutral-600 ml-6 text-xs">
                  por {tramite.cerrado_por_usuario.nombre_completo}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
