import { useCallback, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Favoritos del menú, guardados POR USUARIO en `usuario_menu_favoritos`
 * (antes vivían en localStorage y no viajaban entre dispositivos).
 *
 * Es un store compartido a nivel módulo: el menú lateral, el panel "Ver todas"
 * y el MegaMenu leen la misma lista, así que marcar un favorito en uno se ve
 * al instante en los demás sin recargar.
 *
 * localStorage queda solo como caché para pintar rápido y como respaldo si la
 * tabla todavía no existe (migración sin correr): en ese caso todo sigue
 * funcionando como antes, solo que por navegador.
 */

const CACHE_KEY = 'movi_nav_favorites';

type Estado = { paths: string[]; usuarioId: string | null; usaBD: boolean };

let estado: Estado = { paths: leerCache(), usuarioId: null, usaBD: false };
const oyentes = new Set<() => void>();
let iniciado = false;

function leerCache(): string[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function escribirCache(paths: string[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(paths)); } catch { /* sin almacenamiento */ }
}

function publicar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  if (parcial.paths) escribirCache(parcial.paths);
  oyentes.forEach(fn => fn());
}

async function cargar(usuarioId: string | null) {
  if (!usuarioId) {
    publicar({ usuarioId: null, usaBD: false });
    return;
  }

  const { data, error } = await supabase
    .from('usuario_menu_favoritos')
    .select('item_path, orden')
    .eq('usuario_id', usuarioId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    // Lo más probable: la migración 20261014000001 no se ha corrido. Se sigue con localStorage.
    console.warn('[favoritos] sin tabla usuario_menu_favoritos, se usa localStorage:', error.message);
    publicar({ usuarioId, usaBD: false });
    return;
  }

  let paths = (data ?? []).map(r => r.item_path as string);

  // Primera vez con la tabla: subir lo que este navegador ya tenía marcado.
  if (paths.length === 0) {
    const locales = leerCache();
    if (locales.length > 0) {
      const { error: errIns } = await supabase
        .from('usuario_menu_favoritos')
        .upsert(
          locales.map((item_path, orden) => ({ usuario_id: usuarioId, item_path, orden })),
          { onConflict: 'usuario_id,item_path', ignoreDuplicates: true }
        );
      if (!errIns) paths = locales;
      else console.error('[favoritos] no se pudieron migrar los de localStorage:', errIns.message);
    }
  }

  publicar({ paths, usuarioId, usaBD: true });
}

function iniciar() {
  if (iniciado) return;
  iniciado = true;

  supabase.auth.getSession().then(({ data }) => cargar(data.session?.user?.id ?? null));

  supabase.auth.onAuthStateChange((_evento, session) => {
    const id = session?.user?.id ?? null;
    if (id !== estado.usuarioId) cargar(id);
  });

  // Al volver a la pestaña se relee: así lo marcado en otro dispositivo aparece sin recargar.
  window.addEventListener('focus', () => {
    if (estado.usaBD && estado.usuarioId) cargar(estado.usuarioId);
  });
}

function suscribir(fn: () => void) {
  iniciar();
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

async function alternar(path: string) {
  const antes = estado.paths;
  const esFav = antes.includes(path);
  const despues = esFav ? antes.filter(p => p !== path) : [...antes, path];
  publicar({ paths: despues }); // optimista

  const { usuarioId, usaBD } = estado;
  if (!usaBD || !usuarioId) return;

  const { error } = esFav
    ? await supabase.from('usuario_menu_favoritos').delete().eq('usuario_id', usuarioId).eq('item_path', path)
    : await supabase.from('usuario_menu_favoritos').upsert(
        { usuario_id: usuarioId, item_path: path, orden: despues.length - 1 },
        { onConflict: 'usuario_id,item_path' }
      );

  if (error) {
    console.error('[favoritos] no se pudo guardar:', error.message);
    publicar({ paths: antes });
  }
}

export function useMenuFavoritos() {
  const paths = useSyncExternalStore(suscribir, () => estado.paths, () => estado.paths);
  const esFavorito = useCallback((path: string) => paths.includes(path), [paths]);
  return { favoritos: paths, esFavorito, alternarFavorito: alternar };
}
