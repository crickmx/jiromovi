import { useState, useEffect } from 'react';
import { BookOpen, Plus, CreditCard as Edit2, Trash2, Star, Clock, Search, X, Save, CircleAlert as AlertCircle, CircleCheck as CheckCircle, FileText, Download, Tag, Megaphone, RefreshCw, CloudDownload, CircleCheck as CheckCircle2, Circle as XCircle, Loader as Loader2, ChartBar as BarChart3, Globe } from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Doc {
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
  is_featured: boolean;
  is_recent: boolean;
  activo: boolean;
  visibilidad: string | null;
  created_at: string;
}

interface Ad {
  id: string;
  titulo: string;
  subtitulo: string | null;
  cta_texto: string;
  cta_url: string | null;
  color_fondo: string;
  color_texto: string;
  orden: number;
  activo: boolean;
}

interface DownloadResult {
  id: string;
  titulo: string;
  status: 'downloaded' | 'skipped' | 'error';
  storage_path?: string;
  error?: string;
}

interface DownloadSummary {
  total_processed: number;
  downloaded: number;
  skipped: number;
  errors: number;
  results: DownloadResult[];
}

const EMPTY_DOC: Omit<Doc, 'id' | 'created_at'> = {
  titulo: '',
  descripcion: '',
  aseguradora: '',
  ramo: '',
  categoria: '',
  tipo: '',
  formato: 'pdf',
  tags: [],
  url_original: '',
  storage_path: null,
  is_featured: false,
  is_recent: false,
  activo: true,
  visibilidad: 'global',
};

const RAMOS = ['Autos', 'GMM', 'Vida', 'Daños', 'Empresarial', 'Fianzas', 'Accidentes', 'Viajes', 'General'];
const CATEGORIAS = ['Catálogo', 'Manual', 'Guía de Producto', 'Ficha Técnica', 'Condiciones Generales', 'Tarifas', 'Comparativo', 'Red Médica', 'Normativa', 'Capacitación', 'Presentación', 'Directorio', 'Resumen de Beneficios'];
const FORMATOS = ['pdf', 'xlsx', 'docx', 'pptx', 'csv', 'jpg', 'png', 'mp4'];

function ToggleBtn({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-accent' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function BaseConocimientoAdmin() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState<'documentos' | 'anuncios' | 'importar'>('documentos');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroAseg, setFiltroAseg] = useState('');

  // Bulk download state
  const [downloadRunning, setDownloadRunning] = useState(false);
  const [downloadSummary, setDownloadSummary] = useState<DownloadSummary | null>(null);
  const [downloadOffset, setDownloadOffset] = useState(0);
  const [downloadLimit] = useState(5);
  const [downloadAseg, setDownloadAseg] = useState('');
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  // Modal state
  const [showDocModal, setShowDocModal] = useState(false);
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [docForm, setDocForm] = useState<typeof EMPTY_DOC>(EMPTY_DOC);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const [showAdModal, setShowAdModal] = useState(false);
  const [editAd, setEditAd] = useState<Ad | null>(null);
  const [adForm, setAdForm] = useState<Omit<Ad, 'id'>>({
    titulo: '',
    subtitulo: '',
    cta_texto: '',
    cta_url: '',
    color_fondo: '#0F4C81',
    color_texto: '#FFFFFF',
    orden: 1,
    activo: true,
  });

  const esAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (!esAdmin) return;
    load();
    loadPendingCount();
  }, [esAdmin]);

  async function loadPendingCount() {
    const { count } = await supabase
      .from('digital_center_documents')
      .select('id', { count: 'exact', head: true })
      .is('storage_path', null)
      .eq('activo', true);
    setPendingCount(count ?? 0);
  }

  async function runBulkDownload(dryRun = false) {
    setDownloadRunning(true);
    setDownloadSummary(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-download-docs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            limit: downloadLimit,
            offset: downloadOffset,
            aseguradora: downloadAseg || undefined,
            dry_run: dryRun,
          }),
        }
      );
      const json = await res.json();
      if (!dryRun && json.total_processed > 0) {
        setDownloadOffset(o => o + downloadLimit);
        await load();
        await loadPendingCount();
      }
      setDownloadSummary(json);
    } catch (e) {
      showMsg('err', 'Error al ejecutar descarga');
    } finally {
      setDownloadRunning(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const [docsRes, adsRes] = await Promise.all([
        supabase.from('digital_center_documents').select('*').order('aseguradora').order('created_at', { ascending: false }),
        supabase.from('digital_center_ads').select('*').order('orden'),
      ]);
      setDocs(docsRes.data || []);
      setAds(adsRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function showMsg(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Document CRUD ──────────────────────────────────────────────────────────
  function openNewDoc() {
    setEditDoc(null);
    setDocForm(EMPTY_DOC);
    setTagInput('');
    setShowDocModal(true);
  }

  function openEditDoc(doc: Doc) {
    setEditDoc(doc);
    setDocForm({
      titulo: doc.titulo,
      descripcion: doc.descripcion || '',
      aseguradora: doc.aseguradora || '',
      ramo: doc.ramo || '',
      categoria: doc.categoria || '',
      tipo: doc.tipo || '',
      formato: doc.formato || 'pdf',
      tags: doc.tags || [],
      url_original: doc.url_original || '',
      storage_path: doc.storage_path,
      is_featured: doc.is_featured,
      is_recent: doc.is_recent,
      activo: doc.activo,
      visibilidad: doc.visibilidad || 'global',
    });
    setTagInput('');
    setShowDocModal(true);
  }

  async function saveDoc() {
    if (!docForm.titulo.trim()) return showMsg('err', 'El título es requerido');
    setSaving(true);
    try {
      const payload = {
        ...docForm,
        tags: docForm.tags.filter(Boolean),
        url_original: docForm.url_original?.trim() || null,
        descripcion: docForm.descripcion?.trim() || null,
      };
      if (editDoc) {
        await supabase.from('digital_center_documents').update(payload).eq('id', editDoc.id);
        showMsg('ok', 'Documento actualizado');
      } else {
        await supabase.from('digital_center_documents').insert(payload);
        showMsg('ok', 'Documento creado');
      }
      setShowDocModal(false);
      load();
    } catch (e) { showMsg('err', 'Error al guardar'); }
    finally { setSaving(false); }
  }

  async function deleteDoc(id: string) {
    if (!confirm('¿Eliminar este documento de la base de conocimiento?')) return;
    await supabase.from('digital_center_documents').delete().eq('id', id);
    showMsg('ok', 'Documento eliminado');
    load();
  }

  async function toggleDocActivo(doc: Doc) {
    await supabase.from('digital_center_documents').update({ activo: !doc.activo }).eq('id', doc.id);
    load();
  }

  async function toggleFeatured(doc: Doc) {
    await supabase.from('digital_center_documents').update({ is_featured: !doc.is_featured }).eq('id', doc.id);
    load();
  }

  // ── Ads CRUD ───────────────────────────────────────────────────────────────
  function openNewAd() {
    setEditAd(null);
    setAdForm({ titulo: '', subtitulo: '', cta_texto: 'Ver más', cta_url: '', color_fondo: '#0F4C81', color_texto: '#FFFFFF', orden: (ads.length + 1), activo: true });
    setShowAdModal(true);
  }

  function openEditAd(ad: Ad) {
    setEditAd(ad);
    setAdForm({ titulo: ad.titulo, subtitulo: ad.subtitulo || '', cta_texto: ad.cta_texto, cta_url: ad.cta_url || '', color_fondo: ad.color_fondo, color_texto: ad.color_texto, orden: ad.orden, activo: ad.activo });
    setShowAdModal(true);
  }

  async function saveAd() {
    if (!adForm.titulo.trim()) return showMsg('err', 'El título es requerido');
    setSaving(true);
    try {
      const payload = { ...adForm, subtitulo: adForm.subtitulo?.trim() || null, cta_url: adForm.cta_url?.trim() || null };
      if (editAd) {
        await supabase.from('digital_center_ads').update(payload).eq('id', editAd.id);
      } else {
        await supabase.from('digital_center_ads').insert(payload);
      }
      showMsg('ok', editAd ? 'Anuncio actualizado' : 'Anuncio creado');
      setShowAdModal(false);
      load();
    } catch { showMsg('err', 'Error al guardar'); }
    finally { setSaving(false); }
  }

  async function deleteAd(id: string) {
    if (!confirm('¿Eliminar este anuncio?')) return;
    await supabase.from('digital_center_ads').delete().eq('id', id);
    showMsg('ok', 'Anuncio eliminado');
    load();
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const aseguradoras = [...new Set(docs.map(d => d.aseguradora).filter(Boolean))] as string[];
  const docsFiltrados = docs.filter(d => {
    if (filtroAseg && d.aseguradora !== filtroAseg) return false;
    if (busqueda && !d.titulo.toLowerCase().includes(busqueda.toLowerCase()) &&
      !(d.aseguradora || '').toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  if (!esAdmin) {
    return (
      <>
        <PageHeader title="Base de Conocimiento Admin" description="Solo administradores" />
        <div className="p-8 text-center text-gray-500">No tienes permisos para acceder a esta sección.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Base de Conocimiento"
        description={`Gestión de documentos y anuncios del Centro Digital · ${docs.length} documentos${pendingCount ? ` · ${pendingCount} pendientes de descarga` : ''}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" />Recargar
          </Button>
          {tab === 'documentos' && (
            <Button onClick={openNewDoc}>
              <Plus className="w-4 h-4 mr-2" />Nuevo documento
            </Button>
          )}
          {tab === 'anuncios' && (
            <Button onClick={openNewAd}>
              <Plus className="w-4 h-4 mr-2" />Nuevo anuncio
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {toast.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 border-b border-gray-100 bg-white">
        <div className="flex gap-1">
          {(['documentos', 'anuncios', 'importar'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${tab === t ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'documentos' && <BookOpen className="w-4 h-4" />}
              {t === 'anuncios' && <Megaphone className="w-4 h-4" />}
              {t === 'importar' && <CloudDownload className="w-4 h-4" />}
              {t === 'documentos' ? 'Documentos' : t === 'anuncios' ? 'Anuncios' : 'Importar / Descargar'}
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {t === 'documentos' ? docs.length : t === 'anuncios' ? ads.length : (pendingCount ?? '…')}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ── Documentos tab ── */}
        {tab === 'documentos' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Buscar por título o aseguradora..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
              </div>
              <select value={filtroAseg} onChange={e => setFiltroAseg(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 min-w-[160px]">
                <option value="">Todas las aseguradoras</option>
                {aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />Cargando...
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Documento', 'Aseguradora', 'Ramo', 'Formato', 'Estado', 'Acciones'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {docsFiltrados.map(doc => (
                      <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 max-w-[280px]">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-gray-900 leading-snug line-clamp-2">{doc.titulo}</p>
                              {doc.categoria && <p className="text-xs text-gray-400 mt-0.5">{doc.categoria}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-700 font-medium">{doc.aseguradora || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{doc.ramo || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium uppercase ${
                            doc.formato === 'pdf' ? 'bg-red-50 text-red-600' :
                            doc.formato === 'xlsx' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{doc.formato || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div onClick={() => toggleDocActivo(doc)} className="cursor-pointer">
                                <ToggleBtn value={doc.activo} onChange={() => toggleDocActivo(doc)} />
                              </div>
                              <span className="text-xs text-gray-500">{doc.activo ? 'Activo' : 'Inactivo'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleFeatured(doc)}
                                className={`text-xs flex items-center gap-1 transition-colors ${doc.is_featured ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}>
                                <Star className="w-3.5 h-3.5" fill={doc.is_featured ? 'currentColor' : 'none'} />
                                {doc.is_featured ? 'Destacado' : 'Sin destacar'}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {doc.url_original && (
                              <a href={doc.url_original} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 text-gray-400 hover:text-accent rounded hover:bg-blue-50 transition-colors" title="Ver documento">
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button onClick={() => openEditDoc(doc)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors" title="Editar">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteDoc(doc.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors" title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {docsFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          No se encontraron documentos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Anuncios tab ── */}
        {tab === 'anuncios' && (
          <div className="space-y-4">
            {ads.length === 0 && !loading ? (
              <div className="text-center py-16 text-gray-400">
                <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay anuncios configurados</p>
                <Button onClick={openNewAd} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />Crear primer anuncio
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {ads.map(ad => (
                  <div key={ad.id} className="bg-white rounded-xl border overflow-hidden">
                    {/* Preview */}
                    <div className="relative p-6 flex items-center gap-5" style={{ backgroundColor: ad.color_fondo }}>
                      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10" style={{ backgroundColor: ad.color_texto }} />
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 flex-shrink-0">
                        <Megaphone className="w-5 h-5" style={{ color: ad.color_texto }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold" style={{ color: ad.color_texto }}>{ad.titulo}</p>
                        {ad.subtitulo && <p className="text-sm opacity-80 mt-0.5" style={{ color: ad.color_texto }}>{ad.subtitulo}</p>}
                      </div>
                      {ad.cta_url && (
                        <span className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/20" style={{ color: ad.color_texto }}>
                          {ad.cta_texto}
                        </span>
                      )}
                    </div>
                    {/* Controls */}
                    <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ad.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {ad.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="text-xs text-gray-400">Orden: {ad.orden}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEditAd(ad)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteAd(ad.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ── Importar / Descargar tab ── */}
        {tab === 'importar' && (
          <div className="space-y-6 max-w-3xl">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{docs.length}</p>
                    <p className="text-xs text-gray-500">Total documentos</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{docs.filter(d => d.storage_path).length}</p>
                    <p className="text-xs text-gray-500">Descargados a Storage</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                    <CloudDownload className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{pendingCount ?? '…'}</p>
                    <p className="text-xs text-gray-500">Pendientes de descarga</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Download control panel */}
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CloudDownload className="w-5 h-5 text-accent" />
                  Descarga masiva desde URLs originales
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Descarga documentos desde sus URLs originales y los almacena en Supabase Storage.
                  Ejecuta en lotes de {downloadLimit} documentos para evitar timeouts.
                </p>
              </div>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por aseguradora (opcional)</label>
                  <select value={downloadAseg} onChange={e => setDownloadAseg(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="">Todas las aseguradoras</option>
                    {[...new Set(docs.map(d => d.aseguradora).filter(Boolean))].map(a => (
                      <option key={a} value={a!}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="text-center min-w-[80px]">
                  <p className="text-xs text-gray-500 mb-1">Offset actual</p>
                  <div className="flex items-center gap-1">
                    <input type="number" value={downloadOffset} onChange={e => setDownloadOffset(Math.max(0, +e.target.value))}
                      className="w-16 text-sm text-center border border-gray-200 rounded-lg px-2 py-2 focus:outline-none" min={0} />
                    <button onClick={() => setDownloadOffset(0)} className="text-xs text-gray-400 hover:text-gray-600 px-1">Reset</button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => runBulkDownload(true)} disabled={downloadRunning}>
                  {downloadRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
                  Vista previa (dry run)
                </Button>
                <Button onClick={() => runBulkDownload(false)} disabled={downloadRunning || pendingCount === 0}>
                  {downloadRunning
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Descargando...</>
                    : <><CloudDownload className="w-4 h-4 mr-2" />Descargar lote ({downloadLimit})</>
                  }
                </Button>
                {pendingCount === 0 && (
                  <span className="flex items-center text-sm text-emerald-600 gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />Todos descargados
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400">
                Tip: Ejecuta varios lotes haciendo clic repetidamente. El offset avanza automáticamente.
                Para reiniciar, presiona "Reset" en el offset.
              </p>
            </div>

            {/* Results */}
            {downloadSummary && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Resultado del lote</h4>
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-600 font-medium">{downloadSummary.downloaded} descargados</span>
                    <span className="text-amber-600 font-medium">{downloadSummary.skipped} omitidos</span>
                    <span className="text-red-500 font-medium">{downloadSummary.errors} errores</span>
                  </div>
                </div>
                {'docs' in downloadSummary ? (
                  <div className="p-4">
                    <p className="text-sm text-gray-500 mb-3">Vista previa — documentos pendientes:</p>
                    <div className="space-y-1">
                      {(downloadSummary as any).docs?.map((d: any) => (
                        <div key={d.id} className="flex items-center gap-2 text-sm py-1 border-b border-gray-50 last:border-0">
                          <Globe className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          <span className="font-medium text-gray-700 flex-1 truncate">{d.titulo}</span>
                          <span className="text-xs text-gray-400">{d.aseguradora}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {downloadSummary.results?.map(r => (
                      <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                        {r.status === 'downloaded' && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                        {r.status === 'error' && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                        {r.status === 'skipped' && <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                        <span className="text-sm text-gray-700 flex-1 truncate">{r.titulo}</span>
                        {r.storage_path && <span className="text-xs text-gray-400 truncate max-w-[200px]">{r.storage_path}</span>}
                        {r.error && <span className="text-xs text-red-400 truncate max-w-[200px]">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Knowledge base summary */}
            <div className="bg-white rounded-xl border p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" />
                Estado de Chava IA
              </h4>
              <ChavaKnowledgeStats />
            </div>
          </div>
        )}
      </div>
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">{editDoc ? 'Editar documento' : 'Nuevo documento'}</h2>
              <button onClick={() => setShowDocModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <Input value={docForm.titulo} onChange={e => setDocForm(p => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ej: GNP Autos - Manual de Coberturas 2026" />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={docForm.descripcion || ''}
                  onChange={e => setDocForm(p => ({ ...p, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                  placeholder="Breve descripción del contenido del documento..." />
              </div>

              {/* Row: Aseguradora + Ramo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aseguradora</label>
                  <Input value={docForm.aseguradora || ''} onChange={e => setDocForm(p => ({ ...p, aseguradora: e.target.value }))}
                    placeholder="GNP, AXA, CHUBB..." list="aseg-list" />
                  <datalist id="aseg-list">
                    {['GNP', 'AXA', 'Allianz', 'CHUBB', 'MAPFRE', 'ANA Seguros', 'Inbursa', 'BUPA', 'BX+', 'Qualitas', 'Atlas', 'Zurich', 'Afirme', 'General'].map(a => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ramo</label>
                  <select value={docForm.ramo || ''} onChange={e => setDocForm(p => ({ ...p, ramo: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="">Seleccionar...</option>
                    {RAMOS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Row: Categoría + Formato */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select value={docForm.categoria || ''} onChange={e => setDocForm(p => ({ ...p, categoria: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20">
                    <option value="">Seleccionar...</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Formato</label>
                  <select value={docForm.formato || 'pdf'} onChange={e => setDocForm(p => ({ ...p, formato: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20">
                    {FORMATOS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              {/* URL original */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL del documento</label>
                <Input value={docForm.url_original || ''} onChange={e => setDocForm(p => ({ ...p, url_original: e.target.value }))}
                  placeholder="https://..." />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
                <div className="flex gap-2 mb-2">
                  <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const t = tagInput.trim().toLowerCase();
                        if (t && !docForm.tags.includes(t)) setDocForm(p => ({ ...p, tags: [...p.tags, t] }));
                        setTagInput('');
                      }
                    }}
                    placeholder="Escribir etiqueta + Enter" className="flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const t = tagInput.trim().toLowerCase();
                    if (t && !docForm.tags.includes(t)) setDocForm(p => ({ ...p, tags: [...p.tags, t] }));
                    setTagInput('');
                  }}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {docForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {docForm.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full">
                        <Tag className="w-2.5 h-2.5" />{tag}
                        <button onClick={() => setDocForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }))}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Activo</span>
                  <ToggleBtn value={docForm.activo} onChange={v => setDocForm(p => ({ ...p, activo: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500" />Destacado
                  </span>
                  <ToggleBtn value={docForm.is_featured} onChange={v => setDocForm(p => ({ ...p, is_featured: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />Reciente
                  </span>
                  <ToggleBtn value={docForm.is_recent} onChange={v => setDocForm(p => ({ ...p, is_recent: v }))} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t rounded-b-2xl">
              <Button variant="outline" onClick={() => setShowDocModal(false)}>Cancelar</Button>
              <Button onClick={saveDoc} disabled={saving}>
                {saving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><Save className="w-4 h-4 mr-2" />Guardar</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ad Modal ─────────────────────────────────────────────────────────────── */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">{editAd ? 'Editar anuncio' : 'Nuevo anuncio'}</h2>
              <button onClick={() => setShowAdModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Live preview */}
            <div className="px-6 pt-4">
              <div className="relative overflow-hidden rounded-xl p-4 flex items-center gap-4 mb-4" style={{ backgroundColor: adForm.color_fondo }}>
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10" style={{ backgroundColor: adForm.color_texto }} />
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/20 flex-shrink-0">
                  <Megaphone className="w-4 h-4" style={{ color: adForm.color_texto }} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: adForm.color_texto }}>{adForm.titulo || 'Título del anuncio'}</p>
                  {adForm.subtitulo && <p className="text-xs opacity-80 mt-0.5" style={{ color: adForm.color_texto }}>{adForm.subtitulo}</p>}
                </div>
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/20 flex-shrink-0" style={{ color: adForm.color_texto }}>
                  {adForm.cta_texto || 'Ver más'}
                </span>
              </div>
            </div>

            <div className="px-6 pb-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <Input value={adForm.titulo} onChange={e => setAdForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Título del anuncio" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
                <Input value={adForm.subtitulo || ''} onChange={e => setAdForm(p => ({ ...p, subtitulo: e.target.value }))} placeholder="Descripción breve..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Texto del CTA</label>
                  <Input value={adForm.cta_texto} onChange={e => setAdForm(p => ({ ...p, cta_texto: e.target.value }))} placeholder="Ver más" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL del CTA</label>
                  <Input value={adForm.cta_url || ''} onChange={e => setAdForm(p => ({ ...p, cta_url: e.target.value }))} placeholder="/centro-digital" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color fondo</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={adForm.color_fondo} onChange={e => setAdForm(p => ({ ...p, color_fondo: e.target.value }))}
                      className="w-9 h-9 rounded cursor-pointer border border-gray-200" />
                    <Input value={adForm.color_fondo} onChange={e => setAdForm(p => ({ ...p, color_fondo: e.target.value }))}
                      className="text-xs font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color texto</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={adForm.color_texto} onChange={e => setAdForm(p => ({ ...p, color_texto: e.target.value }))}
                      className="w-9 h-9 rounded cursor-pointer border border-gray-200" />
                    <Input value={adForm.color_texto} onChange={e => setAdForm(p => ({ ...p, color_texto: e.target.value }))}
                      className="text-xs font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <Input type="number" value={adForm.orden} onChange={e => setAdForm(p => ({ ...p, orden: +e.target.value }))} min={1} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-gray-600">Activo</span>
                <ToggleBtn value={adForm.activo} onChange={v => setAdForm(p => ({ ...p, activo: v }))} />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t rounded-b-2xl">
              <Button variant="outline" onClick={() => setShowAdModal(false)}>Cancelar</Button>
              <Button onClick={saveAd} disabled={saving}>
                {saving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><Save className="w-4 h-4 mr-2" />Guardar</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChavaKnowledgeStats() {
  const [stats, setStats] = useState<{ total: number; indexados: number; fragmentos: number } | null>(null);

  useEffect(() => {
    async function load() {
      const [docsRes, fragRes] = await Promise.all([
        supabase.from('chava_documentos')
          .select('id, estado', { count: 'exact' })
          .eq('acceso', 'todos'),
        supabase.from('chava_fragmentos')
          .select('id', { count: 'exact' }),
      ]);
      const total = docsRes.count ?? 0;
      const indexados = (docsRes.data || []).filter(d => d.estado === 'ready').length;
      const fragmentos = fragRes.count ?? 0;
      setStats({ total, indexados, fragmentos });
    }
    load();
  }, []);

  if (!stats) return <div className="text-sm text-gray-400">Cargando...</div>;

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      <div>
        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        <p className="text-xs text-gray-500 mt-0.5">Documentos indexados</p>
      </div>
      <div>
        <p className="text-2xl font-bold text-emerald-600">{stats.indexados}</p>
        <p className="text-xs text-gray-500 mt-0.5">Estado "ready"</p>
      </div>
      <div>
        <p className="text-2xl font-bold text-blue-600">{stats.fragmentos}</p>
        <p className="text-xs text-gray-500 mt-0.5">Fragmentos de texto</p>
      </div>
    </div>
  );
}
