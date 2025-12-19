import { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, Image as ImageIcon, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Plantilla {
  id: string;
  titulo: string;
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

const FUENTES = [
  'Inter',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Impact',
  'Comic Sans MS'
];

const DEFAULT_STYLE: TextStyle = {
  font: 'Inter',
  color: '#0050D1',
  size: 24,
  align: 'center',
  bold: false,
  italic: false
};

const DEFAULT_URLS = {
  jiro: 'www.jiro.mx',
  multicotizador: 'www.multicotizador.digital'
};

function normalizeUrlForDisplay(url: string): string {
  if (!url) return '';

  let normalized = url.trim();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');

  if (normalized && !normalized.startsWith('www.')) {
    normalized = 'www.' + normalized;
  }

  return normalized;
}

export function PersonalizarPlantillaModal({ isOpen, onClose, plantilla, onSuccess }: PersonalizarPlantillaModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  const [nombreCompleto, setNombreCompleto] = useState('');
  const [urlJiro, setUrlJiro] = useState('');
  const [urlMulticotizador, setUrlMulticotizador] = useState('');

  const [styleNombre, setStyleNombre] = useState<TextStyle>(DEFAULT_STYLE);
  const [styleJiro, setStyleJiro] = useState<TextStyle>({ ...DEFAULT_STYLE, size: 20 });
  const [styleMulti, setStyleMulti] = useState<TextStyle>({ ...DEFAULT_STYLE, size: 20 });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    texto: false,
    urls: false,
    logo: false,
    estilo: false
  });

  useEffect(() => {
    if (!isOpen || !plantilla) {
      resetForm();
    } else {
      if (usuario) {
        setNombreCompleto(usuario.nombre_completo || '');
      }

      setUrlJiro(DEFAULT_URLS.jiro);
      setUrlMulticotizador(DEFAULT_URLS.multicotizador);

      if (plantilla.estilos_texto_default_individual) {
        const estilos = plantilla.estilos_texto_default_individual;
        if (estilos.nombreCompleto) setStyleNombre({ ...DEFAULT_STYLE, ...estilos.nombreCompleto });
        if (estilos.urlJiro) setStyleJiro({ ...DEFAULT_STYLE, size: 20, ...estilos.urlJiro });
        if (estilos.urlMulticotizador) setStyleMulti({ ...DEFAULT_STYLE, size: 20, ...estilos.urlMulticotizador });
      } else if (plantilla.estilo_texto_default) {
        const style = plantilla.estilo_texto_default;
        const baseStyle = {
          font: style.font || 'Inter',
          color: style.color || '#0050D1',
          size: style.size || 24,
          align: style.align || 'center',
          bold: false,
          italic: false
        };
        setStyleNombre(baseStyle);
        setStyleJiro({ ...baseStyle, size: 20 });
        setStyleMulti({ ...baseStyle, size: 20 });
      }
    }
  }, [isOpen, plantilla, usuario]);

  useEffect(() => {
    if (isOpen && plantilla && canvasRef.current && imgRef.current) {
      renderPreview();
    }
  }, [isOpen, plantilla, logoPreview, nombreCompleto, urlJiro, urlMulticotizador, styleNombre, styleJiro, styleMulti]);

  const resetForm = () => {
    setLogoFile(null);
    setLogoPreview('');
    setNombreCompleto('');
    setUrlJiro('');
    setUrlMulticotizador('');
    setStyleNombre(DEFAULT_STYLE);
    setStyleJiro({ ...DEFAULT_STYLE, size: 20 });
    setStyleMulti({ ...DEFAULT_STYLE, size: 20 });
    setError('');
    setSaved(false);
  };

  const handleReset = () => {
    if (confirm('¿Deseas restablecer todos los valores a sus defaults?')) {
      if (usuario) {
        setNombreCompleto(usuario.nombre_completo || '');
      }
      setUrlJiro(DEFAULT_URLS.jiro);
      setUrlMulticotizador(DEFAULT_URLS.multicotizador);
      setStyleNombre(DEFAULT_STYLE);
      setStyleJiro({ ...DEFAULT_STYLE, size: 20 });
      setStyleMulti({ ...DEFAULT_STYLE, size: 20 });
      setLogoFile(null);
      setLogoPreview('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  };

  const handleUrlChange = (setter: (val: string) => void, value: string) => {
    const normalized = normalizeUrlForDisplay(value);
    setter(normalized);
  };

  const renderPreview = async () => {
    if (!canvasRef.current || !imgRef.current || !plantilla) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxWidth = 800;
      const scale = Math.min(1, maxWidth / img.width);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (logoPreview && plantilla.zona_logo) {
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.onload = () => {
          const logoX = plantilla.zona_logo.x * canvas.width;
          const logoY = plantilla.zona_logo.y * canvas.height;
          const logoW = plantilla.zona_logo.width * canvas.width;
          const logoH = plantilla.zona_logo.height * canvas.height;

          const logoAspect = logo.width / logo.height;
          const zoneAspect = logoW / logoH;

          let drawW = logoW;
          let drawH = logoH;
          let drawX = logoX;
          let drawY = logoY;

          if (logoAspect > zoneAspect) {
            drawH = logoW / logoAspect;
            drawY = logoY + (logoH - drawH) / 2;
          } else {
            drawW = logoH * logoAspect;
            drawX = logoX + (logoW - drawW) / 2;
          }

          ctx.drawImage(logo, drawX, drawY, drawW, drawH);
          drawText(ctx, canvas);
        };
        logo.src = logoPreview;
      } else {
        drawText(ctx, canvas);
      }
    };
    img.src = plantilla.archivo_url;
  };

  const drawText = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (!plantilla?.zona_texto) return;

    const textoX = plantilla.zona_texto.x * canvas.width;
    const textoY = plantilla.zona_texto.y * canvas.height;
    const textoW = plantilla.zona_texto.width * canvas.width;
    const textoH = plantilla.zona_texto.height * canvas.height;

    const texts: Array<{ text: string; style: TextStyle }> = [];
    if (nombreCompleto) texts.push({ text: nombreCompleto, style: styleNombre });
    if (urlJiro) texts.push({ text: urlJiro, style: styleJiro });
    if (urlMulticotizador) texts.push({ text: urlMulticotizador, style: styleMulti });

    const maxSize = Math.max(styleNombre.size, styleJiro.size, styleMulti.size);
    const lineHeight = maxSize * 1.4;
    const totalHeight = texts.length * lineHeight;
    const startY = textoY + (textoH - totalHeight) / 2 + maxSize;

    texts.forEach((item, index) => {
      const { text, style } = item;

      const fontStyle = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${style.size}px ${style.font}`;
      ctx.font = fontStyle;
      ctx.fillStyle = style.color;
      ctx.textAlign = style.align;

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      let x = textoX;
      if (style.align === 'center') x = textoX + textoW / 2;
      else if (style.align === 'right') x = textoX + textoW;

      const y = startY + index * lineHeight;
      ctx.fillText(text, x, y, textoW);
    });
  };

  const generateFullResolutionCanvas = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!plantilla) {
        reject(new Error('No hay plantilla seleccionada'));
        return;
      }

      const fullCanvas = document.createElement('canvas');
      const fullCtx = fullCanvas.getContext('2d');
      if (!fullCtx) {
        reject(new Error('No se pudo crear el contexto del canvas'));
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        fullCanvas.width = img.width;
        fullCanvas.height = img.height;

        fullCtx.drawImage(img, 0, 0);

        const finishDrawing = () => {
          if (plantilla?.zona_texto) {
            const textoX = plantilla.zona_texto.x * fullCanvas.width;
            const textoY = plantilla.zona_texto.y * fullCanvas.height;
            const textoW = plantilla.zona_texto.width * fullCanvas.width;
            const textoH = plantilla.zona_texto.height * fullCanvas.height;

            const texts: Array<{ text: string; style: TextStyle }> = [];
            if (nombreCompleto) texts.push({ text: nombreCompleto, style: styleNombre });
            if (urlJiro) texts.push({ text: urlJiro, style: styleJiro });
            if (urlMulticotizador) texts.push({ text: urlMulticotizador, style: styleMulti });

            const maxSize = Math.max(styleNombre.size, styleJiro.size, styleMulti.size);
            const lineHeight = maxSize * 1.4;
            const totalHeight = texts.length * lineHeight;
            const startY = textoY + (textoH - totalHeight) / 2 + maxSize;

            texts.forEach((item, index) => {
              const { text, style } = item;
              const fontStyle = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${style.size}px ${style.font}`;
              fullCtx.font = fontStyle;
              fullCtx.fillStyle = style.color;
              fullCtx.textAlign = style.align;

              fullCtx.shadowColor = 'transparent';
              fullCtx.shadowBlur = 0;
              fullCtx.shadowOffsetX = 0;
              fullCtx.shadowOffsetY = 0;

              let x = textoX;
              if (style.align === 'center') x = textoX + textoW / 2;
              else if (style.align === 'right') x = textoX + textoW;

              const y = startY + index * lineHeight;
              fullCtx.fillText(text, x, y, textoW);
            });
          }

          fullCanvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Error al generar imagen'));
          }, 'image/png');
        };

        if (logoPreview && plantilla.zona_logo) {
          const logo = new Image();
          logo.crossOrigin = 'anonymous';
          logo.onload = () => {
            const logoX = plantilla.zona_logo.x * fullCanvas.width;
            const logoY = plantilla.zona_logo.y * fullCanvas.height;
            const logoW = plantilla.zona_logo.width * fullCanvas.width;
            const logoH = plantilla.zona_logo.height * fullCanvas.height;

            const logoAspect = logo.width / logo.height;
            const zoneAspect = logoW / logoH;

            let drawW = logoW;
            let drawH = logoH;
            let drawX = logoX;
            let drawY = logoY;

            if (logoAspect > zoneAspect) {
              drawH = logoW / logoAspect;
              drawY = logoY + (logoH - drawH) / 2;
            } else {
              drawW = logoH * logoAspect;
              drawX = logoX + (logoW - drawW) / 2;
            }

            fullCtx.drawImage(logo, drawX, drawY, drawW, drawH);
            finishDrawing();
          };
          logo.onerror = () => reject(new Error('Error al cargar el logo'));
          logo.src = logoPreview;
        } else {
          finishDrawing();
        }
      };
      img.onerror = () => reject(new Error('Error al cargar la plantilla'));
      img.src = plantilla.archivo_url;
    });
  };

  const handleDescargar = async () => {
    if (!plantilla || !usuario) {
      setError('Error al generar el diseño');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let logoUrl = null;
      if (logoFile) {
        const logoExt = logoFile.name.split('.').pop();
        const logoFileName = `${usuario.id}/${Date.now()}.${logoExt}`;

        const { error: logoUploadError } = await supabase.storage
          .from('publicidad-logos')
          .upload(logoFileName, logoFile);

        if (logoUploadError) throw logoUploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('publicidad-logos')
          .getPublicUrl(logoFileName);

        logoUrl = publicUrl;
      }

      const blob = await generateFullResolutionCanvas();

      const resultFileName = `${usuario.id}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('publicidad-disenos')
        .upload(resultFileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('publicidad-disenos')
        .getPublicUrl(resultFileName);

      const { error: disenoError } = await supabase.from('publicidad_disenos').insert({
        usuario_id: usuario.id,
        plantilla_id: plantilla.id,
        logo_url: logoUrl,
        texto_personalizado: {
          nombreCompleto,
          urlJiro,
          urlMulticotizador
        },
        estilo_texto: {
          nombreCompleto: styleNombre,
          urlJiro: styleJiro,
          urlMulticotizador: styleMulti
        },
        archivo_resultante_url: publicUrl
      });

      if (disenoError) throw disenoError;

      // Crear URL local del blob para descarga directa
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${plantilla.titulo}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Liberar el URL del blob después de un breve delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error al descargar:', err);
      setError(err.message || 'Error al generar el diseño');
    } finally {
      setLoading(false);
    }
  };

  const updateStyle = (
    field: 'nombre' | 'jiro' | 'multi',
    key: keyof TextStyle,
    value: any
  ) => {
    const setters = {
      nombre: setStyleNombre,
      jiro: setStyleJiro,
      multi: setStyleMulti
    };

    const styles = {
      nombre: styleNombre,
      jiro: styleJiro,
      multi: styleMulti
    };

    setters[field]({ ...styles[field], [key]: value });
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const AccordionSection = ({
    id,
    title,
    children
  }: {
    id: string;
    title: string;
    children: React.ReactNode
  }) => (
    <div className="border border-neutral-200 rounded-lg overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full px-2.5 py-1.5 flex items-center justify-between bg-neutral-50 hover:bg-neutral-100 transition-colors"
      >
        <span className="text-xs font-semibold text-neutral-900">{title}</span>
        {openSections[id] ? (
          <ChevronUp className="w-3.5 h-3.5 text-neutral-600" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-neutral-600" />
        )}
      </button>
      {openSections[id] && (
        <div className="p-2 bg-white">
          {children}
        </div>
      )}
    </div>
  );

  const StyleControls = ({
    style,
    field
  }: {
    style: TextStyle;
    field: 'nombre' | 'jiro' | 'multi'
  }) => (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">Fuente</label>
          <select
            value={style.font}
            onChange={(e) => updateStyle(field, 'font', e.target.value)}
            className="w-full px-1.5 py-1 border border-neutral-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {FUENTES.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">Tamaño</label>
          <input
            type="number"
            min="10"
            max="100"
            value={style.size}
            onChange={(e) => updateStyle(field, 'size', parseInt(e.target.value))}
            className="w-full px-1.5 py-1 border border-neutral-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">Color</label>
          <div className="flex gap-0.5">
            <input
              type="color"
              value={style.color}
              onChange={(e) => updateStyle(field, 'color', e.target.value)}
              className="h-7 w-7 rounded border border-neutral-300 cursor-pointer"
            />
            <input
              type="text"
              value={style.color}
              onChange={(e) => updateStyle(field, 'color', e.target.value)}
              className="flex-1 px-1 py-1 border border-neutral-300 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="#fff"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-1">
        {(['left', 'center', 'right'] as const).map(a => (
          <button
            key={a}
            onClick={() => updateStyle(field, 'align', a)}
            className={`flex-1 px-1.5 py-0.5 border rounded text-[10px] font-medium transition ${
              style.align === a
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            {a === 'left' ? 'Izq' : a === 'center' ? 'Cen' : 'Der'}
          </button>
        ))}
        <button
          onClick={() => updateStyle(field, 'bold', !style.bold)}
          className={`flex-1 px-1.5 py-0.5 border rounded text-[10px] font-bold transition ${
            style.bold
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
          }`}
        >
          B
        </button>
        <button
          onClick={() => updateStyle(field, 'italic', !style.italic)}
          className={`flex-1 px-1.5 py-0.5 border rounded text-[10px] italic transition ${
            style.italic
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
          }`}
        >
          I
        </button>
      </div>
    </div>
  );

  if (!isOpen || !plantilla) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="min-h-screen p-2 sm:p-4 flex items-start justify-center">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl my-4">
          <div className="sticky top-0 z-20 bg-white border-b border-neutral-200 px-3 py-2 rounded-t-xl flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Personalizar: {plantilla.titulo}
              </h2>
              <p className="text-[10px] text-neutral-600">
                Vista previa en tiempo real
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 p-1.5 rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mx-3 mt-2 bg-red-50 border border-red-200 text-red-700 px-2.5 py-1.5 rounded-lg text-xs">
              {error}
            </div>
          )}

          {saved && (
            <div className="mx-3 mt-2 bg-green-50 border border-green-200 text-green-700 px-2.5 py-1.5 rounded-lg text-xs">
              Valores restablecidos correctamente
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
            <div className="order-1 lg:order-1 lg:sticky lg:top-20 lg:self-start">
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Vista Previa
              </label>
              <div className="border-2 border-neutral-300 rounded-lg overflow-hidden bg-neutral-100 shadow-lg">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                  style={{ maxHeight: 'calc(100vh - 240px)', objectFit: 'contain' }}
                />
                <img ref={imgRef} className="hidden" alt="" />
              </div>

              <button
                onClick={handleDescargar}
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-2 px-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{loading ? 'Generando...' : 'Descargar Diseño'}</span>
              </button>
            </div>

            <div className="space-y-2 order-2 lg:order-2">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold text-neutral-700">Controles</h3>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restablecer
                </button>
              </div>

              <AccordionSection id="texto" title="Texto Principal">
                <div className="space-y-1.5">
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">Nombre completo</label>
                    <input
                      type="text"
                      value={nombreCompleto}
                      onChange={(e) => setNombreCompleto(e.target.value)}
                      placeholder="Ej: Juan Pérez García"
                      className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <StyleControls style={styleNombre} field="nombre" />
                </div>
              </AccordionSection>

              <AccordionSection id="urls" title="URLs (sin https://)">
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">URL JIRO</label>
                    <input
                      type="text"
                      value={urlJiro}
                      onChange={(e) => handleUrlChange(setUrlJiro, e.target.value)}
                      placeholder="www.jiro.mx"
                      className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <StyleControls style={styleJiro} field="jiro" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">URL Multicotizador</label>
                    <input
                      type="text"
                      value={urlMulticotizador}
                      onChange={(e) => handleUrlChange(setUrlMulticotizador, e.target.value)}
                      placeholder="www.multicotizador.digital"
                      className="w-full px-2 py-1.5 border border-neutral-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <StyleControls style={styleMulti} field="multi" />
                  </div>
                </div>
              </AccordionSection>

              <AccordionSection id="logo" title="Logo">
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-3 text-center hover:border-primary-500 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    {logoPreview ? (
                      <div className="space-y-1.5">
                        <img src={logoPreview} alt="Logo" className="max-h-16 mx-auto rounded" />
                        <button
                          type="button"
                          className="text-primary-600 hover:text-primary-700 text-[10px] font-medium"
                        >
                          Cambiar logo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-8 h-8 text-neutral-400 mx-auto" />
                        <p className="text-neutral-700 font-medium text-xs">Subir logo</p>
                        <p className="text-[10px] text-neutral-500">PNG, JPG o WebP</p>
                      </div>
                    )}
                  </label>
                </div>
              </AccordionSection>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
