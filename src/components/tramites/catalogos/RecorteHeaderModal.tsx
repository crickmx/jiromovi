// Encuadre de la imagen de fondo del encabezado, antes de subirla.
//
// Sin esto la imagen se subía tal cual y el recorte lo decidía el navegador con
// `background-size: cover` — se elegía la foto a ciegas y se descubría el
// resultado al abrir un trámite. Aquí se ve el mismo marco que se va a ver allá.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Move } from 'lucide-react';
import {
  ANCHO_HEADER, ALTO_HEADER, MEDIDA_SUGERIDA,
  escalaCover, limitarOffset, rectFuente, recortarAHeader, cargarImagen,
} from '../../../lib/imagenHeader';

const MARCO = { ancho: 480, alto: 480 / (ANCHO_HEADER / ALTO_HEADER) };
const ZOOM_MAX = 3;

interface Props {
  file: File;
  onCancel: () => void;
  onListo: (blob: Blob) => void;
}

export function RecorteHeaderModal({ file, onCancel, onListo }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [procesando, setProcesando] = useState(false);
  const arrastre = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let vivo = true;
    let urlCreada: string | null = null;
    cargarImagen(file)
      .then(i => {
        // Se anota antes de cualquier salida: si el modal ya se cerró mientras
        // cargaba, el blob igual hay que soltarlo.
        urlCreada = i.src;
        if (!vivo) { URL.revokeObjectURL(i.src); return; }
        // Arranca centrado: es el encuadre que casi siempre se quiere, y es lo
        // mismo que hacía `background-position: center` antes de este paso.
        const nat = { ancho: i.naturalWidth, alto: i.naturalHeight };
        const e0 = escalaCover(nat, MARCO);
        setImg(i);
        setZoom(1);
        setOffset(limitarOffset(
          { x: (MARCO.ancho - nat.ancho * e0) / 2, y: (MARCO.alto - nat.alto * e0) / 2 },
          { ancho: nat.ancho * e0, alto: nat.alto * e0 },
          MARCO,
        ));
      })
      .catch(e => { if (vivo) setError(e.message); });
    // El blob vive mientras el modal esté abierto: es lo que pinta la vista.
    return () => {
      vivo = false;
      if (urlCreada) URL.revokeObjectURL(urlCreada);
    };
  }, [file]);

  if (error) {
    return (
      <Marco onCancel={onCancel}>
        <p className="text-sm text-red-600">{error}</p>
      </Marco>
    );
  }
  if (!img) {
    return <Marco onCancel={onCancel}><p className="text-sm text-neutral-500">Cargando imagen…</p></Marco>;
  }

  const natural = { ancho: img.naturalWidth, alto: img.naturalHeight };
  const escala = escalaCover(natural, MARCO) * zoom;
  const dibujo = { ancho: natural.ancho * escala, alto: natural.alto * escala };
  const pos = limitarOffset(offset, dibujo, MARCO);

  const mover = (e: React.PointerEvent) => {
    if (!arrastre.current) return;
    const dx = e.clientX - arrastre.current.x;
    const dy = e.clientY - arrastre.current.y;
    arrastre.current = { x: e.clientX, y: e.clientY };
    setOffset(limitarOffset({ x: pos.x + dx, y: pos.y + dy }, dibujo, MARCO));
  };

  const cambiarZoom = (z: number) => {
    const nuevaEscala = escalaCover(natural, MARCO) * z;
    const nuevoDibujo = { ancho: natural.ancho * nuevaEscala, alto: natural.alto * nuevaEscala };
    // Se conserva el punto central del encuadre para que el zoom no salte.
    const factor = nuevaEscala / escala;
    setOffset(limitarOffset({
      x: (pos.x - MARCO.ancho / 2) * factor + MARCO.ancho / 2,
      y: (pos.y - MARCO.alto / 2) * factor + MARCO.alto / 2,
    }, nuevoDibujo, MARCO));
    setZoom(z);
  };

  const aplicar = async () => {
    setProcesando(true);
    try {
      onListo(await recortarAHeader(img, rectFuente(pos, escala, MARCO)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo procesar la imagen');
      setProcesando(false);
    }
  };

  return (
    <Marco onCancel={onCancel}>
      <div
        className="relative overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 cursor-grab active:cursor-grabbing touch-none mx-auto"
        style={{ width: MARCO.ancho, height: MARCO.alto, maxWidth: '100%' }}
        onPointerDown={(e) => { arrastre.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={mover}
        onPointerUp={() => { arrastre.current = null; }}
        onPointerCancel={() => { arrastre.current = null; }}
      >
        <img
          src={img.src}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ width: dibujo.ancho, height: dibujo.alto, left: pos.x, top: pos.y }}
        />
        <div className="absolute inset-0 bg-black/45 pointer-events-none" />
        <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
          <span className="text-xs font-bold text-white">Área · Nombre del trámite · Folio</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Move className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span className="text-[11px] text-neutral-500 shrink-0">Zoom</span>
        <input
          type="range" min={1} max={ZOOM_MAX} step={0.05} value={zoom}
          onChange={(e) => cambiarZoom(Number(e.target.value))}
          className="flex-1"
        />
      </div>
      <p className="text-[10px] text-neutral-400 mt-1">
        Arrastra para elegir qué parte se ve. Se guarda a {MEDIDA_SUGERIDA} con el velo oscuro encima.
      </p>

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancelar</button>
        <button
          onClick={aplicar}
          disabled={procesando}
          className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {procesando ? 'Procesando…' : 'Usar esta imagen'}
        </button>
      </div>
    </Marco>
  );
}

function Marco({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  // Va montado en el <body>: el panel derecho del FormBuilder tiene
  // `animate-fade-in`, cuyo keyframe deja un `transform` puesto, y un ancestro
  // con transform vuelve a `position: fixed` relativo a ÉL. Sin esto el modal
  // salía encajonado dentro del panel en vez de cubrir la pantalla.
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-4 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-neutral-800">Encuadrar la imagen del encabezado</p>
          <button onClick={onCancel} className="p-1 hover:bg-neutral-100 rounded" aria-label="Cerrar">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
