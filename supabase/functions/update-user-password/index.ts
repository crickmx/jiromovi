// Cambiar la contraseña (o el correo) de una cuenta.
//
// 🔴 HUECO CERRADO EL 2026-10-30 — esta función NO verificaba quién la llamaba.
//
// Tomaba `userId` y `password` del cuerpo y llamaba a `auth.admin.updateUserById`
// con la llave de servicio, sin mirar el JWT de quien pedía. Se comprobó contra
// el servidor real: con la llave **anon** —la que va en el bundle público de
// beta, producción, tienda y seguros.express— la función se ejecutaba completa
// y llegaba hasta `updateUserById`. Solo fallaba si el UUID no existía.
//
// O sea que cualquier usuario con sesión —un Empleado, un Agente, uno de los
// bots de QA— podía quedarse con la cuenta de un Administrador, y desde
// internet lo único que protegía a cada cuenta era no saberse su UUID.
//
// **El gateway no alcanza como candado.** Con `verify_jwt` encendido, el
// gateway acepta la llave anon porque técnicamente es un JWT válido. La única
// verificación que sirve es la de aquí dentro: `auth.getUser(token)` devuelve
// null para la llave anon, y eso es lo que corta.
//
// Las reglas, en una línea: **tu propia contraseña la cambias tú; la de alguien
// más, solo un Administrador.** Cambiar un correo es siempre de Administrador,
// porque el correo es con lo que se entra.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UpdatePasswordRequest {
  userId: string;
  password?: string;
  email?: string;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. QUIÉN LLAMA ────────────────────────────────────────────────────────
    // Va antes de leer el cuerpo a propósito: sin identidad no hay nada que
    // discutir, y así no se procesa ni un byte de quien no debería estar aquí.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No autorizado' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    // Aquí muere la llave anon: es un JWT válido para el gateway, pero no
    // representa a ninguna persona, así que `user` llega en null.
    if (authError || !user) {
      console.warn('[update-user-password] Rechazado: token sin usuario');
      return json({ error: 'No autorizado' }, 401);
    }

    const { data: quienLlama } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', user.id)
      .maybeSingle();

    if (!quienLlama || quienLlama.activo === false) {
      console.warn('[update-user-password] Rechazado: sin ficha o inactivo', user.id);
      return json({ error: 'No autorizado' }, 403);
    }

    // ── 2. QUÉ PIDE ───────────────────────────────────────────────────────────
    const { userId, password, email }: UpdatePasswordRequest = await req.json();

    if (!userId) return json({ error: 'Falta el userId' }, 400);
    if (!password && !email) return json({ error: 'Falta la contraseña o el correo' }, 400);

    const esAdmin = quienLlama.rol === 'Administrador';
    const esSuPropiaCuenta = quienLlama.id === userId;

    // ── 3. SI PUEDE ───────────────────────────────────────────────────────────
    if (!esAdmin && !esSuPropiaCuenta) {
      console.warn(
        `[update-user-password] Rechazado: ${quienLlama.rol} ${quienLlama.id} intentó cambiar la cuenta ${userId}`,
      );
      return json({ error: 'Solo un Administrador puede cambiar la cuenta de otra persona' }, 403);
    }

    // El correo es con lo que se entra, así que cambiarlo nunca es un
    // autoservicio: alguien podría apropiarse de su propia cuenta de trabajo.
    if (email && !esAdmin) {
      return json({ error: 'Solo un Administrador puede cambiar el correo' }, 403);
    }

    const updateData: { password?: string; email?: string; email_confirm?: boolean } = {};
    if (password) updateData.password = password;
    if (email) {
      updateData.email = email;
      updateData.email_confirm = true;
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);

    if (error) {
      console.error('[update-user-password] Error de Supabase:', error.message);
      return json({ error: error.message }, 400);
    }

    // Queda constancia de quién le cambió la cuenta a quién. Cambiar una
    // contraseña ajena es una acción que alguien tiene que poder auditar
    // después; sin esta línea, no deja rastro en ningún lado.
    console.log(
      `[update-user-password] ${quienLlama.rol} ${quienLlama.id} actualizó ` +
      `${password ? 'contraseña' : ''}${password && email ? ' y ' : ''}${email ? 'correo' : ''} ` +
      `de ${userId}`,
    );

    return json({ success: true, userId, email: data.user?.email, updated: true }, 200);
  } catch (error) {
    // Sin `stack` en la respuesta: lo que se devuelve al navegador no tiene por
    // qué describir el interior de la función.
    console.error('[update-user-password] Error:', (error as Error).message);
    return json({ error: 'No se pudo completar la operación' }, 500);
  }
});
