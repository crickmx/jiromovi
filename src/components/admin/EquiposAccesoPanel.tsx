// Panel "Equipos con acceso", compartido por MOVI Store y Marketing Admin.
//
// Eran dos componentes idénticos salvo el nombre de la tabla y los textos — con
// una diferencia que nadie decidió: la copia de Marketing había perdido el ícono
// del botón "Dar acceso". Ese es el costo real de copiar en vez de compartir: no
// es que se dupliquen líneas, es que las copias se van separando solas.

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TABLA_ACCESO, type ModuloConAcceso } from '../../lib/equiposAcceso';

interface Grupo {
  id: string;
  nombre: string;
  color: string | null;
}

interface Props {
  modulo: ModuloConAcceso;
  titulo: string;
  /** Qué pueden hacer exactamente los miembros. Vale la pena ser concreto. */
  descripcion: string;
}

export function EquiposAccesoPanel({ modulo, titulo, descripcion }: Props) {
  const tabla = TABLA_ACCESO[modulo];
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [conAcceso, setConAcceso] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      const [gruposRes, accesoRes] = await Promise.all([
        supabase.from('tramites_grupos_visualizacion').select('id, nombre, color').eq('activo', true).order('nombre'),
        supabase.from(tabla).select('grupo_id'),
      ]);
      if (!vivo) return;
      setGrupos((gruposRes.data ?? []) as Grupo[]);
      setConAcceso(new Set((accesoRes.data ?? []).map((r: { grupo_id: string }) => r.grupo_id)));
      setLoading(false);
    })();
    return () => { vivo = false; };
  }, [tabla]);

  const alternar = async (grupoId: string, tiene: boolean) => {
    setGuardando(grupoId);
    setError('');
    // Antes no se revisaba el resultado: si la escritura fallaba —por RLS, por
    // ejemplo— el interruptor se movía igual y parecía guardado.
    const { error: err } = tiene
      ? await supabase.from(tabla).delete().eq('grupo_id', grupoId)
      : await supabase.from(tabla).insert({ grupo_id: grupoId });

    if (err) {
      setError(`No se pudo guardar: ${err.message}`);
    } else {
      setConAcceso(prev => {
        const s = new Set(prev);
        if (tiene) s.delete(grupoId); else s.add(grupoId);
        return s;
      });
    }
    setGuardando(null);
  };

  if (loading) return <div className="text-center py-12 text-neutral-500">Cargando equipos...</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{titulo}</h2>
        <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">{descripcion}</p>
      </div>

      {error && (
        <div className="max-w-xl mb-3 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3 max-w-xl">
        {grupos.length === 0 && (
          <div className="text-sm text-neutral-400">No hay equipos configurados. Crea equipos en Trámites &rarr; Equipos.</div>
        )}
        {grupos.map(grupo => {
          const tiene = conAcceso.has(grupo.id);
          return (
            <div key={grupo.id} className="flex items-center justify-between bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: grupo.color ?? '#6b7280' }} />
                <span className="font-medium text-neutral-900 dark:text-white">{grupo.nombre}</span>
              </div>
              <button
                disabled={guardando === grupo.id}
                onClick={() => alternar(grupo.id, tiene)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  tiene
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-accent text-white hover:bg-accent-hover'
                }`}
              >
                {tiene ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{tiene ? 'Quitar acceso' : 'Dar acceso'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default EquiposAccesoPanel;
