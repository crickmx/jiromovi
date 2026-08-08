// ============================================================================
// alta-subir-contrato — carga del contrato base al bucket privado, SOLO Admin.
// El flujo de alta (obtenerContrato en alta-enviar-cincel) lee estos archivos:
//   altas-onboarding/_contratos/contrato_con_cedula.pdf
//   altas-onboarding/_contratos/contrato_en_desarrollo.pdf
// Deploy con verify_jwt=true (el admin manda su JWT). Valida rol Administrador.
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',')[1] : b64; // por si viene como data URI
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Autorización: debe ser un Administrador activo.
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!token) return json({ error: 'NO_AUTORIZADO' }, 401);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'TOKEN_INVALIDO' }, 401);
    const { data: perfil } = await admin.from('usuarios').select('rol, activo').eq('id', user.id).maybeSingle();
    if (!perfil || perfil.rol !== 'Administrador' || perfil.activo === false) {
      return json({ error: 'SOLO_ADMINISTRADOR' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const tipo = String(body.tipo || '');
    if (tipo !== 'con_cedula' && tipo !== 'en_desarrollo') return json({ error: 'TIPO_INVALIDO' }, 400);
    if (!body.pdf_base64) return json({ error: 'FALTA_PDF' }, 400);

    const bytes = b64ToBytes(String(body.pdf_base64));
    // Validación mínima de que es un PDF.
    const head = new TextDecoder().decode(bytes.slice(0, 5));
    if (!head.startsWith('%PDF')) return json({ error: 'NO_ES_PDF' }, 400);
    if (bytes.length > 20 * 1024 * 1024) return json({ error: 'PDF_MUY_GRANDE' }, 400);

    const path = `_contratos/contrato_${tipo}.pdf`;
    const { error } = await admin.storage.from('altas-onboarding')
      .upload(path, new Blob([bytes], { type: 'application/pdf' }), { upsert: true, contentType: 'application/pdf' });
    if (error) return json({ error: 'NO_SE_PUDO_SUBIR', detalle: error.message }, 500);

    return json({ ok: true, path, bytes: bytes.length });
  } catch (e) {
    console.error('[alta-subir-contrato] error:', e);
    return json({ error: 'ERROR_SERVIDOR', detalle: String((e as Error)?.message || e) }, 500);
  }
});
