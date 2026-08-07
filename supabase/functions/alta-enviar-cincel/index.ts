// ============================================================================
// alta-enviar-cincel (slug legacy) — arranca EN PARALELO la verificación de
// identidad (Sumsub) y la firma del contrato (SignWell). Público (verify_jwt=
// true), protegido por resume_token. Valida requisitos por tipo de agente,
// crea ambas sesiones, persiste y devuelve las referencias/URLs de cada una.
// ============================================================================

import {
  json, preflight, serviceClient, bitacora, transicion, type AltaRow,
} from '../_shared/alta/service.ts';
import { getIdentityProvider, getSignatureProvider } from '../_shared/alta/providers.ts';

const PLACEHOLDER_PDF_B64 =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXT4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1MiAwMDAwMCBuIAowMDAwMDAwMTAxIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA0L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTc4CiUlRU9GCg==';

async function obtenerContrato(db: ReturnType<typeof serviceClient>, tipoAgente: string | null): Promise<{ b64: string; nombre: string; version: string }> {
  const bucket = Deno.env.get('ALTA_CONTRATO_BUCKET') || 'altas-onboarding';
  const path = tipoAgente === 'con_cedula'
    ? (Deno.env.get('ALTA_CONTRATO_PATH_CON_CEDULA') || '_contratos/contrato_con_cedula.pdf')
    : (Deno.env.get('ALTA_CONTRATO_PATH_EN_DESARROLLO') || '_contratos/contrato_en_desarrollo.pdf');
  try {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (!error && data) {
      const buf = new Uint8Array(await data.arrayBuffer());
      let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return { b64: btoa(bin), nombre: `Contrato de agente (${tipoAgente || 'agente'})`, version: path };
    }
  } catch (_e) { /* placeholder */ }
  return { b64: PLACEHOLDER_PDF_B64, nombre: 'Contrato de agente (BORRADOR)', version: 'placeholder' };
}

function faltantes(alta: AltaRow, docs: string[]): string[] {
  const f: string[] = [];
  if (!alta.nombre || !alta.apellidos) f.push('nombre_completo');
  if (!alta.email) f.push('email');
  if (!alta.whatsapp) f.push('whatsapp');
  if (alta.tipo_agente === 'con_cedula' && !alta.rfc) f.push('rfc');
  if (alta.tipo_agente === 'con_cedula' && !alta.cedula) f.push('cedula');
  const req = ['ine_frente', 'csf', 'caratula_bancaria', 'poliza_rc'];
  if (alta.tipo_agente === 'con_cedula') req.push('cedula');
  for (const r of req) if (!docs.includes(r)) f.push(`doc:${r}`);
  return f;
}

Deno.serve(async (req: Request) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const db = serviceClient();
    const body = await req.json().catch(() => ({}));
    const altaId = String(body.alta_id || '');
    const token = String(body.resume_token || '');
    if (!altaId || !token) return json({ error: 'FALTA_ALTA_O_TOKEN' }, 400);

    const { data: alta } = await db.from('alta_agente').select('*').eq('id', altaId).maybeSingle();
    if (!alta) return json({ error: 'ALTA_NO_ENCONTRADA' }, 404);
    if (alta.resume_token !== token) return json({ error: 'TOKEN_INVALIDO' }, 403);

    const { data: docRows } = await db.from('alta_agente_documento').select('tipo_documento').eq('alta_id', altaId);
    const docs = (docRows || []).map((d) => (d as { tipo_documento: string }).tipo_documento);
    const falta = faltantes(alta as AltaRow, docs);
    if (falta.length) {
      await transicion(db, alta as AltaRow, 'incomplete', 'faltan_requisitos', { faltantes: falta }, 'usuario');
      return json({ error: 'FALTAN_REQUISITOS', faltantes: falta }, 400);
    }

    const [identity, signature] = await Promise.all([getIdentityProvider(), getSignatureProvider()]);
    const contrato = await obtenerContrato(db, alta.tipo_agente as string | null);
    const appUrl = Deno.env.get('ALTA_APP_URL') || '';
    const mockResultado = (alta.metadata as Record<string, unknown>)?.mockResultado;
    const ahora = new Date().toISOString();

    // Arrancar ambos en PARALELO; que uno falle no cancela al otro.
    const [verifRes, firmaRes] = await Promise.allSettled([
      identity.iniciarVerificacion({
        altaId, externalUserId: altaId,
        nombre: String(alta.nombre || ''), apellidos: String(alta.apellidos || ''),
        email: alta.email ? String(alta.email) : undefined,
        telefono: alta.whatsapp ? String(alta.whatsapp) : undefined,
      }),
      signature.crearFirma({
        altaId,
        firmante: { nombre: String(alta.nombre || ''), apellidos: String(alta.apellidos || ''), email: String(alta.email || '') },
        contratoPdfBase64: contrato.b64,
        contratoNombre: contrato.nombre,
        returnUrl: appUrl ? `${appUrl}/alta?alta=${altaId}` : undefined,
        metadata: { mockResultado },
      }),
    ]);

    const out: Record<string, unknown> = { ok: true, identidad: null, firma: null };

    if (verifRes.status === 'fulfilled') {
      const v = verifRes.value;
      await db.from('alta_agente_verificacion').insert({
        alta_id: altaId, proveedor: identity.nombre, estado: 'pendiente',
        external_id: v.applicantId, iniciada_at: ahora,
      });
      out.identidad = { proveedor: identity.nombre, applicantId: v.applicantId, sdkToken: v.sdkToken || null, url: v.url || null };
    } else {
      await bitacora(db, altaId, 'error_iniciar_identidad', { detalle: { error: String(verifRes.reason?.message || verifRes.reason) }, actor: 'sistema' });
    }

    if (firmaRes.status === 'fulfilled') {
      const s = firmaRes.value;
      await db.from('alta_agente').update({ cincel_document_uuid: s.documentId }).eq('id', altaId);
      await db.from('alta_agente_firma').insert({
        alta_id: altaId, proveedor: signature.nombre, estado: 'enviada',
        documento_external_id: s.documentId, invite_external_id: s.signatureId || null,
        contrato_version: contrato.version, enviada_at: ahora,
      });
      out.firma = { proveedor: signature.nombre, documentId: s.documentId, signUrl: s.signUrl || null };
    } else {
      await bitacora(db, altaId, 'error_iniciar_firma', { detalle: { error: String(firmaRes.reason?.message || firmaRes.reason) }, actor: 'sistema' });
    }

    await db.from('alta_agente').update({
      intentos_verificacion: (Number(alta.intentos_verificacion) || 0) + 1,
      intentos_firma: (Number(alta.intentos_firma) || 0) + 1,
    }).eq('id', altaId);

    if (verifRes.status === 'rejected' && firmaRes.status === 'rejected') {
      await transicion(db, alta as AltaRow, 'needs_retry', 'error_proveedores', {}, 'sistema');
      return json({ error: 'ERROR_PROVEEDORES' }, 502);
    }

    await transicion(db, alta as AltaRow, 'identity_pending', 'sesiones_creadas', {
      identidad: identity.nombre, firma: signature.nombre,
    });

    return json(out);
  } catch (e) {
    console.error('[alta-enviar-cincel] error:', e);
    return json({ error: 'ERROR_SERVIDOR', detalle: String((e as Error)?.message || e) }, 500);
  }
});
