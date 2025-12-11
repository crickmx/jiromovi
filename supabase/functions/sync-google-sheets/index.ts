import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RowData {
  [key: string]: string | number | null;
}

function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function parseCSV(csvText: string): RowData[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: RowData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: RowData = {};

    headers.forEach((header, index) => {
      const value = values[index] || '';
      if (value === '') {
        row[header] = null;
      } else if (!isNaN(Number(value)) && value !== '') {
        row[header] = Number(value);
      } else {
        row[header] = value;
      }
    });

    rows.push(row);
  }

  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[sync-google-sheets] Starting sync...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { sheetUrl, userId } = body;

    console.log('[sync-google-sheets] Sheet URL:', sheetUrl, 'User ID:', userId);

    if (!sheetUrl) {
      throw new Error('No se proporcionó URL del Google Sheet');
    }

    const spreadsheetId = extractSpreadsheetId(sheetUrl);
    if (!spreadsheetId) {
      throw new Error('URL de Google Sheets inválida');
    }

    console.log('[sync-google-sheets] Spreadsheet ID:', spreadsheetId);

    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

    console.log('[sync-google-sheets] Fetching CSV from:', csvUrl);
    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error(`No se pudo acceder al Google Sheet. Verifica que el enlace sea público y esté compartido correctamente. (Status: ${response.status})`);
    }

    const csvText = await response.text();
    console.log('[sync-google-sheets] CSV length:', csvText.length);

    if (!csvText || csvText.length < 10) {
      throw new Error('El Google Sheet está vacío o no se pudo leer');
    }

    const rows = parseCSV(csvText);
    console.log('[sync-google-sheets] Rows parsed:', rows.length);

    if (rows.length === 0) {
      throw new Error('El Google Sheet no contiene datos válidos');
    }

    if (rows.length > 10000) {
      throw new Error(`El Google Sheet contiene ${rows.length} registros. El límite es 10,000 registros. Por favor, reduce el número de filas.`);
    }

    const requiredColumns = [
      'FechaSimp', 'DespNombre', 'GerenciaNombre', 'VendNombre',
      'Nombre Compañía', 'Sub Ramo', 'IMPORTE PESOS',
      'Prima de convenio', 'Prima Ponderada', 'Bono'
    ];

    const firstRow = rows[0];
    const availableColumns = Object.keys(firstRow);
    console.log('[sync-google-sheets] Available columns:', availableColumns);

    const missingColumns = requiredColumns.filter(col => {
      const colLower = col.toLowerCase();
      return !availableColumns.some(ac => ac.toLowerCase() === colLower);
    });

    if (missingColumns.length > 0) {
      console.error('[sync-google-sheets] Missing columns:', missingColumns);
      const detailedMessage = `Faltan columnas requeridas:\n${missingColumns.join(', ')}\n\nColumnas encontradas:\n${availableColumns.join(', ')}`;
      throw new Error(detailedMessage);
    }

    console.log('[sync-google-sheets] Deleting old records...');
    const { error: deleteError } = await supabase
      .from('production_records')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('Error deleting records:', deleteError);
      throw new Error('Error al eliminar registros anteriores');
    }

    console.log('[sync-google-sheets] Processing rows...');
    const batchSize = 100;
    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const recordsToInsert: any[] = [];

      for (const row of batch) {
        try {
          const getColumnValue = (columnNames: string[]): any => {
            for (const name of columnNames) {
              const exactMatch = row[name];
              if (exactMatch !== undefined && exactMatch !== null) return exactMatch;

              const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
              if (key && row[key] !== null) return row[key];
            }
            return null;
          };

          const fechaValue = getColumnValue(['FechaSimp', 'Fecha', 'fechasimp', 'fecha']);
          if (!fechaValue) {
            skippedCount++;
            continue;
          }

          let fecha: Date;
          if (typeof fechaValue === 'string') {
            fecha = new Date(fechaValue);
          } else if (fechaValue instanceof Date) {
            fecha = fechaValue;
          } else if (typeof fechaValue === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            fecha = new Date(excelEpoch.getTime() + fechaValue * 86400000);
          } else {
            skippedCount++;
            continue;
          }

          if (isNaN(fecha.getTime())) {
            skippedCount++;
            continue;
          }

          const anio = fecha.getFullYear();
          const mes = fecha.getMonth() + 1;
          const dia = fecha.getDate();
          const periodoMes = `${anio}-${mes.toString().padStart(2, '0')}`;
          const periodoAnio = anio;

          const despNombre = (getColumnValue(['DespNombre', 'despnombre']) || '').toString().trim();
          const gerenciaNombre = (getColumnValue(['GerenciaNombre', 'gerencianombre']) || '').toString().trim();
          const regionNombre = (getColumnValue(['Dirección Regional', 'direccion regional', 'region']) || '').toString().trim();

          if (!despNombre || !gerenciaNombre) {
            skippedCount++;
            continue;
          }

          const importePesos = parseFloat(getColumnValue(['IMPORTE PESOS', 'importe pesos', 'importe'])?.toString() || '0') || 0;
          const primaConvenio = parseFloat(getColumnValue(['Prima de convenio', 'prima de convenio', 'prima convenio'])?.toString() || '0') || 0;
          const primaPonderada = parseFloat(getColumnValue(['Prima Ponderada', 'prima ponderada'])?.toString() || '0') || 0;
          const bono = parseFloat(getColumnValue(['Bono', 'bono'])?.toString() || '0') || 0;
          const porcentajeBono = getColumnValue(['% BONO', 'porcentaje bono', 'porciento bono'])
            ? parseFloat(getColumnValue(['% BONO', 'porcentaje bono', 'porciento bono']).toString())
            : null;

          const convenioStr = (getColumnValue(['CONVENIO', 'convenio']) || '').toString().toLowerCase().trim();
          const convenioFlag = convenioStr === 'si' || convenioStr === 'sí' || convenioStr === 'yes' || primaConvenio > 0;

          recordsToInsert.push({
            fecha: fecha.toISOString().split('T')[0],
            anio,
            mes,
            dia,
            periodo_mes: periodoMes,
            periodo_anio: periodoAnio,
            office_id: null,
            management_id: null,
            region_id: null,
            desp_nombre_raw: despNombre,
            gerencia_nombre_raw: gerenciaNombre,
            region_raw: regionNombre || null,
            agente_nombre: (getColumnValue(['VendNombre', 'vendnombre', 'vendedor']) || '').toString().trim(),
            aseguradora_nombre: (getColumnValue(['Nombre Compañía', 'nombre compañia', 'nombre compania', 'compañia']) || '').toString().trim(),
            ramo_nombre: (getColumnValue(['Sub Ramo', 'sub ramo', 'subramo', 'RamosNombre', 'ramos']) || '').toString().trim(),
            subramo_nombre: null,
            importe_pesos: importePesos,
            prima_convenio: primaConvenio,
            prima_ponderada: primaPonderada,
            bono: bono,
            convenio_flag: convenioFlag,
            porcentaje_bono: porcentajeBono
          });

        } catch (rowError: any) {
          console.error('[sync-google-sheets] Error processing row:', rowError.message);
          skippedCount++;
        }
      }

      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('production_records')
          .insert(recordsToInsert);

        if (insertError) {
          console.error('Error inserting batch:', insertError);
          throw new Error(`Error al insertar lote: ${insertError.message}`);
        }

        processedCount += recordsToInsert.length;
        console.log(`[sync-google-sheets] Processed batch: ${processedCount}/${rows.length}`);
      }

      recordsToInsert.length = 0;
    }

    console.log(`[sync-google-sheets] Completed. Processed: ${processedCount}, Skipped: ${skippedCount}`);

    if (processedCount === 0) {
      throw new Error('No se pudo procesar ningún registro. Verifica el formato de los datos.');
    }

    await supabase
      .from('production_import_logs')
      .insert({
        imported_by_user_id: userId,
        file_name: `Google Sheets: ${sheetUrl}`,
        records_count: processedCount
      });

    const { data: config } = await supabase
      .from('production_config')
      .select('*')
      .maybeSingle();

    if (config) {
      await supabase
        .from('production_config')
        .update({
          google_sheet_url: sheetUrl,
          last_sync_at: new Date().toISOString()
        })
        .eq('id', config.id);
    } else {
      await supabase
        .from('production_config')
        .insert({
          google_sheet_url: sheetUrl,
          last_sync_at: new Date().toISOString(),
          auto_sync_enabled: false
        });
    }

    const { data: stats } = await supabase
      .from('production_records')
      .select('importe_pesos, prima_convenio, prima_ponderada')
      .then(result => {
        if (result.data) {
          const totalImporte = result.data.reduce((sum, r) => sum + (r.importe_pesos || 0), 0);
          const totalConvenio = result.data.reduce((sum, r) => sum + (r.prima_convenio || 0), 0);
          const totalPonderada = result.data.reduce((sum, r) => sum + (r.prima_ponderada || 0), 0);
          return {
            data: {
              totalImporte,
              totalConvenio,
              totalPonderada,
              recordsCount: result.data.length
            }
          };
        }
        return { data: null };
      });

    return new Response(
      JSON.stringify({
        success: true,
        recordsImported: processedCount,
        skippedCount,
        stats: stats || {
          totalImporte: 0,
          totalConvenio: 0,
          totalPonderada: 0,
          recordsCount: 0
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('Error in sync-google-sheets:', error);

    let errorMessage = 'Error desconocido al sincronizar Google Sheets';

    if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
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