// ============================================================================
// alta-enviar-cincel — arranca la verificación de identidad + firma del contrato.
// Público (verify_jwt=true), protegido por resume_token. Valida requisitos según
// el tipo de agente, obtiene el contrato (PDF) y crea la sesión con el proveedor
// (Cincel o mock). Persiste firma/verificación y devuelve la signUrl.
// ============================================================================

import {
  json, preflight, serviceClient, bitacora, transicion, type AltaRow,
} from '../_shared/alta/service.ts';
import { getOnboardingProvider } from '../_shared/alta/providers.ts';

// PDF mínimo válido, placeholder mientras el equipo sube el contrato real.
const PLACEHOLDER_PDF_B64 =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXT4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1MiAwMDAwMCBuIAowMDAwMDAwMTAxIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA0L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTc4CiUlRU9GCg==';

/** Descarga el contrato configurado del bucket, o usa el placeholder. */
async function obtenerContrato(
  db: ReturnType<typeof serviceClient>,
  tipoAgente: string | null,
): Promise<{ b64: string; nombre: string; version: string }> {
  const bucket = Deno.env.get('ALTA_CONTRATO_BUCKET') || 'altas-onboarding';
  const path = tipoAgente === 'con_cedula'
    ? (Deno.env.get('ALTA_CONTRATO_PATH_CON_CEDULA') || '_contratos/contrato_con_cedula.pdf')
    : (Deno.env.get('ALTA_CONTRATO_PATH_EN_DESARROLLO') || '_contratos/contrato_en_desarrollo.pdf');
  try {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (!error && data) {
      const buf = new Uint8Array(await data.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return { b64: btoa(bin), nombre: `Contrato de agente (${tipoAgente || 'agente'})`, version: path };
    }
  } catch (_e) { /* usa placeholder */ }
  return { b64: PLACEHOLDER_PDF_B64, nombre: 'Contrato de agente (BORRADOR)', version: 'placeholder' };
}

/** Requisitos mínimos por tipo antes de mandar a firmar. */
function faltantes(alta: AltaRow, docs: string[]): string[] {
  const f: string[] = [];
  if (!alta.nombre || !alta.apellidos) f.push('nombre_completo');
  if (!alta.email) f.push('email');
  if (!alta.whatsapp) f.push('whatsapp');
  if (!alta.rfc) f.push('rfc');
  if (alta.tipo_agente === 'con_cedula' && !alta.cedula) f.push('cedula');
  // Documentos mínimos:
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

    const { data: docRows } = await db.from('alta_agente_documento')
      .select('tipo_documento').eq('alta_id', altaId);
    const docs = (docRows || []).map((d) => (d as { tipo_documento: string }).tipo_documento);

    const falta = faltantes(alta as AltaRow, docs);
    if (falta.length) {
      await transicion(db, alta as AltaRow, 'incomplete', 'faltan_requisitos', { faltantes: falta }, 'usuario');
      return json({ error: 'FALTAN_REQUISITOS', faltantes: falta }, 400);
    }

    const provider = await getOnboardingProvider();
    const contrato = await obtenerContrato(db, alta.tipo_agente as string | null);
    const appUrl = Deno.env.get('ALTA_APP_URL') || '';

    let sesion;
    try {
      sesion = await provider.crearSesion({
        altaId,
        firmante: {
          nombre: String(alta.nombre || ''),
          apellidos: String(alta.apellidos || ''),
          email: String(alta.email || ''),
          rfc: alta.rfc ? String(alta.rfc) : undefined,
          requiereIdentidad: true,
        },
        contratoPdfBase64: contrato.b64,
        contratoNombre: contrato.nombre,
        returnUrl: appUrl ? `${appUrl}/alta?alta=${altaId}` : undefined,
        metadata: {
          mockResultado: (alta.metadata as Record<string, unknown>)?.mockResultado,
        },
      });
    } catch (e) {
      await bitacora(db, altaId, 'error_crear_sesion', { detalle: { error: String((e as Error)?.message) }, actor: 'sistema' });
      await transicion(db, alta as AltaRow, 'needs_retry', 'error_proveedor', { error: String((e as Error)?.message) });
      return json({ error: 'ERROR_PROVEEDOR', detalle: String((e as Error)?.message) }, 502);
    }

    const ahora = new Date().toISOString();
    await db.from('alta_agente').update({
      cincel_document_uuid: sesion.documentoExternalId,
      cincel_team_uuid: sesion.teamUuid || null,
      cincel_folder_uuid: sesion.folderUuid || null,
      intentos_verificacion: (Number(alta.intentos_verificacion) || 0) + 1,
      intentos_firma: (Number(alta.intentos_firma) || 0) + 1,
    }).eq('id', altaId);

    // Upsert de verificación y firma (proveedor = el resuelto).
    await db.from('alta_agente_verificacion').insert({
      alta_id: altaId, proveedor: provider.nombre, estado: 'pendiente',
      invite_uuid: sesion.inviteExternalId || null, iniciada_at: ahora,
    });
    await db.from('alta_agente_firma').insert({
      alta_id: altaId, proveedor: provider.nombre, estado: 'enviada',
      documento_external_id: sesion.documentoExternalId,
      invite_external_id: sesion.inviteExternalId || null,
      contrato_version: contrato.version, enviada_at: ahora,
    });

    await transicion(db, alta as AltaRow, 'identity_pending', 'sesion_creada', {
      proveedor: provider.nombre, documento: sesion.documentoExternalId,
    });

    return json({ ok: true, signUrl: sesion.signUrl, documento: sesion.documentoExternalId, proveedor: provider.nombre });
  } catch (e) {
    console.error('[alta-enviar-cincel] error:', e);
    return json({ error: 'ERROR_SERVIDOR', detalle: String((e as Error)?.message || e) }, 500);
  }
});
