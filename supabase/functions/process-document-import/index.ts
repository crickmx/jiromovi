import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExcelRow {
  [key: string]: any;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string' || !email.trim()) return null;
  return email.trim().toLowerCase();
}

function normalizeName(name: string | null | undefined): string | null {
  if (!name || typeof name !== 'string' || !name.trim()) return null;

  let normalized = name.trim().toLowerCase();
  normalized = normalized.replace(/\s+/g, ' ');

  const accentMap: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u',
    'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ñ': 'n', 'Ü': 'u',
  };

  normalized = normalized.replace(/[áéíóúñüÁÉÍÓÚÑÜ]/g, (match) => accentMap[match] || match);

  return normalized;
}

function calculateVendorKey(vendorEmail: string | null, vendorName: string | null): string {
  const normalizedEmail = normalizeEmail(vendorEmail);
  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  const normalizedName = normalizeName(vendorName);
  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  return 'unknown';
}

interface FindUserResult {
  user_id: string | null;
  method: string;
}

async function findMoviUserForVendor(
  supabase: any,
  vendorEmail: string | null,
  vendorName: string | null
): Promise<FindUserResult> {
  const { data, error } = await supabase.rpc('find_movi_user_for_vendor', {
    vendor_email: vendorEmail,
    vendor_name: vendorName,
  });

  if (error) {
    console.error('Error en find_movi_user_for_vendor:', error);
    return { user_id: null, method: 'none' };
  }

  return data || { user_id: null, method: 'none' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: userData } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (userData?.rol !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Sin permisos' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const columnMapping = JSON.parse(formData.get('columnMapping') as string || '{}');

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No se proporcionó archivo' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: ExcelRow[] = XLSX.utils.sheet_to_json(firstSheet);

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'El archivo está vacío' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: batch, error: batchError } = await supabase
      .from('document_import_batches')
      .insert({
        file_name: file.name,
        imported_by: user.id,
        status: 'processing',
      })
      .select()
      .single();

    if (batchError || !batch) {
      console.error('Error al crear batch:', batchError);
      return new Response(
        JSON.stringify({ error: 'Error al crear lote de importación' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const documents = [];
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const documentId = row[columnMapping.document_id || 'poliza'] || row['Poliza'] || row['poliza'] || `DOC-${i + 1}`;
      const vendorEmailRaw = row[columnMapping.vendor_email || 'correo'] || row['Correo'] || row['Email'] || null;
      const vendorNameRaw = row[columnMapping.vendor_name || 'nombre'] || row['Nombre'] || row['Vendedor'] || null;

      const vendorEmailNorm = normalizeEmail(vendorEmailRaw);
      const vendorNameNorm = normalizeName(vendorNameRaw);
      const vendorKey = calculateVendorKey(vendorEmailRaw, vendorNameRaw);

      const userMatch = await findMoviUserForVendor(
        adminSupabase,
        vendorEmailRaw,
        vendorNameRaw
      );

      documents.push({
        batch_id: batch.id,
        source_row_index: i + 1,
        document_id: String(documentId),
        vendor_email_raw: vendorEmailRaw,
        vendor_name_raw: vendorNameRaw,
        vendor_email_norm: vendorEmailNorm,
        vendor_name_norm: vendorNameNorm,
        vendor_key: vendorKey,
        movi_user_id: userMatch.user_id,
        match_method: userMatch.method,
        is_unmatched: userMatch.user_id === null,
        document_data: row,
      });
    }

    const { error: insertError } = await adminSupabase
      .from('imported_documents')
      .insert(documents);

    if (insertError) {
      console.error('Error al insertar documentos:', insertError);
      await supabase
        .from('document_import_batches')
        .update({ status: 'failed' })
        .eq('id', batch.id);

      return new Response(
        JSON.stringify({ error: 'Error al procesar documentos' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await adminSupabase.rpc('update_batch_counters', {
      p_batch_id: batch.id,
    });

    await supabase
      .from('document_import_batches')
      .update({ status: 'completed' })
      .eq('id', batch.id);

    const { data: updatedBatch } = await supabase
      .from('document_import_batches')
      .select('*')
      .eq('id', batch.id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        batch: updatedBatch,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error en process-document-import:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error desconocido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});