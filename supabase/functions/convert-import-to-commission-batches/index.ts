import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WeekGroup {
  week_number: number;
  year: number;
  date_from: string;
  date_to: string;
  items: any[];
}

function getWeekNumber(date: Date): { week: number; year: number; monday: Date; sunday: Date } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  const monday = new Date(d);
  monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1);

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  return {
    week: weekNo,
    year: d.getFullYear(),
    monday,
    sunday
  };
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { import_batch_id } = body;

    if (!import_batch_id) {
      return new Response(
        JSON.stringify({ error: 'import_batch_id requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Convert] Iniciando conversión para batch: ${import_batch_id}`);

    const { data: batch, error: batchError } = await supabase
      .from('document_import_batches')
      .select('*')
      .eq('id', import_batch_id)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ error: 'Batch no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (batch.is_converted) {
      return new Response(
        JSON.stringify({ error: 'Este batch ya fue convertido anteriormente' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Convert] Obteniendo items insertables desde staging...`);

    const { data: insertableItems, error: itemsError } = await adminSupabase
      .from('document_import_items')
      .select('*')
      .eq('import_batch_id', import_batch_id)
      .in('status', ['valid', 'warning'])
      .order('row_index');

    if (itemsError) {
      console.error('[Convert] Error al obtener items:', itemsError);
      return new Response(
        JSON.stringify({ error: 'Error al obtener items: ' + itemsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!insertableItems || insertableItems.length === 0) {
      console.log(`[Convert] No hay items insertables`);

      let diagnostic: any = {
        batch_id: import_batch_id,
        counts: {
          total: 0,
          valid: 0,
          warning: 0,
          discard: 0
        },
        message: 'No se encontraron items válidos para convertir'
      };

      try {
        const { data: diagData, error: diagError } = await adminSupabase.rpc('get_import_diagnostic', {
          p_batch_id: import_batch_id
        });

        if (!diagError && diagData) {
          diagnostic = diagData;
        } else {
          console.warn('[Convert] No se pudo obtener diagnóstico:', diagError);
        }
      } catch (diagError: any) {
        console.warn('[Convert] Error al obtener diagnóstico:', diagError);
      }

      await supabase
        .from('document_import_batches')
        .update({
          conversion_failed_reason: 'No hay items válidos para convertir',
          is_converted: false
        })
        .eq('id', import_batch_id);

      return new Response(
        JSON.stringify({
          success: false,
          code: 'NO_ITEMS_INSERTED',
          message: 'No hay filas insertables en staging',
          diagnostic
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Convert] Items insertables: ${insertableItems.length}`);
    console.log(`[Convert] Agrupando por semana...`);

    const weekGroups: Map<string, WeekGroup> = new Map();

    for (const item of insertableItems) {
      let weekKey: string;
      let weekData: WeekGroup;

      if (item.fpago) {
        const date = new Date(item.fpago);
        const { week, year, monday, sunday } = getWeekNumber(date);
        weekKey = `${year}-W${week}`;

        if (!weekGroups.has(weekKey)) {
          weekGroups.set(weekKey, {
            week_number: week,
            year,
            date_from: monday.toISOString().split('T')[0],
            date_to: sunday.toISOString().split('T')[0],
            items: []
          });
        }
      } else {
        weekKey = 'no-date';
        if (!weekGroups.has(weekKey)) {
          weekGroups.set(weekKey, {
            week_number: 0,
            year: new Date().getFullYear(),
            date_from: '',
            date_to: '',
            items: []
          });
        }
      }

      weekGroups.get(weekKey)!.items.push(item);
    }

    console.log(`[Convert] Semanas detectadas: ${weekGroups.size}`);

    const createdBatches = [];
    let totalInsertedItems = 0;

    for (const [weekKey, weekGroup] of weekGroups) {
      if (weekGroup.items.length === 0) {
        console.log(`[Convert] Omitiendo semana ${weekKey} sin items`);
        continue;
      }

      console.log(`[Convert] Creando batch para semana ${weekKey} con ${weekGroup.items.length} items`);

      const batchInsert: any = {
        week_number: weekGroup.week_number,
        year: weekGroup.year,
        status: 'open',
        created_by: user.id,
        import_batch_id: import_batch_id
      };

      if (weekGroup.date_from) {
        batchInsert.date_from = weekGroup.date_from;
        batchInsert.date_to = weekGroup.date_to;
      }

      const { data: commissionBatch, error: batchCreateError } = await adminSupabase
        .from('commission_batches')
        .insert(batchInsert)
        .select()
        .single();

      if (batchCreateError || !commissionBatch) {
        console.error(`[Convert] Error al crear commission_batch:`, batchCreateError);
        throw new Error('Error al crear lote de comisiones: ' + batchCreateError?.message);
      }

      console.log(`[Convert] Commission batch creado: ${commissionBatch.id}`);

      const detailsToInsert = weekGroup.items.map(item => ({
        commission_batch_id: commissionBatch.id,
        agent_key: item.agent_key,
        agent_name_raw: item.agent_name_raw,
        agent_name_norm: item.agent_name_norm,
        agent_name_signature: item.agent_name_signature,
        user_id: item.movi_user_id,
        documento: item.documento,
        endoso: item.endoso,
        fpago: item.fpago,
        aseguradora: item.aseguradora,
        ramo: item.ramo,
        importe_base: item.importe_base,
        porcentaje: item.porcentaje,
        comision_calculada: item.comision_calculada,
        prima_neta_info: item.prima_neta_info,
        concepto: item.concepto,
        oficina: item.oficina,
        nombre_completo: item.nombre_completo,
        pending_assignment: item.movi_user_id === null,
        raw_import_data: item.raw_json
      }));

      console.log(`[Convert] Insertando ${detailsToInsert.length} items en commission_details...`);

      const CHUNK_SIZE = 500;
      let insertedInBatch = 0;

      for (let i = 0; i < detailsToInsert.length; i += CHUNK_SIZE) {
        const chunk = detailsToInsert.slice(i, i + CHUNK_SIZE);

        const { error: insertError, count } = await adminSupabase
          .from('commission_details')
          .insert(chunk);

        if (insertError) {
          console.error(`[Convert] Error al insertar chunk:`, insertError);
          throw new Error('Error al insertar detalles de comisión: ' + insertError.message);
        }

        insertedInBatch += chunk.length;
        console.log(`[Convert] Insertados ${insertedInBatch}/${detailsToInsert.length} items`);
      }

      totalInsertedItems += insertedInBatch;

      await adminSupabase
        .from('commission_batches')
        .update({
          total_items: insertedInBatch,
          pending_items: detailsToInsert.filter(d => d.pending_assignment).length,
          assigned_items: detailsToInsert.filter(d => !d.pending_assignment).length
        })
        .eq('id', commissionBatch.id);

      createdBatches.push({
        batch_id: commissionBatch.id,
        week_number: weekGroup.week_number,
        year: weekGroup.year,
        items: insertedInBatch,
        date_from: weekGroup.date_from,
        date_to: weekGroup.date_to
      });
    }

    if (totalInsertedItems === 0) {
      throw new Error('No se insertaron items aunque había items insertables');
    }

    console.log(`[Convert] Marcando batch como convertido...`);

    await supabase
      .from('document_import_batches')
      .update({
        is_converted: true,
        conversion_failed_reason: null
      })
      .eq('id', import_batch_id);

    console.log(`[Convert] Conversión completada exitosamente`);
    console.log(`[Convert] Total insertado: ${totalInsertedItems} items en ${createdBatches.length} lotes`);

    return new Response(
      JSON.stringify({
        success: true,
        created_batches: createdBatches,
        totalInsertedItems,
        counts: {
          valid: insertableItems.filter(i => i.status === 'valid').length,
          warning: insertableItems.filter(i => i.status === 'warning').length
        },
        message: `Conversión completada: ${totalInsertedItems} items en ${createdBatches.length} lotes`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Convert] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido al convertir',
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});