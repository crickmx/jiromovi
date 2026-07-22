import { useEffect, useRef, useState } from 'react';
import { X, Check, Upload, RotateCw } from 'lucide-react';
import { getEffectiveUserLogo, validateLogoFile } from '../../lib/logoUtils';
import { supabase } from '../../lib/supabase';
import type { StoreLogoTransform } from '../../lib/storeUtils';

interface Props {
  imagenProducto: string;
  usuarioId: string;
  transformInicial?: StoreLogoTransform | null;
  onGuardar: (transform: StoreLogoTransform) => void;
  onCancelar: () => void;
}

type DragTipo = 'move' | 'resize' | 'rotate';

export function PersonalizarLogoScreen({ imagenProducto, usuarioId, transformInicial, onGuardar, onCancelar }: Props) {
  const [logoUrl, setLogoUrl] = useState(transformInicial?.logo_url || '');
  const [x, setX] = useState(transformInicial?.x ?? 50);
  const [y, setY] = useState(transformInicial?.y ?? 50);
  const [ancho, setAncho] = useState(transformInicial?.ancho ?? 30);
  const [rotacion, setRotacion] = useState(transformInicial?.rotacion ?? 0);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ tipo: DragTipo; startX: number; startY: number; orig: { x: number; y: number; ancho: number } } | null>(null);

  useEffect(() => {
    if (!transformInicial?.logo_url) {
      getEffectiveUserLogo(usuarioId).then(setLogoUrl);
    }
  }, [usuarioId]);

  function handlePointerDown(e: React.PointerEvent, tipo: DragTipo) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { tipo, startX: e.clientX, startY: e.clientY, orig: { x, y, ancho } };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || !container) return;
    const rect = container.getBoundingClientRect();
    const dxPx = e.clientX - drag.startX;
    const dyPx = e.clientY - drag.startY;

    if (drag.tipo === 'move') {
      const dxPct = (dxPx / rect.width) * 100;
      const dyPct = (dyPx / rect.height) * 100;
      setX(Math.min(100, Math.max(0, drag.orig.x + dxPct)));
      setY(Math.min(100, Math.max(0, drag.orig.y + dyPct)));
    } else if (drag.tipo === 'resize') {
      const dxPct = (dxPx / rect.width) * 100;
      setAncho(Math.min(90, Math.max(5, drag.orig.ancho + dxPct)));
    } else if (drag.tipo === 'rotate') {
      const centerX = rect.left + (drag.orig.x / 100) * rect.width;
      const centerY = rect.top + (drag.orig.y / 100) * rect.height;
      const angulo = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      setRotacion(Math.round(angulo + 90));
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  async function handleSubirLogo(file: File) {
    const validacion = validateLogoFile(file);
    if (!validacion.valid) { setError(validacion.error || 'Archivo inválido'); return; }
    setSubiendo(true);
    setError('');
    try {
      const ext = file.name.split('.').pop();
      const path = `${usuarioId}/pedido-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('usuarios-logos').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('usuarios-logos').getPublicUrl(path);
      setLogoUrl(publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir el logo');
    } finally {
      setSubiendo(false);
    }
  }

  function handleGuardar() {
    if (!logoUrl) { setError('Selecciona o sube un logo primero.'); return; }
    onGuardar({ logo_url: logoUrl, x, y, ancho, rotacion });
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <h2 className="text-white font-semibold">Personaliza tu logo</h2>
        <button onClick={onCancelar} className="text-white/70 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center overflow-hidden p-6"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div ref={containerRef} className="relative inline-block" style={{ touchAction: 'none' }}>
          <img
            src={imagenProducto}
            alt="Producto"
            className="block max-h-[65vh] max-w-full object-contain select-none"
            draggable={false}
          />

          {logoUrl && (
            <div
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: `${ancho}%`,
                transform: `translate(-50%, -50%) rotate(${rotacion}deg)`,
                cursor: 'move',
                touchAction: 'none',
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              <img src={logoUrl} alt="Logo" className="w-full h-auto pointer-events-none" draggable={false} />

              <div
                onPointerDown={(e) => handlePointerDown(e, 'resize')}
                className="absolute -bottom-2 -right-2 w-5 h-5 bg-white rounded-full border-2 border-accent shadow"
                style={{ cursor: 'nwse-resize', touchAction: 'none' }}
              />

              <div
                onPointerDown={(e) => handlePointerDown(e, 'rotate')}
                className="absolute left-1/2 -top-9 -translate-x-1/2 w-6 h-6 bg-white rounded-full border-2 border-accent shadow flex items-center justify-center"
                style={{ cursor: 'grab', touchAction: 'none' }}
              >
                <RotateCw className="w-3.5 h-3.5 text-accent" />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm text-center px-4 pb-2 flex-shrink-0">{error}</p>}

      <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3 flex-shrink-0">
        <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer hover:text-white transition-colors">
          <Upload className="w-4 h-4" />
          {subiendo ? 'Subiendo...' : 'Subir otro logo'}
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            disabled={subiendo}
            onChange={(e) => e.target.files?.[0] && handleSubirLogo(e.target.files[0])}
          />
        </label>
        <button
          onClick={handleGuardar}
          className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-accent-hover transition-colors"
        >
          <Check className="w-4 h-4" />
          Guardar
        </button>
      </div>
    </div>
  );
}
