import { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Video as VideoIcon, Move, Type, Maximize2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Categoria {
  id: string;
  nombre: string;
  orden?: number;
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

  // Nueva categoría
  const [showNuevaCategoria, setShowNuevaCategoria] = useState(false);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState('');
  const [nuevaCategoriaDescripcion, setNuevaCategoriaDescripcion] = useState('');
  const [loadingCategoria, setLoadingCategoria] = useState(false);

  // Zonas editables
  const [zonaLogo, setZonaLogo] = useState<ZonaConfig>({ x: 0.05, y: 0.05, width: 0.2, height: 0.2 });
  const [zonaTexto, setZonaTexto] = useState<ZonaConfig>({ x: 0.05, y: 0.75, width: 0.9, height: 0.2 });
  const [editingZone, setEditingZone] = useState<'logo' | 'texto' | null>(null);

  // Referencias y estado de drag
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    if (containerRef.current && step === 2) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, [step, previewUrl]);

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
    setShowNuevaCategoria(false);
    setNuevaCategoriaNombre('');
    setNuevaCategoriaDescripcion('');
    setError('');
  };

  const handleCrearCategoria = async () => {
    if (!nuevaCategoriaNombre.trim()) {
      setError('El nombre de la categoría es requerido');
      return;
    }

    setLoadingCategoria(true);
    setError('');

    try {
      const maxOrden = categorias.length > 0 ? Math.max(...categorias.map(c => c.orden || 0)) : 0;

      const { data, error: insertError } = await supabase
        .from('publicidad_categorias')
        .insert({
          nombre: nuevaCategoriaNombre.trim(),
          descripcion: nuevaCategoriaDescripcion.trim() || null,
          orden: maxOrden + 1
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        setCategoriaId(data.id);
        setShowNuevaCategoria(false);
        setNuevaCategoriaNombre('');
        setNuevaCategoriaDescripcion('');
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error creando categoría:', err);
      setError(err.message || 'Error al crear la categoría');
    } finally {
      setLoadingCategoria(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivo(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    if (file.type.startsWith('image/')) {
      setTipoArchivo('imagen');
      const img = new Image();
      img.onload = () => {
        setAncho(img.width);
        setAlto(img.height);
      };
      img.src = url;
    } else if (file.type.startsWith('video/')) {
      setTipoArchivo('video');
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        setAncho(video.videoWidth);
        setAlto(video.videoHeight);
        setDuracion(Math.round(video.duration));
      };
      video.src = url;
    }
  };

  // Handlers para drag
  const handleZoneMouseDown = (zone: 'logo' | 'texto', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;

    setEditingZone(zone);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handlers para resize
  const handleResizeMouseDown = (zone: 'logo' | 'texto', handle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setEditingZone(zone);
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || (!isDragging && !isResizing)) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = (e.clientX - dragStart.x) / rect.width;
      const deltaY = (e.clientY - dragStart.y) / rect.height;

      const currentZone = editingZone === 'logo' ? zonaLogo : zonaTexto;
      const setZone = editingZone === 'logo' ? setZonaLogo : setZonaTexto;

      if (isDragging) {
        // Mover zona
        const newX = Math.max(0, Math.min(1 - currentZone.width, currentZone.x + deltaX));
        const newY = Math.max(0, Math.min(1 - currentZone.height, currentZone.y + deltaY));

        setZone({
          ...currentZone,
          x: newX,
          y: newY
        });
      } else if (isResizing) {
        // Redimensionar zona
        let newZone = { ...currentZone };

        switch (resizeHandle) {
          case 'se': // Esquina inferior derecha
            newZone.width = Math.max(0.05, Math.min(1 - currentZone.x, currentZone.width + deltaX));
            newZone.height = Math.max(0.05, Math.min(1 - currentZone.y, currentZone.height + deltaY));
            break;
          case 'sw': // Esquina inferior izquierda
            const newWidth = Math.max(0.05, currentZone.width - deltaX);
            if (currentZone.x + deltaX >= 0) {
              newZone.x = currentZone.x + deltaX;
              newZone.width = newWidth;
            }
            newZone.height = Math.max(0.05, Math.min(1 - currentZone.y, currentZone.height + deltaY));
            break;
          case 'ne': // Esquina superior derecha
            newZone.width = Math.max(0.05, Math.min(1 - currentZone.x, currentZone.width + deltaX));
            const newHeight = Math.max(0.05, currentZone.height - deltaY);
            if (currentZone.y + deltaY >= 0) {
              newZone.y = currentZone.y + deltaY;
              newZone.height = newHeight;
            }
            break;
          case 'nw': // Esquina superior izquierda
            const newW = Math.max(0.05, currentZone.width - deltaX);
            if (currentZone.x + deltaX >= 0) {
              newZone.x = currentZone.x + deltaX;
              newZone.width = newW;
            }
            const newH = Math.max(0.05, currentZone.height - deltaY);
            if (currentZone.y + deltaY >= 0) {
              newZone.y = currentZone.y + deltaY;
              newZone.height = newH;
            }
            break;
        }

        setZone(newZone);
      }

      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, editingZone, zonaLogo, zonaTexto, resizeHandle]);

  const handleSubmit = async () => {
    if (!archivo || !titulo || !categoriaId || !usuario) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fileExt = archivo.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `plantillas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('publicidad-plantillas')
        .upload(filePath, archivo);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('publicidad-plantillas')
        .getPublicUrl(filePath);

      const miniaturaUrl = publicUrl;

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

  const renderResizeHandles = (zone: 'logo' | 'texto') => {
    const handleClass = zone === 'logo'
      ? 'bg-blue-500 border-2 border-white'
      : 'bg-green-500 border-2 border-white';

    return (
      <>
        {/* Esquina superior izquierda */}
        <div
          className={`absolute -top-1 -left-1 w-3 h-3 rounded-full ${handleClass} cursor-nw-resize z-10`}
          onMouseDown={(e) => handleResizeMouseDown(zone, 'nw', e)}
        />
        {/* Esquina superior derecha */}
        <div
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${handleClass} cursor-ne-resize z-10`}
          onMouseDown={(e) => handleResizeMouseDown(zone, 'ne', e)}
        />
        {/* Esquina inferior izquierda */}
        <div
          className={`absolute -bottom-1 -left-1 w-3 h-3 rounded-full ${handleClass} cursor-sw-resize z-10`}
          onMouseDown={(e) => handleResizeMouseDown(zone, 'sw', e)}
        />
        {/* Esquina inferior derecha */}
        <div
          className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${handleClass} cursor-se-resize z-10`}
          onMouseDown={(e) => handleResizeMouseDown(zone, 'se', e)}
        />
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/60 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full my-8 flex flex-col max-h-[85vh]">
        <div className="flex-shrink-0 sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 rounded-t-2xl z-10">
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
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
                <div className="flex space-x-2">
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  >
                    <option value="">Selecciona una categoría</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNuevaCategoria(!showNuevaCategoria)}
                    className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-all flex items-center space-x-2 font-semibold"
                    title="Nueva categoría"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Nueva</span>
                  </button>
                </div>

                {showNuevaCategoria && (
                  <div className="mt-4 p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
                    <h4 className="text-sm font-semibold text-neutral-900">Crear Nueva Categoría</h4>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={nuevaCategoriaNombre}
                        onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                        placeholder="Ej: Eventos Corporativos"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Descripción (opcional)
                      </label>
                      <textarea
                        value={nuevaCategoriaDescripcion}
                        onChange={(e) => setNuevaCategoriaDescripcion(e.target.value)}
                        placeholder="Descripción de la categoría"
                        rows={2}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={handleCrearCategoria}
                        disabled={loadingCategoria || !nuevaCategoriaNombre.trim()}
                        className="flex-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingCategoria ? 'Creando...' : 'Crear Categoría'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNuevaCategoria(false);
                          setNuevaCategoriaNombre('');
                          setNuevaCategoriaDescripcion('');
                        }}
                        className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg font-semibold text-sm transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
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
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  Configurar Zonas de Logo y Texto
                </h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Arrastra las zonas para posicionarlas. Usa las esquinas para redimensionar.
                </p>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-500/30 border-2 border-blue-500 rounded"></div>
                    <span className="text-sm text-neutral-700">Zona Logo</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500/30 border-2 border-green-500 rounded"></div>
                    <span className="text-sm text-neutral-700">Zona Texto</span>
                  </div>
                </div>
              </div>

              <div
                className="relative bg-neutral-900 rounded-xl overflow-hidden select-none"
                ref={containerRef}
              >
                {tipoArchivo === 'imagen' ? (
                  <img src={previewUrl} alt="Template" className="w-full" draggable={false} />
                ) : (
                  <video src={previewUrl} className="w-full" />
                )}

                {/* Zona Logo */}
                <div
                  className={`absolute border-2 ${editingZone === 'logo' ? 'border-blue-500 shadow-lg' : 'border-blue-400'} bg-blue-500/20 cursor-move transition-all`}
                  style={{
                    left: `${zonaLogo.x * 100}%`,
                    top: `${zonaLogo.y * 100}%`,
                    width: `${zonaLogo.width * 100}%`,
                    height: `${zonaLogo.height * 100}%`,
                  }}
                  onMouseDown={(e) => handleZoneMouseDown('logo', e)}
                >
                  <div className="absolute -top-7 left-0 bg-blue-500 text-white px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 pointer-events-none">
                    <ImageIcon className="w-3 h-3" />
                    <span>Logo</span>
                  </div>
                  {renderResizeHandles('logo')}
                </div>

                {/* Zona Texto */}
                <div
                  className={`absolute border-2 ${editingZone === 'texto' ? 'border-green-500 shadow-lg' : 'border-green-400'} bg-green-500/20 cursor-move transition-all`}
                  style={{
                    left: `${zonaTexto.x * 100}%`,
                    top: `${zonaTexto.y * 100}%`,
                    width: `${zonaTexto.width * 100}%`,
                    height: `${zonaTexto.height * 100}%`,
                  }}
                  onMouseDown={(e) => handleZoneMouseDown('texto', e)}
                >
                  <div className="absolute -top-7 left-0 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 pointer-events-none">
                    <Type className="w-3 h-3" />
                    <span>Texto</span>
                  </div>
                  {renderResizeHandles('texto')}
                </div>
              </div>

              <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <Move className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-primary-900">
                    <p className="font-semibold mb-1">Instrucciones:</p>
                    <ul className="list-disc list-inside space-y-1 text-primary-800">
                      <li>Haz clic y arrastra el centro de una zona para moverla</li>
                      <li>Arrastra las esquinas (círculos) para redimensionar</li>
                      <li>La zona activa se resalta con un borde más grueso</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 sticky bottom-0 bg-neutral-50 border-t border-neutral-200 px-6 py-4 flex justify-between rounded-b-2xl">
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
