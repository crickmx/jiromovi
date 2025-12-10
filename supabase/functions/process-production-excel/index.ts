import { createClient } from 'npm:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExcelRow {
  Fecha: string | Date;
  DespNombre: string;
  GerenciaNombre: string;
  'Dirección Regional'?: string;
  VendNombre: string;
  'Nombre Compañía': string;
  RamosNombre: string;
  'Sub Ramo'?: string;
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

    if (file.size > 50 * 1024 * 1024) {
      throw new Error('El archivo es demasiado grande (máximo 50MB)');
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

    const requiredColumns = [
      'Fecha', 'DespNombre', 'GerenciaNombre', 'VendNombre',
      'Nombre Compañía', 'RamosNombre', 'IMPORTE PESOS',
      'Prima de convenio', 'Prima Ponderada', 'Bono'
    ];

    const firstRow = rows[0];
    const availableColumns = Object.keys(firstRow);
    console.log('[process-production] Available columns:', availableColumns);

    const missingColumns = requiredColumns.filter(col => !(col in firstRow));

    if (missingColumns.length > 0) {
      console.error('[process-production] Missing columns:', missingColumns);
      console.error('[process-production] Required columns:', requiredColumns);
      throw new Error(`Faltan columnas requeridas: ${missingColumns.join(', ')}`);
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

    const officesCache = new Map<string, string>();
    const managementsCache = new Map<string, string>();
    const regionsCache = new Map<string, string>();

    console.log('[process-production] Processing rows...');
    const recordsToInsert: any[] = [];
    let processedCount = 0;

    for (const row of rows) {
      try {
        let fecha: Date;
        if (typeof row.Fecha === 'string') {
          fecha = new Date(row.Fecha);
        } else if (row.Fecha instanceof Date) {
          fecha = row.Fecha;
        } else if (typeof row.Fecha === 'number') {
          const excelEpoch = new Date(1899, 11, 30);
          fecha = new Date(excelEpoch.getTime() + row.Fecha * 86400000);
        } else {
          console.warn('Invalid date format:', row.Fecha);
          continue;
        }

        if (isNaN(fecha.getTime())) {
          console.warn('Invalid date:', row.Fecha);
          continue;
        }

        const anio = fecha.getFullYear();
        const mes = fecha.getMonth() + 1;
        const dia = fecha.getDate();
        const periodoMes = `${anio}-${mes.toString().padStart(2, '0')}`;
        const periodoAnio = anio;

        const despNombre = (row.DespNombre || '').toString().trim();
        const gerenciaNombre = (row.GerenciaNombre || '').toString().trim();
        const regionNombre = (row['Dirección Regional'] || '').toString().trim();

        if (!despNombre || !gerenciaNombre) {
          console.warn('Missing office or management name');
          continue;
        }

        let officeId = officesCache.get(despNombre.toLowerCase());
        if (!officeId) {
          const { data: existingOffice, error: officeSearchError } = await supabase
            .from('production_offices')
            .select('id')
            .ilike('name', despNombre)
            .maybeSingle();

          if (officeSearchError) {
            console.error('Error searching office:', officeSearchError);
            continue;
          }

          if (existingOffice) {
            officeId = existingOffice.id;
          } else {
            const { data: newOffice, error: officeError } = await supabase
              .from('production_offices')
              .insert({
                name: despNombre,
                original_names: [despNombre]
              })
              .select('id')
              .maybeSingle();

            if (officeError || !newOffice) {
              console.error('Error creating office:', officeError);
              continue;
            }
            officeId = newOffice.id;
          }
          officesCache.set(despNombre.toLowerCase(), officeId);
        }

        let managementId = managementsCache.get(gerenciaNombre.toLowerCase());
        if (!managementId) {
          const { data: existingManagement, error: managementSearchError } = await supabase
            .from('production_managements')
            .select('id')
            .ilike('name', gerenciaNombre)
            .maybeSingle();

          if (managementSearchError) {
            console.error('Error searching management:', managementSearchError);
            continue;
          }

          if (existingManagement) {
            managementId = existingManagement.id;
          } else {
            const { data: newManagement, error: managementError } = await supabase
              .from('production_managements')
              .insert({
                name: gerenciaNombre,
                original_names: [gerenciaNombre]
              })
              .select('id')
              .maybeSingle();

            if (managementError || !newManagement) {
              console.error('Error creating management:', managementError);
              continue;
            }
            managementId = newManagement.id;
          }
          managementsCache.set(gerenciaNombre.toLowerCase(), managementId);
        }

        let regionId: string | null = null;
        if (regionNombre) {
          regionId = regionsCache.get(regionNombre.toLowerCase()) || null;
          if (!regionId) {
            const { data: existingRegion, error: regionSearchError } = await supabase
              .from('production_regions')
              .select('id')
              .ilike('name', regionNombre)
              .maybeSingle();

            if (regionSearchError) {
              console.error('Error searching region:', regionSearchError);
            } else if (existingRegion) {
              regionId = existingRegion.id;
            } else {
              const { data: newRegion, error: regionError } = await supabase
                .from('production_regions')
                .insert({
                  name: regionNombre,
                  original_names: [regionNombre]
                })
                .select('id')
                .maybeSingle();

              if (!regionError && newRegion) {
                regionId = newRegion.id;
              }
            }
            if (regionId) {
              regionsCache.set(regionNombre.toLowerCase(), regionId);
            }
          }
        }

        const importePesos = parseFloat(row['IMPORTE PESOS']?.toString() || '0') || 0;
        const primaConvenio = parseFloat(row['Prima de convenio']?.toString() || '0') || 0;
        const primaPonderada = parseFloat(row['Prima Ponderada']?.toString() || '0') || 0;
        const bono = parseFloat(row['Bono']?.toString() || '0') || 0;
        const porcentajeBono = row['% BONO'] ? parseFloat(row['% BONO'].toString()) : null;

        const convenioStr = (row.CONVENIO || '').toString().toLowerCase().trim();
        const convenioFlag = convenioStr === 'si' || convenioStr === 'sí' || convenioStr === 'yes' || primaConvenio > 0;

        recordsToInsert.push({
          fecha: fecha.toISOString().split('T')[0],
          anio,
          mes,
          dia,
          periodo_mes: periodoMes,
          periodo_anio: periodoAnio,
          office_id: officeId,
          management_id: managementId,
          region_id: regionId,
          desp_nombre_raw: despNombre,
          gerencia_nombre_raw: gerenciaNombre,
          region_raw: regionNombre || null,
          agente_nombre: (row.VendNombre || '').toString().trim(),
          aseguradora_nombre: (row['Nombre Compañía'] || '').toString().trim(),
          ramo_nombre: (row.RamosNombre || '').toString().trim(),
          subramo_nombre: (row['Sub Ramo'] || '').toString().trim() || null,
          importe_pesos: importePesos,
          prima_convenio: primaConvenio,
          prima_ponderada: primaPonderada,
          bono: bono,
          convenio_flag: convenioFlag,
          porcentaje_bono: porcentajeBono
        });

        processedCount++;

        if (recordsToInsert.length >= 500) {
          const { error: insertError } = await supabase
            .from('production_records')
            .insert(recordsToInsert);

          if (insertError) {
            console.error('Error inserting batch:', insertError);
          }
          recordsToInsert.length = 0;
        }

      } catch (rowError: any) {
        console.error('Error processing row:', rowError.message);
      }
    }

    if (recordsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('production_records')
        .insert(recordsToInsert);

      if (insertError) {
        console.error('Error inserting final batch:', insertError);
        throw new Error(`Error al insertar registros: ${insertError.message}`);
      }
    }

    console.log(`[process-production] Successfully processed ${processedCount} records`);

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