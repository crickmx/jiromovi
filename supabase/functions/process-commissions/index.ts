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
  PortPart?: number;
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

interface Agent {
  id: string;
  name: string;
  email: string;
  office_id: string | null;
  fiscal_regime_id: string | null;
  office?: { id: string; name: string };
  fiscal_regime?: {
    id: string;
    name: string;
    iva_trasladado: number;
    iva_retenido: number;
    isr: number;
    otros_json: Record<string, number>;
  };
}

interface BusinessRule {
  id: string;
  ramo: string;
  aseguradora: string;
  office_id: string | null;
  campo_base: string;
  tipo_calculo: '%_sobre_base' | 'monto_fijo' | '%_con_min_max' | 'usar_portpart';
  porcentaje: number | null;
  monto_fijo: number | null;
  minimo: number | null;
  maximo: number | null;
  prioridad: number;
  valid_from: string;
  valid_to: string | null;
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
    console.log('[process-commissions] Selected weeks:', selectedWeeks?.length || 0, selectedWeeks);
    console.log('[process-commissions] Uploaded by:', uploadedByUserId);
    console.log('[process-commissions] Source file:', sourceFile);

    const { data: agents } = await supabase
      .from('commission_agents')
      .select('*, office:office_id(*), fiscal_regime:fiscal_regime_id(*)');

    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email_personal, email_laboral, oficina_id, rol')
      .eq('rol', 'Agente');

    const { data: businessRules } = await supabase
      .from('commission_business_rules')
      .select('*')
      .order('prioridad', { ascending: false });

    if (!agents || !businessRules) {
      throw new Error('No se pudieron cargar los datos necesarios');
    }

    console.log('[process-commissions] Agents loaded:', agents.length);
    console.log('[process-commissions] Usuarios (Agentes) loaded:', usuarios?.length || 0);

    const agentsMap = new Map<string, Agent>();
    agents.forEach(agent => {
      agentsMap.set(agent.email.toLowerCase(), agent);
    });

    if (usuarios) {
      usuarios.forEach(user => {
        const emailPersonal = user.email_personal?.toLowerCase();
        const emailLaboral = user.email_laboral?.toLowerCase();

        if (emailPersonal && !agentsMap.has(emailPersonal)) {
          agentsMap.set(emailPersonal, {
            id: user.id,
            name: user.nombre_completo,
            email: user.email_personal,
            office_id: user.oficina_id,
            fiscal_regime_id: null
          });
        }

        if (emailLaboral && !agentsMap.has(emailLaboral)) {
          agentsMap.set(emailLaboral, {
            id: user.id,
            name: user.nombre_completo,
            email: user.email_laboral,
            office_id: user.oficina_id,
            fiscal_regime_id: null
          });
        }
      });
    }

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
        .single();

      if (batchError || !batch) {
        console.error('Error creating batch:', batchError);
        continue;
      }

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
              email_agente: row.EmailAgente,
              poliza: row.Poliza,
              detalle: `Agente no encontrado: ${row.EmailAgente}. Email: ${row.EmailAgente}`,
              raw_row: row
            });
            continue;
          }

          const matchingRule = findBusinessRule(
            businessRules,
            row.Ramo,
            row.Aseguradora,
            agent.office_id
          );

          if (!matchingRule) {
            errorsToInsert.push({
              batch_id: batch.id,
              error_type: 'rule_not_found',
              email_agente: row.EmailAgente,
              poliza: row.Poliza,
              detalle: `No se encontró regla para Ramo: ${row.Ramo}, Aseguradora: ${row.Aseguradora}`,
              raw_row: row
            });
            continue;
          }

          if (!agent.fiscal_regime) {
            errorsToInsert.push({
              batch_id: batch.id,
              error_type: 'invalid_data',
              email_agente: row.EmailAgente,
              poliza: row.Poliza,
              detalle: 'El agente no tiene régimen fiscal asignado',
              raw_row: row
            });
            continue;
          }

          const commissionBruta = calculateCommissionBruta(row, matchingRule);
          const impuestos = calculateImpuestos(commissionBruta, agent.fiscal_regime);
          const commissionNeta = calculateCommissionNeta(commissionBruta, impuestos);

          detailsToInsert.push({
            batch_id: batch.id,
            agent_id: agent.id,
            ramo: row.Ramo,
            aseguradora: row.Aseguradora,
            office_id: agent.office_id,
            poliza: row.Poliza,
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
            email_agente: row.EmailAgente,
            poliza: row.Poliza,
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

function findBusinessRule(
  rules: BusinessRule[],
  ramo: string,
  aseguradora: string,
  officeId: string | null
): BusinessRule | null {
  const matchingRules = rules.filter(rule => {
    const ramoMatch = rule.ramo.toLowerCase() === ramo.toLowerCase();
    const asegMatch = rule.aseguradora.toLowerCase() === aseguradora.toLowerCase();
    const officeMatch = !rule.office_id || rule.office_id === officeId;

    const now = new Date();
    const validFrom = new Date(rule.valid_from);
    const validTo = rule.valid_to ? new Date(rule.valid_to) : null;
    const dateValid = now >= validFrom && (!validTo || now <= validTo);

    return ramoMatch && asegMatch && officeMatch && dateValid;
  });

  if (matchingRules.length === 0) return null;

  return matchingRules.sort((a, b) => b.prioridad - a.prioridad)[0];
}

function calculateCommissionBruta(row: ExcelRow, rule: BusinessRule): number {
  if (rule.tipo_calculo === 'usar_portpart' && row.PortPart !== undefined && row.PortPart !== null) {
    return row.PortPart;
  }

  const primaBase = row.PrimaNeta || 0;

  switch (rule.tipo_calculo) {
    case '%_sobre_base':
      return primaBase * (rule.porcentaje || 0) / 100;

    case 'monto_fijo':
      return rule.monto_fijo || 0;

    case '%_con_min_max': {
      let commission = primaBase * (rule.porcentaje || 0) / 100;
      if (rule.minimo !== null && commission < rule.minimo) {
        commission = rule.minimo;
      }
      if (rule.maximo !== null && commission > rule.maximo) {
        commission = rule.maximo;
      }
      return commission;
    }

    case 'usar_portpart':
      return row.PortPart || 0;

    default:
      return 0;
  }
}

function calculateImpuestos(commissionBruta: number, fiscalRegime: any) {
  const iva_trasladado = commissionBruta * fiscalRegime.iva_trasladado;
  const iva_retenido = commissionBruta * fiscalRegime.iva_retenido;
  const isr = commissionBruta * fiscalRegime.isr;

  let otros = 0;
  if (fiscalRegime.otros_json) {
    Object.values(fiscalRegime.otros_json).forEach((rate: any) => {
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