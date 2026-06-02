import { useState, useEffect, useCallback } from 'react';
import { Brain, FileText, Folder, ChartBar as BarChart3, Settings, Zap, Upload, Plus, Trash2, RefreshCw, Search, Eye, Clock, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Loader as Loader2, Database, MessageSquare, TrendingUp, Users, BookOpen, ChevronRight, X, CreditCard as Edit2 } from 'lucide-react';
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
  const [gaps, setGaps] = useState<any[]>([]);
  const [improvements, setImprovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'gaps' | 'modulos' | 'improvements'>('gaps');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { supabase } = await import('../lib/supabase');
    const [modulosData, gapsRes, improvementsRes] = await Promise.all([
      getModulosDescubiertos(),
      supabase.from('chava_knowledge_review_queue')
        .select('*')
        .order('frecuencia_consultas', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('chava_improvement_suggestions')
        .select('*')
        .order('frecuencia_detecciones', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    setModulos(modulosData);
    setGaps(gapsRes.data || []);
    setImprovements(improvementsRes.data || []);
    setLoading(false);
  };

  const handleDismissGap = async (id: string) => {
    const { supabase } = await import('../lib/supabase');
    await supabase.from('chava_knowledge_review_queue')
      .update({ estado: 'descartado', revisado_at: new Date().toISOString() })
      .eq('id', id);
    setGaps(prev => prev.filter(g => g.id !== id));
  };

  const handleApproveGap = async (id: string) => {
    const { supabase } = await import('../lib/supabase');
    await supabase.from('chava_knowledge_review_queue')
      .update({ estado: 'aprobado', revisado_at: new Date().toISOString() })
      .eq('id', id);
    setGaps(prev => prev.map(g => g.id === id ? { ...g, estado: 'aprobado' } : g));
  };

  const handleDismissImprovement = async (id: string) => {
    const { supabase } = await import('../lib/supabase');
    await supabase.from('chava_improvement_suggestions')
      .update({ estado: 'descartado' })
      .eq('id', id);
    setImprovements(prev => prev.filter(i => i.id !== id));
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-500" /></div>;
  }

  const pendingGaps = gaps.filter(g => g.estado === 'pendiente');
  const pendingImprovements = improvements.filter(i => i.estado === 'pendiente');

  return (
    <div className="space-y-6">
      {/* Section toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection('gaps')}
          className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-all", activeSection === 'gaps' ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400" : "text-neutral-500 hover:text-neutral-700")}
        >
          Brechas de Conocimiento {pendingGaps.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px]">{pendingGaps.length}</span>}
        </button>
        <button
          onClick={() => setActiveSection('improvements')}
          className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-all", activeSection === 'improvements' ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400" : "text-neutral-500 hover:text-neutral-700")}
        >
          Mejoras Detectadas {pendingImprovements.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[10px]">{pendingImprovements.length}</span>}
        </button>
        <button
          onClick={() => setActiveSection('modulos')}
          className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-all", activeSection === 'modulos' ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400" : "text-neutral-500 hover:text-neutral-700")}
        >
          Modulos ({modulos.length})
        </button>
        <Button variant="ghost" size="sm" onClick={loadData} className="ml-auto">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Knowledge Gaps */}
      {activeSection === 'gaps' && (
        <div className="space-y-2">
          {pendingGaps.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Sin brechas de conocimiento pendientes</p>
            </div>
          ) : (
            pendingGaps.map((gap) => (
              <div key={gap.id} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        gap.prioridad === 'alta' ? 'bg-red-100 text-red-700' :
                        gap.prioridad === 'media' ? 'bg-amber-100 text-amber-700' :
                        'bg-neutral-100 text-neutral-600'
                      )}>{gap.prioridad}</span>
                      <span className="text-[10px] text-neutral-400 capitalize">{gap.plataforma_destino}</span>
                      {gap.frecuencia_consultas > 1 && (
                        <span className="text-[10px] text-cyan-600 font-medium">{gap.frecuencia_consultas}x consultado</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-neutral-800 dark:text-white/80 line-clamp-1">{gap.titulo}</p>
                    <p className="text-xs text-neutral-500 dark:text-white/40 mt-1 line-clamp-2">{gap.descripcion}</p>
                    {gap.contenido_sugerido && (
                      <p className="text-xs text-teal-600 dark:text-teal-400 mt-1.5 italic line-clamp-2">Sugerencia: {gap.contenido_sugerido}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleApproveGap(gap.id)} className="text-emerald-600 hover:text-emerald-700 h-7 w-7 p-0">
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDismissGap(gap.id)} className="text-neutral-400 hover:text-red-500 h-7 w-7 p-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Improvement Suggestions */}
      {activeSection === 'improvements' && (
        <div className="space-y-2">
          {pendingImprovements.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Sin mejoras detectadas pendientes</p>
            </div>
          ) : (
            pendingImprovements.map((item) => (
              <div key={item.id} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium capitalize">{item.plataforma}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 capitalize">{item.tipo}</span>
                      {item.frecuencia_detecciones > 1 && (
                        <span className="text-[10px] text-amber-600 font-medium">{item.frecuencia_detecciones}x detectado</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-neutral-800 dark:text-white/80">{item.titulo}</p>
                    <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">{item.descripcion}</p>
                    {item.ejemplos_consultas?.length > 0 && (
                      <p className="text-[11px] text-neutral-400 mt-1 italic">Ejemplo: "{item.ejemplos_consultas[0]}"</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDismissImprovement(item.id)} className="text-neutral-400 hover:text-red-500 h-7 w-7 p-0 flex-shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modules */}
      {activeSection === 'modulos' && (
        <div className="space-y-4">
          {modulos.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <Brain className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No se han descubierto modulos aun.</p>
            </div>
          ) : (
            [...new Set(modulos.map(m => m.categoria))].map((cat) => (
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
      )}
    </div>
  );
}

// === AUDIT TAB ===
interface ToolHealth {
  herramienta: string;
  estado: string;
  ultimo_ok_at: string | null;
  ultimo_error_at: string | null;
  ultimo_error: string | null;
  tiempo_respuesta_ms: number | null;
  registros_encontrados: number | null;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  ref_id: string;
  pregunta: string | null;
  respuesta: string | null;
  modulo: string | null;
  ruta: string | null;
  tiempo_respuesta_ms: number;
  tokens_entrada: number;
  tokens_salida: number;
  modelo: string | null;
  tuvo_error: boolean;
  error_mensaje: string | null;
  error_tipo: string | null;
  herramientas_llamadas: any[];
  fuentes_utilizadas: any[];
  rol_usuario: string | null;
  created_at: string;
  usuario?: { nombre_completo: string | null } | null;
}

const TOOL_LABELS: Record<string, string> = {
  buscar_cliente: 'Buscar Cliente',
  buscar_poliza: 'Buscar Poliza',
  buscar_contacto: 'Buscar Contacto',
  buscar_usuario: 'Buscar Usuario',
  buscar_oficina: 'Buscar Oficina',
  consultar_sicas: 'SICAS Live',
  consultar_produccion: 'Produccion',
  consultar_tramites: 'Tramites',
  consultar_comisiones: 'Comisiones',
};

function ToolStatusBadge({ estado }: { estado: string }) {
  if (estado === 'ok') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />OK
    </span>
  );
  if (estado === 'error') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />Error
    </span>
  );
  if (estado === 'degraded') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />Degradado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-50 text-neutral-500 border border-neutral-200 dark:bg-white/5 dark:text-white/40 dark:border-white/10">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 inline-block" />Sin datos
    </span>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [toolHealth, setToolHealth] = useState<ToolHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterErrors, setFilterErrors] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const { supabase: sb } = await import('../lib/supabase');
    const [logsRes, healthRes] = await Promise.all([
      sb.from('chava_audit_log')
        .select('id, ref_id, pregunta, respuesta, modulo, ruta, tiempo_respuesta_ms, tokens_entrada, tokens_salida, modelo, tuvo_error, error_mensaje, error_tipo, herramientas_llamadas, fuentes_utilizadas, rol_usuario, created_at, usuario:usuarios!chava_audit_log_usuario_id_fkey(nombre_completo)')
        .order('created_at', { ascending: false })
        .limit(100),
      sb.from('chava_tool_health').select('*').order('herramienta'),
    ]);
    setLogs((logsRes.data as any[]) || []);
    setToolHealth((healthRes.data as ToolHealth[]) || []);
    setLoading(false);
  };

  const displayed = filterErrors ? logs.filter(l => l.tuvo_error) : logs;
  const errorCount = logs.filter(l => l.tuvo_error).length;
  const avgMs = logs.length > 0 ? Math.round(logs.reduce((s, l) => s + (l.tiempo_respuesta_ms || 0), 0) / logs.length) : 0;

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Tool Health Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70">Estado de Herramientas</h3>
          <Button variant="ghost" size="sm" onClick={loadAll} className="h-7 gap-1 text-xs">
            <RefreshCw className="h-3 w-3" /> Actualizar
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {toolHealth.map(tool => (
            <div key={tool.herramienta} className="p-3 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-semibold text-neutral-800 dark:text-white/80">
                  {TOOL_LABELS[tool.herramienta] || tool.herramienta}
                </span>
                <ToolStatusBadge estado={tool.estado} />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-neutral-400 flex-wrap">
                {tool.tiempo_respuesta_ms != null && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{tool.tiempo_respuesta_ms}ms
                  </span>
                )}
                {tool.registros_encontrados != null && (
                  <span className="flex items-center gap-0.5">
                    <Database className="w-3 h-3" />{tool.registros_encontrados} registros
                  </span>
                )}
                {tool.ultimo_error && (
                  <span className="text-red-400 truncate max-w-[180px]" title={tool.ultimo_error}>
                    {tool.ultimo_error.substring(0, 40)}{tool.ultimo_error.length > 40 ? '…' : ''}
                  </span>
                )}
              </div>
              {tool.ultimo_ok_at && (
                <p className="text-[10px] text-neutral-300 dark:text-white/20 mt-1">
                  OK: {new Date(tool.ultimo_ok_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Consultas', value: logs.length, color: 'text-cyan-600' },
          { label: 'Errores', value: errorCount, color: 'text-red-500' },
          { label: 'Tiempo prom.', value: `${avgMs}ms`, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="p-3 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70">Registro de Consultas</h3>
            <span className="text-xs text-neutral-400">{displayed.length} entradas</span>
          </div>
          <button
            onClick={() => setFilterErrors(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              filterErrors
                ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                : 'bg-neutral-100 text-neutral-500 dark:bg-white/5 dark:text-white/40 hover:bg-neutral-200 dark:hover:bg-white/10'
            )}
          >
            <AlertCircle className="w-3 h-3" />
            {filterErrors ? 'Ver todos' : `Solo errores (${errorCount})`}
          </button>
        </div>

        {displayed.length === 0 ? (
          <div className="text-center py-12 text-neutral-400">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin entradas en el log</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
            {displayed.map((log) => (
              <div
                key={log.id}
                className={cn(
                  'rounded-xl border transition-colors',
                  log.tuvo_error
                    ? 'bg-red-50/50 border-red-100 dark:bg-red-500/5 dark:border-red-500/15'
                    : 'bg-white dark:bg-white/[0.02] border-neutral-200/60 dark:border-white/8'
                )}
              >
                <button
                  className="w-full text-left p-3.5"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex-shrink-0 w-2 h-2 rounded-full mt-1.5',
                      log.tuvo_error ? 'bg-red-500' : 'bg-emerald-500'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                          {log.ref_id || '—'}
                        </span>
                        {log.tuvo_error && log.error_tipo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400 font-medium">
                            {log.error_tipo}
                          </span>
                        )}
                        <span className="text-[11px] text-neutral-400">{log.rol_usuario}</span>
                        <span className="text-[11px] text-neutral-400">{log.modelo}</span>
                        <span className="text-[11px] text-neutral-400">{log.tiempo_respuesta_ms}ms</span>
                        <span className="text-[11px] text-neutral-400">{(log.tokens_entrada || 0) + (log.tokens_salida || 0)} tk</span>
                      </div>
                      <p className={cn(
                        'text-[13px] mt-1 line-clamp-1',
                        log.tuvo_error ? 'text-red-700 dark:text-red-300' : 'text-neutral-700 dark:text-white/70'
                      )}>
                        {log.tuvo_error ? (log.error_mensaje || 'Error desconocido') : (log.pregunta || '—')}
                      </p>
                    </div>
                    <span className="text-[10px] text-neutral-300 dark:text-white/20 flex-shrink-0 mt-0.5">
                      {new Date(log.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </button>

                {expandedId === log.id && (
                  <div className="px-4 pb-4 pt-1 border-t border-neutral-100 dark:border-white/5 space-y-3">
                    {log.pregunta && (
                      <div>
                        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Pregunta</p>
                        <p className="text-sm text-neutral-700 dark:text-white/70 bg-neutral-50 dark:bg-white/[0.03] rounded-lg p-2.5">{log.pregunta}</p>
                      </div>
                    )}
                    {log.respuesta && !log.tuvo_error && (
                      <div>
                        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Respuesta</p>
                        <p className="text-xs text-neutral-600 dark:text-white/50 line-clamp-4 bg-neutral-50 dark:bg-white/[0.03] rounded-lg p-2.5">{log.respuesta}</p>
                      </div>
                    )}
                    {log.tuvo_error && log.error_mensaje && (
                      <div>
                        <p className="text-[11px] font-semibold text-red-400 uppercase tracking-wide mb-1">Error</p>
                        <pre className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/5 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">{log.error_mensaje}</pre>
                      </div>
                    )}
                    {log.herramientas_llamadas && log.herramientas_llamadas.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Herramientas ({log.herramientas_llamadas.length})</p>
                        <div className="space-y-1">
                          {log.herramientas_llamadas.map((t: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[11px] bg-neutral-50 dark:bg-white/[0.03] rounded px-2 py-1.5">
                              {t.error
                                ? <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                : <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                              <span className="font-mono font-medium text-neutral-600 dark:text-white/60">{t.tool}</span>
                              <span className="text-neutral-400">{t.duration_ms}ms</span>
                              {t.output_summary && <span className="text-neutral-400 truncate">{t.output_summary}</span>}
                              {t.error && <span className="text-red-500 truncate">{t.error}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {log.fuentes_utilizadas && log.fuentes_utilizadas.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Fuentes RAG ({log.fuentes_utilizadas.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {log.fuentes_utilizadas.map((f: any, i: number) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-500/20">
                              {f.documento_titulo || f.source}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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

// === CONFIG TAB ===
function ConfigTab() {
  const [configs, setConfigs] = useState<ChavaConfigItem[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [knowledgeStats, setKnowledgeStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [tierForm, setTierForm] = useState<Record<string, any>>({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const [configData, tiersRes, statsRes] = await Promise.all([
      getChavaConfig(),
      import('../lib/supabase').then(({ supabase }) =>
        supabase.from('chava_access_tiers').select('*').order('id')
      ),
      import('../lib/supabase').then(({ supabase }) =>
        supabase.from('chava_knowledge_access_summary').select('*')
      ),
    ]);
    setConfigs(configData);
    setTiers(tiersRes.data || []);
    setKnowledgeStats(statsRes.data || []);
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

  const handleSaveTier = async (tierId: string) => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase
        .from('chava_access_tiers')
        .update({
          max_tokens_respuesta: Number(tierForm.max_tokens_respuesta),
          max_historial_mensajes: Number(tierForm.max_historial_mensajes),
          max_consultas_sesion: tierForm.max_consultas_sesion ? Number(tierForm.max_consultas_sesion) : null,
          modelo_ia: tierForm.modelo_ia,
          temperatura: Number(tierForm.temperatura),
          rag_similitud_minima: Number(tierForm.rag_similitud_minima),
          max_fragmentos_rag: Number(tierForm.max_fragmentos_rag),
          updated_at: new Date().toISOString(),
        })
        .eq('id', tierId);
      if (error) throw error;
      setEditingTier(null);
      loadConfig();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-500" /></div>;
  }

  const tierColors: Record<string, string> = {
    internal: 'border-cyan-200 bg-cyan-50/30 dark:bg-cyan-500/5',
    external: 'border-teal-200 bg-teal-50/30 dark:bg-teal-500/5',
    public: 'border-amber-200 bg-amber-50/30 dark:bg-amber-500/5',
  };

  const tierIcons: Record<string, string> = {
    internal: 'text-cyan-600',
    external: 'text-teal-600',
    public: 'text-amber-600',
  };

  return (
    <div className="space-y-8">
      {/* Access Tiers Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-neutral-800 dark:text-white/80">Niveles de Acceso Chava AI</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => {
            const stats = knowledgeStats.find((s: any) => s.tier_id === tier.id);
            const isEditing = editingTier === tier.id;

            return (
              <div key={tier.id} className={cn("p-4 rounded-xl border", tierColors[tier.id] || 'border-neutral-200')}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={cn("text-sm font-bold", tierIcons[tier.id] || 'text-neutral-700')}>{tier.nombre}</h4>
                  <button
                    onClick={() => {
                      if (isEditing) { setEditingTier(null); }
                      else { setEditingTier(tier.id); setTierForm(tier); }
                    }}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    {isEditing ? <X className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-white/40 mb-3 line-clamp-2">{tier.descripcion}</p>

                {/* Knowledge stats */}
                {stats && (
                  <div className="flex gap-3 mb-3 text-[11px]">
                    <span className="text-neutral-500"><Folder className="h-3 w-3 inline mr-0.5" />{stats.carpetas_accesibles} carpetas</span>
                    <span className="text-neutral-500"><FileText className="h-3 w-3 inline mr-0.5" />{stats.archivos_accesibles} archivos</span>
                    <span className="text-neutral-500"><Database className="h-3 w-3 inline mr-0.5" />{stats.chunks_indexados} chunks</span>
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-2 mt-3 pt-3 border-t border-neutral-200/60 dark:border-white/10">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-neutral-500 font-medium">Modelo IA</label>
                        <input
                          value={tierForm.modelo_ia || ''}
                          onChange={(e) => setTierForm({ ...tierForm, modelo_ia: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs rounded border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 font-medium">Temperatura</label>
                        <input
                          type="number" step="0.05" min="0" max="2"
                          value={tierForm.temperatura || 0}
                          onChange={(e) => setTierForm({ ...tierForm, temperatura: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs rounded border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 font-medium">Max Tokens Resp</label>
                        <input
                          type="number" step="100"
                          value={tierForm.max_tokens_respuesta || 0}
                          onChange={(e) => setTierForm({ ...tierForm, max_tokens_respuesta: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs rounded border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 font-medium">Historial Msgs</label>
                        <input
                          type="number"
                          value={tierForm.max_historial_mensajes || 0}
                          onChange={(e) => setTierForm({ ...tierForm, max_historial_mensajes: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs rounded border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 font-medium">Similitud Min</label>
                        <input
                          type="number" step="0.01" min="0" max="1"
                          value={tierForm.rag_similitud_minima || 0}
                          onChange={(e) => setTierForm({ ...tierForm, rag_similitud_minima: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs rounded border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-500 font-medium">Max Chunks RAG</label>
                        <input
                          type="number"
                          value={tierForm.max_fragmentos_rag || 0}
                          onChange={(e) => setTierForm({ ...tierForm, max_fragmentos_rag: e.target.value })}
                          className="w-full px-2 py-1.5 text-xs rounded border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-500 font-medium">Consultas x Sesion (vacio = ilimitado)</label>
                      <input
                        type="number"
                        value={tierForm.max_consultas_sesion || ''}
                        onChange={(e) => setTierForm({ ...tierForm, max_consultas_sesion: e.target.value })}
                        placeholder="Ilimitado"
                        className="w-full px-2 py-1.5 text-xs rounded border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
                      />
                    </div>
                    <Button size="sm" className="w-full mt-2" onClick={() => handleSaveTier(tier.id)}>
                      Guardar Cambios
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1 mt-2 text-[11px] text-neutral-500 dark:text-white/40">
                    <div className="flex justify-between"><span>Modelo:</span><span className="font-mono">{tier.modelo_ia}</span></div>
                    <div className="flex justify-between"><span>Tokens resp:</span><span>{tier.max_tokens_respuesta}</span></div>
                    <div className="flex justify-between"><span>Temperatura:</span><span>{tier.temperatura}</span></div>
                    <div className="flex justify-between"><span>Similitud:</span><span>{tier.rag_similitud_minima}</span></div>
                    <div className="flex justify-between"><span>Sesion:</span><span>{tier.max_consultas_sesion || 'Ilimitado'}</span></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legacy config items */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4 text-neutral-500" />
          <h3 className="text-sm font-bold text-neutral-800 dark:text-white/80">Configuracion General</h3>
        </div>
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
      </div>
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
