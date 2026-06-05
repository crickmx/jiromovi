import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useMoviAuth } from '@/contexts/MoviAuthContext';
import { RichTextEditor } from '@/components/RichTextEditor';
import { FileText, Plus, Check, Pencil, Eye, Clock, Shield, Users, ChevronRight, X, TriangleAlert as AlertTriangle } from 'lucide-react';

interface PlatformTerms {
  id: string;
  version: number;
  titulo: string;
  contenido_html: string;
  tipo: 'terminos' | 'privacidad';
  activo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Acceptance {
  id: string;
  usuario_id: string;
  terms_version: number;
  platform: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  usuario_nombre?: string;
  usuario_email?: string;
}

type Tab = 'terminos' | 'privacidad' | 'aceptaciones';

export default function TerminosAdmin() {
  const { usuario } = useMoviAuth();
  const [tab, setTab] = useState<Tab>('terminos');
  const [terms, setTerms] = useState<PlatformTerms[]>([]);
  const [selected, setSelected] = useState<PlatformTerms | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ titulo: '', contenido_html: '' });

  // Acceptance audit
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [acceptanceLoading, setAcceptanceLoading] = useState(false);
  const [acceptanceCount, setAcceptanceCount] = useState(0);

  const currentTipo = tab === 'aceptaciones' ? null : tab;

  const loadTerms = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_terms')
      .select('*')
      .order('created_at', { ascending: false });
    setTerms(data || []);
    setLoading(false);
  }, []);

  const loadAcceptances = useCallback(async () => {
    setAcceptanceLoading(true);
    const { data, count } = await supabase
      .from('platform_terms_acceptance')
      .select('*', { count: 'exact' })
      .order('accepted_at', { ascending: false })
      .limit(100);
    setAcceptances(data || []);
    setAcceptanceCount(count || 0);
    setAcceptanceLoading(false);
  }, []);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  useEffect(() => {
    if (tab === 'aceptaciones') loadAcceptances();
  }, [tab, loadAcceptances]);

  const filteredTerms = terms.filter(t => t.tipo === currentTipo);

  async function handleCreate() {
    if (!form.titulo.trim() || !form.contenido_html.trim()) return;
    setSaving(true);
    const maxVersion = filteredTerms.reduce((max, t) => Math.max(max, t.version), 0);
    const { error } = await supabase.from('platform_terms').insert({
      titulo: form.titulo,
      contenido_html: form.contenido_html,
      tipo: currentTipo!,
      version: maxVersion + 1,
      activo: false,
      created_by: usuario?.id || null,
    });
    setSaving(false);
    if (!error) {
      setCreating(false);
      setForm({ titulo: '', contenido_html: '' });
      loadTerms();
    }
  }

  async function handleUpdate() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from('platform_terms')
      .update({
        titulo: form.titulo,
        contenido_html: form.contenido_html,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    setSaving(false);
    if (!error) {
      setEditing(false);
      setSelected({ ...selected, titulo: form.titulo, contenido_html: form.contenido_html });
      loadTerms();
    }
  }

  async function handleActivate(id: string) {
    // Deactivate all of same tipo, then activate this one
    await supabase
      .from('platform_terms')
      .update({ activo: false })
      .eq('tipo', currentTipo!);
    await supabase
      .from('platform_terms')
      .update({ activo: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    loadTerms();
    if (selected?.id === id) setSelected({ ...selected, activo: true });
  }

  function startEdit() {
    if (!selected) return;
    setForm({ titulo: selected.titulo, contenido_html: selected.contenido_html });
    setEditing(true);
  }

  function startCreate() {
    setSelected(null);
    setForm({ titulo: '', contenido_html: '' });
    setCreating(true);
  }

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'terminos', label: 'Términos y Condiciones', icon: FileText },
    { key: 'privacidad', label: 'Aviso de Privacidad', icon: Shield },
    { key: 'aceptaciones', label: 'Registro de Aceptaciones', icon: Users },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
              Términos y Condiciones
            </h1>
            <p className="text-xs text-neutral-500">
              Gestión unificada para MOVI Digital, Seguwallet y Chava AI
            </p>
          </div>
        </div>

        {currentTipo && (
          <button
            onClick={startCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva versión
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-white/5 rounded-2xl w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected(null); setEditing(false); setCreating(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-white/70'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'aceptaciones' ? (
        <AcceptancesPanel
          acceptances={acceptances}
          loading={acceptanceLoading}
          total={acceptanceCount}
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">
          {/* Version List */}
          <div className="w-full lg:w-72 shrink-0 bg-white dark:bg-white/5 rounded-2xl border border-neutral-100 dark:border-white/8 overflow-hidden">
            <div className="p-4 border-b border-neutral-100 dark:border-white/8">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/80">Versiones</h3>
            </div>
            <div className="divide-y divide-neutral-50 dark:divide-white/5 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-neutral-200 border-t-neutral-600 animate-spin" />
                </div>
              ) : filteredTerms.length === 0 ? (
                <div className="p-6 text-center text-sm text-neutral-400">
                  No hay versiones
                </div>
              ) : (
                filteredTerms.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelected(t); setEditing(false); setCreating(false); }}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                      selected?.id === t.id
                        ? 'bg-slate-50 dark:bg-white/8'
                        : 'hover:bg-neutral-50 dark:hover:bg-white/3'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                          v{t.version}
                        </span>
                        {t.activo && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase">
                            Activo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 truncate">{t.titulo}</p>
                      <p className="text-[10px] text-neutral-300 dark:text-white/25 mt-0.5">
                        {new Date(t.created_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="flex-1 bg-white dark:bg-white/5 rounded-2xl border border-neutral-100 dark:border-white/8 overflow-hidden flex flex-col">
            {creating ? (
              <CreatePanel
                form={form}
                setForm={setForm}
                onSave={handleCreate}
                onCancel={() => setCreating(false)}
                saving={saving}
                tipo={currentTipo!}
              />
            ) : selected ? (
              editing ? (
                <EditPanel
                  form={form}
                  setForm={setForm}
                  onSave={handleUpdate}
                  onCancel={() => setEditing(false)}
                  saving={saving}
                />
              ) : (
                <ViewPanel
                  term={selected}
                  onEdit={startEdit}
                  onActivate={() => handleActivate(selected.id)}
                />
              )
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <FileText className="w-10 h-10 text-neutral-200 dark:text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400">
                    Selecciona una versión o crea una nueva
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ViewPanel({
  term,
  onEdit,
  onActivate,
}: {
  term: PlatformTerms;
  onEdit: () => void;
  onActivate: () => void;
}) {
  return (
    <>
      <div className="p-4 border-b border-neutral-100 dark:border-white/8 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
            {term.titulo}
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[11px] text-neutral-400">
              <Clock className="w-3 h-3" />
              {new Date(term.updated_at).toLocaleString('es-MX')}
            </span>
            {term.activo && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                <Check className="w-3 h-3" />
                Versión activa
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!term.activo && (
            <button
              onClick={onActivate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Activar
            </button>
          )}
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/8 text-neutral-700 dark:text-white/70 text-xs font-semibold hover:bg-neutral-200 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-neutral-900 dark:prose-headings:text-white prose-p:text-neutral-600 dark:prose-p:text-white/60"
          dangerouslySetInnerHTML={{ __html: term.contenido_html }}
        />
      </div>
    </>
  );
}

function EditPanel({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
}: {
  form: { titulo: string; contenido_html: string };
  setForm: (f: { titulo: string; contenido_html: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <>
      <div className="p-4 border-b border-neutral-100 dark:border-white/8 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Editando versión</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/8 text-neutral-700 dark:text-white/60 text-xs font-medium hover:bg-neutral-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Guardar
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-neutral-600 dark:text-white/50 mb-1.5 block">Título</label>
          <input
            value={form.titulo}
            onChange={e => setForm({ ...form, titulo: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-500/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-600 dark:text-white/50 mb-1.5 block">Contenido</label>
          <RichTextEditor
            value={form.contenido_html}
            onChange={v => setForm({ ...form, contenido_html: v })}
            placeholder="Escribe el contenido aquí..."
            minHeight="400px"
          />
        </div>
      </div>
    </>
  );
}

function CreatePanel({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  tipo,
}: {
  form: { titulo: string; contenido_html: string };
  setForm: (f: { titulo: string; contenido_html: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  tipo: string;
}) {
  return (
    <>
      <div className="p-4 border-b border-neutral-100 dark:border-white/8 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Nueva versión — {tipo === 'terminos' ? 'Términos y Condiciones' : 'Aviso de Privacidad'}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/8 text-neutral-700 dark:text-white/60 text-xs font-medium hover:bg-neutral-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.titulo.trim() || !form.contenido_html.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Crear versión
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-neutral-600 dark:text-white/50 mb-1.5 block">Título</label>
          <input
            value={form.titulo}
            onChange={e => setForm({ ...form, titulo: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-500/20"
            placeholder="Título del documento..."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-600 dark:text-white/50 mb-1.5 block">Contenido</label>
          <RichTextEditor
            value={form.contenido_html}
            onChange={v => setForm({ ...form, contenido_html: v })}
            placeholder="Escribe el contenido aquí..."
            minHeight="400px"
          />
        </div>
      </div>
    </>
  );
}

function AcceptancesPanel({
  acceptances,
  loading,
  total,
}: {
  acceptances: Acceptance[];
  loading: boolean;
  total: number;
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-100 dark:border-white/8 p-12 flex justify-center">
        <div className="w-8 h-8 rounded-full border-3 border-neutral-200 border-t-neutral-600 animate-spin" />
      </div>
    );
  }

  if (acceptances.length === 0) {
    return (
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-100 dark:border-white/8 p-12 text-center">
        <AlertTriangle className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
        <p className="text-sm text-neutral-500">Aún no hay registros de aceptación</p>
      </div>
    );
  }

  const platformLabel: Record<string, string> = {
    movi: 'MOVI Digital',
    seguwallet: 'Seguwallet',
    chava: 'Chava AI',
  };

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl border border-neutral-100 dark:border-white/8 overflow-hidden">
      <div className="p-4 border-b border-neutral-100 dark:border-white/8 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/80">
          Registros de aceptación
        </h3>
        <span className="text-xs text-neutral-400">{total} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-white/8 text-left">
              <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase">Usuario</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase">Plataforma</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase">Tipo</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase">Versión</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase">Fecha</th>
              <th className="px-4 py-3 text-xs font-medium text-neutral-500 uppercase">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50 dark:divide-white/5">
            {acceptances.map(a => (
              <tr key={a.id} className="hover:bg-neutral-50/50 dark:hover:bg-white/3">
                <td className="px-4 py-3 text-neutral-700 dark:text-white/70 whitespace-nowrap">
                  {a.usuario_id.slice(0, 8)}...
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-medium">
                    {platformLabel[a.platform] || a.platform}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500 dark:text-white/50 text-xs">
                  {a.terms_tipo === 'terminos' ? 'T&C' : 'Privacidad'}
                </td>
                <td className="px-4 py-3 text-neutral-500 dark:text-white/50">v{a.terms_version}</td>
                <td className="px-4 py-3 text-neutral-500 dark:text-white/50 whitespace-nowrap text-xs">
                  {new Date(a.accepted_at).toLocaleString('es-MX')}
                </td>
                <td className="px-4 py-3 text-neutral-400 dark:text-white/30 text-xs font-mono">
                  {a.ip_address || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
