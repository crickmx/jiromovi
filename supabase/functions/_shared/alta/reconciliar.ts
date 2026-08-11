// ============================================================================
// Reconciliación de un alta contra AMBOS proveedores (identidad + firma), que
// corren en paralelo. Consulta estado, persiste, y decide el estado global:
//   - identidad aprobada Y firma firmada  → approved → dispara alta-finalizar
//   - algún rechazo/error                 → needs_retry (o human_review)
//   - parcial                             → identity_pending / signature_pending
// Compartida por el webhook (una alta) y el cron de polling (lote).
// ============================================================================

import { type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { bitacora, transicion, type AltaRow } from './service.ts';
import { getIdentityProvider, getSignatureProvider, type RefFirma } from './providers.ts';

const MAX_INTENTOS = 2;

async function guardarConstancia(db: SupabaseClient, altaId: string, ref: RefFirma): Promise<{ firmado?: string; url?: string }> {
  try {
    const sig = await getSignatureProvider();
    const c = await sig.descargarConstancia(ref);
    const out: { firmado?: string; url?: string } = { url: c.url };
    if (c.documentoFirmadoBytes) {
      const p = `${altaId}/contrato_firmado_${Date.now()}.pdf`;
      await db.storage.from('altas-onboarding').upload(p, new Blob([c.documentoFirmadoBytes], { type: 'application/pdf' }), { upsert: true });
      out.firmado = p;
    }
    return out;
  } catch (e) {
    console.error('[alta] guardarConstancia (no fatal):', e);
    return {};
  }
}

async function dispararFinalizar(altaId: string): Promise<void> {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/alta-finalizar`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    body: JSON.stringify({ alta_id: altaId }),
  }).catch((e) => console.error('[alta] dispararFinalizar (no fatal):', e));
}

export async function reconciliarAlta(
  db: SupabaseClient,
  alta: AltaRow,
  actor: 'webhook' | 'cron' = 'cron',
): Promise<{ estado: string; cambio: boolean }> {
  const estadoInicial = alta.estado;
  if (['completed', 'rejected', 'human_review'].includes(alta.estado)) {
    return { estado: alta.estado, cambio: false };
  }

  const [{ data: firmaRow }, { data: verifRow }] = await Promise.all([
    db.from('alta_agente_firma').select('*').eq('alta_id', alta.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('alta_agente_verificacion').select('*').eq('alta_id', alta.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!firmaRow && !verifRow) return { estado: alta.estado, cambio: false };

  const applicantId = String((verifRow as Record<string, unknown>)?.external_id || '');
  const documentId = String((firmaRow as Record<string, unknown>)?.documento_external_id || alta.cincel_document_uuid || '');
  const signatureId = String((firmaRow as Record<string, unknown>)?.invite_external_id || '') || undefined;

  const [identity, signature] = await Promise.all([getIdentityProvider(), getSignatureProvider()]);
  const [verif, firma] = await Promise.all([
    applicantId ? identity.consultarVerificacion({ applicantId }) : Promise.resolve({ estado: 'pendiente' as const }),
    documentId ? signature.consultarFirma({ documentId, signatureId }) : Promise.resolve({ estado: 'pendiente' as const }),
  ]);

  // Persistir estados crudos de cada proveedor.
  if (verifRow) {
    await db.from('alta_agente_verificacion').update({
      estado: verif.estado,
      resultado: { evidencias: (verif as { evidencias?: unknown }).evidencias || {}, motivo: (verif as { motivo?: string }).motivo || null },
      resuelta_at: ['aprobada', 'rechazada', 'error'].includes(verif.estado) ? new Date().toISOString() : null,
    }).eq('id', String((verifRow as Record<string, unknown>).id));
  }
  if (firmaRow) {
    await db.from('alta_agente_firma').update({
      estado: firma.estado,
      documento_status: (firma as { documentoStatus?: string }).documentoStatus || null,
      firmada_at: firma.estado === 'firmada' ? new Date().toISOString() : null,
    }).eq('id', String((firmaRow as Record<string, unknown>).id));
  }

  const intentos = Math.max(Number(alta.intentos_verificacion) || 0, Number(alta.intentos_firma) || 0);
  const idFallo = verif.estado === 'rechazada' || verif.estado === 'error';
  const firmaFallo = firma.estado === 'rechazada' || firma.estado === 'error';
  const motivoId = (verif as { motivo?: string }).motivo;

  if (idFallo || firmaFallo) {
    // Revisión humana si: motivo manual/final, o se agotaron los reintentos.
    const aHumano = motivoId === 'manual' || motivoId === 'final' || intentos >= MAX_INTENTOS;
    const destino = aHumano ? 'human_review' : 'needs_retry';
    await transicion(db, alta, destino, 'verificacion_o_firma_fallida', {
      identidad: verif.estado, firma: firma.estado, motivo: motivoId, intentos,
    }, actor);
    return { estado: alta.estado, cambio: alta.estado !== estadoInicial };
  }

  if (verif.estado === 'aprobada' && firma.estado === 'firmada') {
    const paths = await guardarConstancia(db, alta.id, { documentId, signatureId });
    if (firmaRow) {
      await db.from('alta_agente_firma').update({
        documento_firmado_path: paths.firmado || null,
        constancia_path: paths.url || null,
      }).eq('id', String((firmaRow as Record<string, unknown>).id));
    }
    await transicion(db, alta, 'approved', 'identidad_y_firma_ok', { identidad: 'aprobada', firma: 'firmada' }, actor);
    await dispararFinalizar(alta.id);
    return { estado: alta.estado, cambio: true };
  }

  // Parcial: refleja qué falta.
  const destino = verif.estado === 'aprobada' ? 'signature_pending' : 'identity_pending';
  await transicion(db, alta, destino, 'reconciliado', { identidad: verif.estado, firma: firma.estado }, actor);
  return { estado: alta.estado, cambio: alta.estado !== estadoInicial };
}
