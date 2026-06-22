import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Shield, Tag, Pencil, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface InsuranceType {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface TicketTipo {
  id: string;
  value: string;
  label: string;
  area: string;
  color: string;
  activo: boolean;
  is_custom: boolean;
  orden: number;
  assignment_mode: string;
}

const ASSIGNMENT_MODE_LABELS: Record<string, string> = {
  direct: 'Asignación directa',
  pool:   'Cola Mesa de Control (sin asignar)',
  auto:   'Auto-asignar desde oficina',
};

const ASSIGNMENT_MODE_DESCRIPTIONS: Record<string, string> = {
  direct: 'El creador elige explícitamente el responsable al abrir el trámite.',
  pool:   'El trámite queda sin responsable. Mesa de Control o los ejecutivos se autoasignan.',
  auto:   'Se asigna automáticamente al responsable configurado en la oficina del agente.',
};

const AREAS = ['Comercial', 'Operaciones', 'Mercadotecnia', 'Administración', 'Otro'] as const;

const COLOR_SWATCHES = [
  '#0369a1', '#1d4ed8', '#0891b2', '#6366f1',
  '#7c3aed', '#9333ea', '#db2777', '#e11d48',
  '#dc2626', '#ea580c', '#b45309', '#d97706',
  '#65a30d', '#16a34a', '#059669', '#374151',
  '#64748b', '#78716c',
];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: c,
              borderColor: value === c ? '#111' : 'transparent',
              boxShadow: value === c ? '0 0 0 2px white, 0 0 0 4px #111' : undefined,
            }}
            title={c}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full border border-neutral-300 shrink-0" style={{ backgroundColor: value }} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="w-28 px-2 py-1 text-xs border border-neutral-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

export function GestionCatalogosRegistro() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Insurance types state
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [editingInsuranceType, setEditingInsuranceType] = useState<string | null>(null);
  const [newInsuranceType, setNewInsuranceType] = useState({ nombre: '', descripcion: '' });
  const [editInsuranceData, setEditInsuranceData] = useState({ nombre: '', descripcion: '' });
  const [showNewInsuranceForm, setShowNewInsuranceForm] = useState(false);

  // Ticket tipos state
  const [tiposTramite, setTiposTramite] = useState<TicketTipo[]>([]);
  const [editingTipo, setEditingTipo] = useState<string | null>(null);
  const [showNewTipoForm, setShowNewTipoForm] = useState(false);
  const [newTipo, setNewTipo] = useState({ label: '', area: 'Comercial' as typeof AREAS[number], color: '#0369a1' });
  const [editTipoData, setEditTipoData] = useState({ label: '', area: 'Comercial' as typeof AREAS[number], color: '#0369a1', assignment_mode: 'direct' });

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadCatalogs();
    loadTiposTramite();
  }, []);

  const flash = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
    else { setError(msg); setTimeout(() => setError(''), 4000); }
  };

  const loadCatalogs = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('insurance_types')
        .select('*')
        .order('nombre');
      if (fetchError) throw fetchError;
      if (data) setInsuranceTypes(data);
    } catch (err: any) {
      flash('Error al cargar catálogos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTiposTramite = async () => {
    const { data, error: fetchError } = await supabase
      .from('ticket_tipos')
      .select('*')
      .order('orden');
    if (fetchError) { console.error(fetchError); return; }
    if (data) setTiposTramite(data as TicketTipo[]);
  };

  // --- Insurance type handlers ---

  const handleCreateInsuranceType = async () => {
    if (!newInsuranceType.nombre.trim()) { flash('El nombre es obligatorio', 'error'); return; }
    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('insurance_types')
        .insert({ nombre: newInsuranceType.nombre.trim(), descripcion: newInsuranceType.descripcion.trim() || null, activo: true });
      if (insertError) throw insertError;
      flash('Tipo de seguro creado exitosamente');
      setNewInsuranceType({ nombre: '', descripcion: '' });
      setShowNewInsuranceForm(false);
      await loadCatalogs();
    } catch (err: any) {
      flash(err.message || 'Error al crear tipo de seguro', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditInsuranceType = async (id: string) => {
    if (!editInsuranceData.nombre.trim()) { flash('El nombre es obligatorio', 'error'); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('insurance_types')
        .update({ nombre: editInsuranceData.nombre.trim(), descripcion: editInsuranceData.descripcion.trim() || null })
        .eq('id', id);
      if (updateError) throw updateError;
      flash('Tipo de seguro actualizado exitosamente');
      setEditingInsuranceType(null);
      await loadCatalogs();
    } catch (err: any) {
      flash(err.message || 'Error al actualizar tipo de seguro', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleInsuranceType = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('insurance_types')
        .update({ activo: !currentStatus })
        .eq('id', id);
      if (updateError) throw updateError;
      flash(`Tipo de seguro ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`);
      await loadCatalogs();
    } catch (err: any) {
      flash(err.message || 'Error al cambiar estado', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInsuranceType = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este tipo de seguro? Esta acción no se puede deshacer.')) return;
    setLoading(true);
    try {
      const { error: deleteError } = await supabase.from('insurance_types').delete().eq('id', id);
      if (deleteError) throw deleteError;
      flash('Tipo de seguro eliminado exitosamente');
      await loadCatalogs();
    } catch (err: any) {
      flash(err.message || 'Error al eliminar tipo de seguro', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Ticket tipo handlers ---

  const handleCreateTipo = async () => {
    if (!newTipo.label.trim()) { flash('El nombre es obligatorio', 'error'); return; }
    const value = slugify(newTipo.label);
    if (!value) { flash('El nombre no genera un identificador válido', 'error'); return; }
    setLoading(true);
    try {
      const maxOrden = tiposTramite.reduce((m, t) => Math.max(m, t.orden), 0);
      const { error: insertError } = await supabase
        .from('ticket_tipos')
        .insert({ value, label: newTipo.label.trim(), area: newTipo.area, color: newTipo.color, activo: true, is_custom: true, orden: maxOrden + 1 });
      if (insertError) throw insertError;
      flash('Tipo de trámite creado exitosamente');
      setNewTipo({ label: '', area: 'Comercial', color: '#0369a1' });
      setShowNewTipoForm(false);
      await loadTiposTramite();
    } catch (err: any) {
      flash(err.message?.includes('unique') ? 'Ya existe un tipo con ese nombre' : (err.message || 'Error al crear'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEditTipo = (t: TicketTipo) => {
    setEditingTipo(t.id);
    setEditTipoData({ label: t.label, area: t.area as typeof AREAS[number], color: t.color, assignment_mode: t.assignment_mode || 'direct' });
  };

  const handleEditTipo = async (id: string, isCustom: boolean) => {
    if (!editTipoData.label.trim()) { flash('El nombre es obligatorio', 'error'); return; }
    setLoading(true);
    try {
      const updatePayload: Record<string, string> = {
        label: editTipoData.label.trim(),
        color: editTipoData.color,
        assignment_mode: editTipoData.assignment_mode,
      };
      if (isCustom) updatePayload.area = editTipoData.area;
      const { error: updateError } = await supabase.from('ticket_tipos').update(updatePayload).eq('id', id);
      if (updateError) throw updateError;
      flash('Tipo de trámite actualizado');
      setEditingTipo(null);
      await loadTiposTramite();
    } catch (err: any) {
      flash(err.message || 'Error al actualizar', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTipo = async (id: string, current: boolean) => {
    const { error: updateError } = await supabase.from('ticket_tipos').update({ activo: !current }).eq('id', id);
    if (updateError) { flash('Error al cambiar estado', 'error'); return; }
    await loadTiposTramite();
  };

  const handleDeleteTipo = async (id: string) => {
    if (!confirm('¿Eliminar este tipo de trámite personalizado? No se puede deshacer.')) return;
    setLoading(true);
    try {
      const { error: deleteError } = await supabase.from('ticket_tipos').delete().eq('id', id);
      if (deleteError) throw deleteError;
      flash('Tipo de trámite eliminado');
      await loadTiposTramite();
    } catch (err: any) {
      flash(err.message || 'Error al eliminar', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-neutral-600">Solo los administradores pueden gestionar catálogos.</p>
      </div>
    );
  }

  const tiposGrouped = AREAS.map(area => ({
    area,
    items: tiposTramite.filter(t => t.area === area),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-10 p-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      {/* ── Tipos de Seguro ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-neutral-900">Tipos de Seguro</h2>
          </div>
          <button
            onClick={() => setShowNewInsuranceForm(!showNewInsuranceForm)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Tipo
          </button>
        </div>

        {showNewInsuranceForm && (
          <div className="bg-neutral-50 rounded-lg p-4 mb-4 space-y-3 border border-neutral-200">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={newInsuranceType.nombre}
                onChange={(e) => setNewInsuranceType({ ...newInsuranceType, nombre: e.target.value })}
                placeholder="Ej: Auto"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción</label>
              <input
                type="text"
                value={newInsuranceType.descripcion}
                onChange={(e) => setNewInsuranceType({ ...newInsuranceType, descripcion: e.target.value })}
                placeholder="Descripción opcional"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateInsuranceType}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={() => { setShowNewInsuranceForm(false); setNewInsuranceType({ nombre: '', descripcion: '' }); }}
                className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {insuranceTypes.length === 0 ? (
            <p className="text-neutral-500 text-center py-8">No hay tipos de seguro registrados</p>
          ) : (
            insuranceTypes.map((type) => (
              <div
                key={type.id}
                className={`border ${type.activo ? 'border-neutral-200' : 'border-red-200 bg-red-50'} rounded-lg p-4`}
              >
                {editingInsuranceType === type.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={editInsuranceData.nombre}
                        onChange={(e) => setEditInsuranceData({ ...editInsuranceData, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción</label>
                      <input
                        type="text"
                        value={editInsuranceData.descripcion}
                        onChange={(e) => setEditInsuranceData({ ...editInsuranceData, descripcion: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditInsuranceType(type.id)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingInsuranceType(null)}
                        className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-neutral-900">
                        {type.nombre}
                        {!type.activo && (
                          <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Inactivo</span>
                        )}
                      </h3>
                      {type.descripcion && <p className="text-sm text-neutral-600 mt-1">{type.descripcion}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingInsuranceType(type.id); setEditInsuranceData({ nombre: type.nombre, descripcion: type.descripcion || '' }); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleInsuranceType(type.id, type.activo)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${type.activo ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                      >
                        {type.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => handleDeleteInsuranceType(type.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Tipos de Trámite ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Tag className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Tipos de Trámite</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Los tipos integrados solo permiten cambiar nombre y color</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewTipoForm(!showNewTipoForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Tipo
          </button>
        </div>

        {/* Create form */}
        {showNewTipoForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 space-y-4">
            <h3 className="font-semibold text-blue-800 text-sm">Nuevo tipo de trámite</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newTipo.label}
                  onChange={(e) => setNewTipo({ ...newTipo, label: e.target.value })}
                  placeholder="Ej: Consulta Jurídica"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
                {newTipo.label && (
                  <p className="text-[11px] text-neutral-400 mt-1 font-mono">ID: {slugify(newTipo.label) || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Área</label>
                <select
                  value={newTipo.area}
                  onChange={(e) => setNewTipo({ ...newTipo, area: e.target.value as typeof AREAS[number] })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                >
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Color</label>
              <ColorPicker value={newTipo.color} onChange={(c) => setNewTipo({ ...newTipo, color: c })} />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreateTipo}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={() => { setShowNewTipoForm(false); setNewTipo({ label: '', area: 'Comercial', color: '#0369a1' }); }}
                className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* List grouped by area */}
        {tiposTramite.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">No hay tipos de trámite registrados</p>
        ) : (
          <div className="space-y-6">
            {tiposGrouped.map(({ area, items }) => (
              <div key={area}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2 px-1">{area}</h3>
                <div className="space-y-2">
                  {items.map((tipo) => (
                    <div
                      key={tipo.id}
                      className={`border rounded-xl overflow-hidden ${!tipo.activo ? 'opacity-60' : ''}`}
                      style={{ borderColor: tipo.color + '55' }}
                    >
                      {editingTipo === tipo.id ? (
                        <div className="p-4 space-y-4 bg-white">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
                              <input
                                type="text"
                                value={editTipoData.label}
                                onChange={(e) => setEditTipoData({ ...editTipoData, label: e.target.value })}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                              />
                            </div>
                            {tipo.is_custom && (
                              <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Área</label>
                                <select
                                  value={editTipoData.area}
                                  onChange={(e) => setEditTipoData({ ...editTipoData, area: e.target.value as typeof AREAS[number] })}
                                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                                >
                                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">Color</label>
                            <ColorPicker value={editTipoData.color} onChange={(c) => setEditTipoData({ ...editTipoData, color: c })} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Modo de asignación</label>
                            <div className="space-y-2">
                              {(['direct', 'pool', 'auto'] as const).map(mode => (
                                <label key={mode} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${editTipoData.assignment_mode === mode ? 'bg-blue-50 border-blue-300' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                                  <input
                                    type="radio"
                                    name="assignment_mode"
                                    value={mode}
                                    checked={editTipoData.assignment_mode === mode}
                                    onChange={() => setEditTipoData({ ...editTipoData, assignment_mode: mode })}
                                    className="mt-0.5 shrink-0"
                                  />
                                  <div>
                                    <p className="text-sm font-semibold text-neutral-800">{ASSIGNMENT_MODE_LABELS[mode]}</p>
                                    <p className="text-xs text-neutral-500 mt-0.5">{ASSIGNMENT_MODE_DESCRIPTIONS[mode]}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditTipo(tipo.id, tipo.is_custom)}
                              disabled={loading}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                            >
                              <Save className="w-4 h-4" />
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingTipo(null)}
                              className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm flex items-center gap-1.5"
                            >
                              <X className="w-4 h-4" />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-white">
                          {/* Color strip */}
                          <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: tipo.color }} />
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-neutral-900 truncate">{tipo.label}</span>
                              {!tipo.is_custom && (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
                                  Integrado
                                </span>
                              )}
                              {!tipo.activo && (
                                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                                  Inactivo
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">{tipo.value}</p>
                            {tipo.assignment_mode && tipo.assignment_mode !== 'direct' && (
                              <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${tipo.assignment_mode === 'pool' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                {ASSIGNMENT_MODE_LABELS[tipo.assignment_mode] || tipo.assignment_mode}
                              </span>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEditTipo(tipo)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {tipo.is_custom && (
                              <>
                                <button
                                  onClick={() => handleToggleTipo(tipo.id, tipo.activo)}
                                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${tipo.activo ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                                >
                                  {tipo.activo ? 'Desactivar' : 'Activar'}
                                </button>
                                <button
                                  onClick={() => handleDeleteTipo(tipo.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
