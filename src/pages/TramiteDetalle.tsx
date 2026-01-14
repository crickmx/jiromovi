import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Edit2, XCircle, RefreshCw, Save } from 'lucide-react';
import { TramiteDetalles } from '../components/tramites/TramiteDetalles';
import { TramiteComentarios } from '../components/tramites/TramiteComentarios';
import { TramiteArchivos } from '../components/tramites/TramiteArchivos';
import { TramiteHistorial } from '../components/tramites/TramiteHistorial';
import { ComisionesPendientes } from '../components/tramites/ComisionesPendientes';

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
  agente: Usuario | null;
  estatus: TramiteEstatus | null;
  creado_por_usuario: Usuario | null;
  modificado_por_usuario: Usuario | null;
  cerrado_por_usuario: Usuario | null;
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

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const canEdit = isAdmin || isGerente;
  const isCerrado = tramite?.cerrado_en !== null;

  useEffect(() => {
    if (id) {
      loadTramite();
      loadEstatus();

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

    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        agente:agente_id(id, nombre_completo),
        estatus:estatus_id(*),
        creado_por_usuario:creado_por(id, nombre_completo),
        modificado_por_usuario:modificado_por(id, nombre_completo),
        cerrado_por_usuario:cerrado_por(id, nombre_completo)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error loading tramite:', error);
      navigate('/tramites');
      return;
    }

    if (data) {
      setTramite(data as TramiteData);
      setSelectedEstatus(data.estatus_id);
      setSelectedPrioridad(data.prioridad);
      setLoading(false);
    }
  };

  const loadEstatus = async () => {
    const { data } = await supabase
      .from('ticket_estatus')
      .select('*')
      .eq('activo', true)
      .order('orden');

    if (data) setEstatusList(data);
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
        .update({
          estatus_id: selectedEstatus,
          prioridad: selectedPrioridad,
          modificado_por: usuario.id
        })
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
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
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
                    onClick={() => setEditing(true)}
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
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all font-semibold disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                  </>
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
          <h1 className="text-3xl font-display font-bold text-primary-600 mb-2">
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
                  ? 'text-primary-600 border-b-2 border-primary-600'
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
                  ? 'text-primary-600 border-b-2 border-primary-600'
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
          />
        )}
        {activeTab === 'comentarios' && <TramiteComentarios tramiteId={tramite.id} />}
        {activeTab === 'archivos' && <TramiteArchivos tramiteId={tramite.id} />}
        {activeTab === 'historial' && <TramiteHistorial tramiteId={tramite.id} />}
        {activeTab === 'comisiones' && <ComisionesPendientes tramiteId={tramite.id} />}
      </div>
    </div>
  );
}
