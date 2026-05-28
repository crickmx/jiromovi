import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit, Trash2, Copy, Eye, Save, X, Code, Image as ImageIcon, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SIGNATURE_VARIABLES, EXAMPLE_CONTEXT, renderSignatureHtml } from '../../lib/emailSignatureUtils';

interface Template {
  id: string;
  nombre: string;
  descripcion: string | null;
  html: string;
  es_activa: boolean;
  ancho_max: number;
  created_at: string;
}

export function PlantillasFirma() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    html: '',
    ancho_max: 700
  });

  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from('firma_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTemplates(data);
    }
    setLoading(false);
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setFormData({
      nombre: '',
      descripcion: '',
      html: `<table style="font-family:Arial,sans-serif;font-size:14px;color:#333333;max-width:600px;border-collapse:collapse;" cellpadding="0" cellspacing="0" role="presentation">
  <tr>
    <td style="padding:0 0 12px 0;">
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          {{#if imagen_perfil}}<td style="vertical-align:top;padding-right:16px;">
            <img src="{{imagen_perfil}}" alt="{{nombre_completo}}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" />
          </td>{{/if}}
          <td style="vertical-align:top;">
            <div style="font-size:17px;font-weight:bold;color:{{oficina_color_primario}};margin-bottom:2px;">{{nombre_completo}}</div>
            {{#if puesto}}<div style="font-size:13px;color:#555555;margin-bottom:8px;">{{puesto}}</div>{{/if}}
            <div style="font-size:12px;color:#666666;line-height:1.6;">
              {{#if email_laboral}}<span>{{email_laboral}}</span><br/>{{/if}}
              {{#if celular_laboral}}<span>{{celular_laboral}}</span>{{/if}}
              {{#if extension_telefonica}}<span> ext. {{extension_telefonica}}</span>{{/if}}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="border-top:2px solid {{oficina_color_primario}};padding:12px 0 0 0;">
      <table cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          {{#if oficina_logo}}<td style="vertical-align:middle;padding-right:12px;">
            <img src="{{oficina_logo}}" alt="{{oficina_nombre}}" style="height:32px;max-width:140px;" />
          </td>{{/if}}
          <td style="vertical-align:middle;font-size:12px;color:#666666;line-height:1.5;">
            {{#if oficina_nombre}}<strong>{{oficina_nombre}}</strong><br/>{{/if}}
            {{#if oficina_domicilio}}<span>{{oficina_domicilio}}</span><br/>{{/if}}
            {{#if oficina_telefono}}<span>Tel: {{oficina_telefono}}</span>{{/if}}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  {{#if whatsapp_link}}<tr>
    <td style="padding-top:10px;">
      <a href="{{whatsapp_link}}" style="display:inline-block;padding:6px 14px;background-color:#25D366;color:#ffffff;font-size:12px;font-weight:bold;text-decoration:none;border-radius:4px;">WhatsApp</a>
    </td>
  </tr>{{/if}}
</table>`,
      ancho_max: 700
    });
    setShowEditor(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      nombre: template.nombre,
      descripcion: template.descripcion || '',
      html: template.html,
      ancho_max: template.ancho_max
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.html) return;

    const data = {
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      html: formData.html,
      ancho_max: formData.ancho_max,
      es_activa: true
    };

    if (editingTemplate) {
      await supabase
        .from('firma_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editingTemplate.id);
    } else {
      await supabase
        .from('firma_templates')
        .insert(data);
    }

    setShowEditor(false);
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;

    await supabase
      .from('firma_templates')
      .delete()
      .eq('id', id);

    loadTemplates();
  };

  const handleDuplicate = async (template: Template) => {
    await supabase
      .from('firma_templates')
      .insert({
        nombre: `${template.nombre} (Copia)`,
        descripcion: template.descripcion,
        html: template.html,
        ancho_max: template.ancho_max,
        es_activa: true
      });

    loadTemplates();
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('html-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.html;
    const before = text.substring(0, start);
    const after = text.substring(end);

    setFormData({
      ...formData,
      html: before + `{{${variable}}}` + after
    });
  };

  const variables = SIGNATURE_VARIABLES;

  if (loading) {
    return <div className="text-center py-12">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-neutral-900">Plantillas de Firma</h2>
        <button
          onClick={handleNew}
          className="flex items-center space-x-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Plantilla</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div key={template.id} className="border border-neutral-200 rounded-xl p-4 hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-bold text-neutral-900">{template.nombre}</h3>
                {template.descripcion && (
                  <p className="text-sm text-neutral-600 mt-1">{template.descripcion}</p>
                )}
              </div>
              <div className={`px-2 py-1 rounded text-xs font-semibold ${
                template.es_activa ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {template.es_activa ? 'Activa' : 'Inactiva'}
              </div>
            </div>

            <div className="flex items-center space-x-2 mt-4">
              <button
                onClick={() => handleEdit(template)}
                className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-all text-sm"
              >
                <Edit className="w-4 h-4" />
                <span>Editar</span>
              </button>
              <button
                onClick={() => handleDuplicate(template)}
                className="p-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-all"
                title="Duplicar"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(template.id)}
                className="p-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-all"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl shadow-strong max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">
                {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
              </h2>
              <button onClick={() => setShowEditor(false)} className="text-neutral-500 hover:text-neutral-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Nombre de la plantilla *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Firma Corporativa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Ancho máximo (px)
                  </label>
                  <input
                    type="number"
                    value={formData.ancho_max}
                    onChange={(e) => setFormData({ ...formData, ancho_max: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descripción breve"
                />
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-semibold text-neutral-900">Variables disponibles</h4>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-neutral-400" />
                    <div className="absolute left-6 top-0 z-10 hidden group-hover:block w-72 p-3 bg-white border border-neutral-200 rounded-lg shadow-lg text-xs text-neutral-600">
                      <p className="font-semibold mb-1">Uso:</p>
                      <code className="block bg-neutral-100 p-1 rounded mb-2">{`{{variable}}`}</code>
                      <p className="font-semibold mb-1">Condicional:</p>
                      <code className="block bg-neutral-100 p-1 rounded">{`{{#if variable}}...{{/if}}`}</code>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {variables.map((group) => (
                    <div key={group.group}>
                      <p className="font-semibold text-sm text-neutral-700 mb-2">{group.group}:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map((item) => (
                          <button
                            key={item.key}
                            onClick={() => insertVariable(item.key)}
                            title={item.label}
                            className="px-2 py-1 bg-white border border-neutral-300 text-neutral-700 text-xs rounded hover:bg-accent/5 hover:border-accent/40 hover:text-accent transition-all"
                          >
                            {`{{${item.key}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-neutral-700">
                    Código HTML *
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setViewMode('code')}
                      className={`px-3 py-1 text-sm rounded ${viewMode === 'code' ? 'bg-accent text-white' : 'bg-neutral-200 text-neutral-700'}`}
                    >
                      <Code className="w-4 h-4 inline mr-1" />
                      Código
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`px-3 py-1 text-sm rounded ${viewMode === 'preview' ? 'bg-accent text-white' : 'bg-neutral-200 text-neutral-700'}`}
                    >
                      <Eye className="w-4 h-4 inline mr-1" />
                      Vista Previa
                    </button>
                  </div>
                </div>

                {viewMode === 'code' ? (
                  <textarea
                    id="html-editor"
                    value={formData.html}
                    onChange={(e) => setFormData({ ...formData, html: e.target.value })}
                    rows={16}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="<table>...</table>"
                  />
                ) : (
                  <div className="border border-neutral-300 rounded-lg p-4 bg-white min-h-[400px]">
                    <p className="text-xs text-neutral-500 mb-3 italic">Vista previa con datos de ejemplo:</p>
                    <div dangerouslySetInnerHTML={{ __html: renderSignatureHtml(formData.html, EXAMPLE_CONTEXT) }} />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-neutral-200 px-6 py-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowEditor(false)}
                className="px-6 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.nombre || !formData.html}
                className="flex items-center space-x-2 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
