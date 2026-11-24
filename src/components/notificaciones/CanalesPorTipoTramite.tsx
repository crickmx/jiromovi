import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, MessageCircle, Loader2, RotateCcw, Info } from 'lucide-react';

interface TipoTramite {
  id: string;
  label: string;
  area: string | null;
}

interface Excepcion {
  enviar_correo: boolean;
  enviar_whatsapp: boolean;
}

interface Props {
  /** Código del aviso (el mismo que `correo_tipos_notificacion.codigo`). */
  codigo: string;
  /** Lo que está configurado para el evento: lo que hereda un tipo sin excepción. */
  heredaCorreo: boolean;
  heredaWhatsapp: boolean;
  onToast?: (msg: string, tipo?: 'success' | 'error') => void;
}

/**
 * Canales de este aviso, tipo de trámite por tipo de trámite.
 *
 * La lista sale de `ticket_tipos` activos — no de una lista escrita a mano —
 * así que un tipo nuevo aparece aquí solo. Un tipo sin excepción **hereda** lo
 * del evento y se muestra así, en gris: la mayoría no necesita trato especial
 * y llenar la tabla con copias de lo mismo solo crea cosas que mantener.
 */
export function CanalesPorTipoTramite({ codigo, heredaCorreo, heredaWhatsapp, onToast }: Props) {
  const [tipos, setTipos] = useState<TipoTramite[]>([]);
  const [excepciones, setExcepciones] = useState<Record<string, Excepcion>>({});
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);

    Promise.all([
      supabase.from('ticket_tipos').select('id, label, area').eq('activo', true).order('area').order('label'),
      supabase
        .from('tramite_tipo_notificacion_canales')
        .select('ticket_tipo_id, enviar_correo, enviar_whatsapp')
        .eq('codigo', codigo),
    ]).then(([{ data: tiposData, error: errTipos }, { data: excData, error: errExc }]) => {
      if (!vivo) return;
      if (errTipos) onToast?.(`No se pudieron leer los tipos: ${errTipos.message}`, 'error');
      if (errExc) onToast?.(`No se pudieron leer las excepciones: ${errExc.message}`, 'error');

      setTipos((tiposData as TipoTramite[]) ?? []);
      const mapa: Record<string, Excepcion> = {};
      for (const e of excData ?? []) {
        mapa[e.ticket_tipo_id as string] = {
          enviar_correo: e.enviar_correo as boolean,
          enviar_whatsapp: e.enviar_whatsapp as boolean,
        };
      }
      setExcepciones(mapa);
      setCargando(false);
    });

    return () => { vivo = false; };
  }, [codigo, onToast]);

  /** Lo que de verdad va a pasar con ese tipo: su excepción, o lo heredado. */
  const efectivo = (tipoId: string): Excepcion & { propio: boolean } => {
    const exc = excepciones[tipoId];
    return exc
      ? { ...exc, propio: true }
      : { enviar_correo: heredaCorreo, enviar_whatsapp: heredaWhatsapp, propio: false };
  };

  const guardar = async (tipoIds: string[], cambio: Partial<Excepcion>) => {
    if (tipoIds.length === 0) return;
    setGuardando(true);

    const filas = tipoIds.map(id => {
      const actual = efectivo(id);
      return {
        ticket_tipo_id: id,
        codigo,
        enviar_correo: cambio.enviar_correo ?? actual.enviar_correo,
        enviar_whatsapp: cambio.enviar_whatsapp ?? actual.enviar_whatsapp,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from('tramite_tipo_notificacion_canales')
      .upsert(filas, { onConflict: 'ticket_tipo_id,codigo' });
    setGuardando(false);

    // Un guardado que falla sin decirlo deja la pantalla mintiendo: se ve el
    // cambio y la base nunca lo recibió. Ya pasó con otros toggles del proyecto.
    if (error) {
      onToast?.(`No se pudo guardar: ${error.message}`, 'error');
      return;
    }

    setExcepciones(prev => {
      const next = { ...prev };
      for (const fila of filas) {
        next[fila.ticket_tipo_id] = {
          enviar_correo: fila.enviar_correo,
          enviar_whatsapp: fila.enviar_whatsapp,
        };
      }
      return next;
    });
    onToast?.(tipoIds.length === 1 ? 'Guardado' : `Aplicado a ${tipoIds.length} tipos`);
  };

  const volverAHeredar = async (tipoIds: string[]) => {
    if (tipoIds.length === 0) return;
    setGuardando(true);
    const { error } = await supabase
      .from('tramite_tipo_notificacion_canales')
      .delete()
      .eq('codigo', codigo)
      .in('ticket_tipo_id', tipoIds);
    setGuardando(false);

    if (error) {
      onToast?.(`No se pudo quitar la excepción: ${error.message}`, 'error');
      return;
    }
    setExcepciones(prev => {
      const next = { ...prev };
      for (const id of tipoIds) delete next[id];
      return next;
    });
    onToast?.(tipoIds.length === 1 ? 'Vuelve a heredar del evento' : `${tipoIds.length} tipos vuelven a heredar`);
  };

  const alternarMarca = (id: string) => {
    setMarcados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-500 py-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando tipos de trámite…
      </div>
    );
  }

  if (tipos.length === 0) {
    return <p className="text-xs text-neutral-500 italic py-2">No hay tipos de trámite activos.</p>;
  }

  const todos = marcados.size === tipos.length;
  const conExcepcion = Object.keys(excepciones).length;

  return (
    <div>
      <div className="flex items-start gap-2 mb-3">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-600">
          Los tipos que no toques <strong>heredan</strong> los canales de arriba. Solo se guarda una
          excepción cuando le cambias algo a un tipo.
          {conExcepcion > 0 && ` Hoy hay ${conExcepcion} con configuración propia.`}
        </p>
      </div>

      {/* Masiva */}
      <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={todos}
            ref={el => { if (el) el.indeterminate = marcados.size > 0 && !todos; }}
            onChange={() => setMarcados(todos ? new Set() : new Set(tipos.map(t => t.id)))}
            className="w-3.5 h-3.5 rounded border-neutral-300"
          />
          <span className="text-xs font-medium text-neutral-700">
            {marcados.size > 0 ? `${marcados.size} seleccionados` : 'Seleccionar todos'}
          </span>
        </label>

        {marcados.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            <span className="text-xs text-neutral-500">Aplicar a los seleccionados:</span>
            {([
              { campo: 'enviar_correo' as const, label: 'Correo', icon: Mail },
              { campo: 'enviar_whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
            ]).map(({ campo, label, icon: Icon }) => (
              <span key={campo} className="inline-flex rounded-lg border border-neutral-300 overflow-hidden">
                <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-neutral-600 bg-white">
                  <Icon className="w-3 h-3" /> {label}
                </span>
                <button
                  disabled={guardando}
                  onClick={() => guardar([...marcados], { [campo]: true })}
                  className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                >
                  Sí
                </button>
                <button
                  disabled={guardando}
                  onClick={() => guardar([...marcados], { [campo]: false })}
                  className="px-2 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                >
                  No
                </button>
              </span>
            ))}
            <button
              disabled={guardando}
              onClick={() => volverAHeredar([...marcados])}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 disabled:opacity-50"
              title="Quita la excepción: estos tipos vuelven a usar los canales del evento"
            >
              <RotateCcw className="w-3 h-3" /> Heredar
            </button>
          </div>
        )}
      </div>

      {/* Uno por uno */}
      <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
        {tipos.map(tipo => {
          const ef = efectivo(tipo.id);
          return (
            <div
              key={tipo.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${
                ef.propio ? 'border-blue-200 bg-blue-50/40' : 'border-neutral-200 bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={marcados.has(tipo.id)}
                onChange={() => alternarMarca(tipo.id)}
                className="w-3.5 h-3.5 rounded border-neutral-300 shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-neutral-800 truncate">{tipo.label}</span>
                <span className="block text-[10.5px] text-neutral-500">
                  {tipo.area || 'Sin área'} · {ef.propio ? 'configuración propia' : 'hereda del evento'}
                </span>
              </span>

              {([
                { campo: 'enviar_correo' as const, icon: Mail, titulo: 'Correo' },
                { campo: 'enviar_whatsapp' as const, icon: MessageCircle, titulo: 'WhatsApp' },
              ]).map(({ campo, icon: Icon, titulo }) => (
                <button
                  key={campo}
                  disabled={guardando}
                  onClick={() => guardar([tipo.id], { [campo]: !ef[campo] })}
                  title={`${titulo}: ${ef[campo] ? 'encendido' : 'apagado'}${ef.propio ? '' : ' (heredado)'}`}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-all disabled:opacity-50 ${
                    ef[campo]
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-neutral-400 border-neutral-200 line-through'
                  } ${ef.propio ? '' : 'opacity-60'}`}
                >
                  <Icon className="w-3 h-3" />
                </button>
              ))}

              {ef.propio && (
                <button
                  disabled={guardando}
                  onClick={() => volverAHeredar([tipo.id])}
                  title="Volver a heredar los canales del evento"
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CanalesPorTipoTramite;
