import { createClient } from 'npm:@supabase/supabase-js@2';

// Cron (cada 1 min) de escalamiento de leads seguros.express (Parte D.2).
// - Expande el anillo de km de los leads no tomados cuyo intervalo ya venció.
// - Re-notifica sólo a los agentes NUEVOS que entran al anillo ampliado.
// - Al llegar al tope (o para leads sin coordenadas) sin ser tomado: avisa a
//   Admin una sola vez y, tras un tiempo extra configurable, marca 'expirado'.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Sólo service role (cron) o un Administrador autenticado.
  const authHeader = req.headers.get('Authorization') || '';
  const isServiceCall = authHeader.includes(supabaseServiceKey);
  if (!isServiceCall) {
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: perfil } = await userClient.from('usuarios').select('rol').eq('id', user.id).maybeSingle();
    if (perfil?.rol !== 'Administrador') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const nowMs = Date.now();

  try {
    const { data: config } = await supabase
      .from('express_leads_config').select('*').eq('id', 1).maybeSingle();
    if (!config || config.activo === false) {
      return new Response(JSON.stringify({ ok: true, skipped: 'config_inactiva' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const intervaloMin = config.intervalo_minutos ?? 3;
    const incrementoKm = config.incremento_km ?? 5;
    const topeKm = config.tope_maximo_km ?? 50;
    const expiracionExtraMin = config.expiracion_minutos_extra ?? 30;

    const { data: leads } = await supabase
      .from('express_leads')
      .select('*')
      .eq('estado', 'notificado')
      .is('agente_asignado_id', null);

    let expandidos = 0, expirados = 0, adminAvisos = 0, notificaciones = 0;

    async function notificarNuevosAgentes(lead: any) {
      const { data: agentes } = await supabase
        .rpc('express_agentes_pendientes_notificar', { p_lead_id: lead.id });
      for (const ag of (agentes || [])) {
        const distancia = ag.distancia_km != null ? Math.round(Number(ag.distancia_km)) : null;
        const ubicacionFrase = distancia != null
          ? ` a ~${distancia} km de ti`
          : (lead.direccion_manual ? ` (${lead.direccion_manual})` : '');
        await supabase.rpc('send_transactional_notification', {
          p_event_key: 'express_lead_nuevo',
          p_user_id: ag.usuario_id,
          p_variables: {
            tipo_seguro: lead.tipo_seguro_interes || 'seguro',
            ubicacion_frase: ubicacionFrase,
            distancia_km: distancia != null ? String(distancia) : '',
            url: '/mi-crm/leads-seguros-express',
          },
          p_link_url: '/mi-crm/leads-seguros-express',
        });
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              usuario_id: ag.usuario_id,
              title: 'Nuevo lead cerca · seguros.express',
              body: `Hay un lead de ${lead.tipo_seguro_interes || 'seguro'}${ubicacionFrase}. Tómalo para ver sus datos.`,
              url: '/mi-crm/leads-seguros-express',
              tag: `express-lead-${lead.id}`,
            }),
          });
        } catch (_e) { /* no-fatal */ }
        await supabase.from('express_lead_agentes_notificados').insert({
          lead_id: lead.id, usuario_id: ag.usuario_id, anillo_km: lead.anillo_km_actual,
        });
        notificaciones++;
      }
    }

    async function avisarAdmins(lead: any) {
      const { data: admins } = await supabase
        .from('usuarios').select('id').eq('rol', 'Administrador').eq('activo', true);
      for (const adm of (admins || [])) {
        await supabase.rpc('enviar_notificacion_individual', {
          p_user_id: adm.id,
          p_titulo: 'Lead seguros.express sin tomar',
          p_mensaje: `El lead de ${lead.tipo_seguro_interes || 'seguro'} (${lead.nombre}) llegó al tope sin que ningún agente lo tomara. Requiere atención manual.`,
          p_modulo: 'CRM',
          p_accion_url: '/admin/seguros-express',
          p_enviar_whatsapp: false,
        });
      }
      adminAvisos++;
    }

    for (const lead of (leads || [])) {
      const hasCoords = lead.lat != null && lead.lng != null;
      const elapsedMin = (nowMs - new Date(lead.ultima_expansion_at).getTime()) / 60000;
      let anillo = lead.anillo_km_actual;
      let topeAlcanzadoAt: string | null = lead.tope_alcanzado_at;
      let atTope = anillo >= topeKm;

      // 1) Expansión del anillo (sólo leads con coordenadas y con intervalo vencido).
      if (hasCoords && !atTope && elapsedMin >= intervaloMin) {
        anillo = Math.min(anillo + incrementoKm, topeKm);
        atTope = anillo >= topeKm;
        const patch: any = { anillo_km_actual: anillo, ultima_expansion_at: new Date().toISOString() };
        if (atTope && !topeAlcanzadoAt) { topeAlcanzadoAt = new Date().toISOString(); patch.tope_alcanzado_at = topeAlcanzadoAt; }
        await supabase.from('express_leads').update(patch).eq('id', lead.id);
        lead.anillo_km_actual = anillo;
        await notificarNuevosAgentes(lead);
        expandidos++;
      }

      // 2) Leads sin coordenadas: no hay anillo que expandir; anclar tiempo para admin/expiración.
      if (!hasCoords && !topeAlcanzadoAt) {
        topeAlcanzadoAt = new Date().toISOString();
        await supabase.from('express_leads').update({ tope_alcanzado_at: topeAlcanzadoAt }).eq('id', lead.id);
        // Reintentar notificar a habilitados que hayan aparecido desde la creación.
        await notificarNuevosAgentes(lead);
      }

      // 3) Al tope (o sin coordenadas): aviso único a Admin + expiración tras tiempo extra.
      if (atTope || !hasCoords) {
        if (!lead.admin_notificado_at) {
          await avisarAdmins(lead);
          await supabase.from('express_leads').update({ admin_notificado_at: new Date().toISOString() }).eq('id', lead.id);
        }
        const anchor = topeAlcanzadoAt ? new Date(topeAlcanzadoAt).getTime() : new Date(lead.ultima_expansion_at).getTime();
        if ((nowMs - anchor) / 60000 >= expiracionExtraMin) {
          await supabase.from('express_leads').update({ estado: 'expirado' }).eq('id', lead.id);
          expirados++;
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, procesados: (leads || []).length, expandidos, notificaciones, adminAvisos, expirados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('escalar-express-leads error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
