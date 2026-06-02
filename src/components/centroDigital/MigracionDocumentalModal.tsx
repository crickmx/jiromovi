import { useState, useRef, useEffect } from 'react';
import { X, Upload, FolderOpen, ChevronRight, CircleCheck as CheckCircle, CircleAlert as AlertCircle, RefreshCw, FileText, Download, Brain, ChartBar as BarChart3, Folder } from 'lucide-react';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import type { CentroDigitalCarpeta } from '../../lib/centroDigitalTypes';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'preview' | 'download' | 'index';

interface JobStats {
  job_id: string;
  total_cards: number;
  total_links: number;
  descargables: number;
  no_descargables: number;
  duplicados: number;
  aseguradoras: string[];
}

interface ProgressState {
  processed: number;
  successful: number;
  errors: number;
  remaining: number;
}

const STEP_LABELS: Record<Step, string> = {
  upload: 'Cargar HTML',
  preview: 'Vista previa',
  download: 'Descargando',
  index: 'Indexando',
};

const STEP_ORDER: Step[] = ['upload', 'preview', 'download', 'index'];

export function MigracionDocumentalModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('Migración Documental');
  const [carpetas, setCarpetas] = useState<CentroDigitalCarpeta[]>([]);
  const [carpetaId, setCarpetaId] = useState<string>('');
  const [loadingCarpetas, setLoadingCarpetas] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [jobStats, setJobStats] = useState<JobStats | null>(null);
  const [progress, setProgress] = useState<ProgressState>({ processed: 0, successful: 0, errors: 0, remaining: 0 });
  const [indexProgress, setIndexProgress] = useState<ProgressState>({ processed: 0, successful: 0, errors: 0, remaining: 0 });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadCarpetas();
    return () => { if (pollingRef.current) clearTimeout(pollingRef.current); };
  }, []);

  async function loadCarpetas() {
    setLoadingCarpetas(true);
    const { data } = await supabase
      .from('centro_digital_carpetas')
      .select('id, nombre, activa, parent_id')
      .eq('activa', true)
      .is('parent_id', null)
      .order('nombre');
    setCarpetas((data as any[]) || []);
    setLoadingCarpetas(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.html') || file.name.endsWith('.htm'))) {
      setHtmlFile(file);
      setError(null);
    } else {
      setError('Solo se aceptan archivos .html o .htm');
    }
  }

  async function handleParse() {
    if (!htmlFile) return;
    if (!carpetaId) { setError('Selecciona una carpeta de destino'); return; }
    setParsing(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesion activa');

      const form = new FormData();
      form.append('html_file', htmlFile);
      form.append('titulo', titulo);
      form.append('carpeta_destino_id', carpetaId);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-parse-html`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: form,
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al analizar el HTML');

      setJobStats({ job_id: json.job_id, ...json.stats });
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  async function startDownload() {
    if (!jobStats?.job_id) return;
    setStep('download');
    setProgress({ processed: 0, successful: 0, errors: 0, remaining: jobStats.descargables });
    await runDownloadBatch(jobStats.job_id);
  }

  async function runDownloadBatch(jobId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesion');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-process-downloads`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ job_id: jobId, batch_size: 5 }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error en la descarga');

      setProgress(prev => ({
        processed: prev.processed + (json.processed || 0),
        successful: prev.successful + (json.successful || 0),
        errors: prev.errors + (json.errors || 0),
        remaining: json.remaining ?? 0,
      }));

      if ((json.remaining ?? 0) > 0) {
        pollingRef.current = setTimeout(() => runDownloadBatch(jobId), 800);
      } else {
        setIndexProgress({ processed: 0, successful: 0, errors: 0, remaining: progress.successful + (json.successful || 0) });
        setStep('index');
        await runIndexBatch(jobId);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function runIndexBatch(jobId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesion');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-index-batch`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ job_id: jobId, batch_size: 3 }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error en indexación');

      setIndexProgress(prev => ({
        processed: prev.processed + (json.processed || 0),
        successful: prev.successful + (json.indexed || 0),
        errors: prev.errors + (json.errors || 0),
        remaining: json.remaining ?? 0,
      }));

      if ((json.remaining ?? 0) > 0) {
        pollingRef.current = setTimeout(() => runIndexBatch(jobId), 1200);
      } else {
        setDone(true);
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  const currentStepIdx = STEP_ORDER.indexOf(step);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Migración Documental</h2>
            <p className="text-xs text-gray-500 mt-0.5">Importa documentos desde un HTML y almacénalos en el Centro Digital</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b bg-gray-50 flex-shrink-0">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                i < currentStepIdx ? 'text-green-600' :
                i === currentStepIdx ? 'bg-blue-50 text-blue-700' :
                'text-gray-400'
              }`}>
                {i < currentStepIdx
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold border-current">{i + 1}</span>
                }
                {STEP_LABELS[s]}
              </div>
              {i < STEP_ORDER.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Título de la importación</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Carpeta de destino (raíz)</label>
                {loadingCarpetas ? (
                  <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                ) : (
                  <select
                    value={carpetaId}
                    onChange={e => setCarpetaId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
                  >
                    <option value="">Selecciona una carpeta...</option>
                    {carpetas.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-gray-500 mt-1.5">Se crearán subcarpetas automáticamente por ramo dentro de esta carpeta.</p>
              </div>

              {/* Drop zone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Archivo HTML</label>
                <div
                  ref={dragRef}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    htmlFile ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                  }`}
                >
                  {htmlFile ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm font-medium text-green-700">{htmlFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(htmlFile.size / 1024).toFixed(1)} KB — clic para cambiar</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm font-medium text-gray-700">Arrastra tu archivo HTML aquí</p>
                      <p className="text-xs text-gray-500 mt-1">o haz clic para seleccionar</p>
                      <p className="text-xs text-gray-400 mt-3">Formatos: .html .htm</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.htm"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setHtmlFile(f); setError(null); }
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && jobStats && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Documentos', value: jobStats.descargables, icon: FileText, color: 'blue' },
                  { label: 'Duplicados', value: jobStats.duplicados, icon: RefreshCw, color: 'amber' },
                  { label: 'No descargables', value: jobStats.no_descargables, icon: AlertCircle, color: 'gray' },
                  { label: 'Total enlaces', value: jobStats.total_links, icon: BarChart3, color: 'slate' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className={`rounded-xl p-3.5 border ${
                    color === 'blue' ? 'bg-blue-50 border-blue-100' :
                    color === 'amber' ? 'bg-amber-50 border-amber-100' :
                    'bg-gray-50 border-gray-100'
                  }`}>
                    <Icon className={`w-4 h-4 mb-1.5 ${
                      color === 'blue' ? 'text-blue-500' :
                      color === 'amber' ? 'text-amber-500' :
                      'text-gray-400'
                    }`} />
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {jobStats.aseguradoras.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Aseguradoras detectadas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {jobStats.aseguradoras.map(a => (
                      <span key={a} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-2.5">
                  <Folder className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Organización automática por ramo</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Los documentos se agruparán en subcarpetas según el ramo detectado (GMM, Vida, Autos, etc.)
                      dentro de la carpeta de destino seleccionada.
                    </p>
                  </div>
                </div>
              </div>

              {jobStats.descargables === 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                    <p className="text-sm text-amber-700">No se encontraron documentos descargables en este HTML.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Download */}
          {step === 'download' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Descargando documentos</p>
                  <p className="text-xs text-gray-500">Los archivos se están guardando en el Centro Digital</p>
                </div>
                <RefreshCw className="w-4 h-4 text-blue-500 animate-spin ml-auto" />
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Progreso</span>
                  <span>{progress.processed} procesados · {progress.remaining} restantes</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  {jobStats && jobStats.descargables > 0 && (
                    <div
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (progress.processed / jobStats.descargables) * 100)}%` }}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
                  <p className="text-xl font-bold text-green-700">{progress.successful}</p>
                  <p className="text-xs text-green-600 mt-0.5">Guardados</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
                  <p className="text-xl font-bold text-red-600">{progress.errors}</p>
                  <p className="text-xs text-red-500 mt-0.5">Errores</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                  <p className="text-xl font-bold text-gray-700">{progress.remaining}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Restantes</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Indexing */}
          {step === 'index' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {done ? 'Indexación completada' : 'Indexando para Chava AI'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {done
                      ? 'Los documentos ya son consultables por Chava AI'
                      : 'Generando embeddings para búsqueda semántica'}
                  </p>
                </div>
                {!done && <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin ml-auto" />}
                {done && <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />}
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Indexación</span>
                  <span>{indexProgress.processed} procesados · {indexProgress.remaining} restantes</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  {progress.successful > 0 && (
                    <div
                      className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${done ? 100 : Math.min(95, (indexProgress.processed / Math.max(1, progress.successful)) * 100)}%` }}
                    />
                  )}
                </div>
              </div>

              {done && (
                <div className="rounded-xl border border-green-100 bg-green-50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-green-800">Migración completada exitosamente</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                    <span>Archivos guardados: <strong>{progress.successful}</strong></span>
                    <span>Documentos indexados: <strong>{indexProgress.successful}</strong></span>
                    {progress.errors > 0 && <span>Errores: <strong className="text-red-600">{progress.errors}</strong></span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t flex-shrink-0">
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={handleParse}
                disabled={!htmlFile || !carpetaId || parsing}
              >
                {parsing
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analizando...</>
                  : <><ChevronRight className="w-4 h-4 mr-2" />Analizar HTML</>
                }
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Atrás</Button>
              {jobStats && jobStats.descargables > 0 ? (
                <Button onClick={startDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Iniciar migración ({jobStats.descargables} archivos)
                </Button>
              ) : (
                <Button variant="outline" onClick={onClose}>Cerrar</Button>
              )}
            </>
          )}

          {(step === 'download' || step === 'index') && !done && (
            <Button variant="outline" disabled>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />Procesando...
            </Button>
          )}

          {done && (
            <Button onClick={onClose}>
              <CheckCircle className="w-4 h-4 mr-2" />Finalizar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
