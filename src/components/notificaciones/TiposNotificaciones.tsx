import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Power, MessageCircle, AlertCircle, Edit, Bell, Save, X, Eye, Code, Bold, Italic, List, Link as LinkIcon, Image, ChevronDown, ChevronUp, Users, Check, UserCheck, Building2 } from 'lucide-react';
import { EditarPlantillaModal } from './EditarPlantillaModal';
import type { TransactionalNotificationTemplate } from '../../lib/transactionalNotificationTypes';
import { AVAILABLE_PLACEHOLDERS } from '../../lib/transactionalNotificationTypes';

type NotificationCategory = 'generales' | 'departamentales';

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
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('generales');

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
            <div className="w-1 h-6 bg-accent rounded-full"></div>
            <h3 className="text-lg font-bold text-neutral-900">Plantillas Transaccionales</h3>
            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full">
              Automáticas
            </span>
          </div>

          {transactionalTemplates.map((template) => (
            <div key={template.id}>
              {editingTransactional?.id === template.id ? (
                <div className="bg-white rounded-lg border-2 border-accent shadow-lg p-6 space-y-6">
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
                        <Mail className="w-4 h-4 text-accent" />
                        <span>Asunto del Correo</span>
                      </label>
                      <input
                        type="text"
                        value={editingTransactional.email_subject_template || ''}
                        onChange={(e) => setEditingTransactional({
                          ...editingTransactional,
                          email_subject_template: e.target.value
                        })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 mb-2 text-sm font-semibold text-neutral-900">
                        <Mail className="w-4 h-4 text-accent" />
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
                          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-sm resize-none"
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
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
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
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
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
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5 text-accent" />
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
          <div className="w-1 h-6 bg-accent rounded-full"></div>
          <h3 className="text-lg font-bold text-neutral-900">Notificaciones Programadas</h3>
          <span className="px-3 py-1 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full">
            Editar plantillas de Email, WhatsApp y Campanita en un solo lugar
          </span>
        </div>

        {/* Tabs de Categorías */}
        <div className="flex gap-2 mb-4 border-b border-neutral-200">
          <button
            onClick={() => setActiveCategory('generales')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-all border-b-2 ${
              activeCategory === 'generales'
                ? 'text-primary-700 border-accent'
                : 'text-neutral-600 border-transparent hover:text-neutral-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Notificaciones Generales
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeCategory === 'generales'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-neutral-200 text-neutral-600'
            }`}>
              {tipos.filter(t => !t.permite_destinatarios_custom).length}
            </span>
          </button>
          <button
            onClick={() => setActiveCategory('departamentales')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-all border-b-2 ${
              activeCategory === 'departamentales'
                ? 'text-violet-700 border-violet-600'
                : 'text-neutral-600 border-transparent hover:text-neutral-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Notificaciones Departamentales
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeCategory === 'departamentales'
                ? 'bg-violet-100 text-violet-700'
                : 'bg-neutral-200 text-neutral-600'
            }`}>
              {tipos.filter(t => t.permite_destinatarios_custom).length}
            </span>
          </button>
        </div>

        {/* Descripción según categoría */}
        {activeCategory === 'generales' ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <UserCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900">Notificaciones Automáticas</p>
                <p className="text-xs text-blue-700 mt-1">
                  Estas notificaciones se envían automáticamente al usuario relacionado con la acción
                  (ej: el usuario que solicita vacaciones, el que recibe comisiones, etc.). No requieren configurar destinatarios.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <Building2 className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-violet-900">Notificaciones a Departamentos</p>
                <p className="text-xs text-violet-700 mt-1">
                  Estas notificaciones se envían a usuarios específicos que debes configurar
                  (ej: equipo de RRHH, Mercadotecnia, Mesa de Control). Debes asignar destinatarios para que funcionen.
                </p>
              </div>
            </div>
          </div>
        )}

        {tipos.filter(tipo =>
          activeCategory === 'generales'
            ? !tipo.permite_destinatarios_custom
            : tipo.permite_destinatarios_custom
        ).map((tipo) => {
          const isExpanded = expandedId === tipo.id;
          const destinatariosTipo = destinatarios[tipo.id] || [];
          const isManagingDest = managingDestinatarios === tipo.id;

          return (
          <div
            key={tipo.id}
            className={`bg-white rounded-lg border transition-all ${
              isExpanded ? 'border-primary-300 shadow-sm' : 'border-neutral-200'
            }`}
          >
            {/* Header Principal */}
            <div className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : tipo.id)}
                    className="flex-shrink-0 hover:bg-neutral-100 rounded-lg p-1 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-neutral-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-600" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-neutral-800">
                        {tipo.nombre}
                      </h4>
                      {tipo.activo && (
                        <span className="flex-shrink-0 w-2 h-2 bg-emerald-500 rounded-full"></span>
                      )}
                      {activeCategory === 'generales' && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
                          <UserCheck className="w-3 h-3" />
                          Automática
                        </span>
                      )}
                      {activeCategory === 'departamentales' && destinatariosTipo.length === 0 && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Sin destinatarios
                        </span>
                      )}
                      {activeCategory === 'departamentales' && destinatariosTipo.length > 0 && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-medium rounded-full flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {destinatariosTipo.length} destinatario{destinatariosTipo.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {tipo.descripcion && (
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                        {tipo.descripcion.replace(/✅|❌|⚠️/g, '').trim()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Badges de canales activos */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {tipo.enviar_notificacion && (
                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  {tipo.enviar_whatsapp && (
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  {tipo.enviar_correo && (
                    <Mail className="w-3.5 h-3.5 text-accent" />
                  )}
                </div>

                {/* Botón de activar/desactivar */}
                <button
                  onClick={() => toggleActivo(tipo.id, tipo.activo)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                    tipo.activo
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Contenido Expandido */}
            {isExpanded && (
              <div className="border-t border-neutral-200 p-4 space-y-4 bg-neutral-50">
                {/* Canales */}
                <div>
                  <h5 className="text-xs font-semibold text-neutral-700 mb-2">Canales de envío</h5>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleCanal(tipo.id, 'enviar_notificacion', tipo.enviar_notificacion)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        tipo.enviar_notificacion
                          ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                          : 'bg-white text-neutral-600 border border-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                      Notificación
                    </button>
                    <button
                      onClick={() => toggleCanal(tipo.id, 'enviar_whatsapp', tipo.enviar_whatsapp)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        tipo.enviar_whatsapp
                          ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                          : 'bg-white text-neutral-600 border border-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => toggleCanal(tipo.id, 'enviar_correo', tipo.enviar_correo)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        tipo.enviar_correo
                          ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                          : 'bg-white text-neutral-600 border border-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Correo
                    </button>
                  </div>
                </div>

                {/* Destinatarios - Solo para notificaciones departamentales */}
                {activeCategory === 'departamentales' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-semibold text-neutral-700">Destinatarios departamentales</h5>
                      <button
                        onClick={() => setManagingDestinatarios(isManagingDest ? null : tipo.id)}
                        className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                      >
                        {isManagingDest ? 'Cerrar' : '+ Agregar'}
                      </button>
                    </div>

                    {/* Agregar destinatario */}
                    {isManagingDest && (
                      <div className="bg-white rounded-lg border border-violet-200 p-3 mb-2">
                        <p className="text-xs text-neutral-600 mb-2">Selecciona usuarios que recibirán esta notificación:</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {usuariosDisponibles
                            .filter(u => !destinatariosTipo.find(d => d.usuario_id === u.id))
                            .map(usuario => (
                              <button
                                key={usuario.id}
                                onClick={() => agregarDestinatario(tipo.id, usuario.id)}
                                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-violet-50 rounded text-left transition-colors"
                              >
                                <div>
                                  <p className="text-xs font-medium text-neutral-800">
                                    {usuario.nombre} {usuario.apellidos}
                                  </p>
                                  <p className="text-xs text-neutral-500">{usuario.email_laboral} • {usuario.rol}</p>
                                </div>
                                <Check className="w-4 h-4 text-violet-600" />
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Lista de destinatarios */}
                    {destinatariosTipo.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {destinatariosTipo.map(dest => (
                          <div
                            key={dest.id}
                            className="flex items-center gap-1.5 bg-violet-100 text-violet-700 px-2 py-1 rounded-full text-xs"
                          >
                            <span className="font-medium">
                              {dest.usuario?.nombre} {dest.usuario?.apellidos}
                            </span>
                            <button
                              onClick={() => eliminarDestinatario(dest.id)}
                              className="hover:bg-violet-200 rounded-full p-0.5 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-700">
                          ⚠️ <strong>Importante:</strong> Debes agregar al menos un destinatario para que esta notificación funcione.
                          Sin destinatarios, la notificación no se enviará.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Información para notificaciones generales */}
                {activeCategory === 'generales' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-accent flex-shrink-0" />
                    <p className="text-xs text-blue-700">
                      Esta notificación se envía automáticamente al usuario relacionado con la acción. No requiere configuración adicional.
                    </p>
                  </div>
                )}

                {/* Botón editar plantillas */}
                <button
                  onClick={() => setEditingTipo({ id: tipo.id, nombre: tipo.nombre })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-sm font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Editar Plantillas de Todos los Canales
                </button>
              </div>
            )}
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
