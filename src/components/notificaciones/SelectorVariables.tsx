import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { VariablePlantilla } from '../../lib/variablesPlantilla';
import { normalizarTexto } from '../../lib/utils';

interface Props {
  variables: VariablePlantilla[];
  onInsertar: (nombre: string) => void;
  /** Qué pasa al hacer clic, en una línea. */
  ayuda?: string;
}

/**
 * Las variables que se pueden usar, buscables y agrupadas.
 *
 * Antes era una tira de pastillas con nombres escritos a mano que el motor no
 * entregaba — se insertaban, se guardaba, y el mensaje salía con huecos. Aquí
 * solo aparece lo que de verdad se sustituye, así que elegir de esta lista no
 * puede salir mal.
 *
 * Con los campos del formulario la lista crece a decenas, por eso el buscador
 * y los grupos: una tira de 60 pastillas no se lee, se ignora.
 */
export function SelectorVariables({ variables, onInsertar, ayuda }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [grupo, setGrupo] = useState<string | null>(null);

  const grupos = useMemo(
    () => Array.from(new Set(variables.map(v => v.grupo))),
    [variables],
  );

  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return variables.filter(v => {
      if (grupo && v.grupo !== grupo) return false;
      if (!q) return true;
      return normalizarTexto(`${v.nombre} ${v.descripcion}`).includes(q);
    });
  }, [variables, busqueda, grupo]);

  if (variables.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-neutral-700">Variables disponibles</p>
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="w-full pl-8 pr-2 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      </div>

      {grupos.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <button
            onClick={() => setGrupo(null)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
              grupo === null
                ? 'bg-neutral-800 text-white border-neutral-800'
                : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400'
            }`}
          >
            Todas ({variables.length})
          </button>
          {grupos.map(g => (
            <button
              key={g}
              onClick={() => setGrupo(g === grupo ? null : g)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                grupo === g
                  ? 'bg-neutral-800 text-white border-neutral-800'
                  : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
        {visibles.length === 0 ? (
          <p className="text-xs text-neutral-500 italic py-2">Ninguna variable coincide.</p>
        ) : (
          visibles.map(v => (
            <button
              key={v.nombre}
              onClick={() => onInsertar(`{{${v.nombre}}}`)}
              title={`${v.descripcion} — ej. ${v.ejemplo}`}
              className="px-2.5 py-1 text-[11px] font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              {`{{${v.nombre}}}`}
            </button>
          ))
        )}
      </div>

      <p className="text-xs text-neutral-500 mt-2">
        {ayuda ?? 'Clic en una variable para insertarla.'} Pasa el mouse encima para ver qué trae cada una.
      </p>
    </div>
  );
}

export default SelectorVariables;
