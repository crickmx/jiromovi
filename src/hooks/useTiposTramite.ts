import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached, invalidateCache } from '../lib/sessionCache';
import { setDynamicTipos, TIPO_TRAMITE_OPTIONS, type TipoTramiteConfig, type AreaCategoria } from '../lib/registroActividadesTypes';

export interface TipoTramiteDB {
  id: string;
  value: string;
  label: string;
  area: string;
  color: string;
  is_custom: boolean;
  orden: number;
  categoria: string;
  activo: boolean;
  sla_horas: number | null;
}

/**
 * Tipos que NO se ofrecen en las pantallas genéricas de alta, porque tienen su
 * propia pantalla donde sí se captura lo que hace falta.
 *
 * QA 2026-11-04 (A6) — "Alta Usuario Beta" se levanta desde el botón "Únete al
 * Programa Beta" del inicio (`SolicitudBetaModal`), que tiene su casilla de
 * Comentarios y la guarda. Creándolo desde un formulario genérico no hay dónde
 * escribir nada —ese tipo no trae campo de descripción—, así que el alta
 * guardaba el relleno literal "Sin descripción" y el aviso por WhatsApp/correo
 * salía sin decir de qué se trata. Los únicos dos trámites así que existen son
 * de la corrida de los bots del 22/10.
 *
 * Se esconde aquí y NO se desactiva el tipo: desactivarlo diría en Catálogos
 * que está dado de baja, y no lo está.
 *
 * Vive en este módulo porque son DOS las pantallas que ofrecen tipos para
 * crear —el alta de Trámites y "Iniciar trámite" desde un correo— y una lista
 * por pantalla es la segunda copia que se desincroniza.
 */
export const TIPOS_CON_PANTALLA_PROPIA = ['alta_usuario_beta'];

const CACHE_KEY = 'tipos_tramite_v2';
const CACHE_TTL = 10 * 60 * 1000; // 10 min

/** Invalida el caché de tipos de trámite (llamar al guardar cambios en el catálogo). */
export function invalidateTiposTramiteCache() {
  invalidateCache(CACHE_KEY);
}

/** Tipos de trámite activos con caché compartido de 10 min entre componentes. */
export function useTiposTramite() {
  const [tipos, setTipos] = useState<TipoTramiteDB[]>(() => getCached<TipoTramiteDB[]>(CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(tipos.length === 0);

  useEffect(() => {
    const cached = getCached<TipoTramiteDB[]>(CACHE_KEY);
    if (cached) {
      setTipos(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('ticket_tipos')
      .select('id, value, label, area, color, is_custom, orden, categoria, activo, sla_horas')
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => {
        const rows = (data ?? []) as TipoTramiteDB[];
        setCached(CACHE_KEY, rows, CACHE_TTL);
        setTipos(rows);
        setLoading(false);

        // Sincronizar helpers de registroActividadesTypes con datos de DB
        const staticMap = new Map(TIPO_TRAMITE_OPTIONS.map(t => [t.value, t]));
        const fromDb: TipoTramiteConfig[] = rows.map(r => ({
          value: r.value,
          label: r.label,
          area: (r.area || 'Operaciones') as AreaCategoria,
          tipoAplicable: staticMap.get(r.value)?.tipoAplicable ?? 'general',
        }));
        // Tipos estáticos que aún no están en DB (legacy sin migrar)
        const staticOnly = TIPO_TRAMITE_OPTIONS.filter(s => !fromDb.some(d => d.value === s.value));
        setDynamicTipos([...fromDb, ...staticOnly]);
      });
  }, []);

  /** Map value → TipoTramiteDB para lookups O(1). */
  const tiposMap = new Map(tipos.map(t => [t.value, t]));

  return { tipos, tiposMap, loading };
}
