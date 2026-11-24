import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ProductionRecord {
  agente_nombre: string;
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

    console.log('[sync-vendors-cache] Getting Google Sheets configuration...');
    
    const { data: config, error: configError } = await supabase
      .from('production_google_sheets_config')
      .select('*')
      .eq('activo', true)
      .maybeSingle();

    if (configError) {
      throw new Error(`Error obteniendo configuración: ${configError.message}`);
    }

    if (!config) {
      throw new Error('No hay una configuración activa de Google Sheets.');
    }

    console.log('[sync-vendors-cache] Fetching data from Google Sheets...');
    const csvUrl = `https://docs.google.com/spreadsheets/d/${config.sheet_id}/export?format=csv&gid=0`;
    const csvResponse = await fetch(csvUrl);
    
    if (!csvResponse.ok) {
      throw new Error(`Error al obtener datos de Google Sheets: ${csvResponse.status}`);
    }

    const csvText = await csvResponse.text();
    const rawRecords = parseCSV(csvText);
    console.log('[sync-vendors-cache] Parsed', rawRecords.length, 'rows');

    // Extraer vendedores únicos con sus conteos
    const vendorCounts = new Map<string, number>();
    
    for (const row of rawRecords) {
      const agenteNombre = (row['VendNombre'] || row['vendnombre'] || row['vendedor'] || '').toString().trim();
      if (!agenteNombre) continue;
      
      vendorCounts.set(agenteNombre, (vendorCounts.get(agenteNombre) || 0) + 1);
    }

    console.log('[sync-vendors-cache] Found', vendorCounts.size, 'unique vendors');

    // Sincronizar cada vendedor al cache
    let syncedCount = 0;
    let errorCount = 0;
    const syncedAt = new Date().toISOString();

    for (const [vendorNombre, count] of vendorCounts) {
      try {
        // Llamar a la función que actualiza el cache
        const { error: refreshError } = await supabase.rpc('refresh_vendor_mapping_cache', {
          p_vendor_nombre: vendorNombre
        });

        if (refreshError) {
          console.error(`[sync-vendors-cache] Error refreshing ${vendorNombre}:`, refreshError);
          errorCount++;
          continue;
        }

        // Actualizar el conteo y timestamp
        const { error: updateError } = await supabase
          .from('production_vendors_cache')
          .update({
            total_records: count,
            synced_from_sheets_at: syncedAt,
            updated_at: new Date().toISOString()
          })
          .eq('vendor_nombre', vendorNombre);

        if (updateError) {
          console.error(`[sync-vendors-cache] Error updating count for ${vendorNombre}:`, updateError);
          errorCount++;
        } else {
          syncedCount++;
        }
      } catch (err: any) {
        console.error(`[sync-vendors-cache] Exception for ${vendorNombre}:`, err);
        errorCount++;
      }
    }

    console.log('[sync-vendors-cache] Synced', syncedCount, 'vendors. Errors:', errorCount);

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedCount,
        error_count: errorCount,
        total_vendors: vendorCounts.size,
        synced_at: syncedAt
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('[sync-vendors-cache] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido al sincronizar vendedores'
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