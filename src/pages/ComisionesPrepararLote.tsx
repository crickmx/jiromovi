import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Users, UserX, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AsignarVendedorStagingModal from '../components/comisiones/AsignarVendedorStagingModal';

interface VendorGroup {
  vendor_key: string;
  vendor_name_raw: string;
  vendor_name_norm: string;
  items_count: number;
  total_comision: number;
  movi_user_id: string | null;
  movi_user_name: string | null;
  pending_assignment: boolean;
}

interface StagingSession {
  id: string;
  file_name: string;
  total_items: number;
  recognized_count: number;
  pending_assignment_count: number;
  status: string;
}

export default function ComisionesPrepararLote() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<StagingSession | null>(null);
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<VendorGroup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId]);

  const loadSessionData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('commission_staging_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error('Sesión no encontrada');

      setSession(sessionData);

      const { data: items, error: itemsError } = await supabase
        .from('commission_items_staging')
        .select(`
          *,
          usuarios:movi_user_id(id, nombre_completo)
        `)
        .eq('staging_session_id', sessionId)
        .order('vendor_key');

      if (itemsError) throw itemsError;

      const groupsMap = new Map<string, VendorGroup>();

      items?.forEach(item => {
        const key = item.vendor_key;

        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            vendor_key: key,
            vendor_name_raw: item.vendor_name_raw || '',
            vendor_name_norm: item.vendor_name_norm || '',
            items_count: 0,
            total_comision: 0,
            movi_user_id: item.movi_user_id,
            movi_user_name: item.usuarios?.nombre_completo || null,
            pending_assignment: item.pending_assignment,
          });
        }

        const group = groupsMap.get(key)!;
        group.items_count += 1;
        group.total_comision += (item.prima_neta * item.porcentaje_base / 100) || 0;
      });

      const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
        if (a.pending_assignment !== b.pending_assignment) {
          return a.pending_assignment ? 1 : -1;
        }
        return b.items_count - a.items_count;
      });

      setVendorGroups(sortedGroups);
    } catch (error: any) {
      console.error('Error loading session data:', error);
      setError(error.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleAsignarVendedor = async (vendorKey: string, moviUserId: string) => {
    try {
      const { error } = await supabase
        .from('commission_items_staging')
        .update({
          movi_user_id: moviUserId,
          pending_assignment: false,
          match_method: 'manual',
        })
        .eq('staging_session_id', sessionId)
        .eq('vendor_key', vendorKey);

      if (error) throw error;

      const normalizedName = vendorKey.replace('name:', '');

      // Verificar si ya existe un mapeo activo para este source
      const { data: existingMapping } = await supabase
        .from('vendor_mappings')
        .select('id, movi_user_id')
        .eq('source_type', 'name')
        .eq('source_value', normalizedName)
        .eq('status', 'active')
        .maybeSingle();

      if (existingMapping) {
        // Actualizar el mapeo existente
        const { error: updateError } = await supabase
          .from('vendor_mappings')
          .update({
            movi_user_id: moviUserId,
            updated_by: usuario?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingMapping.id);

        if (updateError) {
          console.error('Error updating persistent mapping:', updateError);
          throw updateError;
        }
      } else {
        // Crear nuevo mapeo
        const { error: insertError } = await supabase
          .from('vendor_mappings')
          .insert({
            source_type: 'name',
            source_value: normalizedName,
            movi_user_id: moviUserId,
            status: 'active',
            created_by: usuario?.id,
          });

        if (insertError) {
          console.error('Error creating persistent mapping:', insertError);
          throw insertError;
        }
      }

      await supabase.rpc('recalculate_staging_session_counters', {
        session_id: sessionId
      });

      loadSessionData();
      setSelectedVendor(null);
    } catch (error: any) {
      console.error('Error assigning vendor:', error);
      alert('Error al asignar vendedor: ' + error.message);
    }
  };

  const handleCrearLotes = async () => {
    if (!session) return;

    if (session.pending_assignment_count > 0) {
      const confirmed = window.confirm(
        `Hay ${session.pending_assignment_count} vendedores sin asignar. ¿Deseas crear lotes solo con los vendedores reconocidos? Los pendientes quedarán en staging para asignar después.`
      );
      if (!confirmed) return;
    }

    setCreating(true);
    setError(null);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) throw new Error('No autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-weekly-batches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authSession.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stagingSessionId: sessionId
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear lotes');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al crear lotes');
      }

      alert(`Lotes creados exitosamente: ${result.batchesCreated.length} lotes con ${result.summary.total_items_converted} documentos`);
      navigate('/comisiones');
    } catch (error: any) {
      console.error('Error creating batches:', error);
      setError(error.message || 'Error al crear lotes');
    } finally {
      setCreating(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-soft p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-neutral-600 mb-6">
            Solo los administradores pueden acceder a esta sección.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors font-semibold"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-soft p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Sesión no encontrada
          </h2>
          <button
            onClick={() => navigate('/comisiones/upload-nuevo')}
            className="px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors font-semibold"
          >
            Volver a cargar archivo
          </button>
        </div>
      </div>
    );
  }

  const recognizedGroups = vendorGroups.filter(g => !g.pending_assignment);
  const pendingGroups = vendorGroups.filter(g => g.pending_assignment);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/comisiones/upload-nuevo')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-neutral-700" />
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold text-accent mb-1">
                Preparar Lote
              </h1>
              <p className="text-neutral-600">
                {session.file_name}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-1">Error</h4>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
            <div className="text-3xl font-bold text-primary-700 mb-1">
              {session.total_items}
            </div>
            <div className="text-sm text-primary-800">
              Total de documentos
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center space-x-2 mb-1">
              <Users className="w-5 h-5 text-green-600" />
              <div className="text-3xl font-bold text-green-700">
                {session.recognized_count}
              </div>
            </div>
            <div className="text-sm text-green-800">
              Documentos reconocidos
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center space-x-2 mb-1">
              <UserX className="w-5 h-5 text-orange-600" />
              <div className="text-3xl font-bold text-orange-700">
                {session.pending_assignment_count}
              </div>
            </div>
            <div className="text-sm text-orange-800">
              Pendientes de asignar
            </div>
          </div>
        </div>

        {recognizedGroups.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-neutral-900 mb-4 flex items-center space-x-2">
              <Users className="w-6 h-6 text-green-600" />
              <span>Vendedores Reconocidos ({recognizedGroups.length})</span>
            </h2>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-green-800">
                Los siguientes vendedores fueron reconocidos automáticamente.
                Puedes cambiar la asignación si es necesario.
              </p>
            </div>
            <div className="space-y-2">
              {recognizedGroups.map(group => (
                <div
                  key={group.vendor_key}
                  className="bg-green-50 border border-green-200 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <div className="font-semibold text-neutral-900">
                          {group.vendor_name_raw}
                        </div>
                        <div className="text-sm text-neutral-600">
                          Asignado a: {group.movi_user_name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-lg font-bold text-neutral-900">
                          {group.items_count} documentos
                        </div>
                        <div className="text-sm text-neutral-600">
                          ${group.total_comision.toFixed(2)}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedVendor(group)}
                        className="px-4 py-2 bg-white text-neutral-700 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors font-semibold"
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingGroups.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-neutral-900 mb-4 flex items-center space-x-2">
              <UserX className="w-6 h-6 text-orange-600" />
              <span>Vendedores Sin Asignar ({pendingGroups.length})</span>
            </h2>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-orange-800">
                Los siguientes vendedores no pudieron ser reconocidos automáticamente.
                Haz clic en "Asignar" para vincularlos a un usuario.
              </p>
            </div>
            <div className="space-y-2">
              {pendingGroups.map(group => (
                <div
                  key={group.vendor_key}
                  className="bg-white border border-orange-200 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                      <div>
                        <div className="font-semibold text-neutral-900">
                          {group.vendor_name_raw}
                        </div>
                        <div className="text-sm text-neutral-600">
                          Sin asignar
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-lg font-bold text-neutral-900">
                          {group.items_count} documentos
                        </div>
                        <div className="text-sm text-neutral-600">
                          ${group.total_comision.toFixed(2)}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedVendor(group)}
                        className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-semibold"
                      >
                        Asignar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-6 border-t border-neutral-200">
          <button
            onClick={handleCrearLotes}
            disabled={creating || session.recognized_count === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {creating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Creando lotes...</span>
              </>
            ) : (
              <span>Crear Lotes Semanales</span>
            )}
          </button>
        </div>
      </div>

      {selectedVendor && (
        <AsignarVendedorStagingModal
          vendorName={selectedVendor.vendor_name_raw}
          onClose={() => setSelectedVendor(null)}
          onAssign={(userId) => handleAsignarVendedor(selectedVendor.vendor_key, userId)}
        />
      )}
    </div>
  );
}
