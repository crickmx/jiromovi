import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Save, Eye, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Plantilla {
  id: string;
  asunto: string;
  html_cuerpo: string;
  variables_disponibles: string[];
  tipo_notificacion: {
    id: string;
    nombre: string;
    codigo: string;
  };
}

export function GestionPlantillas() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [selectedPlantilla, setSelectedPlantilla] = useState<Plantilla | null>(null);
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchPlantillas();
  }, []);

  const fetchPlantillas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('correo_plantillas')
        .select(`
          *,
          tipo_notificacion:tipo_notificacion_id (
            id,
            nombre,
            codigo
          )
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlantillas(data || []);
    } catch (error) {
      console.error('Error al cargar plantillas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlantilla = (plantilla: Plantilla) => {
    setSelectedPlantilla(plantilla);
    setAsunto(plantilla.asunto);
    setCuerpo(plantilla.html_cuerpo);
    setShowPreview(false);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!selectedPlantilla) return;

    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from('correo_plantillas')
        .update({
          asunto,
          html_cuerpo: cuerpo,
          ultima_actualizacion: new Date().toISOString(),
          actualizado_por: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', selectedPlantilla.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Plantilla guardada exitosamente' });
      fetchPlantillas();
    } catch (error: any) {
      console.error('Error al guardar:', error);
      setMessage({ type: 'error', text: 'Error al guardar la plantilla' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-neutral-600">Cargando...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de Plantillas */}
      <div className="lg:col-span-1">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">Plantillas Disponibles</h3>
        <div className="space-y-2">
          {plantillas.map((plantilla) => (
            <button
              key={plantilla.id}
              onClick={() => handleSelectPlantilla(plantilla)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selectedPlantilla?.id === plantilla.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-neutral-200 hover:border-neutral-300 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <FileText className={`w-5 h-5 flex-shrink-0 ${
                  selectedPlantilla?.id === plantilla.id ? 'text-primary-600' : 'text-neutral-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-800 truncate">
                    {(plantilla.tipo_notificacion as any)?.nombre || 'Sin nombre'}
                  </p>
                  <p className="text-sm text-neutral-600 truncate">{plantilla.asunto}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="lg:col-span-2">
        {selectedPlantilla ? (
          <div className="space-y-4">
            {message && (
              <div className={`flex items-center gap-2 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-accent-50 text-accent-800 border border-accent-200'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">
                Editar Plantilla: {(selectedPlantilla.tipo_notificacion as any)?.nombre}
              </h3>

              {/* Variables Disponibles */}
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900 mb-2">Variables Disponibles:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPlantilla.variables_disponibles.map((variable) => (
                    <code
                      key={variable}
                      className="px-2 py-1 bg-white rounded text-xs text-blue-700 border border-blue-300"
                    >
                      {variable}
                    </code>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Asunto
                  </label>
                  <input
                    type="text"
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Cuerpo HTML
                  </label>
                  <textarea
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                    rows={15}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>

                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="px-6 py-3 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Eye className="w-5 h-5" />
                    {showPreview ? 'Ocultar' : 'Vista Previa'}
                  </button>
                </div>
              </div>

              {/* Vista Previa */}
              {showPreview && (
                <div className="mt-6 p-6 bg-white rounded-lg border-2 border-neutral-200">
                  <h4 className="font-semibold text-neutral-800 mb-2">Asunto: {asunto}</h4>
                  <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: cuerpo }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96 text-neutral-500">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Selecciona una plantilla para editar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
