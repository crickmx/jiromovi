import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: userData } = await supabaseUser
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    if (userData?.rol !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Sin permisos para recalcular comisiones' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { batchId } = await req.json();

    if (!batchId) {
      return new Response(
        JSON.stringify({ error: 'No se proporcionó batchId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[recalculate] Starting recalculation for batch: ${batchId}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: config, error: configError } = await supabase
      .from('commission_import_config')
      .select('*')
      .eq('active', true)
      .maybeSingle();

    if (configError) {
      console.error('[recalculate] Error loading config:', configError);
    }

    const commissionConfig = config || {
      commission_bruta_source: 'rules_engine',
      commission_bruta_column_name: null,
      allow_prima_neta_as_commission_bruta: false,
      strict_validation: true
    };

    console.log('[recalculate] Config loaded:', JSON.stringify(commissionConfig));

    const { data: details, error: detailsError } = await supabase
      .from('commission_details')
      .select('*')
      .eq('batch_id', batchId);

    if (detailsError) {
      throw new Error(`Error al cargar detalles: ${detailsError.message}`);
    }

    if (!details || details.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No se encontraron detalles para este lote' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[recalculate] Found ${details.length} details to recalculate`);

    const { data: businessRules, error: rulesError } = await supabase
      .from('commission_business_rules')
      .select('*')
      .order('prioridad', { ascending: false });

    if (rulesError) {
      throw new Error(`Error al cargar reglas de negocio: ${rulesError.message}`);
    }

    console.log(`[recalculate] Business rules loaded: ${businessRules?.length || 0}`);

    const beforeStats = {
      total_items: details.length,
      with_commission_bruta: details.filter(d => d.commission_bruta !== null).length,
      null_commission_bruta: details.filter(d => d.commission_bruta === null).length,
      status_ok: details.filter(d => d.calculation_status === 'ok').length,
      status_error: details.filter(d => d.calculation_status === 'error').length,
      status_missing_base: details.filter(d => d.calculation_status === 'missing_base').length,
      status_missing_rules: details.filter(d => d.calculation_status === 'missing_rules').length,
      bruta_equals_prima: details.filter(d => d.commission_bruta === d.prima_neta).length,
    };

    console.log('[recalculate] Before stats:', JSON.stringify(beforeStats));

    const updatedDetails = [];
    const warnings = [];

    for (const detail of details) {
      // FÓRMULA ÚNICA: Comisión = Importe × (PorPart / 100)
      const importeBase = Number(detail.importe_base || 0);
      const porcentajeComision = Number(detail.porcentaje_comision || 0);
      const primaNeta = Number(detail.prima_neta || 0);

      let commissionBruta: number | null = null;
      let calculationStatus = 'ok';
      let calculationMethod = 'recalculated_fix';
      const calculationWarnings: any[] = [];

      // Validar que Importe exista
      if (!importeBase || importeBase === 0) {
        calculationStatus = 'missing_importe';
        calculationWarnings.push({
          code: 'MISSING_IMPORTE',
          message: 'importe_base faltante o en 0. No se puede calcular comisión.'
        });
        commissionBruta = 0;
        warnings.push({
          poliza: detail.poliza,
          message: `Póliza ${detail.poliza}: importe_base es 0`
        });
      }
      // Validar que PorPart exista
      else if (!porcentajeComision || porcentajeComision === 0) {
        calculationStatus = 'missing_porcentaje';
        calculationWarnings.push({
          code: 'MISSING_PORCENTAJE',
          message: 'porcentaje_comision faltante o en 0. No se puede calcular comisión.'
        });
        commissionBruta = 0;
        warnings.push({
          poliza: detail.poliza,
          message: `Póliza ${detail.poliza}: porcentaje_comision es 0`
        });
      }
      // Calcular con fórmula única
      else {
        commissionBruta = Math.round((importeBase * porcentajeComision) / 100 * 100) / 100;
        calculationStatus = 'ok';
        calculationMethod = 'recalculated_fix';
        console.log(`[recalculate] ✓ Póliza ${detail.poliza}: ${importeBase} × ${porcentajeComision}% = ${commissionBruta}`);
      }

      // Advertencia si Importe == PrimaNeta
      if (importeBase > 0 && primaNeta > 0 && Math.abs(importeBase - primaNeta) < 0.01) {
        calculationWarnings.push({
          code: 'IMPORTE_EQUALS_PRIMA',
          message: `ADVERTENCIA: importe_base (${importeBase}) es igual a prima_neta (${primaNeta})`
        });
      }

      const commissionNeta = commissionBruta || 0;

      updatedDetails.push({
        id: detail.id,
        commission_bruta: commissionBruta,
        commission_neta: commissionNeta,
        calculation_status: calculationStatus,
        calculation_method: calculationMethod,
        calculation_warnings: calculationWarnings,
      });
    }

    console.log(`[recalculate] Updating ${updatedDetails.length} details...`);

    for (const update of updatedDetails) {
      const { error: updateError } = await supabase
        .from('commission_details')
        .update({
          commission_bruta: update.commission_bruta,
          commission_neta: update.commission_neta,
          calculation_status: update.calculation_status,
          calculation_method: update.calculation_method,
          calculation_warnings: update.calculation_warnings,
        })
        .eq('id', update.id);

      if (updateError) {
        console.error(`[recalculate] Error updating detail ${update.id}:`, updateError);
      }
    }

    const { data: updatedDetailsData, error: updatedError } = await supabase
      .from('commission_details')
      .select('*')
      .eq('batch_id', batchId);

    if (updatedError) {
      console.error('[recalculate] Error fetching updated details:', updatedError);
    }

    const afterStats = updatedDetailsData ? {
      total_items: updatedDetailsData.length,
      with_commission_bruta: updatedDetailsData.filter(d => d.commission_bruta !== null).length,
      null_commission_bruta: updatedDetailsData.filter(d => d.commission_bruta === null).length,
      status_ok: updatedDetailsData.filter(d => d.calculation_status === 'ok').length,
      status_error: updatedDetailsData.filter(d => d.calculation_status === 'error').length,
      status_missing_base: updatedDetailsData.filter(d => d.calculation_status === 'missing_base').length,
      status_missing_rules: updatedDetailsData.filter(d => d.calculation_status === 'missing_rules').length,
      bruta_equals_prima: updatedDetailsData.filter(d => d.commission_bruta === d.prima_neta).length,
    } : beforeStats;

    console.log('[recalculate] After stats:', JSON.stringify(afterStats));

    const changesSummary = {
      commission_bruta_changed: updatedDetails.filter((u, i) => u.commission_bruta !== details[i].commission_bruta).length,
      status_changed: updatedDetails.filter((u, i) => u.calculation_status !== details[i].calculation_status).length,
      method_changed: updatedDetails.filter((u, i) => u.calculation_method !== details[i].calculation_method).length,
    };

    const { error: auditError } = await supabase
      .from('commission_recalculations')
      .insert({
        batch_id: batchId,
        recalculated_by: user.id,
        before_stats: beforeStats,
        after_stats: afterStats,
        changes_summary: changesSummary,
        warnings: warnings,
      });

    if (auditError) {
      console.error('[recalculate] Error inserting audit log:', auditError);
    }

    console.log('[recalculate] Recalculation complete!');

    return new Response(
      JSON.stringify({
        success: true,
        before_stats: beforeStats,
        after_stats: afterStats,
        changes_summary: changesSummary,
        warnings: warnings,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[recalculate] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al recalcular comisiones' }),
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
