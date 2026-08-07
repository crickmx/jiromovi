// ============================================================================
// Reconciliación de un alta contra el proveedor (identidad + firma).
// Compartida por el webhook (una alta) y el job de polling (lote). Consulta el
// estado del proveedor, actualiza filas, decide reintento / revisión humana /
// aprobación, y al aprobar dispara el alta automática (alta-finalizar).
// ============================================================================

import { type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { bitacora, transicion, type AltaRow } from './service.ts';
import { getOnboardingProvider, type RefSesion } from './providers.ts';

const MAX_INTENTOS = 2; // tras esto → revisión humana

async function guardarConstancia(
  db: SupabaseClient, altaId: string, ref: RefSesion,
): Promise<{ firmado?: string; constancia?: string }> {
  try {
    const provider = await getOnboardingProvider();
    const c = await provider.descargarConstancia(ref);
    const out: { firmado?: string; constancia?: string } = {};
    if (c.documentoFirmadoBytes) {
      const p = `${altaId}/contrato_firmado_${Date.now()}.pdf`;
      await db.storage.from('altas-onboarding').upload(p, new Blob([c.documentoFirmadoBytes], { type: 'application/pdf' }), { upsert: true });
      out.firmado = p;
    }
    if (c.constanciaZipBytes) {
      const p = `${altaId}/constancia_${Date.now()}.zip`;
      await db.storage.from('altas-onboarding').upload(p, new Blob([c.constanciaZipBytes], { type: 'application/zip' }), { upsert: true });
      out.constancia = p;
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
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
  if (!alta.cincel_document_uuid) return { estado: alta.estado, cambio: false };

  const [{ data: firmaRow }, { data: verifRow }] = await Promise.all([
    db.from('alta_agente_firma').select('*').eq('alta_id', alta.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('alta_agente_verificacion').select('*').eq('alta_id', alta.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const ref: RefSesion = {
    documentoExternalId: String(alta.cincel_document_uuid),
    inviteExternalId: String((firmaRow as Record<string, unknown>)?.invite_external_id || ''),
    identityUuid: String((verifRow as Record<string, unknown>)?.external_id || (verifRow as Record<string, unknown>)?.invite_uuid || ''),
  };

  const provider = await getOnboardingProvider();
  const [verif, firma] = await Promise.all([
    provider.consultarVerificacion(ref),
    provider.consultarFirma(ref),
  ]);

  // Persistir estados crudos.
  if (verifRow) {
    await db.from('alta_agente_verificacion').update({
      estado: verif.estado,
      resultado: { evidencias: verif.evidencias || {}, rfcValidado: verif.rfcValidado ?? null },
      resuelta_at: ['aprobada', 'rechazada', 'error'].includes(verif.estado) ? new Date().toISOString() : null,
    }).eq('id', String((verifRow as Record<string, unknown>).id));
  }
  if (firmaRow) {
    await db.from('alta_agente_firma').update({
      estado: firma.estado,
      documento_status: firma.documentoStatus || null,
      invite_status: firma.inviteStatus || null,
      firmada_at: firma.estado === 'firmada' ? new Date().toISOString() : null,
    }).eq('id', String((firmaRow as Record<string, unknown>).id));
  }

  const intentos = Math.max(Number(alta.intentos_verificacion) || 0, Number(alta.intentos_firma) || 0);
  const huboRechazo = verif.estado === 'rechazada' || firma.estado === 'rechazada' || verif.estado === 'error' || firma.estado === 'error';

  if (huboRechazo) {
    const destino = intentos >= MAX_INTENTOS ? 'human_review' : 'needs_retry';
    await transicion(db, alta, destino, huboRechazo ? 'verificacion_o_firma_rechazada' : 'error', {
      verificacion: verif.estado, firma: firma.estado, intentos,
    }, actor);
    return { estado: alta.estado, cambio: alta.estado !== estadoInicial };
  }

  if (verif.estado === 'aprobada' && firma.estado === 'firmada') {
    const paths = await guardarConstancia(db, alta.id, ref);
    if (firmaRow) {
      await db.from('alta_agente_firma').update({
        documento_firmado_path: paths.firmado || null,
        constancia_path: paths.constancia || null,
      }).eq('id', String((firmaRow as Record<string, unknown>).id));
    }
    await transicion(db, alta, 'approved', 'identidad_y_firma_ok', { verif: verif.estado, firma: firma.estado }, actor);
    await dispararFinalizar(alta.id);
    return { estado: alta.estado, cambio: true };
  }

  if (verif.estado === 'aprobada') {
    await transicion(db, alta, 'signature_pending', 'identidad_ok_pendiente_firma', {}, actor);
  } else {
    await transicion(db, alta, 'identity_pending', 'esperando_verificacion', {}, actor);
  }
  await bitacora(db, alta.id, 'reconciliado', { detalle: { verif: verif.estado, firma: firma.estado }, actor });
  return { estado: alta.estado, cambio: alta.estado !== estadoInicial };
}
