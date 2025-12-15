import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No autorizado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error('No autorizado');
    }

    const { data: userData } = await supabaseUser
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    if (userData?.rol !== 'Administrador') {
      throw new Error('Solo administradores pueden crear lotes');
    }

    const { stagingSessionId } = await req.json();

    if (!stagingSessionId) {
      throw new Error('stagingSessionId es requerido');
    }

    console.log('[create-weekly-batches] Creating batches for session:', stagingSessionId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: session, error: sessionError } = await supabase
      .from('commission_staging_sessions')
      .select('*')
      .eq('id', stagingSessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(`Sesión no encontrada: ${sessionError?.message || 'null'}`);
    }

    if (session.status === 'batches_created') {
      throw new Error('Esta sesión ya tiene lotes creados');
    }

    const { data: items, error: itemsError } = await supabase
      .from('commission_items_staging')
      .select('*')
      .eq('staging_session_id', stagingSessionId)
      .order('date_fpago', { ascending: true });

    if (itemsError) {
      throw new Error(`Error al cargar items: ${itemsError.message}`);
    }

    if (!items || items.length === 0) {
      throw new Error('No hay items para procesar');
    }

    console.log('[create-weekly-batches] Found', items.length, 'items to process');

    const weekMap = new Map<string, any[]>();

    for (const item of items) {
      if (!item.week_year || !item.week_number) {
        console.warn('[create-weekly-batches] Item without week info, skipping:', item.id);
        continue;
      }

      const weekKey = `${item.week_year}-W${String(item.week_number).padStart(2, '0')}`;

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }

      weekMap.get(weekKey)!.push(item);
    }

    console.log('[create-weekly-batches] Grouped into', weekMap.size, 'weeks');

    const batchesCreated: any[] = [];
    const batchIds: string[] = [];

    for (const [weekKey, weekItems] of weekMap.entries()) {
      const firstItem = weekItems[0];
      const weekYear = firstItem.week_year;
      const weekNumber = firstItem.week_number;
      const weekStartDate = firstItem.week_start_date;
      const weekEndDate = firstItem.week_end_date;

      const batchName = `Semana ${weekNumber} - ${weekYear}`;

      console.log(`[create-weekly-batches] Creating batch: ${batchName}`);

      const { data: batch, error: batchError } = await supabase
        .from('commission_batches')
        .insert({
          name: batchName,
          date_from: weekStartDate,
          date_to: weekEndDate,
          uploaded_by: user.id,
          source_file: session.file_name,
          status: 'draft',
        })
        .select()
        .single();

      if (batchError || !batch) {
        throw new Error(`Error al crear lote ${batchName}: ${batchError?.message || 'null'}`);
      }

      console.log(`[create-weekly-batches] Batch created:`, batch.id);

      const { data: businessRules } = await supabase
        .from('commission_business_rules')
        .select('*')
        .order('prioridad', { ascending: false });

      const detailsToInsert: any[] = [];

      for (const item of weekItems) {
        let commissionBruta: number | null = null;
        let commissionNeta: number | null = null;
        let calculationStatus = 'ok';
        let calculationMethod = 'rules_engine';
        const calculationWarnings: any[] = [];

        const matchingRule = findBusinessRule(
          businessRules || [],
          item.ramo,
          item.aseguradora,
          null
        );

        if (matchingRule) {
          const importeBase = item.prima_neta;
          const porcentajeComision = item.porcentaje_base || matchingRule.valor_calculo || 0;
          commissionBruta = (importeBase * porcentajeComision) / 100;
          commissionNeta = commissionBruta;
        } else {
          calculationStatus = 'missing_rules';
          calculationWarnings.push({
            code: 'NO_MATCHING_RULE',
            message: `No se encontró regla para ramo=${item.ramo}, aseguradora=${item.aseguradora}`,
          });
        }

        detailsToInsert.push({
          batch_id: batch.id,
          agent_id: item.movi_user_id,
          poliza: item.poliza,
          ramo: item.ramo,
          aseguradora: item.aseguradora,
          prima_neta: item.prima_neta,
          date_fpago: item.date_fpago,
          porcentaje_base: item.porcentaje_base,
          porcentaje_comision: item.porcentaje_base,
          importe_base: item.prima_neta,
          commission_bruta: commissionBruta,
          commission_neta: commissionNeta,
          impuestos_json: {},
          concepto: item.concepto,
          nombre_asegurado: item.nombre_asegurado,
          vendor_email_raw: item.vendor_email_raw,
          vendor_name_raw: item.vendor_name_raw,
          vendor_key: item.vendor_key,
          match_method: item.match_method,
          is_unmatched: item.pending_assignment,
          pending_assignment: item.pending_assignment,
          calculation_status: calculationStatus,
          calculation_method: calculationMethod,
          calculation_warnings: calculationWarnings,
          raw_row: item.raw_row,
        });
      }

      if (detailsToInsert.length > 0) {
        const { data: insertedDetails, error: detailsError } = await supabase
          .from('commission_details')
          .insert(detailsToInsert)
          .select('id');

        if (detailsError) {
          throw new Error(`Error al insertar detalles en lote ${batchName}: ${detailsError.message}`);
        }

        console.log(`[create-weekly-batches] Inserted`, detailsToInsert.length, 'details into batch', batch.id);

        for (let i = 0; i < weekItems.length; i++) {
          const item = weekItems[i];
          const detailId = insertedDetails?.[i]?.id;

          await supabase
            .from('commission_items_staging')
            .update({
              batch_id: batch.id,
              commission_detail_id: detailId,
              converted_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        }
      }

      batchesCreated.push({
        id: batch.id,
        name: batch.name,
        week_number: weekNumber,
        week_year: weekYear,
        date_from: weekStartDate,
        date_to: weekEndDate,
        items_count: weekItems.length,
        pending_assignment_count: weekItems.filter(i => i.pending_assignment).length,
      });

      batchIds.push(batch.id);
    }

    await supabase
      .from('commission_staging_sessions')
      .update({
        status: 'batches_created',
        batches_created: batchIds,
        batches_created_at: new Date().toISOString(),
      })
      .eq('id', stagingSessionId);

    console.log('[create-weekly-batches] Complete! Created', batchesCreated.length, 'batches');

    return new Response(
      JSON.stringify({
        success: true,
        batchesCreated,
        summary: {
          total_batches: batchesCreated.length,
          total_items: items.length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[create-weekly-batches] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function findBusinessRule(
  rules: any[],
  ramo: string,
  aseguradora: string,
  officeId: string | null
): any | null {
  const matchingRules = rules.filter(rule => {
    const ramoMatch = rule.ramo.toLowerCase() === ramo.toLowerCase();
    const asegMatch = rule.aseguradora.toLowerCase() === aseguradora.toLowerCase();
    const officeMatch = !rule.office_id || rule.office_id === officeId;
    return ramoMatch && asegMatch && officeMatch;
  });

  if (matchingRules.length === 0) {
    return null;
  }

  matchingRules.sort((a, b) => b.prioridad - a.prioridad);
  return matchingRules[0];
}
