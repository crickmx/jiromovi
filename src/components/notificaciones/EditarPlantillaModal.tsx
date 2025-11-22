import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Mail, MessageCircle, AlertCircle, Save } from 'lucide-react';

interface Plantilla {
  id: string;
  tipo_notificacion_id: string;
  asunto: string;
  html_cuerpo: string;
  whatsapp_plantilla: string | null;
  variables_disponibles: string[] | null;
  whatsapp_variables_disponibles: string[] | null;
}

interface EditarPlantillaModalProps {
  tipoId: string;
  tipoNombre: string;
  onClose: () => void;
  onSave: () => void;
}

export function EditarPlantillaModal({ tipoId, tipoNombre, onClose, onSave }: EditarPlantillaModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null);
  const [asunto, setAsunto] = useState('');
  const [cuerpoEmail, setCuerpoEmail] = useState('');
  const [mensajeWhatsApp, setMensajeWhatsApp] = useState('');
  const [previewTab, setPreviewTab] = useState<'email' | 'whatsapp'>('email');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchPlantilla();
  }, [tipoId]);

  const fetchPlantilla = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('correo_plantillas')
        .select('*')
        .eq('tipo_notificacion_id', tipoId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPlantilla(data);
        setAsunto(data.asunto || '');
        setCuerpoEmail(data.html_cuerpo || '');
        setMensajeWhatsApp(data.whatsapp_plantilla || '');
      }
    } catch (error: any) {
      console.error('Error al cargar plantilla:', error);
      setMessage({ type: 'error', text: 'Error al cargar la plantilla' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      if (!asunto.trim()) {
        setMessage({ type: 'error', text: 'El asunto es requerido' });
        return;
      }

      if (!cuerpoEmail.trim() && !mensajeWhatsApp.trim()) {
        setMessage({ type: 'error', text: 'Debes completar al menos una plantilla (email o WhatsApp)' });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (plantilla) {
        // Actualizar plantilla existente
        const { error } = await supabase
          .from('correo_plantillas')
          .update({
            asunto: asunto.trim(),
            html_cuerpo: cuerpoEmail.trim(),
            whatsapp_plantilla: mensajeWhatsApp.trim() || null,
            actualizado_por: user?.id,
            ultima_actualizacion: new Date().toISOString()
          })
          .eq('id', plantilla.id);

        if (error) throw error;
      } else {
        // Crear nueva plantilla
        const { error } = await supabase
          .from('correo_plantillas')
          .insert({
            tipo_notificacion_id: tipoId,
            asunto: asunto.trim(),
            html_cuerpo: cuerpoEmail.trim(),
            whatsapp_plantilla: mensajeWhatsApp.trim() || null,
            es_plantilla_default: true,
            actualizado_por: user?.id,
            ultima_actualizacion: new Date().toISOString()
          });

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Plantilla guardada exitosamente' });
      
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error al guardar plantilla:', error);
      setMessage({ type: 'error', text: 'Error al guardar la plantilla: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable: string, tipo: 'email' | 'whatsapp') => {
    if (tipo === 'email') {
      setCuerpoEmail(prev => prev + variable);
    } else {
      setMensajeWhatsApp(prev => prev + variable);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p className="text-neutral-600">Cargando plantilla...</p>
        </div>
      </div>
    );
  }

  const variablesEmail = plantilla?.variables_disponibles || [
    '{{nombre}}',
    '{{apellidos}}',
    '{{email}}',
    '{{nombre_plataforma}}'
  ];

  const variablesWhatsApp = plantilla?.whatsapp_variables_disponibles || variablesEmail;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h2 className="text-2xl font-bold text-neutral-800">Editar Plantilla</h2>
            <p className="text-sm text-neutral-600 mt-1">{tipoNombre}</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-6 mt-4 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-accent-50 text-accent-800 border border-accent-200'
          }`}>
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Asunto */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Asunto del Correo <span className="text-accent-600">*</span>
              </label>
              <input
                type="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Ej: Bienvenido a {{nombre_plataforma}}"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Puedes usar variables como {variablesEmail.slice(0, 3).join(', ')}
              </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-neutral-200">
              <div className="flex gap-4">
                <button
                  onClick={() => setPreviewTab('email')}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                    previewTab === 'email'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-neutral-600 hover:text-neutral-800'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Plantilla Email
                </button>
                <button
                  onClick={() => setPreviewTab('whatsapp')}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                    previewTab === 'whatsapp'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-neutral-600 hover:text-neutral-800'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Plantilla WhatsApp
                </button>
              </div>
            </div>

            {/* Email Tab */}
            {previewTab === 'email' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Cuerpo del Email (HTML) <span className="text-accent-600">*</span>
                  </label>
                  <textarea
                    value={cuerpoEmail}
                    onChange={(e) => setCuerpoEmail(e.target.value)}
                    rows={12}
                    placeholder="<h2>Hola {{nombre}}</h2><p>Tu mensaje aquí...</p>"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                  />
                </div>

                {/* Variables Email */}
                <div>
                  <p className="text-sm font-semibold text-neutral-700 mb-2">Variables Disponibles:</p>
                  <div className="flex flex-wrap gap-2">
                    {variablesEmail.map((variable) => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable, 'email')}
                        className="px-3 py-1 text-xs font-mono bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Click en una variable para insertarla en el cuerpo del email
                  </p>
                </div>
              </div>
            )}

            {/* WhatsApp Tab */}
            {previewTab === 'whatsapp' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Mensaje de WhatsApp
                  </label>
                  <textarea
                    value={mensajeWhatsApp}
                    onChange={(e) => setMensajeWhatsApp(e.target.value)}
                    rows={12}
                    placeholder="Hola {{nombre}}!\n\nTu mensaje aquí...\n\nUsa \\n para saltos de línea y *negrita* para énfasis."
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Usa \n para saltos de línea, *texto* para negrita, _texto_ para cursiva
                  </p>
                </div>

                {/* Variables WhatsApp */}
                <div>
                  <p className="text-sm font-semibold text-neutral-700 mb-2">Variables Disponibles:</p>
                  <div className="flex flex-wrap gap-2">
                    {variablesWhatsApp.map((variable) => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable, 'whatsapp')}
                        className="px-3 py-1 text-xs font-mono bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 transition-colors"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Click en una variable para insertarla en el mensaje
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2 text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar Plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}
