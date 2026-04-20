import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CreditCard as Edit2, XCircle, RefreshCw, Save } from 'lucide-react';
import { TramiteDetalles } from '../components/tramites/TramiteDetalles';
import { TramiteComentarios } from '../components/tramites/TramiteComentarios';
import { TramiteArchivos } from '../components/tramites/TramiteArchivos';
import { TramiteHistorial } from '../components/tramites/TramiteHistorial';
import { ComisionesPendientes } from '../components/tramites/ComisionesPendientes';
import { RegistroActividadForm } from '../components/tramites/RegistroActividadForm';

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
  estatus_id: string;
  agente: Usuario | null;
  responsable: Usuario | null;
  estatus: TramiteEstatus | null;
  creado_por_usuario: Usuario | null;
  modificado_por_usuario: Usuario | null;
  cerrado_por_usuario: Usuario | null;
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
}

export function TramiteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [tramite, setTramite] = useState<TramiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'detalles' | 'comentarios' | 'archivos' | 'historial' | 'comisiones'>('detalles');

  const [editing, setEditing] = useState(false);
  const [estatusList, setEstatusList] = useState<TramiteEstatus[]>([]);
  const [selectedEstatus, setSelectedEstatus] = useState('');
  const [selectedPrioridad, setSelectedPrioridad] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isOwner = tramite?.creado_por === usuario?.id;
  const isAssigned = tramite?.assigned_to_user_id === usuario?.id;
  const canEdit = isAdmin || isGerente || isOwner || isAssigned;
  const canEditQuick = (isAdmin || isOwner) && !editing;
  const isCerrado = tramite?.cerrado_en !== null;

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
    if (ticketData.tipo_tramite === 'registro_actividad' || ticketData.tipo_tramite === 'cotizacion_emision') {
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
    setLoading(false);
    await loadEstatus(ticketData.tipo_tramite);
  };

  const TIPO_TRAMITE_CATEGORIA: Record<string, string> = {
    cotizacion_emision: 'cotizacion_emision',
    correccion_poliza_registrada: 'general',
    correccion_comisiones: 'general',
    registro_poliza: 'general',
    lead_registro_movi: 'general',
    solicitud_comisiones_pendientes: 'solicitud_comisiones',
    cambio_bancario: 'cambio_bancario',
    registro_actividad: 'registro_actividad',
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
      ...(esFinalCotizacion && !tramite?.cerrado_en
        ? { cerrado_en: new Date().toISOString(), cerrado_por: usuario!.id }
        : {}),
    };
  };

  const handleSave = async () => {
    if (!tramite || !usuario) return;

    setSaving(true);

    const newEstatus = estatusList.find(e => e.id === selectedEstatus);
    setTramite(prev => prev ? {
      ...prev,
      prioridad: selectedPrioridad,
      estatus: newEstatus || prev.estatus
    } : null);
    setEditing(false);

    try {
      const { error } = await supabase
        .from('tickets')
        .update(buildUpdatePayload(selectedEstatus))
        .eq('id', tramite.id);

      if (error) throw error;

      await loadTramite();
    } catch (err: any) {
      console.error('Error updating tramite:', err);
      alert('Error al actualizar el tramite');
      await loadTramite();
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSave = async () => {
    if (!tramite || !usuario) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
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

        await loadTramite();
      } catch (err: any) {
        console.error('Error updating tramite:', err);
        alert('Error al actualizar el tramite');
        await loadTramite();
      } finally {
        setSaving(false);
      }
    }, 500);
  };

  const handleCerrar = async () => {
    if (!tramite || !usuario) return;
    if (!confirm('¿Estás seguro de cerrar este tramite?')) return;

    setSaving(true);
    try {
      const estatusCerrado = estatusList.find(e => e.nombre === 'Cerrado');
      if (!estatusCerrado) {
        alert('No se encontró el estatus "Cerrado". Verifica la configuración.');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('tickets')
        .update({
          estatus_id: estatusCerrado.id,
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
      alert('Tramite cerrado exitosamente');
      navigate('/tramites');
    } catch (err: any) {
      console.error('Error closing tramite:', err);
      alert(`Error al cerrar el tramite: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReabrir = async () => {
    if (!tramite || !usuario) return;
    if (!confirm('¿Estás seguro de reabrir este tramite?')) return;

    setSaving(true);
    try {
      const estatusEnProceso = estatusList.find(e => e.nombre === 'En proceso');
      if (!estatusEnProceso) {
        alert('No se encontró el estatus "En proceso". Verifica la configuración.');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('tickets')
        .update({
          estatus_id: estatusEnProceso.id,
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
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/tramites')}
            className="flex items-center space-x-2 text-neutral-600 hover:text-neutral-900 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Volver a Tramites</span>
          </button>

          <div className="flex items-center space-x-2">
            {canEdit && !isCerrado && (
              <>
                {!editing ? (
                  <button
                    onClick={() => {
                      setEditing(true);
                      setSelectedEstatus(tramite.estatus?.id || '');
                      setSelectedPrioridad(tramite.prioridad);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-all font-semibold"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Editar</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setSelectedEstatus(tramite.estatus?.id || '');
                        setSelectedPrioridad(tramite.prioridad);
                      }}
                      className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-all font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center space-x-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl transition-all font-semibold disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                  </>
                )}
                {tramite.tipo_tramite === 'registro_actividad' && (
                  <button
                    onClick={() => setShowEditForm(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-semibold"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Editar Formulario Completo</span>
                  </button>
                )}
                <button
                  onClick={handleCerrar}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-semibold disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cerrar Tramite</span>
                </button>
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
        </div>

        <div>
          <h1 className="text-3xl font-display font-bold text-accent mb-2">
            Tramite {tramite.folio}
          </h1>
          <div className="flex items-center space-x-3">
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
              <span className="text-sm text-neutral-500">
                Cerrado el {new Date(tramite.cerrado_en!).toLocaleDateString('es-MX')}
              </span>
            )}
          </div>
        </div>

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
          <TramiteDetalles
            tramite={tramite}
            editing={editing}
            estatusList={estatusList}
            selectedEstatus={selectedEstatus}
            setSelectedEstatus={setSelectedEstatus}
            selectedPrioridad={selectedPrioridad}
            setSelectedPrioridad={setSelectedPrioridad}
            canEditQuick={canEditQuick}
            onQuickSave={handleQuickSave}
          />
        )}
        {activeTab === 'comentarios' && <TramiteComentarios tramiteId={tramite.id} />}
        {activeTab === 'archivos' && <TramiteArchivos tramiteId={tramite.id} />}
        {activeTab === 'historial' && <TramiteHistorial tramiteId={tramite.id} />}
        {activeTab === 'comisiones' && <ComisionesPendientes tramiteId={tramite.id} />}
      </div>

      {/* Formulario de edición para Registro de Actividades */}
      {showEditForm && tramite.tipo_tramite === 'registro_actividad' && (
        <RegistroActividadForm
          tramiteId={tramite.id}
          initialData={{
            activity_subtype_id: tramite.activity_subtype_id || undefined,
            agente_usuario_id: tramite.agente_usuario_id || undefined,
            insurance_type_id: tramite.insurance_type_id || undefined,
            insurers: tramite.insurers && Array.isArray(tramite.insurers) ? tramite.insurers : undefined,
            attending_user_id: tramite.attending_user_id || undefined,
            request_datetime: tramite.request_datetime || undefined,
            completion_datetime: tramite.completion_datetime || undefined,
            estatus_nombre: tramite.estatus?.nombre || undefined,
            cerrado: tramite.cerrado || false,
            prioridad: tramite.prioridad,
            instrucciones: tramite.instrucciones || ''
          }}
          onClose={() => setShowEditForm(false)}
          onSuccess={async () => {
            await loadTramite();
            setShowEditForm(false);
          }}
        />
      )}
    </div>
  );
}
