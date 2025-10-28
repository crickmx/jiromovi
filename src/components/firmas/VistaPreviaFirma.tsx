import { useState, useEffect } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function VistaPreviaFirma() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [selectedUsuario, setSelectedUsuario] = useState('');
  const [firmaHtml, setFirmaHtml] = useState('');
  const [firmaInfo, setFirmaInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, rol, puesto')
      .order('nombre');

    if (data) setUsuarios(data);
  };

  const loadPreview = async () => {
    if (!selectedUsuario) return;

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/render-firma`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            usuarioId: selectedUsuario
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        setFirmaHtml(result.html);
        setFirmaInfo(result.info);
      } else {
        setFirmaHtml('');
        setFirmaInfo(null);
      }
    } catch (error) {
      console.error('Error cargando vista previa:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900 mb-4">Vista Previa de Firma</h2>
        <p className="text-neutral-600 mb-6">
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
                {u.nombre} - {u.puesto || u.rol}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadPreview}
          disabled={!selectedUsuario || loading}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
          <span>{loading ? 'Cargando...' : 'Ver Preview'}</span>
        </button>
      </div>

      {firmaInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Información de Asignación:</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <div><strong>Plantilla:</strong> {firmaInfo.template_nombre}</div>
            <div><strong>Tipo de asignación:</strong> {firmaInfo.tipo_asignacion}</div>
            {firmaInfo.prioridad !== undefined && (
              <div><strong>Prioridad:</strong> {firmaInfo.prioridad}</div>
            )}
          </div>
        </div>
      )}

      {firmaHtml && (
        <div className="border-2 border-neutral-300 rounded-xl p-6 bg-white">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Vista Previa Renderizada:</h3>
          <div className="border border-neutral-200 rounded-lg p-6 bg-neutral-50">
            <div dangerouslySetInnerHTML={{ __html: firmaHtml }} />
          </div>
        </div>
      )}

      {!firmaHtml && selectedUsuario && !loading && (
        <div className="text-center py-12 text-neutral-500">
          Selecciona un usuario y haz clic en "Ver Preview" para visualizar su firma
        </div>
      )}
    </div>
  );
}
