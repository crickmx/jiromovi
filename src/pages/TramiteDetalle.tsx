import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Circle as XCircle, RefreshCw, Save, ChevronDown, CircleAlert as AlertCircle, ClipboardList, Upload, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { TramiteDetalles } from '../components/tramites/TramiteDetalles';
import { TramiteComentarios } from '../components/tramites/TramiteComentarios';
import { TramiteArchivos } from '../components/tramites/TramiteArchivos';
import { TramiteHistorial } from '../components/tramites/TramiteHistorial';
import { ComisionesPendientes } from '../components/tramites/ComisionesPendientes';
import { crearNotificacion } from '../lib/notificationHelpers';

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
}

export function TramiteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [tramite, setTramite] = useState<TramiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'detalles' | 'comentarios' | 'archivos' | 'historial' | 'comisiones'>('detalles');

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
  }
  interface RespuestaDinamica { id?: string; campo_id: string; valor_texto: string | null; valor_numerico: number | null; valor_fecha: string | null; valor_booleano: boolean | null; valor_json: any }
  const [camposDinamicos, setCamposDinamicos] = useState<CampoDinamico[]>([]);
  const [respuestasDinamicas, setRespuestasDinamicas] = useState<Record<string, any>>({});
  const [respuestasOriginales, setRespuestasOriginales] = useState<RespuestaDinamica[]>([]);
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

  const isDirty = !!tramite && (
    selectedEstatus !== (tramite.estatus?.id ?? tramite.estatus_id) ||
    selectedPrioridad !== tramite.prioridad ||
    fechaPromesaEntrega !== (tramite.fecha_promesa_entrega || '') ||
    (!!estatusCampoDinamico && selectedEstatusSlug !== (respuestasOriginales.find(r => r.campo_id === estatusCampoDinamico.id)?.valor_json ?? ''))
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
  };

  const loadCamposDinamicos = async (tipoTramite: string, tramiteId: string) => {
    // Buscar el ticket_tipo por value
    const { data: tipoData } = await supabase
      .from('ticket_tipos')
      .select('id')
      .eq('value', tipoTramite)
      .maybeSingle();

    if (!tipoData?.id) { setCamposDinamicos([]); return; }

    const { data: campos } = await supabase
      .from('tramite_tipo_campos')
      .select('id, key, label, tipo, requerido, ayuda, config, is_sistema, sistema_key')
      .eq('tramite_tipo_id', tipoData.id)
      .eq('activo', true)
      .order('display_order');

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
          'agente_vendedor', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion',
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
      .eq('activo', true).order('nombre')
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

  const buildUpdatePayload = (estatusId: string) => {
    const estatus = estatusList.find(e => e.id === estatusId);
    const esFinalCotizacion =
      tramite?.tipo_tramite === 'cotizacion_emision' &&
      estatus && ESTATUS_FINALES_COTIZACION.includes(estatus.nombre);

    // Compute custom estatus label/color if FormBuilder campo exists
    let customLabel: string | null = null;
    let customColor: string | null = null;
    if (estatusCampoDinamico) {
      const slug = respuestasDinamicas[estatusCampoDinamico.id];
      const opcion = (estatusCampoDinamico.config.opciones || []).find(o => o.slug === slug);
      if (opcion) {
        customLabel = opcion.label;
        customColor = opcion.clasificacion === 'inicio' ? '#3B82F6' : opcion.clasificacion === 'terminacion' ? '#059669' : '#6B7280';
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

  const handleSave = async () => {
    if (!tramite || !usuario || !isDirty) return;

    setSaving(true);

    const newEstatus = estatusList.find(e => e.id === selectedEstatus);
    setTramite(prev => prev ? {
      ...prev,
      prioridad: selectedPrioridad,
      estatus: newEstatus || prev.estatus
    } : null);

    try {
      const { error } = await supabase
        .from('tickets')
        .update(buildUpdatePayload(selectedEstatus))
        .eq('id', tramite.id);

      if (error) throw error;

      // Guardar respuestas de campos dinámicos (upsert por tramite_id + campo_id)
      if (camposDinamicos.length > 0) {
        for (const campo of camposDinamicos) {
          const val = respuestasDinamicas[campo.id];
          const existing = respuestasOriginales.find(r => r.campo_id === campo.id);
          const isEmpty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);

          if (isEmpty) continue;

          const payload: any = {
            tramite_id: tramite.id,
            campo_id: campo.id,
            valor_texto:    ['texto_corto', 'texto_largo', 'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp'].includes(campo.tipo) ? String(val) : null,
            valor_numerico: ['numerico', 'porcentaje'].includes(campo.tipo) ? Number(val) : null,
            valor_fecha:    campo.tipo === 'fecha' ? String(val) : null,
            valor_booleano: campo.tipo === 'booleano' ? Boolean(val) : null,
            valor_json:     ['estatus', 'dropdown', 'seleccion_multiple', 'codigo_postal', 'adjunto'].includes(campo.tipo) ? val : null,
          };

          if (existing?.id) {
            await supabase.from('tramite_respuestas').update(payload).eq('id', existing.id);
          } else {
            await supabase.from('tramite_respuestas').insert(payload);
          }
        }

        // Auto-cierre: si un campo estatus dinámico tiene clasificacion 'terminacion'
        const hayTerminacion = camposDinamicos.some(c => {
          if (c.tipo !== 'estatus') return false;
          const slug = respuestasDinamicas[c.id];
          const opcion = (c.config.opciones || []).find(o => o.slug === slug);
          return opcion?.clasificacion === 'terminacion';
        });
        if (hayTerminacion && !tramite.cerrado_en) {
          await supabase.from('tickets').update({
            cerrado_en: new Date().toISOString(),
            cerrado_por: usuario.id,
          }).eq('id', tramite.id);
        }
      }

      await loadTramite();
      showToast('Cambios guardados con éxito');
    } catch (err: any) {
      console.error('Error updating tramite:', err);
      showToast('Error al guardar los cambios', 'error');
      await loadTramite();
    } finally {
      setSaving(false);
    }
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
                return label ? (
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
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
        {activeTab === 'detalles' && (
          <>
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
              onEstatusSlugChange={(slug) => estatusCampoDinamico && setRespuestasDinamicas(prev => ({ ...prev, [estatusCampoDinamico.id]: slug }))}
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

            {/* Sección 1 — Campos sistema (siempre readonly) */}
            {camposDinamicos.some(c => c.is_sistema && c.sistema_key !== 'estatus') && (
              <div className="mt-6 pt-6 border-t border-violet-100 space-y-3">
                <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide flex items-center gap-1.5">
                  🔒 Información del Trámite
                </p>
                {camposDinamicos
                  .filter(c => c.is_sistema && c.sistema_key !== 'estatus')
                  .sort((a, b) => a.display_order - b.display_order)
                  .map(campo => {
                    const val = respuestasDinamicas[campo.id];
                    const violet = 'px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700';
                    const muted = 'px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-400 italic';
                    const displayVal = campo.sistema_key === 'agente_vendedor' && val
                      ? (() => {
                          const ag = agentesVendedor.find(a => a.id === val);
                          return ag?.usuario_nombre ?? ag?.nombre ?? val;
                        })()
                      : val;
                    return (
                      <div key={campo.id}>
                        <label className="block text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">
                          {campo.label}
                        </label>
                        {displayVal
                          ? <div className={violet}>{displayVal}</div>
                          : <div className={muted}>
                              {campo.sistema_key === 'fecha_finalizacion' ? 'Al cerrar' : 'Sin registrar'}
                            </div>
                        }
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Sección 2 — Campos dinámicos (excluye estatus y sistema) */}
            {camposDinamicos.filter(c => !c.is_sistema && c.tipo !== 'estatus').length > 0 && (
              <div className="mt-6 pt-6 border-t border-neutral-100 space-y-4">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Campos del trámite</p>
                {camposDinamicos.filter(c => !c.is_sistema && c.tipo !== 'estatus').map(campo => {
                  const val = respuestasDinamicas[campo.id];
                  const set = (v: any) => setRespuestasDinamicas(prev => ({ ...prev, [campo.id]: v }));
                  const editable = canEdit && !isCerrado;
                  return (
                    <div key={campo.id}>
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
                        <select value={val || ''} onChange={e => set(e.target.value)} disabled={!editable}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-neutral-50 disabled:text-neutral-500">
                          <option value="">Seleccionar...</option>
                          {(campo.config.opciones || []).map((opt: CampoDinamicoOpt) => (
                            <option key={opt.slug} value={opt.slug}>{opt.label}</option>
                          ))}
                        </select>
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
                              <label className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                                <Upload className="w-4 h-4 text-neutral-400" />
                                <span className="text-sm text-neutral-500">Adjuntar archivo</span>
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
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {activeTab === 'comentarios' && <TramiteComentarios tramiteId={tramite.id} />}
        {activeTab === 'archivos' && <TramiteArchivos tramiteId={tramite.id} />}
        {activeTab === 'historial' && <TramiteHistorial tramiteId={tramite.id} />}
        {activeTab === 'comisiones' && <ComisionesPendientes tramiteId={tramite.id} />}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
export default TramiteDetalle;
