import { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, Image as ImageIcon, Type, Palette, Bold, Italic } from 'lucide-react';
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
  color: '#ffffff',
  size: 24,
  align: 'center',
  bold: false,
  italic: false
};

export function PersonalizarPlantillaModal({ isOpen, onClose, plantilla, onSuccess }: PersonalizarPlantillaModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  useEffect(() => {
    if (!isOpen || !plantilla) {
      resetForm();
    } else {
      if (usuario) {
        setNombreCompleto(usuario.nombre_completo || '');
      }

      if (plantilla.estilos_texto_default_individual) {
        const estilos = plantilla.estilos_texto_default_individual;
        if (estilos.nombreCompleto) setStyleNombre({ ...DEFAULT_STYLE, ...estilos.nombreCompleto });
        if (estilos.urlJiro) setStyleJiro({ ...DEFAULT_STYLE, size: 20, ...estilos.urlJiro });
        if (estilos.urlMulticotizador) setStyleMulti({ ...DEFAULT_STYLE, size: 20, ...estilos.urlMulticotizador });
      } else if (plantilla.estilo_texto_default) {
        const style = plantilla.estilo_texto_default;
        const baseStyle = {
          font: style.font || 'Inter',
          color: style.color || '#ffffff',
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
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
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

      let x = textoX;
      if (style.align === 'center') x = textoX + textoW / 2;
      else if (style.align === 'right') x = textoX + textoW;

      const y = startY + index * lineHeight;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillText(text, x, y, textoW);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
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

              let x = textoX;
              if (style.align === 'center') x = textoX + textoW / 2;
              else if (style.align === 'right') x = textoX + textoW;

              const y = startY + index * lineHeight;

              fullCtx.shadowColor = 'rgba(0, 0, 0, 0.7)';
              fullCtx.shadowBlur = 6;
              fullCtx.shadowOffsetX = 2;
              fullCtx.shadowOffsetY = 2;

              fullCtx.fillText(text, x, y, textoW);

              fullCtx.shadowColor = 'transparent';
              fullCtx.shadowBlur = 0;
              fullCtx.shadowOffsetX = 0;
              fullCtx.shadowOffsetY = 0;
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

      const link = document.createElement('a');
      link.href = publicUrl;
      link.download = `${plantilla.titulo}-${Date.now()}.png`;
      link.click();

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

  const TextStyleControls = ({
    label,
    style,
    field
  }: {
    label: string;
    style: TextStyle;
    field: 'nombre' | 'jiro' | 'multi'
  }) => (
    <div className="border border-neutral-200 rounded-lg p-2.5 bg-neutral-50">
      <h4 className="text-xs font-semibold text-neutral-700 mb-2">{label}</h4>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
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
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">Color</label>
            <div className="flex space-x-1">
              <input
                type="color"
                value={style.color}
                onChange={(e) => updateStyle(field, 'color', e.target.value)}
                className="h-6 w-8 rounded border border-neutral-300 cursor-pointer"
              />
              <input
                type="text"
                value={style.color}
                onChange={(e) => updateStyle(field, 'color', e.target.value)}
                className="flex-1 px-1.5 py-1 border border-neutral-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">Alineación</label>
            <div className="flex space-x-0.5">
              {(['left', 'center', 'right'] as const).map(a => (
                <button
                  key={a}
                  onClick={() => updateStyle(field, 'align', a)}
                  className={`flex-1 px-1.5 py-1 border rounded text-[10px] font-medium transition ${
                    style.align === a
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {a === 'left' ? 'Izq' : a === 'center' ? 'Cen' : 'Der'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex space-x-1">
          <button
            onClick={() => updateStyle(field, 'bold', !style.bold)}
            className={`flex-1 px-2 py-1 border rounded text-[10px] font-bold transition flex items-center justify-center space-x-0.5 ${
              style.bold
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            <Bold className="w-2.5 h-2.5" />
            <span>Negrita</span>
          </button>
          <button
            onClick={() => updateStyle(field, 'italic', !style.italic)}
            className={`flex-1 px-2 py-1 border rounded text-[10px] italic transition flex items-center justify-center space-x-0.5 ${
              style.italic
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            <Italic className="w-2.5 h-2.5" />
            <span>Cursiva</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (!isOpen || !plantilla) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in p-2 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full my-4 flex flex-col max-h-[92vh]">
        <div className="flex-shrink-0 flex items-center justify-between sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 rounded-t-xl z-10">
          <div>
            <h2 className="text-lg font-display font-bold text-neutral-900">
              Personalizar: {plantilla.titulo}
            </h2>
            <p className="text-xs text-neutral-600">
              Agrega tu logo y personaliza cada texto con su propio estilo
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 p-1.5 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error && (
            <div className="bg-accent-50 border border-accent-200 text-accent-700 px-3 py-2 rounded-lg mb-3 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            <div className="space-y-3 lg:max-h-full lg:overflow-y-auto lg:pr-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  <ImageIcon className="w-3.5 h-3.5 inline mr-1.5" />
                  Tu Logo
                </label>
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
                      <div className="space-y-2">
                        <img src={logoPreview} alt="Logo" className="max-h-16 mx-auto rounded" />
                        <button
                          type="button"
                          className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                        >
                          Cambiar logo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Upload className="w-8 h-8 text-neutral-400 mx-auto" />
                        <p className="text-neutral-700 font-medium text-xs">Subir logo</p>
                        <p className="text-[10px] text-neutral-500">PNG, JPG o WebP</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  <Type className="w-3.5 h-3.5 inline mr-1.5" />
                  Textos Personalizados
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                  <input
                    type="text"
                    value={urlJiro}
                    onChange={(e) => setUrlJiro(e.target.value)}
                    placeholder="URL de tu página JIRO"
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                  <input
                    type="text"
                    value={urlMulticotizador}
                    onChange={(e) => setUrlMulticotizador(e.target.value)}
                    placeholder="URL del Multicotizador"
                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  <Palette className="w-3.5 h-3.5 inline mr-1.5" />
                  Estilos de Texto Individuales
                </label>
                <div className="space-y-2">
                  <TextStyleControls label="Estilo: Nombre Completo" style={styleNombre} field="nombre" />
                  <TextStyleControls label="Estilo: URL JIRO" style={styleJiro} field="jiro" />
                  <TextStyleControls label="Estilo: URL Multicotizador" style={styleMulti} field="multi" />
                </div>
              </div>
            </div>

            <div className="lg:sticky lg:top-3 lg:self-start">
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Vista Previa
              </label>
              <div className="border-2 border-neutral-300 rounded-lg overflow-hidden bg-neutral-100 shadow-inner">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                  style={{ maxHeight: 'calc(100vh - 200px)', objectFit: 'contain' }}
                />
                <img ref={imgRef} className="hidden" alt="" />
              </div>

              <button
                onClick={handleDescargar}
                disabled={loading}
                className="w-full mt-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center space-x-2 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>{loading ? 'Generando...' : 'Descargar Diseño'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
