import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ProductionRecord {
  fecha: string;
  anio: number;
  mes: number;
  dia: number;
  periodo_mes: string;
  periodo_anio: number;
  desp_nombre_raw: string;
  gerencia_nombre_raw: string;
  region_raw: string | null;
  agente_nombre: string;
  aseguradora_nombre: string;
  ramo_nombre: string;
  subramo_nombre: string | null;
  importe_pesos: number;
  prima_convenio: number;
  prima_ponderada: number;
  bono: number;
  convenio_flag: boolean;
  porcentaje_bono: number | null;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const records: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: any = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    records.push(record);
  }
  
  return records;
}

function parseMoneyValue(value: string): number {
  if (!value) return 0;
  const str = value.toString().replace(/[$,]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parsePercentValue(value: string): number | null {
  if (!value) return null;
  const str = value.toString().replace(/%/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function parseDateDMY(dateStr: string): Date | null {
  if (!dateStr) return null;

  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;

  const fecha = new Date(year, month - 1, day);

  if (isNaN(fecha.getTime())) return null;

  return fecha;
}

function transformRecord(row: any): ProductionRecord | null {
  try {
    const fechaValue = row['FechaSimp'] || row['Fecha'] || row['fechasimp'] || row['fecha'];
    if (!fechaValue) return null;

    let fecha: Date | null = null;

    if (typeof fechaValue === 'string') {
      fecha = parseDateDMY(fechaValue);

      if (!fecha) {
        fecha = new Date(fechaValue);
      }
    } else if (fechaValue instanceof Date) {
      fecha = fechaValue;
    } else if (typeof fechaValue === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      fecha = new Date(excelEpoch.getTime() + fechaValue * 86400000);
    }

    if (!fecha || isNaN(fecha.getTime())) return null;

    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const dia = fecha.getDate();
    const periodoMes = `${anio}-${mes.toString().padStart(2, '0')}`;
    const periodoAnio = anio;

    // CAMBIO: Priorizar NombreCompleto para el nombre del cliente
    const nombreCompleto = (row['NombreCompleto'] || row['nombrecompleto'] || row['nombre completo'] || '').toString().trim();
    const despNombre = (row['DespNombre'] || row['despnombre'] || '').toString().trim();
    const gerenciaNombre = (row['GerenciaNombre'] || row['gerencianombre'] || '').toString().trim();
    const regionNombre = (row['Dirección Regional'] || row['direccion regional'] || row['region'] || '').toString().trim();

    // Usar NombreCompleto si está disponible, si no usar despNombre
    const clienteNombre = nombreCompleto || despNombre;

    if (!clienteNombre) return null;

    const importePesos = parseMoneyValue(row['IMPORTE PESOS'] || row['importe pesos'] || row['importe'] || '0');
    const primaConvenio = parseMoneyValue(row['Prima de convenio'] || row['prima de convenio'] || row['prima convenio'] || '0');
    const primaPonderada = parseMoneyValue(row['Prima Ponderada'] || row['prima ponderada'] || '0');
    const bono = parseMoneyValue(row['Bono'] || row['bono'] || '0');
    const porcentajeBono = parsePercentValue(row['% BONO'] || row['porcentaje bono'] || row['porciento bono'] || '');

    const convenioStr = (row['CONVENIO'] || row['convenio'] || '').toString().toLowerCase().trim();
    const convenioFlag = convenioStr === 'si' || convenioStr === 'sí' || convenioStr === 'yes' || primaConvenio > 0;

    const fechaStr = fecha.toISOString().split('T')[0];
    const agenteNombre = (row['VendNombre'] || row['vendnombre'] || row['vendedor'] || '').toString().trim();
    const aseguradoraNombre = (row['Nombre Compañía'] || row['nombre compañia'] || row['nombre compania'] || row['compañia'] || '').toString().trim();
    const ramoNombre = (row['Sub Ramo'] || row['sub ramo'] || row['subramo'] || row['RamosNombre'] || row['ramos'] || '').toString().trim();

    return {
      fecha: fechaStr,
      anio,
      mes,
      dia,
      periodo_mes: periodoMes,
      periodo_anio: periodoAnio,
      desp_nombre_raw: clienteNombre, // Ahora usa NombreCompleto
      gerencia_nombre_raw: gerenciaNombre || clienteNombre, // Fallback a clienteNombre
      region_raw: regionNombre || null,
      agente_nombre: agenteNombre,
      aseguradora_nombre: aseguradoraNombre,
      ramo_nombre: ramoNombre,
      subramo_nombre: null,
      importe_pesos: importePesos,
      prima_convenio: primaConvenio,
      prima_ponderada: primaPonderada,
      bono: bono,
      convenio_flag: convenioFlag,
      porcentaje_bono: porcentajeBono
    };
  } catch (error) {
    console.error('Error transforming record:', error);
    return null;
  }
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

    console.log('[fetch-production-sheets] Getting Google Sheets configuration...');
    
    const { data: config, error: configError } = await supabase
      .from('production_google_sheets_config')
      .select('*')
      .eq('activo', true)
      .maybeSingle();

    if (configError) {
      throw new Error(`Error obteniendo configuración: ${configError.message}`);
    }

    if (!config) {
      throw new Error('No hay una configuración activa de Google Sheets. Por favor, configura el link primero.');
    }

    console.log('[fetch-production-sheets] Config found. Sheet ID:', config.sheet_id);

    const csvUrl = `https://docs.google.com/spreadsheets/d/${config.sheet_id}/export?format=csv&gid=0`;
    console.log('[fetch-production-sheets] Fetching CSV from:', csvUrl);

    const csvResponse = await fetch(csvUrl);
    
    if (!csvResponse.ok) {
      throw new Error(`Error al obtener datos de Google Sheets: ${csvResponse.status} ${csvResponse.statusText}. Verifica que el link sea público y válido.`);
    }

    const csvText = await csvResponse.text();
    console.log('[fetch-production-sheets] CSV fetched. Size:', csvText.length, 'bytes');

    const rawRecords = parseCSV(csvText);
    console.log('[fetch-production-sheets] Parsed', rawRecords.length, 'rows');

    const records: ProductionRecord[] = [];
    for (const row of rawRecords) {
      const transformed = transformRecord(row);
      if (transformed) {
        records.push(transformed);
      }
    }

    console.log('[fetch-production-sheets] Transformed', records.length, 'valid records');

    const url = new URL(req.url);
    const convenioOnly = url.searchParams.get('convenio_only') === 'true';
    
    let filteredRecords = records;
    if (convenioOnly) {
      filteredRecords = records.filter(r => r.convenio_flag);
      console.log('[fetch-production-sheets] Filtered to', filteredRecords.length, 'convenio records');
    }

    return new Response(
      JSON.stringify({
        success: true,
        records: filteredRecords,
        total: filteredRecords.length,
        fetched_at: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('Error in fetch-production-sheets:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido al obtener datos de Google Sheets'
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