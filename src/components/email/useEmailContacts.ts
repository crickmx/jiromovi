import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * Contacto unificado para el compositor de correo.
 * Junta los usuarios corporativos (usuarios.email_laboral) con los contactos
 * guardados (tabla `contactos`) — las mismas fuentes que usa ContactosMovi.
 */
export interface EmailContact {
  id: string;
  name: string;
  email: string;
  sub?: string; // línea secundaria: puesto·oficina, o empresa
  source: 'corporativo' | 'guardado';
}

let cache: EmailContact[] | null = null;

export function useEmailContacts() {
  const [contacts, setContacts] = useState<EmailContact[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [corpRes, savedRes] = await Promise.all([
          supabase
            .from('usuarios')
            .select('id,nombre,apellidos,nombre_completo,email_laboral,puesto,oficina:oficinas!oficina_id(nombre)')
            .not('email_laboral', 'is', null),
          supabase
            .from('contactos')
            .select('id,nombre,apellido,email,empresa')
            .eq('eliminado', false),
        ]);

        if (cancelled) return;

        const list: EmailContact[] = [];

        for (const u of (corpRes.data as any[]) ?? []) {
          if (!u.email_laboral) continue;
          const name =
            u.nombre_completo ||
            [u.nombre, u.apellidos].filter(Boolean).join(' ') ||
            u.email_laboral;
          const oficinaNombre = Array.isArray(u.oficina) ? u.oficina[0]?.nombre : u.oficina?.nombre;
          const sub = [u.puesto, oficinaNombre].filter(Boolean).join(' · ');
          list.push({
            id: `u-${u.id}`,
            name,
            email: String(u.email_laboral).trim(),
            sub: sub || undefined,
            source: 'corporativo',
          });
        }

        for (const c of (savedRes.data as any[]) ?? []) {
          if (!c.email) continue;
          const name = [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email;
          list.push({
            id: `c-${c.id}`,
            name,
            email: String(c.email).trim(),
            sub: c.empresa || undefined,
            source: 'guardado',
          });
        }

        // Dedup por email (prioriza el corporativo, que va primero).
        const seen = new Set<string>();
        const deduped = list.filter((c) => {
          const key = c.email.toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        deduped.sort((a, b) => a.name.localeCompare(b.name, 'es'));

        cache = deduped;
        setContacts(deduped);
      } catch {
        if (!cancelled) setContacts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { contacts, loading };
}
