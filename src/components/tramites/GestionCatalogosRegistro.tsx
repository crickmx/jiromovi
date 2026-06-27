import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, Tag, Pencil, ChevronLeft, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateTiposTramiteCache } from '../../hooks/useTiposTramite';
import { InsuranceTypesList } from './catalogos/InsuranceTypesList';
import { FormBuilderTab } from './catalogos/FormBuilderTab';
import { PermisosPanel } from './catalogos/PermisosPanel';
import { HistorialPanel } from './catalogos/HistorialPanel';
import { ColorPicker } from './catalogos/ColorPicker';
import { TicketTipo, AREAS, Area, slugify } from './catalogos/types';
import { logHistorial } from './catalogos/logHistorial';

interface TipoStats { tickets: number; campos: number }

// ── Main Component ────────────────────────────────────────────────────────

export function GestionCatalogosRegistro() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ── Navigation ──────────────────────────────────────────────────────────
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTipo, setActiveTipo] = useState<TicketTipo | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'campos' | 'permisos' | 'historial'>('config');

  // ── Ticket tipos ────────────────────────────────────────────────────────
  const [tiposTramite, setTiposTramite] = useState<TicketTipo[]>([]);
  const [tiposStats, setTiposStats] = useState<Map<string, TipoStats>>(new Map());
  const [showNewTipoForm, setShowNewTipoForm] = useState(false);
  const [newTipo, setNewTipo] = useState({ label: '', area: 'Comercial' as Area, color: '#0369a1' });
  const [searchTipo, setSearchTipo] = useState('');
  const [sectionOpen, setSectionOpen] = useState({ seguros: true, tramites: true });
  const [areaOpen, setAreaOpen] = useState<Record<string, boolean>>({});

  // ── Edit - Config tab ───────────────────────────────────────────────────
  const [editConfig, setEditConfig] = useState({ label: '', area: 'Comercial' as Area, color: '#0369a1' });
  const [savingConfig, setSavingConfig] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => { loadTiposTramite(); }, []);

  const loadTiposTramite = async () => {
    const { data } = await supabase.from('ticket_tipos').select('*').order('orden');
    if (!data) return;
    const tipos = data as TicketTipo[];
    setTiposTramite(tipos);
    if (tipos.length === 0) return;

    const [ticketRes, campoRes] = await Promise.all([
      supabase.from('tickets').select('tipo').in('tipo', tipos.map(t => t.value)),
      supabase.from('tramite_tipo_campos').select('tramite_tipo_id').in('tramite_tipo_id', tipos.map(t => t.id)).eq('activo', true),
    ]);

    const ticketCount = new Map<string, number>();
    for (const r of (ticketRes.data || [])) ticketCount.set(r.tipo, (ticketCount.get(r.tipo) || 0) + 1);

    const campoCount = new Map<string, number>();
    for (const r of (campoRes.data || [])) campoCount.set(r.tramite_tipo_id, (campoCount.get(r.tramite_tipo_id) || 0) + 1);

    const stats = new Map<string, TipoStats>();
    for (const t of tipos) stats.set(t.id, { tickets: ticketCount.get(t.value) || 0, campos: campoCount.get(t.id) || 0 });
    setTiposStats(stats);
  };

  // ── Derived ─────────────────────────────────────────────────────────────

  const isDirty = activeTipo !== null && (
    editConfig.label !== activeTipo.label ||
    editConfig.color !== activeTipo.color ||
    (activeTipo.is_custom && editConfig.area !== activeTipo.area)
  );

  const filteredTipos = searchTipo.trim()
    ? tiposTramite.filter(t =>
        t.label.toLowerCase().includes(searchTipo.toLowerCase()) ||
        t.value.toLowerCase().includes(searchTipo.toLowerCase())
      )
    : tiposTramite;

  const tiposGrouped = AREAS.map(area => ({
    area,
    items: filteredTipos.filter(t => t.area === area),
  })).filter(g => g.items.length > 0);

  const isAreaOpen = (area: string) => areaOpen[area] !== false;
  const toggleArea = (area: string) => setAreaOpen(prev => ({ ...prev, [area]: !isAreaOpen(area) }));

  // ── Editor navigation ───────────────────────────────────────────────────

  const openEditor = (tipo: TicketTipo) => {
    setActiveTipo(tipo);
    setEditConfig({ label: tipo.label, area: tipo.area as Area, color: tipo.color });
    setActiveTab('config');
    setView('edit');
  };

  const closeEditor = () => {
    setView('list');
    setActiveTipo(null);
  };

  const switchTab = (tab: 'config' | 'campos' | 'permisos' | 'historial') => {
    if (activeTab === 'config' && isDirty && !confirm('Tienes cambios sin guardar en Configuración. ¿Continuar sin guardar?')) return;
    setActiveTab(tab);
  };

  // ── Config handlers ─────────────────────────────────────────────────────

  const handleSaveConfig = async () => {
    if (!activeTipo || !editConfig.label.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSavingConfig(true);
    const payload: Record<string, string> = { label: editConfig.label.trim(), color: editConfig.color };
    if (activeTipo.is_custom) payload.area = editConfig.area;
    const { error } = await supabase.from('ticket_tipos').update(payload).eq('id', activeTipo.id);
    if (error) { showToast('Error: ' + error.message, 'error'); }
    else {
      const cambios: Record<string, any> = {};
      if (editConfig.label.trim() !== activeTipo.label) { cambios.label_antes = activeTipo.label; cambios.label_despues = editConfig.label.trim(); }
      if (editConfig.color !== activeTipo.color) { cambios.color_antes = activeTipo.color; cambios.color_despues = editConfig.color; }
      if (activeTipo.is_custom && editConfig.area !== activeTipo.area) { cambios.area_antes = activeTipo.area; cambios.area_despues = editConfig.area; }
      if (Object.keys(cambios).length > 0) logHistorial(activeTipo.id, 'config_actualizada', cambios, usuario?.id, usuario?.nombre_completo);
      setActiveTipo({ ...activeTipo, ...payload });
      invalidateTiposTramiteCache();
      await loadTiposTramite();
      showToast('Tipo de trámite actualizado');
    }
    setSavingConfig(false);
  };

  // ── Tipo tramite list handlers ──────────────────────────────────────────

  const handleCreateTipo = async () => {
    if (!newTipo.label.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    const value = slugify(newTipo.label);
    if (!value) { showToast('El nombre no genera un identificador válido', 'error'); return; }
    setLoading(true);
    const maxOrden = tiposTramite.reduce((m, t) => Math.max(m, t.orden), 0);
    const { data: newData, error } = await supabase.from('ticket_tipos').insert({
      value, label: newTipo.label.trim(), area: newTipo.area, color: newTipo.color,
      activo: true, is_custom: true, orden: maxOrden + 1,
    }).select().single();
    setLoading(false);
    if (error) {
      showToast(error.message?.includes('unique') ? 'Ya existe un tipo con ese nombre' : ('Error: ' + error.message), 'error');
      return;
    }
    if (newData) logHistorial(newData.id, 'tipo_creado', { label: newTipo.label.trim(), area: newTipo.area, color: newTipo.color }, usuario?.id, usuario?.nombre_completo);
    showToast('Tipo de trámite creado');
    setNewTipo({ label: '', area: 'Comercial', color: '#0369a1' });
    setShowNewTipoForm(false);
    invalidateTiposTramiteCache();
    await loadTiposTramite();
  };

  const handleToggleTipo = async (id: string, current: boolean) => {
    await supabase.from('ticket_tipos').update({ activo: !current }).eq('id', id);
    invalidateTiposTramiteCache();
    await loadTiposTramite();
  };

  const handleDeleteTipo = async (id: string) => {
    const tipo = tiposTramite.find(t => t.id === id);
    if (!tipo) return;
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('tipo', tipo.value);
    const n = count || 0;
    const msg = n > 0
      ? `Este tipo tiene ${n} trámite${n !== 1 ? 's' : ''} registrado${n !== 1 ? 's' : ''}. Al eliminarlo esos trámites quedarán sin tipo asignado. ¿Continuar?`
      : '¿Eliminar este tipo de trámite personalizado? No se puede deshacer.';
    if (!confirm(msg)) return;
    const { error } = await supabase.from('ticket_tipos').delete().eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Tipo eliminado');
    invalidateTiposTramiteCache();
    await loadTiposTramite();
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl p-6">
        <p className="text-neutral-600">Solo los administradores pueden gestionar catálogos.</p>
      </div>
    );
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  const ToastEl = toast ? (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 ${
      toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {toast.msg}
    </div>
  ) : null;

  // ── Edit panel ─────────────────────────────────────────────────────────
  if (view === 'edit' && activeTipo) {
    return (
      <div className="flex flex-col" style={{ minHeight: 480 }}>
        {ToastEl}

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-neutral-50 shrink-0">
          <button onClick={closeEditor} className="p-1.5 hover:bg-neutral-200 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: activeTipo.color }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-neutral-900 truncate">{activeTipo.label}</p>
            <p className="text-[11px] text-neutral-400 font-mono">{activeTipo.value}</p>
          </div>
          {!activeTipo.is_custom && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
              Integrado
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 bg-white shrink-0">
          {[
            { id: 'config',    label: 'Configuración' },
            { id: 'campos',    label: 'Campos del formulario' },
            { id: 'permisos',  label: 'Permisos' },
            { id: 'historial', label: 'Historial' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id as any)}
              className={`relative px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-neutral-500 border-transparent hover:text-neutral-700'
              }`}
            >
              {tab.label}
              {tab.id === 'config' && isDirty && (
                <span className="absolute top-2 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          ))}
        </div>

        {/* Tab: Configuración */}
        {activeTab === 'config' && (
          <div className="p-5 space-y-5 overflow-auto">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={editConfig.label}
                onChange={(e) => setEditConfig({ ...editConfig, label: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
            {activeTipo.is_custom && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Área</label>
                <select
                  value={editConfig.area}
                  onChange={(e) => setEditConfig({ ...editConfig, area: e.target.value as Area })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                >
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Color</label>
              <ColorPicker value={editConfig.color} onChange={(c) => setEditConfig({ ...editConfig, color: c })} />
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingConfig ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}

        {/* Tab: Campos */}
        {activeTab === 'campos' && (
          <FormBuilderTab tipoId={activeTipo.id} showToast={showToast} />
        )}

        {/* Tab: Permisos */}
        {activeTab === 'permisos' && (
          <PermisosPanel tipoId={activeTipo.id} usuarioId={usuario?.id} showToast={showToast} />
        )}

        {/* Tab: Historial */}
        {activeTab === 'historial' && (
          <HistorialPanel tipoId={activeTipo.id} />
        )}
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-10 p-6">
      {ToastEl}

      <InsuranceTypesList
        showToast={showToast}
        collapsed={!sectionOpen.seguros}
        onToggleCollapse={() => setSectionOpen(s => ({ ...s, seguros: !s.seguros }))}
      />

      {/* ── Tipos de Trámite ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSectionOpen(s => ({ ...s, tramites: !s.tramites }))}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
          >
            {sectionOpen.tramites
              ? <ChevronDown className="w-5 h-5 text-neutral-400 shrink-0" />
              : <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />}
            <Tag className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-neutral-900">
                Tipos de Trámite
                <span className="ml-2 text-sm font-normal text-neutral-400">({tiposTramite.length})</span>
              </h2>
              {sectionOpen.tramites && (
                <p className="text-xs text-neutral-500 mt-0.5">Haz clic en editar para configurar campos y permisos</p>
              )}
            </div>
          </button>
          <button
            onClick={() => setShowNewTipoForm(!showNewTipoForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Tipo
          </button>
        </div>

        {sectionOpen.tramites && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchTipo}
              onChange={(e) => setSearchTipo(e.target.value)}
              placeholder="Buscar tipo de trámite..."
              className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
        )}

        {sectionOpen.tramites && showNewTipoForm && (
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
                  onChange={(e) => setNewTipo({ ...newTipo, area: e.target.value as Area })}
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
            <div className="flex gap-2">
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

        {sectionOpen.tramites && (filteredTipos.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">
            {searchTipo ? 'Sin resultados para esa búsqueda' : 'No hay tipos de trámite registrados'}
          </p>
        ) : (
          <div className="space-y-4">
            {tiposGrouped.map(({ area, items }) => (
              <div key={area} className="border border-neutral-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleArea(area)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-neutral-50 hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isAreaOpen(area)
                      ? <ChevronDown className="w-4 h-4 text-neutral-400" />
                      : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{area}</span>
                    <span className="text-xs text-neutral-400">({items.length})</span>
                  </div>
                </button>
                {isAreaOpen(area) && <div className="divide-y divide-neutral-100">
                  {items.map(tipo => (
                    <div
                      key={tipo.id}
                      className={`flex items-center gap-3 p-3 bg-white ${!tipo.activo ? 'opacity-60' : ''}`}
                    >
                      <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: tipo.color }} />
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
                        {(() => {
                          const st = tiposStats.get(tipo.id);
                          if (!st) return null;
                          return (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-neutral-400">{st.tickets} trámite{st.tickets !== 1 ? 's' : ''}</span>
                              {st.campos > 0 && (
                                <>
                                  <span className="text-[10px] text-neutral-300">·</span>
                                  <span className="text-[10px] text-neutral-400">{st.campos} campo{st.campos !== 1 ? 's' : ''}</span>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditor(tipo)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar tipo"
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
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
