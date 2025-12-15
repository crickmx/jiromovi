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
  ComisionBruta?: number;
  ComisionNeta?: number;
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

interface CommissionConfig {
  commission_bruta_source: string;
  commission_bruta_column_name: string | null;
  allow_prima_neta_as_commission_bruta: boolean;
  strict_validation: boolean;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || email.trim() === '') return null;
  return email.trim().toLowerCase();
}

function normalizeName(name: string | null | undefined): string | null {
  if (!name || name.trim() === '') return null;

  let normalized = name.trim().toLowerCase();

  const accentMap: { [key: string]: string } = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U', 'Ñ': 'N'
  };

  normalized = normalized.split('').map(char => accentMap[char] || char).join('');
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

function calculateVendorKey(vendorEmail: string | null | undefined, vendorName: string | null | undefined): string {
  const normalizedEmail = normalizeEmail(vendorEmail);
  const normalizedName = normalizeName(vendorName);

  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  return 'unknown';
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

    if (!rows || rows.length === 0) {
      throw new Error('No se recibieron filas para procesar');
    }

    if (!uploadedByUserId) {
      throw new Error('No se especificó el usuario que sube el archivo');
    }

    console.log('[process-commissions] Loading commission config...');
    const { data: config, error: configError } = await supabase
      .from('commission_import_config')
      .select('*')
      .eq('active', true)
      .maybeSingle();

    if (configError) {
      console.error('[process-commissions] Error loading config:', configError);
    }

    const commissionConfig: CommissionConfig = config || {
      commission_bruta_source: 'rules_engine',
      commission_bruta_column_name: null,
      allow_prima_neta_as_commission_bruta: false,
      strict_validation: true
    };

    console.log('[process-commissions] Config loaded:', JSON.stringify(commissionConfig));

    console.log('[process-commissions] Loading commission agents...');
    const { data: agents, error: agentsError } = await supabase
      .from('commission_agents')
      .select('id, name, email, office_id, fiscal_regime_id');

    if (agentsError) {
      throw new Error(`No se pudieron cargar los agentes de comisiones: ${agentsError.message}`);
    }

    if (!agents || agents.length === 0) {
      throw new Error('No hay agentes registrados en el sistema de comisiones.');
    }

    console.log('[process-commissions] Commission agents loaded:', agents.length);

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

    console.log('[process-commissions] Loading vendor mappings...');
    const { data: vendorMappings, error: mappingsError } = await supabase
      .from('vendor_mappings')
      .select('source_type, source_value, movi_user_id')
      .eq('status', 'active');

    if (mappingsError) {
      console.error('[process-commissions] Error loading vendor mappings:', mappingsError);
    }

    const mappingsMap = new Map<string, string>();
    if (vendorMappings) {
      vendorMappings.forEach(mapping => {
        const key = `${mapping.source_type}:${mapping.source_value}`;
        mappingsMap.set(key, mapping.movi_user_id);
      });
    }

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

      if (batchError || !batch) {
        throw new Error(`Error al crear el lote: ${batchError?.message || 'batch null'}`);
      }

      console.log(`[process-commissions] Batch created: ID=${batch.id}`);

      const { data: businessRules, error: rulesError } = await supabase
        .from('commission_business_rules')
        .select('*')
        .order('prioridad', { ascending: false });

      if (rulesError) {
        throw new Error(`Error al cargar reglas de negocio: ${rulesError.message}`);
      }

      console.log(`[process-commissions] Business rules loaded: ${businessRules?.length || 0}`);

      const detailsToInsert: any[] = [];
      const errorsToInsert: any[] = [];

      for (const row of weekRows) {
        const vendorEmail = row.EmailAgente || row.Email || '';
        const vendorName = row.NombreAgente || row.NombreVendedor || '';
        const vendorKey = calculateVendorKey(vendorEmail, vendorName);

        let agent: CommissionAgent | undefined;
        let matchMethod: string = 'none';
        let agentId: string | null = null;

        const normalizedEmail = normalizeEmail(vendorEmail);
        if (normalizedEmail) {
          agent = agentsMap.get(normalizedEmail);
          if (agent) {
            matchMethod = 'direct_email';
            agentId = agent.id;
          }
        }

        if (!agent) {
          const mappedUserId = mappingsMap.get(vendorKey);
          if (mappedUserId) {
            const mappedAgent = agents.find(a => a.id === mappedUserId);
            if (mappedAgent) {
              const fiscalRegime = mappedAgent.fiscal_regime_id ? regimesMap.get(mappedAgent.fiscal_regime_id) : null;
              agent = {
                id: mappedAgent.id,
                name: mappedAgent.name,
                email: mappedAgent.email,
                office_id: mappedAgent.office_id,
                fiscal_regime: fiscalRegime || null
              };
              agentId = agent.id;
              matchMethod = vendorKey.startsWith('email:') ? 'mapping_email' : 'mapping_name';
            }
          }
        }

        const isUnmatched = !agent;

        if (isUnmatched) {
          errorsToInsert.push({
            batch_id: batch.id,
            fila_excel: JSON.stringify(row),
            error_type: 'agent_not_found',
            detalle: `No se encontró el agente - Email: ${vendorEmail || 'N/A'}`,
            email_agente: vendorEmail || null,
            poliza: row.Poliza || row.Documento || null,
            resolved: false
          });
        }

        const ramo = row.Ramo;
        const aseguradora = row.Aseguradora || row.CiaAbreviacion || '';
        const primaNeta = Number(row.PrimaNeta || row.Importe || 0);
        const porcentajeBase = Number(row.PorPart || 0);

        let commissionBruta: number | null = null;
        let calculationStatus = 'ok';
        let calculationMethod = 'unknown';
        const calculationWarnings: any[] = [];

        if (commissionConfig.commission_bruta_source === 'excel_column' &&
            commissionConfig.commission_bruta_column_name) {
          const columnValue = row[commissionConfig.commission_bruta_column_name];
          if (columnValue !== undefined && columnValue !== null && columnValue !== '') {
            commissionBruta = Number(columnValue);
            calculationMethod = 'excel_column';
            console.log(`[process-commissions] Commission from Excel column: ${commissionBruta}`);
          } else {
            calculationStatus = 'missing_base';
            calculationWarnings.push({
              code: 'MISSING_COLUMN_VALUE',
              message: `Columna ${commissionConfig.commission_bruta_column_name} no tiene valor`
            });
          }
        } else if (commissionConfig.commission_bruta_source === 'rules_engine') {
          const matchingRule = findBusinessRule(businessRules || [], ramo, aseguradora, agent?.office_id || null);

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

            commissionBruta = (importeBase * porcentajeComision) / 100;
            calculationMethod = 'rules_engine';
          } else {
            calculationStatus = 'missing_rules';
            calculationWarnings.push({
              code: 'NO_MATCHING_RULE',
              message: `No se encontró regla para ramo=${ramo}, aseguradora=${aseguradora}`
            });
          }
        }

        if (commissionBruta !== null && primaNeta > 0 && commissionBruta === primaNeta) {
          if (!commissionConfig.allow_prima_neta_as_commission_bruta) {
            calculationStatus = 'error';
            calculationWarnings.push({
              code: 'SUSPICIOUS_BRUTA_EQUALS_PRIMA',
              message: 'commission_bruta es igual a prima_neta, esto probablemente es un bug',
              prima_neta: primaNeta,
              commission_bruta: commissionBruta
            });
            console.warn(`[process-commissions] BUG DETECTED: commission_bruta === prima_neta (${primaNeta})`);
          }
        }

        const commissionNeta = commissionBruta || 0;

        detailsToInsert.push({
          batch_id: batch.id,
          agent_id: agentId,
          poliza: row.Poliza || row.Documento || '',
          ramo,
          aseguradora,
          office_id: agent?.office_id || null,
          prima_neta: primaNeta,
          date_fpago: row.FPago,
          porcentaje_base: porcentajeBase,
          porcentaje_comision: porcentajeBase,
          importe_base: primaNeta,
          commission_bruta: commissionBruta,
          commission_neta: commissionNeta,
          impuestos_json: {},
          tipo_calculo: 'directo',
          concepto: row.Concepto || '',
          nombre_asegurado: row.NombreCompleto || row.NombreAsegurado || row.Asegurado || '',
          vendor_email_raw: vendorEmail || null,
          vendor_name_raw: vendorName || null,
          vendor_key: vendorKey,
          match_method: matchMethod,
          is_unmatched: isUnmatched,
          calculation_status: calculationStatus,
          calculation_method: calculationMethod,
          calculation_warnings: calculationWarnings,
          raw_row: row
        });
      }

      if (detailsToInsert.length > 0) {
        console.log(`[process-commissions] Inserting ${detailsToInsert.length} commission details...`);
        const { error: detailsError } = await supabase
          .from('commission_details')
          .insert(detailsToInsert);

        if (detailsError) {
          throw new Error(`Error al insertar detalles de comisiones: ${detailsError.message}`);
        }
      }

      if (errorsToInsert.length > 0) {
        const { error: errorsError } = await supabase
          .from('commission_errors')
          .insert(errorsToInsert);

        if (errorsError) {
          console.error('[process-commissions] Error inserting errors:', errorsError);
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
