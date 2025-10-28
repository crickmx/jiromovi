import { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, Image as ImageIcon, Type, Palette } from 'lucide-react';
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
}

interface PersonalizarPlantillaModalProps {
  isOpen: boolean;
  onClose: () => void;
  plantilla: Plantilla | null;
  onSuccess: () => void;
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

export function PersonalizarPlantillaModal({ isOpen, onClose, plantilla, onSuccess }: PersonalizarPlantillaModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Estado del logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Estado de textos
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [urlJiro, setUrlJiro] = useState('');
  const [urlMulticotizador, setUrlMulticotizador] = useState('');

  // Estilo de texto
  const [font, setFont] = useState('Inter');
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(24);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');

  useEffect(() => {
    if (!isOpen || !plantilla) {
      resetForm();
    } else {
      // Cargar valores por defecto del usuario
      if (usuario) {
        setNombreCompleto(usuario.nombre_completo || '');
      }
      // Cargar estilo por defecto de la plantilla
      if (plantilla.estilo_texto_default) {
        setFont(plantilla.estilo_texto_default.font || 'Inter');
        setColor(plantilla.estilo_texto_default.color || '#ffffff');
        setSize(plantilla.estilo_texto_default.size || 24);
        setAlign(plantilla.estilo_texto_default.align || 'center');
      }
    }
  }, [isOpen, plantilla, usuario]);

  useEffect(() => {
    if (isOpen && plantilla && canvasRef.current && imgRef.current) {
      renderPreview();
    }
  }, [isOpen, plantilla, logoPreview, nombreCompleto, urlJiro, urlMulticotizador, font, color, size, align]);

  const resetForm = () => {
    setLogoFile(null);
    setLogoPreview('');
    setNombreCompleto('');
    setUrlJiro('');
    setUrlMulticotizador('');
    setFont('Inter');
    setColor('#ffffff');
    setSize(24);
    setAlign('center');
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

    // Cargar imagen base
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Configurar tamaño del canvas
      canvas.width = img.width;
      canvas.height = img.height;

      // Dibujar imagen base
      ctx.drawImage(img, 0, 0);

      // Dibujar logo si existe
      if (logoPreview && plantilla.zona_logo) {
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        logo.onload = () => {
          const logoX = plantilla.zona_logo.x * canvas.width;
          const logoY = plantilla.zona_logo.y * canvas.height;
          const logoW = plantilla.zona_logo.width * canvas.width;
          const logoH = plantilla.zona_logo.height * canvas.height;

          // Mantener aspecto del logo
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

          // Dibujar texto después del logo
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

    // Configurar estilo de texto
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;

    // Preparar líneas de texto
    const lines: string[] = [];
    if (nombreCompleto) lines.push(nombreCompleto);
    if (urlJiro) lines.push(urlJiro);
    if (urlMulticotizador) lines.push(urlMulticotizador);

    // Calcular espaciado
    const lineHeight = size * 1.2;
    const totalHeight = lines.length * lineHeight;
    const startY = textoY + (textoH - totalHeight) / 2 + size;

    // Dibujar cada línea
    lines.forEach((line, index) => {
      let x = textoX;
      if (align === 'center') x = textoX + textoW / 2;
      else if (align === 'right') x = textoX + textoW;

      const y = startY + index * lineHeight;

      // Sombra para mejor legibilidad
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.fillText(line, x, y, textoW);

      // Reset shadow
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
      // 1. Subir logo si existe
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

      // 2. Convertir canvas a blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current?.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Error al generar imagen'));
        }, 'image/png');
      });

      // 3. Subir diseño final
      const disenoFileName = `${usuario.id}/${Date.now()}-${plantilla.id}.png`;

      const { error: disenoUploadError } = await supabase.storage
        .from('publicidad-disenos')
        .upload(disenoFileName, blob);

      if (disenoUploadError) throw disenoUploadError;

      const { data: { publicUrl: disenoUrl } } = supabase.storage
        .from('publicidad-disenos')
        .getPublicUrl(disenoFileName);

      // 4. Guardar en base de datos
      const { error: insertError } = await supabase
        .from('publicidad_disenos')
        .insert({
          usuario_id: usuario.id,
          plantilla_id: plantilla.id,
          logo_url: logoUrl,
          texto_personalizado: {
            nombre_completo: nombreCompleto,
            url_jiro: urlJiro,
            url_multicotizador: urlMulticotizador
          },
          estilo_texto: {
            font,
            color,
            size,
            align
          },
          archivo_resultante_url: disenoUrl,
          metadata: {
            ancho: canvasRef.current.width,
            alto: canvasRef.current.height
          }
        });

      if (insertError) throw insertError;

      // 5. Descargar automáticamente
      const link = document.createElement('a');
      link.href = disenoUrl;
      link.download = `${plantilla.titulo}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error al descargar:', err);
      setError(err.message || 'Error al generar el diseño');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !plantilla) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-strong max-w-6xl w-full mx-4 my-8">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="text-2xl font-display font-bold text-neutral-900">
              Personalizar: {plantilla.titulo}
            </h2>
            <p className="text-sm text-neutral-600">
              Agrega tu logo y texto personalizado
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
            {/* Panel de Configuración */}
            <div className="space-y-6">
              {/* Upload Logo */}
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

              {/* Textos Personalizados */}
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

              {/* Estilo de Texto */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  <Palette className="w-4 h-4 inline mr-2" />
                  Estilo de Texto
                </label>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        Fuente
                      </label>
                      <select
                        value={font}
                        onChange={(e) => setFont(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {FUENTES.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        Tamaño
                      </label>
                      <input
                        type="number"
                        min="12"
                        max="72"
                        value={size}
                        onChange={(e) => setSize(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        Color
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="w-12 h-10 rounded-lg border border-neutral-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">
                        Alineación
                      </label>
                      <select
                        value={align}
                        onChange={(e) => setAlign(e.target.value as any)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="left">Izquierda</option>
                        <option value="center">Centro</option>
                        <option value="right">Derecha</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-neutral-700">
                Vista Previa
              </label>
              <div className="bg-neutral-100 rounded-xl p-4 border border-neutral-200">
                <div className="relative bg-neutral-900 rounded-lg overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto"
                  />
                  <img
                    ref={imgRef}
                    src={plantilla.archivo_url}
                    alt="Base"
                    className="hidden"
                    crossOrigin="anonymous"
                    onLoad={renderPreview}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex justify-between rounded-b-3xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-neutral-700 hover:bg-neutral-200 rounded-xl font-semibold transition-all"
          >
            Cancelar
          </button>

          <button
            onClick={handleDescargar}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            <span>{loading ? 'Generando...' : 'Descargar Diseño'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
