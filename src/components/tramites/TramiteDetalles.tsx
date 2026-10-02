import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { User, Users, FileText, Calendar, Clock, Briefcase, Shield, Building2, TrendingUp, UserCheck, Wrench, Link as LinkIcon } from 'lucide-react';
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
  canEdit?: boolean;
  canManageAssignment?: boolean;
  canSelfAssignOnly?: boolean;
  grupoAsignadoId?: string | null;
  onResponsableChange?: (userId: string) => void;
  onEquipoChange?: (grupoId: string | null) => void;
  estatusCampoDinamico?: EstatusCampoDinamico | null;
  selectedEstatusSlug?: string;
}

export function TramiteDetalles({
  tramite,
  estatusList,
  selectedEstatus,
  setSelectedEstatus,
  canEdit = false,
  canManageAssignment = false,
  canSelfAssignOnly = false,
  grupoAsignadoId,
  onResponsableChange,
  onEquipoChange,
  estatusCampoDinamico,
  selectedEstatusSlug,
}: TramiteDetallesProps) {
  const { usuario } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedResponsable, setSelectedResponsable] = useState(tramite.responsable?.id ?? '');
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
          type Row = { usuario_id: string; usuarios: { id: string; nombre_completo: string }[] };
          const seen = new Set<string>();
          const members: TeamMember[] = [];
          for (const m of miembros as Row[]) {
            const u = m.usuarios?.[0];
            if (!seen.has(m.usuario_id) && u) {
              seen.add(m.usuario_id);
              members.push({ id: u.id, nombre_completo: u.nombre_completo });
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

  const getEstatusColor = (clasificacion?: string | null) =>
    clasificacion === 'inicio' ? '#3B82F6'
    : clasificacion === 'terminacion' ? '#059669'
    : '#7C3AED';

  return (
    <div className="space-y-6">
      {/* Personas involucradas: Agente (solicitante) | Equipo | Responsable */}
      <div className="p-4 border border-neutral-200 rounded-2xl bg-neutral-50/60 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <Users className="w-4 h-4 text-accent-ink" />
          Personas involucradas
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
              <User className="w-4 h-4 inline mr-2" />
              Agente
            </label>
            <p className="text-[11px] text-neutral-500 -mt-1 mb-2">Solicitante — para quién es este trámite.</p>
            <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
              {tramite.agente?.nombre_completo || 'Sin agente asignado'}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
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
                className="w-full px-3 py-2 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all cursor-pointer bg-amber-50 text-amber-900"
              >
                <option value="">Sin equipo asignado</option>
                {grupos.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            ) : (
              <div className={`px-3 py-2 rounded-xl border ${selectedGrupoId ? 'bg-amber-50 border-amber-200 text-amber-900 font-medium' : 'bg-neutral-50 border-neutral-200 text-neutral-500'}`}>
                {grupos.find(g => g.id === selectedGrupoId)?.nombre || 'Sin equipo asignado'}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
              <UserCheck className="w-4 h-4 inline mr-2" />
              Responsable
              {canManageAssignment && selectedGrupoId && (
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  — miembros de {grupos.find(g => g.id === selectedGrupoId)?.nombre}
                </span>
              )}
            </label>
            <p className="text-[11px] text-neutral-500 -mt-1 mb-2">Quién debe atender este trámite.</p>
            {canManageAssignment && onResponsableChange ? (
              <select
                value={selectedResponsable}
                onChange={e => {
                  setSelectedResponsable(e.target.value);
                  onResponsableChange(e.target.value);
                }}
                className="w-full px-3 py-2 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all cursor-pointer bg-blue-50 text-blue-900"
              >
                <option value="">Sin responsable asignado</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre_completo}</option>
                ))}
              </select>
            ) : (
              <div className={`px-3 py-2 rounded-xl border ${tramite.assigned_to_user_id ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                {tramite.responsable?.nombre_completo || (
                  <span className="text-amber-700 font-medium">Sin responsable — pendiente de asignación</span>
                )}
              </div>
            )}
          </div>
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

      {/* La Prioridad vive ahora en el encabezado, bajo el Estatus: son las dos
          cosas que se consultan de un vistazo y que más se cambian. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        {!estatusCampoDinamico && (
          <div>
            <label className="block text-[13px] font-semibold text-neutral-600 mb-1">Estatus</label>
            {canEdit ? (
              <select
                value={selectedEstatus}
                onChange={(e) => setSelectedEstatus(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all cursor-pointer"
              >
                {estatusList.map(estatus => (
                  <option key={estatus.id} value={estatus.id}>{estatus.nombre}</option>
                ))}
              </select>
            ) : (
              <div
                className="px-3 py-2 rounded-xl border font-semibold"
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

      {/* `tickets.poliza` es del esquema original de CRM y solo lo llenaban
          `correccion_poliza_registrada` y `correccion_poliza_endoso`, los dos
          Legacy dados de baja el 2026-09-23. En un tipo del FormBuilder siempre
          estaba vacío: era una tarjeta que decía "Sin póliza" y nada más. Se
          conserva para los trámites viejos que sí traen el dato. */}
      {tramite.poliza && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
              <FileText className="w-4 h-4 inline mr-2" />
              Póliza
            </label>
            <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
              {tramite.poliza}
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
          Instrucciones / Descripción
        </label>
        <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl whitespace-pre-wrap">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
                <Briefcase className="w-4 h-4 inline mr-2" />
                Tipo de Trámite
              </label>
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl font-medium text-blue-900">
                {tramite.activity_subtype?.nombre || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
                <User className="w-4 h-4 inline mr-2" />
                Agente
              </label>
              <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.agente_usuario?.nombre_completo || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
                <Shield className="w-4 h-4 inline mr-2" />
                Tipo de Seguro
              </label>
              <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.insurance_type?.nombre || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
                <User className="w-4 h-4 inline mr-2" />
                Quién Atiende
              </label>
              <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-xl font-medium text-green-900">
                {tramite.attending_user?.nombre_completo || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
                <Calendar className="w-4 h-4 inline mr-2" />
                Fecha de Inicio
              </label>
              <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
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
              <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
                <Clock className="w-4 h-4 inline mr-2" />
                Fecha de Finalización
              </label>
              <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
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
              <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Estatus de Actividad
              </label>
              {tramite.estatus ? (
                <div
                  className="px-3 py-2 rounded-xl font-bold border"
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
                <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-500">
                  N/A
                </div>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-neutral-600 mb-1">
                <Building2 className="w-4 h-4 inline mr-2" />
                Aseguradoras
              </label>
              <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
                {tramite.insurers_nombres && tramite.insurers_nombres.length > 0
                  ? tramite.insurers_nombres.join(', ')
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {inicioEspera && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 mb-4">
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

      {/* "Fechas y seguimiento" se mudó al encabezado, sobre las pestañas
          (TramiteFechasBar): son datos que se consultan de un vistazo y nunca se
          editan, y aquí abajo obligaban a hacer scroll para ver cuándo se creó
          el trámite. */}
    </div>
  );
}
