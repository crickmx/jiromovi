import { useState, useEffect } from 'react';
import {
  Folder, Plus, Search, File, Download, Trash2, RotateCcw, Eye,
  Upload, Building2, Users, MoveVertical as MoreVertical, Archive,
  FileText, FileSpreadsheet, FileImage, FileVideoCamera as FileVideo,
  File as FileAudio, Grid2x2 as Grid, List, X, ChevronRight, Brain,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { useAuth } from '../contexts/AuthContext';
import { CarpetaModal } from '../components/centroDigital/CarpetaModal';
import { SubirArchivoModal } from '../components/centroDigital/SubirArchivoModal';
import {
  trackDigitalCenterOpened, trackDigitalFolderOpened,
  trackDigitalFileViewed, trackDigitalFileDownloaded,
  trackDigitalFileUploaded, trackDigitalFileDeleted,
} from '../lib/activityLogger';
import {
  obtenerCarpetas, obtenerArchivos, obtenerArchivosPapelera,
  descargarArchivo, eliminarArchivo, restaurarArchivo,
  eliminarArchivoDefinitivamente, eliminarCarpeta, formatearTamano,
} from '../lib/centroDigitalUtils';
import { supabase } from '../lib/supabase';
import type { CentroDigitalCarpeta, CentroDigitalArchivo } from '../lib/centroDigitalTypes';

// ── Helpers ──────────────────────────────────────────────────────────────────
function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="w-8 h-8 text-gray-400" />;
  if (mime.startsWith('image/')) return <FileImage className="w-8 h-8 text-blue-500" />;
  if (mime.startsWith('video/')) return <FileVideo className="w-8 h-8 text-violet-500" />;
  if (mime.startsWith('audio/')) return <FileAudio className="w-8 h-8 text-green-500" />;
  if (mime.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv'))
    return <FileSpreadsheet className="w-8 h-8 text-emerald-600" />;
  if (mime.includes('document') || mime.includes('word') || mime.includes('text'))
    return <FileText className="w-8 h-8 text-blue-600" />;
  return <File className="w-8 h-8 text-gray-400" />;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-lg" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

// ── Bulk-import modal (admin only) ───────────────────────────────────────────
function BulkImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [log, setLog] = useState<string[]>([]);

  async function runImport() {
    setStatus('running');
    setLog(['Iniciando importación de carpetas por aseguradora...']);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-index-batch`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: 'provision_insurer_folders' }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error del servidor');

      setLog(prev => [...prev, ...(json.log || [`Carpetas creadas: ${json.carpetas_creadas || 0}`])]);
      setStatus('done');
      onSuccess();
    } catch (err: any) {
      setLog(prev => [...prev, `Error: ${err.message}`]);
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Crear estructura de carpetas</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Esta acción crea las carpetas por aseguradora y ramo en el Centro Digital.
            No elimina ni modifica carpetas existentes.
          </p>
          <div className="bg-gray-50 rounded-xl border p-4 min-h-[120px] font-mono text-xs text-gray-700 space-y-1 overflow-y-auto max-h-48">
            {log.length === 0
              ? <p className="text-gray-400">Listo para iniciar...</p>
              : log.map((line, i) => <p key={i}>{line}</p>)
            }
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={status === 'running'}>Cancelar</Button>
          {status === 'idle' || status === 'error' ? (
            <Button onClick={runImport}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {status === 'error' ? 'Reintentar' : 'Crear carpetas'}
            </Button>
          ) : status === 'running' ? (
            <Button disabled>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />Procesando...
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>Listo</Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CentroDigital() {
  const { usuario } = useAuth();

  const [carpetas, setCarpetas] = useState<CentroDigitalCarpeta[]>([]);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState<CentroDigitalCarpeta | null>(null);
  const [archivos, setArchivos] = useState<CentroDigitalArchivo[]>([]);
  const [archivosPapelera, setArchivosPapelera] = useState<CentroDigitalArchivo[]>([]);
  const [showPapelera, setShowPapelera] = useState(false);
  const [carpetaEditar, setCarpetaEditar] = useState<CentroDigitalCarpeta | null>(null);
  const [showCarpetaModal, setShowCarpetaModal] = useState(false);
  const [showSubirModal, setShowSubirModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [archivoPrevisualizar, setArchivoPrevisualizar] = useState<CentroDigitalArchivo | null>(null);
  const [vistaArchivos, setVistaArchivos] = useState<'grid' | 'list'>('grid');
  const [loadingCarpetas, setLoadingCarpetas] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const esAdmin = usuario?.rol === 'Administrador';
  const esGerente = usuario?.rol === 'Gerente';
  const puedeSubirArchivos = esAdmin || esGerente;
  const puedeCrearCarpetas = esAdmin || esGerente;

  useEffect(() => {
    trackDigitalCenterOpened();
    cargarCarpetas();
  }, []);

  useEffect(() => {
    if (carpetaSeleccionada) {
      trackDigitalFolderOpened(carpetaSeleccionada.nombre);
      cargarArchivos(carpetaSeleccionada.id);
    }
  }, [carpetaSeleccionada]);

  useEffect(() => {
    if (showPapelera && esAdmin) cargarPapelera();
  }, [showPapelera, esAdmin]);

  async function cargarCarpetas() {
    try {
      setLoadingCarpetas(true);
      const data = await obtenerCarpetas();
      setCarpetas(data);
    } catch (e) { console.error(e); }
    finally { setLoadingCarpetas(false); }
  }

  async function cargarArchivos(carpetaId: string) {
    try {
      const data = await obtenerArchivos(carpetaId);
      setArchivos(data);
    } catch (e) { console.error(e); }
  }

  async function cargarPapelera() {
    try {
      const data = await obtenerArchivosPapelera();
      setArchivosPapelera(data);
    } catch (e) { console.error(e); }
  }

  async function handleEliminarCarpeta(carpetaId: string) {
    if (!confirm('¿Eliminar esta carpeta?')) return;
    try {
      await eliminarCarpeta(carpetaId);
      await cargarCarpetas();
      if (carpetaSeleccionada?.id === carpetaId) setCarpetaSeleccionada(null);
    } catch { alert('Error al eliminar la carpeta'); }
  }

  async function handleDescargar(archivo: CentroDigitalArchivo) {
    try {
      await descargarArchivo(archivo);
      trackDigitalFileDownloaded(archivo.nombre);
    } catch { alert('Error al descargar el archivo'); }
  }

  async function handleEliminarArchivo(archivoId: string) {
    if (!confirm('¿Mover este archivo a la papelera?')) return;
    try {
      const archivo = archivos.find(a => a.id === archivoId);
      await eliminarArchivo(archivoId);
      if (archivo) trackDigitalFileDeleted(archivo.nombre);
      if (carpetaSeleccionada) await cargarArchivos(carpetaSeleccionada.id);
    } catch { alert('Error al eliminar el archivo'); }
  }

  async function handleRestaurarArchivo(archivoId: string) {
    try {
      await restaurarArchivo(archivoId);
      await cargarPapelera();
    } catch { alert('Error al restaurar el archivo'); }
  }

  async function handleEliminarDefinitivo(archivoId: string) {
    if (!confirm('¿Eliminar definitivamente? Esta acción no se puede deshacer.')) return;
    try {
      await eliminarArchivoDefinitivamente(archivoId);
      await cargarPapelera();
    } catch { alert('Error al eliminar el archivo'); }
  }

  async function handleIndexarArchivo(archivoId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert('Sesión expirada'); return; }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/centro-digital-index-document`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ archivo_id: archivoId }),
        }
      );
      const result = await res.json();
      if (res.ok && result.success) {
        alert(`Indexado exitosamente: ${result.total_chunks} fragmentos generados.`);
      } else {
        alert(result.error || 'Error al indexar el archivo');
      }
    } catch { alert('Error de conexión al indexar'); }
  }

  const esImagen = (mime: string | null) => mime?.startsWith('image/') ?? false;
  const esPDF = (mime: string | null) => mime?.includes('pdf') ?? false;

  const carpetasFiltradas = carpetas.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const archivosFiltrados = archivos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  // ── Papelera view ────────────────────────────────────────────────────────
  if (showPapelera && esAdmin) {
    return (
      <>
        <PageHeader title="Papelera de archivos" description="Archivos eliminados">
          <Button variant="outline" onClick={() => setShowPapelera(false)}>
            Volver al Centro Digital
          </Button>
        </PageHeader>
        <div className="p-6">
          {archivosPapelera.length === 0 ? (
            <EmptyState icon={Archive} title="Papelera vacía" description="No hay archivos eliminados" />
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Archivo', 'Carpeta', 'Eliminado por', 'Fecha', 'Acciones'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {archivosPapelera.map(archivo => (
                    <tr key={archivo.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <File className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{archivo.nombre}</p>
                            <p className="text-xs text-gray-500">{formatearTamano(archivo.tamano_bytes)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{archivo.carpeta?.nombre || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{archivo.eliminador?.nombre_completo || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {archivo.fecha_eliminacion ? new Date(archivo.fecha_eliminacion).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleRestaurarArchivo(archivo.id)}
                            className="text-emerald-600 hover:text-emerald-700 p-1 rounded hover:bg-emerald-50" title="Restaurar">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEliminarDefinitivo(archivo.id)}
                            className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50" title="Eliminar definitivamente">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Folder contents view ─────────────────────────────────────────────────
  if (carpetaSeleccionada) {
    return (
      <>
        <PageHeader
          title={carpetaSeleccionada.nombre}
          description={carpetaSeleccionada.descripcion || 'Archivos de la carpeta'}
        >
          <div className="flex gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              {(['grid', 'list'] as const).map(v => (
                <button key={v} onClick={() => setVistaArchivos(v)}
                  className={`px-3 py-2 ${vistaArchivos === v ? 'bg-accent text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  title={v === 'grid' ? 'Cuadrícula' : 'Lista'}>
                  {v === 'grid' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setCarpetaSeleccionada(null)}>
              ← Volver
            </Button>
            {puedeSubirArchivos && (
              <Button onClick={() => setShowSubirModal(true)}>
                <Upload className="w-4 h-4 mr-2" />Subir archivo
              </Button>
            )}
          </div>
        </PageHeader>

        <div className="p-6">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar archivos..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)} className="pl-9" />
          </div>

          {archivos.length === 0 ? (
            <div className="bg-white rounded-xl border">
              <EmptyState icon={File} title="Sin archivos" description="Esta carpeta aún no tiene archivos"
                action={puedeSubirArchivos ? (
                  <Button onClick={() => setShowSubirModal(true)}>
                    <Upload className="w-4 h-4 mr-2" />Subir primer archivo
                  </Button>
                ) : undefined} />
            </div>
          ) : vistaArchivos === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {archivosFiltrados.map(archivo => (
                <div key={archivo.id}
                  className="bg-white rounded-xl border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-200 overflow-hidden group">
                  <div className="aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden">
                    {esImagen(archivo.tipo_mime) ? (
                      <img
                        src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/centro-digital-files/${archivo.ruta_storage}`}
                        alt={archivo.nombre} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4">
                        <FileIcon mime={archivo.tipo_mime} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                      {(esImagen(archivo.tipo_mime) || esPDF(archivo.tipo_mime)) && (
                        <button onClick={() => { setArchivoPrevisualizar(archivo); trackDigitalFileViewed(archivo.nombre); }}
                          className="p-1.5 bg-white rounded-full shadow hover:bg-gray-100">
                          <Eye className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                      )}
                      <button onClick={() => handleDescargar(archivo)}
                        className="p-1.5 bg-white rounded-full shadow hover:bg-gray-100">
                        <Download className="w-3.5 h-3.5 text-gray-700" />
                      </button>
                      {puedeSubirArchivos && carpetaSeleccionada?.enable_chava_ai && (
                        <button onClick={() => handleIndexarArchivo(archivo.id)}
                          className="p-1.5 bg-white rounded-full shadow hover:bg-teal-50" title="Indexar para Chava AI">
                          <Brain className="w-3.5 h-3.5 text-teal-600" />
                        </button>
                      )}
                      {puedeSubirArchivos && (
                        <button onClick={() => handleEliminarArchivo(archivo.id)}
                          className="p-1.5 bg-white rounded-full shadow hover:bg-gray-100">
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm text-gray-900 truncate" title={archivo.nombre}>{archivo.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatearTamano(archivo.tamano_bytes)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Archivo', 'Tamaño', 'Subido por', 'Fecha', 'Acciones'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {archivosFiltrados.map(archivo => (
                    <tr key={archivo.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileIcon mime={archivo.tipo_mime} />
                          <span className="font-medium text-gray-900">{archivo.nombre}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatearTamano(archivo.tamano_bytes)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{archivo.cargador?.nombre_completo || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(archivo.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleDescargar(archivo)}
                            className="text-accent hover:text-blue-700 p-1 rounded hover:bg-blue-50">
                            <Download className="w-4 h-4" />
                          </button>
                          {puedeSubirArchivos && carpetaSeleccionada?.enable_chava_ai && (
                            <button onClick={() => handleIndexarArchivo(archivo.id)}
                              className="text-teal-600 hover:text-teal-700 p-1 rounded hover:bg-teal-50" title="Indexar para Chava AI">
                              <Brain className="w-4 h-4" />
                            </button>
                          )}
                          {puedeSubirArchivos && (
                            <button onClick={() => handleEliminarArchivo(archivo.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showSubirModal && (
          <SubirArchivoModal
            carpetaId={carpetaSeleccionada.id}
            carpetaNombre={carpetaSeleccionada.nombre}
            onClose={() => setShowSubirModal(false)}
            onSuccess={async () => {
              setShowSubirModal(false);
              await cargarArchivos(carpetaSeleccionada.id);
              trackDigitalFileUploaded(carpetaSeleccionada.nombre);
            }} />
        )}

        {archivoPrevisualizar && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
            onClick={() => setArchivoPrevisualizar(null)}>
            <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 truncate">{archivoPrevisualizar.nombre}</h3>
                  <p className="text-xs text-gray-500">{formatearTamano(archivoPrevisualizar.tamano_bytes)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDescargar(archivoPrevisualizar)}
                    className="p-2 text-accent hover:bg-gray-100 rounded-lg"><Download className="w-4 h-4" /></button>
                  <button onClick={() => setArchivoPrevisualizar(null)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-gray-50">
                {esImagen(archivoPrevisualizar.tipo_mime) ? (
                  <div className="flex items-center justify-center h-full">
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/centro-digital-files/${archivoPrevisualizar.ruta_storage}`}
                      alt={archivoPrevisualizar.nombre} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <iframe
                    src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/centro-digital-files/${archivoPrevisualizar.ruta_storage}`}
                    className="w-full h-full min-h-[600px] rounded-lg" title={archivoPrevisualizar.nombre} />
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Main folder list view ────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Centro Digital"
        description="Repositorio de documentos y archivos organizados por carpetas"
      >
        <div className="flex gap-2">
          {esAdmin && (
            <>
              <Button variant="outline" onClick={() => setShowPapelera(true)}>
                <Archive className="w-4 h-4 mr-2" />Papelera
              </Button>
              <Button variant="outline" onClick={() => setShowBulkImport(true)}>
                <RefreshCw className="w-4 h-4 mr-2" />Importar estructura
              </Button>
            </>
          )}
          {puedeCrearCarpetas && (
            <Button onClick={() => setShowCarpetaModal(true)}>
              <Plus className="w-4 h-4 mr-2" />Nueva carpeta
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="p-6">
        <div className="mb-5 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar carpetas..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)} className="pl-9" />
        </div>

        {loadingCarpetas ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : carpetasFiltradas.length === 0 ? (
          <EmptyState icon={Folder} title="Sin carpetas"
            description="Aún no hay carpetas en el Centro Digital"
            action={puedeCrearCarpetas ? (
              <Button onClick={() => setShowCarpetaModal(true)}>
                <Plus className="w-4 h-4 mr-2" />Crear primera carpeta
              </Button>
            ) : undefined} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {carpetasFiltradas.map(carpeta => (
              <div key={carpeta.id}
                className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
                onClick={() => setCarpetaSeleccionada(carpeta)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Folder className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{carpeta.nombre}</h3>
                      {carpeta.descripcion && (
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{carpeta.descripcion}</p>
                      )}
                    </div>
                  </div>
                  {(esAdmin || esGerente) && (
                    <button
                      onClick={e => { e.stopPropagation(); setCarpetaEditar(carpeta); setShowCarpetaModal(true); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 rounded transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                    <Building2 className="w-3 h-3" />
                    {carpeta.todas_oficinas ? 'Todas las oficinas' : `${carpeta.oficinas_permitidas?.length || 0} oficinas`}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                    <Users className="w-3 h-3" />
                    {carpeta.todos_roles ? 'Todos los roles' : `${carpeta.roles_permitidos?.length || 0} roles`}
                  </span>
                  {carpeta.enable_chava_ai && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full">
                      <Brain className="w-3 h-3" />
                      Chava AI
                    </span>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{new Date(carpeta.created_at).toLocaleDateString()}</span>
                  <span className="text-xs text-accent font-medium group-hover:underline flex items-center gap-1">
                    Ver archivos <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCarpetaModal && (
        <CarpetaModal
          carpeta={carpetaEditar}
          onClose={() => { setShowCarpetaModal(false); setCarpetaEditar(null); }}
          onSuccess={async () => { setShowCarpetaModal(false); setCarpetaEditar(null); await cargarCarpetas(); }} />
      )}

      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onSuccess={async () => { setShowBulkImport(false); await cargarCarpetas(); }} />
      )}
    </>
  );
}
