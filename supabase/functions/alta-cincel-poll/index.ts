// ============================================================================
// alta-cincel-poll — job de reconciliación (mecanismo PRIMARIO, ya que Cincel no
// expone webhooks públicos). Lo dispara un cron (pg_cron) cada pocos minutos.
// 1) Reconcilia altas en vuelo (identity_pending / signature_pending).
// 2) Detecta abandonos: altas draft/in_progress sin actividad reciente y con
//    datos incompletos -> estado 'incomplete' + notificación a Administradores.
//
// Invocación INTERNA (cron con service_role). Deploy con verify_jwt=false.
// ============================================================================

import { json, preflight, serviceClient, transicion, notificarAdmins, type AltaRow } from '../_shared/alta/service.ts';
import { reconciliarAlta } from '../_shared/alta/reconciliar.ts';

function autorizado(req: Request): boolean {
  const auth = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const secret = Deno.env.get('ALTA_INTERNAL_SECRET') || '';
  return (!!service && auth === service) || (!!secret && auth === secret);
}

const ABANDONO_MIN = Number(Deno.env.get('ALTA_ABANDONO_MINUTOS') || '60');

Deno.serve(async (req: Request) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (!autorizado(req)) return json({ error: 'NO_AUTORIZADO' }, 401);

  try {
    const db = serviceClient();
    let reconciliadas = 0, abandonos = 0;

    // 1) Reconciliar altas en vuelo.
    const { data: enVuelo } = await db.from('alta_agente')
      .select('*')
      .in('estado', ['identity_pending', 'signature_pending'])
      .limit(100);
    for (const a of (enVuelo || [])) {
      try {
        const r = await reconciliarAlta(db, a as AltaRow, 'cron');
        if (r.cambio) reconciliadas++;
      } catch (e) {
        console.error('[alta-cincel-poll] reconciliar error (no fatal):', e);
      }
    }

    // 2) Detectar abandonos (sin actividad y aún sin enviar a Cincel).
    const limite = new Date(Date.now() - ABANDONO_MIN * 60_000).toISOString();
    const { data: posiblesAbandonos } = await db.from('alta_agente')
      .select('*')
      .in('estado', ['draft', 'in_progress'])
      .is('abandono_notificado_at', null)
      .lt('updated_at', limite)
      .limit(100);
    for (const a of (posiblesAbandonos || [])) {
      const alta = a as AltaRow;
      try {
        await transicion(db, alta, 'incomplete', 'abandono_detectado', {
          minutos_sin_actividad: ABANDONO_MIN,
        }, 'cron');
        await db.from('alta_agente').update({ abandono_notificado_at: new Date().toISOString() }).eq('id', alta.id);
        await notificarAdmins(db, 'alta_agente_incompleta', {
          nombre: `${alta.nombre || ''} ${alta.apellidos || ''}`.trim() || 'Prospecto sin nombre',
          folio: String(alta.folio || ''),
          contacto: String(alta.whatsapp || alta.email || ''),
          url: '/admin/altas',
        }, '/admin/altas');
        abandonos++;
      } catch (e) {
        console.error('[alta-cincel-poll] abandono error (no fatal):', e);
      }
    }

    return json({ ok: true, reconciliadas, abandonos });
  } catch (e) {
    console.error('[alta-cincel-poll] error:', e);
    return json({ error: 'ERROR_SERVIDOR', detalle: String((e as Error)?.message || e) }, 500);
  }
});
