import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================================
// TIPOS
// ============================================================================

interface StandardCommissionRow {
  fpago: string;
  agent_email: string | null;
  vendor_name_raw: string | undefined;
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
  invalid_importe: number;
  invalid_porpart: number;
  missing_ramo: number;
  missing_poliza: number;
  missing_aseguradora_warnings: number;
  missing_email_warnings: number;
  examples: any[];
}

interface FormatDetection {
  isLogExport: boolean;
  confidence: number;
  details: {
    hasVendNombre: boolean;
    hasRequiredFields: boolean;
    emailMissingRatio: number;
    rowsWithoutEmail: number;
    totalRows: number;
  };
}

interface WeekGroup {
  week_number: number;
  week_start: Date;
  week_end: Date;
  period_start: string;
  period_end: string;
  fpagos: string[];
  items: StandardCommissionRow[];
}

// ============================================================================
// FUNCIONES DE NORMALIZACIÓN
// ============================================================================

function normalizeHeader(header: string): string {
  if (!header) return '';
  let normalized = header.toString().trim().toLowerCase();
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  normalized = normalized.replace(/[\s\-_.]/g, '');
  return normalized;
}

function mapColumns(docData: Record<string, any>): Record<string, string> {
  const keys = Object.keys(docData);
  const result: Record<string, string> = {};

  // Diccionario de sinónimos (extendido para mayor cobertura)
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

function normalizeNumber(numRaw: any, defaultValue: number = 0): number {
  if (numRaw === null || numRaw === undefined || numRaw === '') return defaultValue;
  const parsed = parseFloat(String(numRaw).replace(/,/g, ''));
  if (isNaN(parsed)) return defaultValue;
  return parsed;
}

// ============================================================================
// DETECCIÓN DE FORMATO LOGEXPORT
// ============================================================================

function detectFormatLOGEXPORT(documents: any[]): FormatDetection {
  if (documents.length === 0) {
    return {
      isLogExport: false,
      confidence: 0,
      details: {
        hasVendNombre: false,
        hasRequiredFields: false,
        emailMissingRatio: 0,
        rowsWithoutEmail: 0,
        totalRows: 0
      }
    };
  }

  let rowsWithVendNombre = 0;
  let rowsWithEmail = 0;
  let rowsWithRequiredFields = 0;

  for (const doc of documents) {
    const data = doc.document_data || {};
    const mapped = mapColumns(data);

    const hasVendNombre = !!mapped.vendornombre && !!data[mapped.vendornombre];
    const hasEmail = !!mapped.email && !!data[mapped.email];
    const hasRamo = !!mapped.ramo && !!data[mapped.ramo];
    const hasPoliza = !!mapped.poliza && !!data[mapped.poliza];
    const hasImporte = !!mapped.importe && !!data[mapped.importe];

    if (hasVendNombre) rowsWithVendNombre++;
    if (hasEmail) rowsWithEmail++;
    if (hasRamo && hasPoliza && hasImporte) rowsWithRequiredFields++;
  }

  const totalRows = documents.length;
  const rowsWithoutEmail = totalRows - rowsWithEmail;
  const emailMissingRatio = totalRows > 0 ? rowsWithoutEmail / totalRows : 0;
  const vendNombreRatio = totalRows > 0 ? rowsWithVendNombre / totalRows : 0;

  const hasVendNombre = vendNombreRatio > 0.8;
  const hasRequiredFields = rowsWithRequiredFields >= totalRows * 0.9;
  const isLogExport = hasVendNombre && hasRequiredFields && emailMissingRatio > 0.8;
  const confidence = isLogExport ? Math.round(vendNombreRatio * 100) : 0;

  return {
    isLogExport,
    confidence,
    details: {
      hasVendNombre,
      hasRequiredFields,
      emailMissingRatio,
      rowsWithoutEmail,
      totalRows
    }
  };
}

// ============================================================================
// PARSEO DE DOCUMENTOS
// ============================================================================

function parseImportedDocument(
  doc: any,
  rowIndex: number,
  discardReport: DiscardReport
): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const docData = doc.document_data || {};

  // Mapear columnas del documento
  const mapped = mapColumns(docData);

  // DEBUG: Mostrar mapeo para las primeras filas
  if (rowIndex < 3) {
    console.log(`[DEBUG] Row ${rowIndex} - Mapped columns:`, mapped);
  }

  // Extraer valores usando mapeo
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

  // DEBUG: Mostrar valores raw para las primeras filas
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

  // Normalizar
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

  // VALIDACIÓN CRÍTICA
  if (importe <= 0) {
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

  if (errors.length > 0) {
    if (discardReport.examples.length < 5) {
      discardReport.examples.push({
        document_id: doc.document_id,
        vendor_email: doc.vendor_email_raw,
        errors
      });
    }
    return { status: "discard", errors };
  }

  // WARNINGS (no bloquean inserción)
  if (!aseguradora || aseguradora === '') {
    warnings.push("aseguradora_faltante");
    aseguradora = "SIN ASEGURADORA";
    discardReport.missing_aseguradora_warnings++;
  }

  if (!agent_email && !vendor_name_raw) {
    warnings.push("email_y_vendnombre_faltantes");
    discardReport.missing_email_warnings++;
  } else if (!agent_email && vendor_name_raw) {
    warnings.push("email_faltante_con_vendnombre");
    discardReport.missing_email_warnings++;
  }

  const pending_assignment = !agent_email;

  const row: StandardCommissionRow = {
    fpago,
    agent_email,
    vendor_name_raw,
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
  };

  return warnings.length > 0
    ? { status: "warning", row, warnings }
    : { status: "valid", row };
}

// ============================================================================
// AGRUPACIÓN POR SEMANA
// ============================================================================

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekEnd(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7);
  return new Date(d.setDate(diff));
}

function groupByWeek(rows: StandardCommissionRow[]): WeekGroup[] {
  const weekMap = new Map<string, WeekGroup>();

  for (const row of rows) {
    const fpagoDate = new Date(row.fpago);
    const weekNum = getWeekNumber(fpagoDate);
    const weekStart = getWeekStart(fpagoDate);
    const weekEnd = getWeekEnd(fpagoDate);
    const year = fpagoDate.getFullYear();
    const key = `${year}-W${weekNum}`;

    if (!weekMap.has(key)) {
      weekMap.set(key, {
        week_number: weekNum,
        week_start: weekStart,
        week_end: weekEnd,
        period_start: weekStart.toISOString().split('T')[0],
        period_end: weekEnd.toISOString().split('T')[0],
        fpagos: [],
        items: []
      });
    }

    const group = weekMap.get(key)!;
    group.items.push(row);
    if (!group.fpagos.includes(row.fpago)) {
      group.fpagos.push(row.fpago);
    }
  }

  return Array.from(weekMap.values()).sort((a, b) =>
    a.week_start.getTime() - b.week_start.getTime()
  );
}

// ============================================================================
// MAPPINGS PERSISTENTES
// ============================================================================

async function applyPersistentMappings(
  supabase: any,
  rows: StandardCommissionRow[]
): Promise<{ rows: StandardCommissionRow[]; appliedCount: number; mappings: Record<string, string> }> {
  const { data: mappings, error } = await supabase
    .from("vendor_mapping_persistent")
    .select("vendor_key, movi_user_id");

  if (error || !mappings || mappings.length === 0) {
    return { rows, appliedCount: 0, mappings: {} };
  }

  const mappingLookup: Record<string, string> = {};
  for (const mapping of mappings) {
    mappingLookup[mapping.vendor_key] = mapping.movi_user_id;
  }

  let appliedCount = 0;
  const updatedRows = rows.map(row => {
    if (row.agent_email || !row.vendor_name_raw) {
      return row;
    }

    const normalizedName = row.vendor_name_raw.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();
    const vendorKey = `name:${normalizedName}`;

    if (mappingLookup[vendorKey]) {
      appliedCount++;
      return {
        ...row,
        agent_email: mappingLookup[vendorKey],
        pending_assignment: false
      };
    }

    return row;
  });

  return { rows: updatedRows, appliedCount, mappings: mappingLookup };
}

// ============================================================================
// INSERCIÓN EN LOTES
// ============================================================================

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
      console.error(`[Batch Insert] Error details:`, JSON.stringify(error, null, 2));
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

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req: Request) => {
  /* GARANTÍA: SIEMPRE devolver JSON, incluso en errores catastróficos */
  const startTime = Date.now();
  let conversionJobId: string | undefined;
  let supabase: any = null;

  try {
    // OPTIONS handling
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const { batch_id } = await req.json();
    if (!batch_id) {
      return new Response(JSON.stringify({ error: "batch_id requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Conversion] Starting conversion for batch ${batch_id}`);

    // Obtener el usuario autenticado
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario no autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Crear conversion job
    const { data: jobData, error: jobError } = await supabase
      .from("conversion_jobs")
      .insert({
        batch_id: batch_id,
        started_by: user.id,
        status: "running",
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !jobData) {
      console.error("[Conversion] Error creating job:", jobError);
      throw new Error(`Failed to create conversion job: ${jobError?.message || 'Unknown error'}`);
    }

    conversionJobId = jobData.id;
    console.log(`[Conversion] Created job ${conversionJobId}`);

    // Obtener source count
    const { count: sourceCount, error: countError } = await supabase
      .from("imported_documents")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", batch_id);

    if (countError) {
      throw new Error("Failed to count source documents");
    }

    console.log(`[Conversion] Source count: ${sourceCount} documents`);

    // Obtener documentos
    const { data: documents, error: docsError } = await supabase
      .from("imported_documents")
      .select("*")
      .eq("batch_id", batch_id);

    if (docsError || !documents) {
      throw new Error("Failed to fetch documents");
    }

    console.log(`[Conversion] Processing ${documents.length} documents...`);

    // ========================================================================
    // DETECCIÓN AUTOMÁTICA DE FORMATO LOGEXPORT
    // ========================================================================
    const formatDetection = detectFormatLOGEXPORT(documents);
    console.log('[Format Detection]', formatDetection);

    // DEBUG: Mostrar muestra de datos para diagnóstico
    if (documents.length > 0) {
      const firstDoc = documents[0];
      console.log('[DEBUG] ===== MUESTRA DE DATOS =====');
      console.log('[DEBUG] Primera fila document_data:', JSON.stringify(firstDoc.document_data, null, 2));
      console.log('[DEBUG] Columnas detectadas:', Object.keys(firstDoc.document_data || {}));
      console.log('[DEBUG] vendor_email_raw:', firstDoc.vendor_email_raw);
      console.log('[DEBUG] vendor_name_raw:', firstDoc.vendor_name_raw);
      console.log('[DEBUG] document_id:', firstDoc.document_id);
      console.log('[DEBUG] ==================================');
    }

    if (formatDetection.isLogExport) {
      console.log(`FORMATO LOGEXPORT DETECTADO (confidence: ${formatDetection.confidence}%)`);
      console.log(`   - VendNombre: ${formatDetection.details.hasVendNombre ? 'YES' : 'NO'}`);
      console.log(`   - Required fields: ${formatDetection.details.hasRequiredFields ? 'YES' : 'NO'}`);
      console.log(`   - Email missing ratio: ${(formatDetection.details.emailMissingRatio * 100).toFixed(1)}%`);
      console.log(`   - Rows without email: ${formatDetection.details.rowsWithoutEmail}/${formatDetection.details.totalRows}`);
      console.log('');
      console.log('REGLA DE ORO: En formato LOGEXPORT, VendNombre sustituye al Email.');
      console.log('   La falta de email NUNCA bloqueará la conversión.');
      console.log('');
    } else {
      console.log('Formato estándar detectado (con email)');
    }

    // Parsear documentos al modelo estándar
    const validRows: StandardCommissionRow[] = [];
    const warningRows: StandardCommissionRow[] = [];
    const discardedRows: any[] = [];

    // Inicializar reporte de descarte
    const discardReport: DiscardReport = {
      invalid_importe: 0,
      invalid_porpart: 0,
      missing_ramo: 0,
      missing_poliza: 0,
      missing_aseguradora_warnings: 0,
      missing_email_warnings: 0,
      examples: []
    };

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const result = parseImportedDocument(doc, i, discardReport);

      if (result.status === "valid") {
        validRows.push(result.row!);
      } else if (result.status === "warning") {
        // CRÍTICO: Las filas con warnings SÍ se insertan
        // FORMATO LOGEXPORT: Archivos sin email generan warnings pero SÍ se insertan
        warningRows.push(result.row!);
      } else if (result.status === "discard") {
        discardedRows.push({
          document_id: doc.document_id,
          vendor_email: doc.vendor_email_raw,
          errors: result.errors
        });
        console.error(`[Conversion] Discarded doc ${doc.document_id}:`, result.errors);
      }
    }

    // ========================================================================
    // ITEMS INSERTABLES = VALID + WARNING
    // ========================================================================
    // FORMATO LOGEXPORT: Archivos sin email generan 100% warnings pero SÍ se insertan
    // Si existe VendNombre, la fila ES INSERTABLE (pending_assignment = true)
    let parsedRows = [...validRows, ...warningRows];

    console.log(`[Conversion] Parsed ${validRows.length} valid rows, ${warningRows.length} warning rows, ${discardedRows.length} discarded`);
    console.log('[Conversion] Discard report:', discardReport);

    // ========================================================================
    // APLICAR MAPPINGS PERSISTENTES
    // ========================================================================
    const mappingResult = await applyPersistentMappings(supabase, parsedRows);
    parsedRows = mappingResult.rows;

    if (mappingResult.appliedCount > 0) {
      console.log(`Applied ${mappingResult.appliedCount} persistent mappings`);
      console.log(`   Mappings used:`, Object.keys(mappingResult.mappings));
    } else {
      console.log('No persistent mappings to apply');
    }

    // Self-check: detectar inconsistencia lógica
    if (parsedRows.length === 0 && discardedRows.length === 0 && warningRows.length > 0) {
      console.error('[SELF-CHECK FAILED] Inconsistencia: warningRows > 0 pero parsedRows = 0. Bug en construcción de itemsToInsert.');
      throw new Error('SELF-CHECK FAILED: Las filas con warnings no se están incluyendo en parsedRows. Revisar lógica.');
    }

    if (parsedRows.length === 0) {
      // LOG CRÍTICO: Diagnóstico completo del fallo
      console.error('[CRITICAL] ===== NO ITEMS PARSED =====');
      console.error('[CRITICAL] Source count:', sourceCount);
      console.error('[CRITICAL] Valid rows:', validRows.length);
      console.error('[CRITICAL] Warning rows:', warningRows.length);
      console.error('[CRITICAL] Discarded rows:', discardedRows.length);
      console.error('[CRITICAL] Discard report:', JSON.stringify(discardReport, null, 2));

      // Diagnóstico: mostrar primera fila para análisis
      if (documents.length > 0) {
        const firstDoc = documents[0];
        console.error('[CRITICAL] Primera fila document_data:', JSON.stringify(firstDoc.document_data, null, 2));
        const mapped = mapColumns(firstDoc.document_data || {});
        console.error('[CRITICAL] Mapped columns de primera fila:', mapped);
        console.error('[CRITICAL] Columnas detectadas:', Object.keys(firstDoc.document_data || {}));
      }
      console.error('[CRITICAL] ==============================');

      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "NO_VALID_ITEMS_AFTER_MAPPING",
          error_message: "Ninguna fila pudo ser parseada. Todas las filas tienen datos inválidos o incompletos.",
          conversion_report: {
            discard_report: discardReport,
            parse_errors: discardedRows.slice(0, 10),
            // Diagnóstico adicional
            sample_document_data: documents.length > 0 ? documents[0].document_data : null,
            detected_columns: documents.length > 0 ? Object.keys(documents[0].document_data || {}) : [],
            total_source_items: sourceCount
          }
        })
        .eq("id", conversionJobId);

      return new Response(JSON.stringify({
        success: false,
        code: "NO_VALID_ITEMS_AFTER_MAPPING",
        message: "Ninguna fila es válida. Todas las filas tienen datos inválidos o incompletos.",
        details: {
          totalSourceItems: sourceCount,
          validRows: 0,
          warningRows: 0,
          discardedRows: discardedRows.length,
          discarded: discardReport,
          // CRITICAL: Datos de diagnóstico
          sample_document_data: documents.length > 0 ? documents[0].document_data : null,
          detected_columns: documents.length > 0 ? Object.keys(documents[0].document_data || {}) : [],
          parseErrors: discardedRows.slice(0, 5)
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ========================================================================
    // AGRUPAR POR SEMANA
    // ========================================================================
    const weekGroups = groupByWeek(parsedRows);
    console.log(`[Conversion] Grouped into ${weekGroups.length} weeks`);

    // ========================================================================
    // CREAR BATCHES Y INSERTAR ITEMS
    // ========================================================================
    const createdBatches: any[] = [];
    const createdBatchIds: string[] = [];
    let totalInsertedItems = 0;

    for (const group of weekGroups) {
      const batchName = `Comisiones Semana ${group.week_number} (${group.period_start} a ${group.period_end})`;

      const { data: batchData, error: batchError } = await supabase
        .from("commission_batches")
        .insert({
          display_name: batchName,
          period_start: group.period_start,
          period_end: group.period_end,
          total_commission: 0,
          status: "draft"
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

      // Preparar items para inserción
      const itemsToInsert = group.items.map(row => ({
        batch_id: batchId,
        agent_email: row.agent_email,
        vendor_name_raw: row.vendor_name_raw,
        fpago: row.fpago,
        ramo: row.ramo,
        aseguradora: row.aseguradora,
        importe: row.importe,
        porpart: row.porpart,
        poliza: row.poliza,
        endoso: row.endoso,
        prima_neta: row.prima_neta,
        nombre_asegurado: row.nombre_asegurado,
        concepto: row.concepto,
        pending_assignment: row.pending_assignment
      }));

      const insertResult = await insertItemsInChunks(supabase, itemsToInsert);

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
      // LOG CRÍTICO: Diagnóstico de fallo de inserción
      console.error('[CRITICAL] ===== NO ITEMS INSERTED =====');
      console.error('[CRITICAL] Total source items:', sourceCount);
      console.error('[CRITICAL] Valid rows:', validRows.length);
      console.error('[CRITICAL] Warning rows:', warningRows.length);
      console.error('[CRITICAL] Discarded rows:', discardedRows.length);
      console.error('[CRITICAL] Parsed rows (valid+warning):', parsedRows.length);
      console.error('[CRITICAL] Inserted items:', totalInsertedItems);
      console.error('[CRITICAL] Discard report:', JSON.stringify(discardReport, null, 2));

      // Mostrar diagnóstico de primera fila parseada (si existe)
      if (parsedRows.length > 0) {
        console.error('[CRITICAL] Primera fila parseada (debería insertarse):', JSON.stringify(parsedRows[0], null, 2));
      }

      // Mostrar diagnóstico de primera fila descartada (si existe)
      if (discardedRows.length > 0) {
        console.error('[CRITICAL] Primera fila descartada:', JSON.stringify(discardedRows[0], null, 2));
      }

      console.error('[CRITICAL] ==============================');

      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "NO_ITEMS_INSERTED",
          error_message: "No se pudieron insertar items en los lotes. Todas las filas fueron descartadas.",
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
          // Diagnóstico
          sample_parsed_row: parsedRows.length > 0 ? parsedRows[0] : null,
          sample_discarded_row: discardedRows.length > 0 ? discardedRows[0] : null
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Conversion] Success: ${createdBatches.length} batches, ${totalInsertedItems} items`);

    // ========================================================================
    // ACTUALIZAR CONTADORES DE PENDING ASSIGNMENTS EN LOS BATCHES
    // ========================================================================
    for (const batchId of createdBatchIds) {
      const { count: pendingCount } = await supabase
        .from("commission_details")
        .select("*", { count: "exact", head: true })
        .eq("batch_id", batchId)
        .eq("pending_assignment", true);

      await supabase
        .from("commission_batches")
        .update({ pending_assignments_count: pendingCount || 0 })
        .eq("id", batchId);
    }

    // ========================================================================
    // ACTUALIZAR CONVERSION JOB
    // ========================================================================
    await supabase
      .from("conversion_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        conversion_report: {
          total_source_items: sourceCount,
          valid_rows: validRows.length,
          warning_rows: warningRows.length,
          discarded_rows: discardedRows.length,
          total_inserted: totalInsertedItems,
          batches_created: createdBatches.length,
          discard_report: discardReport,
          format_detection: formatDetection
        }
      })
      .eq("id", conversionJobId);

    return new Response(JSON.stringify({
      success: true,
      conversionJobId,
      batches: createdBatches,
      summary: {
        totalSourceItems: sourceCount,
        validRows: validRows.length,
        warningRows: warningRows.length,
        discardedRows: discardedRows.length,
        insertedItems: totalInsertedItems,
        batchesCreated: createdBatches.length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[Conversion] Fatal error:", error);

    if (supabase && conversionJobId) {
      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "FATAL_ERROR",
          error_message: error.message || "Error desconocido"
        })
        .eq("id", conversionJobId);
    }

    return new Response(JSON.stringify({
      success: false,
      code: "FATAL_ERROR",
      message: error.message || "Error fatal durante la conversión",
      error: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
