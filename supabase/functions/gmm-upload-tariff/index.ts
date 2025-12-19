import { createClient } from 'npm:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExcelRangeDefinition {
  sheet: string;
  range: string;
  type: 'table' | 'value' | 'array';
}

const EXCEL_RANGES: Record<string, ExcelRangeDefinition> = {
  factor_estado: { sheet: 'Tarifa', range: 'W4:Z38', type: 'table' },
  factor_nivel_hospitalario: { sheet: 'Tarifa', range: 'AA4:AB6', type: 'table' },
  factor_tabulador: { sheet: 'Tarifa', range: 'AA11:AB16', type: 'table' },
  factor_suma_asegurada: { sheet: 'Tarifa', range: 'N4:O9', type: 'table' },
  factor_deducible: { sheet: 'Tarifa', range: 'Q4:R14', type: 'table' },
  factor_coaseguro: { sheet: 'Tarifa', range: 'T4:U8', type: 'table' },
  tope_coaseguro: { sheet: 'Tarifa', range: 'T13:U17', type: 'table' },
  forma_pago: { sheet: 'Tarifa', range: 'BL31:BN35', type: 'table' },
  base_intermedia_edad_sexo: { sheet: 'Tarifa', range: 'C3:E110', type: 'table' },
  coef_medicamentos: { sheet: 'Tarifa', range: 'AJ3', type: 'value' },
  coef_preexistentes: { sheet: 'Tarifa', range: 'AJ7', type: 'value' },
  coef_complicaciones: { sheet: 'Tarifa', range: 'AJ11', type: 'value' },
  coef_vip: { sheet: 'Tarifa', range: 'BI3', type: 'value' },
  coef_antiguedad: { sheet: 'Tarifa', range: 'BI7', type: 'value' },
  coef_emergencia_ext: { sheet: 'Tarifa', range: 'AW3', type: 'value' },
  coef_enf_graves_ext: { sheet: 'Tarifa', range: 'AW7', type: 'value' },
  coef_ayuda_diaria: { sheet: 'Tarifa', range: 'BC3', type: 'value' },
  coef_ampliacion_servicios: { sheet: 'Tarifa', range: 'BC7', type: 'value' },
  denominador_cargas: { sheet: 'Tarifa', range: 'L4:L6', type: 'array' },
  deducible_accidente_keys: { sheet: 'Tarifa', range: 'AU15:AU23', type: 'array' },
  deducible_accidente_factors: { sheet: 'Tarifa', range: 'AW15:AW23', type: 'array' },
  multiregion_carga_sistema: { sheet: 'Tarifa', range: 'AQ42:AS74', type: 'table' },
  cobertura_internacional_carga_sistema: { sheet: 'Tarifa', range: 'AY42:BA76', type: 'table' },
  maternidad_tasa_por_edad: { sheet: 'Tarifa', range: 'AN18:AO68', type: 'table' },
  maternidad_threshold: { sheet: 'Tarifa', range: 'CU2', type: 'value' },
  indemnizacion_eg_tabla: { sheet: 'Tarifa', range: 'BE3:BG50', type: 'table' },
  indemnizacion_eg_monto: { sheet: 'Tarifa', range: 'DK2', type: 'value' },
  xtensuz_factor: { sheet: 'Tarifa', range: 'AJ15:AK18', type: 'table' },
  gastos_expedicion: { sheet: 'Cotizacion', range: 'O67', type: 'value' },
  iva: { sheet: 'Cotizacion', range: 'O69', type: 'value' },
};

function parseRange(workbook: XLSX.WorkBook, sheetName: string, rangeStr: string, type: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  if (type === 'value') {
    const cell = sheet[rangeStr];
    return cell ? cell.v : null;
  }

  if (type === 'array') {
    const range = XLSX.utils.decode_range(rangeStr);
    const result: any[] = [];
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: range.s.c });
      const cell = sheet[cellAddress];
      result.push(cell ? cell.v : null);
    }
    return result;
  }

  if (type === 'table') {
    const range = XLSX.utils.decode_range(rangeStr);
    const result: any[] = [];
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const row: any = {};
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = sheet[cellAddress];
        const colName = `col_${C - range.s.c}`;
        row[colName] = cell ? cell.v : null;
      }
      result.push(row);
    }
    return result;
  }

  return null;
}

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

async function hashBuffer(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const notes = formData.get('notes') as string || null;

    if (!file) {
      throw new Error('No file provided');
    }

    const arrayBuffer = await file.arrayBuffer();
    const hash = await hashBuffer(arrayBuffer);

    const { data: existing } = await supabase
      .from('tariff_packages')
      .select('id')
      .eq('source_hash', hash)
      .maybeSingle();

    if (existing) {
      throw new Error('This tariff file has already been uploaded');
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const requiredSheets = ['Tarifa', 'Cotizador', 'Cotizacion'];
    for (const sheetName of requiredSheets) {
      if (!workbook.Sheets[sheetName]) {
        throw new Error(`Required sheet "${sheetName}" not found`);
      }
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token!);

    const sanitizedFilename = sanitizeFilename(file.name);
    const storagePath = `${user!.id}/${Date.now()}_${sanitizedFilename}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('gmm-tariffs')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('gmm-tariffs')
      .getPublicUrl(storagePath);

    const { data: pkg, error: pkgError } = await supabase
      .from('tariff_packages')
      .insert({
        name: name || file.name,
        source_filename: file.name,
        source_hash: hash,
        source_url: publicUrl,
        status: 'draft',
        created_by: user!.id,
        notes,
      })
      .select()
      .single();

    if (pkgError) throw pkgError;

    const tables: any[] = [];
    const errors: string[] = [];

    for (const [tableKey, definition] of Object.entries(EXCEL_RANGES)) {
      try {
        const data = parseRange(workbook, definition.sheet, definition.range, definition.type);
        tables.push({
          tariff_package_id: pkg.id,
          table_key: tableKey,
          data_json: data,
          row_count: Array.isArray(data) ? data.length : null,
        });
      } catch (error) {
        errors.push(`${tableKey}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      await supabase
        .from('tariff_packages')
        .update({
          status: 'failed',
          validation_errors: { parsing_errors: errors },
        })
        .eq('id', pkg.id);

      return new Response(
        JSON.stringify({
          success: false,
          package_id: pkg.id,
          errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: tablesError } = await supabase
      .from('tariff_tables')
      .insert(tables);

    if (tablesError) throw tablesError;

    return new Response(
      JSON.stringify({
        success: true,
        package: pkg,
        tables_loaded: tables.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error uploading tariff:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});