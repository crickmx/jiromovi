import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function parseCSV(csvText: string): any[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === '\n' && !insideQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else if (char === '\r' && nextChar === '\n' && !insideQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
      i++;
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  function parseLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentValue += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());
    return values;
  }

  const headers = parseLine(lines[0]);
  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: any = {};

    headers.forEach((header, index) => {
      const value = values[index] || '';
      row[header] = value;
    });

    rows.push(row);
  }

  return rows;
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

    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que sea admin
    const { data: userData } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (!userData || userData.rol !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Solo los administradores pueden ejecutar esta acción' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[refresh-client-names] Admin autorizado:', user.id);

    // Obtener configuración de Google Sheets
    const { data: config, error: configError } = await supabase
      .from('production_google_sheets_config')
      .select('*')
      .eq('activo', true)
      .maybeSingle();

    if (configError || !config) {
      throw new Error('No hay una configuración activa de Google Sheets');
    }

    console.log('[refresh-client-names] Fetching data from Google Sheets...');
    const csvUrl = `https://docs.google.com/spreadsheets/d/${config.sheet_id}/export?format=csv&gid=0`;
    const csvResponse = await fetch(csvUrl);
    
    if (!csvResponse.ok) {
      throw new Error(`Error al obtener datos de Google Sheets: ${csvResponse.status}`);
    }

    const csvText = await csvResponse.text();
    const rows = parseCSV(csvText);
    console.log('[refresh-client-names] Parsed', rows.length, 'rows from Google Sheets');

    // Construir un mapa de registros con NombreCompleto
    const clienteMap = new Map<string, string>();

    for (const row of rows) {
      const getColumnValue = (columnNames: string[]): any => {
        for (const name of columnNames) {
          const exactMatch = row[name];
          if (exactMatch !== undefined && exactMatch !== null && exactMatch !== '') return exactMatch;

          const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
          if (key && row[key] !== null && row[key] !== '') return row[key];
        }
        return null;
      };

      const fechaValue = getColumnValue(['FechaSimp', 'Fecha', 'fechasimp', 'fecha']);
      if (!fechaValue) continue;

      let fecha: Date | null = null;
      if (typeof fechaValue === 'string') {
        fecha = parseDateDMY(fechaValue);
        if (!fecha) fecha = new Date(fechaValue);
      } else if (fechaValue instanceof Date) {
        fecha = fechaValue;
      } else if (typeof fechaValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        fecha = new Date(excelEpoch.getTime() + fechaValue * 86400000);
      }

      if (!fecha || isNaN(fecha.getTime())) continue;

      const nombreCompleto = (getColumnValue(['NombreCompleto', 'nombrecompleto', 'nombre completo']) || '').toString().trim();
      const despNombre = (getColumnValue(['DespNombre', 'despnombre']) || '').toString().trim();
      const gerenciaNombre = (getColumnValue(['GerenciaNombre', 'gerencianombre']) || '').toString().trim();
      const agenteNombre = (getColumnValue(['VendNombre', 'vendnombre', 'vendedor']) || '').toString().trim();
      const aseguradoraNombre = (getColumnValue(['Nombre Compañía', 'nombre compañia', 'nombre compania', 'compañia']) || '').toString().trim();
      const ramoNombre = (getColumnValue(['Sub Ramo', 'sub ramo', 'subramo', 'RamosNombre', 'ramos']) || '').toString().trim();
      const importePesos = parseFloat(getColumnValue(['IMPORTE PESOS', 'importe pesos', 'importe'])?.toString() || '0') || 0;

      const clienteNombre = nombreCompleto || despNombre;
      if (!clienteNombre) continue;

      const fechaStr = fecha.toISOString().split('T')[0];
      const recordKey = `${fechaStr}|${agenteNombre}|${aseguradoraNombre}|${ramoNombre}|${importePesos}`;

      clienteMap.set(recordKey, clienteNombre);
    }

    console.log('[refresh-client-names] Built map with', clienteMap.size, 'client names');

    // Obtener todos los registros de production_records
    const { data: existingRecords, error: fetchError } = await supabase
      .from('production_records')
      .select('id, fecha, agente_nombre, aseguradora_nombre, ramo_nombre, importe_pesos, desp_nombre_raw');

    if (fetchError) {
      throw new Error(`Error al obtener registros existentes: ${fetchError.message}`);
    }

    console.log('[refresh-client-names] Found', existingRecords?.length || 0, 'existing records');

    let updatedCount = 0;
    let notFoundCount = 0;
    const batchSize = 100;

    if (existingRecords && existingRecords.length > 0) {
      for (let i = 0; i < existingRecords.length; i += batchSize) {
        const batch = existingRecords.slice(i, i + batchSize);
        const updates: any[] = [];

        for (const record of batch) {
          const recordKey = `${record.fecha}|${record.agente_nombre}|${record.aseguradora_nombre}|${record.ramo_nombre}|${record.importe_pesos}`;
          const newClienteName = clienteMap.get(recordKey);

          if (newClienteName && newClienteName !== record.desp_nombre_raw) {
            updates.push({
              id: record.id,
              desp_nombre_raw: newClienteName,
            });
            updatedCount++;
          } else if (!newClienteName) {
            notFoundCount++;
          }
        }

        // Actualizar en lotes
        if (updates.length > 0) {
          for (const update of updates) {
            const { error: updateError } = await supabase
              .from('production_records')
              .update({ desp_nombre_raw: update.desp_nombre_raw })
              .eq('id', update.id);

            if (updateError) {
              console.error('[refresh-client-names] Error updating record:', updateError);
            }
          }
        }

        console.log(`[refresh-client-names] Processed batch ${i / batchSize + 1}: ${updatedCount} updated, ${notFoundCount} not found`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Nombres de clientes actualizados exitosamente',
        stats: {
          total_records: existingRecords?.length || 0,
          updated: updatedCount,
          not_found: notFoundCount,
          unchanged: (existingRecords?.length || 0) - updatedCount - notFoundCount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[refresh-client-names] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido',
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});