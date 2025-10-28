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
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

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

  const handleDescargar = async () => {
    if (!canvasRef.current || !plantilla || !usuario) {
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

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current?.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Error al generar imagen'));
        }, 'image/png');
      });

      const resultFileName = `${usuario.id}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('publicidad-resultados')
        .upload(resultFileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('publicidad-resultados')
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
        estilos_texto_individual: {
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
    <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50">
      <h4 className="text-sm font-semibold text-neutral-700 mb-3">{label}</h4>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Fuente</label>
            <select
              value={style.font}
              onChange={(e) => updateStyle(field, 'font', e.target.value)}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {FUENTES.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Tamaño</label>
            <input
              type="number"
              min="10"
              max="100"
              value={style.size}
              onChange={(e) => updateStyle(field, 'size', parseInt(e.target.value))}
              className="w-full px-2 py-1.5 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Color</label>
            <div className="flex space-x-2">
              <input
                type="color"
                value={style.color}
                onChange={(e) => updateStyle(field, 'color', e.target.value)}
                className="h-8 w-12 rounded border border-neutral-300 cursor-pointer"
              />
              <input
                type="text"
                value={style.color}
                onChange={(e) => updateStyle(field, 'color', e.target.value)}
                className="flex-1 px-2 py-1.5 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Alineación</label>
            <div className="flex space-x-1">
              {(['left', 'center', 'right'] as const).map(a => (
                <button
                  key={a}
                  onClick={() => updateStyle(field, 'align', a)}
                  className={`flex-1 px-2 py-1.5 border rounded text-xs font-medium transition ${
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

        <div className="flex space-x-2">
          <button
            onClick={() => updateStyle(field, 'bold', !style.bold)}
            className={`flex-1 px-3 py-2 border rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 ${
              style.bold
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            <Bold className="w-3 h-3" />
            <span>Negrita</span>
          </button>
          <button
            onClick={() => updateStyle(field, 'italic', !style.italic)}
            className={`flex-1 px-3 py-2 border rounded-lg text-xs italic transition flex items-center justify-center space-x-1 ${
              style.italic
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            <Italic className="w-3 h-3" />
            <span>Cursiva</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (!isOpen || !plantilla) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto p-4">
      <div className="bg-white rounded-3xl shadow-strong max-w-7xl w-full my-8">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-2xl font-display font-bold text-neutral-900">
              Personalizar: {plantilla.titulo}
            </h2>
            <p className="text-sm text-neutral-600">
              Agrega tu logo y personaliza cada texto con su propio estilo
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 p-2 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  <ImageIcon className="w-4 h-4 inline mr-2" />
                  Tu Logo
                </label>
                <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-primary-500 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    {logoPreview ? (
                      <div className="space-y-3">
                        <img src={logoPreview} alt="Logo" className="max-h-24 mx-auto rounded-lg" />
                        <button
                          type="button"
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Cambiar logo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-10 h-10 text-neutral-400 mx-auto" />
                        <p className="text-neutral-700 font-medium text-sm">Subir logo</p>
                        <p className="text-xs text-neutral-500">PNG, JPG o WebP</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  <Type className="w-4 h-4 inline mr-2" />
                  Textos Personalizados
                </label>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                  <input
                    type="text"
                    value={urlJiro}
                    onChange={(e) => setUrlJiro(e.target.value)}
                    placeholder="URL de tu página JIRO"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                  <input
                    type="text"
                    value={urlMulticotizador}
                    onChange={(e) => setUrlMulticotizador(e.target.value)}
                    placeholder="URL del Multicotizador"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-3">
                  <Palette className="w-4 h-4 inline mr-2" />
                  Estilos de Texto Individuales
                </label>
                <div className="space-y-3">
                  <TextStyleControls label="Estilo: Nombre Completo" style={styleNombre} field="nombre" />
                  <TextStyleControls label="Estilo: URL JIRO" style={styleJiro} field="jiro" />
                  <TextStyleControls label="Estilo: URL Multicotizador" style={styleMulti} field="multi" />
                </div>
              </div>
            </div>

            <div className="sticky top-24">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Vista Previa
              </label>
              <div className="border-2 border-neutral-300 rounded-2xl overflow-hidden bg-neutral-100 shadow-inner">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                  style={{ maxHeight: 'calc(100vh - 300px)' }}
                />
                <img ref={imgRef} className="hidden" alt="" />
              </div>

              <button
                onClick={handleDescargar}
                disabled={loading}
                className="w-full mt-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-medium hover:shadow-strong flex items-center justify-center space-x-2"
              >
                <Download className="w-5 h-5" />
                <span>{loading ? 'Generando...' : 'Descargar Diseño'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
