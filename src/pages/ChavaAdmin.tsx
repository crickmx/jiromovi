import { useState, useEffect, useCallback } from 'react';
import {
  Brain, FileText, Folder, BarChart3, Settings, Zap,
  Upload, Plus, Trash2, RefreshCw, Search, Eye, Clock,
  CheckCircle2, AlertCircle, Loader2, Database, MessageSquare,
  TrendingUp, Users, BookOpen, ChevronRight, X, Edit2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '@/lib/utils';
import {
  getChavaStats, getCarpetas, getDocumentos, getModulosDescubiertos,
  getChavaConfig, getConsultasLog, getEntrenamientoJobs,
  createCarpeta, createDocumento, deleteDocumento, processDocumento,
  uploadDocumentFile, updateChavaConfig, createEntrenamientoJob,
  type ChavaStats, type ChavaCarpeta, type ChavaDocumento,
  type ChavaModulo, type ChavaConfigItem, type ChavaConsultaLog,
  type ChavaEntrenamientoJob
} from '../lib/chavaAdminUtils';

type TabId = 'dashboard' | 'knowledge' | 'learning' | 'audit' | 'config' | 'training';

const TABS: { id: TabId; label: string; icon: typeof Brain }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'knowledge', label: 'Base de Conocimiento', icon: BookOpen },
  { id: 'learning', label: 'Aprendizaje', icon: Brain },
  { id: 'audit', label: 'Auditoria', icon: MessageSquare },
  { id: 'config', label: 'Configuracion', icon: Settings },
  { id: 'training', label: 'Entrenar Chava', icon: Zap },
];

export default function ChavaAdmin() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [stats, setStats] = useState<ChavaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const data = await getChavaStats();
    setStats(data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Chava IA</h1>
            <p className="text-sm text-neutral-500 dark:text-white/40">Copiloto inteligente de MOVI Digital</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadStats} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100/80 dark:bg-white/5 rounded-xl overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                activeTab === tab.id
                  ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/60"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && <DashboardTab stats={stats} loading={loading} />}
      {activeTab === 'knowledge' && <KnowledgeTab />}
      {activeTab === 'learning' && <LearningTab />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'training' && <TrainingTab />}
    </div>
  );
}

// === DASHBOARD TAB ===
function DashboardTab({ stats, loading }: { stats: ChavaStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!stats) return <p className="text-neutral-500 text-center py-10">No se pudieron cargar las estadisticas</p>;

  const kpis = [
    { label: 'Documentos Indexados', value: stats.total_documentos, icon: FileText, color: 'text-blue-600' },
    { label: 'Fragmentos', value: stats.total_fragmentos.toLocaleString(), icon: Database, color: 'text-cyan-600' },
    { label: 'Modulos Descubiertos', value: stats.total_modulos, icon: Brain, color: 'text-emerald-600' },
    { label: 'Carpetas', value: stats.total_carpetas, icon: Folder, color: 'text-amber-600' },
    { label: 'Consultas Hoy', value: stats.consultas_hoy, icon: MessageSquare, color: 'text-blue-600' },
    { label: 'Consultas Semana', value: stats.consultas_semana, icon: TrendingUp, color: 'text-cyan-600' },
    { label: 'Consultas Mes', value: stats.consultas_mes, icon: BarChart3, color: 'text-emerald-600' },
    { label: 'Tokens Mes', value: stats.tokens_mes.toLocaleString(), icon: Zap, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("h-4 w-4", kpi.color)} />
                <span className="text-xs text-neutral-500 dark:text-white/40">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Status indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2">Estado</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500 dark:text-white/40">Docs pendientes</span>
              <span className={cn("font-medium", stats.documentos_pendientes > 0 ? "text-amber-600" : "text-emerald-600")}>
                {stats.documentos_pendientes}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500 dark:text-white/40">Jobs activos</span>
              <span className={cn("font-medium", stats.jobs_activos > 0 ? "text-blue-600" : "text-neutral-400")}>
                {stats.jobs_activos}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500 dark:text-white/40">Errores semana</span>
              <span className={cn("font-medium", stats.errores_semana > 0 ? "text-red-600" : "text-emerald-600")}>
                {stats.errores_semana}
              </span>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2">Satisfaccion</h3>
          <p className="text-3xl font-bold text-neutral-900 dark:text-white">
            {stats.satisfaccion_promedio > 0 ? `${stats.satisfaccion_promedio}/5` : 'N/A'}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Promedio ultimos 30 dias</p>
        </div>
        <div className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2">RAG Status</h3>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-600">Activo</span>
          </div>
          <p className="text-xs text-neutral-400 mt-2">Base vectorial: {stats.total_fragmentos} fragmentos</p>
        </div>
      </div>
    </div>
  );
}

// === KNOWLEDGE TAB ===
function KnowledgeTab() {
  const [carpetas, setCarpetas] = useState<ChavaCarpeta[]>([]);
  const [documentos, setDocumentos] = useState<ChavaDocumento[]>([]);
  const [selectedCarpeta, setSelectedCarpeta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [carpetasData, docsData] = await Promise.all([
      getCarpetas(),
      getDocumentos(selectedCarpeta || undefined),
    ]);
    setCarpetas(carpetasData);
    setDocumentos(docsData);
    setLoading(false);
  }, [selectedCarpeta]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createCarpeta({ nombre: newFolderName.trim(), carpeta_padre_id: selectedCarpeta });
    setNewFolderName('');
    setShowNewFolder(false);
    loadData();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      try {
        const fileUrl = await uploadDocumentFile(file, selectedCarpeta || undefined);
        await createDocumento({
          carpeta_id: selectedCarpeta,
          titulo: file.name.replace(/\.[^.]+$/, ''),
          archivo_url: fileUrl,
          archivo_nombre: file.name,
          archivo_tipo: file.type,
          archivo_tamano: file.size,
          estado: 'pending',
          acceso: 'todos',
        });
      } catch (err: any) {
        console.error('Upload error:', err);
      }
    }
    setUploading(false);
    loadData();
    e.target.value = '';
  };

  const handleProcess = async (docId: string) => {
    setProcessing(docId);
    try {
      await processDocumento(docId);
      loadData();
    } catch (err: any) {
      alert('Error al procesar: ' + err.message);
    }
    setProcessing(null);
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Eliminar este documento y sus fragmentos?')) return;
    await deleteDocumento(docId);
    loadData();
  };

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'ready': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10';
      case 'processing': return 'text-blue-600 bg-blue-50 dark:bg-blue-500/10';
      case 'error': return 'text-red-600 bg-red-50 dark:bg-red-500/10';
      default: return 'text-amber-600 bg-amber-50 dark:bg-amber-500/10';
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setShowNewFolder(true)} className="gap-1.5">
          <Folder className="h-3.5 w-3.5" />
          Nueva Carpeta
        </Button>
        <label className="cursor-pointer">
          <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" asChild>
            <span>
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Subiendo...' : 'Subir Documentos'}
            </span>
          </Button>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg"
          />
        </label>
        {selectedCarpeta && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedCarpeta(null)} className="gap-1 text-neutral-500">
            <X className="h-3.5 w-3.5" /> Todas las carpetas
          </Button>
        )}
      </div>

      {/* New folder form */}
      {showNewFolder && (
        <div className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nombre de la carpeta..."
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <Button size="sm" onClick={handleCreateFolder}>Crear</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowNewFolder(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Folders */}
      {!selectedCarpeta && carpetas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {carpetas.map((carpeta) => (
            <button
              key={carpeta.id}
              onClick={() => setSelectedCarpeta(carpeta.id)}
              className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200/60 dark:border-white/8 hover:border-cyan-300/60 hover:bg-cyan-50/20 dark:hover:bg-cyan-500/5 transition-all text-left"
            >
              <Folder className="h-5 w-5 text-cyan-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-700 dark:text-white/70 truncate">{carpeta.nombre}</p>
                {carpeta.descripcion && (
                  <p className="text-xs text-neutral-400 truncate">{carpeta.descripcion}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Documents */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
        </div>
      ) : (
        <div className="space-y-2">
          {documentos.length === 0 && (
            <div className="text-center py-12 text-neutral-400 dark:text-white/30">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Sin documentos{selectedCarpeta ? ' en esta carpeta' : ''}. Sube archivos para entrenar a Chava.</p>
            </div>
          )}
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-4 p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8"
            >
              <FileText className="h-5 w-5 text-neutral-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-white/80 truncate">{doc.titulo}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", estadoColor(doc.estado))}>
                    {doc.estado}
                  </span>
                  {doc.archivo_nombre && (
                    <span className="text-[11px] text-neutral-400">{doc.archivo_nombre}</span>
                  )}
                  {doc.total_fragmentos > 0 && (
                    <span className="text-[11px] text-neutral-400">{doc.total_fragmentos} fragmentos</span>
                  )}
                  <span className="text-[11px] text-neutral-400 capitalize">{doc.acceso}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {(doc.estado === 'pending' || doc.estado === 'error') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleProcess(doc.id)}
                    disabled={processing === doc.id}
                    className="gap-1 text-cyan-600"
                  >
                    {processing === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Procesar
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// === LEARNING TAB ===
function LearningTab() {
  const [modulos, setModulos] = useState<ChavaModulo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModulos();
  }, []);

  const loadModulos = async () => {
    setLoading(true);
    const data = await getModulosDescubiertos();
    setModulos(data);
    setLoading(false);
  };

  const categorias = [...new Set(modulos.map(m => m.categoria))];

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500 dark:text-white/40">{modulos.length} modulos descubiertos</p>
        <Button variant="outline" size="sm" onClick={loadModulos} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Reescanear
        </Button>
      </div>

      {modulos.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No se han descubierto modulos aun. Ejecuta "Entrenar Chava" para iniciar el descubrimiento.</p>
        </div>
      ) : (
        categorias.map((cat) => (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-3 capitalize">{cat}</h3>
            <div className="space-y-2">
              {modulos.filter(m => m.categoria === cat).map((mod) => (
                <div key={mod.id} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-800 dark:text-white/80">{mod.nombre}</p>
                      {mod.ruta && <p className="text-xs text-neutral-400 mt-0.5 font-mono">{mod.ruta}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {mod.roles_permitidos.length > 0 && (
                        <div className="flex gap-1">
                          {mod.roles_permitidos.slice(0, 3).map(r => (
                            <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/5 text-neutral-500">{r}</span>
                          ))}
                        </div>
                      )}
                      {mod.ultima_indexacion && (
                        <span className="text-[11px] text-neutral-400">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(mod.ultima_indexacion).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {mod.descripcion && (
                    <p className="text-xs text-neutral-500 dark:text-white/40 mt-2">{mod.descripcion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// === AUDIT TAB ===
function AuditTab() {
  const [logs, setLogs] = useState<ChavaConsultaLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const data = await getConsultasLog(50);
    setLogs(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500 dark:text-white/40">{logs.length} consultas recientes</p>
        <Button variant="outline" size="sm" onClick={loadLogs} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Sin consultas registradas</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 dark:text-white/80 line-clamp-1">{log.pregunta}</p>
                  <p className="text-xs text-neutral-500 dark:text-white/40 mt-1 line-clamp-2">{log.respuesta}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-[11px] text-neutral-400">
                      {log.usuario?.nombre_completo || 'Usuario'}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {log.modelo}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {log.tokens_entrada + log.tokens_salida} tokens
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {log.tiempo_respuesta_ms}ms
                    </span>
                    {log.fuentes_utilizadas && log.fuentes_utilizadas.length > 0 && (
                      <span className="text-[11px] text-cyan-600 font-medium">
                        RAG: {log.fuentes_utilizadas.length} fuentes
                      </span>
                    )}
                    {log.error && (
                      <span className="text-[11px] text-red-500 font-medium">Error</span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-neutral-400 flex-shrink-0">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// === CONFIG TAB ===
function ConfigTab() {
  const [configs, setConfigs] = useState<ChavaConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const data = await getChavaConfig();
    setConfigs(data);
    setLoading(false);
  };

  const handleSave = async (clave: string) => {
    try {
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        parsedValue = editValue;
      }
      await updateChavaConfig(clave, parsedValue);
      setEditingKey(null);
      loadConfig();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="space-y-3">
      {configs.map((cfg) => {
        const displayValue = typeof cfg.valor === 'string' ? cfg.valor : JSON.stringify(cfg.valor);
        const isEditing = editingKey === cfg.clave;

        return (
          <div key={cfg.id} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800 dark:text-white/80 font-mono">{cfg.clave}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{cfg.descripcion}</p>
                {isEditing ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-mono"
                      onKeyDown={(e) => e.key === 'Enter' && handleSave(cfg.clave)}
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleSave(cfg.clave)}>Guardar</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingKey(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-600 dark:text-white/60 mt-1 font-mono bg-neutral-50 dark:bg-white/[0.02] px-2 py-1 rounded truncate">
                    {displayValue}
                  </p>
                )}
              </div>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setEditingKey(cfg.clave); setEditValue(displayValue); }}
                  className="flex-shrink-0"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === TRAINING TAB ===
function TrainingTab() {
  const [jobs, setJobs] = useState<ChavaEntrenamientoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    const data = await getEntrenamientoJobs();
    setJobs(data);
    setLoading(false);
  };

  const handleTrain = async (tipo: string) => {
    setCreating(true);
    try {
      await createEntrenamientoJob(tipo);
      loadJobs();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setCreating(false);
  };

  const estadoIcon = (estado: string) => {
    switch (estado) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'processing': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-500/5 dark:to-blue-500/5 rounded-xl border border-cyan-200/60 dark:border-cyan-500/20">
        <h3 className="text-sm font-bold text-neutral-800 dark:text-white/80 mb-2">Entrenar Chava</h3>
        <p className="text-xs text-neutral-500 dark:text-white/40 mb-4">
          Fuerza a Chava a reindexar modulos o documentos. Util cuando MOVI cambia y necesitas actualizar el conocimiento.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => handleTrain('completo')} disabled={creating} className="gap-1.5 bg-cyan-600 hover:bg-cyan-700">
            <Zap className="h-3.5 w-3.5" /> Reindexar Todo
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleTrain('modulo')} disabled={creating} className="gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Reindexar Modulos
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleTrain('documento')} disabled={creating} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Reprocesar Documentos
          </Button>
        </div>
      </div>

      {/* Jobs history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70">Historial de Entrenamiento</h3>
          <Button variant="ghost" size="sm" onClick={loadJobs}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-cyan-500" /></div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-8">Sin entrenamientos previos</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 p-3 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
                {estadoIcon(job.estado)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-700 dark:text-white/70 capitalize">{job.tipo}</p>
                  <p className="text-[11px] text-neutral-400">
                    {new Date(job.created_at).toLocaleString()}
                    {job.completado_at && ` - Completado: ${new Date(job.completado_at).toLocaleString()}`}
                  </p>
                </div>
                {job.estado === 'processing' && (
                  <div className="w-16">
                    <div className="h-1.5 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${job.progreso}%` }} />
                    </div>
                  </div>
                )}
                {job.error && (
                  <span className="text-[11px] text-red-500 max-w-[200px] truncate">{job.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
