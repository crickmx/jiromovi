import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BookOpen, Plus, Pencil, Trash2, Eye, EyeOff, ArrowUpDown, Save, X, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';

interface Manual {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  html_path: string | null;
  pdf_path: string | null;
  cover_image: string | null;
  status: string;
  visibility: string;
  sort_order: number;
  created_at: string;
}

const EMPTY_FORM: Omit<Manual, 'id' | 'created_at'> = {
  title: '',
  slug: '',
  description: '',
  category: 'General',
  html_path: '',
  pdf_path: '',
  cover_image: '',
  status: 'draft',
  visibility: 'all',
  sort_order: 0,
};

export default function ManualesAdmin() {
  const navigate = useNavigate();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingManual, setEditingManual] = useState<Manual | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchManuals();
  }, []);

  async function fetchManuals() {
    setLoading(true);
    const { data, error } = await supabase
      .from('manuals')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setManuals(data);
    }
    setLoading(false);
  }

  function startEdit(manual: Manual) {
    setEditingManual(manual);
    setIsCreating(false);
    setForm({
      title: manual.title,
      slug: manual.slug,
      description: manual.description,
      category: manual.category,
      html_path: manual.html_path || '',
      pdf_path: manual.pdf_path || '',
      cover_image: manual.cover_image || '',
      status: manual.status,
      visibility: manual.visibility,
      sort_order: manual.sort_order,
    });
  }

  function startCreate() {
    setEditingManual(null);
    setIsCreating(true);
    setForm({ ...EMPTY_FORM, sort_order: manuals.length + 1 });
  }

  function cancelEdit() {
    setEditingManual(null);
    setIsCreating(false);
    setForm(EMPTY_FORM);
  }

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async function handleSave() {
    if (!form.title || !form.slug) return;
    setSaving(true);

    const payload = {
      title: form.title,
      slug: form.slug,
      description: form.description,
      category: form.category,
      html_path: form.html_path || null,
      pdf_path: form.pdf_path || null,
      cover_image: form.cover_image || null,
      status: form.status,
      visibility: form.visibility,
      sort_order: form.sort_order,
    };

    if (isCreating) {
      const { error } = await supabase.from('manuals').insert(payload);
      if (!error) {
        await fetchManuals();
        cancelEdit();
      }
    } else if (editingManual) {
      const { error } = await supabase
        .from('manuals')
        .update(payload)
        .eq('id', editingManual.id);
      if (!error) {
        await fetchManuals();
        cancelEdit();
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Estas seguro de eliminar este manual?')) return;
    const { error } = await supabase.from('manuals').delete().eq('id', id);
    if (!error) {
      setManuals(prev => prev.filter(m => m.id !== id));
    }
  }

  async function toggleStatus(manual: Manual) {
    const newStatus = manual.status === 'active' ? 'draft' : 'active';
    const { error } = await supabase
      .from('manuals')
      .update({ status: newStatus })
      .eq('id', manual.id);
    if (!error) {
      setManuals(prev => prev.map(m => m.id === manual.id ? { ...m, status: newStatus } : m));
    }
  }

  const showForm = isCreating || editingManual;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Administrar Manuales"
        description="Crea, edita y gestiona los manuales del sistema"
        icon={BookOpen}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/manuales')}
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Catalogo
            </button>
            <button
              onClick={startCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Nuevo Manual
            </button>
          </div>
        }
      />

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-800 dark:text-white">
              {isCreating ? 'Nuevo Manual' : `Editando: ${editingManual?.title}`}
            </h3>
            <button onClick={cancelEdit} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Titulo *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => {
                  const title = e.target.value;
                  setForm(f => ({ ...f, title, slug: isCreating ? generateSlug(title) : f.slug }));
                }}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Slug (URL) *</label>
              <input
                type="text"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Descripcion</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Categoria</label>
              <input
                type="text"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Ruta HTML</label>
              <input
                type="text"
                value={form.html_path}
                onChange={e => setForm(f => ({ ...f, html_path: e.target.value }))}
                placeholder="/manuals/nombre/archivo.html"
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Ruta PDF (opcional)</label>
              <input
                type="text"
                value={form.pdf_path}
                onChange={e => setForm(f => ({ ...f, pdf_path: e.target.value }))}
                placeholder="/manuals/nombre/archivo.pdf"
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Imagen de portada (URL)</label>
              <input
                type="text"
                value={form.cover_image}
                onChange={e => setForm(f => ({ ...f, cover_image: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Orden</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={cancelEdit}
              className="px-4 py-2 text-sm text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.title || !form.slug}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Manuals Table */}
      <div className="bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-400">Cargando...</div>
        ) : manuals.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">No hay manuales registrados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-white/5">
                  <th className="text-left px-4 py-3 font-medium text-neutral-500 dark:text-white/50">
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3" />
                      Orden
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-500 dark:text-white/50">Titulo</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-500 dark:text-white/50 hidden md:table-cell">Categoria</th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-500 dark:text-white/50">Estado</th>
                  <th className="text-right px-4 py-3 font-medium text-neutral-500 dark:text-white/50">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {manuals.map(manual => (
                  <tr key={manual.id} className="border-b border-neutral-50 dark:border-white/5 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-neutral-400">{manual.sort_order}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-neutral-800 dark:text-white">{manual.title}</p>
                        <p className="text-xs text-neutral-400 dark:text-white/40">/{manual.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-white/60 hidden md:table-cell">{manual.category}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        manual.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : manual.status === 'archived'
                          ? 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-white/40'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {manual.status === 'active' ? 'Activo' : manual.status === 'archived' ? 'Archivado' : 'Borrador'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleStatus(manual)}
                          title={manual.status === 'active' ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                        >
                          {manual.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => startEdit(manual)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(manual.id)}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
