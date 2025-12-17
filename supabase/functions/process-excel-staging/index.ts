import { createClient } from 'npm:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ParsedExcel {
  sheetNameUsed: string;
  headersOriginal: string[];
  headersNormalizedMap: Record<string, string>;
  rows: Record<string, any>[];
  totalRowsRead: number;
  debugInfo: {
    allSheetNames: string[];
    rowCountPerSheet: Record<string, number>;
    detectedColumns: {
      emailAgente?: string;
      vendNombre?: string;
    };
  };
}

function normalizeHeader(header: string): string {
  if (!header) return '';
  let normalized = header.toString().trim().toLowerCase();
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  normalized = normalized.replace(/[\s\-_.]/g, '');
  return normalized;
}

function calculateVendorKey(vendorNameNorm: string | null): string {
  if (vendorNameNorm && vendorNameNorm.trim() !== '') {
    return `name:${vendorNameNorm}`;
  }
  return 'unknown';
}

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

function parseExcelUnified(fileBuffer: ArrayBuffer): ParsedExcel {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas');
  }

  let bestSheet: { name: string; rowCount: number } | null = null;
  const rowCountPerSheet: Record<string, number> = {};

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    const rowCount = jsonData.length;
    rowCountPerSheet[sheetName] = rowCount;

    if (!bestSheet || rowCount > bestSheet.rowCount) {
      bestSheet = { name: sheetName, rowCount };
    }
  }

  if (!bestSheet) {
    throw new Error('No se pudo determinar la hoja con más datos');
  }

  const sheet = workbook.Sheets[bestSheet.name];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false, blankrows: true });

  if (jsonData.length === 0) {
    throw new Error(`La hoja "${bestSheet.name}" no contiene datos`);
  }

  const firstRow = jsonData[0] as Record<string, any>;
  const headersOriginal = Object.keys(firstRow);

  const headersNormalizedMap: Record<string, string> = {};
  for (const header of headersOriginal) {
    const normalized = normalizeHeader(header);
    if (normalized) {
      headersNormalizedMap[normalized] = header;
    }
  }

  const detectedColumns: { emailAgente?: string; vendNombre?: string } = {};

  if (headersNormalizedMap['emailagente']) {
    detectedColumns.emailAgente = headersNormalizedMap['emailagente'];
  }

  if (headersNormalizedMap['vendnombre']) {
    detectedColumns.vendNombre = headersNormalizedMap['vendnombre'];
  }

  const rows = jsonData.map(row => {
    const normalizedRow: Record<string, any> = {};
    for (const [key, value] of Object.entries(row as Record<string, any>)) {
      normalizedRow[key] = value;
    }
    return normalizedRow;
  });

  return {
    sheetNameUsed: bestSheet.name,
    headersOriginal,
    headersNormalizedMap,
    rows,
    totalRowsRead: rows.length,
    debugInfo: {
      allSheetNames: sheetNames,
      rowCountPerSheet,
      detectedColumns,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('[process-excel-staging] Auth header present:', !!authHeader);

    if (!authHeader) {
      throw new Error('No autorizado - falta token de autenticación');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    console.log('[process-excel-staging] Creating Supabase client for auth verification...');

    // Create client with user's JWT to verify authentication
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    console.log('[process-excel-staging] Verifying user token...');

    // Verify JWT and get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError) {
      console.error('[process-excel-staging] Auth error details:', {
        message: userError.message,
        name: userError.name,
        status: userError.status,
      });
      throw new Error(`No autorizado - error de sesión: ${userError.message}`);
    }

    if (!user) {
      console.error('[process-excel-staging] No user returned from getUser()');
      throw new Error('No autorizado - sesión inválida o expirada');
    }

    console.log('[process-excel-staging] User authenticated successfully:', user.id, user.email);

    // Use service role client for database operations (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check user role using service role client (bypass RLS)
    const { data: userData, error: roleError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    if (roleError) {
      console.error('[process-excel-staging] Error fetching user role:', roleError);
      throw new Error('Error al verificar permisos');
    }

    if (!userData || userData.rol !== 'Administrador') {
      console.error('[process-excel-staging] User is not admin:', userData?.rol);
      throw new Error('Solo administradores pueden cargar comisiones');
    }

    console.log('[process-excel-staging] Authorized admin user:', user.id);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string || file?.name || 'sin-nombre.xlsx';

    if (!file) {
      throw new Error('No se recibió archivo');
    }

    console.log('[process-excel-staging] File received:', fileName, 'Size:', file.size);

    const fileBuffer = await file.arrayBuffer();
    const parsed = parseExcelUnified(fileBuffer);

    console.log('[process-excel-staging] Excel parsed:', {
      sheetUsed: parsed.sheetNameUsed,
      totalRows: parsed.totalRowsRead,
      headers: parsed.headersOriginal.length,
      headersOriginal: parsed.headersOriginal,
      detectedColumns: parsed.debugInfo.detectedColumns,
    });

    if (parsed.rows.length > 0) {
      console.log('[process-excel-staging] First row sample:', parsed.rows[0]);
    }

    if (!parsed.debugInfo.detectedColumns.vendNombre) {
      throw new Error(`No se encontró la columna VendNombre en el Excel. Este campo es obligatorio. Columnas encontradas: ${parsed.headersOriginal.join(', ')}`);
    }

    // supabase client already initialized above with service role

    const { data: session, error: sessionError } = await supabase
      .from('commission_staging_sessions')
      .insert({
        file_name: fileName,
        file_size: file.size,
        sheet_name_used: parsed.sheetNameUsed,
        total_rows_read: parsed.totalRowsRead,
        headers_detected: parsed.headersOriginal,
        status: 'processing',
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (sessionError || !session) {
      throw new Error(`Error al crear sesión: ${sessionError?.message || 'null'}`);
    }

    console.log('[process-excel-staging] Session created:', session.id);

    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, nombre_completo_norm')
      .not('nombre_completo_norm', 'is', null);

    const usuariosMap = new Map();
    if (usuarios) {
      usuarios.forEach(u => {
        if (u.nombre_completo_norm) {
          usuariosMap.set(u.nombre_completo_norm, u);
        }
      });
    }

    const { data: vendorMappings } = await supabase
      .from('vendor_mappings')
      .select('source_type, source_value, movi_user_id')
      .eq('status', 'active');

    const mappingsMap = new Map<string, string>();
    if (vendorMappings) {
      vendorMappings.forEach(m => {
        const key = `${m.source_type}:${m.source_value}`;
        mappingsMap.set(key, m.movi_user_id);
      });
    }

    console.log('[process-excel-staging] Loaded:', usuarios?.length || 0, 'users,', mappingsMap.size, 'mappings');

    const itemsToInsert: any[] = [];

    for (const row of parsed.rows) {
      const vendorNameRaw = row[parsed.debugInfo.detectedColumns.vendNombre!] || '';

      let vendorNameNorm: string | null = null;
      let moviUserId: string | null = null;
      let matchMethod: string = 'none';

      if (vendorNameRaw && vendorNameRaw.trim() !== '') {
        const { data: normalizedData, error: normError } = await supabase.rpc('normalize_person_name', {
          name_input: vendorNameRaw
        });

        if (!normError && normalizedData) {
          vendorNameNorm = normalizedData;
        }
      }

      const vendorKey = calculateVendorKey(vendorNameNorm);

      if (vendorNameNorm) {
        const persistentMatch = mappingsMap.get(vendorKey);
        if (persistentMatch) {
          moviUserId = persistentMatch;
          matchMethod = 'mapping_name';
        } else {
          const exactMatch = usuariosMap.get(vendorNameNorm);
          if (exactMatch) {
            moviUserId = exactMatch.id;
            matchMethod = 'auto_exact';
          } else {
            let bestMatch: { userId: string; confidence: number } | null = null;

            for (const [userNameNorm, userData] of usuariosMap) {
              const { data: similarity, error: simError } = await supabase.rpc('name_similarity', {
                name1: vendorNameNorm,
                name2: userNameNorm
              });

              if (!simError && similarity && similarity >= 92) {
                if (!bestMatch || similarity > bestMatch.confidence) {
                  bestMatch = { userId: userData.id, confidence: similarity };
                }
              }
            }

            if (bestMatch) {
              moviUserId = bestMatch.userId;
              matchMethod = `auto_fuzzy_${bestMatch.confidence}`;
            }
          }
        }
      }

      const pendingAssignment = moviUserId === null;

      const poliza = row['Poliza'] || row['Documento'] || row['Póliza'] || '';
      const ramo = row['Ramo'] || '';
      const aseguradora = row['Aseguradora'] || row['CiaAbreviacion'] || '';

      // CRÍTICO: Separar Importe (base comisión) de PrimaNeta (informativo)
      // Importe es la BASE de cálculo: Comisión = Importe × (PorPart / 100)
      const importeBase = Number(row['Importe'] || 0);
      const primaNeta = Number(row['PrimaNeta'] || 0);
      const porcentajeBase = Number(row['PorPart'] || 0);

      const fPagoStr = row['FPago'] || row['Fecha'] || row['FechaEmision'] || row['FechaMovimiento'] || '';
      const concepto = row['Concepto'] || '';
      const nombreAsegurado = row['NombreCompleto'] || row['NombreAsegurado'] || row['Asegurado'] || '';

      let dateFPago: Date;
      if (!fPagoStr || fPagoStr.trim() === '') {
        dateFPago = new Date();
      } else {
        const [y, m, d] = fPagoStr.split('-').map(Number);
        if (!y || !m || !d) {
          dateFPago = new Date();
        } else {
          dateFPago = new Date(y, m - 1, d);
        }
      }
      const weekNumber = getWeekNumber(dateFPago);
      const weekYear = dateFPago.getFullYear();
      const weekStartDate = getWeekStart(dateFPago);
      const weekEndDate = getWeekEnd(dateFPago);

      const dateFPagoFormatted = fPagoStr || dateFPago.toISOString().split('T')[0];

      itemsToInsert.push({
        staging_session_id: session.id,
        vendor_email_raw: null,
        vendor_email_norm: null,
        vendor_name_raw: vendorNameRaw || null,
        vendor_name_norm: vendorNameNorm || null,
        vendor_key: vendorKey,
        movi_user_id: moviUserId,
        match_method: matchMethod,
        pending_assignment: pendingAssignment,
        poliza,
        ramo,
        aseguradora,
        importe_base: importeBase,
        prima_neta: primaNeta,
        porcentaje_base: porcentajeBase,
        date_fpago: dateFPagoFormatted,
        concepto,
        nombre_asegurado: nombreAsegurado,
        week_number: weekNumber,
        week_year: weekYear,
        week_start_date: weekStartDate.toISOString().split('T')[0],
        week_end_date: weekEndDate.toISOString().split('T')[0],
        raw_row: row,
      });
    }

    console.log('[process-excel-staging] Inserting', itemsToInsert.length, 'items...');

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('commission_items_staging')
        .insert(itemsToInsert);

      if (itemsError) {
        throw new Error(`Error al insertar items: ${itemsError.message}`);
      }
    }

    await supabase.rpc('recalculate_staging_session_counters', { session_id: session.id });

    const { data: updatedSession } = await supabase
      .from('commission_staging_sessions')
      .update({ status: 'ready', processed_at: new Date().toISOString() })
      .eq('id', session.id)
      .select()
      .single();

    console.log('[process-excel-staging] Processing complete!', {
      total: updatedSession?.total_items,
      recognized: updatedSession?.recognized_count,
      pending: updatedSession?.pending_assignment_count,
    });

    return new Response(
      JSON.stringify({
        success: true,
        session: updatedSession,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[process-excel-staging] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});