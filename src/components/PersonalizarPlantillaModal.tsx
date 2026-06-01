import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, Download, Image as ImageIcon, RotateCcw, Loader as Loader2, TriangleAlert as AlertTriangle, ZoomIn, ZoomOut, Maximize2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getEffectiveUserLogo } from '../lib/logoUtils';
import { getMiPaginaWeb } from '../lib/webUrlUtils';
import { getDisplayName } from '../lib/utils';
import { resolveImageUrl } from '../lib/storageUtils';

interface Plantilla {
  id: string;
  titulo: string | null;
  tipo: 'imagen' | 'video';
  archivo_url: string;
  ancho: number | null;
  alto: number | null;
  zona_logo: any;
  zona_texto: any;
  estilo_texto_default: any;
  estilos_texto_default_individual: any;
}

interface PersonalizarPlantillaModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantilla: Plantilla | null;
  onSuccess: () => void;
}

interface TextStyle {
  font: string;
  color: string;
  size: number;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
}

const FUENTES = ['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Impact'];

const CORPORATE_COLORS = { primary: '#1e40af', secondary: '#059669' };

function getDefaultStyle(color: string): TextStyle {
  return { font: 'Inter', color, size: 24, align: 'center', bold: false, italic: false };
}

function normalizeUrlForDisplay(url: string): string {
  if (!url) return '';
  let n = url.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
  if (n && !n.startsWith('www.')) n = 'www.' + n;
  return n;
}

// Load an image with CORS and a configurable proxy fallback
function loadCorsImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry without crossOrigin in case CORS isn't needed (same-origin)
      const img2 = new window.Image();
      img2.onload = () => resolve(img2);
      img2.onerror = () => reject(new Error(`No se pudo cargar imagen: ${src}`));
      img2.src = src + (src.includes('?') ? '&' : '?') + '_nc=' + Date.now();
    };
    img.src = src;
  });
}

export function PersonalizarPlantillaModal({ isOpen, onClose, plantilla, onSuccess }: PersonalizarPlantillaModalProps) {
  const { usuario } = useAuth();

  const officeAccentColor = (usuario as any)?.oficinas?.accent_color || (usuario as any)?.oficina?.accent_color || CORPORATE_COLORS.primary;
  const officeSecondaryColor = (usuario as any)?.oficinas?.secondary_color || CORPORATE_COLORS.secondary;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imageStatus, setImageStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [zoom, setZoom] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  const [nombreCompleto, setNombreCompleto] = useState('');
  const [contactoWeb, setContactoWeb] = useState('');
  const [contactoTelefono, setContactoTelefono] = useState('');

  const [primaryColor, setPrimaryColor] = useState(CORPORATE_COLORS.primary);
  const [secondaryColor, setSecondaryColor] = useState(CORPORATE_COLORS.secondary);

  const [styleNombre, setStyleNombre] = useState<TextStyle>(getDefaultStyle(CORPORATE_COLORS.primary));
  const [styleWeb, setStyleWeb] = useState<TextStyle>({ ...getDefaultStyle(CORPORATE_COLORS.secondary), size: 20 });
  const [styleTel, setStyleTel] = useState<TextStyle>({ ...getDefaultStyle(CORPORATE_COLORS.secondary), size: 20 });

  // Load user data when modal opens
  useEffect(() => {
    if (!isOpen || !plantilla) {
      resetForm();
      return;
    }

    setImageStatus('loading');
    setError('');

    if (usuario) {
      setNombreCompleto(getDisplayName(usuario));

      const web = getMiPaginaWeb(usuario.web_slug);
      setContactoWeb(web ? normalizeUrlForDisplay(web) : 'agentedeseguros.website');
      setContactoTelefono(usuario.celular_laboral || '');

      // Load logo hierarchy: personal > office > jiro
      getEffectiveUserLogo(usuario.id).then(logoUrl => {
        setLogoPreview(logoUrl || '/logojiro.png');
      }).catch(() => setLogoPreview('/logojiro.png'));

      // Determine colors: user web page > office accent > corporate
      supabase
        .from('user_web_pages')
        .select('primary_color, secondary_color')
        .eq('user_id', usuario.id)
        .maybeSingle()
        .then(({ data: wp }) => {
          const p = wp?.primary_color || officeAccentColor || CORPORATE_COLORS.primary;
          const s = wp?.secondary_color || officeSecondaryColor || CORPORATE_COLORS.secondary;
          setPrimaryColor(p);
          setSecondaryColor(s);
          applyStyles(plantilla, p, s);
        });
    } else {
      applyStyles(plantilla, CORPORATE_COLORS.primary, CORPORATE_COLORS.secondary);
    }
  }, [isOpen, plantilla]);

  const applyStyles = (tpl: Plantilla, p: string, s: string) => {
    const ind = tpl.estilos_texto_default_individual;
    const base = tpl.estilo_texto_default;
    if (ind) {
      setStyleNombre({ ...getDefaultStyle(p), ...(ind.nombreCompleto || {}) });
      setStyleWeb({ ...getDefaultStyle(s), size: 20, ...(ind.urlJiro || {}) });
      setStyleTel({ ...getDefaultStyle(s), size: 20, ...(ind.urlMulticotizador || {}) });
    } else if (base) {
      const n = { font: base.font || 'Inter', color: p, size: base.size || 24, align: base.align || 'center', bold: false, italic: false };
      const c = { ...n, color: s, size: 20 };
      setStyleNombre(n);
      setStyleWeb(c);
      setStyleTel(c);
    } else {
      setStyleNombre(getDefaultStyle(p));
      setStyleWeb({ ...getDefaultStyle(s), size: 20 });
      setStyleTel({ ...getDefaultStyle(s), size: 20 });
    }
  };

  const resetForm = () => {
    setLogoFile(null);
    setLogoPreview('');
    setNombreCompleto('');
    setContactoWeb('');
    setContactoTelefono('');
    setError('');
    setImageStatus('idle');
    setZoom(1);
  };

  // Re-render canvas whenever any input changes
  const renderCanvas = useCallback(async () => {
    if (!canvasRef.current || !plantilla || imageStatus === 'idle') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const resolvedSrc = resolveImageUrl(plantilla.archivo_url);
      const baseImg = await loadCorsImage(resolvedSrc);

      const MAX = 900;
      const scale = Math.min(1, MAX / baseImg.width);
      canvas.width = baseImg.width * scale;
      canvas.height = baseImg.height * scale;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

      setImageStatus('ready');

      // Draw logo
      if (logoPreview && plantilla.zona_logo) {
        try {
          const logoImg = await loadCorsImage(logoPreview);
          const lx = plantilla.zona_logo.x * canvas.width;
          const ly = plantilla.zona_logo.y * canvas.height;
          const lw = plantilla.zona_logo.width * canvas.width;
          const lh = plantilla.zona_logo.height * canvas.height;
          const la = logoImg.width / logoImg.height;
          const za = lw / lh;
          let dw = lw, dh = lh, dx = lx, dy = ly;
          if (la > za) { dh = lw / la; dy = ly + (lh - dh) / 2; }
          else { dw = lh * la; dx = lx + (lw - dw) / 2; }
          ctx.drawImage(logoImg, dx, dy, dw, dh);
        } catch { /* logo load failure is non-critical */ }
      }

      // Draw text
      if (plantilla.zona_texto) {
        const tx = plantilla.zona_texto.x * canvas.width;
        const ty = plantilla.zona_texto.y * canvas.height;
        const tw = plantilla.zona_texto.width * canvas.width;
        const th = plantilla.zona_texto.height * canvas.height;
        const texts = [
          ...(nombreCompleto ? [{ text: nombreCompleto, style: styleNombre }] : []),
          ...(contactoWeb ? [{ text: contactoWeb, style: styleWeb }] : []),
          ...(contactoTelefono ? [{ text: contactoTelefono, style: styleTel }] : []),
        ];
        const maxSz = Math.max(...texts.map(t => t.style.size), 16);
        const lineH = maxSz * 1.4;
        const totalH = texts.length * lineH;
        const startY = ty + (th - totalH) / 2 + maxSz;
        texts.forEach(({ text, style }, i) => {
          ctx.font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${style.size}px ${style.font}`;
          ctx.fillStyle = style.color;
          ctx.textAlign = style.align;
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
          let x = tx;
          if (style.align === 'center') x = tx + tw / 2;
          else if (style.align === 'right') x = tx + tw;
          ctx.fillText(text, x, startY + i * lineH, tw);
        });
      }
    } catch (err: any) {
      console.error('[PersonalizarPlantillaModal] renderCanvas error:', err);
      setImageStatus('error');
    }
  }, [plantilla, logoPreview, nombreCompleto, contactoWeb, contactoTelefono, styleNombre, styleWeb, styleTel, imageStatus]);

  // Trigger render on any change
  useEffect(() => {
    if (isOpen && plantilla && imageStatus !== 'error') {
      if (imageStatus === 'idle') setImageStatus('loading');
      renderCanvas();
    }
  }, [isOpen, plantilla, logoPreview, nombreCompleto, contactoWeb, contactoTelefono, styleNombre, styleWeb, styleTel, primaryColor, secondaryColor]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const generateFullResBlob = async (): Promise<Blob> => {
    if (!plantilla) throw new Error('No plantilla');
    const fullCanvas = document.createElement('canvas');
    const fullCtx = fullCanvas.getContext('2d');
    if (!fullCtx) throw new Error('No context');

    const resolvedSrc = resolveImageUrl(plantilla.archivo_url);
    const baseImg = await loadCorsImage(resolvedSrc);
    fullCanvas.width = baseImg.width;
    fullCanvas.height = baseImg.height;
    fullCtx.drawImage(baseImg, 0, 0);

    if (logoPreview && plantilla.zona_logo) {
      try {
        const logoImg = await loadCorsImage(logoPreview);
        const lx = plantilla.zona_logo.x * fullCanvas.width;
        const ly = plantilla.zona_logo.y * fullCanvas.height;
        const lw = plantilla.zona_logo.width * fullCanvas.width;
        const lh = plantilla.zona_logo.height * fullCanvas.height;
        const la = logoImg.width / logoImg.height;
        const za = lw / lh;
        let dw = lw, dh = lh, dx = lx, dy = ly;
        if (la > za) { dh = lw / la; dy = ly + (lh - dh) / 2; }
        else { dw = lh * la; dx = lx + (lw - dw) / 2; }
        fullCtx.drawImage(logoImg, dx, dy, dw, dh);
      } catch { /* skip logo if fails */ }
    }

    if (plantilla.zona_texto) {
      const tx = plantilla.zona_texto.x * fullCanvas.width;
      const ty = plantilla.zona_texto.y * fullCanvas.height;
      const tw = plantilla.zona_texto.width * fullCanvas.width;
      const th = plantilla.zona_texto.height * fullCanvas.height;
      const texts = [
        ...(nombreCompleto ? [{ text: nombreCompleto, style: styleNombre }] : []),
        ...(contactoWeb ? [{ text: contactoWeb, style: styleWeb }] : []),
        ...(contactoTelefono ? [{ text: contactoTelefono, style: styleTel }] : []),
      ];
      const maxSz = Math.max(...texts.map(t => t.style.size), 16);
      const lineH = maxSz * 1.4;
      const totalH = texts.length * lineH;
      const startY = ty + (th - totalH) / 2 + maxSz;
      texts.forEach(({ text, style }, i) => {
        fullCtx.font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${style.size}px ${style.font}`;
        fullCtx.fillStyle = style.color;
        fullCtx.textAlign = style.align;
        fullCtx.shadowColor = 'transparent'; fullCtx.shadowBlur = 0;
        let x = tx;
        if (style.align === 'center') x = tx + tw / 2;
        else if (style.align === 'right') x = tx + tw;
        fullCtx.fillText(text, x, startY + i * lineH, tw);
      });
    }

    return new Promise((resolve, reject) => {
      fullCanvas.toBlob(b => b ? resolve(b) : reject(new Error('Error blob')), 'image/png');
    });
  };

  const handleGuardar = async () => {
    if (!plantilla || !usuario) return;
    setSaving(true);
    setError('');

    try {
      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const fname = `${usuario.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('publicidad-logos').upload(fname, logoFile);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('publicidad-logos').getPublicUrl(fname);
        logoUrl = publicUrl;
      }

      const blob = await generateFullResBlob();
      const resultName = `${usuario.id}/${Date.now()}.png`;
      const { error: blobErr } = await supabase.storage.from('publicidad-disenos').upload(resultName, blob);
      if (blobErr) throw blobErr;
      const { data: { publicUrl: resultUrl } } = supabase.storage.from('publicidad-disenos').getPublicUrl(resultName);

      // Generate thumbnail at 400px wide
      let thumbnailUrl: string | null = null;
      try {
        const thumbCanvas = document.createElement('canvas');
        const src = canvasRef.current;
        if (src) {
          const scale = Math.min(1, 400 / src.width);
          thumbCanvas.width = Math.round(src.width * scale);
          thumbCanvas.height = Math.round(src.height * scale);
          const tCtx = thumbCanvas.getContext('2d');
          if (tCtx) {
            tCtx.drawImage(src, 0, 0, thumbCanvas.width, thumbCanvas.height);
            const thumbBlob: Blob = await new Promise((res, rej) =>
              thumbCanvas.toBlob(b => b ? res(b) : rej(new Error('thumb blob')), 'image/jpeg', 0.85)
            );
            const thumbName = `${usuario.id}/${Date.now()}_thumb.jpg`;
            const { error: thumbErr } = await supabase.storage.from('publicidad-disenos').upload(thumbName, thumbBlob);
            if (!thumbErr) {
              const { data: { publicUrl } } = supabase.storage.from('publicidad-disenos').getPublicUrl(thumbName);
              thumbnailUrl = publicUrl;
            }
          }
        }
      } catch { /* thumbnail is non-critical */ }

      const customConfig = {
        nombreCompleto,
        contactoWeb,
        contactoTelefono,
        styleNombre,
        styleWeb,
        styleTel,
        primaryColor,
        secondaryColor,
      };

      const { error: dbErr, data: disenoData } = await supabase
        .from('publicidad_disenos')
        .insert({
          usuario_id: usuario.id,
          plantilla_id: plantilla.id,
          logo_url: logoUrl,
          texto_personalizado: { nombreCompleto, urlJiro: contactoWeb, urlMulticotizador: contactoTelefono },
          estilo_texto: { nombreCompleto: styleNombre, urlJiro: styleWeb, urlMulticotizador: styleTel },
          archivo_resultante_url: resultUrl,
          thumbnail_url: thumbnailUrl || resultUrl,
          rendered_storage_path: resultName,
          custom_config_json: customConfig,
          needs_regeneration: false,
        })
        .select('id')
        .single();

      if (dbErr) throw dbErr;

      // Download the file for the user
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `diseno-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 200);

      // Fire-and-forget: AI copy generation
      if (disenoData?.id) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-design-copy`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ diseno_id: disenoData.id }),
            }).catch(() => {});
          }
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[PersonalizarPlantillaModal] save error:', err);
      setError(err.message || 'Error al guardar el diseño');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `preview-${Date.now()}.png`;
    link.click();
  };

  const updateStyle = (
    field: 'nombre' | 'web' | 'tel',
    key: keyof TextStyle,
    value: any
  ) => {
    const map = { nombre: setStyleNombre, web: setStyleWeb, tel: setStyleTel };
    const cur = { nombre: styleNombre, web: styleWeb, tel: styleTel };
    map[field]({ ...cur[field], [key]: value });
  };

  const StyleRow = ({ field, style, label }: { field: 'nombre' | 'web' | 'tel'; style: TextStyle; label: string }) => (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="block text-[10px] text-neutral-500 mb-0.5">Fuente</label>
          <select value={style.font} onChange={e => updateStyle(field, 'font', e.target.value)}
            className="w-full px-1.5 py-1 border border-neutral-300 dark:border-white/15 rounded text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-accent">
            {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-neutral-500 mb-0.5">Tamaño</label>
          <input type="number" min="10" max="120" value={style.size}
            onChange={e => updateStyle(field, 'size', parseInt(e.target.value) || 16)}
            className="w-full px-1.5 py-1 border border-neutral-300 dark:border-white/15 rounded text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-accent" />
        </div>
        <div>
          <label className="block text-[10px] text-neutral-500 mb-0.5">Color</label>
          <div className="flex gap-0.5">
            <input type="color" value={style.color} onChange={e => updateStyle(field, 'color', e.target.value)}
              className="h-7 w-7 rounded border border-neutral-300 cursor-pointer" />
            <input type="text" value={style.color} onChange={e => updateStyle(field, 'color', e.target.value)}
              className="flex-1 px-1 py-1 border border-neutral-300 dark:border-white/15 rounded text-[10px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        {(['left', 'center', 'right'] as const).map(a => (
          <button key={a} onClick={() => updateStyle(field, 'align', a)}
            className={`flex-1 px-1 py-0.5 border rounded text-[10px] font-medium transition ${style.align === a ? 'bg-accent text-white border-accent' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-white/60 border-neutral-300 dark:border-white/15'}`}>
            {a === 'left' ? 'Izq' : a === 'center' ? 'Cen' : 'Der'}
          </button>
        ))}
        <button onClick={() => updateStyle(field, 'bold', !style.bold)}
          className={`flex-1 px-1 py-0.5 border rounded text-[10px] font-bold transition ${style.bold ? 'bg-accent text-white border-accent' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-white/60 border-neutral-300 dark:border-white/15'}`}>B</button>
        <button onClick={() => updateStyle(field, 'italic', !style.italic)}
          className={`flex-1 px-1 py-0.5 border rounded text-[10px] italic transition ${style.italic ? 'bg-accent text-white border-accent' : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-white/60 border-neutral-300 dark:border-white/15'}`}>I</button>
      </div>
    </div>
  );

  if (!isOpen || !plantilla) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen p-3 sm:p-6 flex items-start justify-center">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-6xl my-4">

          {/* Header */}
          <div className="sticky top-0 z-20 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-white/10 px-5 py-3.5 rounded-t-2xl flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">Personalizar Diseño</h2>
              <p className="text-xs text-neutral-500 dark:text-white/40">{plantilla.titulo || plantilla.tipo} · Vista previa en tiempo real</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg transition">
              <X className="w-5 h-5 text-neutral-500 dark:text-white/40" />
            </button>
          </div>

          {error && (
            <div className="mx-5 mt-3 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-4">

            {/* LEFT — Canvas Preview */}
            <div className="lg:col-span-3 lg:sticky lg:top-20 lg:self-start space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700 dark:text-white/70">Vista Previa</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/5 rounded transition" title="Reducir zoom">
                    <ZoomOut className="w-3.5 h-3.5 text-neutral-500 dark:text-white/40" />
                  </button>
                  <span className="text-[10px] text-neutral-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/5 rounded transition" title="Aumentar zoom">
                    <ZoomIn className="w-3.5 h-3.5 text-neutral-500 dark:text-white/40" />
                  </button>
                  <button onClick={() => setZoom(1)} className="p-1 hover:bg-neutral-100 dark:hover:bg-white/5 rounded transition" title="Ajustar a pantalla">
                    <Maximize2 className="w-3.5 h-3.5 text-neutral-500 dark:text-white/40" />
                  </button>
                </div>
              </div>

              <div className="border-2 border-neutral-200 dark:border-white/10 rounded-xl overflow-auto bg-neutral-100 dark:bg-neutral-800 shadow-inner flex items-center justify-center"
                style={{ minHeight: 280, maxHeight: 'calc(100vh - 320px)' }}>
                {imageStatus === 'loading' && (
                  <div className="flex flex-col items-center gap-2 py-16">
                    <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
                    <span className="text-xs text-neutral-500 dark:text-white/40">Cargando imagen...</span>
                  </div>
                )}
                {imageStatus === 'error' && (
                  <div className="flex flex-col items-center gap-2 py-16">
                    <AlertTriangle className="w-8 h-8 text-neutral-400" />
                    <span className="text-xs text-neutral-500 dark:text-white/40">No se pudo cargar la imagen base</span>
                    <button onClick={() => { setImageStatus('loading'); renderCanvas(); }}
                      className="text-xs text-accent hover:underline mt-1">Reintentar</button>
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', display: imageStatus === 'ready' ? 'block' : 'none' }}
                  className="max-w-full h-auto"
                />
              </div>

              {/* Canvas action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadPreview}
                  disabled={imageStatus !== 'ready'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-neutral-200 dark:border-white/10 rounded-lg text-sm font-medium text-neutral-700 dark:text-white/70 hover:bg-neutral-50 dark:hover:bg-white/5 transition disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                  Descargar prueba
                </button>
                <button
                  onClick={handleGuardar}
                  disabled={saving || imageStatus !== 'ready'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition disabled:opacity-50 shadow-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {saving ? 'Guardando...' : 'Guardar en Mis Diseños'}
                </button>
              </div>
            </div>

            {/* RIGHT — Controls */}
            <div className="lg:col-span-2 space-y-4 overflow-y-auto">

              {/* Nombre */}
              <Section title="Texto Principal">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-semibold text-neutral-600 dark:text-white/50">Nombre completo</label>
                  <input type="text" value={nombreCompleto} onChange={e => setNombreCompleto(e.target.value)}
                    placeholder="Juan Pérez García"
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg text-xs bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-accent" />
                  <StyleRow field="nombre" style={styleNombre} label="Estilo nombre" />
                </div>
              </Section>

              {/* Contacto */}
              <Section title="Información de Contacto">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-600 dark:text-white/50 mb-0.5">Mi Página Web</label>
                    <input type="text" value={contactoWeb} onChange={e => setContactoWeb(normalizeUrlForDisplay(e.target.value))}
                      placeholder="agentedeseguros.website/slug"
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg text-xs bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-accent" />
                    <StyleRow field="web" style={styleWeb} label="Estilo web" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-600 dark:text-white/50 mb-0.5">Teléfono Laboral</label>
                    <input type="tel" value={contactoTelefono} onChange={e => setContactoTelefono(e.target.value)}
                      placeholder="55 1234 5678"
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-white/15 rounded-lg text-xs bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-accent" />
                    <StyleRow field="tel" style={styleTel} label="Estilo teléfono" />
                  </div>
                </div>
              </Section>

              {/* Logo */}
              <Section title="Logo">
                <div className="border-2 border-dashed border-neutral-300 dark:border-white/15 rounded-xl p-4 text-center hover:border-accent transition">
                  <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="pp-logo-upload" />
                  <label htmlFor="pp-logo-upload" className="cursor-pointer block">
                    {logoPreview ? (
                      <div className="space-y-2">
                        <img src={logoPreview} alt="Logo" className="max-h-20 mx-auto rounded-lg object-contain" />
                        <span className="text-xs text-accent font-medium">Cambiar logo</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-2">
                        <Upload className="w-8 h-8 text-neutral-400 mx-auto" />
                        <p className="text-xs font-medium text-neutral-700 dark:text-white/60">Subir logo</p>
                        <p className="text-[10px] text-neutral-500">PNG, JPG o WebP</p>
                      </div>
                    )}
                  </label>
                </div>
              </Section>

              {/* Colors */}
              <Section title="Colores por Defecto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-600 dark:text-white/50 mb-1">Primario</label>
                    <div className="flex gap-1.5">
                      <input type="color" value={primaryColor}
                        onChange={e => { setPrimaryColor(e.target.value); setStyleNombre(s => ({ ...s, color: e.target.value })); }}
                        className="h-8 w-8 rounded border border-neutral-300 cursor-pointer" />
                      <input type="text" value={primaryColor}
                        onChange={e => { setPrimaryColor(e.target.value); setStyleNombre(s => ({ ...s, color: e.target.value })); }}
                        className="flex-1 px-2 py-1.5 border border-neutral-300 dark:border-white/15 rounded text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-accent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-600 dark:text-white/50 mb-1">Secundario</label>
                    <div className="flex gap-1.5">
                      <input type="color" value={secondaryColor}
                        onChange={e => { setSecondaryColor(e.target.value); setStyleWeb(s => ({ ...s, color: e.target.value })); setStyleTel(s => ({ ...s, color: e.target.value })); }}
                        className="h-8 w-8 rounded border border-neutral-300 cursor-pointer" />
                      <input type="text" value={secondaryColor}
                        onChange={e => { setSecondaryColor(e.target.value); setStyleWeb(s => ({ ...s, color: e.target.value })); setStyleTel(s => ({ ...s, color: e.target.value })); }}
                        className="flex-1 px-2 py-1.5 border border-neutral-300 dark:border-white/15 rounded text-[11px] bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-accent" />
                    </div>
                  </div>
                </div>
              </Section>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-neutral-50 dark:bg-white/3 border-b border-neutral-200 dark:border-white/10">
        <span className="text-xs font-semibold text-neutral-700 dark:text-white/70">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
