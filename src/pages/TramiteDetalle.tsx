import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Circle as XCircle, RefreshCw, Save, ChevronDown, CircleAlert as AlertCircle, ClipboardList } from 'lucide-react';
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

  // Campos dinámicos del catálogo
  interface CampoDinamicoOpt { label: string; slug: string; clasificacion?: string | null }
  interface CampoDinamico {
    id: string; key: string; label: string; tipo: string;
    requerido: boolean; ayuda: string | null;
    config: { opciones?: CampoDinamicoOpt[]; max_length?: number; es_entero?: boolean; min_fecha?: string; max_fecha?: string };
  }
  interface RespuestaDinamica { id?: string; campo_id: string; valor_texto: string | null; valor_numerico: number | null; valor_fecha: string | null; valor_booleano: boolean | null; valor_json: any }
  const [camposDinamicos, setCamposDinamicos] = useState<CampoDinamico[]>([]);
  const [respuestasDinamicas, setRespuestasDinamicas] = useState<Record<string, any>>({});
  const [respuestasOriginales, setRespuestasOriginales] = useState<RespuestaDinamica[]>([]);
  const [fechaPromesaEntrega, setFechaPromesaEntrega] = useState('');

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isEmpleado = usuario?.rol === 'Empleado';
  const isOwner = tramite?.creado_por === usuario?.id;
  const isAssigned = tramite?.assigned_to_user_id === usuario?.id;

  const OPERATIONAL_TYPES = ['correccion_comisiones', 'correccion_poliza_registrada'];
  const isOperationalTicket = tramite ? OPERATIONAL_TYPES.includes(tramite.tipo_tramite) : false;
  const isCommercialViewerOnly = userArea === 'Comercial' && isOperationalTicket && !isAdmin && !isOwner && !isAssigned;

  const canEdit = (isAdmin || isGerente || isEmpleado || isOwner || isAssigned) && !isCommercialViewerOnly;
  const canEditFechaPromesa = isAdmin || isGerente || myTeamRole === 'lider';
  const canManageAssignment = isAdmin || myTeamRole === 'lider';
  const claimedRef = useRef(false);
  const isCerrado = tramite?.cerrado_en !== null;

  const isDirty = !!tramite && (
    selectedEstatus !== (tramite.estatus?.id ?? tramite.estatus_id) ||
    selectedPrioridad !== tramite.prioridad ||
    fechaPromesaEntrega !== (tramite.fecha_promesa_entrega || '')
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
      .select('id, key, label, tipo, requerido, ayuda, config')
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
        if (['texto_corto', 'texto_largo'].includes(campo.tipo)) vals[campo.id] = r.valor_texto;
        else if (campo.tipo === 'numerico') vals[campo.id] = r.valor_numerico;
        else if (campo.tipo === 'fecha') vals[campo.id] = r.valor_fecha;
        else if (campo.tipo === 'booleano') vals[campo.id] = r.valor_booleano;
        else vals[campo.id] = r.valor_json;
      }
      setRespuestasDinamicas(vals);
    }
  };

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

  const TIPO_TRAMITE_CATEGORIA: Record<string, string> = {
    cotizacion_emision: 'cotizacion_emision',
    correccion_poliza_registrada: 'general',
    correccion_comisiones: 'general',
    registro_poliza: 'general',
    lead_registro_movi: 'general',
    solicitud_comisiones_pendientes: 'solicitud_comisiones',
    cambio_bancario: 'cambio_bancario',
    cancelacion_poliza: 'general',
    renovaciones: 'general',
    cobranza: 'general',
    otros_comercial: 'general',
    formulario_cotizacion: 'cotizacion_emision',
  };

  const loadEstatus = async (tipoTramite?: string) => {
    const { data } = await supabase
      .from('ticket_estatus')
      .select('*')
      .eq('activo', true)
      .order('orden');

    if (data) {
      const categoria = tipoTramite ? (TIPO_TRAMITE_CATEGORIA[tipoTramite] ?? tipoTramite) : null;
      let filtered = categoria
        ? data.filter((e: any) =>
            !e.tipo_aplicable || e.tipo_aplicable.includes(categoria)
          )
        : data;

      // Para cotizacion_emision, "Cerrado" no es seleccionable manualmente
      // el cierre ocurre al elegir Emitido (Ganado) o No Emitido (Perdido)
      if (tipoTramite === 'cotizacion_emision') {
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

    return {
      estatus_id: estatusId,
      prioridad: selectedPrioridad,
      modificado_por: usuario!.id,
      fecha_promesa_entrega: fechaPromesaEntrega || null,
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
            valor_texto:    ['texto_corto', 'texto_largo'].includes(campo.tipo) ? String(val) : null,
            valor_numerico: campo.tipo === 'numerico' ? Number(val) : null,
            valor_fecha:    campo.tipo === 'fecha' ? String(val) : null,
            valor_booleano: campo.tipo === 'booleano' ? Boolean(val) : null,
            valor_json:     ['estatus', 'dropdown', 'seleccion_multiple'].includes(campo.tipo) ? val : null,
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
      const { error } = await supabase
        .from('tickets')
        .update({
          estatus_id: estatusId,
          cerrado_en: new Date().toISOString(),
          cerrado_por: usuario.id,
          modificado_por: usuario.id
        })
        .eq('id', tramite.id);

      if (error) {
        console.error('Error al cerrar tramite:', error);
        throw error;
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
              {tramite.estatus && (
                <span
                  className="px-3 py-1 rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: tramite.estatus.color + '20',
                    color: tramite.estatus.color,
                    borderColor: tramite.estatus.color,
                    borderWidth: '1px'
                  }}
                >
                  {tramite.estatus.nombre}
                </span>
              )}
              {isCerrado && (
                <span className="text-sm text-neutral-500 dark:text-white/50">
                  Cerrado el {new Date(tramite.cerrado_en!).toLocaleDateString('es-MX')}
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
                  <div className="relative" ref={cerrarMenuRef}>
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
                  </div>
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


        {isCommercialViewerOnly && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Visualizacion de solo lectura. Puedes agregar comentarios pero no editar este tramite.
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
              grupoAsignadoId={tramite.grupo_asignado_id}
              onResponsableChange={handleResponsableChange}
              onEquipoChange={handleEquipoChange}
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

            {/* Campos dinámicos del catálogo */}
            {camposDinamicos.length > 0 && (
              <div className="mt-6 pt-6 border-t border-neutral-100 space-y-4">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Campos del trámite</p>
                {camposDinamicos.map(campo => {
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
