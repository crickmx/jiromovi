import { useState, useEffect } from 'react';
import { Eye, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function VistaPreviaFirma() {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [selectedUsuario, setSelectedUsuario] = useState('');
  const [firmaHtml, setFirmaHtml] = useState('');
  const [firmaInfo, setFirmaInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    loadUsuarios();
    if (usuario) {
      setSelectedUsuario(usuario.id);
    }
  }, [usuario]);

  useEffect(() => {
    if (selectedUsuario) {
      loadPreview();
    }
  }, [selectedUsuario]);

  const loadUsuarios = async () => {
    console.log('[VistaPreviaFirma] Cargando usuarios...');
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos, rol, puesto')
      .eq('activo', true)
      .order('nombre');

    if (error) {
      console.error('[VistaPreviaFirma] Error cargando usuarios:', error);
    } else {
      console.log('[VistaPreviaFirma] Usuarios cargados:', data?.length);
      setUsuarios(data || []);
    }
  };

  const loadPreview = async () => {
    if (!selectedUsuario) {
      console.log('[VistaPreviaFirma] No hay usuario seleccionado');
      return;
    }

    setLoading(true);
    setError('');
    setFirmaHtml('');
    setFirmaInfo(null);
    setDebugInfo(null);

    console.log('[VistaPreviaFirma] Cargando firma para usuario:', selectedUsuario);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No hay sesión activa');
      }

      console.log('[VistaPreviaFirma] Llamando a render-firma...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-firma`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            usuarioId: selectedUsuario
          })
        }
      );

      console.log('[VistaPreviaFirma] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VistaPreviaFirma] Error response:', errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[VistaPreviaFirma] Result:', result);

      if (result.success && result.html) {
        console.log('[VistaPreviaFirma] Firma renderizada correctamente');
        setFirmaHtml(result.html);
        setFirmaInfo(result.info);
        setDebugInfo(result.data);
        setError('');
      } else if (result.error) {
        console.error('[VistaPreviaFirma] Error en resultado:', result.error);
        setError(result.error);
        setFirmaHtml('');
        setFirmaInfo(null);
      } else {
        console.warn('[VistaPreviaFirma] No hay firma asignada');
        setError('No hay firma asignada para este usuario');
        setFirmaHtml('');
        setFirmaInfo(null);
      }
    } catch (err: any) {
      console.error('[VistaPreviaFirma] Error cargando vista previa:', err);
      setError(err.message || 'Error desconocido al cargar la firma');
      setFirmaHtml('');
      setFirmaInfo(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Vista Previa de Firma</h2>
        <p className="text-neutral-600">
          Selecciona un usuario para ver cómo se renderizará su firma con sus datos reales.
        </p>
      </div>

      <div className="flex items-end space-x-4">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Seleccionar Usuario
          </label>
          <select
            value={selectedUsuario}
            onChange={(e) => setSelectedUsuario(e.target.value)}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Seleccionar usuario --</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.apellidos} - {u.puesto || u.rol}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadPreview}
          disabled={!selectedUsuario || loading}
          className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
          <span>{loading ? 'Cargando...' : 'Actualizar Vista Previa'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-1">Error</h4>
              <p className="text-sm text-red-800">{error}</p>
              {error.includes('No hay firma asignada') && (
                <div className="mt-3 text-sm text-red-700">
                  <p className="font-semibold mb-2">Para resolver este problema:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Ve a la pestaña "Plantillas" y verifica que existe al menos una plantilla activa</li>
                    <li>Ve a la pestaña "Asignaciones" y asigna una firma global o específica para este usuario</li>
                    <li>Vuelve aquí y haz clic en "Actualizar Vista Previa"</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {firmaInfo && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 mb-2">Firma Asignada Correctamente</h4>
              <div className="text-sm text-green-800 space-y-1">
                <div><strong>Plantilla:</strong> {firmaInfo.template_nombre}</div>
                <div>
                  <strong>Tipo de asignación:</strong>{' '}
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    firmaInfo.tipo_asignacion === 'usuario' ? 'bg-primary-200 text-primary-800' :
                    firmaInfo.tipo_asignacion === 'rol' ? 'bg-green-200 text-green-800' :
                    firmaInfo.tipo_asignacion === 'oficina' ? 'bg-purple-200 text-purple-800' :
                    'bg-neutral-200 text-neutral-800'
                  }`}>
                    {firmaInfo.tipo_asignacion}
                  </span>
                </div>
                {firmaInfo.prioridad !== undefined && (
                  <div><strong>Prioridad:</strong> {firmaInfo.prioridad}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {debugInfo && (
        <details className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <summary className="cursor-pointer font-semibold text-primary-900 flex items-center space-x-2">
            <Info className="w-5 h-5" />
            <span>Ver datos del usuario (para debugging)</span>
          </summary>
          <div className="mt-3 text-sm text-primary-800 font-mono">
            <pre className="whitespace-pre-wrap bg-white p-3 rounded border border-primary-200 overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </details>
      )}

      {firmaHtml && (
        <div className="border-2 border-neutral-300 rounded-xl overflow-hidden bg-white">
          <div className="bg-neutral-100 px-6 py-3 border-b border-neutral-300">
            <h3 className="text-lg font-bold text-neutral-900">Vista Previa Renderizada</h3>
          </div>
          <div className="p-6">
            <div className="border border-neutral-200 rounded-lg p-6 bg-neutral-50">
              <div dangerouslySetInnerHTML={{ __html: firmaHtml }} />
            </div>
          </div>
        </div>
      )}

      {!firmaHtml && !error && !loading && selectedUsuario && (
        <div className="text-center py-12 border-2 border-dashed border-neutral-300 rounded-lg">
          <Eye className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-600 mb-2">Haz clic en "Actualizar Vista Previa" para ver la firma</p>
          <p className="text-sm text-neutral-500">Se mostrará con los datos reales del usuario seleccionado</p>
        </div>
      )}

      {!selectedUsuario && !loading && (
        <div className="text-center py-12 border-2 border-dashed border-neutral-300 rounded-lg">
          <Eye className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-600">Selecciona un usuario para ver su firma</p>
        </div>
      )}
    </div>
  );
}
