import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Power, MessageCircle, AlertCircle, Edit, Bell, Save, X, Eye, Code, Bold, Italic, List, Link as LinkIcon, Image, ChevronDown, ChevronUp, Users, Check } from 'lucide-react';
import { EditarPlantillaModal } from './EditarPlantillaModal';
import type { TransactionalNotificationTemplate } from '../../lib/transactionalNotificationTypes';
import { AVAILABLE_PLACEHOLDERS } from '../../lib/transactionalNotificationTypes';

interface TipoNotificacion {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  es_personalizada: boolean;
  enviar_correo: boolean;
  enviar_whatsapp: boolean;
  enviar_notificacion: boolean;
  permite_destinatarios_custom: boolean;
}

interface Usuario {
  id: string;
  nombre: string;
  apellidos: string;
  email_laboral: string;
  rol: string;
}

interface Destinatario {
  id: string;
  tipo_notificacion_id: string;
  usuario_id: string;
  usuario?: Usuario;
}

interface TiposNotificacionesProps {
  onUpdate: () => void;
}

export function TiposNotificaciones({ onUpdate }: TiposNotificacionesProps) {
  const [tipos, setTipos] = useState<TipoNotificacion[]>([]);
  const [transactionalTemplates, setTransactionalTemplates] = useState<TransactionalNotificationTemplate[]>([]);
  const [editingTransactional, setEditingTransactional] = useState<TransactionalNotificationTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingTipo, setEditingTipo] = useState<{ id: string, nombre: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [destinatarios, setDestinatarios] = useState<Record<string, Destinatario[]>>({});
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<Usuario[]>([]);
  const [managingDestinatarios, setManagingDestinatarios] = useState<string | null>(null);

  useEffect(() => {
    fetchTipos();
    fetchTransactionalTemplates();
    fetchDestinatarios();
    fetchUsuariosDisponibles();
  }, []);

  const fetchTipos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('correo_tipos_notificacion')
        .select('*')
        .order('created_at', { ascending: true});

      if (error) throw error;

      // Filtrar notificaciones obsoletas (marcadas con ❌ en descripción)
      const tiposValidos = (data || []).filter(tipo =>
        !tipo.descripcion?.includes('❌ NO USAR')
      );

      setTipos(tiposValidos);
    } catch (error) {
      console.error('Error al cargar tipos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDestinatarios = async () => {
    try {
      const { data, error } = await supabase
        .from('correo_destinatarios_notificacion')
        .select(`
          *,
          usuario:usuarios(id, nombre, apellidos, email_laboral, rol)
        `);

      if (error) throw error;

      // Agrupar destinatarios por tipo
      const destinatariosPorTipo: Record<string, Destinatario[]> = {};
      (data || []).forEach((dest: any) => {
        if (!destinatariosPorTipo[dest.tipo_notificacion_id]) {
          destinatariosPorTipo[dest.tipo_notificacion_id] = [];
        }
        destinatariosPorTipo[dest.tipo_notificacion_id].push(dest);
      });

      setDestinatarios(destinatariosPorTipo);
    } catch (error) {
      console.error('Error al cargar destinatarios:', error);
    }
  };

  const fetchUsuariosDisponibles = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, email_laboral, rol')
        .in('rol', ['Empleado', 'Gerente', 'Administrador'])
        .eq('estado', 'activo')
        .order('nombre');

      if (error) throw error;

      setUsuariosDisponibles(data || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const fetchTransactionalTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('transactional_notification_templates')
        .select('*')
        .order('name');

      if (error) throw error;

      setTransactionalTemplates(data || []);
    } catch (error) {
      console.error('Error al cargar plantillas transaccionales:', error);
    }
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    try {
      setMessage(null);
      const { error } = await supabase
        .from('correo_tipos_notificacion')
        .update({ activo: !activo })
        .eq('id', id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Notificación ${!activo ? 'activada' : 'desactivada'} exitosamente`
      });

      fetchTipos();
      onUpdate();
    } catch (error: any) {
      console.error('Error al actualizar:', error);
      setMessage({ type: 'error', text: 'Error al actualizar el estado' });
    }
  };

  const toggleCanal = async (id: string, campo: 'enviar_correo' | 'enviar_whatsapp' | 'enviar_notificacion', valorActual: boolean) => {
    try {
      setMessage(null);
      const nuevoValor = !valorActual;

      const { error } = await supabase
        .from('correo_tipos_notificacion')
        .update({ [campo]: nuevoValor })
        .eq('id', id);

      if (error) throw error;

      const canalNombre = campo === 'enviar_correo' ? 'Correo' : campo === 'enviar_whatsapp' ? 'WhatsApp' : 'Notificación';
      setMessage({
        type: 'success',
        text: `Canal ${canalNombre} ${nuevoValor ? 'activado' : 'desactivado'} exitosamente`
      });

      await fetchTipos();
      onUpdate();
    } catch (error: any) {
      console.error('Error al actualizar canal:', error);
      setMessage({ type: 'error', text: 'Error al actualizar el canal: ' + error.message });
    }
  };

  const agregarDestinatario = async (tipoId: string, usuarioId: string) => {
    try {
      setMessage(null);
      const { error } = await supabase
        .from('correo_destinatarios_notificacion')
        .insert({
          tipo_notificacion_id: tipoId,
          usuario_id: usuarioId
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Destinatario agregado' });
      await fetchDestinatarios();
    } catch (error: any) {
      console.error('Error al agregar destinatario:', error);
      setMessage({ type: 'error', text: 'Error al agregar destinatario' });
    }
  };

  const eliminarDestinatario = async (destinatarioId: string) => {
    try {
      setMessage(null);
      const { error } = await supabase
        .from('correo_destinatarios_notificacion')
        .delete()
        .eq('id', destinatarioId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Destinatario eliminado' });
      await fetchDestinatarios();
    } catch (error: any) {
      console.error('Error al eliminar destinatario:', error);
      setMessage({ type: 'error', text: 'Error al eliminar destinatario' });
    }
  };

  const toggleTransactionalActive = async (id: string, isActive: boolean) => {
    try {
      setMessage(null);
      const { error } = await supabase
        .from('transactional_notification_templates')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Plantilla ${!isActive ? 'activada' : 'desactivada'} exitosamente`
      });

      await fetchTransactionalTemplates();
      onUpdate();
    } catch (error: any) {
      console.error('Error al actualizar plantilla:', error);
      setMessage({ type: 'error', text: 'Error al actualizar la plantilla' });
    }
  };

  const handleSaveTransactional = async () => {
    if (!editingTransactional) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('transactional_notification_templates')
        .update({
          email_subject_template: editingTransactional.email_subject_template,
          email_body_template: editingTransactional.email_body_template,
          whatsapp_body_template: editingTransactional.whatsapp_body_template,
          inapp_title_template: editingTransactional.inapp_title_template,
          inapp_body_template: editingTransactional.inapp_body_template,
          is_active: editingTransactional.is_active
        })
        .eq('id', editingTransactional.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Plantilla guardada exitosamente'
      });

      await fetchTransactionalTemplates();
      setEditingTransactional(null);
      onUpdate();
    } catch (error: any) {
      console.error('Error al guardar plantilla:', error);
      setMessage({ type: 'error', text: 'Error al guardar la plantilla' });
    } finally {
      setSaving(false);
    }
  };

  const insertHtmlTag = (tag: string, closeTag?: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !editingTransactional) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingTransactional.email_body_template || '';
    const selectedText = text.substring(start, end);

    let newText = '';
    let newCursorPos = start;

    if (closeTag) {
      newText = text.substring(0, start) + tag + selectedText + closeTag + text.substring(end);
      newCursorPos = start + tag.length + selectedText.length + closeTag.length;
    } else {
      newText = text.substring(0, start) + tag + text.substring(end);
      newCursorPos = start + tag.length;
    }

    setEditingTransactional({
      ...editingTransactional,
      email_body_template: newText
    });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  if (loading) {
    return <div className="text-center py-8 text-neutral-600">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-accent-50 text-accent-800 border border-accent-200'
        }`}>
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Plantillas Transaccionales (Comisiones) */}
      {transactionalTemplates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-primary-600 rounded-full"></div>
            <h3 className="text-lg font-bold text-neutral-900">Plantillas Transaccionales</h3>
            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full">
              Automáticas
            </span>
          </div>

          {transactionalTemplates.map((template) => (
            <div key={template.id}>
              {editingTransactional?.id === template.id ? (
                <div className="bg-white rounded-lg border-2 border-primary-500 shadow-lg p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-neutral-900">{template.name}</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSaveTransactional}
                        disabled={saving}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>Guardar</span>
                      </button>
                      <button
                        onClick={() => setEditingTransactional(null)}
                        className="flex items-center space-x-2 px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancelar</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-primary-900 mb-2">Variables disponibles:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {AVAILABLE_PLACEHOLDERS[template.event_key as keyof typeof AVAILABLE_PLACEHOLDERS]?.map(ph => (
                        <code key={ph.key} className="bg-white px-2 py-1 rounded text-primary-700">
                          {`{{${ph.key}}}`}
                        </code>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center space-x-2 mb-2 text-sm font-semibold text-neutral-900">
                        <Mail className="w-4 h-4 text-primary-600" />
                        <span>Asunto del Correo</span>
                      </label>
                      <input
                        type="text"
                        value={editingTransactional.email_subject_template || ''}
                        onChange={(e) => setEditingTransactional({
                          ...editingTransactional,
                          email_subject_template: e.target.value
                        })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 mb-2 text-sm font-semibold text-neutral-900">
                        <Mail className="w-4 h-4 text-primary-600" />
                        <span>Cuerpo del Correo (HTML)</span>
                      </label>

                      {/* Barra de herramientas HTML */}
                      <div className="flex items-center justify-between gap-3 p-2 bg-neutral-50 border border-neutral-200 rounded-lg mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1 border-r border-neutral-300 pr-2">
                            <button
                              onClick={() => insertHtmlTag('<strong>', '</strong>')}
                              className="p-1.5 hover:bg-neutral-200 rounded transition-colors"
                              title="Negrita"
                            >
                              <Bold className="w-3.5 h-3.5 text-neutral-700" />
                            </button>
                            <button
                              onClick={() => insertHtmlTag('<em>', '</em>')}
                              className="p-1.5 hover:bg-neutral-200 rounded transition-colors"
                              title="Cursiva"
                            >
                              <Italic className="w-3.5 h-3.5 text-neutral-700" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 border-r border-neutral-300 pr-2">
                            <button
                              onClick={() => insertHtmlTag('<h2>', '</h2>')}
                              className="px-1.5 py-1 text-xs font-semibold hover:bg-neutral-200 rounded transition-colors"
                            >
                              H2
                            </button>
                            <button
                              onClick={() => insertHtmlTag('<p>', '</p>')}
                              className="px-1.5 py-1 text-xs font-semibold hover:bg-neutral-200 rounded transition-colors"
                            >
                              P
                            </button>
                          </div>
                          <div className="flex items-center gap-1 border-r border-neutral-300 pr-2">
                            <button
                              onClick={() => insertHtmlTag('<ul>\n  <li></li>\n</ul>')}
                              className="p-1.5 hover:bg-neutral-200 rounded transition-colors"
                              title="Lista"
                            >
                              <List className="w-3.5 h-3.5 text-neutral-700" />
                            </button>
                            <button
                              onClick={() => insertHtmlTag('<a href="">', '</a>')}
                              className="p-1.5 hover:bg-neutral-200 rounded transition-colors"
                              title="Enlace"
                            >
                              <LinkIcon className="w-3.5 h-3.5 text-neutral-700" />
                            </button>
                          </div>
                          <button
                            onClick={() => insertHtmlTag('<br>')}
                            className="px-1.5 py-1 text-xs font-semibold hover:bg-neutral-200 rounded transition-colors"
                          >
                            BR
                          </button>
                        </div>
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            showPreview
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {showPreview ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                          {showPreview ? 'Preview' : 'Código'}
                        </button>
                      </div>

                      {/* Editor y Vista Previa */}
                      <div className={`grid ${showPreview ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                        <textarea
                          ref={textareaRef}
                          value={editingTransactional.email_body_template || ''}
                          onChange={(e) => setEditingTransactional({
                            ...editingTransactional,
                            email_body_template: e.target.value
                          })}
                          rows={12}
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm resize-none"
                        />
                        {showPreview && (
                          <div className="border border-neutral-300 rounded-lg p-3 bg-white overflow-auto h-[300px]">
                            <div
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: editingTransactional.email_body_template || '' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 mb-2 text-sm font-semibold text-neutral-900">
                        <MessageCircle className="w-4 h-4 text-green-600" />
                        <span>Mensaje de WhatsApp</span>
                      </label>
                      <textarea
                        value={editingTransactional.whatsapp_body_template || ''}
                        onChange={(e) => setEditingTransactional({
                          ...editingTransactional,
                          whatsapp_body_template: e.target.value
                        })}
                        rows={6}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 mb-2 text-sm font-semibold text-neutral-900">
                        <Bell className="w-4 h-4 text-yellow-600" />
                        <span>Título Notificación Interna</span>
                      </label>
                      <input
                        type="text"
                        value={editingTransactional.inapp_title_template || ''}
                        onChange={(e) => setEditingTransactional({
                          ...editingTransactional,
                          inapp_title_template: e.target.value
                        })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 mb-2 text-sm font-semibold text-neutral-900">
                        <Bell className="w-4 h-4 text-yellow-600" />
                        <span>Cuerpo Notificación Interna</span>
                      </label>
                      <textarea
                        value={editingTransactional.inapp_body_template || ''}
                        onChange={(e) => setEditingTransactional({
                          ...editingTransactional,
                          inapp_body_template: e.target.value
                        })}
                        rows={3}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-neutral-800">{template.name}</h3>
                        <p className="text-sm text-neutral-600 mt-1">Event: {template.event_key}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {template.email_subject_template && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-full">
                              <Mail className="w-3 h-3" />
                              Email
                            </span>
                          )}
                          {template.whatsapp_body_template && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </span>
                          )}
                          {template.inapp_title_template && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                              <Bell className="w-3 h-3" />
                              InApp
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditingTransactional({ ...template })}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Editar Plantilla
                      </button>
                      <button
                        onClick={() => toggleTransactionalActive(template.id, template.is_active)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                          template.is_active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                        {template.is_active ? 'Activa' : 'Inactiva'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tipos de Notificaciones Regulares */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 bg-primary-600 rounded-full"></div>
          <h3 className="text-lg font-bold text-neutral-900">Notificaciones Programadas</h3>
          <span className="px-3 py-1 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full">
            Editar plantillas de Email, WhatsApp y Campanita en un solo lugar
          </span>
        </div>

        {tipos.map((tipo) => {
          return (
          <div
            key={tipo.id}
            className="bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4 flex-1">
                <Mail className={`w-5 h-5 ${tipo.activo ? 'text-primary-600' : 'text-neutral-400'}`} />
                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-800">{tipo.nombre}</h3>
                  {tipo.descripcion && (
                    <p className="text-sm text-neutral-600 mt-1">{tipo.descripcion}</p>
                  )}
                  <span className="inline-block mt-2 px-2 py-1 text-xs rounded bg-neutral-200 text-neutral-700">
                    {tipo.codigo}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingTipo({ id: tipo.id, nombre: tipo.nombre })}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                  title="Editar plantillas de todos los canales"
                >
                  <Edit className="w-4 h-4" />
                  Editar Plantillas
                </button>
                <button
                  onClick={() => toggleActivo(tipo.id, tipo.activo)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    tipo.activo
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                  }`}
                >
                  <Power className="w-4 h-4" />
                  {tipo.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            </div>

            {/* Canales de Envío */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3">
              <h4 className="text-sm font-semibold text-neutral-700 mb-3">Canales de Envío</h4>
              <div className="flex flex-wrap gap-3">
                {/* Notificación (Campanita) */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCanal(tipo.id, 'enviar_notificacion', tipo.enviar_notificacion);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    tipo.enviar_notificacion
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-300 bg-white hover:border-neutral-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tipo.enviar_notificacion}
                    onChange={(e) => {
                      e.stopPropagation();
                    }}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-blue-500 pointer-events-none"
                  />
                  <Bell className={`w-4 h-4 ${tipo.enviar_notificacion ? 'text-primary-600' : 'text-neutral-500'}`} />
                  <span className={`text-sm font-medium ${tipo.enviar_notificacion ? 'text-primary-700' : 'text-neutral-600'}`}>
                    Notificación Interna
                  </span>
                </div>

                {/* WhatsApp */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCanal(tipo.id, 'enviar_whatsapp', tipo.enviar_whatsapp);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    tipo.enviar_whatsapp
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-neutral-300 bg-white hover:border-neutral-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tipo.enviar_whatsapp}
                    onChange={(e) => {
                      e.stopPropagation();
                    }}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500 pointer-events-none"
                  />
                  <MessageCircle className={`w-4 h-4 ${tipo.enviar_whatsapp ? 'text-emerald-600' : 'text-neutral-500'}`} />
                  <span className={`text-sm font-medium ${tipo.enviar_whatsapp ? 'text-emerald-700' : 'text-neutral-600'}`}>
                    WhatsApp
                  </span>
                </div>

                {/* Correo */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCanal(tipo.id, 'enviar_correo', tipo.enviar_correo);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    tipo.enviar_correo
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-300 bg-white hover:border-neutral-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={tipo.enviar_correo}
                    onChange={(e) => {
                      e.stopPropagation();
                    }}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500 pointer-events-none"
                  />
                  <Mail className={`w-4 h-4 ${tipo.enviar_correo ? 'text-primary-600' : 'text-neutral-500'}`} />
                  <span className={`text-sm font-medium ${tipo.enviar_correo ? 'text-primary-700' : 'text-neutral-600'}`}>
                    Correo Electrónico
                  </span>
                </div>
              </div>

              {/* Indicador de estado */}
              <div className="mt-3 flex items-center gap-2">
                {tipo.enviar_notificacion && tipo.enviar_whatsapp && tipo.enviar_correo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200">
                    Envío por los 3 canales
                  </span>
                )}
                {tipo.enviar_notificacion && tipo.enviar_whatsapp && !tipo.enviar_correo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700 border border-cyan-200">
                    Notificación y WhatsApp (por defecto)
                  </span>
                )}
                {tipo.enviar_notificacion && !tipo.enviar_whatsapp && tipo.enviar_correo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Notificación y Correo
                  </span>
                )}
                {!tipo.enviar_notificacion && tipo.enviar_whatsapp && tipo.enviar_correo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700 border border-teal-200">
                    WhatsApp y Correo
                  </span>
                )}
                {tipo.enviar_notificacion && !tipo.enviar_whatsapp && !tipo.enviar_correo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200">
                    Solo notificaciones internas
                  </span>
                )}
                {!tipo.enviar_notificacion && tipo.enviar_whatsapp && !tipo.enviar_correo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Solo por WhatsApp
                  </span>
                )}
                {!tipo.enviar_notificacion && !tipo.enviar_whatsapp && tipo.enviar_correo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200">
                    Solo por correo
                  </span>
                )}
                {!tipo.enviar_notificacion && !tipo.enviar_whatsapp && !tipo.enviar_correo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                    <AlertCircle className="w-3 h-3" />
                    Sin canal seleccionado
                  </span>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {tipos.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay tipos de notificaciones configurados</p>
        </div>
      )}

      {/* Modal de Edición */}
      {editingTipo && (
        <EditarPlantillaModal
          tipoId={editingTipo.id}
          tipoNombre={editingTipo.nombre}
          onClose={() => setEditingTipo(null)}
          onSave={() => {
            fetchTipos();
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
