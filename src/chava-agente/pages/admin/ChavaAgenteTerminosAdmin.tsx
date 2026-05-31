import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { ChavaTerms } from '../../lib/types';
import { ChavaBrandLogo } from '../../../components/chava/ChavaBrandLogo';
import { FileText, Plus, CircleCheck as CheckCircle, CreditCard as Edit3, Save, X } from 'lucide-react';

export default function ChavaAgenteTerminosAdmin() {
  const [terms, setTerms] = useState<ChavaTerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChavaTerms | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ version: '', titulo: '', contenido_terminos: '', contenido_privacidad: '' });
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadTerms(); }, []);

  async function loadTerms() {
    setLoading(true);
    const { data } = await supabase
      .from('chava_agente_terms')
      .select('*')
      .order('created_at', { ascending: false });
    setTerms((data || []) as ChavaTerms[]);
    setLoading(false);
  }

  async function activateVersion(id: string) {
    // Deactivate all, then activate selected
    await supabase.from('chava_agente_terms').update({ activo: false }).neq('id', 'none');
    await supabase.from('chava_agente_terms').update({ activo: true }).eq('id', id);
    setTerms(prev => prev.map(t => ({ ...t, activo: t.id === id })));
  }

  async function saveNew() {
    if (!form.version.trim() || !form.contenido_terminos.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('chava_agente_terms')
      .insert({
        version: form.version.trim(),
        titulo: form.titulo.trim() || `Términos y Condiciones v${form.version.trim()}`,
        contenido_terminos: form.contenido_terminos.trim(),
        contenido_privacidad: form.contenido_privacidad.trim(),
        activo: false,
      })
      .select('*')
      .single();
    if (!error && data) {
      setTerms(prev => [data as ChavaTerms, ...prev]);
      setShowNew(false);
      setForm({ version: '', titulo: '', contenido_terminos: '', contenido_privacidad: '' });
    }
    setSaving(false);
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from('chava_agente_terms')
      .update({
        titulo: form.titulo,
        contenido_terminos: form.contenido_terminos,
        contenido_privacidad: form.contenido_privacidad,
      })
      .eq('id', selected.id);
    if (!error) {
      setTerms(prev => prev.map(t => t.id === selected.id ? { ...t, ...form } : t));
      setSelected(prev => prev ? { ...prev, ...form } : null);
      setEditing(false);
    }
    setSaving(false);
  }

  function startEdit(t: ChavaTerms) {
    setForm({ version: t.version, titulo: t.titulo, contenido_terminos: t.contenido_terminos, contenido_privacidad: t.contenido_privacidad });
    setEditing(true);
    setSelected(t);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <ChavaBrandLogo size="sm" theme="light" showDomain={false} />
            <div className="w-px h-6 bg-slate-200" />
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-500" />
              Términos y Condiciones
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">Gestiona las versiones de términos y política de privacidad.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 text-sm font-semibold text-white bg-cyan-500 hover:bg-cyan-600 px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva versión
        </button>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Versions list */}
        <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">Versiones</div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" /></div>
            ) : terms.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelected(t); setEditing(false); }}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected?.id === t.id ? 'bg-cyan-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 flex-1">v{t.version}</p>
                  {t.activo && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      <CheckCircle className="w-3 h-3" />
                      Activa
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{t.titulo}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{new Date(t.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          {!selected && !showNew ? (
            <div className="flex-1 flex items-center justify-center text-center px-8">
              <div>
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Selecciona una versión para ver el contenido</p>
              </div>
            </div>
          ) : showNew ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-800">Nueva versión de términos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Versión</label>
                  <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="2.0" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Título</label>
                  <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Términos y Condiciones..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Contenido — Términos y Condiciones</label>
                <textarea value={form.contenido_terminos} onChange={e => setForm(f => ({ ...f, contenido_terminos: e.target.value }))} rows={8} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-400 resize-y" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Contenido — Política de Privacidad</label>
                <textarea value={form.contenido_privacidad} onChange={e => setForm(f => ({ ...f, contenido_privacidad: e.target.value }))} rows={8} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-400 resize-y" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
                <button onClick={saveNew} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-cyan-500 hover:bg-cyan-600 rounded-lg disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Crear versión'}
                </button>
              </div>
            </div>
          ) : selected && (
            <>
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">v{selected.version} — {selected.titulo}</p>
                  <p className="text-xs text-slate-500">{new Date(selected.created_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!selected.activo && (
                    <button onClick={() => activateVersion(selected.id)} className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 border border-emerald-200 hover:border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Activar
                    </button>
                  )}
                  {!editing ? (
                    <button onClick={() => startEdit(selected)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors hover:bg-slate-50">
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                      <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 text-xs font-medium text-white bg-cyan-500 hover:bg-cyan-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
                        <Save className="w-3.5 h-3.5" />
                        {saving ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {editing ? (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Términos y Condiciones</label>
                      <textarea value={form.contenido_terminos} onChange={e => setForm(f => ({ ...f, contenido_terminos: e.target.value }))} rows={10} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-400 resize-y" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Política de Privacidad</label>
                      <textarea value={form.contenido_privacidad} onChange={e => setForm(f => ({ ...f, contenido_privacidad: e.target.value }))} rows={10} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-cyan-400 resize-y" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Términos y Condiciones</p>
                      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.contenido_terminos}</div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Política de Privacidad</p>
                      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.contenido_privacidad}</div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
