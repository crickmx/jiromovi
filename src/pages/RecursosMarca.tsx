import { useState, useEffect, useRef } from 'react';
import { Upload, Download, AlertTriangle, Loader2, CheckCircle2, Type, Palette, Image as ImageIcon, Bookmark, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { tieneAccesoEquipoMkt } from '../lib/mktUtils';
import { LoadingState } from '@/components/ui/loading-state';

const BUCKET = 'recursos-marca';

interface LogoFamilia { key: string; label: string; description: string; orden: number; colores: string[] }

const LOGO_COLORS = [
  { key: 'navy',    label: 'Navy',      hex: '#121A2D', previewBg: '#E2E1CC' },
  { key: 'white',   label: 'Blanco',    hex: '#FFFFFF', previewBg: '#121A2D' },
  { key: 'black',   label: 'Negro',     hex: '#000000', previewBg: '#E2E1CC' },
  { key: 'ink',     label: 'Ink',       hex: '#1A2035', previewBg: '#E2E1CC' },
  { key: 'cream',   label: 'Crema',     hex: '#E2E1CC', previewBg: '#164281' },
  { key: 'pale',    label: 'Pale',      hex: '#C8C7B3', previewBg: '#4A5C72' },
  { key: 'yellow',  label: 'Amarillo',  hex: '#FFD62B', previewBg: '#121A2D' },
  { key: 'mustard', label: 'Mostaza',   hex: '#F4AD0F', previewBg: '#121A2D' },
  { key: 'green',   label: 'Verde',     hex: '#93C01F', previewBg: '#121A2D' },
  { key: 'sage',    label: 'Sage',      hex: '#7A9E78', previewBg: '#121A2D' },
];

type Section = 'logos' | 'iconos' | 'fuentes' | 'paleta';

const SECTIONS: { key: Section; label: string; icon: typeof Bookmark }[] = [
  { key: 'logos',   label: 'Logos',      icon: Bookmark },
  { key: 'iconos',  label: 'Iconos',     icon: ImageIcon },
  { key: 'fuentes', label: 'Tipografía', icon: Type },
  { key: 'paleta',  label: 'Paleta',     icon: Palette },
];

const UPLOAD_FOLDERS = [
  { key: 'logos/',   label: 'Logos' },
  { key: 'iconos/',  label: 'Iconos' },
  { key: 'fuentes/', label: 'Fuentes' },
  { key: 'otros/',   label: 'Otros' },
];

interface BrandFile { name: string; url: string; size: number }

function parseLogoName(name: string, familias: LogoFamilia[]): { family: string; color: string } | null {
  const base = name.replace(/\.(png|jpg|jpeg|svg|webp)$/i, '');
  for (const { key } of familias) {
    if (base.startsWith(`${key}-`)) {
      const color = base.slice(key.length + 1);
      if (LOGO_COLORS.some(c => c.key === color)) return { family: key, color };
    }
  }
  return null;
}

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function dl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch {
    window.open(url, '_blank');
  }
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function RecursosMarca() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'Administrador';
  const [tieneAccesoEquipo, setTieneAccesoEquipo] = useState(false);
  const isAdmin = esAdmin || tieneAccesoEquipo;

  useEffect(() => {
    if (esAdmin || !usuario) return;
    tieneAccesoEquipoMkt(usuario.id).then(setTieneAccesoEquipo);
  }, [usuario?.id, esAdmin]);

  // Core state
  const [loading, setLoading]             = useState(true);
  const [bucketError, setBucketError]     = useState(false);
  const [section, setSection]             = useState<Section>('logos');
  const [loadingSection, setLoadingSection] = useState(false);
  const [loaded, setLoaded]               = useState<Set<Section>>(new Set());

  // Data
  const [logoUrls, setLogoUrls]   = useState<Record<string, Record<string, string>>>({});
  const [iconFiles, setIconFiles] = useState<BrandFile[]>([]);
  const [fontFiles, setFontFiles] = useState<BrandFile[]>([]);
  const [paletaUrl, setPaletaUrl] = useState<string | null>(null);
  const [logoFamilias, setLogoFamilias] = useState<LogoFamilia[]>([]);

  // Nueva categoria de logo
  const [mostrarNuevaFamilia, setMostrarNuevaFamilia] = useState(false);
  const [nuevaFamiliaLabel, setNuevaFamiliaLabel] = useState('');
  const [nuevaFamiliaDesc, setNuevaFamiliaDesc] = useState('');
  const [nuevaFamiliaColores, setNuevaFamiliaColores] = useState<string[]>(['navy', 'white']);
  const [editandoColoresKey, setEditandoColoresKey] = useState<string | null>(null);
  const [guardandoFamilia, setGuardandoFamilia] = useState(false);
  const [errorFamilia, setErrorFamilia] = useState<string | null>(null);
  const [confirmandoEliminarKey, setConfirmandoEliminarKey] = useState<string | null>(null);
  const [eliminandoFamiliaKey, setEliminandoFamiliaKey] = useState<string | null>(null);

  // Per-family selected color
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});

  // Admin upload
  const [subiendo, setSubiendo]         = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [carpetaUpload, setCarpetaUpload] = useState('logos/');
  const [configurando, setConfigurando] = useState(false);
  const [configError, setConfigError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subir/borrar directo por celda (familia + color) en la grilla de logos
  const [slotOcupado, setSlotOcupado] = useState<string | null>(null);
  const [slotError, setSlotError]     = useState<string | null>(null);
  const slotInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    (async () => {
      const familias = await cargarFamilias();
      await cargarLogos(familias);
    })();
  }, []);

  useEffect(() => {
    if (bucketError || loaded.has(section)) return;
    if (section === 'iconos')  cargarFolder('iconos/',  setIconFiles);
    if (section === 'fuentes') cargarFolder('fuentes/', setFontFiles);
    if (section === 'paleta')  cargarPaleta();
  }, [section, bucketError]);

  async function cargarFamilias(): Promise<LogoFamilia[]> {
    const { data } = await supabase.from('mkt_logo_familias').select('*').order('orden');
    const familias = data ?? [];
    setLogoFamilias(familias);
    return familias;
  }

  async function crearFamilia() {
    if (!nuevaFamiliaLabel.trim()) return;
    if (nuevaFamiliaColores.length === 0) {
      setErrorFamilia('Elige al menos un color para la categoría.');
      return;
    }
    setGuardandoFamilia(true);
    setErrorFamilia(null);
    try {
      const key = slugify(nuevaFamiliaLabel);
      if (!key) throw new Error('Nombre inválido');
      const orden = logoFamilias.length;
      const { error } = await supabase.from('mkt_logo_familias').insert({
        key, label: nuevaFamiliaLabel.trim(), description: nuevaFamiliaDesc.trim(), orden, colores: nuevaFamiliaColores,
      });
      if (error) throw error;
      await cargarFamilias();
      setNuevaFamiliaLabel('');
      setNuevaFamiliaDesc('');
      setNuevaFamiliaColores(['navy', 'white']);
      setMostrarNuevaFamilia(false);
    } catch (e) {
      console.error('Error creando categoría de logo:', e);
      const mensaje = e instanceof Error
        ? e.message
        : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : null);
      setErrorFamilia(mensaje || 'Error al crear la categoría');
    } finally {
      setGuardandoFamilia(false);
    }
  }

  async function eliminarFamilia(key: string) {
    setEliminandoFamiliaKey(key);
    try {
      const { error } = await supabase.from('mkt_logo_familias').delete().eq('key', key);
      if (error) throw error;
      setConfirmandoEliminarKey(null);
      await cargarFamilias();
    } catch (e) {
      console.error('Error eliminando categoría de logo:', e);
      setErrorFamilia(e instanceof Error ? e.message : 'Error al eliminar la categoría');
    } finally {
      setEliminandoFamiliaKey(null);
    }
  }

  async function actualizarColoresFamilia(key: string, colores: string[]) {
    setLogoFamilias(prev => prev.map(f => f.key === key ? { ...f, colores } : f));
    const { error } = await supabase.from('mkt_logo_familias').update({ colores }).eq('key', key);
    if (error) {
      console.error('Error actualizando colores de categoría:', error);
      setErrorFamilia(error.message);
      await cargarFamilias();
    }
  }

  async function cargarLogos(familiasParam?: LogoFamilia[]) {
    const familias = familiasParam ?? logoFamilias;
    setLoading(true);
    setBucketError(false);

    const { data, error } = await supabase.storage.from(BUCKET).list('logos', { limit: 200 });

    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (msg.includes('not found') || msg.includes('bucket') || msg.includes('does not exist')) {
        setBucketError(true);
      }
      setLoading(false);
      return;
    }

    const files = (data ?? []).filter(f => f.id !== null && f.name !== '.emptyFolderPlaceholder');

    if (files.length > 0) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(files.map(f => `logos/${f.name}`), 7200);

      const map: Record<string, Record<string, string>> = {};
      for (const s of signed ?? []) {
        if (!s.signedUrl || s.error) continue;
        const fname = s.path.split('/').pop() ?? '';
        const parsed = parseLogoName(fname, familias);
        if (parsed) {
          (map[parsed.family] ??= {})[parsed.color] = s.signedUrl;
        }
      }
      setLogoUrls(map);
    }

    setLoaded(prev => new Set(prev).add('logos'));
    setLoading(false);
  }

  async function cargarFolder(folder: string, setFn: (files: BrandFile[]) => void) {
    setLoadingSection(true);
    const name = folder.slice(0, -1);
    const { data, error } = await supabase.storage.from(BUCKET).list(name, { limit: 200 });

    if (!error && data) {
      const files = data.filter(f => f.id !== null && f.name !== '.emptyFolderPlaceholder');
      if (files.length > 0) {
        const sizeMap = Object.fromEntries(files.map(f => [f.name, f.metadata?.size ?? 0]));
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(files.map(f => `${folder}${f.name}`), 7200);

        setFn((signed ?? [])
          .filter(s => s.signedUrl && !s.error)
          .map(s => {
            const fname = s.path.split('/').pop() ?? s.path;
            return { name: fname, url: s.signedUrl, size: sizeMap[fname] ?? 0 };
          })
        );
      }
    }

    const sectionKey = folder.slice(0, -1) as Section;
    setLoaded(prev => new Set(prev).add(sectionKey));
    setLoadingSection(false);
  }

  async function cargarPaleta() {
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl('otros/paleta-original.png', 7200);
    if (data?.signedUrl) setPaletaUrl(data.signedUrl);
    setLoaded(prev => new Set(prev).add('paleta'));
  }

  async function subir(files: FileList | null) {
    if (!files?.length || !isAdmin) return;
    setSubiendo(true); setUploadError(null);
    const errores: string[] = [];
    for (const file of Array.from(files)) {
      // En logos/ el nombre exacto (familia-color.ext) es lo que reconoce la
      // grilla — anteponer timestamp lo rompía siempre (nunca hacia match).
      const nombreLimpio = file.name.replace(/\s+/g, '_');
      const path = carpetaUpload === 'logos/'
        ? `${carpetaUpload}${nombreLimpio}`
        : `${carpetaUpload}${Date.now()}-${nombreLimpio}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) errores.push(`${file.name}: ${error.message}`);
    }
    if (errores.length) setUploadError(errores.join(' · '));
    // Reload affected section
    if (carpetaUpload === 'logos/') {
      setLoaded(prev => { const s = new Set(prev); s.delete('logos'); return s; });
      await cargarLogos();
    } else {
      const sec = carpetaUpload.slice(0, -1) as Section;
      setLoaded(prev => { const s = new Set(prev); s.delete(sec); return s; });
      if (sec === 'iconos') setIconFiles([]);
      if (sec === 'fuentes') setFontFiles([]);
    }
    setSubiendo(false);
  }

  async function subirLogoDirecto(familyKey: string, colorKey: string, file: File) {
    if (!isAdmin) return;
    const slot = `${familyKey}-${colorKey}`;
    setSlotOcupado(slot);
    setSlotError(null);
    try {
      // Borrar cualquier archivo existente de esta celda (sin importar extensión)
      // para no dejar huérfanos si el nuevo archivo cambia de formato.
      const { data: existentes } = await supabase.storage.from(BUCKET).list('logos', { limit: 200 });
      const viejos = (existentes ?? []).filter(f => f.name.replace(/\.[^.]+$/, '') === slot);
      if (viejos.length > 0) {
        await supabase.storage.from(BUCKET).remove(viejos.map(f => `logos/${f.name}`));
      }

      const ext = file.name.split('.').pop() || 'png';
      const { error } = await supabase.storage.from(BUCKET).upload(`logos/${slot}.${ext}`, file, { upsert: true });
      if (error) throw error;

      setLoaded(prev => { const s = new Set(prev); s.delete('logos'); return s; });
      await cargarLogos();
    } catch (e) {
      setSlotError(e instanceof Error ? e.message : 'Error al subir el logo');
    } finally {
      setSlotOcupado(null);
    }
  }

  async function borrarLogoDirecto(familyKey: string, colorKey: string) {
    if (!isAdmin) return;
    const slot = `${familyKey}-${colorKey}`;
    setSlotOcupado(slot);
    setSlotError(null);
    try {
      const { data: existentes } = await supabase.storage.from(BUCKET).list('logos', { limit: 200 });
      const archivos = (existentes ?? []).filter(f => f.name.replace(/\.[^.]+$/, '') === slot);
      if (archivos.length > 0) {
        await supabase.storage.from(BUCKET).remove(archivos.map(f => `logos/${f.name}`));
      }
      setLoaded(prev => { const s = new Set(prev); s.delete('logos'); return s; });
      await cargarLogos();
    } catch (e) {
      setSlotError(e instanceof Error ? e.message : 'Error al borrar el logo');
    } finally {
      setSlotOcupado(null);
    }
  }

  async function configurarBucket() {
    if (!isAdmin) return;
    setConfigurando(true); setConfigError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-recursos-marca`,
        { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' } }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido');
      await cargarLogos();
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : 'Error al configurar');
    } finally { setConfigurando(false); }
  }

  if (!usuario) return null;

  // ── Bucket no configurado ──────────────────────────────────────────────────
  if (bucketError) return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 p-10 flex flex-col items-center text-center gap-4">
      <AlertTriangle className="w-8 h-8 text-amber-500" />
      <div>
        <p className="font-semibold text-neutral-800 dark:text-white">Brand Kit no configurado</p>
        <p className="text-sm text-neutral-500 dark:text-white/50 mt-1 max-w-sm">
          {isAdmin
            ? 'Haz clic para configurar el almacenamiento automáticamente.'
            : 'Pide a un administrador que active el Brand Kit.'}
        </p>
      </div>
      {isAdmin && (
        <div className="flex flex-col items-center gap-2">
          <button onClick={configurarBucket} disabled={configurando}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition disabled:opacity-60">
            {configurando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {configurando ? 'Configurando…' : 'Configurar Brand Kit'}
          </button>
          {configError && <p className="text-xs text-red-600 dark:text-red-400">{configError}</p>}
        </div>
      )}
    </div>
  );

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button key={s.key} onClick={() => setSection(s.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition ${active
                  ? 'bg-accent text-white'
                  : 'bg-neutral-100 dark:bg-white/8 text-neutral-600 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/12'}`}>
                <Icon className="w-3.5 h-3.5" />{s.label}
              </button>
            );
          })}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <select value={carpetaUpload} onChange={e => setCarpetaUpload(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-700 dark:text-white focus:outline-none">
              {UPLOAD_FOLDERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <button onClick={() => inputRef.current?.click()} disabled={subiendo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition disabled:opacity-60">
              <Upload className="w-3.5 h-3.5" />{subiendo ? 'Subiendo…' : 'Subir'}
            </button>
            <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.zip,.svg,.ttf,.otf" className="hidden"
              onChange={e => subir(e.target.files)} />
          </div>
        )}
      </div>

      {uploadError && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
          {uploadError}
        </p>
      )}

      {/* ── LOGOS ─────────────────────────────────────────────────────────── */}
      {section === 'logos' && (
        loading
          ? <LoadingState text="Cargando logos…" compact />
          : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-white/3 p-5 space-y-4">
                <p className="text-sm font-semibold text-neutral-800 dark:text-white">Reglas de uso del logotipo</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-neutral-600 dark:text-white/60">
                  <div>
                    <p className="font-medium text-neutral-700 dark:text-white/80 mb-1">Color según el fondo</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Fondo claro (blanco, crema): versión <strong>navy</strong></li>
                      <li>Fondo oscuro, azul o fotografía: versión <strong>blanca</strong></li>
                      <li>Impresión a una tinta: versión <strong>negra</strong></li>
                      <li>Marcas de agua o fondos sutiles: versión <strong>pale</strong></li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-700 dark:text-white/80 mb-1">Área de respiro y tamaño mínimo</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Deja libre un margen de 0.5× la altura de la montaña en los 4 lados</li>
                      <li>Horizontal: 96 px en pantalla · 25 mm impreso</li>
                      <li>Isotipo solo: 32 px en pantalla · 10 mm impreso</li>
                    </ul>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-1 border-t border-neutral-200 dark:border-white/8">
                  <div className="pt-3">
                    <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">✓ Correcto</p>
                    <ul className="space-y-1 list-disc list-inside text-neutral-600 dark:text-white/60">
                      <li>Usar el archivo oficial sin modificar</li>
                      <li>Respetar la proporción original al escalar</li>
                      <li>Colocarlo sobre fondos con contraste suficiente</li>
                    </ul>
                  </div>
                  <div className="pt-3">
                    <p className="font-medium text-red-700 dark:text-red-400 mb-1">✕ Incorrecto</p>
                    <ul className="space-y-1 list-disc list-inside text-neutral-600 dark:text-white/60">
                      <li>Estirar, comprimir, rotar o inclinar el logotipo</li>
                      <li>Aplicar degradados, sombras, contornos o relieves</li>
                      <li>Recolorear la montaña o el texto por separado</li>
                      <li>Colocar el logo navy sobre fondos oscuros</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 dark:text-white/40">
                  Las variantes de acento (amarillo, verde, mostaza, salvia) son para piezas especiales — no las uses en comunicación institucional ni documentos oficiales.
                </p>
              </div>

              {isAdmin && (
                <div>
                  {!mostrarNuevaFamilia ? (
                    <button
                      onClick={() => setMostrarNuevaFamilia(true)}
                      className="flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                    >
                      + Nueva categoría
                    </button>
                  ) : (
                    <div className="flex flex-col gap-3 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Nombre</label>
                          <input
                            type="text"
                            value={nuevaFamiliaLabel}
                            onChange={e => setNuevaFamiliaLabel(e.target.value)}
                            placeholder="Ej. Jiro Fianzas"
                            className="px-3 py-2 text-sm border border-neutral-200 dark:border-white/15 rounded-lg bg-white dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1">Descripción (opcional)</label>
                          <input
                            type="text"
                            value={nuevaFamiliaDesc}
                            onChange={e => setNuevaFamiliaDesc(e.target.value)}
                            placeholder="Ej. Logo de la línea de negocio Jiro Fianzas"
                            className="px-3 py-2 text-sm border border-neutral-200 dark:border-white/15 rounded-lg bg-white dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent w-64"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-500 dark:text-white/50 mb-1.5">Colores que aplican a esta categoría</label>
                        <div className="flex flex-wrap gap-2">
                          {LOGO_COLORS.map(color => {
                            const activo = nuevaFamiliaColores.includes(color.key);
                            return (
                              <button
                                key={color.key}
                                type="button"
                                onClick={() => setNuevaFamiliaColores(prev =>
                                  activo ? prev.filter(k => k !== color.key) : [...prev, color.key]
                                )}
                                title={color.label}
                                className={`w-7 h-7 rounded-full transition-transform flex-shrink-0 ${activo ? 'ring-2 ring-offset-1 ring-accent dark:ring-offset-neutral-900' : 'opacity-40 hover:opacity-70'}`}
                                style={{ backgroundColor: color.hex, border: color.hex === '#FFFFFF' ? '1px solid #d1d5db' : 'none' }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={crearFamilia}
                          disabled={guardandoFamilia || !nuevaFamiliaLabel.trim()}
                          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50"
                        >
                          {guardandoFamilia ? 'Creando...' : 'Crear'}
                        </button>
                        <button
                          onClick={() => { setMostrarNuevaFamilia(false); setNuevaFamiliaLabel(''); setNuevaFamiliaDesc(''); setNuevaFamiliaColores(['navy', 'white']); setErrorFamilia(null); }}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                  {errorFamilia && <p className="text-sm text-red-600 dark:text-red-400 mt-1.5">{errorFamilia}</p>}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {logoFamilias.map(family => {
                const coloresFamilia = LOGO_COLORS.filter(c => family.colores.includes(c.key));
                const selColor = selectedColors[family.key] ?? coloresFamilia[0]?.key ?? 'navy';
                const colorDef = LOGO_COLORS.find(c => c.key === selColor) ?? LOGO_COLORS[0];
                const logoUrl  = logoUrls[family.key]?.[selColor];
                const darkBg   = ['#121A2D', '#164281', '#4A5C72'].includes(colorDef.previewBg);

                return (
                  <div key={family.key}
                    className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3 overflow-hidden flex flex-col">

                    {/* Preview */}
                    <div className="aspect-video flex items-center justify-center p-8 transition-colors duration-300"
                      style={{ backgroundColor: colorDef.previewBg }}>
                      {logoUrl
                        ? <img src={logoUrl} alt={`${family.label} ${selColor}`} className="max-h-16 max-w-full object-contain" />
                        : <span className="text-xs opacity-25" style={{ color: darkBg ? '#fff' : '#333' }}>Sin archivo</span>
                      }
                    </div>

                    {/* Controls */}
                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm text-neutral-800 dark:text-white">{family.label}</p>
                          <p className="text-xs text-neutral-400 dark:text-white/40">{family.description}</p>
                        </div>
                        {isAdmin && (
                          confirmandoEliminarKey === family.key ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => eliminarFamilia(family.key)}
                                disabled={eliminandoFamiliaKey === family.key}
                                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                {eliminandoFamiliaKey === family.key ? '...' : 'Confirmar'}
                              </button>
                              <button
                                onClick={() => setConfirmandoEliminarKey(null)}
                                className="text-xs font-medium text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => setEditandoColoresKey(prev => prev === family.key ? null : family.key)}
                                title="Editar colores"
                                className={`transition-colors ${editandoColoresKey === family.key ? 'text-accent' : 'text-neutral-300 hover:text-accent dark:text-white/20 dark:hover:text-accent'}`}
                              >
                                <Palette className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setConfirmandoEliminarKey(family.key)}
                                title="Eliminar categoría"
                                className="text-neutral-300 hover:text-red-600 dark:text-white/20 dark:hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        )}
                      </div>

                      {editandoColoresKey === family.key && (
                        <div className="flex flex-wrap gap-2 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg p-2.5">
                          {LOGO_COLORS.map(color => {
                            const activo = family.colores.includes(color.key);
                            return (
                              <button
                                key={color.key}
                                title={color.label}
                                onClick={() => actualizarColoresFamilia(
                                  family.key,
                                  activo ? family.colores.filter(k => k !== color.key) : [...family.colores, color.key]
                                )}
                                className={`w-6 h-6 rounded-full transition-transform ${activo ? 'ring-2 ring-offset-1 ring-accent dark:ring-offset-neutral-900' : 'opacity-30 hover:opacity-60'}`}
                                style={{ backgroundColor: color.hex, border: color.hex === '#FFFFFF' ? '1px solid #d1d5db' : 'none' }}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Color swatches */}
                      {coloresFamilia.length === 0 ? (
                        <p className="text-xs text-neutral-400 dark:text-white/40 italic">Sin colores asignados — usa el ícono de paleta para elegir.</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {coloresFamilia.map(color => (
                            <button key={color.key} title={color.label}
                              onClick={() => setSelectedColors(prev => ({ ...prev, [family.key]: color.key }))}
                              className={`w-5 h-5 rounded-full transition-transform ${
                                selColor === color.key
                                  ? 'ring-2 ring-offset-1 ring-accent dark:ring-offset-neutral-900 scale-125'
                                  : 'hover:scale-110'
                              }`}
                              style={{
                                backgroundColor: color.hex,
                                border: color.hex === '#FFFFFF' ? '1px solid #d1d5db' : 'none',
                              }}
                            />
                          ))}
                          <span className="text-xs text-neutral-400 dark:text-white/40 ml-1">{colorDef.label}</span>
                        </div>
                      )}

                      {/* Download */}
                      <button
                        onClick={() => logoUrl && dl(logoUrl, `jiro-${family.key}-${selColor}.png`)}
                        disabled={!logoUrl}
                        className="mt-auto flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-white/8 text-sm font-medium text-neutral-700 dark:text-white/80 hover:bg-neutral-200 dark:hover:bg-white/12 transition disabled:opacity-30 disabled:cursor-not-allowed">
                        <Download className="w-3.5 h-3.5" />
                        Descargar {colorDef.label.toLowerCase()}
                      </button>

                      {/* Subir/borrar directo (solo Admin/equipo) */}
                      {isAdmin && (() => {
                        const slot = `${family.key}-${selColor}`;
                        const ocupado = slotOcupado === slot;
                        return (
                          <div className="flex items-center gap-2">
                            <input
                              ref={el => { slotInputRefs.current[slot] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={ocupado}
                              onChange={e => e.target.files?.[0] && subirLogoDirecto(family.key, selColor, e.target.files[0])}
                            />
                            <button
                              onClick={() => slotInputRefs.current[slot]?.click()}
                              disabled={ocupado}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition disabled:opacity-40">
                              {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                              {logoUrl ? `Reemplazar ${colorDef.label.toLowerCase()}` : `Subir ${colorDef.label.toLowerCase()}`}
                            </button>
                            {logoUrl && (
                              <button
                                onClick={() => borrarLogoDirecto(family.key, selColor)}
                                disabled={ocupado}
                                title="Borrar"
                                className="flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition disabled:opacity-40">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )
      )}
      {isAdmin && slotError && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
          {slotError}
        </p>
      )}

      {/* ── ICONOS ────────────────────────────────────────────────────────── */}
      {section === 'iconos' && (
        loadingSection
          ? <LoadingState text="Cargando iconos…" compact />
          : !iconFiles.length
            ? <p className="text-sm text-neutral-400 dark:text-white/40 text-center py-10">Sin iconos disponibles</p>
            : (
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3">
                {iconFiles.map(f => (
                  <button key={f.name} onClick={() => dl(f.url, f.name)}
                    className="group flex flex-col items-center gap-2 p-3 rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3 hover:border-accent/40 hover:bg-accent/5 transition">
                    <div className="w-10 h-10 flex items-center justify-center">
                      <img src={f.url} alt={f.name} className="max-w-full max-h-full object-contain dark:invert" />
                    </div>
                    <p className="text-[10px] text-neutral-400 dark:text-white/40 text-center truncate w-full">
                      {f.name.replace('.png', '')}
                    </p>
                    <Download className="w-3 h-3 text-neutral-300 dark:text-white/20 group-hover:text-accent transition" />
                  </button>
                ))}
              </div>
            )
      )}

      {/* ── FUENTES ───────────────────────────────────────────────────────── */}
      {section === 'fuentes' && (
        loadingSection
          ? <LoadingState text="Cargando tipografías…" compact />
          : !fontFiles.length
            ? <p className="text-sm text-neutral-400 dark:text-white/40 text-center py-10">Sin archivos disponibles</p>
            : (
              <div className="rounded-2xl border border-neutral-200 dark:border-white/8 overflow-hidden divide-y divide-neutral-100 dark:divide-white/5">
                {fontFiles.map(f => (
                  <div key={f.name}
                    className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-white/3 hover:bg-neutral-50 dark:hover:bg-white/5 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-white/8 flex items-center justify-center shrink-0">
                        <Type className="w-4 h-4 text-neutral-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-800 dark:text-white">{f.name}</p>
                        {f.size > 0 && <p className="text-xs text-neutral-400">{fmtBytes(f.size)}</p>}
                      </div>
                    </div>
                    <button onClick={() => dl(f.url, f.name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-white/8 text-neutral-700 dark:text-white/70 text-xs font-medium hover:bg-neutral-200 dark:hover:bg-white/12 transition">
                      <Download className="w-3.5 h-3.5" />Descargar
                    </button>
                  </div>
                ))}
              </div>
            )
      )}

      {/* ── PALETA ────────────────────────────────────────────────────────── */}
      {section === 'paleta' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-white/3 p-5 space-y-5">
            <div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-white mb-1">Colores corporativos</p>
              <p className="text-xs text-neutral-500 dark:text-white/50 mb-3">Definen la marca — botones, títulos, fondos y texto principal.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { nombre: 'Azul JIRO', hex: '#164281', uso: 'Botones, títulos, enlaces' },
                  { nombre: 'Navy', hex: '#121A2D', uso: 'Texto y fondos oscuros' },
                  { nombre: 'Crema', hex: '#E2E1CC', uso: 'Fondo cálido, tarjetas' },
                  { nombre: 'Blanco', hex: '#FFFFFF', uso: 'Fondo base, logo negativo' },
                ].map(c => (
                  <div key={c.hex} className="space-y-1.5">
                    <div className="h-12 rounded-xl border border-neutral-200 dark:border-white/10" style={{ backgroundColor: c.hex }} />
                    <p className="text-xs font-medium text-neutral-700 dark:text-white/80">{c.nombre}</p>
                    <p className="text-[11px] text-neutral-400 dark:text-white/40 font-mono">{c.hex}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-white mb-1">Acentos por ramo</p>
              <p className="text-xs text-neutral-500 dark:text-white/50 mb-3">Un color por ramo, siempre el mismo — es clasificación, no decoración.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { nombre: 'Amarillo', hex: '#FFD62B', ramo: 'Autos' },
                  { nombre: 'Verde', hex: '#93C01F', ramo: 'Vida y GMM' },
                  { nombre: 'Naranja', hex: '#F4AD0F', ramo: 'Hogar y Empresarial' },
                  { nombre: 'Menta', hex: '#59D1AF', ramo: 'Fianzas y Ahorro' },
                ].map(c => (
                  <div key={c.hex} className="space-y-1.5">
                    <div className="h-12 rounded-xl border border-neutral-200 dark:border-white/10" style={{ backgroundColor: c.hex }} />
                    <p className="text-xs font-medium text-neutral-700 dark:text-white/80">{c.nombre}</p>
                    <p className="text-[11px] text-neutral-400 dark:text-white/40">{c.ramo} · <span className="font-mono">{c.hex}</span></p>
                  </div>
                ))}
              </div>
            </div>

            <ul className="space-y-1 text-sm text-neutral-600 dark:text-white/60 list-disc list-inside pt-1 border-t border-neutral-200 dark:border-white/8 pt-3">
              <li>Máximo dos colores de fondo por pieza — el resto se resuelve con blanco y crema</li>
              <li>Los acentos nunca se usan como fondo de página completa ni para texto corrido</li>
              <li>No mezcles los cuatro acentos en una misma sección salvo que muestres todos los ramos juntos</li>
              <li>Texto sobre azul o navy: siempre blanco. Texto sobre amarillo, verde, naranja o menta: siempre navy</li>
              <li>No inventes tonos intermedios ni degradados entre colores de la paleta</li>
            </ul>
          </div>

          {paletaUrl && (
            <div className="flex flex-col items-center gap-4">
              <img src={paletaUrl} alt="Paleta de color JIRO"
                className="max-w-2xl w-full rounded-2xl border border-neutral-200 dark:border-white/8 shadow-sm" />
              <button onClick={() => dl(paletaUrl, 'jiro-paleta-color.png')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/8 text-sm font-medium text-neutral-700 dark:text-white/70 hover:bg-neutral-200 dark:hover:bg-white/12 transition">
                <Download className="w-4 h-4" />Descargar paleta
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
