import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[sync-insurers] Starting insurers sync from Google Sheets...');

    // 1. Obtener datos del Google Sheets
    const fetchUrl = `${supabaseUrl}/functions/v1/fetch-production-sheets`;
    const fetchResponse = await fetch(fetchUrl, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!fetchResponse.ok) {
      throw new Error(`Error fetching sheets: ${fetchResponse.status} ${fetchResponse.statusText}`);
    }

    const fetchResult = await fetchResponse.json();

    if (!fetchResult.success) {
      throw new Error(fetchResult.error || 'Error desconocido al obtener datos');
    }

    const records = fetchResult.records || [];
    console.log('[sync-insurers] Fetched', records.length, 'records from sheets');

    // 2. Extraer aseguradoras únicas
    const insurersSet = new Set<string>();
    for (const record of records) {
      if (record.aseguradora_nombre && record.aseguradora_nombre.trim() !== '') {
        const normalized = record.aseguradora_nombre.trim();
        insurersSet.add(normalized);
      }
    }

    const uniqueInsurers = Array.from(insurersSet).sort();
    console.log('[sync-insurers] Found', uniqueInsurers.length, 'unique insurers:', uniqueInsurers);

    // 3. Obtener aseguradoras actuales de la base de datos
    const { data: existingInsurers, error: fetchError } = await supabase
      .from('cat_aseguradoras')
      .select('id, nombre');

    if (fetchError) {
      throw new Error(`Error fetching existing insurers: ${fetchError.message}`);
    }

    const existingMap = new Map<string, string>();
    for (const insurer of existingInsurers || []) {
      existingMap.set(insurer.nombre, insurer.id);
    }

    // 4. Sincronizar aseguradoras
    let inserted = 0;
    let updated = 0;
    let deactivated = 0;

    // Insertar o reactivar aseguradoras que existen en sheets
    for (const insurerName of uniqueInsurers) {
      const existingId = existingMap.get(insurerName);

      if (existingId) {
        // Ya existe, actualizar para marcarla como activa
        const { error: updateError } = await supabase
          .from('cat_aseguradoras')
          .update({ activo: true })
          .eq('id', existingId);

        if (updateError) {
          console.error('[sync-insurers] Error updating insurer:', insurerName, updateError);
        } else {
          updated++;
        }

        // Remover del map para saber cuáles no están en sheets
        existingMap.delete(insurerName);
      } else {
        // No existe, insertar nueva
        const { error: insertError } = await supabase
          .from('cat_aseguradoras')
          .insert({
            nombre: insurerName,
            activo: true,
          });

        if (insertError) {
          console.error('[sync-insurers] Error inserting insurer:', insurerName, insertError);
        } else {
          inserted++;
        }
      }
    }

    // 5. Desactivar aseguradoras que ya no están en sheets
    for (const [insurerName, insurerId] of existingMap.entries()) {
      const { error: deactivateError } = await supabase
        .from('cat_aseguradoras')
        .update({ activo: false })
        .eq('id', insurerId);

      if (deactivateError) {
        console.error('[sync-insurers] Error deactivating insurer:', insurerName, deactivateError);
      } else {
        deactivated++;
      }
    }

    console.log('[sync-insurers] Sync completed. Inserted:', inserted, 'Updated:', updated, 'Deactivated:', deactivated);

    return new Response(
      JSON.stringify({
        success: true,
        total_unique: uniqueInsurers.length,
        inserted,
        updated,
        deactivated,
        insurers: uniqueInsurers,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('[sync-insurers] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido al sincronizar aseguradoras',
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
