import { useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import {
  NOMBRE_TIPO,
  crearEtiqueta,
  slugify,
  type Etiqueta,
  type TipoEtiqueta,
} from '../../lib/etiquetas';

interface Props {
  /** Catálogo completo de etiquetas. */
  etiquetas: Etiqueta[];
  /** Ids seleccionados. */
  valor: string[];
  onChange: (ids: string[]) => void;
  /** Avisa cuando se creó una etiqueta nueva para refrescar el catálogo. */
  onNuevaEtiqueta?: (etiqueta: Etiqueta) => void;
  tipos?: TipoEtiqueta[];
  compacto?: boolean;
}

/**
 * Selector de etiquetas agrupado por nivel: aseguradora, ramo, subramo y
 * libres. Permite elegir de la lista o escribir una nueva sin salir del
 * formulario. El subramo se agrupa bajo su ramo cuando existe.
 */
export function SelectorEtiquetas({
  etiquetas,
  valor,
  onChange,
  onNuevaEtiqueta,
  tipos = ['aseguradora', 'ramo', 'subramo', 'libre'],
  compacto = false,
}: Props) {
  const [creando, setCreando] = useState<TipoEtiqueta | null>(null);
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const seleccionadas = useMemo(() => new Set(valor), [valor]);

  const alternar = (id: string) => {
    onChange(seleccionadas.has(id) ? valor.filter((v) => v !== id) : [...valor, id]);
  };

  const crear = async (tipo: TipoEtiqueta) => {
    const nombre = texto.trim();
    if (!nombre || guardando) return;
    setGuardando(true);
    try {
      const nueva = await crearEtiqueta(tipo, nombre, null);
      if (!etiquetas.some((e) => e.id === nueva.id)) onNuevaEtiqueta?.(nueva);
      if (!valor.includes(nueva.id)) onChange([...valor, nueva.id]);
      setTexto('');
      setCreando(null);
    } catch {
      /* sin permiso o nombre repetido: se ignora en silencio */
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={compacto ? 'space-y-2.5' : 'space-y-4'}>
      {tipos.map((tipo) => {
        const lista = etiquetas.filter((e) => e.tipo === tipo);
        const elegidas = lista.filter((e) => seleccionadas.has(e.id));

        return (
          <div key={tipo}>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/40">
                {NOMBRE_TIPO[tipo]}
              </p>
              {creando === tipo ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void crear(tipo);
                      }
                      if (e.key === 'Escape') setCreando(null);
                    }}
                    placeholder="Nombre de la etiqueta"
                    className="w-40 rounded-lg border border-accent/40 bg-surface-50 px-2 py-1 text-[11px] text-neutral-700 focus:outline-none dark:bg-white/5 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void crear(tipo)}
                    disabled={guardando}
                    className="rounded-lg bg-accent px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    Añadir
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreando(null)}
                    className="rounded-lg p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCreando(tipo);
                    setTexto('');
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-accent-ink hover:underline"
                >
                  <Plus className="h-3 w-3" /> Nueva
                </button>
              )}
            </div>

            {lista.length === 0 && elegidas.length === 0 ? (
              <p className="text-[11px] text-neutral-400">
                Sin {NOMBRE_TIPO[tipo].toLowerCase()}s todavía. Escribe una nueva.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {lista.map((etiqueta) => {
                  const activa = seleccionadas.has(etiqueta.id);
                  return (
                    <button
                      key={etiqueta.id}
                      type="button"
                      onClick={() => alternar(etiqueta.id)}
                      title={`${NOMBRE_TIPO[tipo]} · ${slugify(etiqueta.nombre)}`}
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                        activa
                          ? 'border-accent bg-accent-soft text-accent-ink'
                          : 'border-neutral-200 text-neutral-500 hover:border-accent/50 hover:text-accent-ink dark:border-white/10 dark:text-white/55'
                      }`}
                    >
                      {activa && <Check className="h-3 w-3" />}
                      {etiqueta.nombre}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Píldoras de solo lectura para tarjetas y fichas. */
export function PildorasEtiquetas({
  etiquetas,
  max = 3,
  oscuro = false,
}: {
  etiquetas: Etiqueta[];
  max?: number;
  oscuro?: boolean;
}) {
  if (etiquetas.length === 0) return null;
  const visibles = etiquetas.slice(0, max);
  const resto = etiquetas.length - visibles.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibles.map((etiqueta) => {
        const destacada = etiqueta.tipo === 'aseguradora';
        return (
          <span
            key={etiqueta.id}
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              oscuro
                ? destacada
                  ? 'bg-white/25 text-white'
                  : 'bg-white/12 text-white/85'
                : destacada
                  ? 'bg-accent-soft text-accent-ink'
                  : 'bg-surface-100 text-neutral-600 dark:bg-white/10 dark:text-white/65'
            }`}
          >
            {etiqueta.nombre}
          </span>
        );
      })}
      {resto > 0 && (
        <span className={`text-[10px] font-semibold ${oscuro ? 'text-white/60' : 'text-neutral-400'}`}>
          +{resto}
        </span>
      )}
    </div>
  );
}