import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Circle as XCircle, RefreshCw, Save, ChevronDown, CircleAlert as AlertCircle, ClipboardList, Upload, Trash2, GitBranch, ArrowUpRight, Paperclip, MessageSquare, Lock, Layers } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { TramiteDetalles } from '../components/tramites/TramiteDetalles';
import { TramiteComentarios } from '../components/tramites/TramiteComentarios';
import { TramiteArchivos } from '../components/tramites/TramiteArchivos';
import { DiagnosticoBugReport } from '../components/tramites/DiagnosticoBugReport';
import { TramiteHistorial } from '../components/tramites/TramiteHistorial';
import { ComisionesPendientes } from '../components/tramites/ComisionesPendientes';
import { crearNotificacion } from '../lib/notificationHelpers';
import { SearchableSelect } from '../components/tramites/catalogos/SearchableSelect';
import { TriggerConfirmModal, type PendingTrigger, type ExistingChild } from '../components/tramites/TriggerConfirmModal';
import { calcularDiasHabilesEntre } from '../lib/diasHabiles';
import type { TramiteSeccion } from '../components/tramites/catalogos/types';
import { seccionDesbloqueada, agruparCamposPorSeccion } from '../lib/tramiteSecciones';

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
  creado_por: string;
  assigned_to_user_id: string | null;
  grupo_asignado_id: string | null;
  estatus_id: string;
  custom_estatus_label?: string | null;
  custom_estatus_color?: string | null;
  agente: Usuario | null;
  responsable: Usuario | null;
  estatus: TramiteEstatus | null;
  creado_por_usuario: Usuario | null;
  modificado_por_usuario: Usuario | null;
  cerrado_por_usuario: Usuario | null;
  // Campos de Formulario de Cotizacion
  quote_form_id?: string | null;
  // Campos de Registro de Actividades
  activity_subtype_id?: string;
  agente_usuario_id?: string;
  insurance_type_id?: string;
  attending_user_id?: string;
  request_datetime?: string;
  completion_datetime?: string;
  cerrado?: boolean;
  resultado?: string;
  insurers?: string[];
  activity_subtype?: { id: string; nombre: string } | null;
  agente_usuario?: Usuario | null;
  insurance_type?: { id: string; nombre: string } | null;
  attending_user?: Usuario | null;
  insurers_nombres?: string[];
  fecha_promesa_entrega?: string | null;
  parent_ticket_id?: string | null;
  trigger_origen_id?: string | null;
}

export function TramiteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [tramite, setTramite] = useState<TramiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'detalles' | 'comentarios' | 'archivos' | 'historial' | 'comisiones' | 'diagnostico'>('detalles');
  const [esReporteBug, setEsReporteBug] = useState(false);

  const [estatusList, setEstatusList] = useState<TramiteEstatus[]>([]);
  const [selectedEstatus, setSelectedEstatus] = useState('');
  const [selectedPrioridad, setSelectedPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [saving, setSaving] = useState(false);
  const [showCerrarMenu, setShowCerrarMenu] = useState(false);
  const cerrarMenuRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const [userArea, setUserArea] = useState<string | null>(null);
  const [myTeamRole, setMyTeamRole] = useState<'lider' | 'ejecutivo' | 'miembro' | null>(null);
  const [canEditForType, setCanEditForType] = useState(true);

  // Campos dinámicos del catálogo
  interface CampoDinamicoOpt { label: string; slug: string; clasificacion?: string | null }
  interface CampoDinamico {
    id: string; key: string; label: string; tipo: string;
    requerido: boolean; ayuda: string | null;
    is_sistema: boolean; sistema_key: string | null;
    config: { opciones?: CampoDinamicoOpt[]; max_length?: number; es_entero?: boolean; min_fecha?: string; max_fecha?: string };
    seccion_id: string | null;
  }
  interface RespuestaDinamica { id?: string; campo_id: string; valor_texto: string | null; valor_numerico: number | null; valor_fecha: string | null; valor_booleano: boolean | null; valor_json: any }
  const [camposDinamicos, setCamposDinamicos] = useState<CampoDinamico[]>([]);
  const [respuestasDinamicas, setRespuestasDinamicas] = useState<Record<string, any>>({});
  const [respuestasOriginales, setRespuestasOriginales] = useState<RespuestaDinamica[]>([]);
  const [secciones, setSecciones] = useState<TramiteSeccion[]>([]);
  const [seccionesExpandidas, setSeccionesExpandidas] = useState<Set<string>>(new Set());
  const [catalogoRamos,     setCatalogoRamos]     = useState<{id: string; nombre: string}[]>([]);
  const [catalogoCompanias, setCatalogoCompanias] = useState<{id: string; nombre: string}[]>([]);
  const [combinaciones,     setCombinaciones]     = useState<{compania_id: string; ramo_id: string}[]>([]);
  const [cpSearchState, setCpSearchState] = useState<Record<string, {
    colonias: {colonia: string; municipio: string; estado: string}[];
    loading: boolean;
  }>>({});
  const [agentesVendedor, setAgentesVendedor] = useState<{
    id: string; nombre: string;
    usuario_id?: string; usuario_nombre?: string;
  }[]>([]);
  const [fechaPromesaEntrega, setFechaPromesaEntrega] = useState('');
  const [tipoUUID, setTipoUUID] = useState<string | null>(null);

  // Trigger modal
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [pendingTriggers, setPendingTriggers]   = useState<PendingTrigger[]>([]);
  const [silentTriggers, setSilentTriggers]     = useState<PendingTrigger[]>([]);
  const [existingChildren, setExistingChildren] = useState<Record<string, ExistingChild>>({});

  // Escalation modal
  const [escalacionModal, setEscalacionModal] = useState<{ destinatario: string; silentTriggers: PendingTrigger[] } | null>(null);
  const [escalacionComentario, setEscalacionComentario] = useState('');

  // Modal "¿Cambiar estatus?" antes de guardar
  const [estatusModalOpen, setEstatusModalOpen] = useState(false);
  const [modalKeepCurrent, setModalKeepCurrent] = useState(true);
  const [modalChosenSlug, setModalChosenSlug]   = useState('');
  const [modalChosenId,   setModalChosenId]     = useState('');
  // Ref para pasar el override a proceedWithSave sin depender de estado asíncrono
  const estatusOverrideRef = useRef<{ slug: string; id: string } | null>(null);

  // Relaciones padre / hijo (Fase 4)
  interface TicketRef { id: string; folio: string; tipo_tramite: string; tipo_label?: string; cerrado_en: string | null }
  const [childTickets, setChildTickets] = useState<TicketRef[]>([]);
  const [parentTicket, setParentTicket] = useState<TicketRef | null>(null);

  // Comentario con el que se creó el trámite — se muestra como resumen en la pestaña Detalles
  interface ComentarioInicial { mensaje: string; fecha_hora: string; usuario: { nombre_completo: string } | null }
  const [comentarioInicial, setComentarioInicial] = useState<ComentarioInicial | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isOwner = tramite?.creado_por === usuario?.id;
  const isAssigned = tramite?.assigned_to_user_id === usuario?.id;

  const OPERATIONAL_TYPES = ['correccion_comisiones', 'correccion_poliza_registrada'];
  const isOperationalTicket = tramite ? OPERATIONAL_TYPES.includes(tramite.tipo_tramite) : false;
  const isCommercialViewerOnly = userArea === 'Comercial' && isOperationalTicket && !isAdmin && !isOwner && !isAssigned;

  const canEdit = (isAdmin || isGerente || canEditForType) && !isCommercialViewerOnly;
  const canEditFechaPromesa = isAdmin || isGerente || myTeamRole === 'lider';
  const isPoolTramite = !tramite?.assigned_to_user_id && !!tramite?.grupo_asignado_id;
  const canManageAssignment = isAdmin || myTeamRole === 'lider' || (myTeamRole === 'ejecutivo' && isPoolTramite);
  const canSelfAssignOnly = myTeamRole === 'ejecutivo' && !isAdmin && !isGerente;
  const claimedRef = useRef(false);
  const isCerrado = tramite?.cerrado_en !== null;

  // Campo estatus del FormBuilder (tipo='estatus') — si existe, reemplaza el dropdown hardcodeado
  const estatusCampoDinamico = camposDinamicos.find(c => c.tipo === 'estatus') ?? null;
  const selectedEstatusSlug = estatusCampoDinamico ? (respuestasDinamicas[estatusCampoDinamico.id] ?? '') : '';

  // Debe leer la misma columna que loadCamposDinamicos usó para poblar respuestasDinamicas
  // (texto/numerico/fecha/booleano/json según campo.tipo) — comparar siempre contra valor_json
  // dejaba "original" en null para cualquier campo no-json y el botón Guardar solo reaccionaba
  // a los campos tipo estatus/dropdown/seleccion_multiple.
  const TEXTO_TIPOS_DIRTY = ['texto_corto', 'texto_largo', 'area', 'equipo',
    'agente_vendedor', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion', 'creado_por',
    'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp'];
  const valorOriginalCampo = (campo: CampoDinamico, resp?: RespuestaDinamica) => {
    if (!resp) return null;
    if (TEXTO_TIPOS_DIRTY.includes(campo.tipo)) return resp.valor_texto;
    if (['numerico', 'porcentaje'].includes(campo.tipo)) return resp.valor_numerico;
    if (campo.tipo === 'fecha') return resp.valor_fecha;
    if (campo.tipo === 'booleano') return resp.valor_booleano;
    return resp.valor_json;
  };

  const isDirty = !!tramite && (
    selectedEstatus !== (tramite.estatus?.id ?? tramite.estatus_id) ||
    selectedPrioridad !== tramite.prioridad ||
    fechaPromesaEntrega !== (tramite.fecha_promesa_entrega || '') ||
    camposDinamicos.some(campo => {
      const original = valorOriginalCampo(campo, respuestasOriginales.find(r => r.campo_id === campo.id)) ?? null;
      const current = respuestasDinamicas[campo.id] ?? null;
      return JSON.stringify(original) !== JSON.stringify(current);
    })
  );

  useEffect(() => {
    if (!showCerrarMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (cerrarMenuRef.current && !cerrarMenuRef.current.contains(event.target as Node)) {
        setShowCerrarMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCerrarMenu]);

  useEffect(() => {
    if (usuario && !isAdmin && !isGerente) {
      supabase.rpc('get_user_tramite_area', { p_user_id: usuario.id }).then(({ data }) => {
        setUserArea(data || null);
      });
    }
  }, [usuario?.id]);

  // El tipo que dispara "Reporte de bug" es configurable desde Admin > Reportes de Bugs
  // (puede cambiar con el tiempo) — la existencia de una fila en bug_reportes es lo que
  // realmente identifica a un trámite como un reporte de bug, no su tipo_tramite.
  useEffect(() => {
    if (!tramite?.id) { setEsReporteBug(false); return; }
    supabase.from('bug_reportes').select('ticket_id').eq('ticket_id', tramite.id).maybeSingle()
      .then(({ data }) => setEsReporteBug(!!data));
  }, [tramite?.id]);

  // Cargar permiso de edición para el tipo de tramite actual
  useEffect(() => {
    if (!tramite || !usuario || isAdmin || isGerente) { setCanEditForType(true); return; }
    const loadEditPerm = async () => {
      const { data: tipo } = await supabase
        .from('ticket_tipos')
        .select('id')
        .eq('value', tramite.tipo_tramite)
        .maybeSingle();
      if (!tipo?.id) { setCanEditForType(true); return; }

      // 1. Revisar override individual
      const { data: override } = await supabase
        .from('tramite_tipo_usuario_override')
        .select('puede_editar')
        .eq('tramite_tipo_id', tipo.id)
        .eq('user_id', usuario.id)
        .maybeSingle();

      if (override?.puede_editar !== null && override?.puede_editar !== undefined) {
        setCanEditForType(override.puede_editar);
        return;
      }

      // 2. Revisar config por rol
      const { data: rolPerm } = await supabase
        .from('tramite_tipo_rol_permisos')
        .select('puede_editar')
        .eq('tramite_tipo_id', tipo.id)
        .eq('rol', usuario.rol)
        .maybeSingle();

      setCanEditForType(rolPerm?.puede_editar ?? true);
    };
    loadEditPerm();
  }, [tramite?.tipo_tramite, usuario?.id, isAdmin, isGerente]);

  useEffect(() => {
    if (!tramite?.grupo_asignado_id || !usuario || isAdmin) { setMyTeamRole(null); return; }
    supabase
      .from('tramites_grupos_miembros')
      .select('rol_en_equipo')
      .eq('grupo_id', tramite.grupo_asignado_id)
      .eq('usuario_id', usuario.id)
      .maybeSingle()
      .then(({ data }) => setMyTeamRole((data?.rol_en_equipo as typeof myTeamRole) ?? null));
  }, [tramite?.grupo_asignado_id, usuario?.id]);

  useEffect(() => {
    if (id) {
      loadTramite();

      const subscription = supabase
        .channel(`tramite_${id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tickets',
            filter: `id=eq.${id}`
          },
          async () => {
            await loadTramite();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [id]);

  const loadTramite = async () => {
    if (!id) return;

    // Primero obtener el ticket base
    const { data: ticketData, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError) {
      console.error('Error loading tramite:', ticketError);
      navigate('/tramites');
      return;
    }

    if (!ticketData) return;

    // Ahora hacer queries separadas para cada relación
    const [agenteRes, responsableRes, estatusRes, creadoPorRes, modificadoPorRes, cerradoPorRes] = await Promise.all([
      ticketData.agente_id ? supabase.from('usuarios').select('id, nombre_completo').eq('id', ticketData.agente_id).maybeSingle() : Promise.resolve({ data: null }),
      ticketData.assigned_to_user_id ? supabase.from('usuarios').select('id, nombre_completo').eq('id', ticketData.assigned_to_user_id).maybeSingle() : Promise.resolve({ data: null }),
      ticketData.estatus_id ? supabase.from('ticket_estatus').select('*').eq('id', ticketData.estatus_id).maybeSingle() : Promise.resolve({ data: null }),
      ticketData.creado_por ? supabase.from('usuarios').select('id, nombre_completo').eq('id', ticketData.creado_por).maybeSingle() : Promise.resolve({ data: null }),
      ticketData.modificado_por ? supabase.from('usuarios').select('id, nombre_completo').eq('id', ticketData.modificado_por).maybeSingle() : Promise.resolve({ data: null }),
      ticketData.cerrado_por ? supabase.from('usuarios').select('id, nombre_completo').eq('id', ticketData.cerrado_por).maybeSingle() : Promise.resolve({ data: null })
    ]);

    // Construir el objeto final
    const tramiteCompleto = {
      ...ticketData,
      agente: agenteRes.data,
      responsable: responsableRes.data,
      estatus: estatusRes.data,
      creado_por_usuario: creadoPorRes.data,
      modificado_por_usuario: modificadoPorRes.data,
      cerrado_por_usuario: cerradoPorRes.data
    };

    // Si es un registro de actividad o cotizacion_emision, obtener datos adicionales
    if (ticketData.tipo_tramite === 'cotizacion_emision') {
      const [subtypeRes, agenteUsuarioRes, insuranceRes, attendingRes] = await Promise.all([
        ticketData.activity_subtype_id ? supabase.from('tramite_activity_types').select('id, nombre').eq('id', ticketData.activity_subtype_id).maybeSingle() : Promise.resolve({ data: null }),
        ticketData.agente_usuario_id ? supabase.from('usuarios').select('id, nombre_completo').eq('id', ticketData.agente_usuario_id).maybeSingle() : Promise.resolve({ data: null }),
        ticketData.insurance_type_id ? supabase.from('insurance_types').select('id, nombre').eq('id', ticketData.insurance_type_id).maybeSingle() : Promise.resolve({ data: null }),
        ticketData.attending_user_id ? supabase.from('usuarios').select('id, nombre_completo').eq('id', ticketData.attending_user_id).maybeSingle() : Promise.resolve({ data: null })
      ]);

      tramiteCompleto.activity_subtype = subtypeRes.data;
      tramiteCompleto.agente_usuario = agenteUsuarioRes.data;
      tramiteCompleto.insurance_type = insuranceRes.data;
      tramiteCompleto.attending_user = attendingRes.data;

      // Cargar nombres de aseguradoras si existen
      if (ticketData.insurers && Array.isArray(ticketData.insurers) && ticketData.insurers.length > 0) {
        const { data: aseguradorasData } = await supabase
          .from('aseguradoras')
          .select('id, nombre')
          .in('id', ticketData.insurers);

        tramiteCompleto.insurers_nombres = aseguradorasData?.map(a => a.nombre) || [];
      } else {
        tramiteCompleto.insurers_nombres = [];
      }
    }

    setTramite(tramiteCompleto as TramiteData);
    setSelectedEstatus(ticketData.estatus_id);
    setSelectedPrioridad(ticketData.prioridad);
    setFechaPromesaEntrega(ticketData.fecha_promesa_entrega || '');
    setLoading(false);
    await loadEstatus(ticketData.tipo_tramite);
    await loadCamposDinamicos(ticketData.tipo_tramite, ticketData.id);

    // Cargar relaciones padre / hijo
    const [childrenRes, parentRes] = await Promise.all([
      supabase.from('tickets').select('id, folio, tipo_tramite, cerrado_en').eq('parent_ticket_id', ticketData.id),
      ticketData.parent_ticket_id
        ? supabase.from('tickets').select('id, folio, tipo_tramite, cerrado_en').eq('id', ticketData.parent_ticket_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const relValues = [
      ...(childrenRes.data || []).map((t: any) => t.tipo_tramite as string),
      (parentRes.data as any)?.tipo_tramite as string | undefined,
    ].filter(Boolean) as string[];
    let tipoLabelMap: Record<string, string> = {};
    if (relValues.length > 0) {
      const { data: tiposRel } = await supabase.from('ticket_tipos').select('value, label').in('value', relValues);
      tipoLabelMap = Object.fromEntries((tiposRel || []).map((t: any) => [t.value, t.label]));
    }
    setChildTickets((childrenRes.data || []).map((t: any) => ({ ...t, tipo_label: tipoLabelMap[t.tipo_tramite] })));
    setParentTicket((parentRes.data as any) ? { ...(parentRes.data as any), tipo_label: tipoLabelMap[(parentRes.data as any).tipo_tramite] } : null);

    const { data: primerComentario } = await supabase
      .from('ticket_comentarios')
      .select('mensaje, fecha_hora, usuario:usuario_id(nombre_completo)')
      .eq('ticket_id', ticketData.id)
      .order('fecha_hora', { ascending: true })
      .limit(1)
      .maybeSingle();
    setComentarioInicial((primerComentario as any) ?? null);
  };

  const loadCamposDinamicos = async (tipoTramite: string, tramiteId: string) => {
    // Buscar el ticket_tipo por value
    const { data: tipoData } = await supabase
      .from('ticket_tipos')
      .select('id')
      .eq('value', tipoTramite)
      .maybeSingle();

    if (!tipoData?.id) { setCamposDinamicos([]); return; }
    setTipoUUID(tipoData.id);

    const { data: campos } = await supabase
      .from('tramite_tipo_campos')
      .select('id, key, label, tipo, requerido, ayuda, config, is_sistema, sistema_key, seccion_id')
      .eq('tramite_tipo_id', tipoData.id)
      .eq('activo', true)
      .order('display_order');

    const { data: seccionesData } = await supabase
      .from('tramite_tipo_secciones')
      .select('id, tramite_tipo_id, nombre, descripcion, orden, opcional, depende_de_seccion_id, activo')
      .eq('tramite_tipo_id', tipoData.id)
      .eq('activo', true)
      .order('orden');
    setSecciones((seccionesData as TramiteSeccion[]) || []);

    if (!campos?.length) { setCamposDinamicos([]); return; }
    setCamposDinamicos(campos as CampoDinamico[]);

    // Cargar respuestas existentes
    const { data: respuestas } = await supabase
      .from('tramite_respuestas')
      .select('id, campo_id, valor_texto, valor_numerico, valor_fecha, valor_booleano, valor_json')
      .eq('tramite_id', tramiteId)
      .in('campo_id', campos.map(c => c.id));

    if (respuestas) {
      setRespuestasOriginales(respuestas as RespuestaDinamica[]);
      const vals: Record<string, any> = {};
      for (const r of respuestas) {
        const campo = campos.find(c => c.id === r.campo_id);
        if (!campo) continue;
        const TEXTO_TIPOS = ['texto_corto', 'texto_largo', 'area', 'equipo',
          'agente_vendedor', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion', 'creado_por',
          'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp'];
        if (TEXTO_TIPOS.includes(campo.tipo)) vals[campo.id] = r.valor_texto;
        else if (['numerico', 'porcentaje'].includes(campo.tipo)) vals[campo.id] = r.valor_numerico;
        else if (campo.tipo === 'fecha') vals[campo.id] = r.valor_fecha;
        else if (campo.tipo === 'booleano') vals[campo.id] = r.valor_booleano;
        else vals[campo.id] = r.valor_json;
      }
      setRespuestasDinamicas(vals);
    }
  };

  // Cargar catálogo para campo agente_vendedor
  useEffect(() => {
    if (!camposDinamicos.some(c => c.sistema_key === 'agente_vendedor')) return;
    supabase.from('maestro_agentes')
      .select('id, nombre, maestro_usuario_agente(user_id, activo, usuarios(nombre_completo))')
      .eq('activo', true).eq('es_primario', true).order('nombre')
      .then(({ data }) => {
        const mapped = (data || []).map((a: any) => {
          const mapeo = (a.maestro_usuario_agente || []).find((m: any) => m.activo);
          return {
            id: a.id, nombre: a.nombre,
            usuario_id: mapeo?.user_id ?? undefined,
            usuario_nombre: mapeo?.usuarios?.nombre_completo ?? undefined,
          };
        });
        setAgentesVendedor(mapped);
      });
  }, [camposDinamicos]);

  // Cargar catálogos para campos aseguradora / ramo / codigo_postal
  useEffect(() => {
    const tieneAseg = camposDinamicos.some(c => c.tipo === 'aseguradora');
    const tieneRamo = camposDinamicos.some(c => c.tipo === 'ramo');
    if (!tieneAseg && !tieneRamo) return;
    supabase.from('maestro_companias').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setCatalogoCompanias((data || []) as {id: string; nombre: string}[]));
    if (tieneRamo) {
      supabase.from('maestro_ramos').select('id, nombre').order('nombre')
        .then(({ data }) => setCatalogoRamos((data || []) as {id: string; nombre: string}[]));
      supabase.from('maestro_combinaciones').select('compania_id, ramo_id')
        .then(({ data }) => setCombinaciones((data || []) as {compania_id: string; ramo_id: string}[]));
    }
  }, [camposDinamicos]);

  useEffect(() => {
    if (
      !claimedRef.current &&
      tramite &&
      usuario &&
      tramite.tipo_tramite === 'cotizacion_emision' &&
      !tramite.assigned_to_user_id &&
      !tramite.cerrado_en &&
      ['Empleado', 'Gerente', 'Administrador'].includes(usuario.rol)
    ) {
      claimedRef.current = true;
      (async () => {
        const { error } = await supabase
          .from('tickets')
          .update({
            assigned_to_user_id: usuario.id,
            attending_user_id: usuario.id,
            modificado_por: usuario.id,
          })
          .eq('id', tramite.id)
          .is('assigned_to_user_id', null);

        if (!error) {
          await loadTramite();
        }
      })();
    }
  }, [tramite?.id, tramite?.assigned_to_user_id]);

  const loadEstatus = async (tipoTramite?: string) => {
    const [estatusResult, tipoResult] = await Promise.all([
      supabase.from('ticket_estatus').select('*').eq('activo', true).order('orden'),
      tipoTramite
        ? supabase.from('ticket_tipos').select('categoria').eq('value', tipoTramite).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (estatusResult.data) {
      // categoria viene de la BD; para tipos custom sin categoria explícita usa 'general' (default en BD)
      const categoria = (tipoResult.data as any)?.categoria ?? tipoTramite ?? null;

      let filtered = categoria
        ? estatusResult.data.filter((e: any) =>
            !e.tipo_aplicable || e.tipo_aplicable.includes(categoria)
          )
        : estatusResult.data;

      // cotizacion_emision no permite cerrar manualmente (se cierra al elegir Emitido/No Emitido)
      if (categoria === 'cotizacion_emision') {
        filtered = filtered.filter((e: any) => e.nombre !== 'Cerrado');
      }

      setEstatusList(filtered);
    }
  };

  const ESTATUS_FINALES_COTIZACION = ['Emitido (Ganado)', 'No Emitido (Perdido)'];

  const buildUpdatePayload = (estatusId: string, slugOverride?: string) => {
    const estatus = estatusList.find(e => e.id === estatusId);
    const esFinalCotizacion =
      tramite?.tipo_tramite === 'cotizacion_emision' &&
      estatus && ESTATUS_FINALES_COTIZACION.includes(estatus.nombre);

    // Compute custom estatus label/color if FormBuilder campo exists
    let customLabel: string | null = null;
    let customColor: string | null = null;
    if (estatusCampoDinamico) {
      const slug = slugOverride !== undefined ? slugOverride : respuestasDinamicas[estatusCampoDinamico.id];
      const opcion = (estatusCampoDinamico.config.opciones || []).find(o => o.slug === slug);
      if (opcion) {
        customLabel = opcion.label;
        customColor = opcion.clasificacion === 'inicio' ? '#3B82F6' : opcion.clasificacion === 'terminacion' ? '#059669' : opcion.clasificacion === 'en_espera' ? '#F59E0B' : '#6B7280';
      }
    }

    return {
      estatus_id: estatusId,
      prioridad: selectedPrioridad,
      modificado_por: usuario!.id,
      fecha_promesa_entrega: fechaPromesaEntrega || null,
      ...(customLabel !== null ? { custom_estatus_label: customLabel, custom_estatus_color: customColor } : {}),
      ...(esFinalCotizacion && !tramite?.cerrado_en
        ? { cerrado_en: new Date().toISOString(), cerrado_por: usuario!.id }
        : {}),
    };
  };

  const esCampoVisible = (campo: any): boolean => {
    if (!campo.config?.condicion_activa) return true;
    const { campo_fuente, condicion_operador, condicion_valor } = campo.config;
    if (!campo_fuente) return true;
    const fuente = camposDinamicos.find(c => c.key === campo_fuente);
    if (!fuente) return true;
    const valorFuente = respuestasDinamicas[fuente.id];
    const op = condicion_operador || 'igual_a';
    switch (op) {
      case 'igual_a':    return String(valorFuente ?? '') === String(condicion_valor ?? '');
      case 'distinto_a': return String(valorFuente ?? '') !== String(condicion_valor ?? '');
      case 'tiene_valor': return valorFuente !== undefined && valorFuente !== null && valorFuente !== '';
      default:           return String(valorFuente ?? '') === String(condicion_valor ?? '');
    }
  };

  const handleSave = async () => {
    if (!tramite || !usuario || !isDirty) return;

    // Validar campos requeridos visibles antes de mostrar modal
    const faltantes = camposDinamicos.filter(c =>
      !c.is_sistema && c.tipo !== 'estatus' && c.requerido && esCampoVisible(c) &&
      (() => { const v = respuestasDinamicas[c.id]; return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0); })()
    );
    if (faltantes.length > 0) {
      showToast(`Campos requeridos sin completar: ${faltantes.map(c => c.label).join(', ')}`, 'error');
      return;
    }

    // Si el usuario ya cambió el estatus a mano (dropdown del encabezado), no hay
    // nada que preguntar: saltar el modal y guardar directo con ese estatus.
    const estatusYaCambio = estatusCampoDinamico
      ? selectedEstatusSlug !== (respuestasOriginales.find(r => r.campo_id === estatusCampoDinamico.id)?.valor_json ?? '')
      : selectedEstatus !== (tramite.estatus?.id ?? tramite.estatus_id);

    if (estatusYaCambio) {
      estatusOverrideRef.current = null;
      await continuarGuardadoConEstatus(selectedEstatusSlug, selectedEstatus);
      return;
    }

    // Abrir modal de confirmación de estatus
    setModalKeepCurrent(true);
    setModalChosenSlug(selectedEstatusSlug);
    setModalChosenId(selectedEstatus);
    setEstatusModalOpen(true);
  };

  // Llamado por el modal de estatus cuando el usuario confirma
  const handleEstatusModalConfirm = async () => {
    if (!tramite) return;

    const chosenSlug = modalKeepCurrent ? selectedEstatusSlug : modalChosenSlug;
    const chosenId   = modalKeepCurrent ? selectedEstatus     : (estatusCampoDinamico ? selectedEstatus : modalChosenId);

    // Guardar override en ref para que proceedWithSave lo use sin depender del estado asíncrono
    if (!modalKeepCurrent) {
      estatusOverrideRef.current = { slug: chosenSlug, id: chosenId };
      // Actualizar estado para UI
      if (estatusCampoDinamico) {
        setRespuestasDinamicas(prev => ({ ...prev, [estatusCampoDinamico.id]: chosenSlug }));
      } else {
        setSelectedEstatus(chosenId);
      }
    } else {
      estatusOverrideRef.current = null;
    }

    setEstatusModalOpen(false);
    await continuarGuardadoConEstatus(chosenSlug, chosenId);
  };

  // Compartido entre handleSave (cuando el estatus ya se cambió a mano) y
  // handleEstatusModalConfirm (cuando el usuario confirma el modal)
  const continuarGuardadoConEstatus = async (chosenSlug: string, chosenId: string) => {
    if (!tramite) return;

    // Re-validar campos requeridos que dependen del estatus elegido (la validación
    // en handleSave corría antes del modal, cuando el estatus aún era el anterior)
    const faltantesConEstatus = camposDinamicos.filter(c => {
      if (c.is_sistema || c.tipo === 'estatus' || !c.requerido) return false;
      const visible = (() => {
        if (!c.config?.condicion_activa) return true;
        const { campo_fuente, condicion_operador, condicion_valor } = c.config;
        if (!campo_fuente) return true;
        const fuente = camposDinamicos.find(f => f.key === campo_fuente);
        if (!fuente) return true;
        const valorFuente = (estatusCampoDinamico && fuente.id === estatusCampoDinamico.id)
          ? chosenSlug
          : respuestasDinamicas[fuente.id];
        const op = condicion_operador || 'igual_a';
        switch (op) {
          case 'igual_a':     return String(valorFuente ?? '') === String(condicion_valor ?? '');
          case 'distinto_a':  return String(valorFuente ?? '') !== String(condicion_valor ?? '');
          case 'tiene_valor': return valorFuente !== undefined && valorFuente !== null && valorFuente !== '';
          default:            return String(valorFuente ?? '') === String(condicion_valor ?? '');
        }
      })();
      if (!visible) return false;
      const v = respuestasDinamicas[c.id];
      return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    });
    if (faltantesConEstatus.length > 0) {
      showToast(`Campos requeridos sin completar: ${faltantesConEstatus.map(c => c.label).join(', ')}`, 'error');
      return;
    }

    // Trigger check con el estatus elegido
    let silent: PendingTrigger[] = [];
    if (estatusCampoDinamico && tipoUUID && chosenSlug && !tramite.parent_ticket_id) {
      const originalSlug = respuestasOriginales.find(r => r.campo_id === estatusCampoDinamico.id)?.valor_json ?? '';
      if (chosenSlug !== originalSlug) {
        const { data: trigData } = await supabase
          .from('ticket_status_triggers')
          .select('*, target_tipo:ticket_tipos!target_tipo_id(label,color)')
          .eq('ticket_tipo_id', tipoUUID)
          .eq('from_status', chosenSlug)
          .eq('activo', true);

        const activeTriggers = (trigData || []) as PendingTrigger[];
        const confirmable    = activeTriggers.filter(t => t.requiere_confirmacion);
        silent               = activeTriggers.filter(t => !t.requiere_confirmacion);

        if (confirmable.length > 0) {
          const childChecks = await Promise.all(
            confirmable.map(t =>
              supabase.from('tickets').select('id, folio')
                .eq('parent_ticket_id', tramite.id)
                .eq('trigger_origen_id', t.id)
                .maybeSingle()
            )
          );
          const existingMap: Record<string, ExistingChild> = {};
          confirmable.forEach((t, i) => {
            if (childChecks[i].data) existingMap[t.id] = childChecks[i].data as ExistingChild;
          });
          setPendingTriggers(confirmable);
          setSilentTriggers(silent);
          setExistingChildren(existingMap);
          setTriggerModalOpen(true);
          return;
        }
        setSilentTriggers(silent);
      }
    }

    // Escalation trigger check
    if (estatusCampoDinamico && tipoUUID && chosenSlug && !tramite.parent_ticket_id) {
      const originalSlug = respuestasOriginales.find(r => r.campo_id === estatusCampoDinamico.id)?.valor_json ?? '';
      if (chosenSlug !== originalSlug) {
        const { data: escData } = await supabase
          .from('ticket_escalacion_triggers')
          .select('destinatario')
          .eq('ticket_tipo_id', tipoUUID)
          .eq('from_status', chosenSlug)
          .eq('activo', true)
          .limit(1)
          .maybeSingle();
        if (escData) {
          setEscalacionComentario('');
          setEscalacionModal({ destinatario: escData.destinatario, silentTriggers: silent });
          return;
        }
      }
    }

    await proceedWithSave({}, silent);
  };

  const proceedWithSave = async (
    _decisions: Record<string, 'conservar' | 'nuevo'>,
    _allTriggers: PendingTrigger[] = [],
  ) => {
    if (!tramite || !usuario) return;
    const snap = tramite; // capturar antes de setTramite

    // Leer override de estatus (establecido por handleEstatusModalConfirm)
    const override = estatusOverrideRef.current;
    const effectiveId   = override?.id   ?? selectedEstatus;
    const effectiveSlug = override?.slug ?? selectedEstatusSlug;
    estatusOverrideRef.current = null; // limpiar para siguiente save

    setSaving(true);

    const newEstatus = estatusList.find(e => e.id === effectiveId);
    setTramite(prev => prev ? {
      ...prev,
      prioridad: selectedPrioridad,
      estatus: newEstatus || prev.estatus
    } : null);

    const createdFolios: string[] = [];

    try {
      const { error } = await supabase
        .from('tickets')
        .update(buildUpdatePayload(effectiveId, estatusCampoDinamico ? effectiveSlug : undefined))
        .eq('id', snap.id);

      if (error) throw error;

      // ── Lógica de suspensión de plazo (en_espera) ──────────────────────────
      if (estatusCampoDinamico) {
        const slugAnterior = respuestasOriginales.find(r => r.campo_id === estatusCampoDinamico.id)?.valor_json ?? '';
        const slugNuevo    = effectiveSlug;
        const getClasif = (slug: string) =>
          (estatusCampoDinamico.config?.opciones ?? []).find((o: { slug: string; clasificacion?: string }) => o.slug === slug)?.clasificacion ?? null;
        const clasifAnterior = getClasif(String(slugAnterior));
        const clasifNuevo    = getClasif(String(slugNuevo));

        if (clasifAnterior !== 'en_espera' && clasifNuevo === 'en_espera') {
          // Abre una nueva pausa
          await supabase.from('tramite_pausas').insert({
            tramite_id: snap.id,
            estatus_slug: String(slugNuevo),
            inicio_pausa: new Date().toISOString(),
            creado_por: usuario.id,
          });
        } else if (clasifAnterior === 'en_espera' && clasifNuevo !== 'en_espera') {
          // Cierra la pausa abierta y calcula días hábiles pausados
          const { data: pausaAbierta } = await supabase
            .from('tramite_pausas')
            .select('id, inicio_pausa')
            .eq('tramite_id', snap.id)
            .is('fin_pausa', null)
            .order('inicio_pausa', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pausaAbierta) {
            const ahora = new Date();
            const diasPausados = Math.ceil(
              await calcularDiasHabilesEntre(new Date(pausaAbierta.inicio_pausa), ahora)
            );
            await supabase.from('tramite_pausas').update({
              fin_pausa: ahora.toISOString(),
              dias_habiles_pausados: diasPausados,
            }).eq('id', pausaAbierta.id);
          }
        }
      }
      // ──────────────────────────────────────────────────────────────────────

      // Guardar respuestas de campos dinámicos (upsert por tramite_id + campo_id)
      if (camposDinamicos.length > 0) {
        for (const campo of camposDinamicos) {
          const val = respuestasDinamicas[campo.id];
          const existing = respuestasOriginales.find(r => r.campo_id === campo.id);
          const isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);

          if (isEmpty) continue;

          const payload: any = {
            tramite_id: snap.id,
            campo_id: campo.id,
            valor_texto:    ['texto_corto', 'texto_largo', 'area', 'equipo', 'agente_vendedor', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion', 'creado_por', 'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp'].includes(campo.tipo) ? String(val) : null,
            valor_numerico: ['numerico', 'porcentaje'].includes(campo.tipo) ? Number(val) : null,
            valor_fecha:    campo.tipo === 'fecha' ? String(val) : null,
            valor_booleano: campo.tipo === 'booleano' ? Boolean(val) : null,
            valor_json:     ['estatus', 'dropdown', 'seleccion_multiple', 'codigo_postal', 'adjunto', 'reporte_protegido'].includes(campo.tipo) ? val : null,
          };

          if (existing?.id) {
            await supabase.from('tramite_respuestas').update(payload).eq('id', existing.id);
          } else {
            await supabase.from('tramite_respuestas').insert(payload);
          }
        }

        // Auto-cierre/re-apertura según clasificación del estatus dinámico
        const hayTerminacion = camposDinamicos.some(c => {
          if (c.tipo !== 'estatus') return false;
          // Usar effectiveSlug si este campo es el estatusCampoDinamico
          const slug = (estatusCampoDinamico && c.id === estatusCampoDinamico.id)
            ? effectiveSlug
            : respuestasDinamicas[c.id];
          const opcion = (c.config.opciones || []).find(o => o.slug === slug);
          return opcion?.clasificacion === 'terminacion';
        });
        if (hayTerminacion && !snap.cerrado_en) {
          await supabase.from('tickets').update({
            cerrado_en: new Date().toISOString(),
            cerrado_por: usuario.id,
          }).eq('id', snap.id);
        } else if (!hayTerminacion && snap.cerrado_en) {
          await supabase.from('tickets').update({
            cerrado_en: null,
            cerrado_por: null,
          }).eq('id', snap.id);
        }

        // "Alta Usuario Beta": el momento de aprobación es cuando llega a la
        // clasificación 'terminacion' (opción "Alta Finalizada") — registrar al
        // solicitante en usuarios_beta. Idempotente: si ya estaba, no hace nada.
        if (hayTerminacion && snap.tipo_tramite === 'alta_usuario_beta') {
          await supabase.from('usuarios_beta')
            .upsert({ usuario_id: snap.creado_por, tramite_id: snap.id }, { onConflict: 'usuario_id', ignoreDuplicates: true });
        }
      }

      // ── Fase 3: Motor de ejecución de triggers ──────────────────────
      if (_allTriggers.length > 0) {
        const TEXTO_TIPOS_TR = ['texto_corto', 'texto_largo', 'area', 'equipo',
          'agente_vendedor', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion', 'creado_por',
          'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp'];

        const { data: estatusIniciado } = await supabase
          .from('ticket_estatus').select('id').eq('nombre', 'Iniciado').maybeSingle();

        for (const trigger of _allTriggers) {
          // Si el usuario eligió conservar el hijo existente: solo log y continuar
          if (_decisions[trigger.id] === 'conservar') {
            await supabase.from('ticket_trigger_executions').insert({
              trigger_id: trigger.id, parent_ticket_id: snap.id,
              child_ticket_id: null, ejecutado_por: usuario.id,
              estatus: 'skipped', error_msg: 'Usuario conservó trámite hijo existente',
            });
            continue;
          }

          try {
            // 1. Tipo destino
            const { data: targetTipo } = await supabase
              .from('ticket_tipos').select('value').eq('id', trigger.target_tipo_id).single();
            if (!targetTipo) throw new Error('Tipo destino no encontrado');

            // 2. Prioridad
            const prioHijo = trigger.prioridad_hijo === 'heredar'
              ? snap.prioridad
              : (trigger.prioridad_hijo as 'Alta' | 'Media' | 'Baja');

            // 2b. Folio: nuevo (default, lo asigna el trigger de BD) o heredado del padre + inciso.
            // El inciso se calcula sobre TODOS los hermanos ya creados para este padre (no solo
            // los de este trigger), tomando la siguiente letra libre en orden alfabético.
            let folioHijo: string | undefined;
            if (trigger.folio_mode === 'heredar_incisos') {
              const { data: hermanos } = await supabase
                .from('tickets').select('folio').eq('parent_ticket_id', snap.id);
              const prefijo = `${snap.folio}-`;
              const letrasUsadas = (hermanos || [])
                .map(h => h.folio?.startsWith(prefijo) ? h.folio.slice(prefijo.length) : null)
                .filter((l): l is string => !!l && /^[A-Z]$/.test(l));
              let letra = 'A';
              while (letrasUsadas.includes(letra)) letra = String.fromCharCode(letra.charCodeAt(0) + 1);
              folioHijo = `${snap.folio}-${letra}`;
            }

            // 3. Crear trámite hijo
            const { data: childTicket, error: childErr } = await supabase
              .from('tickets')
              .insert({
                ...(folioHijo ? { folio: folioHijo } : {}),
                tipo_tramite: targetTipo.value,
                estatus_id: estatusIniciado?.id ?? null,
                prioridad: prioHijo,
                instrucciones: `Generado por trigger "${trigger.nombre}"`,
                creado_por: usuario.id,
                modificado_por: usuario.id,
                parent_ticket_id: snap.id,
                trigger_origen_id: trigger.id,
                agente_id: snap.agente?.id ?? null,
              })
              .select('id, folio').single();
            if (childErr || !childTicket) throw childErr || new Error('Sin respuesta al crear hijo');
            createdFolios.push(childTicket.folio);

            // 4. Campos del tipo destino (con config para estatus inicial)
            const { data: targetCampos } = await supabase
              .from('tramite_tipo_campos')
              .select('id, tipo, sistema_key, config')
              .eq('tramite_tipo_id', trigger.target_tipo_id)
              .eq('activo', true);

            // 5. Fase 5: estatus inicial + custom label/color en el hijo
            const estatusCampoTarget = (targetCampos || []).find(c => c.tipo === 'estatus');
            if (estatusCampoTarget && trigger.initial_status) {
              await supabase.from('tramite_respuestas').insert({
                tramite_id: childTicket.id,
                campo_id: estatusCampoTarget.id,
                valor_json: trigger.initial_status,
              });
              const matchOpt = ((estatusCampoTarget as any).config?.opciones || [])
                .find((o: any) => o.slug === trigger.initial_status);
              if (matchOpt) {
                const col = matchOpt.clasificacion === 'inicio' ? '#3B82F6'
                  : matchOpt.clasificacion === 'terminacion' ? '#059669' : '#6B7280';
                await supabase.from('tickets').update({
                  custom_estatus_label: matchOpt.label,
                  custom_estatus_color: col,
                }).eq('id', childTicket.id);
              }
            }

            // 6. Mapeos de campos
            const { data: mappings } = await supabase
              .from('ticket_trigger_field_mappings')
              .select('source_campo_id, source_sistema_key, target_campo_id, target_sistema_key, valor_fijo')
              .eq('trigger_id', trigger.id)
              .order('orden');

            for (const m of mappings || []) {
              let srcVal: any = null;
              if (m.valor_fijo != null) {
                srcVal = m.valor_fijo;
              } else if (m.source_sistema_key) {
                if (m.source_sistema_key === 'poliza_numero') srcVal = snap.poliza;
                else if (m.source_sistema_key === 'prioridad')  srcVal = snap.prioridad;
              } else if (m.source_campo_id) {
                const resp = respuestasOriginales.find(r => r.campo_id === m.source_campo_id);
                srcVal = resp?.valor_json ?? resp?.valor_texto ?? resp?.valor_numerico ?? resp?.valor_fecha ?? resp?.valor_booleano ?? null;
              }
              if (srcVal === null || srcVal === undefined) continue;

              if (m.target_campo_id) {
                const tc = (targetCampos || []).find(c => c.id === m.target_campo_id);
                if (!tc) continue;
                await supabase.from('tramite_respuestas').insert({
                  tramite_id: childTicket.id,
                  campo_id: m.target_campo_id,
                  valor_texto:    TEXTO_TIPOS_TR.includes(tc.tipo) ? String(srcVal) : null,
                  valor_numerico: ['numerico', 'porcentaje'].includes(tc.tipo) ? Number(srcVal) : null,
                  valor_fecha:    tc.tipo === 'fecha' ? String(srcVal) : null,
                  valor_booleano: tc.tipo === 'booleano' ? Boolean(srcVal) : null,
                  valor_json:     ['estatus', 'dropdown', 'seleccion_multiple', 'codigo_postal', 'adjunto'].includes(tc.tipo) ? srcVal : null,
                });
              } else if (m.target_sistema_key) {
                const upd: any = {};
                if (m.target_sistema_key === 'poliza_numero') upd.poliza = String(srcVal);
                else if (m.target_sistema_key === 'prioridad') upd.prioridad = String(srcVal);
                if (Object.keys(upd).length) await supabase.from('tickets').update(upd).eq('id', childTicket.id);
              }
            }

            // 7. Log de ejecución exitosa
            await supabase.from('ticket_trigger_executions').insert({
              trigger_id: trigger.id, parent_ticket_id: snap.id,
              child_ticket_id: childTicket.id, ejecutado_por: usuario.id, estatus: 'ok',
            });
          } catch (trigErr: any) {
            console.error('Trigger execution error:', trigErr);
            await supabase.from('ticket_trigger_executions').insert({
              trigger_id: trigger.id, parent_ticket_id: snap.id,
              child_ticket_id: null, ejecutado_por: usuario.id,
              estatus: 'error', error_msg: trigErr.message || 'Error desconocido',
            });
          }
        }
      }
      // ────────────────────────────────────────────────────────────────

      await loadTramite();
      showToast(
        createdFolios.length > 0
          ? `Guardado. ${createdFolios.length === 1 ? 'Trámite creado' : 'Trámites creados'}: ${createdFolios.join(', ')}`
          : 'Cambios guardados con éxito'
      );
    } catch (err: any) {
      console.error('Error updating tramite:', err);
      showToast('Error al guardar los cambios', 'error');
      await loadTramite();
    } finally {
      setSaving(false);
    }
  };

  const confirmarEscalacion = async () => {
    if (!escalacionModal || !tramite) return;
    if (!escalacionComentario.trim()) { showToast('El comentario es obligatorio', 'error'); return; }

    // Insert mandatory comment
    await supabase.from('ticket_comentarios').insert({
      ticket_id: tramite.id,
      usuario_id: usuario!.id,
      contenido: escalacionComentario.trim(),
    });

    // Mark as requires attention
    await supabase.from('tickets').update({ requiere_atencion_manual: true }).eq('id', tramite.id);

    // Notify supervisor/director
    supabase.functions.invoke('escalar-tramite', {
      body: { ticket_id: tramite.id, destinatario: escalacionModal.destinatario, comentario: escalacionComentario.trim() },
    });

    const silents = escalacionModal.silentTriggers;
    setEscalacionModal(null);
    setEscalacionComentario('');
    await proceedWithSave({}, silents);
  };

  const closingStatusOptions = estatusList.filter(e => {
    const nombre = (e.nombre ?? '').toLowerCase();
    return (
      nombre.includes('cerrad') ||
      nombre.includes('emitid') ||
      nombre.includes('perdid') ||
      nombre.includes('ganad') ||
      nombre.includes('no emitido') ||
      nombre.includes('concluid') ||
      nombre.includes('finaliz') ||
      nombre.includes('resuelto') ||
      nombre.includes('rechazad') ||
      nombre.includes('cancelad')
    );
  });

  const cerrarOptions = closingStatusOptions.length > 0 ? closingStatusOptions : estatusList;

  const handleCerrarCon = async (estatusId: string) => {
    if (!tramite || !usuario) return;
    const estatus = estatusList.find(e => e.id === estatusId);
    if (!estatus) return;
    if (!confirm(`¿Cerrar este trámite con el estatus "${estatus.nombre}"?`)) return;

    setShowCerrarMenu(false);
    setSaving(true);
    try {
      const ahora = new Date().toISOString();
      const { error } = await supabase
        .from('tickets')
        .update({
          estatus_id:   estatusId,
          cerrado_en:   ahora,
          completed_at: ahora,
          cerrado_por:  usuario.id,
          modificado_por: usuario.id,
        })
        .eq('id', tramite.id);

      if (error) {
        console.error('Error al cerrar tramite:', error);
        throw error;
      }

      // Notificar al creador si es diferente a quien cierra
      if (tramite.creado_por && tramite.creado_por !== usuario.id) {
        await crearNotificacion({
          user_id:     tramite.creado_por,
          titulo:      'Trámite cerrado',
          mensaje:     `El trámite ${tramite.folio} fue cerrado con estatus "${estatus.nombre}".`,
          modulo:      'Tramites',
          icono:       'check-circle',
          accion_url:  `/tramites/${tramite.id}`,
          accion_texto: 'Ver trámite',
        });
      }
      // Notificar al responsable si es distinto del creador y de quien cierra
      if (
        tramite.assigned_to_user_id &&
        tramite.assigned_to_user_id !== usuario.id &&
        tramite.assigned_to_user_id !== tramite.creado_por
      ) {
        await crearNotificacion({
          user_id:     tramite.assigned_to_user_id,
          titulo:      'Trámite cerrado',
          mensaje:     `El trámite ${tramite.folio} fue cerrado con estatus "${estatus.nombre}".`,
          modulo:      'Tramites',
          icono:       'check-circle',
          accion_url:  `/tramites/${tramite.id}`,
          accion_texto: 'Ver trámite',
        });
      }

      await loadTramite();
      alert('Trámite cerrado exitosamente');
      navigate('/tramites');
    } catch (err: any) {
      console.error('Error closing tramite:', err);
      alert(`Error al cerrar el trámite: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResponsableChange = async (userId: string) => {
    if (!tramite || !usuario) return;
    await supabase.from('tickets').update({
      assigned_to_user_id: userId || null,
      modificado_por: usuario.id,
    }).eq('id', tramite.id);
    if (userId) {
      await supabase.from('ticket_asignaciones').insert({
        ticket_id: tramite.id, ejecutivo_id: userId, asignado_por: usuario.id,
      });
      await crearNotificacion({
        user_id: userId,
        titulo: 'Trámite asignado',
        mensaje: `Se te asignó como responsable del trámite ${tramite.folio}.`,
        modulo: 'Tramites',
        icono: 'clipboard-list',
        accion_url: `/tramites/${tramite.id}`,
        accion_texto: 'Ver trámite',
      });
    }
    await loadTramite();
    showToast('Cambios guardados automáticamente');
  };

  const handleEquipoChange = async (grupoId: string | null) => {
    if (!tramite || !usuario) return;
    await supabase.from('tickets').update({
      grupo_asignado_id: grupoId,
      assigned_to_user_id: null,
      modificado_por: usuario.id,
    }).eq('id', tramite.id);
    if (grupoId) {
      const { data: miembros } = await supabase.rpc('get_grupo_miembros_ejecutivos', { p_grupo_id: grupoId });
      const lider = (miembros as Array<{ id: string; nombre_completo: string }>)?.[0];
      if (lider) {
        await crearNotificacion({
          user_id: lider.id,
          titulo: 'Trámite asignado a tu equipo',
          mensaje: `El trámite ${tramite.folio} fue asignado a tu equipo.`,
          modulo: 'Tramites',
          icono: 'clipboard-list',
          accion_url: `/tramites/${tramite.id}`,
          accion_texto: 'Ver trámite',
        });
      }
    }
    await loadTramite();
    showToast('Cambios guardados automáticamente');
  };

  const handleReabrir = async () => {
    if (!tramite || !usuario) return;
    if (!confirm('¿Estás seguro de reabrir este tramite?')) return;

    setSaving(true);
    try {
      // Prefer "En Proceso" by name; fall back to the first status in the
      // already type-filtered list so cotizacion_emision and other types work.
      const nonClosingStatuses = estatusList.filter(e => {
        const n = e.nombre.toLowerCase();
        return !n.includes('cerrad') && !n.includes('emitid') && !n.includes('perdid')
          && !n.includes('ganad') && !n.includes('no emitido') && !n.includes('concluid')
          && !n.includes('finaliz') && !n.includes('resuelto') && !n.includes('rechazad')
          && !n.includes('cancelad');
      });
      const reopenEstatus =
        nonClosingStatuses.find(e => e.nombre.toLowerCase() === 'en proceso') ||
        nonClosingStatuses[0];

      if (!reopenEstatus) {
        alert('No hay un estatus activo disponible para reabrir este tramite. Verifica la configuración.');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('tickets')
        .update({
          estatus_id: reopenEstatus.id,
          cerrado_en: null,
          cerrado_por: null,
          modificado_por: usuario.id
        })
        .eq('id', tramite.id);

      if (error) {
        console.error('Error al reabrir tramite:', error);
        throw error;
      }

      await loadTramite();
      alert('Tramite reabierto exitosamente');
    } catch (err: any) {
      console.error('Error reopening tramite:', err);
      alert(`Error al reabrir el tramite: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!tramite) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600">Tramite no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-800 rounded-3xl shadow-soft border border-neutral-200 dark:border-neutral-700 p-6">
        <PageHeader
          title={`Tramite ${tramite.folio}`}
          icon={ClipboardList}
          backTo="/tramites"
          backLabel="Volver a Tramites"
          badge={
            <div className="flex items-center gap-3">
              {(() => {
                const label = tramite.custom_estatus_label ?? tramite.estatus?.nombre;
                const color = tramite.custom_estatus_color ?? tramite.estatus?.color;
                const staticBadge = label ? (
                  <span
                    className="px-3 py-1 rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: (color ?? '#888') + '20',
                      color: color ?? '#888',
                      borderColor: color ?? '#888',
                      borderWidth: '1px'
                    }}
                  >
                    {label}
                  </span>
                ) : null;

                if (!estatusCampoDinamico || !canEdit || isCerrado) return staticBadge;

                const opciones = estatusCampoDinamico.config.opciones || [];
                const actual = opciones.find(o => o.slug === selectedEstatusSlug);
                const getColorEstatusDinamico = (clasificacion?: string | null) =>
                  clasificacion === 'inicio' ? '#3B82F6'
                  : clasificacion === 'terminacion' ? '#059669'
                  : clasificacion === 'en_espera' ? '#F59E0B'
                  : '#6B7280';
                const selColor = getColorEstatusDinamico(actual?.clasificacion);
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wide">Estatus</span>
                    <select
                      value={selectedEstatusSlug}
                      onChange={(e) => setRespuestasDinamicas(prev => ({ ...prev, [estatusCampoDinamico.id]: e.target.value }))}
                      className="pl-3 pr-7 py-1.5 rounded-full text-sm font-semibold border-2 cursor-pointer focus:outline-none"
                      style={{ borderColor: selColor, color: selColor, backgroundColor: selColor + '10' }}
                    >
                      {opciones.map(opt => (
                        <option key={opt.slug} value={opt.slug}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })()}
              {isCerrado && (
                <span className="text-sm text-neutral-500 dark:text-white/50">
                  Cerrado el {new Date(tramite.cerrado_en!).toLocaleDateString('es-MX')}
                </span>
              )}
              {!canEdit && !isCerrado && !isAdmin && !isGerente && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-500 border border-neutral-200 dark:bg-neutral-700 dark:text-white/50 dark:border-neutral-600">
                  Solo lectura
                </span>
              )}
            </div>
          }
          actions={
            <div className="flex items-center space-x-2">
              {canEdit && !isCerrado && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex items-center space-x-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl transition-all font-semibold cursor-pointer disabled:opacity-50 ${!isDirty && !saving ? 'opacity-50' : ''}`}
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Guardando...' : 'Guardar'}</span>
                  </button>
                  {!estatusCampoDinamico && <div className="relative" ref={cerrarMenuRef}>
                    <button
                      onClick={() => setShowCerrarMenu(v => !v)}
                      disabled={saving}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-semibold disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cerrar Trámite</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {showCerrarMenu && cerrarOptions.length > 0 && (
                      <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg z-20 overflow-hidden">
                        <div className="px-4 py-2 text-xs font-semibold text-neutral-500 dark:text-white/50 bg-neutral-50 dark:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-600">
                          Cerrar con estatus:
                        </div>
                        {cerrarOptions.map(estatus => (
                          <button
                            key={estatus.id}
                            onClick={() => handleCerrarCon(estatus.id)}
                            className="w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all flex items-center space-x-2"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: estatus.color }}
                            />
                            <span className="text-sm font-medium text-neutral-900 dark:text-white">{estatus.nombre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>}
                </>
              )}
              {canEdit && isCerrado && (
                <button
                  onClick={handleReabrir}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-all font-semibold disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reabrir Tramite</span>
                </button>
              )}
            </div>
          }
        />


        {!canEdit && !isCerrado && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              {isCommercialViewerOnly
                ? 'Visualización de solo lectura. Puedes agregar comentarios pero no editar este trámite.'
                : 'No tienes permiso para editar este tipo de trámite. Puedes consultar, comentar y adjuntar archivos.'}
            </p>
          </div>
        )}

        <div className="flex space-x-2 border-b border-neutral-200 mt-6">
          {(['detalles', 'comentarios', 'archivos', 'historial'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold transition-all capitalize ${
                activeTab === tab
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab}
            </button>
          ))}
          {tramite.tipo_tramite === 'solicitud_comisiones_pendientes' && (
            <button
              onClick={() => setActiveTab('comisiones')}
              className={`px-6 py-3 font-semibold transition-all capitalize ${
                activeTab === 'comisiones'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              comisiones
            </button>
          )}
          {esReporteBug && (
            <button
              onClick={() => setActiveTab('diagnostico')}
              className={`px-6 py-3 font-semibold transition-all capitalize ${
                activeTab === 'diagnostico'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              diagnóstico
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
        {activeTab === 'detalles' && (
          <>
            {comentarioInicial && (
              <div className="mb-6 p-4 rounded-2xl border border-blue-200 bg-blue-50">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comentario inicial{comentarioInicial.usuario?.nombre_completo ? ` — ${comentarioInicial.usuario.nombre_completo}` : ''}
                </p>
                <p className="text-sm text-blue-900 whitespace-pre-wrap">{comentarioInicial.mensaje}</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('comentarios')}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Ver todos los comentarios →
                </button>
              </div>
            )}
            <TramiteDetalles
              tramite={tramite}
              estatusList={estatusList}
              selectedEstatus={selectedEstatus}
              setSelectedEstatus={setSelectedEstatus}
              selectedPrioridad={selectedPrioridad}
              setSelectedPrioridad={setSelectedPrioridad}
              canEdit={canEdit && !isCerrado}
              canManageAssignment={canManageAssignment && !isCerrado}
              canSelfAssignOnly={canSelfAssignOnly}
              grupoAsignadoId={tramite.grupo_asignado_id}
              onResponsableChange={handleResponsableChange}
              onEquipoChange={handleEquipoChange}
              estatusCampoDinamico={estatusCampoDinamico}
              selectedEstatusSlug={selectedEstatusSlug}
            />

            {/* Fecha Promesa de Entrega — solo líderes, gerentes y admins */}
            {canEditFechaPromesa && (
              <div className="mt-6 pt-6 border-t border-neutral-100">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Fecha Promesa de Entrega
                  <span className="text-xs font-normal text-neutral-500 ml-2">Opcional</span>
                </label>
                <input
                  type="date"
                  value={fechaPromesaEntrega}
                  onChange={(e) => setFechaPromesaEntrega(e.target.value)}
                  disabled={isCerrado}
                  className="w-full sm:w-64 px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500"
                />
              </div>
            )}

            {/* Sección 1 — Campos sistema */}
            {camposDinamicos.some(c => c.is_sistema && c.sistema_key !== 'estatus') && (
              <div className="mt-6 pt-6 border-t border-violet-100">
                <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  {isAdmin && !isCerrado ? '✏️' : '🔒'} Información del Trámite
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {camposDinamicos
                    .filter(c => c.is_sistema && c.sistema_key !== 'estatus')
                    .map(campo => {
                      const val = respuestasDinamicas[campo.id];
                      const set = (v: any) => setRespuestasDinamicas(prev => ({ ...prev, [campo.id]: v }));
                      const adminEditable = isAdmin && !isCerrado && campo.sistema_key !== 'fecha_finalizacion' && campo.sistema_key !== 'creado_por';
                      const violet = 'px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700';
                      const muted  = 'px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-400 italic';
                      const inputCls = 'w-full px-3 py-2 border border-violet-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white';
                      return (
                        <div key={campo.id}>
                          <label className="block text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">
                            {campo.label}
                          </label>
                          {adminEditable ? (
                            campo.sistema_key === 'agente_vendedor' ? (
                              <select value={val ?? ''} onChange={e => set(e.target.value || null)} className={inputCls}>
                                <option value="">Sin registrar</option>
                                {agentesVendedor.map(a => (
                                  <option key={a.id} value={a.id}>{a.usuario_nombre ?? a.nombre}</option>
                                ))}
                              </select>
                            ) : (campo.sistema_key === 'fecha_creacion') ? (
                              <input type="date" value={val?.slice(0, 10) ?? ''} onChange={e => set(e.target.value || null)} className={inputCls} />
                            ) : (
                              <input type="text" value={val ?? ''} onChange={e => set(e.target.value || null)} placeholder="Sin registrar" className={inputCls} />
                            )
                          ) : (
                            (() => {
                              const displayVal = campo.sistema_key === 'agente_vendedor' && val
                                ? (() => { const ag = agentesVendedor.find(a => a.id === val); return ag?.usuario_nombre ?? ag?.nombre ?? val; })()
                                : val;
                              return displayVal
                                ? <div className={violet}>{displayVal}</div>
                                : <div className={muted}>{campo.sistema_key === 'fecha_finalizacion' ? 'Al cerrar' : 'Sin registrar'}</div>;
                            })()
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Fase 4: Trámites relacionados (padre / hijos) */}
            {(parentTicket || childTickets.length > 0) && (
              <div className="mt-6 pt-6 border-t border-neutral-100 space-y-2">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  Trámites relacionados
                </p>
                {parentTicket && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs text-amber-700">Trámite hijo de</span>
                    <Link to={`/tramites/${parentTicket.id}`} className="text-xs font-semibold text-amber-800 hover:underline">
                      {parentTicket.folio}
                    </Link>
                    {parentTicket.tipo_label && (
                      <span className="text-xs text-amber-600">— {parentTicket.tipo_label}</span>
                    )}
                    {parentTicket.cerrado_en && (
                      <span className="ml-auto text-xs text-neutral-400 shrink-0">Cerrado</span>
                    )}
                  </div>
                )}
                {childTickets.map(child => (
                  <div key={child.id} className="flex items-center gap-2 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <GitBranch className="w-3 h-3 text-neutral-400 shrink-0" />
                    <Link to={`/tramites/${child.id}`} className="text-xs font-semibold text-neutral-700 hover:text-blue-600 hover:underline">
                      {child.folio}
                    </Link>
                    {child.tipo_label && (
                      <span className="text-xs text-neutral-500">— {child.tipo_label}</span>
                    )}
                    {child.cerrado_en && (
                      <span className="ml-auto text-xs text-neutral-400 shrink-0">Cerrado</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Sección 2 — Campos dinámicos (excluye estatus y sistema), agrupados por sección si el tipo las tiene */}
            {camposDinamicos.filter(c => !c.is_sistema && c.tipo !== 'estatus').length > 0 && (() => {
              const camposCustom = camposDinamicos.filter(c => !c.is_sistema && c.tipo !== 'estatus' && esCampoVisible(c));

              const renderCampo = (campo: CampoDinamico) => {
                const val = respuestasDinamicas[campo.id];
                const set = (v: any) => setRespuestasDinamicas(prev => ({ ...prev, [campo.id]: v }));
                const editable = canEdit && !isCerrado;
                return (
                    <div key={campo.id} className={['texto_largo', 'reporte_protegido'].includes(campo.tipo) ? 'md:col-span-2' : ''}>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        {campo.label}{campo.requerido && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {campo.ayuda && <p className="text-xs text-neutral-500 mb-1">{campo.ayuda}</p>}

                      {campo.tipo === 'texto_corto' && (
                        <input type="text" value={val || ''} onChange={e => set(e.target.value)} disabled={!editable}
                          maxLength={campo.config.max_length}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500" />
                      )}
                      {campo.tipo === 'email' && (
                        <input type="email" value={val || ''} onChange={e => set(e.target.value)} disabled={!editable}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500" />
                      )}
                      {campo.tipo === 'telefono' && (
                        <input type="tel" value={val || ''} onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 10))} disabled={!editable}
                          placeholder="10 dígitos" maxLength={10}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500" />
                      )}
                      {campo.tipo === 'rfc' && (
                        <input type="text" value={val || ''} onChange={e => set(e.target.value.toUpperCase().slice(0, 13))} disabled={!editable}
                          placeholder="RFC" maxLength={13}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500" />
                      )}
                      {campo.tipo === 'curp' && (
                        <input type="text" value={val || ''} onChange={e => set(e.target.value.toUpperCase().slice(0, 18))} disabled={!editable}
                          placeholder="CURP" maxLength={18}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500" />
                      )}
                      {campo.tipo === 'porcentaje' && (
                        <div className="relative">
                          <input type="number" value={val ?? ''} onChange={e => set(e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value))))} disabled={!editable}
                            min={0} max={100} step="0.01"
                            className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 pointer-events-none">%</span>
                        </div>
                      )}
                      {campo.tipo === 'texto_largo' && (
                        <textarea value={val || ''} onChange={e => set(e.target.value)} disabled={!editable}
                          maxLength={campo.config.max_length} rows={3}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500 resize-none" />
                      )}
                      {campo.tipo === 'numerico' && (
                        <input type="number" value={val ?? ''} onChange={e => set(e.target.value === '' ? null : Number(e.target.value))} disabled={!editable}
                          step={campo.config.es_entero ? '1' : 'any'}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500" />
                      )}
                      {campo.tipo === 'fecha' && (
                        <input type="date" value={val || ''} onChange={e => set(e.target.value)} disabled={!editable}
                          min={campo.config.min_fecha} max={campo.config.max_fecha}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-50 disabled:text-neutral-500" />
                      )}
                      {campo.tipo === 'booleano' && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={!!val} onChange={e => set(e.target.checked)} disabled={!editable} className="w-4 h-4 text-blue-600 rounded" />
                          <span className="text-sm text-neutral-700">Sí</span>
                        </label>
                      )}
                      {(campo.tipo === 'estatus' || campo.tipo === 'dropdown') && (
                        <SearchableSelect
                          value={val || ''}
                          onChange={editable ? set : () => {}}
                          options={(campo.config.opciones || []).map((opt: CampoDinamicoOpt) => ({ label: opt.label, value: opt.slug }))}
                          placeholder="Seleccionar..."
                          disabled={!editable}
                        />
                      )}
                      {campo.tipo === 'seleccion_multiple' && (
                        <div className="flex flex-wrap gap-2">
                          {(campo.config.opciones || []).map((opt: CampoDinamicoOpt) => {
                            const selected: string[] = Array.isArray(val) ? val : [];
                            const isChecked = selected.includes(opt.slug);
                            return (
                              <button key={opt.slug} type="button" disabled={!editable}
                                onClick={() => set(isChecked ? selected.filter(s => s !== opt.slug) : [...selected, opt.slug])}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isChecked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-neutral-600 border-neutral-300 hover:border-blue-400'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {campo.tipo === 'aseguradora' && (
                        editable ? (
                          <select value={val || ''} onChange={e => {
                            set(e.target.value);
                            const ramoCampo = camposDinamicos.find(c => c.tipo === 'ramo' && c.config?.filtrar_por_aseguradora);
                            if (ramoCampo) setRespuestasDinamicas(prev => ({ ...prev, [ramoCampo.id]: '' }));
                          }} className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                            <option value="">Selecciona aseguradora...</option>
                            {catalogoCompanias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                          </select>
                        ) : (
                          <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-700">{val || '—'}</div>
                        )
                      )}
                      {campo.tipo === 'ramo' && (() => {
                        let ramosDisp = catalogoRamos;
                        if (campo.config?.filtrar_por_aseguradora) {
                          const asegCampo = camposDinamicos.find(c => c.tipo === 'aseguradora');
                          const asegNombre = asegCampo ? respuestasDinamicas[asegCampo.id] : null;
                          if (asegNombre) {
                            const compania = catalogoCompanias.find(c => c.nombre === asegNombre);
                            const validIds = compania
                              ? new Set(combinaciones.filter(cb => cb.compania_id === compania.id).map(cb => cb.ramo_id))
                              : new Set<string>();
                            ramosDisp = catalogoRamos.filter(r => validIds.has(r.id));
                          } else {
                            ramosDisp = [];
                          }
                        }
                        return editable ? (
                          <select value={val || ''} onChange={e => set(e.target.value)}
                            disabled={campo.config?.filtrar_por_aseguradora && ramosDisp.length === 0}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed">
                            <option value="">{campo.config?.filtrar_por_aseguradora && !ramosDisp.length ? 'Selecciona primero una aseguradora...' : 'Selecciona ramo...'}</option>
                            {ramosDisp.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                          </select>
                        ) : (
                          <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-700">{val || '—'}</div>
                        );
                      })()}
                      {campo.tipo === 'codigo_postal' && (() => {
                        const cpState = cpSearchState[campo.id] || { colonias: [], loading: false };
                        const stored = val as { codigo?: string; colonia?: string; municipio?: string; estado?: string } | undefined;
                        if (!editable) return (
                          <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-700">
                            {stored?.codigo ? `${stored.codigo} — ${stored.colonia || ''}, ${stored.municipio || ''}, ${stored.estado || ''}` : '—'}
                          </div>
                        );
                        return (
                          <div className="space-y-2">
                            <input type="text" value={stored?.codigo || ''}
                              onChange={async e => {
                                const cp = e.target.value.replace(/\D/g, '').slice(0, 5);
                                set({ codigo: cp, colonia: '', municipio: '', estado: '' });
                                if (cp.length === 5) {
                                  setCpSearchState(prev => ({ ...prev, [campo.id]: { colonias: [], loading: true } }));
                                  const { data } = await supabase.from('codigos_postales').select('colonia, municipio, estado').eq('codigo', cp).order('colonia');
                                  setCpSearchState(prev => ({ ...prev, [campo.id]: { colonias: data || [], loading: false } }));
                                } else {
                                  setCpSearchState(prev => ({ ...prev, [campo.id]: { colonias: [], loading: false } }));
                                }
                              }}
                              placeholder="Ej: 76000" maxLength={5}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            {cpState.loading && <p className="text-xs text-neutral-400">Buscando colonias...</p>}
                            {cpState.colonias.length > 0 && (
                              <select value={stored?.colonia || ''} onChange={e => {
                                const col = cpState.colonias.find(c => c.colonia === e.target.value);
                                if (col) set({ codigo: stored?.codigo, ...col });
                              }} className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                <option value="">Selecciona colonia...</option>
                                {cpState.colonias.map(c => <option key={c.colonia} value={c.colonia}>{c.colonia}</option>)}
                              </select>
                            )}
                            {stored?.municipio && <p className="text-xs text-neutral-500">{stored.municipio}, {stored.estado}</p>}
                          </div>
                        );
                      })()}
                      {campo.tipo === 'adjunto' && (() => {
                        type ArchivoRef = { id: string; nombre: string; url: string; tipo: string; tamano: number };
                        const archivos: ArchivoRef[] = Array.isArray(val) ? val : [];
                        const maxFiles = campo.config.max_archivos || 1;
                        const maxMb = campo.config.max_mb || 10;
                        const accept = (campo.config.tipos_mime || []).join(',') || undefined;
                        return (
                          <div className="space-y-2">
                            {archivos.map((archivo, i) => (
                              <div key={archivo.id || i} className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-200">
                                <span className="text-sm flex-1 truncate">{archivo.nombre}</span>
                                <span className="text-xs text-neutral-400 shrink-0">{(archivo.tamano / 1024).toFixed(0)} KB</span>
                                <a href={archivo.url} target="_blank" rel="noopener noreferrer"
                                  className="p-1 text-blue-500 hover:text-blue-700 transition-colors shrink-0" title="Descargar">
                                  <Upload className="w-3.5 h-3.5 rotate-180" />
                                </a>
                                {editable && (
                                  <button type="button"
                                    onClick={() => set(archivos.filter((_, j) => j !== i))}
                                    className="p-1 text-red-400 hover:text-red-600 transition-colors shrink-0">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {editable && archivos.length < maxFiles && (
                              <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-[3px] border-dashed border-neutral-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors group">
                                <Paperclip className="w-7 h-7 text-neutral-300 group-hover:text-blue-400 transition-colors" />
                                <span className="text-sm font-medium text-neutral-500 group-hover:text-blue-500 transition-colors">Adjuntar archivo</span>
                                {accept && <span className="text-xs text-neutral-400">{(campo.config.tipos_mime || []).join(', ').replace(/[^/]+\//g, '').toUpperCase()} · máx. {maxMb} MB</span>}
                                <input
                                  type="file"
                                  accept={accept}
                                  className="hidden"
                                  onChange={async e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (file.size > maxMb * 1024 * 1024) {
                                      alert(`Archivo demasiado grande. Máximo ${maxMb} MB.`);
                                      return;
                                    }
                                    const ext = file.name.split('.').pop();
                                    const fileName = `${tramite.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                                    const { error: upErr } = await supabase.storage.from('ticket-archivos').upload(fileName, file);
                                    if (upErr) { alert('Error al subir: ' + upErr.message); return; }
                                    const { data: { publicUrl } } = supabase.storage.from('ticket-archivos').getPublicUrl(fileName);
                                    const { data: archivoData } = await supabase.from('ticket_archivos').insert({
                                      ticket_id: tramite.id, usuario_id: usuario?.id,
                                      nombre: file.name, url: publicUrl, tipo: file.type, tamano: file.size,
                                      categoria_id: campo.config.categoria_id || null,
                                    }).select('id').single();
                                    set([...archivos, { id: archivoData?.id || '', nombre: file.name, url: publicUrl, tipo: file.type, tamano: file.size }]);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        );
                      })()}
                      {campo.tipo === 'reporte_protegido' && (() => {
                        const enviado = val?.enviado === true;
                        return (
                          <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50 dark:bg-neutral-800/40 dark:border-neutral-700">
                            {enviado ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                                  <Lock className="w-4 h-4" />
                                  <span className="text-sm font-medium">Reporte enviado y cifrado</span>
                                </div>
                                {val?.enviado_en && (
                                  <p className="text-xs text-neutral-500 pl-6">
                                    {new Date(val.enviado_en).toLocaleString('es-MX')} · {val?.palabras ?? '?'} palabras
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {campo.config.instrucciones && (
                                  <p className="text-xs text-neutral-500">{campo.config.instrucciones}</p>
                                )}
                                <button
                                  onClick={() => navigate(`/tareas/reporte/${tramite?.id}/${campo.id}`)}
                                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors"
                                >
                                  <ClipboardList className="w-4 h-4" />
                                  Escribir reporte
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                );
              };

              const grupos = agruparCamposPorSeccion(camposCustom, secciones);

              return (
                <div className="mt-6 pt-6 border-t border-neutral-100 space-y-4">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Campos del trámite</p>
                  {grupos.map(grupo => {
                    if (!grupo.seccion) {
                      return <div key="sin-seccion" className="grid grid-cols-1 md:grid-cols-2 gap-4">{grupo.campos.map(renderCampo)}</div>;
                    }
                    const seccion = grupo.seccion;
                    const desbloqueada = seccionDesbloqueada(seccion, secciones, camposDinamicos, respuestasDinamicas);
                    const expandida = seccionesExpandidas.has(seccion.id);
                    const mostrarCampos = desbloqueada && (!seccion.opcional || expandida);
                    return (
                      <div key={seccion.id} className={`border rounded-2xl overflow-hidden ${desbloqueada ? 'border-neutral-200' : 'border-neutral-100 bg-neutral-50/60'}`}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!desbloqueada || !seccion.opcional) return;
                            setSeccionesExpandidas(prev => {
                              const next = new Set(prev);
                              if (next.has(seccion.id)) { next.delete(seccion.id); } else { next.add(seccion.id); }
                              return next;
                            });
                          }}
                          disabled={!desbloqueada || !seccion.opcional}
                          className={`w-full flex items-center gap-2 px-4 py-3 text-left ${seccion.opcional && desbloqueada ? 'cursor-pointer hover:bg-neutral-50' : 'cursor-default'}`}
                        >
                          {!desbloqueada ? <Lock className="w-4 h-4 text-neutral-300 shrink-0" /> : <Layers className="w-4 h-4 text-accent shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${desbloqueada ? 'text-neutral-800' : 'text-neutral-400'}`}>
                              {seccion.opcional && !expandida && desbloqueada ? '+ ' : ''}{seccion.nombre}{seccion.opcional ? ' (opcional)' : ''}
                            </p>
                            {desbloqueada ? (
                              seccion.descripcion && (!seccion.opcional || expandida) && (
                                <p className="text-xs text-neutral-400 mt-0.5">{seccion.descripcion}</p>
                              )
                            ) : (
                              <p className="text-xs text-neutral-400 mt-0.5">Completa la sección anterior para continuar</p>
                            )}
                          </div>
                          {seccion.opcional && desbloqueada && (
                            <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${expandida ? 'rotate-180' : ''}`} />
                          )}
                        </button>
                        {mostrarCampos && (
                          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-neutral-100 pt-4">
                            {grupo.campos.map(renderCampo)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
        {activeTab === 'comentarios' && <TramiteComentarios tramiteId={tramite.id} />}
        {activeTab === 'archivos' && <TramiteArchivos tramiteId={tramite.id} />}
        {activeTab === 'historial' && <TramiteHistorial tramiteId={tramite.id} />}
        {activeTab === 'comisiones' && <ComisionesPendientes tramiteId={tramite.id} />}
        {activeTab === 'diagnostico' && (
          <DiagnosticoBugReport ticketId={tramite.id} folio={tramite.folio} descripcionUsuario={tramite.instrucciones || ''} />
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ── Modal: ¿Cambiar estatus antes de guardar? ─────────────────────────── */}
      {estatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Cabecera */}
            <div className="px-5 pt-5 pb-4 border-b border-neutral-100 dark:border-neutral-700">
              <p className="text-base font-semibold text-neutral-900 dark:text-white">Antes de guardar…</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">¿Deseas cambiar el estatus del trámite?</p>
            </div>

            {/* Cuerpo */}
            <div className="px-5 py-4 space-y-3">
              {/* Opción A: mantener */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                modalKeepCurrent
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
              }`}>
                <input
                  type="radio"
                  className="mt-0.5 accent-blue-500"
                  checked={modalKeepCurrent}
                  onChange={() => setModalKeepCurrent(true)}
                />
                <div>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Mantener estatus actual</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {estatusCampoDinamico
                      ? (estatusCampoDinamico.config.opciones ?? []).find(o => o.slug === selectedEstatusSlug)?.label || selectedEstatusSlug || '—'
                      : (estatusList.find(e => e.id === selectedEstatus)?.nombre ?? '—')}
                  </p>
                </div>
              </label>

              {/* Opción B: cambiar */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                !modalKeepCurrent
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
              }`}>
                <input
                  type="radio"
                  className="mt-0.5 accent-blue-500"
                  checked={!modalKeepCurrent}
                  onChange={() => {
                    setModalKeepCurrent(false);
                    // Inicializar con primera opción diferente al actual
                    if (estatusCampoDinamico) {
                      const opts = estatusCampoDinamico.config.opciones ?? [];
                      const first = opts.find(o => o.slug !== selectedEstatusSlug) ?? opts[0];
                      if (first) setModalChosenSlug(first.slug);
                    } else {
                      const first = estatusList.find(e => e.id !== selectedEstatus) ?? estatusList[0];
                      if (first) setModalChosenId(first.id);
                    }
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Cambiar estatus a…</p>

                  {/* Selector de estatus */}
                  {!modalKeepCurrent && (
                    <div className="mt-2 space-y-1.5">
                      {estatusCampoDinamico
                        ? (estatusCampoDinamico.config.opciones ?? []).map(opt => {
                            const dotColor =
                              opt.clasificacion === 'inicio' ? 'bg-blue-500' :
                              opt.clasificacion === 'terminacion' ? 'bg-green-500' :
                              opt.clasificacion === 'en_espera' ? 'bg-amber-500' : 'bg-neutral-400';
                            return (
                              <label key={opt.slug} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                                modalChosenSlug === opt.slug
                                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                                  : 'border-neutral-200 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                              }`}>
                                <input
                                  type="radio"
                                  className="sr-only"
                                  checked={modalChosenSlug === opt.slug}
                                  onChange={() => setModalChosenSlug(opt.slug)}
                                />
                                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}/>
                                {opt.label}
                              </label>
                            );
                          })
                        : estatusList.map(est => (
                            <label key={est.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                              modalChosenId === est.id
                                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                                : 'border-neutral-200 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                            }`}>
                              <input
                                type="radio"
                                className="sr-only"
                                checked={modalChosenId === est.id}
                                onChange={() => setModalChosenId(est.id)}
                              />
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: est.color || '#6B7280' }}/>
                              {est.nombre}
                            </label>
                          ))
                      }
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* Botones */}
            <div className="px-5 pb-5 flex gap-2 justify-end">
              <button
                onClick={() => setEstatusModalOpen(false)}
                className="px-4 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEstatusModalConfirm}
                className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {triggerModalOpen && pendingTriggers.length > 0 && (
        <TriggerConfirmModal
          triggers={pendingTriggers}
          existingChildren={existingChildren}
          fromStatusLabel={
            (estatusCampoDinamico?.config.opciones ?? []).find(o => o.slug === selectedEstatusSlug)?.label
              ?? selectedEstatusSlug
          }
          onConfirm={(decisions) => {
            setTriggerModalOpen(false);
            proceedWithSave(decisions, [...pendingTriggers, ...silentTriggers]);
          }}
          onCancel={() => setTriggerModalOpen(false)}
        />
      )}

      {/* Modal de escalación — comentario obligatorio */}
      {escalacionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔔</span>
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">Escalación requerida</h2>
                <p className="text-xs text-neutral-500 dark:text-white/50 mt-0.5">
                  Este estatus notificará a{' '}
                  {escalacionModal.destinatario === 'ambos' ? 'Supervisor y Director' : escalacionModal.destinatario === 'supervisor' ? 'el Supervisor' : 'el Director'}{' '}
                  del equipo. Describe brevemente por qué necesitas apoyo.
                </p>
              </div>
            </div>
            <textarea
              autoFocus
              rows={4}
              value={escalacionComentario}
              onChange={e => setEscalacionComentario(e.target.value)}
              placeholder="Ej: El cliente solicita condiciones especiales que requieren autorización..."
              className="w-full px-3 py-2.5 text-sm border border-neutral-300 dark:border-white/20 rounded-xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-white placeholder-neutral-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setEscalacionModal(null); setEscalacionComentario(''); }}
                className="px-4 py-2 text-sm text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEscalacion}
                disabled={!escalacionComentario.trim() || saving}
                className="px-4 py-2 text-sm font-semibold bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Confirmar escalación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de guardado sticky — visible cuando hay cambios pendientes */}
      {isDirty && canEdit && !isCerrado && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-t border-neutral-200 dark:border-neutral-700 shadow-lg px-6 py-3 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            Tienes cambios sin guardar
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}
export default TramiteDetalle;
