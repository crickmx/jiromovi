import { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Video as VideoIcon, Move, Type, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const CATEGORIAS_LIST = [
  'Redes Sociales', 'Campanas', 'Promociones', 'Eventos', 'Presentaciones',
  'Email Marketing', 'Banners', 'Tarjetas de Presentacion', 'Otro'
];

const RAMOS_LIST = [
  'GMM', 'Vida', 'Autos', 'Danos', 'Ahorro e Inversion', 'Empresarial',
  'Responsabilidad Civil', 'Transporte', 'Agropecuario', 'Fianzas', 'Multirramo', 'Otro'
];

interface Oficina {
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
}

export function NuevaPlantillaModal({ isOpen, onClose, onSuccess }: NuevaPlantillaModalProps) {
  const { usuario } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [categoria, setCategoria] = useState('');
  const [ramo, setRamo] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [tipoArchivo, setTipoArchivo] = useState<'imagen' | 'video' | null>(null);

  // Visibility
  const [visibleParaTodas, setVisibleParaTodas] = useState(true);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [selectedOficinas, setSelectedOficinas] = useState<string[]>([]);

  // Dimensions
  const [ancho, setAncho] = useState(0);
  const [alto, setAlto] = useState(0);
  const [duracion, setDuracion] = useState(0);

  // Editable zones
  const [zonaLogo, setZonaLogo] = useState<ZonaConfig>({ x: 0.05, y: 0.05, width: 0.2, height: 0.2 });
  const [zonaTexto, setZonaTexto] = useState<ZonaConfig>({ x: 0.05, y: 0.75, width: 0.9, height: 0.2 });
  const [editingZone, setEditingZone] = useState<'logo' | 'texto' | null>(null);

  // Drag state
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    } else {
      loadOficinas();
    }
  }, [isOpen]);

  const loadOficinas = async () => {
    const { data } = await supabase
      .from('oficinas')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre');
    if (data) setOficinas(data);
  };

  const resetForm = () => {
    setStep(1);
    setCategoria('');
    setRamo('');
    setArchivo(null);
    setPreviewUrl('');
    setTipoArchivo(null);
    setAncho(0);
    setAlto(0);
    setDuracion(0);
    setVisibleParaTodas(true);
    setSelectedOficinas([]);
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

  const handleZoneMouseDown = (zone: 'logo' | 'texto', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    setEditingZone(zone);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

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
        const newX = Math.max(0, Math.min(1 - currentZone.width, currentZone.x + deltaX));
        const newY = Math.max(0, Math.min(1 - currentZone.height, currentZone.y + deltaY));
        setZone({ ...currentZone, x: newX, y: newY });
      } else if (isResizing) {
        let newZone = { ...currentZone };
        switch (resizeHandle) {
          case 'se':
            newZone.width = Math.max(0.05, Math.min(1 - currentZone.x, currentZone.width + deltaX));
            newZone.height = Math.max(0.05, Math.min(1 - currentZone.y, currentZone.height + deltaY));
            break;
          case 'sw': {
            const newWidth = Math.max(0.05, currentZone.width - deltaX);
            if (currentZone.x + deltaX >= 0) {
              newZone.x = currentZone.x + deltaX;
              newZone.width = newWidth;
            }
            newZone.height = Math.max(0.05, Math.min(1 - currentZone.y, currentZone.height + deltaY));
            break;
          }
          case 'ne':
            newZone.width = Math.max(0.05, Math.min(1 - currentZone.x, currentZone.width + deltaX));
            {
              const newH = Math.max(0.05, currentZone.height - deltaY);
              if (currentZone.y + deltaY >= 0) {
                newZone.y = currentZone.y + deltaY;
                newZone.height = newH;
              }
            }
            break;
          case 'nw': {
            const newW = Math.max(0.05, currentZone.width - deltaX);
            if (currentZone.x + deltaX >= 0) {
              newZone.x = currentZone.x + deltaX;
              newZone.width = newW;
            }
            const newH2 = Math.max(0.05, currentZone.height - deltaY);
            if (currentZone.y + deltaY >= 0) {
              newZone.y = currentZone.y + deltaY;
              newZone.height = newH2;
            }
            break;
          }
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
    if (!archivo || !categoria || !ramo || !usuario) {
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

      const { data: plantillaData, error: insertError } = await supabase
        .from('publicidad_plantillas')
        .insert({
          titulo: `${categoria} - ${ramo}`,
          tipo: tipoArchivo,
          categoria,
          ramo,
          archivo_url: publicUrl,
          miniatura_url: publicUrl,
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
          visible_para_todas_las_oficinas: visibleParaTodas,
          activa: true,
          created_by: usuario.id
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // If not visible for all, insert office mappings
      if (!visibleParaTodas && selectedOficinas.length > 0 && plantillaData) {
        const mappings = selectedOficinas.map(oficina_id => ({
          plantilla_id: plantillaData.id,
          oficina_id
        }));

        const { error: mappingError } = await supabase
          .from('publicidad_plantilla_oficinas')
          .insert(mappings);

        if (mappingError) throw mappingError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creando plantilla:', err);
      setError(err.message || 'Error al crear la plantilla');
    } finally {
      setLoading(false);
    }
  };

  const toggleOficina = (id: string) => {
    setSelectedOficinas(prev =>
      prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]
    );
  };

  const renderResizeHandles = (zone: 'logo' | 'texto') => {
    const handleClass = zone === 'logo'
      ? 'bg-accent border-2 border-white'
      : 'bg-green-500 border-2 border-white';

    return (
      <>
        <div
          className={`absolute -top-1 -left-1 w-3 h-3 rounded-full ${handleClass} cursor-nw-resize z-10`}
          onMouseDown={(e) => handleResizeMouseDown(zone, 'nw', e)}
        />
        <div
          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${handleClass} cursor-ne-resize z-10`}
          onMouseDown={(e) => handleResizeMouseDown(zone, 'ne', e)}
        />
        <div
          className={`absolute -bottom-1 -left-1 w-3 h-3 rounded-full ${handleClass} cursor-sw-resize z-10`}
          onMouseDown={(e) => handleResizeMouseDown(zone, 'sw', e)}
        />
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
        <div className="flex-shrink-0 sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 rounded-t-2xl z-10 flex items-center justify-between">
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
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Categoría *
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                  >
                    <option value="">Selecciona una categoría</option>
                    {CATEGORIAS_LIST.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Ramo *
                  </label>
                  <select
                    value={ramo}
                    onChange={(e) => setRamo(e.target.value)}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
                  >
                    <option value="">Selecciona un ramo</option>
                    {RAMOS_LIST.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Archivo (Imagen o Video) *
                </label>
                <div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center hover:border-accent transition-all">
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
                          className="text-accent hover:text-primary-700 text-sm font-medium"
                        >
                          Cambiar archivo
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="w-12 h-12 text-neutral-400 mx-auto" />
                        <div>
                          <p className="text-neutral-700 font-medium">Haz clic para subir</p>
                          <p className="text-sm text-neutral-500">JPG, PNG, WebP, MP4, MOV (max. 50MB)</p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="border border-neutral-200 rounded-xl p-4 space-y-3">
                <label className="block text-sm font-semibold text-neutral-700">
                  Visibilidad por oficinas
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleParaTodas}
                    onChange={(e) => setVisibleParaTodas(e.target.checked)}
                    className="w-5 h-5 text-accent rounded border-neutral-300 focus:ring-accent"
                  />
                  <span className="text-sm text-neutral-700">Visible para todas las oficinas</span>
                </label>

                {!visibleParaTodas && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-neutral-500">
                      Selecciona las oficinas que podrán ver esta plantilla:
                    </p>
                    <div className="max-h-48 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-100">
                      {oficinas.map(oficina => (
                        <label
                          key={oficina.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedOficinas.includes(oficina.id)}
                            onChange={() => toggleOficina(oficina.id)}
                            className="w-4 h-4 text-accent rounded border-neutral-300 focus:ring-accent"
                          />
                          <span className="text-sm text-neutral-700">{oficina.nombre}</span>
                        </label>
                      ))}
                    </div>
                    {selectedOficinas.length > 0 && (
                      <p className="text-xs text-neutral-500">
                        {selectedOficinas.length} oficina{selectedOficinas.length > 1 ? 's' : ''} seleccionada{selectedOficinas.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}
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
                    <div className="w-4 h-4 bg-accent/30 border-2 border-accent rounded"></div>
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

                <div
                  className={`absolute border-2 ${editingZone === 'logo' ? 'border-accent shadow-lg' : 'border-primary-400'} bg-accent/20 cursor-move transition-all`}
                  style={{
                    left: `${zonaLogo.x * 100}%`,
                    top: `${zonaLogo.y * 100}%`,
                    width: `${zonaLogo.width * 100}%`,
                    height: `${zonaLogo.height * 100}%`,
                  }}
                  onMouseDown={(e) => handleZoneMouseDown('logo', e)}
                >
                  <div className="absolute -top-7 left-0 bg-accent text-white px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 pointer-events-none">
                    <ImageIcon className="w-3 h-3" />
                    <span>Logo</span>
                  </div>
                  {renderResizeHandles('logo')}
                </div>

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
                  <Move className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
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
                if (categoria && ramo && archivo) {
                  if (!visibleParaTodas && selectedOficinas.length === 0) {
                    setError('Selecciona al menos una oficina o marca "Visible para todas"');
                    return;
                  }
                  setError('');
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
