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
  Importe?: number;
  PrimaNeta?: number;
  PorPart: number;
  Poliza?: string;
  Documento?: string;
  Concepto?: string;
  NombreCompleto?: string;
  NombreAsegurado?: string;
  Asegurado?: string;
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
    console.log('[process-commissions] Starting commission processing...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[process-commissions] Reading request body...');
    const { rows, selectedWeeks, uploadedByUserId, sourceFile } = await req.json();

    console.log('[process-commissions] Received rows:', rows?.length || 0);
    console.log('[process-commissions] Selected weeks:', selectedWeeks?.length || 0);
    console.log('[process-commissions] Uploaded by:', uploadedByUserId);
    console.log('[process-commissions] Source file:', sourceFile);

    if (!rows || rows.length === 0) {
      throw new Error('No se recibieron filas para procesar');
    }

    if (!uploadedByUserId) {
      throw new Error('No se especificó el usuario que sube el archivo');
    }

    console.log('[process-commissions] Loading commission agents...');
    const { data: agents, error: agentsError } = await supabase
      .from('commission_agents')
      .select('id, name, email, office_id, fiscal_regime_id');

    if (agentsError) {
      console.error('[process-commissions] Error loading agents:', agentsError);
      console.error('[process-commissions] Error details:', JSON.stringify(agentsError));
      throw new Error(`No se pudieron cargar los agentes de comisiones: ${agentsError.message}`);
    }

    console.log('[process-commissions] Agents query result:', agents);

    if (!agents || agents.length === 0) {
      console.error('[process-commissions] NO AGENTS FOUND IN DATABASE!');
      throw new Error('No hay agentes registrados en el sistema de comisiones. Por favor, registra agentes primero en Comisiones > Lote.');
    }

    console.log('[process-commissions] Commission agents loaded:', agents.length);
    console.log('[process-commissions] Agent emails:', agents.map(a => a.email).join(', '));

    console.log('[process-commissions] Loading fiscal regimes...');
    const { data: fiscalRegimes, error: regimesError } = await supabase
      .from('commission_fiscal_regimes')
      .select('id, iva_trasladado, iva_retenido, isr, otros_json');

    if (regimesError) {
      console.error('[process-commissions] Error loading fiscal regimes:', regimesError);
    }

    const regimesMap = new Map();
    if (fiscalRegimes) {
      fiscalRegimes.forEach(regime => {
        regimesMap.set(regime.id, {
          iva_trasladado: regime.iva_trasladado,
          iva_retenido: regime.iva_retenido,
          isr: regime.isr,
          otros_json: regime.otros_json
        });
      });
    }
    console.log('[process-commissions] Fiscal regimes loaded:', regimesMap.size);

    const agentsMap = new Map<string, CommissionAgent>();
    agents.forEach(agent => {
      if (agent.email) {
        const fiscalRegime = agent.fiscal_regime_id ? regimesMap.get(agent.fiscal_regime_id) : null;
        agentsMap.set(agent.email.toLowerCase(), {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          office_id: agent.office_id,
          fiscal_regime: fiscalRegime || null
        });
      }
    });

    console.log('[process-commissions] Filtering rows by selected weeks...');
    const filteredRows = selectedWeeks && selectedWeeks.length > 0
      ? rows.filter((row: ExcelRow) => {
          const [y, m, d] = row.FPago.split('-').map(Number);
          const rowDate = new Date(y, m - 1, d);
          const match = selectedWeeks.some((week: WeekSummary) => {
            const [wy1, wm1, wd1] = week.dateFrom.split('-').map(Number);
            const [wy2, wm2, wd2] = week.dateTo.split('-').map(Number);
            const weekStart = new Date(wy1, wm1 - 1, wd1);
            const weekEnd = new Date(wy2, wm2 - 1, wd2);
            return rowDate >= weekStart && rowDate <= weekEnd;
          });
          if (!match) {
            console.log('[process-commissions] Row filtered out:', row.FPago, 'Email:', row.EmailAgente || row.Email);
          }
          return match;
        })
      : rows;

    console.log('[process-commissions] Filtered rows:', filteredRows?.length || 0);

    if (filteredRows.length === 0) {
      throw new Error('No hay filas que coincidan con las semanas seleccionadas');
    }

    const batchesMap = new Map<string, ExcelRow[]>();
    filteredRows.forEach((row: ExcelRow) => {
      const [y, m, d] = row.FPago.split('-').map(Number);
      const rowDate = new Date(y, m - 1, d);
      const weekKey = getWeekKey(rowDate);
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
      console.log(`[process-commissions] Processing batch for week key: ${weekKey}`);

      const firstRow = weekRows[0];
      const [year, month, day] = firstRow.FPago.split('-').map(Number);
      const weekDate = new Date(year, month - 1, day);
      const weekNumber = getWeekNumber(weekDate);

      const dateFrom = getWeekStart(weekDate);
      const dateTo = getWeekEnd(weekDate);
      const batchName = `Semana ${weekNumber} - ${weekDate.getFullYear()}`;

      console.log(`[process-commissions] Creating batch: week=${weekNumber}, year=${weekDate.getFullYear()}, rows=${weekRows.length}`);
      console.log(`[process-commissions] Date range: ${dateFrom} to ${dateTo}`);

      const { data: batch, error: batchError } = await supabase
        .from('commission_batches')
        .insert({
          name: batchName,
          date_from: dateFrom,
          date_to: dateTo,
          uploaded_by: uploadedByUserId,
          source_file: sourceFile,
          status: 'draft'
        })
        .select()
        .maybeSingle();

      if (batchError) {
        console.error(`[process-commissions] Error creating batch for week ${weekKey}:`, batchError);
        console.error('[process-commissions] Error details:', JSON.stringify(batchError));
        throw new Error(`Error al crear el lote: ${batchError.message}`);
      }

      if (!batch) {
        console.error('[process-commissions] Batch was not created (null result)');
        throw new Error('El lote no se pudo crear');
      }

      console.log(`[process-commissions] Batch created: ID=${batch.id}, name=${batch.name}`);

      const { data: businessRules, error: rulesError } = await supabase
        .from('commission_business_rules')
        .select('*')
        .order('prioridad', { ascending: false });

      if (rulesError) {
        console.error('[process-commissions] Error loading business rules:', rulesError);
        throw new Error(`Error al cargar reglas de negocio: ${rulesError.message}`);
      }

      console.log(`[process-commissions] Business rules loaded: ${businessRules?.length || 0}`);

      const detailsToInsert: any[] = [];
      const errorsToInsert: any[] = [];

      for (const row of weekRows) {
        const email = (row.EmailAgente || row.Email || '').toLowerCase().trim();
        const agent = agentsMap.get(email);

        if (!agent) {
          console.warn(`[process-commissions] Agent not found for email: ${email}`);
          errorsToInsert.push({
            batch_id: batch.id,
            fila_excel: JSON.stringify(row),
            error_type: 'agent_not_found',
            detalle: `No se encontró el agente con email: ${email}`,
            email_agente: email || null,
            poliza: row.Poliza || row.Documento || null,
            resolved: false
          });
          continue;
        }

        const ramo = row.Ramo;
        const aseguradora = row.Aseguradora || row.CiaAbreviacion || '';
        const primaNeta = Number(row.PrimaNeta || row.Importe || 0);
        const porcentajeBase = Number(row.PorPart || 0);

        const matchingRule = findBusinessRule(businessRules || [], ramo, aseguradora, agent.office_id);

        let porcentajeComision = porcentajeBase;
        let tipoCalculo = 'directo';
        let importeBase = primaNeta;
        let ruleApplied = null;

        if (matchingRule) {
          tipoCalculo = matchingRule.tipo_calculo;
          ruleApplied = matchingRule.id;

          if (tipoCalculo === 'porcentaje_fijo') {
            porcentajeComision = matchingRule.valor_calculo;
            importeBase = primaNeta;
          } else if (tipoCalculo === 'escalas') {
            const escalasConfig = matchingRule.escalas_config || [];
            let escalaMatch = null;
            for (const escala of escalasConfig) {
              if (primaNeta >= escala.desde && primaNeta <= escala.hasta) {
                escalaMatch = escala;
                break;
              }
            }
            if (escalaMatch) {
              porcentajeComision = escalaMatch.porcentaje;
              importeBase = primaNeta;
            }
          } else if (tipoCalculo === 'multiplicador') {
            importeBase = primaNeta * matchingRule.valor_calculo;
            porcentajeComision = porcentajeBase;
          } else {
            importeBase = primaNeta;
            porcentajeComision = porcentajeBase;
          }
        }

        const commission = (importeBase * porcentajeComision) / 100;

        detailsToInsert.push({
          batch_id: batch.id,
          agent_id: agent.id,
          poliza: row.Poliza || row.Documento || '',
          ramo,
          aseguradora,
          prima_neta: primaNeta,
          porcentaje_base: porcentajeBase,
          porcentaje_comision: porcentajeComision,
          commission_bruta: commission,
          commission_neta: commission,
          business_rule_id: ruleApplied,
          tipo_calculo: tipoCalculo,
          importe_base: importeBase,
          concepto: row.Concepto || '',
          nombre_asegurado: row.NombreCompleto || row.NombreAsegurado || row.Asegurado || ''
        });
      }

      if (detailsToInsert.length > 0) {
        console.log(`[process-commissions] Inserting ${detailsToInsert.length} commission details...`);
        const { error: detailsError } = await supabase
          .from('commission_details')
          .insert(detailsToInsert);

        if (detailsError) {
          console.error('[process-commissions] Error inserting commission details:', detailsError);
          console.error('[process-commissions] Error details:', JSON.stringify(detailsError));
          throw new Error(`Error al insertar detalles de comisiones: ${detailsError.message}`);
        }
        console.log(`[process-commissions] Successfully inserted ${detailsToInsert.length} commission details`);
      }

      if (errorsToInsert.length > 0) {
        console.log(`[process-commissions] Inserting ${errorsToInsert.length} error records...`);
        const { error: errorsError } = await supabase
          .from('commission_errors')
          .insert(errorsToInsert);

        if (errorsError) {
          console.error('[process-commissions] Error inserting errors:', errorsError);
          console.error('[process-commissions] Error details:', JSON.stringify(errorsError));
        } else {
          console.log(`[process-commissions] Successfully inserted ${errorsToInsert.length} error records`);
        }

        allErrors.push(...errorsToInsert);
      }

      batchesCreated.push({
        id: batch.id,
        name: batch.name,
        details_count: detailsToInsert.length,
        errors_count: errorsToInsert.length
      });
    }

    console.log('[process-commissions] Processing complete!');
    console.log(`[process-commissions] Batches created: ${batchesCreated.length}`);
    console.log(`[process-commissions] Total errors: ${allErrors.length}`);

    if (batchesCreated.length === 0) {
      console.error('[process-commissions] NO BATCHES WERE CREATED!');
      if (allErrors.length > 0) {
        console.error('[process-commissions] Errors that prevented batch creation:', JSON.stringify(allErrors, null, 2));
        throw new Error(`No se crearon lotes. Errores: ${allErrors.map(e => e.detalle).join('; ')}`);
      } else {
        throw new Error('No se crearon lotes y no se registraron errores. Verifica los datos del archivo.');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        batchesCreated,
        totalErrors: allErrors.length,
        errorDetails: allErrors.length > 0 ? allErrors.slice(0, 10) : []
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('[process-commissions] FATAL ERROR:', error);
    console.error('[process-commissions] Error stack:', error.stack);
    console.error('[process-commissions] Error name:', error.name);
    console.error('[process-commissions] Error message:', error.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido al procesar comisiones',
        errorType: error.name || 'UnknownError'
      }),
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

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getWeekEnd(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7);
  const sunday = new Date(d.setDate(diff));
  return sunday.toISOString().split('T')[0];
}

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