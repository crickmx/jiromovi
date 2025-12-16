import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StandardCommissionRow {
  fpago: string;
  agent_email: string | null;
  vendor_name_raw: string | undefined;
  movi_user_id: string | null;
  ramo: string;
  aseguradora: string;
  importe: number;
  porpart: number;
  poliza: string;
  endoso: string | null;
  prima_neta: number | null;
  nombre_asegurado: string | null;
  concepto: string | null;
  pending_assignment: boolean;
}

interface ParseResult {
  status: "valid" | "warning" | "discard";
  row?: StandardCommissionRow;
  errors?: string[];
  warnings?: string[];
}

interface DiscardReport {
  missing_ramo: number;
  missing_poliza: number;
  invalid_importe: number;
  invalid_porpart: number;
  missing_email_warnings: number;
  missing_aseguradora_warnings: number;
  examples: any[];
}

function checkRequiredColumns(headers: string[]): {
  hasVendNombre: boolean;
  hasRequiredFields: boolean;
  emailMissingRatio: number;
  rowsWithoutEmail: number;
  totalRows: number;
} {
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const hasVendNombre = normalizedHeaders.some(h =>
    h.includes('vendnombre') || h.includes('vendedor') || h.includes('agente')
  );

  const hasImporte = normalizedHeaders.some(h =>
    h.includes('importe') || h.includes('monto') || h.includes('prima')
  );

  const hasPorPart = normalizedHeaders.some(h =>
    h.includes('porpart') || h.includes('comision') || h.includes('porcentaje')
  );

  const hasRamo = normalizedHeaders.some(h =>
    h.includes('ramo') || h.includes('linea') || h.includes('rama')
  );

  const hasPoliza = normalizedHeaders.some(h =>
    h.includes('poliza') || h.includes('documento') || h.includes('certificado')
  );

  const hasRequiredFields = hasImporte && hasPorPart && hasRamo && hasPoliza;

  return {
    hasVendNombre,
    hasRequiredFields,
    emailMissingRatio: 0,
    rowsWithoutEmail: 0,
    totalRows: 0,
    details: {
      hasVendNombre,
      hasRequiredFields,
      emailMissingRatio: 0,
      rowsWithoutEmail: 0,
      totalRows: 0
    }
  };
}

function mapColumns(docData: Record<string, any>): Record<string, string> {
  const keys = Object.keys(docData);
  const result: Record<string, string> = {};

  const synonyms: Record<string, string[]> = {
    fpago: ['fpago', 'f.pago', 'fecha_pago', 'fecha pago', 'fechapago', 'fecha', 'date', 'fliquidacion', 'f.liquidacion', 'fechaliquidacion'],
    email: ['email', 'correo', 'mail', 'correo_electronico', 'agent_email', 'email_agente', 'emailagente', 'correoelectronico'],
    vendornombre: ['vendnombre', 'vend.nombre', 'vendedor', 'vendor', 'nombre_vendedor', 'agente', 'despnombre', 'desp.nombre', 'nombrevendedor', 'nombreagente'],
    ramo: ['ramo', 'rama', 'line', 'linea', 'tipo_seguro', 'tiposeguro'],
    aseguradora: ['aseguradora', 'cia', 'ciaabreviacion', 'cia.abreviacion', 'insurer', 'company', 'compañia', 'compania', 'companiaabreviacion'],
    importe: ['importe', 'amount', 'monto', 'valor', 'prima', 'primadevengada'],
    porpart: ['porpart', 'por.part', '% part', 'porcentaje', 'percentage', 'comision', '%part', 'porcpart'],
    poliza: ['poliza', 'póliza', 'numero_poliza', 'num_poliza', 'policy', 'no_poliza', 'certificado', 'documento', 'numeropoliza', 'nopoliza'],
    endoso: ['endoso', 'endorsement', 'end', 'numeroendoso'],
    primaneta: ['prima_neta', 'primaneta', 'prima neta', 'netpremium', 'primanta'],
    nombreasegurado: ['nombre_asegurado', 'asegurado', 'nombre', 'insured_name', 'cliente', 'nombrecompleto', 'nombre.completo', 'nombrecompletoasegurado'],
    concepto: ['concepto', 'concept', 'descripcion', 'description', 'detalle']
  };

  for (const [field, syns] of Object.entries(synonyms)) {
    for (const key of keys) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const syn of syns) {
        const synNormalized = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalized === synNormalized || normalized.includes(synNormalized)) {
          result[field] = key;
          break;
        }
      }
      if (result[field]) break;
    }
  }

  return result;
}

function normalizeDate(dateRaw: any): string {
  if (!dateRaw) return new Date().toISOString().split('T')[0];

  if (typeof dateRaw === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const milliseconds = dateRaw * 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + milliseconds);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  if (typeof dateRaw === 'string') {
    const cleaned = dateRaw.trim();
    const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const patterns = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let day, month, year;
        if (pattern.source.startsWith('^(\\d{4})')) {
          [, year, month, day] = match;
        } else {
          [, day, month, year] = match;
        }
        const d = parseInt(day, 10);
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }

    const attemptParse = new Date(cleaned);
    if (!isNaN(attemptParse.getTime())) {
      return attemptParse.toISOString().split('T')[0];
    }
  }

  return new Date().toISOString().split('T')[0];
}

function normalizeEmail(emailRaw: any): string | null {
  if (!emailRaw) return null;
  const str = String(emailRaw).trim().toLowerCase();
  if (!str || str === '' || str === 'null' || str === 'undefined') return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(str)) return null;
  return str;
}

function normalizeText(textRaw: any): string {
  if (textRaw === null || textRaw === undefined) return '';
  return String(textRaw).trim();
}

function normalizeNumber(numRaw: any): number {
  if (numRaw === null || numRaw === undefined || numRaw === '') return 0;

  if (typeof numRaw === 'number') return numRaw;

  const str = String(numRaw).trim();
  const cleaned = str.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseImportedDocument(
  doc: any,
  rowIndex: number,
  discardReport: DiscardReport
): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const docData = doc.document_data || {};

  const mapped = mapColumns(docData);

  if (rowIndex < 3) {
    console.log(`[DEBUG] Row ${rowIndex} - Mapped columns:`, mapped);
  }

  const fpagoRaw = mapped.fpago ? docData[mapped.fpago] : null;
  const emailRaw = mapped.email ? docData[mapped.email] : doc.vendor_email_raw;
  const vendorNombreRaw = mapped.vendornombre ? docData[mapped.vendornombre] : doc.vendor_name_raw;
  const ramoRaw = mapped.ramo ? docData[mapped.ramo] : null;
  const aseguradoraRaw = mapped.aseguradora ? docData[mapped.aseguradora] : null;

  const importeRaw = mapped.importe ? docData[mapped.importe] : null;
  const porpartRaw = mapped.porpart ? docData[mapped.porpart] : null;
  const polizaRaw = mapped.poliza ? docData[mapped.poliza] : doc.document_id;
  const endosoRaw = mapped.endoso ? docData[mapped.endoso] : null;

  const primaNetaRaw = mapped.primaneta ? docData[mapped.primaneta] : null;
  const nombreAseguradoRaw = mapped.nombreasegurado ? docData[mapped.nombreasegurado] : null;
  const conceptoRaw = mapped.concepto ? docData[mapped.concepto] : null;

  if (rowIndex < 3) {
    console.log(`[DEBUG] Row ${rowIndex} - Raw values:`, {
      fpagoRaw,
      emailRaw,
      vendorNombreRaw,
      ramoRaw,
      aseguradoraRaw,
      importeRaw,
      porpartRaw,
      polizaRaw
    });
  }

  const fpago = normalizeDate(fpagoRaw);
  const agent_email = normalizeEmail(emailRaw);
  const vendor_name_raw = vendorNombreRaw ? normalizeText(vendorNombreRaw) : undefined;
  const ramo = normalizeText(ramoRaw);
  let aseguradora = normalizeText(aseguradoraRaw);

  const importe = normalizeNumber(importeRaw);
  const porpart = normalizeNumber(porpartRaw);
  const poliza = normalizeText(polizaRaw);
  const endoso = endosoRaw ? normalizeText(endosoRaw) : null;

  const prima_neta = primaNetaRaw ? normalizeNumber(primaNetaRaw) : null;
  const nombre_asegurado = nombreAseguradoRaw ? normalizeText(nombreAseguradoRaw) : null;
  const concepto = conceptoRaw ? normalizeText(conceptoRaw) : null;

  if (importe === 0) {
    errors.push("importe_invalido");
    discardReport.invalid_importe++;
  }

  if (porpart < 0 || porpart > 100) {
    errors.push("porpart_invalido");
    discardReport.invalid_porpart++;
  }

  if (!ramo || ramo === '') {
    errors.push("ramo_faltante");
    discardReport.missing_ramo++;
  }

  if (!poliza || poliza === '') {
    errors.push("poliza_faltante");
    discardReport.missing_poliza++;
  }

  if (!agent_email) {
    warnings.push("email_faltante");
    discardReport.missing_email_warnings++;
  }

  if (!aseguradora || aseguradora === '') {
    warnings.push("aseguradora_faltante");
    aseguradora = 'SIN_ASEGURADORA';
    discardReport.missing_aseguradora_warnings++;
  }

  if (errors.length > 0) {
    if (discardReport.examples.length < 5) {
      discardReport.examples.push({
        row_index: rowIndex,
        errors,
        data: {
          poliza,
          ramo,
          aseguradora,
          importe,
          porpart,
          vendor_name_raw
        }
      });
    }

    return { status: "discard", errors, warnings };
  }

  const pending_assignment = !doc.movi_user_id;

  return {
    status: warnings.length > 0 ? "warning" : "valid",
    row: {
      fpago,
      agent_email,
      vendor_name_raw,
      movi_user_id: doc.movi_user_id || null,
      ramo,
      aseguradora,
      importe,
      porpart,
      poliza,
      endoso,
      prima_neta,
      nombre_asegurado,
      concepto,
      pending_assignment
    },
    warnings
  };
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function groupByWeek(rows: StandardCommissionRow[]): Array<{
  week_number: number;
  period_start: string;
  period_end: string;
  items: StandardCommissionRow[];
}> {
  const groups: Record<number, StandardCommissionRow[]> = {};

  for (const row of rows) {
    const fpagoDate = new Date(row.fpago);
    const weekNum = getWeekNumber(fpagoDate);
    const weekStart = getWeekStart(fpagoDate);

    if (!groups[weekNum]) {
      groups[weekNum] = [];
    }
    groups[weekNum].push(row);
  }

  const result: Array<{
    week_number: number;
    period_start: string;
    period_end: string;
    items: StandardCommissionRow[];
  }> = [];

  for (const [weekNumStr, items] of Object.entries(groups)) {
    const weekNum = parseInt(weekNumStr, 10);
    const firstDate = new Date(items[0].fpago);
    const weekStart = getWeekStart(firstDate);
    const weekEnd = getWeekEnd(firstDate);

    result.push({
      week_number: weekNum,
      period_start: weekStart.toISOString().split('T')[0],
      period_end: weekEnd.toISOString().split('T')[0],
      items
    });
  }

  result.sort((a, b) => a.week_number - b.week_number);

  return result;
}

async function insertItemsInChunks(
  supabase: any,
  items: any[]
): Promise<{ insertedCount: number; errors: any[] }> {
  const CHUNK_SIZE = 200;
  let insertedCount = 0;
  const errors: any[] = [];

  console.log(`[Insert] Attempting to insert ${items.length} items in chunks of ${CHUNK_SIZE}`);

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    console.log(`[Insert] Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: Inserting ${chunk.length} items...`);

    const { data, error } = await supabase
      .from("commission_details")
      .insert(chunk)
      .select();

    if (error) {
      console.error(`[Batch Insert] Error inserting chunk ${i}-${i + chunk.length}:`, error);
      console.error(`[Batch Insert] Error code:`, error.code);
      console.error(`[Batch Insert] Error message:`, error.message);
      console.error(`[Batch Insert] Error hint:`, error.hint);
      console.error(`[Batch Insert] Error details:`, error.details);
      console.error(`[Batch Insert] Full error object:`, JSON.stringify(error, null, 2));
      console.error(`[Batch Insert] Primera fila del chunk con error:`, JSON.stringify(chunk[0], null, 2));
      errors.push({ chunk_start: i, error, sample_item: chunk[0] });
    } else {
      insertedCount += data?.length || 0;
      console.log(`[Insert] Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: Inserted ${data?.length || 0} items`);
    }
  }

  console.log(`[Insert] Total inserted: ${insertedCount}/${items.length} items`);
  if (errors.length > 0) {
    console.error(`[Insert] Total errors: ${errors.length} chunks failed`);
  }

  return { insertedCount, errors };
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  let conversionJobId: string | undefined;
  let supabase: any = null;

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing environment variables");
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { batch_id } = await req.json();

    if (!batch_id) {
      return new Response(JSON.stringify({ error: "batch_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Conversion] Starting conversion for batch ${batch_id}`);

    const { data: batch, error: batchError } = await supabase
      .from("document_import_batches")
      .select("*")
      .eq("id", batch_id)
      .single();

    if (batchError || !batch) {
      return new Response(JSON.stringify({ error: "Batch not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: conversionJobData, error: jobError } = await supabase
      .from("conversion_jobs")
      .insert({
        batch_id: batch_id,
        started_at: new Date().toISOString(),
        status: "running"
      })
      .select()
      .single();

    if (jobError || !conversionJobData) {
      console.error("[Conversion] Failed to create conversion job:", jobError);
      throw new Error("Failed to create conversion job");
    }

    conversionJobId = conversionJobData.id;
    console.log(`[Conversion] Created job ${conversionJobId}`);

    const { data: docs, error: docsError } = await supabase
      .from("imported_documents")
      .select("*")
      .eq("batch_id", batch_id);

    if (docsError || !docs) {
      throw new Error(`Failed to load documents: ${docsError?.message}`);
    }

    const sourceCount = docs.length;
    console.log(`[Conversion] Loaded ${sourceCount} documents from batch`);

    const headers = batch.metadata?.headers_detected || [];
    const columnCheck = checkRequiredColumns(headers);

    if (!columnCheck.hasRequiredFields) {
      return new Response(JSON.stringify({
        success: false,
        code: "MISSING_REQUIRED_COLUMNS",
        message: "El archivo no contiene todas las columnas requeridas",
        details: {
          hasVendNombre: columnCheck.hasVendNombre,
          hasRequiredFields: columnCheck.hasRequiredFields,
          detectedHeaders: headers,
          missingColumns: []
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const discardReport: DiscardReport = {
      missing_ramo: 0,
      missing_poliza: 0,
      invalid_importe: 0,
      invalid_porpart: 0,
      missing_email_warnings: 0,
      missing_aseguradora_warnings: 0,
      examples: []
    };

    const validRows: StandardCommissionRow[] = [];
    const warningRows: StandardCommissionRow[] = [];
    const discardedRows: any[] = [];

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const parsed = parseImportedDocument(doc, i, discardReport);

      if (parsed.status === "discard") {
        discardedRows.push({ row_index: i, errors: parsed.errors, doc });
      } else if (parsed.row) {
        if (parsed.status === "warning") {
          warningRows.push(parsed.row);
        } else {
          validRows.push(parsed.row);
        }
      }
    }

    console.log(`[Conversion] Parsed ${docs.length} rows:`);
    console.log(`[Conversion]   Valid: ${validRows.length}`);
    console.log(`[Conversion]   Warnings: ${warningRows.length}`);
    console.log(`[Conversion]   Discarded: ${discardedRows.length}`);

    const parsedRows = [...validRows, ...warningRows];

    if (parsedRows.length === 0) {
      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "NO_VALID_ITEMS_AFTER_MAPPING",
          error_message: "No se encontraron filas válidas después del mapeo de columnas",
          conversion_report: {
            discard_report: discardReport,
            discarded_rows: discardedRows.slice(0, 10),
            total_source_items: sourceCount,
            valid_rows: validRows.length,
            warning_rows: warningRows.length,
            parsed_rows: parsedRows.length
          }
        })
        .eq("id", conversionJobId);

      return new Response(JSON.stringify({
        success: false,
        code: "NO_VALID_ITEMS_AFTER_MAPPING",
        message: "No se encontraron filas válidas después del mapeo de columnas",
        details: {
          totalSourceItems: sourceCount,
          validRows: validRows.length,
          warningRows: warningRows.length,
          discardedRows: discardedRows.length,
          parsedRows: parsedRows.length,
          discarded: discardReport,
          parseErrors: discardedRows.slice(0, 5)
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const weekGroups = groupByWeek(parsedRows);
    console.log(`[Conversion] Grouped into ${weekGroups.length} weeks`);

    const uniqueUsuarioIds = [...new Set(parsedRows.map(r => r.movi_user_id).filter(Boolean))];
    console.log(`[Conversion] Found ${uniqueUsuarioIds.length} unique usuario IDs to map`);

    const usuarioIdToAgentId: Record<string, string> = {};

    if (uniqueUsuarioIds.length > 0) {
      const { data: commissionAgents, error: agentsError } = await supabase
        .from("commission_agents")
        .select("id, usuario_id")
        .in("usuario_id", uniqueUsuarioIds);

      if (agentsError) {
        console.error("[Conversion] Error loading commission agents:", agentsError);
        throw new Error(`Failed to load commission agents: ${agentsError.message}`);
      } else if (commissionAgents) {
        for (const agent of commissionAgents) {
          if (agent.usuario_id) {
            usuarioIdToAgentId[agent.usuario_id] = agent.id;
          }
        }
        console.log(`[Conversion] Mapped ${Object.keys(usuarioIdToAgentId).length} usuario IDs to agent IDs`);
      }
    }

    const createdBatches: any[] = [];
    const createdBatchIds: string[] = [];
    let totalInsertedItems = 0;
    const insertionErrors: any[] = [];

    for (const group of weekGroups) {
      const batchName = `Comisiones Semana ${group.week_number} (${group.period_start} a ${group.period_end})`;

      const { data: batchData, error: batchError } = await supabase
        .from("commission_batches")
        .insert({
          name: batchName,
          display_name: batchName,
          date_from: group.period_start,
          date_to: group.period_end,
          period_start: group.period_start,
          period_end: group.period_end,
          week_number: group.week_number,
          total_commission: 0,
          status: "draft",
          source_import_batch_id: batch_id,
          source_type: "import",
          converted_from_import_at: new Date().toISOString(),
          converted_by: user.id
        })
        .select()
        .single();

      if (batchError || !batchData) {
        console.error(`[Conversion] Error creating batch for week ${group.week_number}:`, batchError);
        continue;
      }

      const batchId = batchData.id;
      createdBatchIds.push(batchId);
      console.log(`[Conversion] Created batch ${batchId}: ${batchName}`);

      const itemsToInsert = group.items.map(row => {
        const commissionBruta = (row.importe * row.porpart) / 100;
        const commissionNeta = commissionBruta;

        const agentId = row.movi_user_id ? usuarioIdToAgentId[row.movi_user_id] : null;

        if (!agentId) {
          console.warn(`[Conversion] No commission agent found for usuario_id ${row.movi_user_id}`);
        }

        return {
          batch_id: batchId,
          agent_id: agentId,
          agent_email: row.agent_email,
          vendor_name_raw: row.vendor_name_raw,
          fpago: row.fpago,
          ramo: row.ramo || 'SIN_RAMO',
          aseguradora: row.aseguradora || 'SIN_ASEGURADORA',
          importe: row.importe,
          porpart: row.porpart,
          poliza: row.poliza || 'SIN_POLIZA',
          endoso: row.endoso,
          prima_neta: row.prima_neta,
          nombre_asegurado: row.nombre_asegurado,
          concepto: row.concepto,
          pending_assignment: !agentId,
          commission_bruta: commissionBruta,
          commission_neta: commissionNeta,
          calculation_status: 'ok',
          calculation_method: 'excel_column'
        };
      });

      if (itemsToInsert.length > 0) {
        console.log(`[Conversion] Sample item to insert:`, JSON.stringify(itemsToInsert[0], null, 2));
      }

      const insertResult = await insertItemsInChunks(supabase, itemsToInsert);

      if (insertResult.errors.length > 0) {
        console.error(`[Conversion] Errors during insertion for batch ${batchId}:`, insertResult.errors);
        insertionErrors.push(...insertResult.errors);
      }

      if (insertResult.insertedCount > 0) {
        totalInsertedItems += insertResult.insertedCount;
        createdBatches.push({
          batch_id: batchId,
          week_number: group.week_number,
          period_start: group.period_start,
          period_end: group.period_end,
          display_name: batchName,
          items: insertResult.insertedCount
        });
      }
    }

    console.log(`[Conversion] Total inserted items: ${totalInsertedItems}`);

    if (totalInsertedItems === 0) {
      console.error('[CRITICAL] ============================== ');
      console.error('[CRITICAL] NO SE INSERTARON ITEMS EN LOS LOTES');
      console.error('[CRITICAL] ============================== ');
      console.error('[CRITICAL] Parsed Rows:', parsedRows.length);
      console.error('[CRITICAL] Valid Rows:', validRows.length);
      console.error('[CRITICAL] Warning Rows:', warningRows.length);
      console.error('[CRITICAL] Discarded:', discardedRows.length);
      console.error('[CRITICAL] Discard Report:');
      console.error('[CRITICAL]   missing_ramo:', discardReport.missing_ramo);
      console.error('[CRITICAL]   missing_poliza:', discardReport.missing_poliza);
      console.error('[CRITICAL]   invalid_importe:', discardReport.invalid_importe);
      console.error('[CRITICAL]   invalid_porpart:', discardReport.invalid_porpart);
      console.error('[CRITICAL]   missing_email_warnings:', discardReport.missing_email_warnings);
      console.error('[CRITICAL]   missing_aseguradora_warnings:', discardReport.missing_aseguradora_warnings);
      if (parsedRows.length > 0) {
        console.error('[CRITICAL] Sample parsed row:');
        console.error('[CRITICAL]', JSON.stringify(parsedRows[0], null, 2));
      }
      if (discardedRows.length > 0) {
        console.error('[CRITICAL] Sample discarded row:');
        console.error('[CRITICAL]', JSON.stringify(discardedRows[0], null, 2));
      }

      console.error('[CRITICAL] ==============================');

      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "NO_ITEMS_INSERTED",
          error_message: "No se pudieron insertar items en los lotes.",
          conversion_report: {
            discard_report: discardReport,
            discarded_rows: discardedRows.slice(0, 10),
            total_source_items: sourceCount,
            valid_rows: validRows.length,
            warning_rows: warningRows.length,
            parsed_rows: parsedRows.length,
            insertion_errors: insertionErrors.slice(0, 5),
            total_insertion_errors: insertionErrors.length
          }
        })
        .eq("id", conversionJobId);

      return new Response(JSON.stringify({
        success: false,
        code: "NO_ITEMS_INSERTED",
        message: "No se pudieron insertar documentos en los lotes",
        details: {
          totalSourceItems: sourceCount,
          validRows: validRows.length,
          warningRows: warningRows.length,
          discardedRows: discardedRows.length,
          parsedRows: parsedRows.length,
          insertedItems: totalInsertedItems,
          discarded: discardReport,
          sample_parsed_row: parsedRows.length > 0 ? parsedRows[0] : null,
          sample_discarded_row: discardedRows.length > 0 ? discardedRows[0] : null,
          insertion_errors: insertionErrors.slice(0, 5),
          total_insertion_errors: insertionErrors.length
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    await supabase
      .from("document_import_batches")
      .update({
        status: "converted",
        converted_at: new Date().toISOString(),
        converted_by: user.id,
        converted_to_commissions: true,
        commission_batch_ids: createdBatchIds
      })
      .eq("id", batch_id);

    await supabase
      .from("conversion_jobs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        conversion_report: {
          created_batches: createdBatches,
          total_inserted_items: totalInsertedItems,
          discard_report: discardReport,
          total_source_items: sourceCount,
          valid_rows: validRows.length,
          warning_rows: warningRows.length,
          parsed_rows: parsedRows.length
        }
      })
      .eq("id", conversionJobId);

    return new Response(JSON.stringify({
      success: true,
      message: "Conversión completada exitosamente",
      data: {
        createdBatches,
        totalInsertedItems,
        sourceCount,
        validRows: validRows.length,
        warningRows: warningRows.length,
        discardedRows: discardedRows.length,
        conversion_job_id: conversionJobId
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[Conversion] Fatal error:", error);

    if (conversionJobId && supabase) {
      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "FATAL_ERROR",
          error_message: error.message || "Unknown error"
        })
        .eq("id", conversionJobId)
        .then(() => console.log("[Conversion] Updated job status to failed"))
        .catch((err: any) => console.error("[Conversion] Failed to update job:", err));
    }

    return new Response(JSON.stringify({
      success: false,
      code: "FATAL_ERROR",
      message: error.message || "An unexpected error occurred"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});