import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================================
// SERVICIO DE INGESTA UNIFICADO (Deno version)
// Mismo que commissionIngestionService.ts pero compatible con Deno
// ============================================================================

interface StandardCommissionRow {
  fpago: string | null;
  agent_email: string;
  vendor_name_raw?: string;
  vendor_key: string;
  ramo: string;
  aseguradora: string;
  importe_base: number;
  porcentaje: number;
  poliza: string;
  endoso?: string;
  comision_calculada: number;
  prima_neta_info?: number;
  nombre_asegurado?: string;
  concepto?: string;
}

interface DiscardReport {
  invalid_importe: number;
  invalid_porpart: number;
  missing_ramo: number;
  missing_poliza: number;
  missing_aseguradora_warnings: number;
  missing_email_warnings: number;
  examples: Array<{
    rowIndex: number;
    reason: string;
    values: Record<string, any>;
  }>;
}

interface HeaderCheckResult {
  valid: boolean;
  detected: string[];
  normalized: string[];
  missing: string[];
  mapped: Record<string, string>;
}

// ============================================================================
// MAPEO DE COLUMNAS CON SINÓNIMOS
// ============================================================================

/**
 * MAPPER UNIFICADO para múltiples formatos de Excel
 *
 * SOPORTA:
 * 1. Formato con Email (típico)
 * 2. Formato LOGEXPORT (sin email, usa VendNombre)
 *
 * FORMATO LOGEXPORT:
 * - Columnas: VendNombre, Documento, Endoso, CiaAbreviacion, Ramo, Importe, PorPart, FPago
 * - NO contiene Email del agente
 * - Identificador: VendNombre (nombre del vendedor)
 * - Los items sin email se marcan como pending_assignment = true
 * - vendor_key = "name:NOMBRE_NORMALIZADO"
 *
 * REGLA DE ORO:
 * En formato LOGEXPORT, VendNombre sustituye al Email.
 * El email no existe y nunca debe bloquear la conversión.
 */
function mapColumns(docData: Record<string, any>): Record<string, string> {
  const keys = Object.keys(docData);
  const result: Record<string, string> = {};

  // Diccionario de sinónimos
  const synonyms: Record<string, string[]> = {
    fpago: ['fpago', 'f.pago', 'fecha_pago', 'fecha pago', 'fechapago', 'fecha', 'date', 'fliquidacion', 'f.liquidacion'],
    email: ['email', 'correo', 'mail', 'correo_electronico', 'agent_email', 'email_agente', 'emailagente'],
    vendornombre: ['vendnombre', 'vend.nombre', 'vendedor', 'vendor', 'nombre_vendedor', 'agente', 'despnombre', 'desp.nombre'],
    ramo: ['ramo', 'rama', 'line', 'linea', 'tipo_seguro'],
    aseguradora: ['aseguradora', 'cia', 'ciaabreviacion', 'cia.abreviacion', 'insurer', 'company', 'compañia', 'compania'],
    importe: ['importe', 'amount', 'monto', 'valor', 'prima'],
    porpart: ['porpart', 'por.part', '% part', 'porcentaje', 'percentage', 'comision'],
    poliza: ['poliza', 'póliza', 'numero_poliza', 'num_poliza', 'policy', 'no_poliza', 'certificado', 'documento'],
    endoso: ['endoso', 'endorsement', 'end'],
    primaneta: ['prima_neta', 'primaneta', 'prima neta', 'netpremium'],
    nombreasegurado: ['nombre_asegurado', 'asegurado', 'nombre', 'insured_name', 'cliente', 'nombrecompleto', 'nombre.completo'],
    concepto: ['concepto', 'concept', 'descripcion', 'description', 'detalle']
  };

  for (const [field, syns] of Object.entries(synonyms)) {
    for (const key of keys) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const syn of syns) {
        const normalizedSyn = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalized === normalizedSyn || normalized.includes(normalizedSyn) || normalizedSyn.includes(normalized)) {
          result[field] = key;
          break;
        }
      }
      if (result[field]) break;
    }
  }

  return result;
}

// ============================================================================
// NORMALIZACIÓN
// ============================================================================

function normalizeEmail(value: any): string {
  if (!value) return '';
  return String(value).toLowerCase().trim();
}

function normalizeText(value: any): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return String(value).trim();
}

function normalizeName(value: any): string {
  if (!value) return '';
  return String(value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function createVendorKey(email?: string, name?: string): string {
  if (email && email.trim() !== '') {
    return `email:${email.toLowerCase().trim()}`;
  }
  if (name && name.trim() !== '') {
    return `name:${normalizeName(name)}`;
  }
  return 'unknown';
}

function normalizeNumeric(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const str = String(value).replace(/[^0-9.-]/g, '');
  return parseFloat(str) || 0;
}

function normalizeDate(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  const str = String(value).trim();
  if (!str) return null;
  
  // Intenta parsear varios formatos
  const datePatterns = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ];

  for (const pattern of datePatterns) {
    const match = str.match(pattern);
    if (match) {
      if (pattern.source.startsWith('^(\\d{4})')) {
        // Ya está en formato YYYY-MM-DD
        return str;
      } else {
        // Convertir DD/MM/YYYY o DD-MM-YYYY a YYYY-MM-DD
        const [, day, month, year] = match;
        return `${year}-${month}-${day}`;
      }
    }
  }

  // Si no coincide con ningún patrón, intentar parsearlo como fecha
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

// ============================================================================
// VALIDACIÓN DE HEADERS
// ============================================================================

function checkHeaders(firstDoc: any): HeaderCheckResult {
  const docData = firstDoc?.document_data || {};
  const keys = Object.keys(docData);
  const mapped = mapColumns(docData);

  const normalized = keys.map(k => k.toLowerCase().trim());

  // Solo campos realmente obligatorios para calcular comisión
  // NOTA: poliza puede venir como "Documento" en algunos archivos
  const requiredFields = ['importe', 'porpart', 'ramo', 'poliza'];
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (!mapped[field]) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    detected: keys,
    normalized,
    missing,
    mapped
  };
}

type ParseStatus = "valid" | "warning" | "discard";

interface ParseResult {
  row: StandardCommissionRow | null;
  status: ParseStatus;
  warnings: string[];
  errors: string[];
}

/**
 * Parsea una fila de documento importado al modelo estándar
 *
 * REGLA DE ORO: Comisión = Importe × (PorPart / 100)
 *
 * SOPORTA FORMATO LOGEXPORT:
 * - Archivos SIN email del agente
 * - Identificación por VendNombre
 * - Items sin email se marcan como pending_assignment = true
 * - vendor_key = "name:NOMBRE_NORMALIZADO" (sin email)
 *
 * REGLAS DE NEGOCIO:
 * 1. Email NO es obligatorio (se marca como pending_assignment)
 * 2. VendNombre se usa para agrupar y asignar manualmente
 * 3. Importe puede ser negativo (ajustes, cancelaciones, reversos)
 * 4. Aseguradora puede estar vacía (se usa "NO_ESPECIFICADA")
 * 5. FPago puede ser NULL (va al lote "Sin fecha")
 *
 * SOLO SE DESCARTA si NO se puede calcular comisión:
 * - Importe inválido (NaN)
 * - PorPart inválido (NaN)
 * - Ramo vacío
 * - Póliza vacía
 *
 * RETORNA:
 * - status: "discard" si no se puede calcular comisión
 * - status: "warning" si tiene advertencias pero SÍ se puede insertar
 * - status: "valid" si no tiene advertencias
 */
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

  // Normalizar
  const fpago = normalizeDate(fpagoRaw);
  const agent_email = normalizeEmail(emailRaw);
  const vendor_name_raw = vendorNombreRaw ? normalizeText(vendorNombreRaw) : undefined;
  const ramo = normalizeText(ramoRaw);
  let aseguradora = normalizeText(aseguradoraRaw);
  const importe_base = normalizeNumeric(importeRaw);
  const porcentaje = normalizeNumeric(porpartRaw);
  const poliza = normalizeText(polizaRaw);
  const endoso = endosoRaw ? normalizeText(endosoRaw) : undefined;

  const prima_neta_info = primaNetaRaw ? normalizeNumeric(primaNetaRaw) : undefined;
  const nombre_asegurado = nombreAseguradoRaw ? normalizeText(nombreAseguradoRaw) : undefined;
  const concepto = conceptoRaw ? normalizeText(conceptoRaw) : undefined;

  // Crear vendor_key: priorizar email, luego nombre, luego unknown
  // FORMATO LOGEXPORT: usa VendNombre cuando no hay email
  // vendor_key = "email:xxx@mail.com" o "name:JUAN PEREZ" o "unknown"
  const vendor_key = createVendorKey(agent_email, vendor_name_raw);

  // Validar SOLO campos realmente obligatorios para calcular comisión
  let discardReason = '';

  // 1. Ramo es obligatorio
  if (!ramo || ramo === '') {
    errors.push(`Ramo vacío: ${ramoRaw}`);
    discardReport.missing_ramo++;
    discardReason = 'missing_ramo';
  }

  // 2. Importe debe ser numérico (puede ser negativo para ajustes/cancelaciones)
  if (importeRaw === null || importeRaw === undefined || importeRaw === '' || isNaN(importe_base)) {
    errors.push(`Importe inválido (no numérico): ${importeRaw}`);
    discardReport.invalid_importe++;
    discardReason = discardReason || 'invalid_importe';
  }

  // 3. PorPart debe ser numérico
  if (porpartRaw === null || porpartRaw === undefined || porpartRaw === '' || isNaN(porcentaje)) {
    errors.push(`PorPart inválido (no numérico): ${porpartRaw}`);
    discardReport.invalid_porpart++;
    discardReason = discardReason || 'invalid_porpart';
  }

  // 4. Póliza es obligatoria
  if (!poliza || poliza === '') {
    errors.push(`Póliza vacía: ${polizaRaw}`);
    discardReport.missing_poliza++;
    discardReason = discardReason || 'missing_poliza';
  }

  // ========================================================================
  // ADVERTENCIAS (NO BLOQUEAN conversión - la fila SÍ se inserta)
  // ========================================================================

  // Email vacío -> warning, NO error
  // FORMATO LOGEXPORT: Esto es NORMAL, se usa VendNombre en su lugar
  if (!agent_email || agent_email === '') {
    warnings.push('Email faltante - se marcará como pendiente de asignación');
    discardReport.missing_email_warnings++;
    // La fila SÍ se insertará con pending_assignment = true
    // vendor_key usará el nombre: "name:VENDEDOR"
  }

  // Aseguradora vacía -> usar default, NO error
  if (!aseguradora || aseguradora === '') {
    aseguradora = 'NO_ESPECIFICADA';
    warnings.push('Aseguradora faltante - se usará "NO_ESPECIFICADA"');
    discardReport.missing_aseguradora_warnings++;
  }

  // Si hay errores bloqueantes, DISCARD
  if (errors.length > 0) {
    if (discardReport.examples.length < 10) {
      discardReport.examples.push({
        rowIndex,
        reason: discardReason,
        values: {
          email: emailRaw,
          ramo: ramoRaw,
          aseguradora: aseguradoraRaw,
          importe: importeRaw,
          porpart: porpartRaw,
          poliza: polizaRaw
        }
      });
    }
    return { row: null, status: "discard", warnings: [], errors };
  }

  // CÁLCULO CORRECTO: Comisión = Importe × (PorPart / 100)
  // Importe puede ser negativo (ajustes, cancelaciones)
  const comision_calculada = importe_base * (porcentaje / 100);

  // ========================================================================
  // CONSTRUCCIÓN DEL ROW - FUNCIONA CON Y SIN EMAIL
  // ========================================================================
  const parsedRow: StandardCommissionRow = {
    fpago,
    agent_email: agent_email || '',  // Puede estar vacío (FORMATO LOGEXPORT)
    vendor_name_raw,  // VendNombre del Excel (para agrupar y asignar manualmente)
    vendor_key,  // "email:xxx" o "name:YYY" o "unknown" (para matching)
    ramo: ramo!,
    aseguradora: aseguradora!,  // Siempre tiene valor (default si vacío)
    importe_base,  // Puede ser negativo
    porcentaje,
    poliza: poliza!,
    endoso,  // Opcional (común en LOGEXPORT)
    comision_calculada,  // Puede ser negativa
    prima_neta_info,
    nombre_asegurado,
    concepto
  };

  // Determinar status: "warning" si hay advertencias, "valid" si no
  const status: ParseStatus = warnings.length > 0 ? "warning" : "valid";

  return {
    row: parsedRow,
    status,
    warnings,
    errors: []
  };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function getWeekInfo(dateStr: string): {
  week_number: number;
  period_start: string;
  period_end: string;
} {
  const date = new Date(dateStr + 'T00:00:00Z');
  const firstDayOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((dayOfYear + firstDayOfYear.getUTCDay() + 1) / 7);

  const startOfWeek = new Date(date);
  startOfWeek.setUTCDate(date.getUTCDate() - date.getUTCDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);

  return {
    week_number: weekNumber,
    period_start: startOfWeek.toISOString().split('T')[0],
    period_end: endOfWeek.toISOString().split('T')[0]
  };
}

/**
 * Detecta automáticamente si un lote de documentos es formato LOGEXPORT
 *
 * LOGEXPORT se detecta cuando:
 * - Existe columna VendNombre (o variantes)
 * - Existen columnas obligatorias: Documento, Ramo, Importe, PorPart
 * - Email está ausente o vacío en la mayoría de filas
 */
function detectFormatLOGEXPORT(documents: any[]): {
  isLogExport: boolean;
  confidence: number;
  details: {
    hasVendNombre: boolean;
    hasRequiredFields: boolean;
    emailMissingRatio: number;
    totalRows: number;
    rowsWithoutEmail: number;
  };
} {
  if (!documents || documents.length === 0) {
    return {
      isLogExport: false,
      confidence: 0,
      details: {
        hasVendNombre: false,
        hasRequiredFields: false,
        emailMissingRatio: 0,
        totalRows: 0,
        rowsWithoutEmail: 0
      }
    };
  }

  const sampleDoc = documents[0].document_data || {};
  const keys = Object.keys(sampleDoc).map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Verificar VendNombre
  const hasVendNombre = keys.some(k =>
    k.includes('vendnombre') || k.includes('vendedor') || k.includes('despnombre')
  );

  // Verificar campos obligatorios
  const hasDocumento = keys.some(k => k.includes('documento') || k.includes('poliza'));
  const hasRamo = keys.some(k => k.includes('ramo'));
  const hasImporte = keys.some(k => k.includes('importe') || k.includes('monto'));
  const hasPorPart = keys.some(k => k.includes('porpart') || k.includes('porcentaje'));
  const hasRequiredFields = hasDocumento && hasRamo && hasImporte && hasPorPart;

  // Contar filas sin email
  let rowsWithoutEmail = 0;
  for (const doc of documents) {
    const mapped = mapColumns(doc.document_data || {});
    const emailValue = mapped.email ? doc.document_data[mapped.email] : null;
    const vendorEmail = doc.vendor_email_raw;

    if (!emailValue && !vendorEmail) {
      rowsWithoutEmail++;
    }
  }

  const emailMissingRatio = documents.length > 0 ? rowsWithoutEmail / documents.length : 0;

  // LOGEXPORT si:
  // - Tiene VendNombre
  // - Tiene campos obligatorios
  // - >50% de filas sin email
  const isLogExport = hasVendNombre && hasRequiredFields && emailMissingRatio > 0.5;
  const confidence = isLogExport ?
    Math.min((hasVendNombre ? 40 : 0) + (hasRequiredFields ? 30 : 0) + (emailMissingRatio * 30), 100) :
    0;

  return {
    isLogExport,
    confidence,
    details: {
      hasVendNombre,
      hasRequiredFields,
      emailMissingRatio,
      totalRows: documents.length,
      rowsWithoutEmail
    }
  };
}

/**
 * Aplica mappings persistentes existentes a las filas parseadas
 * antes de insertar en commission_details
 */
async function applyPersistentMappings(
  supabase: any,
  rows: StandardCommissionRow[]
): Promise<{
  rows: StandardCommissionRow[];
  appliedCount: number;
  mappings: Record<string, any>;
}> {
  // Obtener todos los vendor_keys únicos que necesitan mapping
  const vendorKeys = [...new Set(rows
    .filter(r => r.vendor_key && r.vendor_key !== 'unknown')
    .map(r => r.vendor_key))];

  if (vendorKeys.length === 0) {
    return { rows, appliedCount: 0, mappings: {} };
  }

  // Buscar mappings persistentes existentes
  const { data: mappings, error } = await supabase
    .from("vendor_mapping_persistent")
    .select("*")
    .in("vendor_key", vendorKeys)
    .eq("is_active", true);

  if (error || !mappings || mappings.length === 0) {
    console.log("[Mapping] No persistent mappings found");
    return { rows, appliedCount: 0, mappings: {} };
  }

  console.log(`[Mapping] Found ${mappings.length} persistent mappings to apply`);

  // Crear lookup de mappings
  const mappingLookup: Record<string, any> = {};
  for (const mapping of mappings) {
    mappingLookup[mapping.vendor_key] = mapping;
  }

  // Aplicar mappings a las filas
  let appliedCount = 0;
  const updatedRows = rows.map(row => {
    const mapping = mappingLookup[row.vendor_key];
    if (mapping) {
      appliedCount++;
      return {
        ...row,
        agent_email: mapping.movi_user_id ? '' : row.agent_email, // Si hay mapping, limpiar email
        // El agent_id se asignará en el insert
      };
    }
    return row;
  });

  // Actualizar contadores de uso
  for (const mapping of mappings) {
    await supabase
      .from("vendor_mapping_persistent")
      .update({
        usage_count: mapping.usage_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq("id", mapping.id);
  }

  return { rows: updatedRows, appliedCount, mappings: mappingLookup };
}

async function insertItemsInChunks(
  supabase: any,
  items: any[]
): Promise<{ insertedCount: number; errors: any[] }> {
  const CHUNK_SIZE = 200;
  let insertedCount = 0;
  const errors: any[] = [];

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("commission_details")
      .insert(chunk)
      .select();

    if (error) {
      console.error(`[Batch Insert] Error inserting chunk ${i}-${i + chunk.length}:`, error);
      errors.push({ chunk_start: i, error });
    } else {
      insertedCount += data?.length || 0;
    }
  }

  return { insertedCount, errors };
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req: Request) => {
  // GARANTÍA: SIEMPRE devolver JSON, incluso en errores catastróficos
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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Parsear request body con manejo de errores
    let body: any;
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        return new Response(JSON.stringify({
          error: "Request body is empty",
          code: "EMPTY_REQUEST"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      body = JSON.parse(text);
    } catch (parseError: any) {
      console.error("[Conversion] JSON parse error:", parseError);
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body",
        code: "INVALID_JSON",
        details: parseError.message
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const batchId = body?.batch_id;

    if (!batchId) {
      return new Response(JSON.stringify({
        error: "batch_id is required",
        code: "MISSING_BATCH_ID"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Conversion] Starting conversion for batch ${batchId}`);

    // Verificar que el batch existe
    const { data: batch, error: batchError } = await supabase
      .from("document_import_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return new Response(JSON.stringify({ error: "Batch not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (batch.converted_to_commissions) {
      return new Response(JSON.stringify({
        error: "Batch already converted",
        converted_at: batch.converted_at
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Crear registro de job
    const { data: job, error: jobError } = await supabase
      .from("conversion_jobs")
      .insert({
        batch_id: batchId,
        started_by: user.id,
        status: "running",
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error("Failed to create conversion job");
    }

    conversionJobId = job.id;

    // Pre-check: contar documentos fuente
    const { count: sourceCount, error: countError } = await supabase
      .from("imported_documents")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", batchId);

    if (countError) {
      throw new Error("Failed to count source documents");
    }

    if (sourceCount === 0) {
      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "NO_SOURCE_DOCUMENTS",
          error_message: "No hay documentos en el lote de origen"
        })
        .eq("id", conversionJobId);

      return new Response(JSON.stringify({
        success: false,
        code: "NO_SOURCE_DOCUMENTS",
        message: "No hay documentos en el lote de origen"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Conversion] Found ${sourceCount} source documents`);

    // Obtener documentos
    const { data: documents, error: docsError } = await supabase
      .from("imported_documents")
      .select("*")
      .eq("batch_id", batchId);

    if (docsError || !documents) {
      throw new Error("Failed to fetch documents");
    }

    console.log(`[Conversion] Processing ${documents.length} documents...`);

    // ========================================================================
    // DETECCIÓN AUTOMÁTICA DE FORMATO LOGEXPORT
    // ========================================================================
    const formatDetection = detectFormatLOGEXPORT(documents);
    console.log('[Format Detection]', formatDetection);

    if (formatDetection.isLogExport) {
      console.log(`✅ FORMATO LOGEXPORT DETECTADO (confidence: ${formatDetection.confidence}%)`);
      console.log(`   - VendNombre: ${formatDetection.details.hasVendNombre ? 'YES' : 'NO'}`);
      console.log(`   - Required fields: ${formatDetection.details.hasRequiredFields ? 'YES' : 'NO'}`);
      console.log(`   - Email missing ratio: ${(formatDetection.details.emailMissingRatio * 100).toFixed(1)}%`);
      console.log(`   - Rows without email: ${formatDetection.details.rowsWithoutEmail}/${formatDetection.details.totalRows}`);
      console.log('');
      console.log('🔑 REGLA DE ORO: En formato LOGEXPORT, VendNombre sustituye al Email.');
      console.log('   La falta de email NUNCA bloqueará la conversión.');
      console.log('');
    } else {
      console.log('ℹ️  Formato estándar detectado (con email)');
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
      console.log(`✅ Applied ${mappingResult.appliedCount} persistent mappings`);
      console.log(`   Mappings used:`, Object.keys(mappingResult.mappings));
    } else {
      console.log('ℹ️  No persistent mappings to apply');
    }

    // Self-check: detectar inconsistencia lógica
    if (parsedRows.length === 0 && discardedRows.length === 0 && warningRows.length > 0) {
      console.error('[SELF-CHECK FAILED] Inconsistencia: warningRows > 0 pero parsedRows = 0. Bug en construcción de itemsToInsert.');
      throw new Error('SELF-CHECK FAILED: Las filas con warnings no se están incluyendo en parsedRows. Revisar lógica.');
    }

    if (parsedRows.length === 0) {
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
            parse_errors: discardedRows.slice(0, 10)
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
          parseErrors: discardedRows.slice(0, 5)
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Agrupar por semana usando FPago
    const weekGroups: Record<string, { week_number: number; period_start: string; period_end: string; rows: StandardCommissionRow[] }> = {};
    const noDateRows: StandardCommissionRow[] = [];

    for (const row of parsedRows) {
      // Si FPago es null, va directo al lote "Sin fecha"
      if (!row.fpago) {
        noDateRows.push(row);
        continue;
      }

      try {
        const weekInfo = getWeekInfo(row.fpago);
        const key = `${weekInfo.week_number}-${weekInfo.period_start}`;

        if (!weekGroups[key]) {
          weekGroups[key] = {
            week_number: weekInfo.week_number,
            period_start: weekInfo.period_start,
            period_end: weekInfo.period_end,
            rows: []
          };
        }

        weekGroups[key].rows.push(row);
      } catch (error) {
        console.error(`[Conversion] Error parsing week for fpago ${row.fpago}:`, error);
        noDateRows.push(row);
      }
    }

    console.log(`[Conversion] Grouped into ${Object.keys(weekGroups).length} weeks, ${noDateRows.length} without date`);

    const createdBatches: any[] = [];
    const createdBatchIds: string[] = [];
    let totalInsertedItems = 0;

    // Crear lote "Sin fecha" si hay
    if (noDateRows.length > 0) {
      console.log(`[Conversion] Creating no-date batch with ${noDateRows.length} items`);

      const { data: noDateBatch, error: createError } = await supabase
        .from("commission_batches")
        .insert({
          name: "Sin fecha (FPago no definido)",
          date_from: null,
          date_to: null,
          uploaded_by: user.id,
          status: "draft",
          source_type: "excel_import",
          source_id: batchId,
          week_number: 0,
          converted_from_import_at: new Date().toISOString(),
          converted_by: user.id
        })
        .select()
        .single();

      if (createError || !noDateBatch) {
        throw new Error(`Failed to create no-date batch: ${createError?.message}`);
      }

      createdBatchIds.push(noDateBatch.id);

      // Preparar items para inserción
      const itemsToInsert = noDateRows.map(row => {
        const hasEmail = row.agent_email && row.agent_email !== '';

        // Verificar si existe mapping persistente para este vendor_key
        const persistentMapping = mappingResult.mappings[row.vendor_key];

        let agent_id = null;
        let movi_user_id = null;
        let matchMethod = 'none';
        let isPending = true;

        if (persistentMapping && persistentMapping.movi_user_id) {
          // Aplicar mapping persistente
          agent_id = persistentMapping.movi_user_id;
          movi_user_id = persistentMapping.movi_user_id;
          matchMethod = 'manual';
          isPending = false;
        } else if (hasEmail) {
          // Tiene email, intentar match automático (por ahora pending)
          matchMethod = 'email';
          isPending = true;
        } else {
          // Sin email ni mapping = pending
          matchMethod = 'name_only';
          isPending = true;
        }

        return {
          batch_id: noDateBatch.id,
          agent_id,
          movi_user_id,
          poliza: row.poliza,
          endoso: row.endoso || null,
          nombre_asegurado: row.nombre_asegurado || null,
          ramo: row.ramo,
          aseguradora: row.aseguradora,
          prima_neta: row.prima_neta_info || 0,
          prima_neta_info: row.prima_neta_info || null,
          importe_base: row.importe_base,
          porcentaje_comision: row.porcentaje,
          porcentaje: row.porcentaje,
          concepto: row.concepto || null,
          fpago: row.fpago,
          commission_bruta: row.comision_calculada,
          commission_calculada: row.comision_calculada,
          commission_neta: row.comision_calculada,
          vendor_email_raw: row.agent_email || null,
          vendor_email_norm: row.agent_email ? row.agent_email.toLowerCase() : null,
          vendor_name_raw: row.vendor_name_raw || null,
          vendor_name_norm: row.vendor_name_raw ? normalizeName(row.vendor_name_raw) : null,
          vendor_key: row.vendor_key,
          match_method: matchMethod,
          pending_assignment: isPending,
          assignment_status: isPending ? 'pending' : 'assigned',
          raw_row: {}
        };
      });

      const insertResult = await insertItemsInChunks(supabase, itemsToInsert);
      totalInsertedItems += insertResult.insertedCount;

      if (insertResult.insertedCount === 0) {
        await supabase.from("commission_batches").delete().eq("id", noDateBatch.id);
      } else {
        createdBatches.push({
          id: noDateBatch.id,
          week_number: 0,
          period_start: null,
          period_end: null,
          display_name: "Sin fecha (FPago no definido)",
          items: insertResult.insertedCount
        });
      }
    }

    // Crear lotes por semana
    for (const [key, group] of Object.entries(weekGroups)) {
      if (group.rows.length === 0) continue;

      console.log(`[Conversion] Creating batch for week ${group.week_number} with ${group.rows.length} items`);

      const batchName = `Semana ${group.week_number} (${group.period_start} a ${group.period_end})`;

      const { data: weekBatch, error: createError } = await supabase
        .from("commission_batches")
        .insert({
          name: batchName,
          date_from: group.period_start,
          date_to: group.period_end,
          uploaded_by: user.id,
          status: "draft",
          source_type: "excel_import",
          source_id: batchId,
          week_number: group.week_number,
          period_start: group.period_start,
          period_end: group.period_end,
          converted_from_import_at: new Date().toISOString(),
          converted_by: user.id
        })
        .select()
        .single();

      if (createError || !weekBatch) {
        console.error(`[Conversion] Failed to create week batch: ${createError?.message}`);
        continue;
      }

      createdBatchIds.push(weekBatch.id);

      // Preparar items
      const itemsToInsert = group.rows.map(row => {
        const hasEmail = row.agent_email && row.agent_email !== '';

        // Verificar si existe mapping persistente para este vendor_key
        const persistentMapping = mappingResult.mappings[row.vendor_key];

        let agent_id = null;
        let movi_user_id = null;
        let matchMethod = 'none';
        let isPending = true;

        if (persistentMapping && persistentMapping.movi_user_id) {
          // Aplicar mapping persistente
          agent_id = persistentMapping.movi_user_id;
          movi_user_id = persistentMapping.movi_user_id;
          matchMethod = 'manual';
          isPending = false;
        } else if (hasEmail) {
          // Tiene email, intentar match automático (por ahora pending)
          matchMethod = 'email';
          isPending = true;
        } else {
          // Sin email ni mapping = pending
          matchMethod = 'name_only';
          isPending = true;
        }

        return {
          batch_id: weekBatch.id,
          agent_id,
          movi_user_id,
          poliza: row.poliza,
          endoso: row.endoso || null,
          nombre_asegurado: row.nombre_asegurado || null,
          ramo: row.ramo,
          aseguradora: row.aseguradora,
          prima_neta: row.prima_neta_info || 0,
          prima_neta_info: row.prima_neta_info || null,
          importe_base: row.importe_base,
          porcentaje_comision: row.porcentaje,
          porcentaje: row.porcentaje,
          concepto: row.concepto || null,
          fpago: row.fpago,
          commission_bruta: row.comision_calculada,
          commission_calculada: row.comision_calculada,
          commission_neta: row.comision_calculada,
          vendor_email_raw: row.agent_email || null,
          vendor_email_norm: row.agent_email ? row.agent_email.toLowerCase() : null,
          vendor_name_raw: row.vendor_name_raw || null,
          vendor_name_norm: row.vendor_name_raw ? normalizeName(row.vendor_name_raw) : null,
          vendor_key: row.vendor_key,
          match_method: matchMethod,
          pending_assignment: isPending,
          assignment_status: isPending ? 'pending' : 'assigned',
          raw_row: {}
        };
      });

      const insertResult = await insertItemsInChunks(supabase, itemsToInsert);
      totalInsertedItems += insertResult.insertedCount;

      if (insertResult.insertedCount === 0) {
        await supabase.from("commission_batches").delete().eq("id", weekBatch.id);
      } else {
        createdBatches.push({
          id: weekBatch.id,
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
            discarded_rows: discardedRows.slice(0, 10)
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
          insertedItems: totalInsertedItems,
          discarded: discardReport
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

      const hasPending = (pendingCount || 0) > 0;

      await supabase
        .from("commission_batches")
        .update({
          has_pending_assignments: hasPending,
          pending_count: pendingCount || 0
        })
        .eq("id", batchId);
    }

    // Marcar batch como convertido
    await supabase
      .from("document_import_batches")
      .update({
        converted_to_commissions: true,
        converted_at: new Date().toISOString(),
        converted_by: user.id,
        commission_batch_ids: createdBatchIds
      })
      .eq("id", batchId);

    // Actualizar job
    await supabase
      .from("conversion_jobs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        total_inserted_items: totalInsertedItems,
        created_batch_count: createdBatches.length,
        created_batch_ids: createdBatchIds,
        conversion_report: {
          batches: createdBatches,
          summary: {
            sourceCount,
            validRows: validRows.length,
            warningRows: warningRows.length,
            discardedRows: discardedRows.length,
            parsedCount: parsedRows.length,
            insertedCount: totalInsertedItems
          },
          format_detection: formatDetection,
          persistent_mappings: {
            applied_count: mappingResult.appliedCount,
            mapping_keys: Object.keys(mappingResult.mappings)
          },
          discard_report: discardReport
        }
      })
      .eq("id", conversionJobId);

    return new Response(JSON.stringify({
      success: true,
      job_id: conversionJobId,
      format: formatDetection.isLogExport ? 'LOGEXPORT' : 'STANDARD',
      formatDetection: formatDetection,
      persistentMappings: {
        appliedCount: mappingResult.appliedCount,
        mappingKeys: Object.keys(mappingResult.mappings)
      },
      totalSourceRows: sourceCount,
      validRows: validRows.length,
      warningRows: warningRows.length,
      discardedRows: discardedRows.length,
      discarded: discardReport,
      createdBatches,
      totalInsertedItems
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8"
      }
    });

  } catch (error: any) {
    console.error("[Conversion] Error:", error);

    // Determinar código de error
    const errorCode = error.code || error.constraint || "INTERNAL_ERROR";
    const errorMessage = error.message || "Error desconocido al convertir el lote";

    // Actualizar job si existe
    if (conversionJobId && supabase) {
      try {
        await supabase
          .from("conversion_jobs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            error_code: errorCode,
            error_message: errorMessage,
            error_stack: error.stack || null
          })
          .eq("id", conversionJobId);
      } catch (updateError) {
        console.error("[Conversion] Failed to update job:", updateError);
      }
    }

    // GARANTÍA: SIEMPRE devolver JSON válido, incluso en errores catastróficos
    return new Response(JSON.stringify({
      success: false,
      job_id: conversionJobId || null,
      code: errorCode,
      message: errorMessage,
      details: {
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      }
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  }
});
