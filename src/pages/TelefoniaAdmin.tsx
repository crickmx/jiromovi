import { useState, useEffect, useCallback } from 'react';
import { Phone, Settings, Users, Building2, RefreshCw, Activity, Plus, Trash2, CreditCard as Edit2, Check, X, Wifi, WifiOff, Download, ArrowUpDown, Search, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Clock, Loader as Loader2 } from 'lucide-react';
import * as telefoniaService from '../lib/telefoniaService';
import type {
  TelefoniaConfig, TelefoniaOficinaConfig, TelefoniaExtension,
  TelefoniaUsuario, TelefoniaSyncLog, BulkSyncPreviewItem
} from '../lib/telefoniaService';
import { supabase } from '../lib/supabase';

type Tab = 'config' | 'oficinas' | 'extensiones' | 'asignaciones' | 'sync';

export default function TelefoniaAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>('config');

  const tabs: { id: Tab; label: string; icon: typeof Phone }[] = [
    { id: 'config', label: 'Configuracion', icon: Settings },
    { id: 'oficinas', label: 'Rangos por Oficina', icon: Building2 },
    { id: 'extensiones', label: 'Extensiones', icon: Phone },
    { id: 'asignaciones', label: 'Asignaciones', icon: Users },
    { id: 'sync', label: 'Sincronizacion', icon: RefreshCw },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
          <Phone className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Telefonia</h1>
          <p className="text-sm text-neutral-500">Administracion del modulo Yeastar Linkus PBX</p>
        </div>
      </div>

      <div className="border-b border-neutral-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'oficinas' && <OficinasTab />}
        {activeTab === 'extensiones' && <ExtensionesTab />}
        {activeTab === 'asignaciones' && <AsignacionesTab />}
        {activeTab === 'sync' && <SyncTab />}
      </div>
    </div>
  );
}

// ── Config Tab ───────────────────────────────────────────────────────────────

function ConfigTab() {
  const [config, setConfig] = useState<TelefoniaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [form, setForm] = useState({
    api_mode: 'mock' as 'mock' | 'live',
    auto_sync: false,
    sync_interval_minutes: 60,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await telefoniaService.getConfig();
      if (data) {
        setConfig(data);
        setForm({
          api_mode: data.api_mode,
          auto_sync: data.auto_sync,
          sync_interval_minutes: data.sync_interval_minutes,
        });
      }
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await telefoniaService.upsertConfig(form);
      setConfig(saved);
      setTestResult(null);
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await telefoniaService.testYeastarConnection();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Estado de Conexion PBX</h2>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-xs text-emerald-700">
              La URL y credenciales del PBX se configuran de forma segura como secretos del Edge Function. No se almacenan en la base de datos ni son visibles desde la interfaz.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <Activity className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Modo actual: <span className="font-semibold">{form.api_mode === 'mock' ? 'Simulado (Mock)' : 'Produccion (Live)'}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Modo de operacion</h3>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={form.api_mode === 'mock'}
                onChange={() => setForm(f => ({ ...f, api_mode: 'mock' }))}
                className="text-blue-600"
              />
              <span className="text-sm text-neutral-700">Mock (simulado)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={form.api_mode === 'live'}
                onChange={() => setForm(f => ({ ...f, api_mode: 'live' }))}
                className="text-blue-600"
              />
              <span className="text-sm text-neutral-700">Live (produccion)</span>
            </label>
          </div>
          {form.api_mode === 'mock' && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              En modo mock, todas las operaciones se simulan localmente sin contactar al PBX real.
            </p>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">Auto-sincronizacion</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.auto_sync}
                onChange={e => setForm(f => ({ ...f, auto_sync: e.target.checked }))}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-neutral-700">Activar sync automatico</span>
            </label>
            {form.auto_sync && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">cada</span>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={form.sync_interval_minutes}
                  onChange={e => setForm(f => ({ ...f, sync_interval_minutes: Number(e.target.value) }))}
                  className="w-20 px-2 py-1 border border-neutral-300 rounded text-sm"
                />
                <span className="text-sm text-neutral-500">minutos</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar Configuracion
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 disabled:opacity-50 flex items-center gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            Probar Conexion
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Oficinas Tab ─────────────────────────────────────────────────────────────

function OficinasTab() {
  const [ranges, setRanges] = useState<TelefoniaOficinaConfig[]>([]);
  const [oficinas, setOficinas] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRange, setNewRange] = useState({ oficina_id: '', rango_inicio: 100, rango_fin: 199, prefijo: '', descripcion: '' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [rangesData, oficinasData] = await Promise.all([
        telefoniaService.getOficinasConfig(),
        supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre'),
      ]);
      setRanges(rangesData);
      setOficinas(oficinasData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newRange.oficina_id) return;
    try {
      await telefoniaService.createOficinaConfig(newRange);
      setShowAdd(false);
      setNewRange({ oficina_id: '', rango_inicio: 100, rango_fin: 199, prefijo: '', descripcion: '' });
      loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este rango?')) return;
    try {
      await telefoniaService.deleteOficinaConfig(id);
      loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-neutral-900">Rangos de Extension por Oficina</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Agregar Rango
        </button>
      </div>

      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={newRange.oficina_id}
              onChange={e => setNewRange(r => ({ ...r, oficina_id: e.target.value }))}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="">Seleccionar oficina...</option>
              {oficinas.map(o => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
            <input
              type="number"
              value={newRange.rango_inicio}
              onChange={e => setNewRange(r => ({ ...r, rango_inicio: Number(e.target.value) }))}
              placeholder="Inicio"
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            />
            <input
              type="number"
              value={newRange.rango_fin}
              onChange={e => setNewRange(r => ({ ...r, rango_fin: Number(e.target.value) }))}
              placeholder="Fin"
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            />
            <input
              type="text"
              value={newRange.prefijo}
              onChange={e => setNewRange(r => ({ ...r, prefijo: e.target.value }))}
              placeholder="Prefijo (opcional)"
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Guardar
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg text-sm hover:bg-neutral-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Oficina</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Rango</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Prefijo</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Estado</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {ranges.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">No hay rangos configurados</td></tr>
            ) : ranges.map(r => (
              <tr key={r.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 font-medium text-neutral-900">{r.oficina?.nombre || '—'}</td>
                <td className="px-4 py-3 text-neutral-700">{r.rango_inicio} – {r.rango_fin}</td>
                <td className="px-4 py-3 text-neutral-500">{r.prefijo || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.activo ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>
                    {r.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Extensiones Tab ──────────────────────────────────────────────────────────

function ExtensionesTab() {
  const [extensiones, setExtensiones] = useState<TelefoniaExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ oficina_id: '', desde: 100, hasta: 199 });
  const [oficinas, setOficinas] = useState<{ id: string; nombre: string }[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [extData, oficinasData] = await Promise.all([
        telefoniaService.getExtensiones(),
        supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre'),
      ]);
      setExtensiones(extData);
      setOficinas(oficinasData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!genForm.oficina_id || genForm.desde > genForm.hasta) return;
    setGenerating(true);
    try {
      const extensions = [];
      for (let i = genForm.desde; i <= genForm.hasta; i++) {
        extensions.push({
          extension: String(i),
          oficina_id: genForm.oficina_id,
          nombre_display: `Ext ${i}`,
        });
      }
      const count = await telefoniaService.bulkCreateExtensions(extensions);
      alert(`${count} extensiones creadas`);
      setShowGenerate(false);
      loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar extension?')) return;
    try {
      await telefoniaService.deleteExtension(id);
      loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  const filtered = extensiones.filter(e =>
    !search || e.extension.includes(search) || e.nombre_display.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar extension..."
            className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Generar Extensiones
        </button>
      </div>

      {showGenerate && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800">Generar extensiones en lote</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={genForm.oficina_id}
              onChange={e => setGenForm(f => ({ ...f, oficina_id: e.target.value }))}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="">Seleccionar oficina...</option>
              {oficinas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <input
              type="number"
              value={genForm.desde}
              onChange={e => setGenForm(f => ({ ...f, desde: Number(e.target.value) }))}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
              placeholder="Desde"
            />
            <input
              type="number"
              value={genForm.hasta}
              onChange={e => setGenForm(f => ({ ...f, hasta: Number(e.target.value) }))}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
              placeholder="Hasta"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {generating && <Loader2 className="w-3 h-3 animate-spin" />}
              Generar ({Math.max(0, genForm.hasta - genForm.desde + 1)} ext.)
            </button>
            <button
              onClick={() => setShowGenerate(false)}
              className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg text-sm hover:bg-neutral-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Extension</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Oficina</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-neutral-600">Asignado a</th>
                <th className="px-4 py-3 text-right font-medium text-neutral-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No hay extensiones</td></tr>
              ) : filtered.slice(0, 100).map(ext => (
                <tr key={ext.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono font-semibold text-neutral-900">{ext.extension}</td>
                  <td className="px-4 py-3 text-neutral-700">{ext.nombre_display || '—'}</td>
                  <td className="px-4 py-3 text-neutral-500">{ext.oficina?.nombre || '—'}</td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={ext.estado} />
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {ext.usuario ? `${ext.usuario.nombre} ${ext.usuario.apellido}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(ext.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500">
            Mostrando 100 de {filtered.length} extensiones
          </div>
        )}
      </div>
    </div>
  );
}

// ── Asignaciones Tab ─────────────────────────────────────────────────────────

function AsignacionesTab() {
  const [asignaciones, setAsignaciones] = useState<TelefoniaUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; apellido: string; email: string }[]>([]);
  const [availableExts, setAvailableExts] = useState<TelefoniaExtension[]>([]);
  const [assignForm, setAssignForm] = useState({ usuario_id: '', extension: '' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await telefoniaService.getUsuariosAsignados();
      setAsignaciones(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function openAssignModal() {
    const [usrRes, extRes] = await Promise.all([
      supabase.from('usuarios').select('id, nombre, apellido, email').eq('activo', true).order('nombre'),
      telefoniaService.getExtensiones(),
    ]);
    setUsuarios(usrRes.data || []);
    setAvailableExts(extRes.filter(e => e.estado === 'disponible'));
    setShowAssign(true);
  }

  async function handleAssign() {
    if (!assignForm.usuario_id || !assignForm.extension) return;
    try {
      await telefoniaService.assignExtension(assignForm);
      setShowAssign(false);
      setAssignForm({ usuario_id: '', extension: '' });
      loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  async function handleUnassign(id: string, extension: string) {
    if (!confirm('Desasignar extension?')) return;
    try {
      await telefoniaService.unassignExtension(id, extension);
      loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-neutral-900">Asignaciones Usuario-Extension</h2>
        <button
          onClick={openAssignModal}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Asignar Extension
        </button>
      </div>

      {showAssign && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={assignForm.usuario_id}
              onChange={e => setAssignForm(f => ({ ...f, usuario_id: e.target.value }))}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="">Seleccionar usuario...</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre} {u.apellido} ({u.email})</option>
              ))}
            </select>
            <select
              value={assignForm.extension}
              onChange={e => setAssignForm(f => ({ ...f, extension: e.target.value }))}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="">Seleccionar extension...</option>
              {availableExts.map(e => (
                <option key={e.id} value={e.extension}>{e.extension} – {e.nombre_display}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAssign} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Asignar
            </button>
            <button onClick={() => setShowAssign(false)} className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg text-sm hover:bg-neutral-300">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Usuario</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Extension</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600">Ultima Sync</th>
              <th className="px-4 py-3 text-right font-medium text-neutral-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {asignaciones.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No hay asignaciones</td></tr>
            ) : asignaciones.map(a => (
              <tr key={a.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-neutral-900">{a.usuario?.nombre} {a.usuario?.apellido}</div>
                  <div className="text-xs text-neutral-500">{a.usuario?.email}</div>
                </td>
                <td className="px-4 py-3 font-mono font-semibold">{a.extension}</td>
                <td className="px-4 py-3 text-neutral-500 capitalize">{a.tipo}</td>
                <td className="px-4 py-3"><EstadoBadge estado={a.estado} /></td>
                <td className="px-4 py-3 text-neutral-500 text-xs">
                  {a.last_synced_at ? new Date(a.last_synced_at).toLocaleString('es-MX') : 'Nunca'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleUnassign(a.id, a.extension)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sync Tab ─────────────────────────────────────────────────────────────────

function SyncTab() {
  const [logs, setLogs] = useState<TelefoniaSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<BulkSyncPreviewItem[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      const data = await telefoniaService.getSyncLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGeneratePreview() {
    setGenerating(true);
    try {
      const data = await telefoniaService.generateBulkSyncPreview();
      setPreview(data);
    } catch (err: any) {
      alert('Error generando preview: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleBulkSync() {
    if (!preview) return;
    const toCreate = preview.filter(p => p.accion === 'crear' && p.extension_propuesta);
    if (toCreate.length === 0) {
      alert('No hay extensiones nuevas para sincronizar');
      return;
    }

    setSyncing(true);
    try {
      const log = await telefoniaService.createSyncLog({
        tipo: 'bulk_sync',
        estado: 'en_proceso',
        detalles: { total: toCreate.length },
      });

      let success = 0;
      let errors = 0;

      for (const item of toCreate) {
        const result = await telefoniaService.syncUserToYeastar({
          number: item.extension_propuesta!,
          first_name: item.nombre,
          last_name: item.apellido,
          email_addr: item.email,
        }, 'create');

        if (result.success) {
          await telefoniaService.createExtension({
            extension: item.extension_propuesta!,
            nombre_display: `${item.nombre} ${item.apellido}`,
          });
          await telefoniaService.assignExtension({
            usuario_id: item.usuario_id,
            extension: item.extension_propuesta!,
          });
          success++;
        } else {
          errors++;
        }
      }

      await telefoniaService.updateSyncLog(log.id, {
        estado: errors > 0 ? 'error' : 'completado',
        resultado: { success, errors, total: toCreate.length },
        completed_at: new Date().toISOString(),
        error_mensaje: errors > 0 ? `${errors} extensiones con error` : null,
      });

      setPreview(null);
      loadLogs();
      alert(`Sync completado: ${success} exitosos, ${errors} errores`);
    } catch (err: any) {
      alert('Error en bulk sync: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Sincronizacion Masiva</h2>
          <button
            onClick={handleGeneratePreview}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpDown className="w-4 h-4" />}
            Generar Preview
          </button>
        </div>

        <p className="text-sm text-neutral-500 mb-4">
          Genera una previsualizacion de las extensiones que se crearian y asignarian automaticamente
          basandose en los rangos configurados por oficina.
        </p>

        {preview && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium">
                Crear: {preview.filter(p => p.accion === 'crear').length}
              </div>
              <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg font-medium">
                Sin cambios: {preview.filter(p => p.accion === 'sin_cambios').length}
              </div>
              <div className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-medium">
                Sin rango: {preview.filter(p => p.accion === 'sin_rango').length}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-neutral-600">Usuario</th>
                    <th className="px-3 py-2 text-left font-medium text-neutral-600">Oficina</th>
                    <th className="px-3 py-2 text-left font-medium text-neutral-600">Extension</th>
                    <th className="px-3 py-2 text-left font-medium text-neutral-600">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {preview.slice(0, 50).map(item => (
                    <tr key={item.usuario_id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 text-neutral-900">{item.nombre} {item.apellido}</td>
                      <td className="px-3 py-2 text-neutral-500">{item.oficina_nombre}</td>
                      <td className="px-3 py-2 font-mono">{item.extension_propuesta || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.accion === 'crear' ? 'bg-green-100 text-green-700' :
                          item.accion === 'sin_cambios' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {item.accion === 'crear' ? 'Crear' :
                           item.accion === 'sin_cambios' ? 'Sin cambios' :
                           item.accion === 'actualizar' ? 'Actualizar' : 'Sin rango'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.filter(p => p.accion === 'crear').length > 0 && (
              <button
                onClick={handleBulkSync}
                disabled={syncing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Ejecutar Sincronizacion ({preview.filter(p => p.accion === 'crear').length} extensiones)
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Historial de Sincronizacion</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-neutral-400">No hay registros de sincronizacion</p>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
                <div className={`p-1.5 rounded-lg ${
                  log.estado === 'completado' ? 'bg-green-100 text-green-600' :
                  log.estado === 'error' ? 'bg-red-100 text-red-600' :
                  log.estado === 'en_proceso' ? 'bg-blue-100 text-blue-600' :
                  'bg-neutral-100 text-neutral-500'
                }`}>
                  {log.estado === 'completado' ? <CheckCircle2 className="w-4 h-4" /> :
                   log.estado === 'error' ? <AlertCircle className="w-4 h-4" /> :
                   log.estado === 'en_proceso' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   <Clock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-900 capitalize">{log.tipo.replace('_', ' ')}</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(log.created_at).toLocaleString('es-MX')}
                    {log.error_mensaje && <span className="text-red-500 ml-2">{log.error_mensaje}</span>}
                  </div>
                </div>
                {log.resultado && (
                  <div className="text-xs text-neutral-500">
                    {(log.resultado as any).success || 0} OK / {(log.resultado as any).errors || 0} err
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared Components ────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    disponible: 'bg-green-100 text-green-700',
    asignada: 'bg-blue-100 text-blue-700',
    reservada: 'bg-amber-100 text-amber-700',
    fuera_servicio: 'bg-red-100 text-red-700',
    activo: 'bg-green-100 text-green-700',
    inactivo: 'bg-neutral-100 text-neutral-500',
    suspendido: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[estado] || 'bg-neutral-100 text-neutral-500'}`}>
      {estado.replace('_', ' ')}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-neutral-500">Cargando...</p>
      </div>
    </div>
  );
}
