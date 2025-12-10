import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExcelRow {
  FPago: string;
  EmailAgente?: string;
  Email?: string;
  Ramo: string;
  Aseguradora?: string;
  CiaAbreviacion?: string;
  PrimaNeta: number;
  PorPart: number;
  Poliza?: string;
  Documento?: string;
  Concepto?: string;
  [key: string]: any;
}

interface WeekSummary {
  weekNumber: number;
  dateFrom: string;
  dateTo: string;
  count: number;
  selected: boolean;
}

interface CommissionAgent {
  id: string;
  name: string;
  email: string;
  office_id: string | null;
  fiscal_regime: {
    iva_trasladado: number;
    iva_retenido: number;
    isr: number;
    otros_json: any;
  } | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { rows, selectedWeeks, uploadedByUserId, sourceFile } = await req.json();

    console.log('[process-commissions] Received rows:', rows?.length || 0);
    console.log('[process-commissions] Selected weeks:', selectedWeeks?.length || 0);
    console.log('[process-commissions] Uploaded by:', uploadedByUserId);
    console.log('[process-commissions] Source file:', sourceFile);

    const { data: agents, error: agentsError } = await supabase
      .from('commission_agents')
      .select(`
        id,
        name,
        email,
        office_id,
        fiscal_regime:commission_fiscal_regimes(
          iva_trasladado,
          iva_retenido,
          isr,
          otros_json
        )
      `);

    if (agentsError) {
      console.error('[process-commissions] Error loading agents:', agentsError);
      throw new Error('No se pudieron cargar los agentes de comisiones');
    }

    if (!agents || agents.length === 0) {
      throw new Error('No hay agentes registrados en el sistema de comisiones');
    }

    console.log('[process-commissions] Commission agents loaded:', agents.length);

    const agentsMap = new Map<string, CommissionAgent>();
    agents.forEach(agent => {
      if (agent.email) {
        agentsMap.set(agent.email.toLowerCase(), {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          office_id: agent.office_id,
          fiscal_regime: Array.isArray(agent.fiscal_regime) && agent.fiscal_regime.length > 0
            ? agent.fiscal_regime[0]
            : null
        });
      }
    });

    const filteredRows = selectedWeeks && selectedWeeks.length > 0
      ? rows.filter((row: ExcelRow) => {
          const rowDate = new Date(row.FPago);
          const match = selectedWeeks.some((week: WeekSummary) => {
            const weekStart = new Date(week.dateFrom);
            const weekEnd = new Date(week.dateTo);
            return rowDate >= weekStart && rowDate <= weekEnd;
          });
          return match;
        })
      : rows;

    console.log('[process-commissions] Filtered rows:', filteredRows?.length || 0);

    const batchesMap = new Map<string, ExcelRow[]>();
    filteredRows.forEach((row: ExcelRow) => {
      const weekKey = getWeekKey(new Date(row.FPago));
      if (!batchesMap.has(weekKey)) {
        batchesMap.set(weekKey, []);
      }
      batchesMap.get(weekKey)!.push(row);
    });

    console.log('[process-commissions] Batches to create:', batchesMap.size);
    console.log('[process-commissions] Week keys:', Array.from(batchesMap.keys()));

    const batchesCreated: any[] = [];
    const allErrors: any[] = [];

    for (const [weekKey, weekRows] of batchesMap.entries()) {
      const firstRow = weekRows[0];
      const weekDate = new Date(firstRow.FPago);
      const weekNumber = getWeekNumber(weekDate);
      const year = weekDate.getFullYear();

      const { data: batch, error: batchError } = await supabase
        .from('commission_batches')
        .insert({
          week_number: weekNumber,
          year: year,
          uploaded_by_user_id: uploadedByUserId,
          source_file: sourceFile
        })
        .select()
        .maybeSingle();

      if (batchError || !batch) {
        console.error('Error creating batch:', batchError);
        allErrors.push({
          error_type: 'batch_creation_failed',
          detalle: `No se pudo crear el lote para la semana ${weekNumber}: ${batchError?.message || 'Error desconocido'}`
        });
        continue;
      }

      console.log(`[process-commissions] Batch created for week ${weekNumber}, batch ID: ${batch.id}`);

      batchesCreated.push(batch);

      const detailsToInsert: any[] = [];
      const errorsToInsert: any[] = [];

      for (const row of weekRows) {
        try {
          const emailAgente = (row.EmailAgente || row.Email || '').toLowerCase();
          const agent = agentsMap.get(emailAgente);

          if (!agent) {
            errorsToInsert.push({
              batch_id: batch.id,
              error_type: 'agent_not_found',
              email_agente: row.EmailAgente || row.Email,
              poliza: row.Poliza || row.Documento,
              detalle: `Agente no encontrado: ${row.EmailAgente || row.Email}`,
              raw_row: row
            });
            continue;
          }

          if (row.PorPart === undefined || row.PorPart === null) {
            errorsToInsert.push({
              batch_id: batch.id,
              error_type: 'invalid_data',
              email_agente: row.EmailAgente || row.Email,
              poliza: row.Poliza || row.Documento,
              detalle: 'La columna PorPart es requerida y no puede estar vacía',
              raw_row: row
            });
            continue;
          }

          const commissionBruta = calculateCommissionBruta(row.PrimaNeta, row.PorPart);

          const impuestos = agent.fiscal_regime
            ? calculateImpuestos(commissionBruta, agent.fiscal_regime)
            : { iva_trasladado: 0, iva_retenido: 0, isr: 0, otros: 0 };

          const commissionNeta = calculateCommissionNeta(commissionBruta, impuestos);

          detailsToInsert.push({
            batch_id: batch.id,
            agent_id: agent.id,
            ramo: row.Ramo,
            aseguradora: row.Aseguradora || row.CiaAbreviacion,
            office_id: agent.office_id,
            poliza: row.Poliza || row.Documento,
            prima_base: row.PrimaNeta,
            concepto: row.Concepto || null,
            date_fpago: row.FPago,
            commission_bruta: commissionBruta,
            impuestos_json: impuestos,
            commission_neta: commissionNeta,
            is_manual_adjusted: false,
            raw_row: row
          });

        } catch (error: any) {
          errorsToInsert.push({
            batch_id: batch.id,
            error_type: 'other',
            email_agente: row.EmailAgente || row.Email,
            poliza: row.Poliza || row.Documento,
            detalle: error.message || 'Error desconocido',
            raw_row: row
          });
        }
      }

      if (detailsToInsert.length > 0) {
        const { error: detailsError } = await supabase
          .from('commission_details')
          .insert(detailsToInsert);

        if (detailsError) {
          console.error('Error inserting details:', detailsError);
        }
      }

      if (errorsToInsert.length > 0) {
        const { error: errorsError } = await supabase
          .from('commission_errors')
          .insert(errorsToInsert);

        if (errorsError) {
          console.error('Error inserting errors:', errorsError);
        }

        allErrors.push(...errorsToInsert);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        batchesCreated,
        totalErrors: allErrors.length
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('Error in process-commissions:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error desconocido' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

function calculateCommissionBruta(primaNeta: number, porPart: number): number {
  return primaNeta * (porPart / 100);
}

function calculateImpuestos(commissionBruta: number, regimenFiscal: any) {
  const iva_trasladado = commissionBruta * (regimenFiscal.iva_trasladado || 0);
  const iva_retenido = commissionBruta * (regimenFiscal.iva_retenido || 0);
  const isr = commissionBruta * (regimenFiscal.isr || 0);

  let otros = 0;
  if (regimenFiscal.otros_json) {
    Object.values(regimenFiscal.otros_json).forEach((rate: any) => {
      if (typeof rate === 'number') {
        otros += commissionBruta * rate;
      }
    });
  }

  return {
    iva_trasladado,
    iva_retenido,
    isr,
    otros
  };
}

function calculateCommissionNeta(commissionBruta: number, impuestos: any): number {
  return commissionBruta + impuestos.iva_trasladado - impuestos.iva_retenido - impuestos.isr - impuestos.otros;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}