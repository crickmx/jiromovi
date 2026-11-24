// ============================================================================
// alta-cincel-webhook — receptor de webhooks de Cincel (si se habilitan en el
// dashboard). PÚBLICO (verify_jwt=false). Valida un secret compartido en
// tiempo constante (patrón wazzup-webhook), loguea el payload crudo y reconcilia
// el alta asociada. SIEMPRE responde 200 para no provocar reintentos.
//
// Mientras Cincel no ofrezca webhooks, el mecanismo primario es alta-cincel-poll.
// ============================================================================

import { serviceClient } from '../_shared/alta/service.ts';
import { reconciliarAlta } from '../_shared/alta/reconciliar.ts';
import type { AltaRow } from '../_shared/alta/service.ts';

/** Comparación en tiempo constante (evita timing attacks). */
function secretsMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const okHeaders = { 'Content-Type': 'application/json' };

Deno.serve(async (req: Request) => {
  // Health-check / verificación del proveedor.
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: okHeaders });
  }

  const db = serviceClient();
  let payload: Record<string, unknown> = {};
  let valido = false;
  let error: string | null = null;

  try {
    const expected = Deno.env.get('CINCEL_WEBHOOK_SECRET') || '';
    const received = new URL(req.url).searchParams.get('secret')
      || req.headers.get('x-cincel-secret') || '';
    valido = !!expected && secretsMatch(received, expected);

    try { payload = await req.json(); } catch { payload = {}; }

    // Log crudo siempre (válido o no).
    const headersObj: Record<string, string> = {};
    req.headers.forEach((v, k) => { if (k !== 'authorization') headersObj[k] = v; });

    // Localizar el alta por el uuid del documento presente en el payload.
    const docUuid = String(
      (payload.document as Record<string, unknown>)?.uuid
      || payload.document_uuid || payload.documentId || payload.uuid || '',
    );

    let altaId: string | null = null;
    if (valido && docUuid) {
      const { data: alta } = await db.from('alta_agente')
        .select('*').eq('cincel_document_uuid', docUuid).maybeSingle();
      if (alta) {
        altaId = alta.id;
        try {
          await reconciliarAlta(db, alta as AltaRow, 'webhook');
        } catch (e) {
          error = `reconciliar: ${String((e as Error)?.message)}`;
        }
      }
    }

    await db.from('cincel_webhook_logs').insert({
      evento: String(payload.event || payload.type || 'desconocido'),
      payload, headers: headersObj, valido, alta_id: altaId, procesado: valido && !!altaId, error,
    });
  } catch (e) {
    error = String((e as Error)?.message || e);
    try {
      await db.from('cincel_webhook_logs').insert({ evento: 'error', payload, valido, error });
    } catch { /* ignore */ }
  }

  // Siempre 200 (evita reintentos agresivos del proveedor).
  return new Response(JSON.stringify({ ok: true, valido }), { status: 200, headers: okHeaders });
});
