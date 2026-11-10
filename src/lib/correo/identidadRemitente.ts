// Quién es el remitente de un correo, según lo que MOVI ya sabe de él.
// Puro y sin Supabase (las consultas viven en useIdentidadRemitente).
//   npx tsx src/lib/correo/correo.test.mjs
//
// El criterio de "usuario de MOVI" es EL MISMO que usa la función del servidor
// analyze-email-for-tramite para sugerir el agente al crear un trámite:
// email_laboral o email_personal, sin distinguir mayúsculas. Si cambia uno,
// hay que cambiar el otro, o la tarjeta y el modal dirían cosas distintas.

export type TipoIdentidad = 'usuario' | 'crm' | 'contacto';

export interface Identidad {
  tipo: TipoIdentidad;
  id: string;
  nombre: string;
  rol?: string | null;
  puesto?: string | null;
  empresa?: string | null;
  enlace?: string | null;
}

export interface UsuarioFila {
  id: string;
  nombre_completo?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
  rol?: string | null;
  puesto?: string | null;
  email_laboral?: string | null;
  email_personal?: string | null;
  oficina?: { nombre?: string | null } | null;
}
export interface CrmFila { id: string; nombre_completo?: string | null; email?: string | null; tipo_contacto?: string | null }
export interface ContactoFila { id: string; nombre?: string | null; apellido?: string | null; email?: string | null; empresa?: string | null }

export const normalizarCorreo = (e: string | null | undefined) => (e || '').trim().toLowerCase();

/** Etiqueta corta para la lista. */
export function etiquetaIdentidad(i: Identidad | null | undefined): string | null {
  if (!i) return null;
  if (i.tipo === 'usuario') return i.rol === 'Agente' ? 'Agente' : 'MOVI';
  if (i.tipo === 'crm') return 'CRM';
  return 'Contacto';
}

/**
 * Resuelve correo → identidad con prioridad: usuario de MOVI > CRM > Mis contactos.
 * Un usuario dado de baja no debería llegar aquí (la consulta ya lo filtra).
 */
export function resolverIdentidades(
  correos: string[],
  usuarios: UsuarioFila[],
  crm: CrmFila[],
  contactos: ContactoFila[],
  opts: { puedeVerFichaUsuario: boolean },
): Map<string, Identidad> {
  const out = new Map<string, Identidad>();
  const buscados = new Set(correos.map(normalizarCorreo).filter(Boolean));

  for (const c of contactos) {
    const e = normalizarCorreo(c.email);
    if (!buscados.has(e)) continue;
    out.set(e, {
      tipo: 'contacto', id: c.id,
      nombre: [c.nombre, c.apellido].filter(Boolean).join(' ').trim() || e,
      empresa: c.empresa || null, enlace: null,
    });
  }
  for (const c of crm) {
    const e = normalizarCorreo(c.email);
    if (!buscados.has(e)) continue;
    out.set(e, {
      tipo: 'crm', id: c.id, nombre: c.nombre_completo || e,
      empresa: c.tipo_contacto || null, enlace: `/contactos/${c.id}`,
    });
  }
  for (const u of usuarios) {
    const nombre = u.nombre_completo || [u.nombre, u.apellidos].filter(Boolean).join(' ').trim();
    for (const campo of [u.email_personal, u.email_laboral]) {
      const e = normalizarCorreo(campo);
      if (!buscados.has(e)) continue;
      out.set(e, {
        tipo: 'usuario', id: u.id, nombre: nombre || e,
        rol: u.rol || null, puesto: u.puesto || null,
        empresa: u.oficina?.nombre || null,
        enlace: opts.puedeVerFichaUsuario ? `/directorio/${u.id}` : null,
      });
    }
  }
  return out;
}
