import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function normalizeHeader(header: string): string {
  if (!header) return '';
  let normalized = header.toString().trim().toLowerCase();
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  normalized = normalized.replace(/[\s\-_.]/g, '');
  return normalized;
}

function parseNumberMx(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  
  let str = String(value).trim();
  if (str === '' || str === '-' || str === 'N/A' || str.toLowerCase() === 'na') return null;
  
  str = str.replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '');
  if (str.includes('%')) str = str.replace(/%/g, '');
  
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function parseDate(value: any): Date | null {
  if (!value) return null;

  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(date.getTime())) return date;
  }

  const str = String(value).trim();
  if (!str) return null;

  const patterns = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      if (pattern.source.startsWith('^(\\d{1,2})')) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) return date;
        }
      } else {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) return date;
        }
      }
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData } = await supabaseUser
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    if (userData?.rol !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Solo administradores pueden cargar comisiones' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string || file?.name || 'sin-nombre.xlsx';

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No se recibió archivo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[parse-commission-excel] File received:', fileName, 'Size:', file.size);

    const fileBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      return new Response(
        JSON.stringify({ error: 'El archivo Excel no contiene hojas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'No se pudo determinar la hoja con datos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sheet = workbook.Sheets[bestSheet.name];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false, blankrows: false });

    if (jsonData.length === 0) {
      return new Response(
        JSON.stringify({ error: `La hoja "${bestSheet.name}" no contiene datos` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const detectedColumns: any = {};
    detectedColumns.vendNombre = headersNormalizedMap['vendnombre'];
    detectedColumns.documento = headersNormalizedMap['documento'] || headersNormalizedMap['poliza'];
    detectedColumns.ramo = headersNormalizedMap['ramo'];
    detectedColumns.importe = headersNormalizedMap['importe'];
    detectedColumns.porPart = headersNormalizedMap['porpart'];
    detectedColumns.fPago = headersNormalizedMap['fpago'];
    detectedColumns.aseguradora = headersNormalizedMap['aseguradora'] || headersNormalizedMap['ciaabreviacion'];

    if (!detectedColumns.vendNombre) {
      return new Response(
        JSON.stringify({ 
          error: 'No se encontró la columna VendNombre en el Excel. Este campo es obligatorio.',
          available_columns: headersOriginal
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requiredColumns = ['documento', 'ramo', 'importe', 'porPart'];
    const missing = requiredColumns.filter(col => !detectedColumns[col]);
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: `Faltan columnas obligatorias: ${missing.join(', ')}`,
          available_columns: headersOriginal
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from('document_import_batches')
      .insert({
        file_name: fileName,
        imported_by: user.id,
        status: 'processing',
        detected_format: 'LOGEXPORT',
        sheet_name_used: bestSheet.name,
        headers_json: {
          original: headersOriginal,
          detected: detectedColumns
        }
      })
      .select()
      .single();

    if (batchError || !batch) {
      console.error('Error al crear batch:', batchError);
      return new Response(
        JSON.stringify({ error: 'Error al crear lote de importación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[parse-commission-excel] Batch creado: ${batch.id}`);

    // Cargar usuarios con nombres normalizados
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, nombre_completo_norm')
      .not('nombre_completo_norm', 'is', null);

    const usuariosMap = new Map<string, { id: string; nombre: string }>();
    if (usuarios) {
      usuarios.forEach(u => {
        if (u.nombre_completo_norm) {
          usuariosMap.set(u.nombre_completo_norm, { id: u.id, nombre: u.nombre_completo });
        }
      });
    }

    // Cargar mappings persistentes
    const { data: persistentMappings } = await supabase
      .from('vendor_mapping_persistent')
      .select('vendor_key, movi_user_id')
      .eq('is_active', true);

    const mappingsMap = new Map<string, string>();
    if (persistentMappings) {
      persistentMappings.forEach(m => {
        mappingsMap.set(m.vendor_key, m.movi_user_id);
      });
    }

    console.log(`[parse-commission-excel] Loaded ${usuarios?.length || 0} users, ${mappingsMap.size} persistent mappings`);

    const itemsToInsert: any[] = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as Record<string, any>;

      const vendorNameRaw = row[detectedColumns.vendNombre]?.toString()?.trim() || '';
      const documentoValue = row[detectedColumns.documento]?.toString()?.trim() || '';
      const ramoValue = row[detectedColumns.ramo]?.toString()?.trim() || '';
      const importeValue = parseNumberMx(row[detectedColumns.importe]);
      const porPartValue = parseNumberMx(row[detectedColumns.porPart]);

      let status: 'valid' | 'warning' | 'discard' = 'valid';
      let discardReason: string | null = null;

      if (!documentoValue) {
        status = 'discard';
        discardReason = 'Documento vacío';
      } else if (!ramoValue) {
        status = 'discard';
        discardReason = 'Ramo vacío';
      } else if (importeValue === null) {
        status = 'discard';
        discardReason = 'Importe no numérico o vacío';
      } else if (porPartValue === null) {
        status = 'discard';
        discardReason = 'PorPart no numérico o vacío';
      } else if (!vendorNameRaw) {
        status = 'discard';
        discardReason = 'VendNombre vacío';
      }

      let fpagoValue: Date | null = null;
      if (detectedColumns.fPago && row[detectedColumns.fPago]) {
        fpagoValue = parseDate(row[detectedColumns.fPago]);
      }

      const aseguradoraValue = detectedColumns.aseguradora 
        ? row[detectedColumns.aseguradora]?.toString()?.trim() || 'NO_ESPECIFICADA'
        : 'NO_ESPECIFICADA';

      const comisionCalculada = (importeValue !== null && porPartValue !== null)
        ? importeValue * (porPartValue / 100)
        : 0;

      // Matching por NOMBRE usando la función de BD
      let vendorNameNorm = '';
      let agentKey = '';
      let matchedUserId: string | null = null;
      let matchStatus = 'pending';
      let matchMethod = 'none';
      let matchConfidence = 0;

      if (vendorNameRaw && status !== 'discard') {
        // Normalizar usando la función de BD
        const { data: normalizedData } = await supabase.rpc('normalize_person_name', {
          name_input: vendorNameRaw
        });

        vendorNameNorm = normalizedData || '';
        agentKey = vendorNameNorm ? `name:${vendorNameNorm}` : 'unknown';

        // Primero buscar en mappings persistentes
        const persistentMatch = mappingsMap.get(agentKey);
        if (persistentMatch) {
          matchedUserId = persistentMatch;
          matchStatus = 'matched_manual';
          matchMethod = 'mapping_name';
          matchConfidence = 100;
        } else {
          // Buscar por nombre exacto
          const exactMatch = usuariosMap.get(vendorNameNorm);
          if (exactMatch) {
            matchedUserId = exactMatch.id;
            matchStatus = 'matched_auto';
            matchMethod = 'auto_exact';
            matchConfidence = 100;
          } else {
            // Buscar por similitud >= 92%
            let bestMatch: { userId: string; confidence: number } | null = null;

            for (const [userNameNorm, userData] of usuariosMap) {
              const { data: similarity } = await supabase.rpc('name_similarity', {
                name1: vendorNameNorm,
                name2: userNameNorm
              });

              if (similarity && similarity >= 92) {
                if (!bestMatch || similarity > bestMatch.confidence) {
                  bestMatch = { userId: userData.id, confidence: similarity };
                }
              }
            }

            if (bestMatch) {
              matchedUserId = bestMatch.userId;
              matchStatus = 'matched_auto';
              matchMethod = 'auto_fuzzy';
              matchConfidence = bestMatch.confidence;
            } else {
              matchStatus = 'pending';
              matchMethod = 'none';
              matchConfidence = 0;
            }
          }
        }
      }

      const item = {
        import_batch_id: batch.id,
        row_index: i + 1,
        raw_json: row,
        status,
        discard_reason: discardReason,
        warnings: '[]',
        vendor_name_raw: vendorNameRaw || null,
        vendor_name_norm: vendorNameNorm || null,
        agent_key: agentKey,
        agent_name_raw: vendorNameRaw || null,
        agent_name_norm: vendorNameNorm || null,
        agent_name_signature: vendorNameNorm || null,
        documento: documentoValue || null,
        endoso: row[headersNormalizedMap['endoso']]?.toString()?.trim() || null,
        fpago: fpagoValue ? fpagoValue.toISOString().split('T')[0] : null,
        fpago_raw: detectedColumns.fPago ? row[detectedColumns.fPago]?.toString()?.trim() : null,
        aseguradora: aseguradoraValue,
        ramo: ramoValue || null,
        importe_base: importeValue,
        porcentaje: porPartValue,
        comision_calculada: comisionCalculada,
        prima_neta_info: parseNumberMx(row[headersNormalizedMap['primaneta']]),
        concepto: row[headersNormalizedMap['concepto']]?.toString()?.trim() || null,
        oficina: row[headersNormalizedMap['despnombre']]?.toString()?.trim() || null,
        nombre_completo: row[headersNormalizedMap['nombrecompleto']]?.toString()?.trim() 
                      || row[headersNormalizedMap['nombreasegurado']]?.toString()?.trim() 
                      || row[headersNormalizedMap['asegurado']]?.toString()?.trim() 
                      || null,
        movi_user_id: matchedUserId,
        match_status: matchStatus,
        match_method: matchMethod,
        match_confidence: matchConfidence
      };

      itemsToInsert.push(item);
    }

    console.log(`[parse-commission-excel] Insertando ${itemsToInsert.length} items en staging...`);

    const CHUNK_SIZE = 500;
    for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
      const chunk = itemsToInsert.slice(i, i + CHUNK_SIZE);
      const { error: insertError } = await supabase
        .from('document_import_items')
        .insert(chunk);

      if (insertError) {
        console.error('Error al insertar chunk:', insertError);
        await supabase
          .from('document_import_batches')
          .update({ status: 'failed', conversion_failed_reason: insertError.message })
          .eq('id', batch.id);

        return new Response(
          JSON.stringify({ error: 'Error al procesar documentos: ' + insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    await supabase
      .from('document_import_batches')
      .update({ status: 'completed' })
      .eq('id', batch.id);

    const { data: updatedBatch } = await supabase
      .from('document_import_batches')
      .select('*')
      .eq('id', batch.id)
      .single();

    console.log(`[parse-commission-excel] Completado - Total: ${updatedBatch.row_count_total}, Valid: ${updatedBatch.row_count_valid}, Pending: ${updatedBatch.row_count_valid - (updatedBatch.records_matched || 0)}`);

    return new Response(
      JSON.stringify({
        success: true,
        batch: updatedBatch,
        batch_id: batch.id,
        message: 'Importación completada exitosamente'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[parse-commission-excel] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al procesar archivo' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});