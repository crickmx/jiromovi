import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Tag, Layers, Globe, Sliders, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { obtenerPreferenciasUsuarioCRM, guardarPreferenciasUsuarioCRM } from '../lib/crmUtils';
import { useAuth } from '../contexts/AuthContext';
import type { CRMCampoPersonalizado, CRMEtiqueta, CRMFuenteOrigen } from '../lib/crmTypes';

type TabKey = 'preferencias' | 'campos' | 'etiquetas' | 'fuentes';

const DASHBOARD_BLOCKS = [
  { key: 'leads_nuevos', label: 'Leads nuevos' },
  { key: 'tareas_vencidas', label: 'Tareas vencidas' },
  { key: 'tareas_hoy', label: 'Tareas de hoy' },
  { key: 'sin_seguimiento', label: 'Leads sin seguimiento' },
  { key: 'seguimiento_cotizaciones', label: 'Seguimiento de cotizaciones' },
];

export default function CRMConfiguracion() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [tab, setTab] = useState<TabKey>('preferencias');
  const [campos, setCampos] = useState<CRMCampoPersonalizado[]>([]);
  const [etiquetas, setEtiquetas] = useState<CRMEtiqueta[]>([]);
  const [fuentes, setFuentes] = useState<CRMFuenteOrigen[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const [prefs, setPrefs] = useState({
    default_view: 'dashboard',
    dashboard_blocks: ['leads_nuevos', 'tareas_vencidas', 'tareas_hoy', 'sin_seguimiento', 'seguimiento_cotizaciones'],
    no_contact_hours: 24,
    automations_active: true,
  });

  useEffect(() => {
    cargarDatos();
    if (usuario?.id) cargarPreferencias();
  }, [usuario?.id]);

  const cargarPreferencias = async () => {
    if (!usuario?.id) return;
    try {
      const data = await obtenerPreferenciasUsuarioCRM(usuario.id);
      setPrefs({
        default_view: data.default_view || 'dashboard',
        dashboard_blocks: data.dashboard_blocks || DASHBOARD_BLOCKS.map((b) => b.key),
        no_contact_hours: data.no_contact_hours ?? 24,
        automations_active: data.automations_active ?? true,
      });
    } catch (error) {
      console.error('Error al cargar preferencias:', error);
    }
  };

  const guardarPreferencias = async () => {
    if (!usuario?.id) return;
    try {
      setSavingPrefs(true);
      await guardarPreferenciasUsuarioCRM(usuario.id, prefs);
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2000);
    } catch (error) {
      console.error('Error al guardar preferencias:', error);
    } finally {
      setSavingPrefs(false);
    }
  };

  const cargarDatos = async () => {
    try {
      const [camposData, etiquetasData, fuentesData] = await Promise.all([
        supabase.from('crm_campos_personalizados').select('*').order('orden'),
        supabase.from('crm_etiquetas').select('*').order('nombre'),
        supabase.from('crm_fuentes_origen').select('*').order('nombre'),
      ]);
      setCampos(camposData.data || []);
      setEtiquetas(etiquetasData.data || []);
      setFuentes(fuentesData.data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const agregarCampo = async () => {
    const nombreCampo = prompt('Nombre del campo (sin espacios):');
    if (!nombreCampo) return;
    const etiqueta = prompt('Etiqueta visible:');
    if (!etiqueta) return;
    const tipoCampo = prompt('Tipo (Texto/Numero/Fecha/Selector):');
    if (!tipoCampo || !['Texto', 'Número', 'Fecha', 'Selector'].includes(tipoCampo)) {
      alert('Tipo invalido');
      return;
    }
    try {
      setLoading(true);
      await supabase.from('crm_campos_personalizados').insert({
        nombre_campo: nombreCampo.toLowerCase().replace(/\s+/g, '_'),
        etiqueta,
        tipo_campo: tipoCampo,
        opciones_selector: tipoCampo === 'Selector' ? ['Opcion 1', 'Opcion 2'] : [],
        activo: true,
        orden: campos.length,
      });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const eliminarCampo = async (id: string) => {
    if (!confirm('Eliminar este campo?')) return;
    await supabase.from('crm_campos_personalizados').delete().eq('id', id);
    cargarDatos();
  };

  const agregarEtiqueta = async () => {
    const nombre = prompt('Nombre de la etiqueta:');
    if (!nombre) return;
    try {
      setLoading(true);
      await supabase.from('crm_etiquetas').insert({ nombre, color: '#3b82f6', activo: true });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const eliminarEtiqueta = async (id: string) => {
    if (!confirm('Eliminar esta etiqueta?')) return;
    await supabase.from('crm_etiquetas').delete().eq('id', id);
    cargarDatos();
  };

  const agregarFuente = async () => {
    const nombre = prompt('Nombre de la fuente de origen:');
    if (!nombre) return;
    try {
      setLoading(true);
      await supabase.from('crm_fuentes_origen').insert({ nombre, activo: true });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const eliminarFuente = async (id: string) => {
    if (!confirm('Eliminar esta fuente?')) return;
    await supabase.from('crm_fuentes_origen').delete().eq('id', id);
    cargarDatos();
  };

  const toggleDashboardBlock = (key: string) => {
    setPrefs((prev) => ({
      ...prev,
      dashboard_blocks: prev.dashboard_blocks.includes(key)
        ? prev.dashboard_blocks.filter((b) => b !== key)
        : [...prev.dashboard_blocks, key],
    }));
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'preferencias', label: 'Preferencias', icon: <Sliders className="h-4 w-4" /> },
    { key: 'campos', label: 'Campos', icon: <Layers className="h-4 w-4" /> },
    { key: 'etiquetas', label: 'Etiquetas', icon: <Tag className="h-4 w-4" /> },
    { key: 'fuentes', label: 'Fuentes', icon: <Globe className="h-4 w-4" /> },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <button
          onClick={() => navigate('/mi-crm')}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-3 transition"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Mi CRM
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Configuracion</h1>
        <p className="text-sm text-gray-500 mt-0.5">Personaliza tu CRM</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 px-1">
          <div className="flex gap-0.5 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {/* Preferencias Tab */}
          {tab === 'preferencias' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Bloques del Dashboard</h3>
                <p className="text-xs text-gray-500 mb-3">Selecciona que secciones mostrar en tu dashboard de CRM</p>
                <div className="space-y-2">
                  {DASHBOARD_BLOCKS.map((block) => (
                    <label
                      key={block.key}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={prefs.dashboard_blocks.includes(block.key)}
                        onChange={() => toggleDashboardBlock(block.key)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{block.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Tiempo sin contacto</h3>
                <p className="text-xs text-gray-500 mb-3">Despues de cuantas horas se considera un lead "sin seguimiento"</p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={prefs.no_contact_hours}
                    onChange={(e) => setPrefs((p) => ({ ...p, no_contact_hours: parseInt(e.target.value) || 24 }))}
                    className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">horas</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={guardarPreferencias}
                  disabled={savingPrefs}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingPrefs ? 'Guardando...' : prefsSaved ? 'Guardado' : 'Guardar Preferencias'}
                </button>
              </div>
            </div>
          )}

          {/* Campos Tab */}
          {tab === 'campos' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Campos Personalizados</h3>
                <button
                  onClick={agregarCampo}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>
              <div className="space-y-2">
                {campos.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No hay campos personalizados</p>
                )}
                {campos.map((campo) => (
                  <div key={campo.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{campo.etiqueta}</p>
                      <p className="text-xs text-gray-500">{campo.nombre_campo} - {campo.tipo_campo}</p>
                    </div>
                    <button onClick={() => eliminarCampo(campo.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Etiquetas Tab */}
          {tab === 'etiquetas' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Etiquetas de Segmentacion</h3>
                <button
                  onClick={agregarEtiqueta}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {etiquetas.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6 w-full">No hay etiquetas</p>
                )}
                {etiquetas.map((etiqueta) => (
                  <div
                    key={etiqueta.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200"
                  >
                    <span>{etiqueta.nombre}</span>
                    <button onClick={() => eliminarEtiqueta(etiqueta.id)} className="hover:text-red-600 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fuentes Tab */}
          {tab === 'fuentes' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Fuentes de Origen</h3>
                <button
                  onClick={agregarFuente}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>
              <div className="space-y-2">
                {fuentes.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No hay fuentes de origen</p>
                )}
                {fuentes.map((fuente) => (
                  <div key={fuente.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-800">{fuente.nombre}</p>
                    <button onClick={() => eliminarFuente(fuente.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
