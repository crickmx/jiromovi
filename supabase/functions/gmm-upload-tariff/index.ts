import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';
import { extraerTablasBxplus, resolveSheetName } from '../_shared/bxplusTariffParser.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
      throw new Error('Este archivo de tarifas ya fue cargado anteriormente');
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const requiredSheets = ['Tarifa', 'Cotizacion'];
    for (const sheetName of requiredSheets) {
      const resolved = resolveSheetName(workbook, sheetName);
      if (!resolved) {
        const available = workbook.SheetNames.join(', ');
        throw new Error(
          `Hoja "${sheetName}" no encontrada. Hojas disponibles: [${available}]. ` +
          'Verifique que el archivo sea un cotizador BX+ valido.'
        );
      }
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token!);

    const sanitizedFilename = sanitizeFilename(file.name);
    const storagePath = `${user!.id}/${Date.now()}_${sanitizedFilename}`;
    const { error: uploadError } = await supabase.storage
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

    const { layout, tablas, errores } = extraerTablasBxplus(workbook);

    if (errores.length > 0) {
      await supabase
        .from('tariff_packages')
        .update({
          status: 'failed',
          validation_errors: { parsing_errors: errores, layout },
        })
        .eq('id', pkg.id);

      return new Response(
        JSON.stringify({
          success: false,
          package_id: pkg.id,
          errors: errores,
          layout,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: tablesError } = await supabase
      .from('tariff_tables')
      .insert(tablas.map(t => ({ ...t, tariff_package_id: pkg.id })));

    if (tablesError) throw tablesError;

    return new Response(
      JSON.stringify({
        success: true,
        package: pkg,
        tables_loaded: tablas.length,
        layout,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error uploading tariff:', error);
    // Los errores de Supabase (storage, PostgREST) son objetos planos, no instancias de
    // Error: sin esto la respuesta salía como "[object Object]" y ocultaba la causa.
    const mensaje = error instanceof Error
      ? error.message
      : (typeof error === 'object' && error !== null
        ? ((error as any).message || JSON.stringify(error))
        : String(error));
    return new Response(
      JSON.stringify({ error: mensaje }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
