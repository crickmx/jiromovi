import { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Video as VideoIcon, Move, Type } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Categoria {
  id: string;
  nombre: string;
}

interface ZonaConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NuevaPlantillaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categorias: Categoria[];
}

export function NuevaPlantillaModal({ isOpen, onClose, onSuccess, categorias }: NuevaPlantillaModalProps) {
  const { usuario } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Datos del formulario
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [tipoArchivo, setTipoArchivo] = useState<'imagen' | 'video' | null>(null);

  // Dimensiones y metadata
  const [ancho, setAncho] = useState(0);
  const [alto, setAlto] = useState(0);
  const [duracion, setDuracion] = useState(0);

  // Zonas editables
  const [zonaLogo, setZonaLogo] = useState<ZonaConfig>({ x: 0.05, y: 0.05, width: 0.2, height: 0.2 });
  const [zonaTexto, setZonaTexto] = useState<ZonaConfig>({ x: 0.05, y: 0.75, width: 0.9, height: 0.2 });
  const [editingZone, setEditingZone] = useState<'logo' | 'texto' | null>(null);

  // Canvas ref
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setStep(1);
    setTitulo('');
    setDescripcion('');
    setCategoriaId('');
    setArchivo(null);
    setPreviewUrl('');
    setTipoArchivo(null);
    setAncho(0);
    setAlto(0);
    setDuracion(0);
    setZonaLogo({ x: 0.05, y: 0.05, width: 0.2, height: 0.2 });
    setZonaTexto({ x: 0.05, y: 0.75, width: 0.9, height: 0.2 });
    setEditingZone(null);
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivo(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Detectar tipo
    if (file.type.startsWith('image/')) {
      setTipoArchivo('imagen');
      // Obtener dimensiones de imagen
      const img = new Image();
      img.onload = () => {
        setAncho(img.width);
        setAlto(img.height);
      };
      img.src = url;
    } else if (file.type.startsWith('video/')) {
      setTipoArchivo('video');
      // Obtener dimensiones y duración de video
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        setAncho(video.videoWidth);
        setAlto(video.videoHeight);
        setDuracion(Math.round(video.duration));
      };
      video.src = url;
    }
  };

  const handleSubmit = async () => {
    if (!archivo || !titulo || !categoriaId || !usuario) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Subir archivo principal
      const fileExt = archivo.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `plantillas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('publicidad-plantillas')
        .upload(filePath, archivo);

      if (uploadError) throw uploadError;

      // 2. Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('publicidad-plantillas')
        .getPublicUrl(filePath);

      // 3. Crear miniatura (usar la misma por ahora)
      const miniaturaUrl = publicUrl;

      // 4. Guardar en base de datos
      const { error: insertError } = await supabase
        .from('publicidad_plantillas')
        .insert({
          titulo,
          descripcion: descripcion || null,
          tipo: tipoArchivo,
          categoria_id: categoriaId,
          archivo_url: publicUrl,
          miniatura_url: miniaturaUrl,
          ancho,
          alto,
          duracion: tipoArchivo === 'video' ? duracion : null,
          zona_logo: zonaLogo,
          zona_texto: zonaTexto,
          estilo_texto_default: {
            font: 'Inter',
            color: '#ffffff',
            size: 24,
            align: 'center'
          },
          activa: true,
          created_by: usuario.id
        });

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creando plantilla:', err);
      setError(err.message || 'Error al crear la plantilla');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-strong max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <div>
            <h2 className="text-2xl font-display font-bold text-neutral-900">
              Nueva Plantilla
            </h2>
            <p className="text-sm text-neutral-600">
              Paso {step} de 2
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

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Ej: Publicación Instagram 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Descripción opcional de la plantilla"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Categoría *
                </label>
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                >
                  <option value="">Selecciona una categoría</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Archivo (Imagen o Video) *
                </label>
                <div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center hover:border-primary-500 transition-all">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {previewUrl ? (
                      <div className="space-y-4">
                        {tipoArchivo === 'imagen' ? (
                          <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                        ) : (
                          <video src={previewUrl} className="max-h-48 mx-auto rounded-lg" controls />
                        )}
                        <p className="text-sm text-neutral-600">
                          {archivo?.name} ({ancho}x{alto}px)
                          {tipoArchivo === 'video' && ` - ${duracion}s`}
                        </p>
                        <button
                          type="button"
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Cambiar archivo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="w-12 h-12 text-neutral-400 mx-auto" />
                        <div>
                          <p className="text-neutral-700 font-medium">Haz clic para subir</p>
                          <p className="text-sm text-neutral-500">JPG, PNG, WebP, MP4, MOV (máx. 50MB)</p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && previewUrl && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                  Configurar Zonas de Logo y Texto
                </h3>
                <p className="text-sm text-neutral-600 mb-6">
                  Ajusta las áreas donde los usuarios podrán colocar su logo y texto personalizado
                </p>
              </div>

              <div className="relative bg-neutral-900 rounded-xl overflow-hidden" ref={canvasRef}>
                {tipoArchivo === 'imagen' ? (
                  <img src={previewUrl} alt="Template" className="w-full" />
                ) : (
                  <video src={previewUrl} className="w-full" />
                )}

                {/* Zona Logo */}
                <div
                  className={`absolute border-2 ${editingZone === 'logo' ? 'border-blue-500' : 'border-blue-400'} bg-blue-500/20 cursor-move transition-all`}
                  style={{
                    left: `${zonaLogo.x * 100}%`,
                    top: `${zonaLogo.y * 100}%`,
                    width: `${zonaLogo.width * 100}%`,
                    height: `${zonaLogo.height * 100}%`,
                  }}
                  onClick={() => setEditingZone('logo')}
                >
                  <div className="absolute -top-8 left-0 bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1">
                    <ImageIcon className="w-3 h-3" />
                    <span>Zona Logo</span>
                  </div>
                </div>

                {/* Zona Texto */}
                <div
                  className={`absolute border-2 ${editingZone === 'texto' ? 'border-green-500' : 'border-green-400'} bg-green-500/20 cursor-move transition-all`}
                  style={{
                    left: `${zonaTexto.x * 100}%`,
                    top: `${zonaTexto.y * 100}%`,
                    width: `${zonaTexto.width * 100}%`,
                    height: `${zonaTexto.height * 100}%`,
                  }}
                  onClick={() => setEditingZone('texto')}
                >
                  <div className="absolute -top-8 left-0 bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1">
                    <Type className="w-3 h-3" />
                    <span>Zona Texto</span>
                  </div>
                </div>
              </div>

              {editingZone && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
                  <h4 className="font-semibold text-neutral-900 mb-3">
                    Ajustar {editingZone === 'logo' ? 'Zona Logo' : 'Zona Texto'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">X (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round((editingZone === 'logo' ? zonaLogo.x : zonaTexto.x) * 100)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) / 100;
                          if (editingZone === 'logo') {
                            setZonaLogo({ ...zonaLogo, x: val });
                          } else {
                            setZonaTexto({ ...zonaTexto, x: val });
                          }
                        }}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Y (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round((editingZone === 'logo' ? zonaLogo.y : zonaTexto.y) * 100)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) / 100;
                          if (editingZone === 'logo') {
                            setZonaLogo({ ...zonaLogo, y: val });
                          } else {
                            setZonaTexto({ ...zonaTexto, y: val });
                          }
                        }}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Ancho (%)</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        step="1"
                        value={Math.round((editingZone === 'logo' ? zonaLogo.width : zonaTexto.width) * 100)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) / 100;
                          if (editingZone === 'logo') {
                            setZonaLogo({ ...zonaLogo, width: val });
                          } else {
                            setZonaTexto({ ...zonaTexto, width: val });
                          }
                        }}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-600 mb-1">Alto (%)</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        step="1"
                        value={Math.round((editingZone === 'logo' ? zonaLogo.height : zonaTexto.height) * 100)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) / 100;
                          if (editingZone === 'logo') {
                            setZonaLogo({ ...zonaLogo, height: val });
                          } else {
                            setZonaTexto({ ...zonaTexto, height: val });
                          }
                        }}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex justify-between rounded-b-3xl">
          <button
            onClick={() => {
              if (step === 1) {
                onClose();
              } else {
                setStep(1);
              }
            }}
            className="px-6 py-2.5 text-neutral-700 hover:bg-neutral-200 rounded-xl font-semibold transition-all"
          >
            {step === 1 ? 'Cancelar' : 'Atrás'}
          </button>

          <button
            onClick={() => {
              if (step === 1) {
                if (titulo && categoriaId && archivo) {
                  setStep(2);
                } else {
                  setError('Por favor completa todos los campos requeridos');
                }
              } else {
                handleSubmit();
              }
            }}
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : step === 1 ? 'Siguiente' : 'Crear Plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}
