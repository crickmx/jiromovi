import { createClient } from 'npm:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExcelRow {
  FechaSimp: string | Date;
  Fecha?: string | Date;
  DespNombre: string;
  GerenciaNombre: string;
  'Dirección Regional'?: string;
  VendNombre: string;
  'Nombre Compañía': string;
  'Sub Ramo': string;
  RamosNombre?: string;
  'IMPORTE PESOS': number;
  'Prima de convenio': number;
  'Prima Ponderada': number;
  Bono: number;
  CONVENIO?: string;
  '% BONO'?: number;
  [key: string]: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[process-production] Starting process...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[process-production] Reading form data...');
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    console.log('[process-production] FormData parsed. File:', !!file, 'UserId:', userId);

    if (!file) {
      throw new Error('No se proporcionó archivo');
    }

    if (!file.name || (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls'))) {
      throw new Error('El archivo debe ser un archivo Excel válido (.xlsx o .xls)');
    }

    if (file.size === 0) {
      throw new Error('El archivo está vacío');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('El archivo es demasiado grande (máximo 10MB). Por favor, divide el archivo en partes más pequeñas.');
    }

    console.log('[process-production] File received:', file.name, file.size, file.type);

    console.log('[process-production] Converting file to array buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    console.log('[process-production] Parsing Excel file...');
    console.log('[process-production] Buffer size:', uint8Array.length);

    let workbook;
    try {
      workbook = XLSX.read(uint8Array, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
    } catch (xlsxError: any) {
      console.error('[process-production] XLSX parsing error:', xlsxError);
      throw new Error(`Error al leer el archivo Excel: ${xlsxError.message}. Asegúrate de que sea un archivo .xlsx o .xls válido.`);
    }

    console.log('[process-production] Sheet names:', workbook.SheetNames);
    if (workbook.SheetNames.length === 0) {
      throw new Error('El archivo Excel no contiene hojas');
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    console.log('[process-production] Converting sheet to JSON...');
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

    console.log('[process-production] Rows parsed:', rows.length);

    if (rows.length === 0) {
      throw new Error('El archivo está vacío');
    }

    console.log(`[process-production] Processing ${rows.length} records...`);

    const requiredColumns = [
      'FechaSimp', 'DespNombre', 'GerenciaNombre', 'VendNombre',
      'Nombre Compañía', 'Sub Ramo', 'IMPORTE PESOS',
      'Prima de convenio', 'Prima Ponderada', 'Bono'
    ];

    const firstRow = rows[0];
    const availableColumns = Object.keys(firstRow);
    console.log('[process-production] Available columns:', availableColumns);

    const missingColumns = requiredColumns.filter(col => {
      const colLower = col.toLowerCase();
      return !availableColumns.some(ac => ac.toLowerCase() === colLower);
    });

    if (missingColumns.length > 0) {
      console.error('[process-production] Missing columns:', missingColumns);
      console.error('[process-production] Required columns:', requiredColumns);
      console.error('[process-production] Available columns:', availableColumns);

      const detailedMessage = `Faltan columnas requeridas:\n${missingColumns.join(', ')}\n\nColumnas encontradas en el archivo:\n${availableColumns.join(', ')}\n\nVerifica que los nombres de las columnas coincidan exactamente con los requeridos.`;
      throw new Error(detailedMessage);
    }

    console.log('[process-production] Deleting old records...');
    const { error: deleteError } = await supabase
      .from('production_records')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('Error deleting records:', deleteError);
      throw new Error('Error al eliminar registros anteriores');
    }

    console.log('[process-production] Processing rows...');
    const batchSize = 500;
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
              if (exactMatch !== undefined) return exactMatch;

              const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
              if (key) return row[key];
            }
            return null;
          };

          const fechaValue = getColumnValue(['FechaSimp', 'Fecha', 'fechasimp', 'fecha']);
          if (!fechaValue) {
            console.log('[process-production] Skipping row: No date value');
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
            console.log('[process-production] Skipping row: Invalid date type', typeof fechaValue);
            skippedCount++;
            continue;
          }

          if (isNaN(fecha.getTime())) {
            console.log('[process-production] Skipping row: Invalid date', fechaValue);
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
            console.log('[process-production] Skipping row: Missing desp or gerencia', { despNombre, gerenciaNombre });
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
          console.error('[process-production] Error processing row:', rowError.message);
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
        console.log(`[process-production] Processed batch: ${processedCount}/${rows.length}`);
      }

      recordsToInsert.length = 0;
    }

    console.log(`[process-production] Completed. Processed: ${processedCount}, Skipped: ${skippedCount}`);

    if (processedCount === 0) {
      throw new Error('No se pudo procesar ningún registro del archivo. Verifica que el formato sea correcto.');
    }

    const { data: importLog } = await supabase
      .from('production_import_logs')
      .insert({
        imported_by_user_id: userId,
        file_name: file.name,
        records_count: processedCount
      })
      .select()
      .maybeSingle();

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
        importedAt: importLog?.imported_at,
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
    console.error('Error in process-production:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);

    let errorMessage = 'Error desconocido al procesar el archivo';

    if (error.message) {
      errorMessage = error.message;
    } else if (error.code) {
      if (error.code === 'PGRST116') {
        errorMessage = 'Error: la tabla de producción no existe o no tiene permisos';
      } else if (error.code === '23505') {
        errorMessage = 'Error: registro duplicado en la base de datos';
      } else if (error.code === '23503') {
        errorMessage = 'Error: referencia inválida en los datos';
      } else {
        errorMessage = `Error de base de datos: ${error.code}`;
      }
    }

    console.error('[process-production] Returning error to client:', errorMessage);

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