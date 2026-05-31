import { useState, useEffect, useMemo } from 'react';
import { Folder, Plus, Search, File, Download, Trash2, RotateCcw, Eye, Upload, Building2, Users, MoveVertical as MoreVertical, Archive, FileText, FileSpreadsheet, FileImage, FileVideo, FileAudio, Grid2x2 as Grid, List, BookOpen, Star, Clock, Tag, Filter, X, ChevronDown, ChevronRight, Megaphone, Shield, Car, Heart, Home, Briefcase, Globe, Zap } from 'lucide-react';
import { Layout } from '../components/Layout';
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
  trackDigitalFileUploaded, trackDigitalFileDeleted
} from '../lib/activityLogger';
import {
  obtenerCarpetas, obtenerArchivos, obtenerArchivosPapelera,
  descargarArchivo, eliminarArchivo, restaurarArchivo,
  eliminarArchivoDefinitivamente, eliminarCarpeta, formatearTamano
} from '../lib/centroDigitalUtils';
import { supabase } from '../lib/supabase';
import type { CentroDigitalCarpeta, CentroDigitalArchivo } from '../lib/centroDigitalTypes';

// ── Types ──────────────────────────────────────────────────────────────────
interface DigitalCenterDocument {
  id: string;
  titulo: string;
  descripcion: string | null;
  aseguradora: string | null;
  ramo: string | null;
  categoria: string | null;
  tipo: string | null;
  formato: string | null;
  tags: string[];
  url_original: string | null;
  storage_path: string | null;
  tamano_bytes: number | null;
  is_featured: boolean;
  is_recent: boolean;
  activo: boolean;
  created_at: string;
}

interface DigitalCenterAd {
  id: string;
  titulo: string;
  subtitulo: string | null;
  cta_texto: string;
  cta_url: string | null;
  imagen_url: string | null;
  color_fondo: string;
  color_texto: string;
}

// ── Insurer config ──────────────────────────────────────────────────────────
const INSURER_LOGOS: Record<string, string> = {
  'GNP': '/gnp-seguros.png',
  'AXA': '/allianz-seguros-logo-png_seeklogo-179147.png',
  'Allianz': '/allianz-seguros-logo-png_seeklogo-179147.png',
  'CHUBB': '/logo_chubb-04.png',
  'Chubb': '/logo_chubb-04.png',
  'MAPFRE': '/mapfre-seguros-logo-png_seeklogo-225013.png',
  'Afirme': '/afirme-logo-png_seeklogo-4173.png',
  'ANA': '/ana-seguros-logo-png_seeklogo-187684.png',
  'ANA Seguros': '/ana-seguros-logo-png_seeklogo-187684.png',
  'Inbursa': '/inbursa-logo-png_seeklogo-403106.png',
  'Qualitas': '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png',
  'Atlas': '/seguros-atlas-logo-png_seeklogo-251455.png',
  'Zurich': '/zurich-logo-png_seeklogo-156664.png',
  'BUPA': '/logo-bupa.png',
  'BX+': '/logo-bx.png',
};

const RAMO_ICONS: Record<string, typeof Shield> = {
  'Autos': Car,
  'GMM': Heart,
  'Vida': Heart,
  'Daños': Home,
  'Empresarial': Briefcase,
  'Fianzas': Shield,
  'Accidentes': Zap,
  'Viajes': Globe,
};

// ── Helpers ─────────────────────────────────────────────────────────────────
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

function AdBanner({ ad }: { ad: DigitalCenterAd }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 flex items-center gap-5 shadow-sm"
      style={{ backgroundColor: ad.color_fondo, color: ad.color_texto }}
    >
      {/* Background decoration */}
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
        style={{ backgroundColor: ad.color_texto }} />
      <div className="absolute -right-4 -bottom-6 w-24 h-24 rounded-full opacity-10"
        style={{ backgroundColor: ad.color_texto }} />

      <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-white/20">
        <Megaphone className="w-6 h-6" style={{ color: ad.color_texto }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-base leading-snug" style={{ color: ad.color_texto }}>{ad.titulo}</p>
        {ad.subtitulo && (
          <p className="text-sm mt-0.5 opacity-80 leading-snug" style={{ color: ad.color_texto }}>{ad.subtitulo}</p>
        )}
      </div>

      {ad.cta_url && (
        <a
          href={ad.cta_url}
          className="flex-shrink-0 px-4 py-2 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 bg-white/20 hover:bg-white/30"
          style={{ color: ad.color_texto }}
        >
          {ad.cta_texto}
        </a>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function CentroDigital() {
  const { usuario } = useAuth();

  // Tabs
  const [activeTab, setActiveTab] = useState<'mis-archivos' | 'base-conocimiento'>('mis-archivos');

  // My files state
  const [carpetas, setCarpetas] = useState<CentroDigitalCarpeta[]>([]);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState<CentroDigitalCarpeta | null>(null);
  const [archivos, setArchivos] = useState<CentroDigitalArchivo[]>([]);
  const [archivosPapelera, setArchivosPapelera] = useState<CentroDigitalArchivo[]>([]);
  const [showPapelera, setShowPapelera] = useState(false);
  const [carpetaEditar, setCarpetaEditar] = useState<CentroDigitalCarpeta | null>(null);
  const [showCarpetaModal, setShowCarpetaModal] = useState(false);
  const [showSubirModal, setShowSubirModal] = useState(false);
  const [archivoPrevisualizar, setArchivoPrevisualizar] = useState<CentroDigitalArchivo | null>(null);
  const [vistaArchivos, setVistaArchivos] = useState<'grid' | 'list'>('grid');
  const [loadingCarpetas, setLoadingCarpetas] = useState(true);

  // Knowledge base state
  const [documentos, setDocumentos] = useState<DigitalCenterDocument[]>([]);
  const [ads, setAds] = useState<DigitalCenterAd[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Shared search
  const [busqueda, setBusqueda] = useState('');

  // Knowledge base filters
  const [filtroAseguradora, setFiltroAseguradora] = useState('');
  const [filtroRamo, setFiltroRamo] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroFormato, setFiltroFormato] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('');
  const [soloDestacados, setSoloDestacados] = useState(false);
  const [soloRecientes, setSoloRecientes] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const esAdmin = usuario?.rol === 'Administrador';
  const esGerente = usuario?.rol === 'Gerente';
  const puedeSubirArchivos = esAdmin || esGerente;
  const puedeCrearCarpetas = esAdmin || esGerente;

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    trackDigitalCenterOpened();
    cargarCarpetas();
    cargarDocumentos();
    cargarAds();
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

  async function cargarDocumentos() {
    try {
      setLoadingDocs(true);
      const { data } = await supabase
        .from('digital_center_documents')
        .select('*')
        .eq('activo', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      setDocumentos(data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingDocs(false); }
  }

  async function cargarAds() {
    try {
      const { data } = await supabase
        .from('digital_center_ads')
        .select('*')
        .eq('activo', true)
        .order('orden');
      setAds(data || []);
    } catch (e) { console.error(e); }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
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

  const esImagen = (mime: string | null) => mime?.startsWith('image/') ?? false;
  const esPDF = (mime: string | null) => mime?.includes('pdf') ?? false;

  // ── Derived data ───────────────────────────────────────────────────────────
  const aseguradoras = useMemo(() =>
    [...new Set(documentos.map(d => d.aseguradora).filter(Boolean))] as string[],
    [documentos]
  );
  const ramos = useMemo(() =>
    [...new Set(documentos.map(d => d.ramo).filter(Boolean))] as string[],
    [documentos]
  );
  const categorias = useMemo(() =>
    [...new Set(documentos.map(d => d.categoria).filter(Boolean))] as string[],
    [documentos]
  );
  const formatos = useMemo(() =>
    [...new Set(documentos.map(d => d.formato).filter(Boolean))] as string[],
    [documentos]
  );
  const todasEtiquetas = useMemo(() =>
    [...new Set(documentos.flatMap(d => d.tags || []))],
    [documentos]
  );

  const documentosFiltrados = useMemo(() => {
    return documentos.filter(d => {
      if (busqueda && !d.titulo.toLowerCase().includes(busqueda.toLowerCase()) &&
        !(d.descripcion || '').toLowerCase().includes(busqueda.toLowerCase()) &&
        !(d.aseguradora || '').toLowerCase().includes(busqueda.toLowerCase())) return false;
      if (filtroAseguradora && d.aseguradora !== filtroAseguradora) return false;
      if (filtroRamo && d.ramo !== filtroRamo) return false;
      if (filtroCategoria && d.categoria !== filtroCategoria) return false;
      if (filtroFormato && d.formato !== filtroFormato) return false;
      if (filtroEtiqueta && !(d.tags || []).includes(filtroEtiqueta)) return false;
      if (soloDestacados && !d.is_featured) return false;
      if (soloRecientes && !d.is_recent) return false;
      return true;
    });
  }, [documentos, busqueda, filtroAseguradora, filtroRamo, filtroCategoria, filtroFormato, filtroEtiqueta, soloDestacados, soloRecientes]);

  // Group by aseguradora
  const docsPorAseguradora = useMemo(() => {
    const map: Record<string, DigitalCenterDocument[]> = {};
    for (const doc of documentosFiltrados) {
      const key = doc.aseguradora || 'General';
      if (!map[key]) map[key] = [];
      map[key].push(doc);
    }
    return map;
  }, [documentosFiltrados]);

  const carpetasFiltradas = carpetas.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const archivosFiltrados = archivos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const activeFiltersCount = [filtroAseguradora, filtroRamo, filtroCategoria, filtroFormato, filtroEtiqueta]
    .filter(Boolean).length + (soloDestacados ? 1 : 0) + (soloRecientes ? 1 : 0);

  function clearFilters() {
    setFiltroAseguradora('');
    setFiltroRamo('');
    setFiltroCategoria('');
    setFiltroFormato('');
    setFiltroEtiqueta('');
    setSoloDestacados(false);
    setSoloRecientes(false);
  }

  // ── Papelera view ──────────────────────────────────────────────────────────
  if (showPapelera && esAdmin) {
    return (
      <Layout>
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
      </Layout>
    );
  }

  // ── Folder contents view ──────────────────────────────────────────────────
  if (carpetaSeleccionada) {
    return (
      <Layout>
        <PageHeader title={carpetaSeleccionada.nombre}
          description={carpetaSeleccionada.descripcion || 'Archivos de la carpeta'}>
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
      </Layout>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <Layout>
      <PageHeader
        title="Centro Digital"
        description="Repositorio centralizado de documentos, archivos y base de conocimiento"
      >
        <div className="flex gap-2">
          {esAdmin && activeTab === 'mis-archivos' && (
            <Button variant="outline" onClick={() => setShowPapelera(true)}>
              <Archive className="w-4 h-4 mr-2" />Papelera
            </Button>
          )}
          {puedeCrearCarpetas && activeTab === 'mis-archivos' && (
            <Button onClick={() => setShowCarpetaModal(true)}>
              <Plus className="w-4 h-4 mr-2" />Nueva carpeta
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Tab bar */}
      <div className="px-6 border-b border-gray-100 bg-white">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('mis-archivos')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              activeTab === 'mis-archivos'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Folder className="w-4 h-4" />
            Mis Archivos
          </button>
          <button
            onClick={() => setActiveTab('base-conocimiento')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              activeTab === 'base-conocimiento'
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Base de Conocimiento
            {documentos.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {documentos.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Tab: Mis Archivos ── */}
      {activeTab === 'mis-archivos' && (
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
      )}

      {/* ── Tab: Base de Conocimiento ── */}
      {activeTab === 'base-conocimiento' && (
        <div className="p-6 space-y-5">
          {/* Ads */}
          {ads.length > 0 && (
            <div className="space-y-3">
              {ads.map(ad => <AdBanner key={ad.id} ad={ad} />)}
            </div>
          )}

          {/* Search + filters toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Buscar documentos, aseguradoras, temas..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                activeFiltersCount > 0
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              }`}>
              <Filter className="w-4 h-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="bg-white text-accent rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Aseguradora</label>
                  <select value={filtroAseguradora} onChange={e => setFiltroAseguradora(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="">Todas</option>
                    {aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Ramo</label>
                  <select value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="">Todos</option>
                    {ramos.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Categoría</label>
                  <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="">Todas</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Formato</label>
                  <select value={filtroFormato} onChange={e => setFiltroFormato(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="">Todos</option>
                    {formatos.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Etiqueta</label>
                  <select value={filtroEtiqueta} onChange={e => setFiltroEtiqueta(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="">Todas</option>
                    {todasEtiquetas.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input type="checkbox" checked={soloDestacados} onChange={e => setSoloDestacados(e.target.checked)}
                    className="rounded border-gray-300 text-accent focus:ring-accent/20" />
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  Solo destacados
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input type="checkbox" checked={soloRecientes} onChange={e => setSoloRecientes(e.target.checked)}
                    className="rounded border-gray-300 text-accent focus:ring-accent/20" />
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  Solo recientes
                </label>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters}
                    className="ml-auto text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                    <X className="w-3.5 h-3.5" />Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {activeFiltersCount > 0 && !showFilters && (
            <div className="flex flex-wrap gap-2">
              {filtroAseguradora && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 text-accent text-xs rounded-full font-medium">
                  {filtroAseguradora}
                  <button onClick={() => setFiltroAseguradora('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {filtroRamo && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  {filtroRamo}
                  <button onClick={() => setFiltroRamo('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {filtroCategoria && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                  {filtroCategoria}
                  <button onClick={() => setFiltroCategoria('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {soloDestacados && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                  <Star className="w-3 h-3" />Destacados
                  <button onClick={() => setSoloDestacados(false)}><X className="w-3 h-3" /></button>
                </span>
              )}
              {soloRecientes && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  <Clock className="w-3 h-3" />Recientes
                  <button onClick={() => setSoloRecientes(false)}><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}

          {/* Documents */}
          {loadingDocs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : documentosFiltrados.length === 0 ? (
            <EmptyState icon={BookOpen} title="Sin documentos"
              description={busqueda || activeFiltersCount > 0
                ? 'No se encontraron documentos con los filtros aplicados'
                : 'La base de conocimiento aún no tiene documentos'} />
          ) : filtroAseguradora ? (
            // Flat list when filtering by insurer
            <DocumentGrid documentos={documentosFiltrados} />
          ) : (
            // Grouped by insurer
            <div className="space-y-8">
              {Object.entries(docsPorAseguradora).map(([aseg, docs]) => {
                const logo = INSURER_LOGOS[aseg];
                const RamoIcon = RAMO_ICONS[docs[0]?.ramo || ''] || Shield;
                return (
                  <div key={aseg}>
                    <div className="flex items-center gap-3 mb-3">
                      {logo ? (
                        <img src={logo} alt={aseg} className="h-8 w-auto object-contain" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          <RamoIcon className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                      <h2 className="text-base font-bold text-gray-900">{aseg}</h2>
                      <span className="text-xs text-gray-400 font-medium px-2 py-0.5 bg-gray-100 rounded-full">
                        {docs.length} {docs.length === 1 ? 'documento' : 'documentos'}
                      </span>
                    </div>
                    <DocumentGrid documentos={docs} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCarpetaModal && (
        <CarpetaModal
          carpeta={carpetaEditar}
          onClose={() => { setShowCarpetaModal(false); setCarpetaEditar(null); }}
          onSuccess={async () => { setShowCarpetaModal(false); setCarpetaEditar(null); await cargarCarpetas(); }} />
      )}
    </Layout>
  );
}

// ── DocumentGrid subcomponent ────────────────────────────────────────────────
function DocumentGrid({ documentos }: { documentos: DigitalCenterDocument[] }) {
  const formatoColor: Record<string, string> = {
    pdf: 'bg-red-50 text-red-600',
    xlsx: 'bg-emerald-50 text-emerald-700',
    docx: 'bg-blue-50 text-blue-700',
    pptx: 'bg-orange-50 text-orange-700',
    csv: 'bg-teal-50 text-teal-700',
    jpg: 'bg-violet-50 text-violet-700',
    png: 'bg-violet-50 text-violet-700',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {documentos.map(doc => (
        <div key={doc.id}
          className="bg-white rounded-xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all group p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 flex-1">
                  {doc.titulo}
                  {doc.is_featured && <Star className="inline-block w-3 h-3 text-amber-500 ml-1 flex-shrink-0" />}
                </h3>
              </div>
              {doc.descripcion && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.descripcion}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {doc.ramo && (
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded font-medium">{doc.ramo}</span>
                )}
                {doc.categoria && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-medium">{doc.categoria}</span>
                )}
                {doc.formato && (
                  <span className={`px-1.5 py-0.5 text-xs rounded font-medium uppercase ${formatoColor[doc.formato.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
                    {doc.formato}
                  </span>
                )}
                {doc.is_recent && (
                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-xs rounded font-medium flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />Reciente
                  </span>
                )}
              </div>
              {(doc.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {doc.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="inline-flex items-center gap-0.5 text-xs text-gray-400">
                      <Tag className="w-2.5 h-2.5" />{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(doc.url_original || doc.storage_path) && (
            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
              <a
                href={doc.url_original || `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/digital-center-docs/${doc.storage_path}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent font-medium hover:underline">
                <Download className="w-3.5 h-3.5" />
                {doc.storage_path ? 'Descargar' : 'Ver documento'}
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
