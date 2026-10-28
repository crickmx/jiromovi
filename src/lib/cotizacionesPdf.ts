// Regenera el PDF de una cotización guardada, sea del cotizador que sea.
// El agente que firma el PDF es el DUEÑO de la cotización, no quien la está
// viendo (un Administrador que reenvía la de un agente manda la del agente).
import { supabase } from './supabase';
import { USUARIO_COLUMNAS } from './usuarioColumnas';
import { getEffectiveUserLogo } from './logoUtils';
import type { Cotizacion } from './cotizaciones';
import type { DatosAuna } from './aunaOncoGuardado';

async function duenoDe(c: Pick<Cotizacion, 'usuario_id'>) {
  const { data } = await supabase
    .from('usuarios')
    .select(`${USUARIO_COLUMNAS}, oficina:oficinas!oficina_id(id, nombre, accent_color, logo_url, whatsapp, telefono, email, domicilio)`)
    .eq('id', c.usuario_id)
    .maybeSingle();
  const logo = await getEffectiveUserLogo(c.usuario_id);
  return { usuario: data, logo };
}

/** Agente que firma los PDF de Auna: el dueño de la cotización. */
export async function agenteAunaDeDueno(usuarioId: string) {
  const { usuario, logo } = await duenoDe({ usuario_id: usuarioId });
  const { agenteDesdeUsuario } = await import('./aunaOncoPdf');
  return agenteDesdeUsuario(usuario as never, logo);
}

const slug = (s: string) => s.trim().replace(/\s+/g, '-').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ]/g, '') || 'cliente';

export async function pdfDeCotizacion(c: Cotizacion): Promise<{ blob: Blob; nombre: string }> {
  const { usuario, logo } = await duenoDe(c);

  if (c.cotizador === 'gmm_multi') {
    const d = c.datos as { people?: unknown[]; options?: unknown[]; results?: unknown[] };
    if (!d.results || !(d.results as unknown[]).length) throw new Error('Esta cotización no tiene resultados calculados');
    const { generateMultiGmmPdf } = await import('./multicotizadorGmm/pdfGenerator');
    const blob = await generateMultiGmmPdf(
      d.results as never, (d.people ?? []) as never, c.cliente_nombre, usuario, (d.options ?? []) as never, logo || undefined, c.folio,
    );
    return { blob, nombre: `Multicotizador-GMM-${slug(c.cliente_nombre)}-${c.folio}.pdf` };
  }

  if (c.cotizador === 'auna_onco') {
    const d = c.datos as unknown as DatosAuna;
    const { generarPdfAunaOnco, agenteDesdeUsuario } = await import('./aunaOncoPdf');
    const { cotizar } = await import('./aunaOncoCotizador');
    // Se recalcula con la fecha en que se guardó: así las cotizaciones de antes
    // del 28/10 también traen parentesco y prima + recargo por persona.
    const resultado = d.asegurados?.length
      ? cotizar(
          d.asegurados.map((a, i) => (i === 0 && !a.nombre.trim() ? { ...a, nombre: d.cliente || c.cliente_nombre } : a)),
          d.formaPago ?? 'anual', d.descuento ?? 0, new Date(c.updated_at),
        )
      : d.resultado;
    const blob = await generarPdfAunaOnco({
      folio: c.folio,
      cliente: c.cliente_nombre,
      fecha: new Date(c.updated_at),
      resultado,
      agente: agenteDesdeUsuario(usuario as never, logo),
      region: d.region,
    });
    return { blob, nombre: `Precio-Referencia-Oncosalud-${slug(c.cliente_nombre)}-${c.folio}.pdf` };
  }

  throw new Error(`Cotizador desconocido: ${c.cotizador}`);
}
