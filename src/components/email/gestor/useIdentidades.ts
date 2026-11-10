import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  type Identidad, type UsuarioFila, type CrmFila, type ContactoFila,
  resolverIdentidades, normalizarCorreo,
} from '@/lib/correo/identidadRemitente';

// Busca en MOVI a los remitentes de los correos visibles. Solo lee: no cambia
// cómo se detecta el agente al crear un trámite (eso lo hace el servidor).
// Si una consulta falla, ese remitente se queda sin tarjeta, sin error en pantalla.

const cache = new Map<string, Identidad | null>();

function orIlike(campos: string[], correos: string[]): string {
  // Los valores van entre comillas dobles para que comas o puntos no rompan el filtro.
  const q = (e: string) => `"${e.replace(/"/g, '')}"`;
  return correos.flatMap(e => campos.map(c => `${c}.ilike.${q(e)}`)).join(',');
}

export function useIdentidades(correos: string[]): Map<string, Identidad | null> {
  const { usuario } = useAuth();
  const puedeVerFicha = usuario?.rol === 'Administrador' || usuario?.rol === 'Gerente';
  const [, setTick] = useState(0);
  const pedido = useRef(new Set<string>());

  const clave = [...new Set(correos.map(normalizarCorreo).filter(e => e.includes('@')))].sort().join('|');

  useEffect(() => {
    const faltan = clave.split('|').filter(e => e && !cache.has(e) && !pedido.current.has(e));
    if (faltan.length === 0) return;
    faltan.forEach(e => pedido.current.add(e));
    let vivo = true;
    (async () => {
      const lotes: string[][] = [];
      for (let i = 0; i < faltan.length; i += 20) lotes.push(faltan.slice(i, i + 20));
      for (const lote of lotes) {
        const [u, c, k] = await Promise.all([
          supabase.from('usuarios')
            .select('id, nombre_completo, nombre, apellidos, rol, puesto, email_laboral, email_personal, oficina:oficinas!oficina_id(nombre)')
            .eq('is_deleted', false)
            .or(orIlike(['email_laboral', 'email_personal'], lote))
            .limit(60),
          supabase.from('crm_contactos').select('id, nombre_completo, email, tipo_contacto').or(orIlike(['email'], lote)).limit(60),
          supabase.from('contactos').select('id, nombre, apellido, email, empresa').eq('eliminado', false).or(orIlike(['email'], lote)).limit(60),
        ]);
        const mapa = resolverIdentidades(
          lote,
          (u.data || []) as unknown as UsuarioFila[],
          (c.data || []) as CrmFila[],
          (k.data || []) as ContactoFila[],
          { puedeVerFichaUsuario: puedeVerFicha },
        );
        // Un error de consulta no se guarda como "desconocido": se reintenta luego.
        if (!u.error && !c.error && !k.error) lote.forEach(e => cache.set(e, mapa.get(e) ?? null));
        else lote.forEach(e => { if (mapa.has(e)) cache.set(e, mapa.get(e)!); });
        lote.forEach(e => pedido.current.delete(e));
      }
      if (vivo) setTick(t => t + 1);
    })().catch(() => { faltan.forEach(e => pedido.current.delete(e)); });
    return () => { vivo = false; };
  }, [clave, puedeVerFicha]);

  const out = new Map<string, Identidad | null>();
  for (const e of clave.split('|')) if (e && cache.has(e)) out.set(e, cache.get(e)!);
  return out;
}

/** Trámites ligados a correos (por Message-ID), para mostrar su folio en la lista. */
export function useTramitesLigados(messageIds: string[], version = 0): Map<string, { id: string; folio: string }> {
  const [mapa, setMapa] = useState<Map<string, { id: string; folio: string }>>(new Map());
  const clave = [...new Set(messageIds.filter(Boolean))].sort().join('\n');
  useEffect(() => {
    const ids = clave ? clave.split('\n') : [];
    if (ids.length === 0) { setMapa(new Map()); return; }
    let vivo = true;
    supabase.from('tickets')
      .select('id, folio, source_email_message_id')
      .eq('canal_origen', 'email')
      .in('source_email_message_id', ids)
      .then(({ data }) => {
        if (!vivo) return;
        const m = new Map<string, { id: string; folio: string }>();
        for (const t of (data || []) as { id: string; folio: string; source_email_message_id: string }[]) {
          m.set(t.source_email_message_id, { id: t.id, folio: t.folio });
        }
        setMapa(m);
      });
    return () => { vivo = false; };
  }, [clave, version]);
  return mapa;
}
