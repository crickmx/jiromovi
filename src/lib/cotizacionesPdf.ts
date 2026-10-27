// Regenera el PDF de una cotización guardada, sea del cotizador que sea.
// El agente que firma el PDF es el DUEÑO de la cotización, no quien la está
// viendo (un Administrador que reenvía la de un agente manda la del agente).
import { supabase } from './supabase';
import { USUARIO_COLUMNAS } from './usuarioColumnas';
import { getEffectiveUserLogo } from './logoUtils';
import type { Cotizacion } from './cotizaciones';
import type { DatosAuna } from './aunaOncoGuardado';

async function duenoDe(c: Cotizacion) {
  const { data } = await supabase
    .from('usuarios')
    .select(`${USUARIO_COLUMNAS}, oficina:oficinas!oficina_id(id, nombre, accent_color, logo_url, whatsapp, telefono, email, domicilio)`)
    .eq('id', c.usuario_id)
    .maybeSingle();
  const logo = await getEffectiveUserLogo(c.usuario_id);
  return { usuario: data, logo };
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
    const blob = await generarPdfAunaOnco({
      folio: c.folio,
      cliente: c.cliente_nombre,
      fecha: new Date(c.updated_at),
      resultado: d.resultado,
      agente: agenteDesdeUsuario(usuario as never, logo),
    });
    return { blob, nombre: `Cotizacion-Oncosalud-${slug(c.cliente_nombre)}-${c.folio}.pdf` };
  }

  throw new Error(`Cotizador desconocido: ${c.cotizador}`);
}
