import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { X, Check, Upload, Image as ImageIcon, Type, Trash2 } from 'lucide-react';
import { getEffectiveUserLogo, obtenerLogosGuardados, guardarLogoPersonalizado, type LogoGuardado } from '../../lib/logoUtils';
import { supabase } from '../../lib/supabase';
import { calcularMatrizPerspectiva, type StorePersonalizacionCapa, type StorePersonalizacionEsquina } from '../../lib/storeUtils';

export const BASE_TEXTO_ANCHO = 400;
export const BASE_TEXTO_ALTO = 120;
export const BASE_LOGO_TAMANO = 300;

interface Props {
  imagenProducto: string;
  usuarioId: string;
  capasIniciales?: StorePersonalizacionCapa[];
  onGuardar: (capas: StorePersonalizacionCapa[], imagenFinalUrl: string) => void;
  onCancelar: () => void;
}

type DragEstado =
  | { tipo: 'mover'; capaId: string; startX: number; startY: number; esquinasOrig: StorePersonalizacionEsquina[] }
  | { tipo: 'esquina'; capaId: string; indice: number; startX: number; startY: number; esquinaOrig: StorePersonalizacionEsquina };

function nuevoId() {
  return `capa-${Math.random().toString(36).slice(2, 10)}`;
}

function esquinasDefault(anchoPct: number, altoPct: number): StorePersonalizacionCapa['esquinas'] {
  const x0 = 50 - anchoPct / 2, x1 = 50 + anchoPct / 2;
  const y0 = 50 - altoPct / 2, y1 = 50 + altoPct / 2;
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

export function PersonalizarLogoScreen({ imagenProducto, usuarioId, capasIniciales, onGuardar, onCancelar }: Props) {
  const [capas, setCapas] = useState<StorePersonalizacionCapa[]>(capasIniciales ?? []);
  const [capaActivaId, setCapaActivaId] = useState<string | null>(capasIniciales?.[0]?.id ?? null);
  const [subiendo, setSubiendo] = useState(false);
  const [generandoImagen, setGenerandoImagen] = useState(false);
  const [error, setError] = useState('');
  const [contSize, setContSize] = useState({ width: 0, height: 0 });
  const [logosGuardados, setLogosGuardados] = useState<LogoGuardado[]>([]);
  const [logoPerfil, setLogoPerfil] = useState<string | null>(null);
  const [mostrarSelectorLogo, setMostrarSelectorLogo] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragEstado | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setContSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    obtenerLogosGuardados(usuarioId).then(setLogosGuardados);
    getEffectiveUserLogo(usuarioId).then(setLogoPerfil);
  }, [usuarioId]);

  function agregarCapaLogo(logoUrl: string) {
    const id = nuevoId();
    setCapas(prev => [...prev, { id, tipo: 'imagen', contenido: logoUrl, esquinas: esquinasDefault(25, 25) }]);
    setCapaActivaId(id);
    setMostrarSelectorLogo(false);
  }

  async function handleSubirLogoNuevo(file: File) {
    setSubiendo(true);
    setError('');
    try {
      const guardado = await guardarLogoPersonalizado(usuarioId, file);
      setLogosGuardados(prev => [guardado, ...prev]);
      agregarCapaLogo(guardado.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir el logo');
    } finally {
      setSubiendo(false);
    }
  }

  function handleAgregarTexto() {
    const id = nuevoId();
    setCapas(prev => [...prev, { id, tipo: 'texto', contenido: 'Tu texto aquí', fuente: 'Gotham', color: '#000000', esquinas: esquinasDefault(35, 12) }]);
    setCapaActivaId(id);
  }

  function actualizarCapa(id: string, cambios: Partial<StorePersonalizacionCapa>) {
    setCapas(prev => prev.map(c => c.id === id ? { ...c, ...cambios } : c));
  }

  function eliminarCapa(id: string) {
    setCapas(prev => prev.filter(c => c.id !== id));
    setCapaActivaId(prev => prev === id ? null : prev);
  }

  async function handleSubirLogoCapa(capaId: string, file: File) {
    setSubiendo(true);
    setError('');
    try {
      const guardado = await guardarLogoPersonalizado(usuarioId, file);
      setLogosGuardados(prev => [guardado, ...prev]);
      actualizarCapa(capaId, { contenido: guardado.url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir el logo');
    } finally {
      setSubiendo(false);
    }
  }

  function handlePointerDownMover(e: React.PointerEvent, capa: StorePersonalizacionCapa) {
    e.preventDefault();
    e.stopPropagation();
    setCapaActivaId(capa.id);
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { tipo: 'mover', capaId: capa.id, startX: e.clientX, startY: e.clientY, esquinasOrig: capa.esquinas.map(p => ({ ...p })) };
  }

  function handlePointerDownEsquina(e: React.PointerEvent, capaId: string, indice: number, esquinaActual: StorePersonalizacionEsquina) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { tipo: 'esquina', capaId, indice, startX: e.clientX, startY: e.clientY, esquinaOrig: { ...esquinaActual } };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const rect = container.getBoundingClientRect();
    const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;

    if (drag.tipo === 'mover') {
      const nuevasEsquinas = drag.esquinasOrig.map(p => ({ x: p.x + dxPct, y: p.y + dyPct })) as StorePersonalizacionCapa['esquinas'];
      actualizarCapa(drag.capaId, { esquinas: nuevasEsquinas });
    } else {
      setCapas(prev => prev.map(c => {
        if (c.id !== drag.capaId) return c;
        const esquinas = [...c.esquinas] as StorePersonalizacionCapa['esquinas'];
        esquinas[drag.indice] = { x: drag.esquinaOrig.x + dxPct, y: drag.esquinaOrig.y + dyPct };
        return { ...c, esquinas };
      }));
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  async function handleGuardar() {
    if (capas.length === 0) { setError('Agrega al menos un logo o texto.'); return; }
    setError('');
    setGenerandoImagen(true);
    setCapaActivaId(null); // ocultar los handles de esquina antes de capturar
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      const canvas = await html2canvas(containerRef.current!, { useCORS: true, allowTaint: true, logging: false });
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo generar la imagen')), 'image/jpeg', 0.92);
      });
      const path = `${usuarioId}/personalizacion-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('usuarios-logos').upload(path, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('usuarios-logos').getPublicUrl(path);
      onGuardar(capas, publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar la imagen final');
    } finally {
      setGenerandoImagen(false);
    }
  }

  const capaActiva = capas.find(c => c.id === capaActivaId) || null;
  const listo = contSize.width > 0 && contSize.height > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <h2 className="text-white font-semibold">Personaliza tu producto</h2>
        <button onClick={onCancelar} className="text-white/70 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center overflow-hidden p-6 relative"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          ref={containerRef}
          className="relative inline-block"
          style={{ touchAction: 'none' }}
          onPointerDown={() => setCapaActivaId(null)}
        >
          <img
            src={imagenProducto}
            alt="Producto"
            className="block max-h-[60vh] max-w-full object-contain select-none"
            draggable={false}
          />

          {listo && capas.map(capa => {
            const activa = capa.id === capaActivaId;
            const anchoLocal = capa.tipo === 'texto' ? BASE_TEXTO_ANCHO : BASE_LOGO_TAMANO;
            const altoLocal = capa.tipo === 'texto' ? BASE_TEXTO_ALTO : BASE_LOGO_TAMANO;
            const esquinasPx = capa.esquinas.map(p => ({ x: (p.x / 100) * contSize.width, y: (p.y / 100) * contSize.height })) as StorePersonalizacionCapa['esquinas'];
            const matriz = calcularMatrizPerspectiva(esquinasPx, anchoLocal, altoLocal);

            return (
              <div
                key={capa.id}
                onPointerDown={(e) => handlePointerDownMover(e, capa)}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: anchoLocal,
                  height: altoLocal,
                  transformOrigin: '0 0',
                  transform: matriz,
                  cursor: 'move',
                  outline: activa ? '2px dashed #3b82f6' : 'none',
                }}
              >
                {capa.tipo === 'imagen' ? (
                  <img src={capa.contenido} alt="" className="w-full h-full pointer-events-none" draggable={false} style={{ objectFit: 'fill' }} />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center pointer-events-none text-center px-2"
                    style={{ fontFamily: capa.fuente || 'Gotham', color: capa.color || '#000', fontSize: 64, fontWeight: 500, lineHeight: 1.1, whiteSpace: 'nowrap' }}
                  >
                    {capa.contenido}
                  </div>
                )}
              </div>
            );
          })}

          {listo && capaActiva && capaActiva.esquinas.map((esquina, i) => (
            <div
              key={i}
              onPointerDown={(e) => handlePointerDownEsquina(e, capaActiva.id, i, esquina)}
              className="absolute w-4 h-4 bg-white rounded-full border-2 border-accent shadow z-10"
              style={{ left: `${esquina.x}%`, top: `${esquina.y}%`, transform: 'translate(-50%, -50%)', cursor: 'grab', touchAction: 'none' }}
            />
          ))}
        </div>
      </div>

      {capaActiva?.tipo === 'texto' && (
        <div className="px-4 pb-2 flex flex-wrap items-center gap-2 flex-shrink-0">
          <input
            type="text"
            value={capaActiva.contenido}
            onChange={(e) => actualizarCapa(capaActiva.id, { contenido: e.target.value })}
            className="flex-1 min-w-[150px] px-3 py-2 rounded-lg text-sm bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Escribe tu texto..."
          />
          <input
            type="color"
            value={capaActiva.color || '#000000'}
            onChange={(e) => actualizarCapa(capaActiva.id, { color: e.target.value })}
            className="w-9 h-9 rounded-lg border border-white/20 bg-transparent cursor-pointer"
          />
        </div>
      )}

      {mostrarSelectorLogo && (
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {logoPerfil && (
              <button onClick={() => agregarCapaLogo(logoPerfil)} className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-white/20 hover:border-accent overflow-hidden bg-white/5" title="Mi logo de perfil">
                <img src={logoPerfil} alt="Mi logo" className="w-full h-full object-contain" />
              </button>
            )}
            {logosGuardados.map(logo => (
              <button key={logo.id} onClick={() => agregarCapaLogo(logo.url)} className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-white/20 hover:border-accent overflow-hidden bg-white/5" title={logo.nombre}>
                <img src={logo.url} alt={logo.nombre} className="w-full h-full object-contain" />
              </button>
            ))}
            <label className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-white/30 hover:border-accent flex flex-col items-center justify-center gap-0.5 text-white/60 hover:text-white cursor-pointer text-[10px] text-center px-1">
              <Upload className="w-4 h-4" />
              {subiendo ? '...' : 'Nuevo'}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                disabled={subiendo}
                onChange={(e) => e.target.files?.[0] && handleSubirLogoNuevo(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm text-center px-4 pb-2 flex-shrink-0">{error}</p>}

      <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => setMostrarSelectorLogo(prev => !prev)} className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
            <ImageIcon className="w-4 h-4" /> + Logo
          </button>
          <button onClick={handleAgregarTexto} className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors">
            <Type className="w-4 h-4" /> + Texto
          </button>
          {capaActiva?.tipo === 'imagen' && (
            <label className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              {subiendo ? 'Subiendo...' : 'Subir otro'}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                disabled={subiendo}
                onChange={(e) => e.target.files?.[0] && handleSubirLogoCapa(capaActiva.id, e.target.files[0])}
              />
            </label>
          )}
          {capaActiva && (
            <button onClick={() => eliminarCapa(capaActiva.id)} className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors">
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          )}
        </div>
        <button
          onClick={handleGuardar}
          disabled={generandoImagen}
          className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60"
        >
          <Check className="w-4 h-4" />
          {generandoImagen ? 'Generando imagen...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

interface PersonalizacionPreviewProps {
  imagenProducto: string;
  capas: StorePersonalizacionCapa[];
  maxHeight?: number;
  maxWidth?: number;
}

export function PersonalizacionPreview({ imagenProducto, capas, maxHeight = 160, maxWidth = 200 }: PersonalizacionPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contSize, setContSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setContSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden">
      <img src={imagenProducto} alt="Producto" className="block object-contain" style={{ maxHeight, maxWidth }} />
      {contSize.width > 0 && capas.map(capa => {
        const anchoLocal = capa.tipo === 'texto' ? BASE_TEXTO_ANCHO : BASE_LOGO_TAMANO;
        const altoLocal = capa.tipo === 'texto' ? BASE_TEXTO_ALTO : BASE_LOGO_TAMANO;
        const esquinasPx = capa.esquinas.map(p => ({ x: (p.x / 100) * contSize.width, y: (p.y / 100) * contSize.height })) as StorePersonalizacionCapa['esquinas'];
        const matriz = calcularMatrizPerspectiva(esquinasPx, anchoLocal, altoLocal);

        return (
          <div
            key={capa.id}
            style={{ position: 'absolute', left: 0, top: 0, width: anchoLocal, height: altoLocal, transformOrigin: '0 0', transform: matriz }}
          >
            {capa.tipo === 'imagen' ? (
              <img src={capa.contenido} alt="" className="w-full h-full" style={{ objectFit: 'fill' }} />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-center px-2"
                style={{ fontFamily: capa.fuente || 'Gotham', color: capa.color || '#000', fontSize: 64, fontWeight: 500, lineHeight: 1.1, whiteSpace: 'nowrap' }}
              >
                {capa.contenido}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
