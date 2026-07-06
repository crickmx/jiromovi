import { useState, useEffect, useRef } from 'react';
import { X, Upload, User, CircleAlert as AlertCircle, FileText, Package, DollarSign, Building2, Plus, Trash2, Calendar, Shield, Clock, CircleCheck as CheckCircle2, ChevronRight, ChevronDown, Lock, RotateCcw, Star, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { crearNotificacion } from '../../lib/notificationHelpers';
import { saveDraft, loadDraft, clearDraft } from '../../lib/formDraft';
import { useAuth } from '../../contexts/AuthContext';
import { BaseModal } from '../BaseModal';
import type { TramiteSeccion } from './catalogos/types';
import { seccionDesbloqueada, agruparCamposPorSeccion } from '../../lib/tramiteSecciones';
import {
  canAccessRegistroActividades,
  getUsersByOffice,
  getResponsableByOffice,
  createRegistroActividad,
  formatDateTimeForInput,
  formatDateTimeFromInput
} from '../../lib/registroActividadesUtils';
import {
  REGISTRO_ACTIVIDAD_ESTATUS,
  isEstatusFinal,
  getTipoTramitesByArea,
  getTipoTramiteArea,
  AREA_CONFIG,
  isCommercialTicketType,
  type UsuarioOficina
} from '../../lib/registroActividadesTypes';
import { SearchableSelect } from './catalogos/SearchableSelect';
import { useTiposTramite } from '../../hooks/useTiposTramite';
import { calcularDeadline } from '../../lib/diasHabiles';

interface TramiteEstatus {
  id: string;
  nombre: string;
}

interface Usuario {
  id: string;
  nombre_completo: string;
  rol: string;
  oficina_id: string | null;
}

interface CommissionBatch {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  status: string;
  documents_count: number;
}

interface CommissionDocument {
  id: string;
  poliza: string;
  nombre_asegurado: string | null;
  aseguradora: string | null;
  importe_base: number;
  prima_neta: number;
  date_fpago: string | null;
  concepto: string | null;
}

interface Aseguradora {
  nombre: string;
}

interface PolizaFile {
  id: string;
  file: File | null;
  aseguradora: string;
  claveAgente: string;
}

interface ComisionPendiente {
  id: string;
  numeroPoliza: string;
  aseguradora: string;
  fechaPago: string;
  archivo: File | null;
}

interface NuevoTramiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSuccessWithId?: (ticketId: string) => void;
  estatusList: TramiteEstatus[];
  preloadedData?: {
    tipoTramite?: string;
    comisionesLoteId?: string;
    comisionesLoteLabel?: string;
    instrucciones?: string;
    descripcion?: string;
    prioridad?: string;
  };
}

export function NuevoTramiteModal({
  isOpen,
  onClose,
  onSuccess,
  onSuccessWithId,
  estatusList,
  preloadedData
}: NuevoTramiteModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [tipoTramite, setTipoTramite] = useState<string>('correccion_poliza_registrada');
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<Usuario[]>([]);
  const [asignado, setAsignado] = useState<string>('');
  const [propuestoNombreMOVI, setPropuestoNombreMOVI] = useState('');
  const [prioridad, setPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Baja');
  const [descripcion, setDescripcion] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [adjuntosTemporales, setAdjuntosTemporales] = useState<Record<string, File[]>>({});
  const [adjuntoCategoriasIds, setAdjuntoCategoriasIds] = useState<Record<string, string>>({});
  const [adjuntoCategorias, setAdjuntoCategorias] = useState<{id: string; nombre: string}[]>([]);
  const [archivoCategoriaId, setArchivoCategoriaId] = useState('');

  const [polizaNumero, setPolizaNumero] = useState('');

  const [loteSeleccionado, setLoteSeleccionado] = useState('');
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState('');
  const [lotesDisponibles, setLotesDisponibles] = useState<CommissionBatch[]>([]);
  const [documentosLote, setDocumentosLote] = useState<CommissionDocument[]>([]);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);

  const [aseguradoras, setAseguradoras] = useState<Aseguradora[]>([]);
  const [catalogoRamos,     setCatalogoRamos]     = useState<{id: string; nombre: string}[]>([]);
  const [catalogoCompanias, setCatalogoCompanias] = useState<{id: string; nombre: string}[]>([]);
  const [combinaciones,     setCombinaciones]     = useState<{compania_id: string; ramo_id: string}[]>([]);
  const [cpSearchState, setCpSearchState] = useState<Record<string, {
    colonias: {colonia: string; municipio: string; estado: string}[];
    loading: boolean;
  }>>({});
  const [polizaFiles, setPolizaFiles] = useState<PolizaFile[]>([
    { id: '1', file: null, aseguradora: '', claveAgente: '' }
  ]);

  const [comisionesPendientes, setComisionesPendientes] = useState<ComisionPendiente[]>([
    { id: '1', numeroPoliza: '', aseguradora: '', fechaPago: '', archivo: null }
  ]);

  // --- Estado para Cotización / Emisión ---
  const [ceAgenteUserId, setCeAgenteUserId] = useState('');
  const [ceRamoId, setCeRamoId] = useState('');            // UUID de maestro_ramos
  const [ceSelectedInsurers, setCeSelectedInsurers] = useState<string[]>([]); // nombres de maestro_companias
  const [ceRequestDatetime, setCeRequestDatetime] = useState(formatDateTimeForInput(new Date()));
  const [ceCompletionDatetime, setCeCompletionDatetime] = useState('');
  const [ceEstatusNombre, setCeEstatusNombre] = useState('Iniciado');
  const [ceShowInsurerDropdown, setCeShowInsurerDropdown] = useState(false);
  const [ceInsurerSearchTerm, setCeInsurerSearchTerm] = useState('');

  // --- Estado para trámites comerciales (Renovaciones/Cobranza/Otros) ---
  const [comAgenteUserId, setComAgenteUserId] = useState('');
  const [comCliente, setComCliente] = useState('');
  const [comPoliza, setComPoliza] = useState('');
  const [comAseguradora, setComAseguradora] = useState('');
  const [comFechaVencimiento, setComFechaVencimiento] = useState('');
  const [comMonto, setComMonto] = useState('');
  const [comAsunto, setComAsunto] = useState('');

  const [ceAgenteUsers, setCeAgenteUsers] = useState<UsuarioOficina[]>([]);

  const DRAFT_KEY = 'tramite_nuevo_draft';
  const [draftRestored, setDraftRestored] = useState(false);

  // Ref para rastrear si estamos inicializando con datos precargados
  const isInitializingWithPreloadedData = useRef(false);
  const insurerDropdownRef = useRef<HTMLDivElement>(null);

  const [tiposDb, setTiposDb] = useState<Array<{ id: string; value: string; label: string; area: string; is_custom: boolean }>>([]);

  // Campos dinámicos del catálogo para el tipo de trámite seleccionado
  interface CampoDinamicoOption { label: string; slug: string; clasificacion?: string | null }
  interface CampoDinamico {
    id: string; key: string; label: string; tipo: string;
    requerido: boolean; ayuda: string | null; display_order: number;
    is_sistema: boolean; sistema_key: string | null;
    config: { opciones?: CampoDinamicoOption[]; max_length?: number; [k: string]: any };
    visible_para_rol?: string;
    editable_para_rol?: string;
    seccion_id: string | null;
  }

  const ROL_NIVEL: Record<string, number> = { Agente: 0, Empleado: 1, Gerente: 2, Administrador: 3 };
  const canSeeCampo = (campo: CampoDinamico) => {
    const min = ROL_NIVEL[campo.visible_para_rol ?? 'todos'];
    if (min === undefined) return true;
    return (ROL_NIVEL[usuario?.rol ?? 'Agente'] ?? 0) >= min;
  };
  const canEditCampo = (campo: CampoDinamico) => {
    const min = ROL_NIVEL[campo.editable_para_rol ?? 'todos'];
    if (min === undefined) return true;
    return (ROL_NIVEL[usuario?.rol ?? 'Agente'] ?? 0) >= min;
  };
  const [camposDinamicos, setCamposDinamicos] = useState<CampoDinamico[]>([]);
  const [respuestasDinamicas, setRespuestasDinamicas] = useState<Record<string, any>>({});
  // Secciones del FormBuilder — agrupan visualmente camposDinamicos, opcionalmente
  // condicionadas a que otra sección se complete antes. Ver src/lib/tramiteSecciones.ts.
  const [secciones, setSecciones] = useState<TramiteSeccion[]>([]);
  const [seccionesExpandidas, setSeccionesExpandidas] = useState<Set<string>>(new Set());
  const [mostroBadgeExtra, setMostroBadgeExtra] = useState(false);
  const [showBadgeExtra, setShowBadgeExtra] = useState(false);
  const [agentesVendedor, setAgentesVendedor] = useState<{
    id: string; nombre: string; despacho_id: string;
    usuario_id?: string; usuario_nombre?: string;
  }[]>([]);
  const [despachos, setDespachos] = useState<{id: string; nombre: string}[]>([]);
  // IDs de ticket_tipos que el usuario NO puede crear (calculado al cargar)
  const [tiposBlockedIds, setTiposBlockedIds] = useState<Set<string>>(new Set());
  // IDs de ticket_tipos donde el usuario puede crear pero NO editar
  const [tiposReadOnlyAfterCreate, setTiposReadOnlyAfterCreate] = useState<Set<string>>(new Set());
  const [fechaPromesaEntrega, setFechaPromesaEntrega] = useState('');

  const { tiposMap } = useTiposTramite();
  const isAgent = usuario?.rol === 'Agente';
  const isEmpleadoOAgente = isAgent || usuario?.rol === 'Empleado';
  const canAssignOthers = !isAgent;
  const isPoolMode = false;
  const [canAccessRegistroAct, setCanAccessRegistroAct] = useState(false);
  const [autoResponsableId, setAutoResponsableId] = useState<string | null>(null);

  useEffect(() => {
    if (!ceShowInsurerDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (insurerDropdownRef.current && !insurerDropdownRef.current.contains(e.target as Node)) {
        setCeShowInsurerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ceShowInsurerDropdown]);

  useEffect(() => {
    if (isOpen && usuario) {
      // Marcar si estamos inicializando con datos precargados
      isInitializingWithPreloadedData.current = !!preloadedData?.comisionesLoteId;

      if (preloadedData) {
        // Preloaded data (e.g. from commission batch) takes priority
        resetForm();
        setDraftRestored(false);
      } else {
        const draft = loadDraft<Record<string, unknown>>(DRAFT_KEY);
        if (draft) {
          restoreFromDraft(draft);
          setDraftRestored(true);
        } else {
          resetForm();
          setDraftRestored(false);
        }
      }

      loadUsuarios();
      loadLotesDisponibles();
      checkRegistroAccess();
      loadTiposDb();
      supabase.from('maestro_adjunto_categorias').select('id, nombre').eq('activo', true).order('orden')
        .then(({ data }) => setAdjuntoCategorias((data || []) as {id: string; nombre: string}[]));

      // Auto-find responsable from agent's office
      if (isAgent && usuario.oficina_id) {
        getResponsableByOffice(usuario.oficina_id).then((resp) => {
          setAutoResponsableId(resp?.id ?? null);
        });
      } else {
        setAutoResponsableId(null);
      }

      // Resetear la bandera después de un breve delay para permitir que los efectos se ejecuten
      setTimeout(() => {
        isInitializingWithPreloadedData.current = false;
      }, 100);
    }
  }, [isOpen, preloadedData]);

  const checkRegistroAccess = async () => {
    const access = await canAccessRegistroActividades();
    setCanAccessRegistroAct(access);
  };

  const loadTiposDb = async () => {
    const { data } = await supabase
      .from('ticket_tipos')
      .select('id, value, label, area, is_custom')
      .eq('activo', true)
      .order('orden');
    if (!data) return;
    setTiposDb(data as Array<{ id: string; value: string; label: string; area: string; is_custom: boolean }>);

    // Admin y Gerente no tienen restricciones
    if (!usuario || ['Administrador', 'Gerente'].includes(usuario.rol)) return;

    const tipoIds = data.map(t => t.id);

    // Permisos por rol
    const { data: rolData } = await supabase
      .from('tramite_tipo_rol_permisos')
      .select('tramite_tipo_id, puede_crear, puede_editar')
      .eq('rol', usuario.rol)
      .in('tramite_tipo_id', tipoIds);

    // Override por usuario
    const { data: overData } = await supabase
      .from('tramite_tipo_usuario_override')
      .select('tramite_tipo_id, puede_crear, puede_editar')
      .eq('user_id', usuario.id)
      .in('tramite_tipo_id', tipoIds);

    const blocked = new Set<string>();
    const readOnlyAfterCreate = new Set<string>();
    for (const tipo of data) {
      const override = overData?.find(o => o.tramite_tipo_id === tipo.id);
      const rolPerm = rolData?.find(r => r.tramite_tipo_id === tipo.id);

      // Bloquear creación
      if (override !== undefined) {
        if (override.puede_crear === false) blocked.add(tipo.id);
      } else {
        if (rolPerm?.puede_crear === false) blocked.add(tipo.id);
      }

      // Marcar como solo-lectura después de crear (puede crear pero no editar)
      if (!blocked.has(tipo.id)) {
        const puedeEditar = override?.puede_editar ?? rolPerm?.puede_editar ?? true;
        if (puedeEditar === false) readOnlyAfterCreate.add(tipo.id);
      }
    }
    setTiposBlockedIds(blocked);
    setTiposReadOnlyAfterCreate(readOnlyAfterCreate);
  };

  const COTIZACION_EMISION_SUBTYPE_ID = '2ef883f9-96fc-452e-92eb-ff6826be412d';


  useEffect(() => {
    if (tipoTramite === 'correccion_comisiones' && usuario) {
      loadLotesDisponibles();
    }
  }, [tipoTramite, usuario]);

  // Cargar campos dinámicos del catálogo cuando cambia el tipo de trámite
  useEffect(() => {
    const tipoInfo = tiposDb.find(t => t.value === tipoTramite);
    if (!tipoInfo?.id) { setCamposDinamicos([]); setRespuestasDinamicas({}); return; }
    supabase
      .from('tramite_tipo_campos')
      .select('id, key, label, tipo, requerido, ayuda, display_order, config, is_sistema, sistema_key, visible_para_rol, editable_para_rol, seccion_id')
      .eq('tramite_tipo_id', tipoInfo.id)
      .eq('activo', true)
      .order('display_order')
      .then(({ data }) => {
        const campos = (data as CampoDinamico[]) || [];
        setCamposDinamicos(campos);
        // Auto-set el primer slug con clasificacion='inicio' del campo estatus
        const estatusCampo = campos.find(c => c.tipo === 'estatus');
        const primeraOpcionInicio = estatusCampo?.config.opciones?.find(o => o.clasificacion === 'inicio');
        if (estatusCampo && primeraOpcionInicio) {
          setRespuestasDinamicas({ [estatusCampo.id]: primeraOpcionInicio.slug });
        } else {
          setRespuestasDinamicas({});
        }
      });
    supabase
      .from('tramite_tipo_secciones')
      .select('id, tramite_tipo_id, nombre, descripcion, orden, opcional, depende_de_seccion_id, activo')
      .eq('tramite_tipo_id', tipoInfo.id)
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => {
        setSecciones((data as TramiteSeccion[]) || []);
        setSeccionesExpandidas(new Set());
        setMostroBadgeExtra(false);
      });
  }, [tipoTramite, tiposDb]);

  // Badge de "información adicional": se dispara una sola vez por trámite, la primera
  // vez que un campo NO requerido recibe respuesta (o se expande una sección opcional).
  const dispararBadgeExtra = () => {
    if (mostroBadgeExtra) return;
    setMostroBadgeExtra(true);
    setShowBadgeExtra(true);
    setTimeout(() => setShowBadgeExtra(false), 4000);
  };

  useEffect(() => {
    if (mostroBadgeExtra || camposDinamicos.length === 0) return;
    const hayOpcionalRespondido = camposDinamicos.some(c => !c.requerido && isCampoRespondido(c));
    if (hayOpcionalRespondido) dispararBadgeExtra();
  }, [respuestasDinamicas, asignado, prioridad, descripcion, fechaPromesaEntrega, archivos, adjuntosTemporales]);

  // Cargar catálogos para campos sistema agente_vendedor / oficina_jiro
  useEffect(() => {
    if (!camposDinamicos.some(c => c.sistema_key === 'agente_vendedor')) return;
    supabase.from('maestro_agentes')
      .select('id, nombre, despacho_id, maestro_usuario_agente(user_id, activo, usuarios(nombre_completo))')
      .eq('activo', true).eq('es_primario', true).order('nombre')
      .then(({ data }) => {
        const mapped = (data || []).map((a: any) => {
          const mapeo = (a.maestro_usuario_agente || []).find((m: any) => m.activo);
          return {
            id: a.id, nombre: a.nombre, despacho_id: a.despacho_id,
            usuario_id: mapeo?.user_id ?? undefined,
            usuario_nombre: mapeo?.usuarios?.nombre_completo ?? undefined,
          };
        });
        setAgentesVendedor(mapped);
      });
    supabase.from('maestro_despachos').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setDespachos((data || []) as {id: string; nombre: string}[]));
  }, [camposDinamicos]);

  // Cargar catálogos maestro para campos tipo aseguradora / ramo
  // También se activa para cotizacion_emision y tipos comerciales (reemplazan campos legacy)
  useEffect(() => {
    const tieneAseg = camposDinamicos.some(c => c.tipo === 'aseguradora');
    const tieneRamo = camposDinamicos.some(c => c.tipo === 'ramo');
    const esCeOComercial = tipoTramite === 'cotizacion_emision' || isCommercialTicketType(tipoTramite);
    if (!tieneAseg && !tieneRamo && !esCeOComercial) return;

    supabase.from('maestro_companias').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setCatalogoCompanias((data || []) as {id: string; nombre: string}[]));
    supabase.from('maestro_ramos').select('id, nombre').order('nombre')
      .then(({ data }) => setCatalogoRamos((data || []) as {id: string; nombre: string}[]));
    supabase.from('maestro_combinaciones').select('compania_id, ramo_id')
      .then(({ data }) => setCombinaciones((data || []) as {compania_id: string; ramo_id: string}[]));
  }, [camposDinamicos, tipoTramite]);

  useEffect(() => {
    if (tipoTramite === 'correccion_comisiones' && asignado) {
      // Reset lote selection when assigned user changes, unless we're initializing with preloaded data
      if (!isInitializingWithPreloadedData.current) {
        setLoteSeleccionado('');
      }
      loadLotesDisponibles(asignado);
    }
  }, [asignado]);

  useEffect(() => {
    if (loteSeleccionado) {
      loadDocumentosLote();
    } else {
      setDocumentosLote([]);
      setDocumentoSeleccionado('');
    }
  }, [loteSeleccionado]);

  useEffect(() => {
    if (tipoTramite === 'registro_poliza' || tipoTramite === 'solicitud_comisiones_pendientes' || isCommercialTicketType(tipoTramite)) {
      loadAseguradoras();
    }
    if (tipoTramite === 'cotizacion_emision' || isCommercialTicketType(tipoTramite)) {
      loadCeCatalogs();
    }
  }, [tipoTramite]);


  useEffect(() => {
    if (isEstatusFinal(ceEstatusNombre) && !ceCompletionDatetime) {
      setCeCompletionDatetime(formatDateTimeForInput(new Date()));
    }
  }, [ceEstatusNombre]);

  const loadCeCatalogs = async () => {
    if (!usuario) return;
    try {
      const agentes = usuario.oficina_id
        ? await getUsersByOffice(usuario.oficina_id)
        : [];
      setCeAgenteUsers(agentes);
    } catch (err) {
      console.error('Error loading CE catalogs:', err);
    }
  };

  const resetForm = () => {
    if (preloadedData?.tipoTramite) {
      setTipoTramite(preloadedData.tipoTramite);
    } else if (isAgent) {
      setTipoTramite('cotizacion_emision');
    } else {
      setTipoTramite('correccion_poliza_registrada');
    }

    if (isAgent && usuario) {
      setAsignado(usuario.id);
    } else {
      setAsignado('');
    }

    setPrioridad((preloadedData?.prioridad as 'Alta' | 'Media' | 'Baja') || 'Baja');
    setDescripcion(preloadedData?.descripcion || preloadedData?.instrucciones || '');
    setArchivos([]);
    setArchivoCategoriaId('');
    setPolizaNumero('');

    // Respetar lote precargado si existe
    if (preloadedData?.comisionesLoteId) {
      setLoteSeleccionado(preloadedData.comisionesLoteId);
    } else {
      setLoteSeleccionado('');
    }

    setDocumentoSeleccionado('');
    setPolizaFiles([{ id: '1', file: null, aseguradora: '', claveAgente: '' }]);
    setComisionesPendientes([{ id: '1', numeroPoliza: '', aseguradora: '', fechaPago: '', archivo: null }]);
    setError('');

    // Reset CE fields
    setCeAgenteUserId('');
    setCeRamoId('');
    setCeSelectedInsurers([]);
    setCeRequestDatetime(formatDateTimeForInput(new Date()));
    setCeCompletionDatetime('');
    setCeEstatusNombre('Iniciado');
    setCeShowInsurerDropdown(false);
    setCeInsurerSearchTerm('');

    // Reset commercial fields
    setComAgenteUserId('');
    setComCliente('');
    setComPoliza('');
    setComAseguradora('');
    setComFechaVencimiento('');
    setComMonto('');
    setComAsunto('');
    setFechaPromesaEntrega('');
  };

  const restoreFromDraft = (draft: Record<string, unknown>) => {
    setTipoTramite((draft.tipoTramite as string) || (isAgent ? 'cotizacion_emision' : 'correccion_poliza_registrada'));
    setAsignado((draft.asignado as string) || (isAgent ? (usuario?.id || '') : ''));
    setPrioridad(((draft.prioridad as string) || 'Baja') as 'Alta' | 'Media' | 'Baja');
    setDescripcion((draft.descripcion as string) || '');
    setPolizaNumero((draft.polizaNumero as string) || '');
    setCeAgenteUserId((draft.ceAgenteUserId as string) || '');
    setCeRamoId((draft.ceRamoId as string) || '');
    setCeSelectedInsurers((draft.ceSelectedInsurers as string[]) || []);
    setComAgenteUserId((draft.comAgenteUserId as string) || '');
    setComCliente((draft.comCliente as string) || '');
    setComPoliza((draft.comPoliza as string) || '');
    setComAseguradora((draft.comAseguradora as string) || '');
    setComFechaVencimiento((draft.comFechaVencimiento as string) || '');
    setComMonto((draft.comMonto as string) || '');
    setComAsunto((draft.comAsunto as string) || '');
    // Always reset non-serializable/time-sensitive fields
    setArchivos([]);
    setPolizaFiles([{ id: '1', file: null, aseguradora: '', claveAgente: '' }]);
    setComisionesPendientes([{ id: '1', numeroPoliza: '', aseguradora: '', fechaPago: '', archivo: null }]);
    setLoteSeleccionado('');
    setDocumentoSeleccionado('');
    setCeRequestDatetime(formatDateTimeForInput(new Date()));
    setCeCompletionDatetime('');
    setCeEstatusNombre('Iniciado');
    setCeShowInsurerDropdown(false);
    setCeInsurerSearchTerm('');
    setFechaPromesaEntrega((draft.fechaPromesaEntrega as string) || '');
    setError('');
  };

  // Auto-save draft to sessionStorage while modal is open
  useEffect(() => {
    if (!isOpen) return;
    saveDraft(DRAFT_KEY, {
      tipoTramite, asignado, prioridad, descripcion, polizaNumero,
      ceAgenteUserId, ceRamoId, ceSelectedInsurers,
      comAgenteUserId, comCliente, comPoliza, comAseguradora,
      comFechaVencimiento, comMonto, comAsunto, fechaPromesaEntrega,
    });
  }, [isOpen, tipoTramite, asignado, prioridad, descripcion, polizaNumero,
      ceAgenteUserId, ceRamoId, ceSelectedInsurers,
      comAgenteUserId, comCliente, comPoliza, comAseguradora,
      comFechaVencimiento, comMonto, comAsunto, fechaPromesaEntrega]);

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol, oficina_id')
      .order('nombre_completo');

    if (data) setUsuariosDisponibles(data as Usuario[]);
  };

  const resolveGrupoParaTicket = async (agente_id: string | null, tipo_tramite?: string): Promise<{ grupo_id: string; ejecutivo_id: string | null } | null> => {
    if (!agente_id) return null;
    const { data } = await supabase.rpc('get_grupo_para_ticket', {
      p_agente_id: agente_id,
      ...(tipo_tramite ? { p_tipo_tramite: tipo_tramite } : {}),
    });
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    const row = data[0] as { grupo_id: string; ejecutivo_id: string | null };
    return row.grupo_id ? row : null;
  };

  const loadLotesDisponibles = async (forUserId?: string) => {
    if (!usuario) return;

    try {
      const targetUserId = forUserId || asignado;

      if (targetUserId) {
        // Get user email to find agent
        const { data: userData } = await supabase
          .from('usuarios')
          .select('email_laboral')
          .eq('id', targetUserId)
          .single();

        if (userData?.email_laboral) {
          // Get batches that have commission details for this user
          const { data } = await supabase
            .from('commission_batches')
            .select(`
              *,
              details:commission_details!inner(id)
            `)
            .eq('details.usuario_id', targetUserId)
            .in('status', ['draft', 'confirmed', 'closed'])
            .order('date_from', { ascending: false })
            .limit(20);

          if (data) {
            // Remove the details field from the response
            const batches = data.map(({ details, ...batch }) => batch);
            setLotesDisponibles(batches);
            return;
          }
        }
      }

      // Fallback: load all batches if no agent specified or not found
      const { data } = await supabase
        .from('commission_batches')
        .select('*')
        .in('status', ['draft', 'confirmed', 'closed'])
        .order('date_from', { ascending: false })
        .limit(20);

      if (data) setLotesDisponibles(data);
    } catch (error) {
      console.error('Error loading commission batches:', error);
      setLotesDisponibles([]);
    }
  };

  const loadDocumentosLote = async () => {
    if (!loteSeleccionado) return;

    setLoadingDocumentos(true);
    try {
      const { data } = await supabase
        .from('commission_details')
        .select('id, poliza, nombre_asegurado, aseguradora, importe_base, prima_neta, date_fpago, concepto')
        .eq('batch_id', loteSeleccionado)
        .order('poliza');

      if (data) setDocumentosLote(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocumentos(false);
    }
  };

  const loadAseguradoras = async () => {
    // Preferir maestro_companias (importadas por admin vía /admin/base-datos).
    // Fallback a cat_aseguradoras mientras no haya datos importados.
    const { data: maestro } = await supabase
      .from('maestro_companias')
      .select('nombre')
      .eq('activo', true)
      .order('nombre');

    if (maestro?.length) {
      setAseguradoras(maestro);
    } else {
      const { data } = await supabase
        .from('cat_aseguradoras')
        .select('nombre')
        .eq('activo', true)
        .order('nombre');
      if (data) setAseguradoras(data);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxFiles = 20;

    if (archivos.length + files.length > maxFiles) {
      setError('Este trámite permite un máximo de 20 documentos adjuntos. Elimina algún archivo o reduce la cantidad para continuar.');
      return;
    }

    setArchivos(prev => [...prev, ...files]);
    setError('');
  };

  const removeFile = (index: number) => {
    setArchivos(prev => prev.filter((_, i) => i !== index));
  };

  const addPolizaFile = () => {
    if (polizaFiles.length >= 10) {
      setError('Máximo 10 archivos permitidos');
      return;
    }

    setPolizaFiles(prev => [
      ...prev,
      { id: Date.now().toString(), file: null, aseguradora: '', claveAgente: '' }
    ]);
    setError('');
  };

  const removePolizaFile = (id: string) => {
    if (polizaFiles.length === 1) {
      setError('Debe haber al menos un archivo');
      return;
    }
    setPolizaFiles(prev => prev.filter(f => f.id !== id));
  };

  const updatePolizaFile = (id: string, field: keyof PolizaFile, value: any) => {
    setPolizaFiles(prev => prev.map(f =>
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const addComisionPendiente = () => {
    if (comisionesPendientes.length >= 10) {
      setError('Máximo 10 comisiones pendientes permitidas');
      return;
    }

    setComisionesPendientes(prev => [
      ...prev,
      { id: Date.now().toString(), numeroPoliza: '', aseguradora: '', fechaPago: '', archivo: null }
    ]);
    setError('');
  };

  const removeComisionPendiente = (id: string) => {
    if (comisionesPendientes.length === 1) {
      setError('Debe haber al menos una comisión pendiente');
      return;
    }
    setComisionesPendientes(prev => prev.filter(c => c.id !== id));
  };

  const updateComisionPendiente = (id: string, field: keyof ComisionPendiente, value: any) => {
    setComisionesPendientes(prev => prev.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  // Sistema auto-fill: nunca se piden en el formulario, no cuentan para requerido/progreso.
  const AUTO_FILL_KEYS = ['area', 'equipo', 'fecha_creacion', 'fecha_finalizacion', 'oficina_jiro', 'agente_vendedor', 'creado_por'];

  // Único punto de verdad de "¿este campo ya tiene respuesta?" — usado por validateForm()
  // y por la barra de progreso (que necesita el mismo criterio sin lanzar errores).
  const isCampoRespondido = (campo: CampoDinamico): boolean => {
    if (campo.is_sistema && campo.sistema_key === 'asignado_a') {
      if (asignado) return true;
      const agCampo = camposDinamicos.find(c => c.sistema_key === 'agente_vendedor');
      const agId = agCampo ? respuestasDinamicas[agCampo.id] : null;
      const agSin = agId ? agentesVendedor.find(a => a.id === agId && !a.usuario_id) : null;
      return !!agSin;
    }
    if (campo.is_sistema && campo.sistema_key === 'prioridad') return !!prioridad;
    if (campo.is_sistema && campo.sistema_key === 'descripcion') return !!descripcion?.trim();
    if (campo.is_sistema && campo.sistema_key === 'fecha_promesa_entrega') return !!fechaPromesaEntrega;
    if (campo.is_sistema && campo.sistema_key === 'archivos_adjuntos') return archivos.length > 0;
    if (campo.tipo === 'adjunto') return (adjuntosTemporales[campo.id]?.length ?? 0) > 0;
    const val = respuestasDinamicas[campo.id];
    return !(val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0));
  };

  const validateForm = (): boolean => {
    if (isCommercialTicketType(tipoTramite)) {
      if (!comAgenteUserId) {
        setError('Debe seleccionar un agente relacionado para trámites comerciales');
        return false;
      }
      return true;
    }

    if (tipoTramite === 'correccion_comisiones') {
      if (!loteSeleccionado) {
        setError('Debe seleccionar un lote de comisiones');
        return false;
      }
      if (!documentoSeleccionado) {
        setError('Debe seleccionar un documento del lote');
        return false;
      }
    }

    if (tipoTramite === 'registro_poliza') {
      const filesWithData = polizaFiles.filter(f => f.file !== null);

      if (filesWithData.length === 0) {
        setError('Debe adjuntar al menos 1 archivo');
        return false;
      }

      for (const pf of filesWithData) {
        if (!pf.aseguradora) {
          setError('Todos los archivos deben tener una aseguradora seleccionada');
          return false;
        }
        if (!pf.claveAgente || !/^[a-zA-Z0-9]+$/.test(pf.claveAgente)) {
          setError('Todos los archivos deben tener una clave de agente válida (alfanumérica)');
          return false;
        }
      }
    }

    if (tipoTramite === 'solicitud_comisiones_pendientes') {
      if (comisionesPendientes.length === 0) {
        setError('Debe agregar al menos 1 comisión pendiente');
        return false;
      }
    }

    // Validar campos dinámicos requeridos (omitir campos sistema auto-fill)
    for (const campo of camposDinamicos) {
      if (!campo.requerido) continue;
      if (!canSeeCampo(campo)) continue;
      if (campo.is_sistema && AUTO_FILL_KEYS.includes(campo.sistema_key || '')) continue;
      if (!isCampoRespondido(campo)) {
        setError(`El campo "${campo.label}" es obligatorio`);
        return false;
      }
    }

    // Validar categoría de adjuntos si hay archivos adjuntados
    const tieneAdjuntoLegacy = tipoTramite !== 'registro_poliza' && tipoTramite !== 'solicitud_comisiones_pendientes';
    if (tieneAdjuntoLegacy && archivos.length > 0 && !archivoCategoriaId) {
      setError('Selecciona una categoría para los archivos adjuntos');
      return false;
    }

    return true;
  };

  const renderCampoDinamico = (campo: CampoDinamico) => {
    const val = respuestasDinamicas[campo.id];
    const set = (v: any) => setRespuestasDinamicas(prev => ({ ...prev, [campo.id]: v }));

    return (
      <div key={campo.id}>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          {campo.label}{campo.requerido && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {campo.ayuda && <p className="text-xs text-neutral-500 mb-1">{campo.ayuda}</p>}

        {campo.tipo === 'texto_corto' && (
          <input
            type="text"
            value={val || ''}
            onChange={e => set(e.target.value)}
            maxLength={campo.config.max_length}
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {campo.tipo === 'texto_largo' && (
          <textarea
            value={val || ''}
            onChange={e => set(e.target.value)}
            maxLength={campo.config.max_length}
            rows={3}
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        )}

        {campo.tipo === 'numerico' && (
          <input
            type="number"
            value={val ?? ''}
            onChange={e => set(e.target.value === '' ? null : Number(e.target.value))}
            step={campo.config.es_entero ? '1' : 'any'}
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {campo.tipo === 'fecha' && (
          <input
            type="date"
            value={val || ''}
            onChange={e => set(e.target.value)}
            min={campo.config.min_fecha}
            max={campo.config.max_fecha}
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {campo.tipo === 'booleano' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!val}
              onChange={e => set(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm text-neutral-700">Sí</span>
          </label>
        )}

        {(campo.tipo === 'estatus' || campo.tipo === 'dropdown') && (
          <SearchableSelect
            value={val || ''}
            onChange={set}
            options={(campo.config.opciones || []).map((opt: CampoDinamicoOption) => ({ label: opt.label, value: opt.slug }))}
            placeholder="Seleccionar..."
          />
        )}

        {campo.tipo === 'aseguradora' && (
          <select
            value={val || ''}
            onChange={e => {
              set(e.target.value);
              // Limpiar ramo dependiente si hay campo con filtrar_por_aseguradora
              const ramoCampo = camposDinamicos.find(c => c.tipo === 'ramo' && c.config?.filtrar_por_aseguradora);
              if (ramoCampo) setRespuestasDinamicas(prev => ({ ...prev, [ramoCampo.id]: '' }));
            }}
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Selecciona aseguradora...</option>
            {catalogoCompanias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        )}

        {campo.tipo === 'ramo' && (() => {
          let ramosDisp = catalogoRamos;
          if (campo.config?.filtrar_por_aseguradora) {
            const asegCampo = camposDinamicos.find(c => c.tipo === 'aseguradora');
            const asegNombre = asegCampo ? respuestasDinamicas[asegCampo.id] : null;
            if (asegNombre) {
              const compania = catalogoCompanias.find(c => c.nombre === asegNombre);
              if (compania) {
                const validIds = new Set(combinaciones.filter(cb => cb.compania_id === compania.id).map(cb => cb.ramo_id));
                ramosDisp = catalogoRamos.filter(r => validIds.has(r.id));
              } else {
                ramosDisp = [];
              }
            } else {
              ramosDisp = [];
            }
          }
          const placeholder = campo.config?.filtrar_por_aseguradora && !ramosDisp.length
            ? 'Selecciona primero una aseguradora...'
            : 'Selecciona ramo...';
          return (
            <select
              value={val || ''}
              onChange={e => set(e.target.value)}
              disabled={campo.config?.filtrar_por_aseguradora && ramosDisp.length === 0}
              className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{placeholder}</option>
              {ramosDisp.map(r => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
            </select>
          );
        })()}

        {campo.tipo === 'codigo_postal' && (() => {
          const cpState = cpSearchState[campo.id] || { colonias: [], loading: false };
          const stored = val as { codigo?: string; colonia?: string; municipio?: string; estado?: string } | undefined;
          return (
            <div className="space-y-2">
              <input
                type="text"
                value={stored?.codigo || ''}
                onChange={async e => {
                  const cp = e.target.value.replace(/\D/g, '').slice(0, 5);
                  set({ codigo: cp, colonia: '', municipio: '', estado: '' });
                  if (cp.length === 5) {
                    setCpSearchState(prev => ({ ...prev, [campo.id]: { colonias: [], loading: true } }));
                    const { data } = await supabase
                      .from('codigos_postales')
                      .select('colonia, municipio, estado')
                      .eq('codigo', cp)
                      .order('colonia');
                    setCpSearchState(prev => ({ ...prev, [campo.id]: { colonias: data || [], loading: false } }));
                  } else {
                    setCpSearchState(prev => ({ ...prev, [campo.id]: { colonias: [], loading: false } }));
                  }
                }}
                placeholder="Ej: 76000"
                maxLength={5}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {cpState.loading && <p className="text-xs text-neutral-400">Buscando colonias...</p>}
              {cpState.colonias.length > 0 && (
                <select
                  value={stored?.colonia || ''}
                  onChange={e => {
                    const col = cpState.colonias.find(c => c.colonia === e.target.value);
                    if (col) set({ codigo: stored?.codigo, ...col });
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Selecciona colonia...</option>
                  {cpState.colonias.map(c => <option key={c.colonia} value={c.colonia}>{c.colonia}</option>)}
                </select>
              )}
              {stored?.municipio && (
                <p className="text-xs text-neutral-500">{stored.municipio}, {stored.estado}</p>
              )}
            </div>
          );
        })()}

        {campo.tipo === 'seleccion_multiple' && (
          <div className="flex flex-wrap gap-2">
            {(campo.config.opciones || []).map((opt: CampoDinamicoOption) => {
              const selected: string[] = Array.isArray(val) ? val : [];
              const isChecked = selected.includes(opt.slug);
              return (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => set(isChecked ? selected.filter(s => s !== opt.slug) : [...selected, opt.slug])}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isChecked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-neutral-600 border-neutral-300 hover:border-blue-400'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {campo.tipo === 'email' && (
          <input
            type="email"
            value={val || ''}
            onChange={e => set(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {campo.tipo === 'telefono' && (
          <input
            type="tel"
            value={val || ''}
            onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10 dígitos"
            maxLength={10}
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {campo.tipo === 'rfc' && (
          <input
            type="text"
            value={val || ''}
            onChange={e => set(e.target.value.toUpperCase().slice(0, 13))}
            placeholder="RFC (12 ó 13 caracteres)"
            maxLength={13}
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
          />
        )}

        {campo.tipo === 'curp' && (
          <input
            type="text"
            value={val || ''}
            onChange={e => set(e.target.value.toUpperCase().slice(0, 18))}
            placeholder="CURP (18 caracteres)"
            maxLength={18}
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
          />
        )}

        {campo.tipo === 'porcentaje' && (
          <div className="relative">
            <input
              type="number"
              value={val ?? ''}
              onChange={e => set(e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value))))}
              min={0}
              max={100}
              step="0.01"
              className="w-full px-3 py-2 pr-8 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 pointer-events-none">%</span>
          </div>
        )}

        {campo.tipo === 'adjunto' && (() => {
          const files = adjuntosTemporales[campo.id] || [];
          const maxFiles = campo.config.max_archivos || 1;
          const maxMb = campo.config.max_mb || 10;
          const accept = (campo.config.tipos_mime || []).join(',') || undefined;
          const categoriaFija = campo.config.categoria_id as string | undefined;
          return (
            <div className="space-y-2">
              {/* Selector de categoría cuando el admin no pre-configuró una */}
              {!categoriaFija && adjuntoCategorias.length > 0 && (
                <select
                  value={adjuntoCategoriasIds[campo.id] || ''}
                  onChange={e => setAdjuntoCategoriasIds(prev => ({ ...prev, [campo.id]: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Categoría del archivo (opcional)</option>
                  {adjuntoCategorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              )}
              {files.length < maxFiles && (
                <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                  <Upload className="w-4 h-4 text-neutral-400" />
                  <span className="text-sm text-neutral-500">
                    {files.length > 0 ? 'Agregar otro archivo' : 'Haz clic para adjuntar'}
                  </span>
                  <input
                    type="file"
                    accept={accept}
                    multiple={maxFiles > 1}
                    className="hidden"
                    onChange={e => {
                      const selected = Array.from(e.target.files || []);
                      const tooBig = selected.filter(f => f.size > maxMb * 1024 * 1024);
                      if (tooBig.length) { setError(`El archivo excede el límite de ${maxMb} MB.`); return; }
                      const merged = [...files, ...selected].slice(0, maxFiles);
                      setAdjuntosTemporales(prev => ({ ...prev, [campo.id]: merged }));
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-200">
                  <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span className="text-sm flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-neutral-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                  <button type="button"
                    onClick={() => setAdjuntosTemporales(prev => ({ ...prev, [campo.id]: files.filter((_, j) => j !== i) }))}
                    className="p-1 text-red-400 hover:text-red-600 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {maxFiles > 1 && (
                <p className="text-xs text-neutral-400">{files.length}/{maxFiles} archivos · máx {maxMb} MB c/u</p>
              )}
            </div>
          );
        })()}

      </div>
    );
  };

  const renderCampoSistema = (campo: CampoDinamico) => {
    const tipoInfo = tiposDb.find(t => t.value === tipoTramite);
    const violet = 'px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700 flex items-center gap-2';
    const lock = <span className="text-[10px] font-bold bg-violet-100 text-violet-500 px-1.5 py-0.5 rounded">AUTO</span>;

    if (campo.sistema_key === 'area') return (
      <div key={campo.id}>
        <label className="block text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">🔒 {campo.label}</label>
        <div className={violet}>{lock}{tipoInfo?.area || 'Sin área'}</div>
      </div>
    );

    if (campo.sistema_key === 'equipo') return (
      <div key={campo.id}>
        <label className="block text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">🔒 {campo.label}</label>
        <div className={violet}>{lock}Auto-asignado al crear</div>
      </div>
    );

    if (campo.sistema_key === 'fecha_creacion') return (
      <div key={campo.id}>
        <label className="block text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">🔒 {campo.label}</label>
        <div className={violet}>{lock}{new Date().toLocaleString('es-MX')}</div>
      </div>
    );

    if (campo.sistema_key === 'creado_por') return (
      <div key={campo.id}>
        <label className="block text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">🔒 {campo.label}</label>
        <div className={violet}>{lock}{usuario?.nombre_completo || usuario?.nombre || 'Usuario actual'}</div>
      </div>
    );

    if (campo.sistema_key === 'fecha_finalizacion') return (
      <div key={campo.id}>
        <label className="block text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">🔒 {campo.label}</label>
        <div className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-400 italic">
          Se registrará al cerrar el trámite
        </div>
      </div>
    );

    if (campo.sistema_key === 'agente_vendedor') {
      const val = respuestasDinamicas[campo.id] || '';
      const selectedAgente = agentesVendedor.find(a => a.id === val);
      const agenteOpts = agentesVendedor.map(a => ({
        label: a.usuario_nombre ?? `⚠ ${a.nombre}`,
        value: a.id,
      }));
      return (
        <div key={campo.id}>
          <label className="block text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">
            🔒 {campo.label}{campo.requerido && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <SearchableSelect
            value={val}
            onChange={agenteId => {
              const agente = agentesVendedor.find(a => a.id === agenteId);
              const oficinaCampo = camposDinamicos.find(c => c.sistema_key === 'oficina_jiro');
              const despacho = agente ? despachos.find(d => d.id === agente.despacho_id) : null;
              setRespuestasDinamicas(prev => ({
                ...prev,
                [campo.id]: agenteId,
                ...(oficinaCampo ? { [oficinaCampo.id]: despacho?.nombre || '' } : {}),
              }));
              if (agente?.usuario_id) setAsignado(agente.usuario_id);
            }}
            options={agenteOpts}
            placeholder="Selecciona usuario asignado..."
          />
          {val && !selectedAgente?.usuario_id && (
            <div className="mt-2 space-y-2">
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Este agente no tiene cuenta MOVI vinculada. Escribe el nombre de la cuenta que el Admin debe crear o vincular.
                </p>
              </div>
              <input
                type="text"
                value={propuestoNombreMOVI}
                onChange={e => setPropuestoNombreMOVI(e.target.value)}
                placeholder="Nombre completo de la cuenta MOVI a crear…"
                className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white placeholder-neutral-400"
              />
            </div>
          )}
        </div>
      );
    }

    if (campo.sistema_key === 'oficina_jiro') {
      const val = respuestasDinamicas[campo.id];
      return (
        <div key={campo.id}>
          <label className="block text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">🔒 {campo.label}</label>
          <div className={violet}>
            {val
              ? <><span className="text-[10px] font-bold bg-violet-100 text-violet-500 px-1.5 py-0.5 rounded">CAT</span>{val}</>
              : <span className="text-neutral-400 italic text-sm">Auto-completa al seleccionar agente</span>
            }
          </div>
        </div>
      );
    }

    if (campo.sistema_key === 'estatus') return renderCampoDinamico(campo);

    if (campo.sistema_key === 'asignado_a') {
      if (isAgent || tipoTramite === 'cotizacion_emision' || isCommercialTicketType(tipoTramite)) return null;
      return (
        <div key={campo.id} className="space-y-3">
          {isPoolMode && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <span>Este tipo de trámite se enviará a la <strong>cola de Mesa de Control</strong>. Un ejecutivo será asignado posteriormente.</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              {isPoolMode ? 'Agente del Trámite' : (campo.label || 'Asignar a')}
              {campo.requerido && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <select
              value={asignado}
              onChange={(e) => setAsignado(e.target.value)}
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">{isPoolMode ? 'Selecciona el agente' : 'Selecciona un usuario'}</option>
              {usuariosDisponibles.map(u => (
                <option key={u.id} value={u.id}>{u.nombre_completo} ({u.rol})</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    if (campo.sistema_key === 'prioridad') {
      if (isAgent || tipoTramite === 'cotizacion_emision' || isCommercialTicketType(tipoTramite)) return null;
      return (
        <div key={campo.id}>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            {campo.label || 'Prioridad'}
            {campo.requerido && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
          </select>
        </div>
      );
    }

    if (campo.sistema_key === 'descripcion') return (
      <div key={campo.id}>
        <label className="block text-sm font-semibold text-neutral-900 mb-2">
          {campo.label || 'Descripción / Notas'}
          {campo.requerido && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={4}
          placeholder="Describe el motivo del trámite con el mayor detalle posible... (Opcional)"
          className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
      </div>
    );

    if (campo.sistema_key === 'fecha_promesa_entrega') {
      if (isAgent) return null;
      return (
        <div key={campo.id}>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            <Calendar className="w-4 h-4 inline mr-1.5" />
            {campo.label || 'Fecha Promesa de Entrega'}
            {campo.requerido
              ? <span className="text-red-500 ml-0.5">*</span>
              : <span className="text-xs font-normal text-neutral-500 ml-2">Opcional</span>
            }
          </label>
          <input
            type="date"
            value={fechaPromesaEntrega}
            onChange={(e) => setFechaPromesaEntrega(e.target.value)}
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          />
        </div>
      );
    }

    if (campo.sistema_key === 'archivos_adjuntos') {
      if (tipoTramite === 'registro_poliza' || tipoTramite === 'solicitud_comisiones_pendientes') return null;
      return (
        <div key={campo.id}>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            <Upload className="w-4 h-4 inline mr-2" />
            {campo.label || 'Archivos Adjuntos'}
            {campo.requerido && <span className="text-red-500 ml-0.5">*</span>}
            <span className="text-xs font-normal text-neutral-500 ml-2">Documentos adjuntos: {archivos.length} / 20</span>
          </label>
          <div className="mb-3">
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Categoría del adjunto {archivos.length > 0 && <span className="text-red-500">*</span>}
            </label>
            <select
              value={archivoCategoriaId}
              onChange={e => setArchivoCategoriaId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecciona una categoría...</option>
              {adjuntoCategorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>
          <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-accent transition-all">
            <input type="file" multiple onChange={handleFileChange} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
              <Upload className="w-10 h-10 text-neutral-400 mb-2" />
              <p className="text-sm text-neutral-600 mb-1">Haz clic para seleccionar archivos</p>
              <p className="text-xs text-neutral-500">PDF, imágenes, documentos (máx. 20 archivos)</p>
            </label>
          </div>
          {archivos.length > 0 && (
            <div className="mt-3 space-y-2">
              {archivos.map((archivo, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900 truncate">{archivo.name}</p>
                      <p className="text-xs text-neutral-500">{(archivo.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFile(index)} className="text-red-600 hover:text-red-700 ml-2 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const buildCommercialDescription = (): string => {
    const parts: string[] = [];
    if (comAsunto) parts.push(`Asunto: ${comAsunto}`);
    if (comCliente) parts.push(`Cliente: ${comCliente}`);
    if (comPoliza) parts.push(`Póliza: ${comPoliza}`);
    if (comAseguradora) parts.push(`Aseguradora: ${comAseguradora}`);
    if (comFechaVencimiento) parts.push(`Fecha: ${new Date(comFechaVencimiento).toLocaleDateString('es-MX')}`);
    if (comMonto) parts.push(`Monto: $${comMonto}`);
    if (descripcion.trim()) parts.push(descripcion.trim());
    return parts.join('\n') || 'Sin descripción';
  };

  const handleSubmitCotizacionEmision = async () => {
    if (!usuario) return;

    const effectiveAgenteId = isAgent ? usuario.id : (ceAgenteUserId || (preloadedData?.instrucciones ? usuario.id : ''));

    // Resolve team assignment rules (same logic as handleSubmit for other tramite types)
    const grupoResult = await resolveGrupoParaTicket(effectiveAgenteId || null, 'cotizacion_emision');
    const grupoAsignadoId = grupoResult?.grupo_id ?? null;
    // Rule with ejecutivo → direct assign; rule without ejecutivo → pool (empty); no rule → office fallback
    const effectiveAttendingId = grupoResult !== null
      ? (grupoResult.ejecutivo_id ?? '')
      : (isAgent ? (autoResponsableId || '') : usuario.id);

    const formData = {
      tipo_tramite: 'cotizacion_emision',
      activity_subtype_id: COTIZACION_EMISION_SUBTYPE_ID,
      agente_usuario_id: effectiveAgenteId,
      insurance_type_id: null,       // deprecated; se usa maestro_ramo_id ahora
      insurers: ceSelectedInsurers,  // array de nombres de maestro_companias
      attending_user_id: effectiveAttendingId,
      request_datetime: new Date().toISOString(),
      estatus_nombre: isAgent ? 'Iniciado' : ceEstatusNombre,
      prioridad: isAgent ? 'Media' : prioridad,
      instrucciones: descripcion
    };

    if (!effectiveAgenteId && !preloadedData?.instrucciones) { setError('El agente es obligatorio'); return; }
    if (!ceRamoId && !preloadedData?.instrucciones) { setError('El ramo es obligatorio'); return; }
    if (ceSelectedInsurers.length === 0 && !preloadedData?.instrucciones) { setError('Debe seleccionar al menos una aseguradora'); return; }
    if (archivos.length > 0 && !archivoCategoriaId) { setError('Selecciona una categoría para los archivos adjuntos'); return; }

    setLoading(true);
    setError('');
    try {
      const ticket = await createRegistroActividad({ ...formData, creado_por: usuario.id });
      if (ticket?.id) {
        const postUpdates: Record<string, any> = {};
        if (grupoAsignadoId) postUpdates.grupo_asignado_id = grupoAsignadoId;
        if (fechaPromesaEntrega) postUpdates.fecha_promesa_entrega = fechaPromesaEntrega;
        if (ceRamoId) postUpdates.maestro_ramo_id = ceRamoId;
        if (Object.keys(postUpdates).length > 0) {
          await supabase.from('tickets').update(postUpdates).eq('id', ticket.id);
        }

        if (!grupoAsignadoId && !effectiveAttendingId) {
          const { data: adminsSinEquipo } = await supabase.from('usuarios').select('id')
            .eq('rol', 'Administrador').eq('activo', true);
          for (const adm of (adminsSinEquipo ?? [])) {
            await crearNotificacion({
              user_id: adm.id,
              titulo: 'Trámite sin equipo asignado',
              mensaje: `El trámite ${ticket.folio} (Cotización / Emisión) no se pudo asignar automáticamente a ningún equipo. Requiere asignación manual.`,
              modulo: 'Tramites',
              icono: 'alert-triangle',
              accion_url: `/tramites/${ticket.id}`,
              accion_texto: 'Ver trámite',
            });
          }
        }
      }
      if (ticket?.id && archivos.length > 0) {
        for (const archivo of archivos) {
          const fileExt = archivo.name.split('.').pop();
          const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('ticket-archivos')
            .upload(fileName, archivo);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage
            .from('ticket-archivos')
            .getPublicUrl(fileName);
          const { error: archivoError } = await supabase
            .from('ticket_archivos')
            .insert({
              ticket_id: ticket.id,
              usuario_id: usuario.id,
              nombre: archivo.name,
              url: publicUrl,
              tipo: archivo.type,
              tamano: archivo.size,
              categoria_id: archivoCategoriaId || null,
            });
          if (archivoError) throw archivoError;
        }
      }
      clearDraft(DRAFT_KEY);
      if (ticket?.id) onSuccessWithId?.(ticket.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear el trámite');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (tipoTramite === 'cotizacion_emision') {
      await handleSubmitCotizacionEmision();
      return;
    }

    if (!validateForm() || !usuario) return;

    setLoading(true);
    setError('');

    try {
      const estatusNuevo = estatusList.find(e => e.nombre === 'Iniciado');
      if (!estatusNuevo) {
        throw new Error('No se encontró el estatus "Iniciado"');
      }

      const isCommercial = isCommercialTicketType(tipoTramite);
      // Resolve team + optional auto-ejecutivo based on the agent user (applies to all tramite types)
      const agentUserId = isAgent
        ? usuario.id
        : (isCommercial ? comAgenteUserId : asignado) ?? null;
      const grupoResult = await resolveGrupoParaTicket(agentUserId, tipoTramite);
      const grupoAsignadoId = grupoResult?.grupo_id ?? null;
      // grupoResult found + ejecutivo_id null → pool assignment (no individual responsible)
      // grupoResult found + ejecutivo_id set  → auto-assign to that ejecutivo
      // grupoResult null                       → fall back to manual/auto logic
      const autoEjecutivoId = grupoResult?.ejecutivo_id ?? null;
      const responsableId = grupoResult !== null
        ? autoEjecutivoId
        : (isAgent ? (autoResponsableId || null) : (isCommercial ? usuario.id : asignado));
      const assignedTo = isCommercial ? usuario.id : (isAgent ? usuario.id : asignado);

      const ticketData: any = {
        tipo_tramite: tipoTramite,
        estatus_id: estatusNuevo.id,
        prioridad,
        instrucciones: isCommercial ? buildCommercialDescription() : (descripcion.trim() || 'Sin descripción'),
        creado_por: usuario.id,
        modificado_por: usuario.id,
        agente_id: isCommercial ? comAgenteUserId : (isAgent ? usuario.id : assignedTo),
        agente_usuario_id: isCommercial ? comAgenteUserId : undefined,
        assigned_to_user_id: responsableId,
        grupo_asignado_id: grupoAsignadoId ?? undefined,
      };

      if (tipoTramite === 'correccion_poliza_registrada') {
        ticketData.poliza = polizaNumero.trim() || null;
      }

      if (tipoTramite === 'correccion_poliza_endoso') {
        ticketData.poliza = comPoliza.trim() || null;
      }

      if (tipoTramite === 'correccion_comisiones') {
        const lote = lotesDisponibles.find(l => l.id === loteSeleccionado);
        const documento = documentosLote.find(d => d.id === documentoSeleccionado);

        ticketData.comisiones_lote_id = loteSeleccionado;
        ticketData.comisiones_lote_label = lote?.name || '';
        ticketData.comisiones_documento_id = documentoSeleccionado;
        ticketData.comisiones_poliza_ref = documento?.poliza || '';
        ticketData.comisiones_context_snapshot = {
          lote: lote,
          documento: documento
        };
      }

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert(ticketData)
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Guardar el texto de creación como primer comentario, para que quede en el
      // historial de la conversación (antes solo se guardaba en tickets.instrucciones
      // y la pestaña Comentarios arrancaba vacía).
      const comentarioInicial = (ticketData.instrucciones as string)?.trim();
      if (comentarioInicial && comentarioInicial !== 'Sin descripción') {
        await supabase.from('ticket_comentarios').insert({
          ticket_id: ticket.id,
          usuario_id: usuario.id,
          mensaje: comentarioInicial,
        });
      }

      // Guardar respuestas de campos dinámicos (sistema + custom)
      if (camposDinamicos.length > 0) {
        // Auto-poblar campos sistema antes de guardar
        const tipoInfoGuardado = tiposDb.find(t => t.value === tipoTramite);
        const autoSistema: Record<string, string> = {};
        const areaCampo = camposDinamicos.find(c => c.sistema_key === 'area');
        if (areaCampo && tipoInfoGuardado?.area) autoSistema[areaCampo.id] = tipoInfoGuardado.area;
        const fechaCreCampo = camposDinamicos.find(c => c.sistema_key === 'fecha_creacion');
        if (fechaCreCampo) autoSistema[fechaCreCampo.id] = new Date().toISOString();
        const creadoPorCampo = camposDinamicos.find(c => c.sistema_key === 'creado_por');
        if (creadoPorCampo) autoSistema[creadoPorCampo.id] = usuario.nombre_completo || usuario.nombre || '';
        const equipoCampo = camposDinamicos.find(c => c.sistema_key === 'equipo');
        if (equipoCampo && grupoAsignadoId) {
          const { data: grupoData } = await supabase
            .from('tramites_grupos_visualizacion').select('nombre').eq('id', grupoAsignadoId).single();
          if (grupoData) autoSistema[equipoCampo.id] = grupoData.nombre;
        }
        const respuestasMerged = { ...autoSistema, ...respuestasDinamicas };

        const TEXTO_TIPOS = ['texto_corto', 'texto_largo', 'area', 'equipo',
          'agente_vendedor', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion', 'creado_por',
          'aseguradora', 'ramo', 'email', 'telefono', 'rfc', 'curp'];

        const respuestas = camposDinamicos
          .filter(c => c.tipo !== 'adjunto' && respuestasMerged[c.id] !== undefined && respuestasMerged[c.id] !== null && respuestasMerged[c.id] !== '')
          .map(c => {
            const val = respuestasMerged[c.id];
            return {
              tramite_id: ticket.id,
              campo_id: c.id,
              valor_texto:    TEXTO_TIPOS.includes(c.tipo) ? String(val) : null,
              valor_numerico: ['numerico', 'porcentaje'].includes(c.tipo) ? Number(val) : null,
              valor_fecha:    c.tipo === 'fecha' ? String(val) : null,
              valor_booleano: c.tipo === 'booleano' ? Boolean(val) : null,
              valor_json:     ['estatus', 'dropdown', 'seleccion_multiple', 'codigo_postal'].includes(c.tipo) ? val : null,
            };
          });
        if (respuestas.length > 0) {
          await supabase.from('tramite_respuestas').insert(respuestas);
        }

        // Subir archivos de campos adjunto dinámicos
        for (const campo of camposDinamicos.filter(c => c.tipo === 'adjunto')) {
          const files = adjuntosTemporales[campo.id] || [];
          if (files.length === 0) continue;
          // Categoría: fija del config (admin la preconfiguró) o elegida por el usuario en el selector
          const categoriaIdAdjunto = (campo.config.categoria_id as string | undefined) || adjuntoCategoriasIds[campo.id] || null;
          const fileData: { id: string; nombre: string; url: string; tipo: string; tamano: number }[] = [];
          for (const file of files) {
            const ext = file.name.split('.').pop();
            const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            const { error: upErr } = await supabase.storage.from('ticket-archivos').upload(fileName, file);
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from('ticket-archivos').getPublicUrl(fileName);
            const { data: archivoData, error: archivoErr } = await supabase.from('ticket_archivos').insert({
              ticket_id: ticket.id, usuario_id: usuario.id,
              nombre: file.name, url: publicUrl, tipo: file.type, tamano: file.size,
              categoria_id: categoriaIdAdjunto,
            }).select('id').single();
            if (archivoErr) throw archivoErr;
            fileData.push({ id: archivoData!.id, nombre: file.name, url: publicUrl, tipo: file.type, tamano: file.size });
          }
          await supabase.from('tramite_respuestas').insert({
            tramite_id: ticket.id, campo_id: campo.id, valor_json: fileData,
          });
        }

        // Guardar custom_estatus_label y custom_estatus_color en el ticket
        const estatusCampo = camposDinamicos.find(c => c.tipo === 'estatus');
        if (estatusCampo) {
          const slug = respuestasDinamicas[estatusCampo.id];
          const opcion = (estatusCampo.config.opciones || []).find(o => o.slug === slug);
          if (opcion) {
            const color = opcion.clasificacion === 'inicio' ? '#3B82F6' : opcion.clasificacion === 'terminacion' ? '#059669' : '#6B7280';
            await supabase.from('tickets').update({ custom_estatus_label: opcion.label, custom_estatus_color: color }).eq('id', ticket.id);
          }
        }

        // Auto-cierre: si algún campo estatus tiene clasificacion 'terminacion'
        const hayTerminacion = camposDinamicos.some(c => {
          if (c.tipo !== 'estatus') return false;
          const slug = respuestasDinamicas[c.id];
          if (!slug) return false;
          const opcion = (c.config.opciones || []).find(o => o.slug === slug);
          return opcion?.clasificacion === 'terminacion';
        });
        if (hayTerminacion) {
          await supabase.from('tickets').update({
            cerrado_en: new Date().toISOString(),
            cerrado_por: usuario.id,
          }).eq('id', ticket.id);
        }
      }

      // Crear asignación en ticket_asignaciones
      if (responsableId) {
        const { error: assignError } = await supabase
          .from('ticket_asignaciones')
          .insert({
            ticket_id: ticket.id,
            ejecutivo_id: responsableId,
            asignado_por: usuario.id
          });

        if (assignError) console.error('Error creating assignment:', assignError);
      }

      // Proponer mapeo si el agente_vendedor seleccionado no tiene usuario MOVI vinculado
      {
        const agCampo = camposDinamicos.find(c => c.sistema_key === 'agente_vendedor');
        if (agCampo) {
          const agId   = respuestasDinamicas[agCampo.id];
          const ag     = agentesVendedor.find(a => a.id === agId);
          if (ag && !ag.usuario_id) {
            let notifMsg = '';
            if (asignado) {
              // Vincular con usuario MOVI existente
              await supabase.from('maestro_mapeo_pendiente').upsert(
                { agente_id: agId, user_id_propuesto: asignado, propuesto_por: usuario.id, ticket_id: ticket.id },
                { onConflict: 'agente_id,user_id_propuesto', ignoreDuplicates: true }
              );
              notifMsg = `${usuario.nombre_completo} propuso vincular al agente "${ag.nombre}" con un usuario MOVI en el trámite ${ticket.folio}.`;
            } else if (propuestoNombreMOVI.trim()) {
              // Solicitar creación de nueva cuenta MOVI
              await supabase.from('maestro_mapeo_pendiente').insert({
                agente_id: agId,
                user_id_propuesto: null,
                nombre_propuesto: propuestoNombreMOVI.trim(),
                propuesto_por: usuario.id,
                ticket_id: ticket.id,
              });
              notifMsg = `Se solicitó crear la cuenta MOVI "${propuestoNombreMOVI.trim()}" para el agente "${ag.nombre}" (trámite ${ticket.folio}).`;
            } else {
              notifMsg = `El agente "${ag.nombre}" no tiene cuenta MOVI vinculada (trámite ${ticket.folio}). Asígnale un usuario en Base de Datos → Vendedores.`;
            }
            const { data: adminsNotif } = await supabase.from('usuarios').select('id')
              .eq('rol', 'Administrador').eq('activo', true);
            for (const adm of (adminsNotif ?? [])) {
              await crearNotificacion({
                user_id: adm.id,
                titulo: asignado ? 'Propuesta de mapeo pendiente' : 'Agente sin cuenta MOVI en trámite nuevo',
                mensaje: notifMsg,
                modulo: 'BaseDatosMaestros',
                icono: 'link',
                accion_url: '/admin/base-datos',
                accion_texto: 'Ir a Mapeo',
              });
            }
          }
        }
      }

      // Notificar al responsable asignado o al líder del equipo
      if (responsableId) {
        await crearNotificacion({
          user_id: responsableId,
          titulo: 'Nuevo trámite asignado',
          mensaje: `Se te asignó el trámite ${ticket.folio} (${tiposDb.find(t => t.value === tipoTramite)?.label || tipoTramite}).`,
          modulo: 'Tramites',
          icono: 'clipboard-list',
          accion_url: `/tramites/${ticket.id}`,
          accion_texto: 'Ver trámite',
        });
      } else if (grupoAsignadoId) {
        const { data: miembros } = await supabase.rpc('get_grupo_miembros_ejecutivos', { p_grupo_id: grupoAsignadoId });
        const lider = (miembros as Array<{ id: string; nombre_completo: string }>)?.[0];
        if (lider) {
          await crearNotificacion({
            user_id: lider.id,
            titulo: 'Nuevo trámite en tu equipo',
            mensaje: `Nuevo trámite ${ticket.folio} asignado a tu equipo (${tiposDb.find(t => t.value === tipoTramite)?.label || tipoTramite}).`,
            modulo: 'Tramites',
            icono: 'clipboard-list',
            accion_url: `/tramites/${ticket.id}`,
            accion_texto: 'Ver trámite',
          });
        }
      } else {
        // Ni responsable ni equipo: la auto-asignación (override, oficina, o regla de
        // área) no resolvió nada. Avisar a Admin para que no se pierda de vista.
        const { data: adminsSinEquipo } = await supabase.from('usuarios').select('id')
          .eq('rol', 'Administrador').eq('activo', true);
        for (const adm of (adminsSinEquipo ?? [])) {
          await crearNotificacion({
            user_id: adm.id,
            titulo: 'Trámite sin equipo asignado',
            mensaje: `El trámite ${ticket.folio} (${tiposDb.find(t => t.value === tipoTramite)?.label || tipoTramite}) no se pudo asignar automáticamente a ningún equipo. Requiere asignación manual.`,
            modulo: 'Tramites',
            icono: 'alert-triangle',
            accion_url: `/tramites/${ticket.id}`,
            accion_texto: 'Ver trámite',
          });
        }
      }

      // Procesar archivos según el tipo de trámite
      if (tipoTramite === 'solicitud_comisiones_pendientes') {
        // Guardar comisiones pendientes
        for (let i = 0; i < comisionesPendientes.length; i++) {
          const comision = comisionesPendientes[i];

          // Insertar comisión pendiente
          const { error: comisionError } = await supabase
            .from('ticket_comisiones_pendientes')
            .insert({
              ticket_id: ticket.id,
              numero_poliza: comision.numeroPoliza.trim() || null,
              aseguradora: comision.aseguradora || null,
              fecha_pago: comision.fechaPago || null,
              orden: i + 1
            });

          if (comisionError) throw comisionError;

          // Si hay archivo adjunto, subirlo
          if (comision.archivo) {
            const fileExt = comision.archivo.name.split('.').pop();
            const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('ticket-archivos')
              .upload(fileName, comision.archivo);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('ticket-archivos')
              .getPublicUrl(fileName);

            // Guardar registro del archivo
            const { error: archivoError } = await supabase
              .from('ticket_archivos')
              .insert({
                ticket_id: ticket.id,
                usuario_id: usuario.id,
                nombre: comision.archivo.name,
                url: publicUrl,
                tipo: comision.archivo.type,
                tamano: comision.archivo.size
              });

            if (archivoError) throw archivoError;
          }

          // Crear comentario con información de la comisión
          let comentarioTexto = `💰 Comisión pendiente #${i + 1}:`;
          if (comision.numeroPoliza) {
            comentarioTexto += `\n• Póliza: ${comision.numeroPoliza}`;
          }
          if (comision.aseguradora) {
            comentarioTexto += `\n• Aseguradora: ${comision.aseguradora}`;
          }
          if (comision.fechaPago) {
            comentarioTexto += `\n• Fecha de pago: ${new Date(comision.fechaPago).toLocaleDateString('es-MX')}`;
          }
          if (comision.archivo) {
            comentarioTexto += `\n• Archivo: ${comision.archivo.name}`;
          }

          const { error: comentarioError } = await supabase
            .from('ticket_comentarios')
            .insert({
              ticket_id: ticket.id,
              usuario_id: usuario.id,
              mensaje: comentarioTexto
            });

          if (comentarioError) throw comentarioError;
        }
      } else if (tipoTramite === 'registro_poliza') {
        const filesWithData = polizaFiles.filter(f => f.file !== null);

        for (const pf of filesWithData) {
          if (!pf.file) continue;

          // Subir archivo
          const fileExt = pf.file.name.split('.').pop();
          const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('ticket-archivos')
            .upload(fileName, pf.file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('ticket-archivos')
            .getPublicUrl(fileName);

          // Guardar registro del archivo
          const { error: archivoError } = await supabase
            .from('ticket_archivos')
            .insert({
              ticket_id: ticket.id,
              usuario_id: usuario.id,
              nombre: pf.file.name,
              url: publicUrl,
              tipo: pf.file.type,
              tamano: pf.file.size
            });

          if (archivoError) throw archivoError;

          // Crear comentario con la información del archivo
          const comentarioTexto = `📎 Documento adjunto:\n• Nombre: ${pf.file.name}\n• Aseguradora: ${pf.aseguradora}\n• Clave de agente: ${pf.claveAgente}`;

          const { error: comentarioError } = await supabase
            .from('ticket_comentarios')
            .insert({
              ticket_id: ticket.id,
              usuario_id: usuario.id,
              mensaje: comentarioTexto
            });

          if (comentarioError) throw comentarioError;
        }
      } else {
        // Para otros tipos de trámite, subir archivos normalmente
        if (archivos.length > 0) {
          for (const archivo of archivos) {
            const fileExt = archivo.name.split('.').pop();
            const fileName = `${ticket.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('ticket-archivos')
              .upload(fileName, archivo);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('ticket-archivos')
              .getPublicUrl(fileName);

            const { error: archivoError } = await supabase
              .from('ticket_archivos')
              .insert({
                ticket_id: ticket.id,
                usuario_id: usuario.id,
                nombre: archivo.name,
                url: publicUrl,
                tipo: archivo.type,
                tamano: archivo.size,
                categoria_id: archivoCategoriaId || null,
              });

            if (archivoError) throw archivoError;
          }
        }
      }

      // Post-update: fecha_promesa_entrega — manual o auto-calculada por SLA del tipo
      if (ticket?.id && !isAgent) {
        let promesa = fechaPromesaEntrega;
        if (!promesa) {
          const tipoDb = tiposMap.get(tipoTramite);
          if (tipoDb?.sla_horas) {
            try {
              const deadline = await calcularDeadline(new Date(), tipoDb.sla_horas);
              promesa = deadline.toISOString().split('T')[0];
            } catch { /* ignorar si falla cálculo */ }
          }
        }
        if (promesa) {
          try {
            await supabase.from('tickets').update({ fecha_promesa_entrega: promesa }).eq('id', ticket.id);
          } catch { /* ignorar si columna no existe aún */ }
        }
      }

      clearDraft(DRAFT_KEY);
      if (ticket?.id) onSuccessWithId?.(ticket.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creando tramite:', err);
      setError(err.message || 'Error al crear el trámite');
    } finally {
      setLoading(false);
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'cotizacion_emision':
        return 'Cotización / Emisión - Proceso completo de cotización y emisión de pólizas';
      case 'correccion_poliza_registrada':
        return 'Corrección de Registro de Póliza - Corrección en datos registrados en Operaciones';
      case 'correccion_poliza_endoso':
        return 'Corrección de Póliza / Endoso - Corrección o endoso de póliza (Comercial)';
      case 'correccion_comisiones':
        return 'Corrección de comisiones';
      case 'registro_poliza':
        return 'Registro de póliza';
      case 'solicitud_comisiones_pendientes':
        return 'Solicitud de comisiones pendientes';
      case 'renovaciones':
        return 'Renovaciones - Seguimiento de renovación de pólizas';
      case 'cobranza':
        return 'Cobranza - Seguimiento de pagos y cobranza';
      case 'otros_comercial':
        return 'Otros - Trámite comercial general';
      default:
        return tipo;
    }
  };

  // No renderizar nada si el modal está cerrado
  if (!isOpen) {
    return null;
  }

  // ── Cascada aseguradora ↔ ramo (solo para form CE) ──────────────────────────
  // Cascada directa: aseguradoras seleccionadas → filtra ramos disponibles
  const ceSelectedCompaniaIds = catalogoCompanias
    .filter(c => ceSelectedInsurers.includes(c.nombre))
    .map(c => c.id);
  const ceRamosDisponibles = ceSelectedInsurers.length === 0
    ? catalogoRamos
    : catalogoRamos.filter(r => {
        const ids = new Set(combinaciones.filter(cb => ceSelectedCompaniaIds.includes(cb.compania_id)).map(cb => cb.ramo_id));
        return ids.has(r.id);
      });

  // Cascada inversa: ramo seleccionado → filtra aseguradoras disponibles
  const ceCompaniasDisponibles = ceRamoId
    ? catalogoCompanias.filter(c => {
        const ids = new Set(combinaciones.filter(cb => cb.ramo_id === ceRamoId).map(cb => cb.compania_id));
        return ids.has(c.id);
      })
    : catalogoCompanias;

  const ceRamoNombre = catalogoRamos.find(r => r.id === ceRamoId)?.nombre ?? '';

  // Barra de progreso — solo campos requeridos del FormBuilder (no incluye validaciones
  // aparte como agente/lote de comisiones, que no vienen de camposDinamicos).
  const camposRequeridosVisibles = camposDinamicos.filter(c =>
    c.requerido && canSeeCampo(c) && !(c.is_sistema && AUTO_FILL_KEYS.includes(c.sistema_key || ''))
  );
  const camposRequeridosCompletos = camposRequeridosVisibles.filter(isCampoRespondido).length;
  const progresoPct = camposRequeridosVisibles.length > 0
    ? Math.round((camposRequeridosCompletos / camposRequeridosVisibles.length) * 100)
    : 0;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={tipoTramite ? `Nuevo: ${tiposDb.find(t => t.value === tipoTramite)?.label ?? tipoTramite}` : 'Nuevo Trámite'}
      maxWidth="4xl"
      subHeader={
        camposRequeridosVisibles.length > 0 ? (
          <div className="relative">
            <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500 mb-1">
              <span>Campos requeridos</span>
              <span>{camposRequeridosCompletos}/{camposRequeridosVisibles.length}</span>
            </div>
            <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progresoPct}%` }}
              />
            </div>
            {showBadgeExtra && (
              <div className="absolute -top-1 right-0 flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm animate-fade-in">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400 animate-bounce" />
                ¡Gracias por ayudarnos a brindarte la mejor atención posible!
              </div>
            )}
          </div>
        ) : undefined
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => { clearDraft(DRAFT_KEY); setDraftRestored(false); onClose(); }}
            disabled={loading}
            className="px-6 py-2.5 text-neutral-700 bg-white border border-neutral-300 rounded-xl hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Creando...
              </>
            ) : (
              'Crear Trámite'
            )}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {draftRestored && (
          <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800 font-medium">Borrador restaurado</p>
              <p className="text-xs text-amber-600 hidden sm:block">— Tu progreso anterior fue recuperado</p>
            </div>
            <button
              type="button"
              onClick={() => { clearDraft(DRAFT_KEY); resetForm(); setDraftRestored(false); }}
              className="text-xs text-amber-700 hover:text-amber-900 underline shrink-0"
            >
              Descartar
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">
            Tipo de Trámite
          </label>
          <select
            value={tipoTramite}
            onChange={(e) => setTipoTramite(e.target.value)}
            disabled={!!preloadedData?.tipoTramite}
            className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-neutral-100 disabled:cursor-not-allowed"
          >
            {(['Comercial', 'Operaciones', 'Mercadotecnia', 'Administración', 'Otro'] as const).map(area => {
              const tiposForArea = tiposDb
                .filter(t => t.area === area)
                .filter(t => {
                  if (t.value === 'formulario_cotizacion' || t.value === 'cambio_bancario') return false;
                  if (t.value === 'cotizacion_emision') return !!canAccessRegistroAct;
                  if (isAgent && isCommercialTicketType(t.value)) return false;
                  if (tiposBlockedIds.has(t.id)) return false;
                  return true;
                });
              if (tiposForArea.length === 0) return null;
              return (
                <optgroup key={area} label={area}>
                  {tiposForArea.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
              );
            })}
          </select>
          {(() => {
            const tipoInfo = tiposDb.find(t => t.value === tipoTramite);
            const areaName = tipoInfo?.area || getTipoTramiteArea(tipoTramite);
            const areaCfg = AREA_CONFIG[areaName as keyof typeof AREA_CONFIG] || AREA_CONFIG['Comercial'];
            return (
              <p className="text-xs text-neutral-500 mt-1">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1.5 ${areaCfg.bg} ${areaCfg.color}`}>
                  {areaName}
                </span>
                {tipoInfo?.label || getTipoLabel(tipoTramite)}
              </p>
            );
          })()}
          {/* Aviso: puede crear pero no editar */}
          {tiposReadOnlyAfterCreate.has(tiposDb.find(t => t.value === tipoTramite)?.id ?? '') && (
            <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <span className="mt-0.5 flex-shrink-0">ℹ️</span>
              <span>Podrás crear este trámite, pero no podrás modificar sus campos una vez enviado.</span>
            </div>
          )}
        </div>

        {/* ===== SECCIÓN COTIZACIÓN / EMISIÓN ===== */}
        {tipoTramite === 'cotizacion_emision' && (
          <div className="space-y-4">
            {/* Pipeline de estatus - solo para no-agentes */}
            {!isAgent && (
              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                <label className="block text-xs font-semibold text-neutral-700 mb-3 uppercase tracking-wide">
                  Estatus del Trámite
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {REGISTRO_ACTIVIDAD_ESTATUS.map((est, idx) => {
                    const isActive = ceEstatusNombre === est.nombre;
                    const isPassed = REGISTRO_ACTIVIDAD_ESTATUS.findIndex(e => e.nombre === ceEstatusNombre) > idx;
                    const isLast = idx === REGISTRO_ACTIVIDAD_ESTATUS.length - 1;
                    return (
                      <div key={est.nombre} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCeEstatusNombre(est.nombre)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all duration-200 ${
                            isActive
                              ? 'text-white border-transparent shadow-md scale-105'
                              : isPassed
                              ? 'text-white border-transparent opacity-60'
                              : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400'
                          }`}
                          style={{
                            backgroundColor: (isActive || isPassed) ? est.color : undefined,
                            borderColor: isActive ? est.color : undefined,
                          }}
                        >
                          {(isActive || isPassed) && <CheckCircle2 className="w-3 h-3" />}
                          {est.nombre}
                        </button>
                        {!isLast && <ChevronRight className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
                {isEstatusFinal(ceEstatusNombre) && (
                  <div className="mt-3 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 bg-neutral-100 text-neutral-600">
                    <Lock className="w-3.5 h-3.5" />
                    Este es un estatus final. El trámite quedará cerrado.
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Agente - auto-asignado si es Agente */}
              {isAgent ? (
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 mb-2">
                    <User className="w-4 h-4 inline mr-1.5" />
                    Agente
                  </label>
                  <div className="w-full px-4 py-2.5 bg-neutral-100 border border-neutral-200 rounded-xl text-sm text-neutral-700">
                    {usuario?.nombre_completo || 'Tu'}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 mb-2">
                    <User className="w-4 h-4 inline mr-1.5" />
                    Agente *
                  </label>
                  <select
                    value={ceAgenteUserId}
                    onChange={(e) => setCeAgenteUserId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                  >
                    <option value="">Seleccione...</option>
                    {ceAgenteUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.nombre_completo}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ramo (maestro_ramos, cascada inversa desde aseguradoras) */}
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  <Shield className="w-4 h-4 inline mr-1.5" />
                  Ramo *
                </label>
                <select
                  value={ceRamoId}
                  onChange={(e) => {
                    setCeRamoId(e.target.value);
                    // Cascada inversa: si el ramo cambia, quitar aseguradoras incompatibles
                    if (e.target.value && ceSelectedInsurers.length > 0) {
                      const validIds = new Set(combinaciones.filter(cb => cb.ramo_id === e.target.value).map(cb => cb.compania_id));
                      const validNombres = new Set(catalogoCompanias.filter(c => validIds.has(c.id)).map(c => c.nombre));
                      setCeSelectedInsurers(prev => prev.filter(n => validNombres.has(n)));
                    }
                  }}
                  disabled={ceRamosDisponibles.length === 0}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
                >
                  <option value="">
                    {ceRamosDisponibles.length === 0 ? 'Sin ramos para las aseguradoras seleccionadas' : 'Seleccione ramo...'}
                  </option>
                  {ceRamosDisponibles.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                {ceRamoNombre && (
                  <p className="text-xs text-blue-600 mt-1">Ramo: {ceRamoNombre}</p>
                )}
              </div>
            </div>

            {/* Aseguradoras multiselect — lee de maestro_companias (cascada desde ramo) */}
            <div className="relative" ref={insurerDropdownRef}>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                <Building2 className="w-4 h-4 inline mr-1.5" />
                Aseguradoras * (seleccione una o más)
              </label>
              <div
                className="w-full px-4 py-2.5 text-sm border border-neutral-300 rounded-xl cursor-pointer min-h-[42px]"
                onClick={() => setCeShowInsurerDropdown(!ceShowInsurerDropdown)}
              >
                {ceSelectedInsurers.length === 0
                  ? <span className="text-neutral-400">Seleccione aseguradoras...</span>
                  : <span className="text-neutral-900">{ceSelectedInsurers.join(', ')}</span>
                }
              </div>
              {ceShowInsurerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-300 rounded-xl shadow-lg max-h-48 overflow-auto">
                  <div className="p-2 border-b border-neutral-200">
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={ceInsurerSearchTerm}
                      onChange={(e) => setCeInsurerSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="p-1">
                    {ceCompaniasDisponibles
                      .filter(c => c.nombre.toLowerCase().includes(ceInsurerSearchTerm.toLowerCase()))
                      .map(c => (
                        <label key={c.id} className="flex items-center gap-2 p-1.5 hover:bg-neutral-100 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ceSelectedInsurers.includes(c.nombre)}
                            onChange={() => {
                              setCeSelectedInsurers(prev =>
                                prev.includes(c.nombre) ? prev.filter(x => x !== c.nombre) : [...prev, c.nombre]
                              );
                              // Cascada directa: si cambia aseguradoras y hay un ramo incompatible, limpiar ramo
                              if (ceRamoId) {
                                const newSelected = ceSelectedInsurers.includes(c.nombre)
                                  ? ceSelectedInsurers.filter(x => x !== c.nombre)
                                  : [...ceSelectedInsurers, c.nombre];
                                const newIds = catalogoCompanias.filter(cp => newSelected.includes(cp.nombre)).map(cp => cp.id);
                                const validRamoIds = new Set(combinaciones.filter(cb => newIds.includes(cb.compania_id)).map(cb => cb.ramo_id));
                                if (newSelected.length > 0 && !validRamoIds.has(ceRamoId)) {
                                  setCeRamoId('');
                                }
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-neutral-300"
                          />
                          <span className="text-xs text-neutral-700">{c.nombre}</span>
                        </label>
                      ))}
                    {ceCompaniasDisponibles.length === 0 && (
                      <p className="text-xs text-neutral-400 p-2">
                        {ceRamoId ? 'No hay aseguradoras para el ramo seleccionado' : 'Sin datos en catálogo'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              {/* Fecha de Inicio — auto, solo lectura */}
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1.5" />
                  Fecha de Creación
                </label>
                <div className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-600">
                  {new Date().toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  <span className="ml-2 text-xs text-neutral-400">(se registra al guardar)</span>
                </div>
              </div>
            </div>

            {/* Prioridad dentro del bloque CE - solo para no-agentes */}
            {!isAgent && (
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Prioridad
                </label>
                <select
                  value={prioridad}
                  onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* ===== SECCIÓN TRÁMITES COMERCIALES (Renovaciones/Cobranza/Otros) ===== */}
        {isCommercialTicketType(tipoTramite) && (
          <div className="space-y-4">
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
              <p className="text-xs text-sky-700 font-medium">
                Este trámite se asignará automáticamente a ti ({usuario?.nombre_completo}).
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                <User className="w-4 h-4 inline mr-1.5" />
                Agente Relacionado *
              </label>
              <select
                value={comAgenteUserId}
                onChange={(e) => setComAgenteUserId(e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
              >
                <option value="">Seleccione un agente...</option>
                {ceAgenteUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.nombre_completo}</option>
                ))}
              </select>
            </div>


            {tipoTramite === 'otros_comercial' && (
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Asunto
                </label>
                <input
                  type="text"
                  value={comAsunto}
                  onChange={(e) => setComAsunto(e.target.value)}
                  placeholder="Describe brevemente el asunto del trámite"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
              </div>
            )}

            {tipoTramite === 'correccion_poliza_endoso' && (
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Número de Póliza
                </label>
                <input
                  type="text"
                  value={comPoliza}
                  onChange={(e) => setComPoliza(e.target.value)}
                  placeholder="Ingresa el número de póliza"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                Prioridad
              </label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as 'Alta' | 'Media' | 'Baja')}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
          </div>
        )}

        {tipoTramite === 'correccion_poliza_registrada' && (
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Número de Póliza
            </label>
            <input
              type="text"
              value={polizaNumero}
              onChange={(e) => setPolizaNumero(e.target.value)}
              placeholder="Ingresa el número de póliza"
              className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        )}

        {tipoTramite === 'correccion_comisiones' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                <Package className="w-4 h-4 inline mr-2" />
                Lote de Comisiones *
              </label>
              <select
                value={loteSeleccionado}
                onChange={(e) => setLoteSeleccionado(e.target.value)}
                disabled={!!preloadedData?.comisionesLoteId}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-neutral-100"
              >
                <option value="">Selecciona un lote</option>
                {lotesDisponibles.map(lote => (
                  <option key={lote.id} value={lote.id}>
                    {lote.name} ({lote.documents_count} documentos)
                  </option>
                ))}
              </select>
            </div>

            {loteSeleccionado && (
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Documento del Lote *
                </label>
                {loadingDocumentos ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent mx-auto"></div>
                    <p className="text-sm text-neutral-600 mt-2">Cargando documentos...</p>
                  </div>
                ) : (
                  <select
                    value={documentoSeleccionado}
                    onChange={(e) => setDocumentoSeleccionado(e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Selecciona un documento</option>
                    {documentosLote.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.poliza} - {doc.nombre_asegurado || 'Sin asegurado'} - {doc.aseguradora || 'Sin aseguradora'} - ${doc.importe_base?.toFixed(2) || '0.00'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </>
        )}

        {tipoTramite === 'registro_poliza' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-neutral-900">
                Documentos a Registrar *
              </label>
              <span className="text-xs text-neutral-500">
                {polizaFiles.filter(f => f.file !== null).length} de 10 archivos
              </span>
            </div>

            <div className="space-y-3">
              {polizaFiles.map((pf, index) => (
                <div key={pf.id} className="border border-neutral-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Documento {index + 1}
                    </span>
                    {polizaFiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePolizaFile(pf.id)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Archivo *
                    </label>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        updatePolizaFile(pf.id, 'file', file);
                      }}
                      className="w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    {pf.file && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {pf.file.name}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        Aseguradora *
                      </label>
                      <select
                        value={pf.aseguradora}
                        onChange={(e) => updatePolizaFile(pf.id, 'aseguradora', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">Selecciona...</option>
                        {aseguradoras.map(aseg => (
                          <option key={aseg.nombre} value={aseg.nombre}>
                            {aseg.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Clave de Agente *
                      </label>
                      <input
                        type="text"
                        value={pf.claveAgente}
                        onChange={(e) => updatePolizaFile(pf.id, 'claveAgente', e.target.value)}
                        placeholder="Ej: ABC123"
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {polizaFiles.length < 10 && (
              <button
                type="button"
                onClick={addPolizaFile}
                className="w-full py-2.5 border-2 border-dashed border-neutral-300 rounded-lg text-neutral-600 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Añadir otro documento
              </button>
            )}
          </div>
        )}

        {tipoTramite === 'solicitud_comisiones_pendientes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-neutral-900">
                Comisiones Pendientes
              </label>
              <span className="text-xs text-neutral-500">
                {comisionesPendientes.length} de 10 comisiones
              </span>
            </div>

            <div className="space-y-3">
              {comisionesPendientes.map((comision, index) => (
                <div key={comision.id} className="border border-neutral-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-700">
                      Comisión #{index + 1}
                    </span>
                    {comisionesPendientes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeComisionPendiente(comision.id)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <FileText className="w-4 h-4 inline mr-1" />
                        Número de Póliza
                      </label>
                      <input
                        type="text"
                        value={comision.numeroPoliza}
                        onChange={(e) => updateComisionPendiente(comision.id, 'numeroPoliza', e.target.value)}
                        placeholder="Ej: 12345678"
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        Aseguradora
                      </label>
                      <select
                        value={comision.aseguradora}
                        onChange={(e) => updateComisionPendiente(comision.id, 'aseguradora', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">Selecciona...</option>
                        {aseguradoras.map(aseg => (
                          <option key={aseg.nombre} value={aseg.nombre}>
                            {aseg.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Fecha de Pago
                      </label>
                      <input
                        type="date"
                        value={comision.fechaPago}
                        onChange={(e) => updateComisionPendiente(comision.id, 'fechaPago', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Archivo Adjunto
                      </label>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          updateComisionPendiente(comision.id, 'archivo', file);
                        }}
                        className="w-full text-sm text-neutral-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      />
                      {comision.archivo && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ {comision.archivo.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {comisionesPendientes.length < 10 && (
              <button
                type="button"
                onClick={addComisionPendiente}
                className="w-full py-2.5 border-2 border-dashed border-neutral-300 rounded-lg text-neutral-600 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Añadir otra comisión pendiente
              </button>
            )}
          </div>
        )}

        {/* Campos del formulario — ordenados por display_order, agrupados por sección si el tipo las tiene configuradas */}
        {(() => {
          const camposVisibles = [...camposDinamicos]
            .sort((a, b) => a.display_order - b.display_order)
            .filter(campo => {
              if (!canSeeCampo(campo)) return false;
              // Ocultar área y equipo para Empleado/Agente — se asignan automáticamente
              if (campo.is_sistema && ['area', 'equipo'].includes(campo.sistema_key ?? '') && isEmpleadoOAgente) return false;
              return true;
            });

          const renderCampoConLock = (campo: CampoDinamico) => {
            const rendered = campo.is_sistema ? renderCampoSistema(campo) : renderCampoDinamico(campo);
            if (canEditCampo(campo)) return rendered;
            return (
              <div key={campo.id + '-ro'} className="relative pointer-events-none select-none opacity-60">
                {rendered}
                <div className="absolute top-1 right-1 flex items-center gap-1 text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-md border border-neutral-200">
                  <Lock className="w-2.5 h-2.5" />
                  Solo lectura
                </div>
              </div>
            );
          };

          return agruparCamposPorSeccion(camposVisibles, secciones).map(grupo => {
            if (!grupo.seccion) {
              return <div key="sin-seccion" className="space-y-6">{grupo.campos.map(renderCampoConLock)}</div>;
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
                      if (next.has(seccion.id)) { next.delete(seccion.id); } else { next.add(seccion.id); dispararBadgeExtra(); }
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
                  <div className="px-4 pb-4 space-y-6 border-t border-neutral-100 pt-4">
                    {grupo.campos.map(renderCampoConLock)}
                  </div>
                )}
              </div>
            );
          });
        })()}

        {isEmpleadoOAgente && (
          <p className="text-xs text-neutral-400 text-center pt-2">El área y equipo se asignan automáticamente según tu perfil.</p>
        )}
      </div>
    </BaseModal>
  );
}
