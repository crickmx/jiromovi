import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bell, Mail, MessageSquare, Save, AlertCircle, Edit2, Check, X } from 'lucide-react';
import type { TransactionalNotificationTemplate } from '../lib/transactionalNotificationTypes';
import { AVAILABLE_PLACEHOLDERS } from '../lib/transactionalNotificationTypes';

export default function ConfiguracionNotificacionesTransaccionales() {
  const { usuario } = useAuth();
  const [templates, setTemplates] = useState<TransactionalNotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<TransactionalNotificationTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (isAdmin) {
      loadTemplates();
    }
  }, [isAdmin]);

  const loadTemplates = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('transactional_notification_templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading templates:', error);
    } else {
      setTemplates(data || []);
    }

    setLoading(false);
  };

  const handleEdit = (template: TransactionalNotificationTemplate) => {
    setEditingTemplate({ ...template });
  };

  const handleCancel = () => {
    setEditingTemplate(null);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    setSaving(true);

    const { error } = await supabase
      .from('transactional_notification_templates')
      .update({
        email_subject_template: editingTemplate.email_subject_template,
        email_body_template: editingTemplate.email_body_template,
        whatsapp_body_template: editingTemplate.whatsapp_body_template,
        inapp_title_template: editingTemplate.inapp_title_template,
        inapp_body_template: editingTemplate.inapp_body_template,
        is_active: editingTemplate.is_active
      })
      .eq('id', editingTemplate.id);

    if (error) {
      alert('Error al guardar la plantilla');
      console.error(error);
    } else {
      alert('Plantilla guardada exitosamente');
      await loadTemplates();
      setEditingTemplate(null);
    }

    setSaving(false);
  };

  const toggleActive = async (template: TransactionalNotificationTemplate) => {
    const { error } = await supabase
      .from('transactional_notification_templates')
      .update({ is_active: !template.is_active })
      .eq('id', template.id);

    if (error) {
      alert('Error al cambiar el estado');
      console.error(error);
    } else {
      loadTemplates();
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-soft p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Acceso Denegado</h2>
          <p className="text-neutral-600">Solo administradores pueden acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const placeholders = editingTemplate
    ? AVAILABLE_PLACEHOLDERS[editingTemplate.event_key as keyof typeof AVAILABLE_PLACEHOLDERS] || []
    : [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Notificaciones Transaccionales</h1>
            <p className="text-neutral-600">Configura las plantillas de notificaciones automáticas</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Variables disponibles (placeholders)</h3>
          <p className="text-sm text-blue-700 mb-2">
            Usa estas variables en tus plantillas y serán reemplazadas automáticamente:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="font-mono bg-white px-2 py-1 rounded">
              <code className="text-blue-600">{'{{agent_name}}'}</code> - Nombre del agente
            </div>
            <div className="font-mono bg-white px-2 py-1 rounded">
              <code className="text-blue-600">{'{{office_name}}'}</code> - Nombre de la oficina
            </div>
            <div className="font-mono bg-white px-2 py-1 rounded">
              <code className="text-blue-600">{'{{week_number}}'}</code> - Número de semana
            </div>
            <div className="font-mono bg-white px-2 py-1 rounded">
              <code className="text-blue-600">{'{{period_start}}'}</code> - Fecha de inicio
            </div>
            <div className="font-mono bg-white px-2 py-1 rounded">
              <code className="text-blue-600">{'{{period_end}}'}</code> - Fecha de fin
            </div>
            <div className="font-mono bg-white px-2 py-1 rounded">
              <code className="text-blue-600">{'{{net_commission_total}}'}</code> - Total comisiones
            </div>
            <div className="font-mono bg-white px-2 py-1 rounded col-span-2">
              <code className="text-blue-600">{'{{orden_de_pago_url}}'}</code> - Link al PDF
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {templates.map(template => (
            <div
              key={template.id}
              className="border border-neutral-200 rounded-xl p-6 hover:shadow-soft transition-shadow"
            >
              {editingTemplate?.id === template.id ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-neutral-900">{template.name}</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>Guardar</span>
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex items-center space-x-2 px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancelar</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center space-x-2 mb-2">
                        <Mail className="w-4 h-4 text-primary-600" />
                        <span className="font-semibold text-neutral-900">Asunto del Correo</span>
                      </label>
                      <input
                        type="text"
                        value={editingTemplate.email_subject_template || ''}
                        onChange={(e) => setEditingTemplate({
                          ...editingTemplate,
                          email_subject_template: e.target.value
                        })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Ej: Tus comisiones de la semana {{week_number}} ya están listas"
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 mb-2">
                        <Mail className="w-4 h-4 text-primary-600" />
                        <span className="font-semibold text-neutral-900">Cuerpo del Correo (HTML)</span>
                      </label>
                      <textarea
                        value={editingTemplate.email_body_template || ''}
                        onChange={(e) => setEditingTemplate({
                          ...editingTemplate,
                          email_body_template: e.target.value
                        })}
                        rows={8}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                        placeholder="Puedes usar HTML aquí..."
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-neutral-900">Mensaje de WhatsApp</span>
                      </label>
                      <textarea
                        value={editingTemplate.whatsapp_body_template || ''}
                        onChange={(e) => setEditingTemplate({
                          ...editingTemplate,
                          whatsapp_body_template: e.target.value
                        })}
                        rows={6}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Texto del mensaje de WhatsApp..."
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 mb-2">
                        <Bell className="w-4 h-4 text-yellow-600" />
                        <span className="font-semibold text-neutral-900">Título Notificación Interna</span>
                      </label>
                      <input
                        type="text"
                        value={editingTemplate.inapp_title_template || ''}
                        onChange={(e) => setEditingTemplate({
                          ...editingTemplate,
                          inapp_title_template: e.target.value
                        })}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Ej: Comisiones semana {{week_number}} listas"
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 mb-2">
                        <Bell className="w-4 h-4 text-yellow-600" />
                        <span className="font-semibold text-neutral-900">Cuerpo Notificación Interna</span>
                      </label>
                      <textarea
                        value={editingTemplate.inapp_body_template || ''}
                        onChange={(e) => setEditingTemplate({
                          ...editingTemplate,
                          inapp_body_template: e.target.value
                        })}
                        rows={3}
                        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Texto de la notificación interna..."
                      />
                    </div>

                    <div className="flex items-center space-x-3 pt-4 border-t">
                      <input
                        type="checkbox"
                        id={`active-${template.id}`}
                        checked={editingTemplate.is_active}
                        onChange={(e) => setEditingTemplate({
                          ...editingTemplate,
                          is_active: e.target.checked
                        })}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <label htmlFor={`active-${template.id}`} className="font-medium text-neutral-900">
                        Plantilla activa
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900">{template.name}</h3>
                      <p className="text-sm text-neutral-500">Event key: {template.event_key}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {template.email_subject_template && (
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center" title="Email configurado">
                            <Mail className="w-4 h-4 text-blue-600" />
                          </div>
                        )}
                        {template.whatsapp_body_template && (
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center" title="WhatsApp configurado">
                            <MessageSquare className="w-4 h-4 text-green-600" />
                          </div>
                        )}
                        {template.inapp_title_template && (
                          <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center" title="Notificación interna configurada">
                            <Bell className="w-4 h-4 text-yellow-600" />
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleActive(template)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          template.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                        }`}
                      >
                        {template.is_active ? 'Activa' : 'Inactiva'}
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-neutral-700 mb-1">Asunto email:</p>
                      <p className="text-neutral-600 truncate">{template.email_subject_template || '-'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-700 mb-1">Título notificación:</p>
                      <p className="text-neutral-600 truncate">{template.inapp_title_template || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
