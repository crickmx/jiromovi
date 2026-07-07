import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Save, Tag, Pencil, ChevronLeft, ChevronDown, ChevronRight, Search, Copy, Users, Clock, Palette } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateTiposTramiteCache } from '../../hooks/useTiposTramite';
import { FormBuilderTab } from './catalogos/FormBuilderTab';
import { PermisosPanel } from './catalogos/PermisosPanel';
import { HistorialPanel } from './catalogos/HistorialPanel';
import { TriggersTab } from './catalogos/TriggersTab';
import { EquiposHabilitadosPanel } from './catalogos/EquiposHabilitadosPanel';
import { ColorPicker } from './catalogos/ColorPicker';
import { type TicketTipo, slugify } from './catalogos/types';
import { logHistorial } from './catalogos/logHistorial';

interface TipoStats { tickets: number; campos: number }

// ── QuickEditPopover ───────────────────────────────────────────────────────
// Se renderiza en un portal a document.body con position:fixed, calculada desde
// el botón que lo abre — así nunca lo recorta un contenedor ancestro con
// overflow-hidden (como el borde redondeado de cada grupo de área) y siempre
// queda por encima de todo, sin depender del z-index/stacking context local.

function QuickEditPopover({
  anchorRect, popoverRef, className, children,
}: {
  anchorRect: { top: number; left: number; right: number; bottom: number };
  popoverRef: React.RefObject<HTMLDivElement | null>;
  className: string;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      ref={popoverRef}
      className={`fixed z-[100] ${className}`}
      style={{ top: anchorRect.bottom + 4, left: anchorRect.right, transform: 'translateX(-100%)' }}
    >
      {children}
    </div>,
    document.body
  );
}

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
  const [activeTab, setActiveTab] = useState<'config' | 'campos' | 'permisos' | 'equipos' | 'triggers' | 'historial'>('config');

  // ── Ticket tipos ────────────────────────────────────────────────────────
  const [tiposTramite, setTiposTramite] = useState<TicketTipo[]>([]);
  const [tiposStats, setTiposStats] = useState<Map<string, TipoStats>>(new Map());
  const [showNewTipoForm, setShowNewTipoForm] = useState(false);
  const [newTipo, setNewTipo] = useState({ label: '', area: '', color: '#0369a1' });
  const [searchTipo, setSearchTipo] = useState('');
  // Áreas: misma tabla maestra que usan la tab "Áreas" y el panel de Equipo — antes este
  // formulario usaba una lista hardcodeada (AREAS en types.ts) desconectada de la BD.
  const [areasDisponibles, setAreasDisponibles] = useState<{ id: string; nombre: string }[]>([]);
  const [areaOpen, setAreaOpen] = useState<Record<string, boolean>>({});
  // "Tipos de Seguro" se ocultó (2026-07-06): reemplazado por el catálogo de ramos/subramos
  // de la BD (maestro_ramos). InsuranceTypesList.tsx y la tabla insurance_types siguen
  // intactas por si se retoma, solo se quitó del render.
  const [tramitesOpen, setTramitesOpen] = useState(true);

  // ── Edit - Config tab ───────────────────────────────────────────────────
  const [editConfig, setEditConfig] = useState({ label: '', area: '', color: '#0369a1', slaDias: '' });
  const [savingConfig, setSavingConfig] = useState(false);
  const [horasProductivasDia, setHorasProductivasDia] = useState(8);

  // ── Quick-edit inline desde el listado (clonar, equipos, SLA, color) ──────
  const [quickEdit, setQuickEdit] = useState<{ tipoId: string; field: 'clone' | 'equipos' | 'sla' | 'color' } | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number; right: number; bottom: number } | null>(null);
  const [quickSla, setQuickSla] = useState('');
  const [quickColor, setQuickColor] = useState('');
  const [cloneLabel, setCloneLabel] = useState('');
  const [savingQuick, setSavingQuick] = useState(false);
  const quickEditRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!quickEdit) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (quickEditRef.current && !quickEditRef.current.contains(e.target as Node)) setQuickEdit(null);
    };
    // Cerrar en scroll (de la lista o de la página) para no dejar el popover
    // flotando en una posición que ya no corresponde a su botón.
    const handleScroll = () => setQuickEdit(null);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [quickEdit]);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => { loadTiposTramite(); }, []);
  useEffect(() => {
    supabase.from('configuracion_jornada').select('horas_productivas_dia').limit(1).single()
      .then(({ data }) => { if (data?.horas_productivas_dia) setHorasProductivasDia(data.horas_productivas_dia); });
  }, []);
  useEffect(() => { loadAreas(); }, []);

  const loadAreas = async () => {
    const { data } = await supabase.from('tramites_areas').select('id, nombre').eq('activa', true).order('nombre');
    const areas = (data || []) as { id: string; nombre: string }[];
    setAreasDisponibles(areas);
    if (areas.length > 0) {
      setNewTipo(prev => prev.area ? prev : { ...prev, area: areas[0].nombre });
    }
  };

  // Sentinel para la opción "+ Crear nueva área..." en los <select> de Área
  const NUEVA_AREA_OPTION = '__nueva_area__';

  const handleCrearAreaInline = async (onCreated: (nombre: string) => void) => {
    const name = prompt('Nombre de la nueva área:')?.trim();
    if (!name) return;
    const existing = areasDisponibles.find(a => a.nombre.toLowerCase() === name.toLowerCase());
    if (existing) { onCreated(existing.nombre); return; }
    const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
    const { data, error } = await supabase
      .from('tramites_areas')
      .insert({ nombre: name, slug, color_hex: '#94a3b8', activa: true })
      .select('id, nombre')
      .single();
    if (error) { showToast('Error al crear el área: ' + error.message, 'error'); return; }
    setAreasDisponibles(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    onCreated(data.nombre);
  };

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

  // Conversión de días hábiles (lo que ve el admin) <-> horas hábiles (lo que usa el contador)
  const horasToDiasLabel = (horas: number | null | undefined): string =>
    horas ? String(Math.round((horas / horasProductivasDia) * 10) / 10) : '';
  const diasToHoras = (dias: string): number | null => {
    const n = parseFloat(dias);
    return dias.trim() && !isNaN(n) && n > 0 ? Math.round(n * horasProductivasDia) : null;
  };

  const isDirty = activeTipo !== null && (
    editConfig.label !== activeTipo.label ||
    editConfig.color !== activeTipo.color ||
    (activeTipo.is_custom && editConfig.area !== activeTipo.area) ||
    diasToHoras(editConfig.slaDias) !== (activeTipo.sla_horas ?? null)
  );

  const filteredTipos = searchTipo.trim()
    ? tiposTramite.filter(t =>
        t.label.toLowerCase().includes(searchTipo.toLowerCase()) ||
        t.value.toLowerCase().includes(searchTipo.toLowerCase())
      )
    : tiposTramite;

  const tiposGrouped = [
    ...areasDisponibles.map(a => ({
      area: a.nombre,
      items: filteredTipos.filter(t => t.area === a.nombre),
    })),
    // Tipos cuya área ya no existe/está inactiva en tramites_areas — no deben quedar
    // invisibles solo porque el área se desactivó o aún no se sincronizó (ver migración
    // 20260706000002_sync_ticket_tipos_area_id.sql).
    { area: 'Sin área reconocida', items: filteredTipos.filter(t => !areasDisponibles.some(a => a.nombre === t.area)) },
  ].filter(g => g.items.length > 0);

  const isAreaOpen = (area: string) => areaOpen[area] !== false;
  const toggleArea = (area: string) => setAreaOpen(prev => ({ ...prev, [area]: !isAreaOpen(area) }));

  // ── Editor navigation ───────────────────────────────────────────────────

  const openEditor = (tipo: TicketTipo) => {
    setActiveTipo(tipo);
    setEditConfig({ label: tipo.label, area: tipo.area, color: tipo.color, slaDias: horasToDiasLabel(tipo.sla_horas) });
    setActiveTab('config');
    setView('edit');
  };

  const closeEditor = () => {
    setView('list');
    setActiveTipo(null);
  };

  const switchTab = (tab: 'config' | 'campos' | 'permisos' | 'equipos' | 'triggers' | 'historial') => {
    if (activeTab === 'config' && isDirty && !confirm('Tienes cambios sin guardar en Configuración. ¿Continuar sin guardar?')) return;
    setActiveTab(tab);
  };

  // ── Config handlers ─────────────────────────────────────────────────────

  const handleSaveConfig = async () => {
    if (!activeTipo || !editConfig.label.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSavingConfig(true);
    const nuevoSlaHoras = diasToHoras(editConfig.slaDias);
    const payload: Record<string, any> = { label: editConfig.label.trim(), color: editConfig.color, sla_horas: nuevoSlaHoras };
    if (activeTipo.is_custom) {
      payload.area = editConfig.area;
      payload.area_id = areasDisponibles.find(a => a.nombre === editConfig.area)?.id ?? null;
    }
    const { error } = await supabase.from('ticket_tipos').update(payload).eq('id', activeTipo.id);
    if (error) { showToast('Error: ' + error.message, 'error'); }
    else {
      const cambios: Record<string, any> = {};
      if (editConfig.label.trim() !== activeTipo.label) { cambios.label_antes = activeTipo.label; cambios.label_despues = editConfig.label.trim(); }
      if (editConfig.color !== activeTipo.color) { cambios.color_antes = activeTipo.color; cambios.color_despues = editConfig.color; }
      if (activeTipo.is_custom && editConfig.area !== activeTipo.area) { cambios.area_antes = activeTipo.area; cambios.area_despues = editConfig.area; }
      if (nuevoSlaHoras !== (activeTipo.sla_horas ?? null)) { cambios.sla_horas_antes = activeTipo.sla_horas ?? null; cambios.sla_horas_despues = nuevoSlaHoras; }
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
    if (!newTipo.area) { showToast('Selecciona un área', 'error'); return; }
    const value = slugify(newTipo.label);
    if (!value) { showToast('El nombre no genera un identificador válido', 'error'); return; }
    setLoading(true);
    const maxOrden = tiposTramite.reduce((m, t) => Math.max(m, t.orden), 0);
    const areaId = areasDisponibles.find(a => a.nombre === newTipo.area)?.id ?? null;
    const { data: newData, error } = await supabase.from('ticket_tipos').insert({
      value, label: newTipo.label.trim(), area: newTipo.area, area_id: areaId, color: newTipo.color,
      activo: true, is_custom: true, orden: maxOrden + 1,
    }).select().single();
    setLoading(false);
    if (error) {
      showToast(error.message?.includes('unique') ? 'Ya existe un tipo con ese nombre' : ('Error: ' + error.message), 'error');
      return;
    }
    if (newData) logHistorial(newData.id, 'tipo_creado', { label: newTipo.label.trim(), area: newTipo.area, color: newTipo.color }, usuario?.id, usuario?.nombre_completo);
    showToast('Tipo de trámite creado');
    setNewTipo({ label: '', area: areasDisponibles[0]?.nombre ?? '', color: '#0369a1' });
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

  // ── Quick-edit handlers ──────────────────────────────────────────────────

  const openQuickEdit = (e: React.MouseEvent<HTMLButtonElement>, tipo: TicketTipo, field: 'clone' | 'equipos' | 'sla' | 'color') => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverAnchor({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
    setQuickEdit({ tipoId: tipo.id, field });
    if (field === 'sla') setQuickSla(horasToDiasLabel(tipo.sla_horas));
    if (field === 'color') setQuickColor(tipo.color);
    if (field === 'clone') setCloneLabel(`${tipo.label} (copia)`);
  };

  // Mismo patrón que la migración manual 20260702000012_clonar_tipos_integrados_nuevo.sql:
  // copia config básica + campos custom (no-sistema, el trigger de BD ya crea los de sistema)
  // + permisos por rol. No copia equipos habilitados/triggers/reglas de asignación — son
  // automatizaciones ligadas al tipo original, no "configuración de campos".
  const handleCloneTipo = async (tipo: TicketTipo) => {
    if (!cloneLabel.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    const value = slugify(cloneLabel);
    if (!value) { showToast('El nombre no genera un identificador válido', 'error'); return; }
    setSavingQuick(true);
    try {
      const maxOrden = tiposTramite.reduce((m, t) => Math.max(m, t.orden), 0);
      const areaId = areasDisponibles.find(a => a.nombre === tipo.area)?.id ?? null;
      const { data: nuevoTipo, error: insError } = await supabase.from('ticket_tipos').insert({
        value, label: cloneLabel.trim(), area: tipo.area, area_id: areaId, color: tipo.color,
        sla_horas: tipo.sla_horas ?? null, activo: true, is_custom: true, orden: maxOrden + 1,
      }).select().single();
      if (insError) throw insError;

      const { data: campos, error: camposError } = await supabase
        .from('tramite_tipo_campos')
        .select('key, label, tipo, requerido, ayuda, display_order, config, visible_para_rol, editable_para_rol')
        .eq('tramite_tipo_id', tipo.id)
        .eq('is_sistema', false)
        .eq('activo', true)
        .order('display_order');
      if (camposError) throw camposError;

      if (campos && campos.length > 0) {
        const { error: insCamposError } = await supabase.from('tramite_tipo_campos').insert(
          campos.map(c => ({
            tramite_tipo_id: nuevoTipo.id,
            key: c.key, label: c.label, tipo: c.tipo, requerido: c.requerido, ayuda: c.ayuda,
            display_order: c.display_order, config: c.config, activo: true, is_sistema: false, sistema_key: null,
            visible_para_rol: c.visible_para_rol ?? 'todos', editable_para_rol: c.editable_para_rol ?? 'todos',
          }))
        );
        if (insCamposError) throw insCamposError;
      }

      const { data: permisosRol } = await supabase
        .from('tramite_tipo_rol_permisos')
        .select('rol, puede_ver, puede_crear, puede_editar')
        .eq('tramite_tipo_id', tipo.id);
      if (permisosRol && permisosRol.length > 0) {
        await supabase.from('tramite_tipo_rol_permisos').insert(
          permisosRol.map(p => ({
            tramite_tipo_id: nuevoTipo.id, rol: p.rol,
            puede_ver: p.puede_ver, puede_crear: p.puede_crear, puede_editar: p.puede_editar,
          }))
        );
      }

      logHistorial(nuevoTipo.id, 'tipo_creado', { label: cloneLabel.trim(), area: tipo.area, color: tipo.color, clonado_de: tipo.label }, usuario?.id, usuario?.nombre_completo);
      showToast(`"${cloneLabel.trim()}" creado como copia de "${tipo.label}"`);
      setQuickEdit(null);
      invalidateTiposTramiteCache();
      await loadTiposTramite();
    } catch (err: any) {
      showToast('Error al clonar: ' + err.message, 'error');
    } finally {
      setSavingQuick(false);
    }
  };

  const handleQuickSaveSla = async (tipo: TicketTipo) => {
    setSavingQuick(true);
    const nuevoSlaHoras = diasToHoras(quickSla);
    const { error } = await supabase.from('ticket_tipos').update({ sla_horas: nuevoSlaHoras }).eq('id', tipo.id);
    setSavingQuick(false);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    if (nuevoSlaHoras !== (tipo.sla_horas ?? null)) {
      logHistorial(tipo.id, 'config_actualizada', { sla_horas_antes: tipo.sla_horas ?? null, sla_horas_despues: nuevoSlaHoras }, usuario?.id, usuario?.nombre_completo);
    }
    showToast('SLA actualizado');
    setQuickEdit(null);
    invalidateTiposTramiteCache();
    await loadTiposTramite();
  };

  const handleQuickSaveColor = async (tipo: TicketTipo) => {
    setSavingQuick(true);
    const { error } = await supabase.from('ticket_tipos').update({ color: quickColor }).eq('id', tipo.id);
    setSavingQuick(false);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    if (quickColor !== tipo.color) {
      logHistorial(tipo.id, 'config_actualizada', { color_antes: tipo.color, color_despues: quickColor }, usuario?.id, usuario?.nombre_completo);
    }
    showToast('Color actualizado');
    setQuickEdit(null);
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
            { id: 'equipos',   label: 'Equipos habilitados' },
            { id: 'triggers',  label: 'Triggers de Estatus' },
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
                  onChange={(e) => {
                    if (e.target.value === NUEVA_AREA_OPTION) {
                      handleCrearAreaInline((nombre) => setEditConfig(prev => ({ ...prev, area: nombre })));
                      return;
                    }
                    setEditConfig({ ...editConfig, area: e.target.value });
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                >
                  {areasDisponibles.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                  <option value={NUEVA_AREA_OPTION}>+ Crear nueva área...</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tiempo de respuesta (SLA)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editConfig.slaDias}
                  onChange={(e) => setEditConfig({ ...editConfig, slaDias: e.target.value })}
                  placeholder="Sin límite"
                  className="w-32 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
                <span className="text-sm text-neutral-500">días hábiles</span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {editConfig.slaDias.trim()
                  ? `≈ ${diasToHoras(editConfig.slaDias) ?? '—'} horas hábiles (jornada de ${horasProductivasDia}h/día) — el contador sigue trabajando en horas hábiles, esto es solo para configurar más fácil.`
                  : 'Deja vacío si este tipo de trámite no tiene un tiempo de respuesta comprometido.'}
              </p>
            </div>
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
          <FormBuilderTab tipoId={activeTipo.id} showToast={showToast} onGoToTriggers={() => switchTab('triggers')} />
        )}

        {/* Tab: Permisos — oculta 2026-07-06, ver CLAUDE.md "Sección Permisos del FormBuilder".
            Ya no se usa: "Editar" por Rol/Usuario se agregó al tab dedicado Admin > Trámites > Permisos
            (PermisosTipoBulkTab.tsx), que ya cubría Ver/Crear. No se borró PermisosPanel.tsx ni las
            tablas por si se necesita reactivar. */}

        {/* Tab: Equipos habilitados */}
        {activeTab === 'equipos' && (
          <EquiposHabilitadosPanel tipoId={activeTipo.id} area={activeTipo.area} showToast={showToast} />
        )}

        {/* Tab: Triggers */}
        {activeTab === 'triggers' && (
          <TriggersTab tipoId={activeTipo.id} showToast={showToast} />
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

      {/* ── Tipos de Trámite ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setTramitesOpen(v => !v)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
          >
            {tramitesOpen
              ? <ChevronDown className="w-5 h-5 text-neutral-400 shrink-0" />
              : <ChevronRight className="w-5 h-5 text-neutral-400 shrink-0" />}
            <Tag className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-neutral-900">
                Tipos de Trámite
                <span className="ml-2 text-sm font-normal text-neutral-400">({tiposTramite.length})</span>
              </h2>
              {tramitesOpen && (
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

        {tramitesOpen && (
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

        {tramitesOpen && showNewTipoForm && (
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
                  onChange={(e) => {
                    if (e.target.value === NUEVA_AREA_OPTION) {
                      handleCrearAreaInline((nombre) => setNewTipo(prev => ({ ...prev, area: nombre })));
                      return;
                    }
                    setNewTipo({ ...newTipo, area: e.target.value });
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                >
                  {areasDisponibles.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                  <option value={NUEVA_AREA_OPTION}>+ Crear nueva área...</option>
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

        {tramitesOpen && (filteredTipos.length === 0 ? (
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
                {isAreaOpen(area) && (
                <div className="divide-y divide-neutral-100">
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
                        <div className="relative">
                          <button
                            onClick={(e) => openQuickEdit(e, tipo, 'clone')}
                            className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Clonar tipo"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {quickEdit?.tipoId === tipo.id && quickEdit.field === 'clone' && popoverAnchor && (
                            <QuickEditPopover anchorRect={popoverAnchor} popoverRef={quickEditRef} className="w-72 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 space-y-2">
                              <label className="block text-xs font-medium text-neutral-600">Nombre del nuevo tipo</label>
                              <input
                                type="text"
                                autoFocus
                                value={cloneLabel}
                                onChange={(e) => setCloneLabel(e.target.value)}
                                className="w-full px-2 py-1.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                              <p className="text-[10px] text-neutral-400">Copia campos del formulario y permisos por rol. No copia equipos habilitados ni triggers.</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCloneTipo(tipo)}
                                  disabled={savingQuick}
                                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                  {savingQuick ? 'Clonando...' : 'Clonar'}
                                </button>
                                <button onClick={() => setQuickEdit(null)} className="px-3 py-1.5 bg-neutral-100 rounded-lg text-xs hover:bg-neutral-200 transition-colors">
                                  Cancelar
                                </button>
                              </div>
                            </QuickEditPopover>
                          )}
                        </div>

                        <div className="relative">
                          <button
                            onClick={(e) => openQuickEdit(e, tipo, 'equipos')}
                            className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Equipos habilitados"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          {quickEdit?.tipoId === tipo.id && quickEdit.field === 'equipos' && popoverAnchor && (
                            <QuickEditPopover anchorRect={popoverAnchor} popoverRef={quickEditRef} className="w-80 bg-white border border-neutral-200 rounded-xl shadow-xl max-h-96 overflow-auto">
                              <EquiposHabilitadosPanel tipoId={tipo.id} area={tipo.area} showToast={showToast} />
                            </QuickEditPopover>
                          )}
                        </div>

                        <div className="relative">
                          <button
                            onClick={(e) => openQuickEdit(e, tipo, 'sla')}
                            className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Tiempo de respuesta (SLA)"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                          {quickEdit?.tipoId === tipo.id && quickEdit.field === 'sla' && popoverAnchor && (
                            <QuickEditPopover anchorRect={popoverAnchor} popoverRef={quickEditRef} className="w-64 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 space-y-2">
                              <label className="block text-xs font-medium text-neutral-600">Tiempo de respuesta (SLA)</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  autoFocus
                                  value={quickSla}
                                  onChange={(e) => setQuickSla(e.target.value)}
                                  placeholder="Sin límite"
                                  className="w-20 px-2 py-1.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <span className="text-xs text-neutral-500">días hábiles</span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleQuickSaveSla(tipo)}
                                  disabled={savingQuick}
                                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                  Guardar
                                </button>
                                <button onClick={() => setQuickEdit(null)} className="px-3 py-1.5 bg-neutral-100 rounded-lg text-xs hover:bg-neutral-200 transition-colors">
                                  Cancelar
                                </button>
                              </div>
                            </QuickEditPopover>
                          )}
                        </div>

                        <div className="relative">
                          <button
                            onClick={(e) => openQuickEdit(e, tipo, 'color')}
                            className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Color"
                          >
                            <Palette className="w-4 h-4" />
                          </button>
                          {quickEdit?.tipoId === tipo.id && quickEdit.field === 'color' && popoverAnchor && (
                            <QuickEditPopover anchorRect={popoverAnchor} popoverRef={quickEditRef} className="w-64 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 space-y-3">
                              <ColorPicker value={quickColor} onChange={setQuickColor} />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleQuickSaveColor(tipo)}
                                  disabled={savingQuick}
                                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                  Guardar
                                </button>
                                <button onClick={() => setQuickEdit(null)} className="px-3 py-1.5 bg-neutral-100 rounded-lg text-xs hover:bg-neutral-200 transition-colors">
                                  Cancelar
                                </button>
                              </div>
                            </QuickEditPopover>
                          )}
                        </div>

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
                )}
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
