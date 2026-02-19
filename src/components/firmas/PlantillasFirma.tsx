import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Copy, Eye, Save, X, Code, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
      html: `<!-- FIRMA_BEGIN -->
<table style="font-family: Arial, sans-serif; font-size: 14px; color: #333; max-width: 700px;" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding: 20px 0;">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
        {{nombre}} {{apellidos}}
      </div>
      <div>{{puesto}}</div>
      <div>{{email_laboral}}</div>
    </td>
  </tr>
</table>
<!-- FIRMA_END -->`,
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

  const variables = [
    { group: 'Usuario', items: ['nombre', 'apellidos', 'rol', 'puesto', 'email_laboral', 'celular_laboral', 'extension_telefonica'] },
    { group: 'Oficina', items: ['oficina_nombre', 'oficina_direccion', 'oficina_telefono', 'oficina_email'] }
  ];

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

              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <h4 className="font-semibold text-primary-900 mb-2">Variables disponibles:</h4>
                <div className="grid grid-cols-2 gap-4">
                  {variables.map((group) => (
                    <div key={group.group}>
                      <p className="font-semibold text-sm text-primary-800 mb-2">{group.group}:</p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => (
                          <button
                            key={item}
                            onClick={() => insertVariable(item)}
                            className="px-2 py-1 bg-white border border-primary-300 text-primary-700 text-xs rounded hover:bg-primary-100 transition-all"
                          >
                            {`{{${item}}}`}
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
                    <div dangerouslySetInnerHTML={{ __html: formData.html }} />
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
