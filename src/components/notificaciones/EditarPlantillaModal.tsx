import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Mail, MessageCircle, AlertCircle, Save, Bell, Eye, Code, Bold, Italic, List, Link as LinkIcon, Image } from 'lucide-react';

interface Plantilla {
  id: string;
  tipo_notificacion_id: string;
  asunto: string;
  html_cuerpo: string;
  whatsapp_plantilla: string | null;
  notificacion_titulo: string | null;
  notificacion_cuerpo: string | null;
  variables_disponibles: string[] | null;
  whatsapp_variables_disponibles: string[] | null;
  notificacion_variables_disponibles: string[] | null;
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
  const [tituloNotificacion, setTituloNotificacion] = useState('');
  const [cuerpoNotificacion, setCuerpoNotificacion] = useState('');
  const [previewTab, setPreviewTab] = useState<'email' | 'whatsapp' | 'notificacion'>('email');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        setTituloNotificacion(data.notificacion_titulo || '');
        setCuerpoNotificacion(data.notificacion_cuerpo || '');
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

      if (!cuerpoEmail.trim() && !mensajeWhatsApp.trim() && !cuerpoNotificacion.trim()) {
        setMessage({ type: 'error', text: 'Debes completar al menos una plantilla (email, WhatsApp o notificación interna)' });
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
            notificacion_titulo: tituloNotificacion.trim() || null,
            notificacion_cuerpo: cuerpoNotificacion.trim() || null,
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
            notificacion_titulo: tituloNotificacion.trim() || null,
            notificacion_cuerpo: cuerpoNotificacion.trim() || null,
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

  const insertVariable = (variable: string, tipo: 'email' | 'whatsapp' | 'notificacion') => {
    if (tipo === 'email') {
      setCuerpoEmail(prev => prev + variable);
    } else if (tipo === 'whatsapp') {
      setMensajeWhatsApp(prev => prev + variable);
    } else {
      setCuerpoNotificacion(prev => prev + variable);
    }
  };

  const insertHtmlTag = (tag: string, closeTag?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = cuerpoEmail;
    const selectedText = text.substring(start, end);

    let newText = '';
    let newCursorPos = start;

    if (closeTag) {
      // Tag de apertura y cierre (ej: <strong></strong>)
      newText = text.substring(0, start) + tag + selectedText + closeTag + text.substring(end);
      newCursorPos = start + tag.length + selectedText.length + closeTag.length;
    } else {
      // Tag simple (ej: <br>)
      newText = text.substring(0, start) + tag + text.substring(end);
      newCursorPos = start + tag.length;
    }

    setCuerpoEmail(newText);

    // Restaurar posición del cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
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
  const variablesNotificacion = plantilla?.notificacion_variables_disponibles || variablesEmail;

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
                  Email
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
                  WhatsApp
                </button>
                <button
                  onClick={() => setPreviewTab('notificacion')}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors ${
                    previewTab === 'notificacion'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-neutral-600 hover:text-neutral-800'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  Campanita
                </button>
              </div>
            </div>

            {/* Email Tab */}
            {previewTab === 'email' && (
              <div className="space-y-4">
                {/* Barra de herramientas HTML */}
                <div className="flex items-center justify-between gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 border-r border-neutral-300 pr-2">
                      <button
                        onClick={() => insertHtmlTag('<strong>', '</strong>')}
                        className="p-2 hover:bg-neutral-200 rounded transition-colors"
                        title="Negrita"
                      >
                        <Bold className="w-4 h-4 text-neutral-700" />
                      </button>
                      <button
                        onClick={() => insertHtmlTag('<em>', '</em>')}
                        className="p-2 hover:bg-neutral-200 rounded transition-colors"
                        title="Cursiva"
                      >
                        <Italic className="w-4 h-4 text-neutral-700" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 border-r border-neutral-300 pr-2">
                      <button
                        onClick={() => insertHtmlTag('<h2>', '</h2>')}
                        className="px-2 py-1 text-xs font-semibold hover:bg-neutral-200 rounded transition-colors"
                        title="Título H2"
                      >
                        H2
                      </button>
                      <button
                        onClick={() => insertHtmlTag('<h3>', '</h3>')}
                        className="px-2 py-1 text-xs font-semibold hover:bg-neutral-200 rounded transition-colors"
                        title="Título H3"
                      >
                        H3
                      </button>
                      <button
                        onClick={() => insertHtmlTag('<p>', '</p>')}
                        className="px-2 py-1 text-xs font-semibold hover:bg-neutral-200 rounded transition-colors"
                        title="Párrafo"
                      >
                        P
                      </button>
                    </div>
                    <div className="flex items-center gap-1 border-r border-neutral-300 pr-2">
                      <button
                        onClick={() => insertHtmlTag('<ul>\n  <li></li>\n</ul>')}
                        className="p-2 hover:bg-neutral-200 rounded transition-colors"
                        title="Lista"
                      >
                        <List className="w-4 h-4 text-neutral-700" />
                      </button>
                      <button
                        onClick={() => insertHtmlTag('<a href="">', '</a>')}
                        className="p-2 hover:bg-neutral-200 rounded transition-colors"
                        title="Enlace"
                      >
                        <LinkIcon className="w-4 h-4 text-neutral-700" />
                      </button>
                      <button
                        onClick={() => insertHtmlTag('<img src="" alt="">')}
                        className="p-2 hover:bg-neutral-200 rounded transition-colors"
                        title="Imagen"
                      >
                        <Image className="w-4 h-4 text-neutral-700" />
                      </button>
                    </div>
                    <button
                      onClick={() => insertHtmlTag('<br>')}
                      className="px-2 py-1 text-xs font-semibold hover:bg-neutral-200 rounded transition-colors"
                      title="Salto de línea"
                    >
                      BR
                    </button>
                  </div>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                      showPreview
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {showPreview ? <Eye className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                    {showPreview ? 'Vista Previa' : 'Solo Código'}
                  </button>
                </div>

                {/* Editor y Vista Previa */}
                <div className={`grid ${showPreview ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                  {/* Editor */}
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Código HTML <span className="text-accent-600">*</span>
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={cuerpoEmail}
                      onChange={(e) => setCuerpoEmail(e.target.value)}
                      rows={18}
                      placeholder="<h2>Hola {{nombre}}</h2><p>Tu mensaje aquí...</p>"
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm resize-none"
                    />
                  </div>

                  {/* Vista Previa */}
                  {showPreview && (
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        Vista Previa
                      </label>
                      <div className="w-full h-[450px] border border-neutral-300 rounded-lg p-4 bg-white overflow-auto">
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: cuerpoEmail }}
                        />
                      </div>
                      <p className="text-xs text-neutral-500 mt-2">
                        Las variables como {'{{'} nombre {'}'} no se reemplazan en la vista previa
                      </p>
                    </div>
                  )}
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

            {/* Notificación Interna Tab */}
            {previewTab === 'notificacion' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Título de la Notificación
                  </label>
                  <input
                    type="text"
                    value={tituloNotificacion}
                    onChange={(e) => setTituloNotificacion(e.target.value)}
                    placeholder="Ej: Nueva notificación para {{nombre}}"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Cuerpo de la Notificación
                  </label>
                  <textarea
                    value={cuerpoNotificacion}
                    onChange={(e) => setCuerpoNotificacion(e.target.value)}
                    rows={8}
                    placeholder="Hola {{nombre}}, tu mensaje aquí..."
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Este mensaje aparecerá en el centro de notificaciones (campanita)
                  </p>
                </div>

                {/* Variables Notificación */}
                <div>
                  <p className="text-sm font-semibold text-neutral-700 mb-2">Variables Disponibles:</p>
                  <div className="flex flex-wrap gap-2">
                    {variablesNotificacion.map((variable) => (
                      <button
                        key={variable}
                        onClick={() => insertVariable(variable, 'notificacion')}
                        className="px-3 py-1 text-xs font-mono bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Click en una variable para insertarla en la notificación
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
