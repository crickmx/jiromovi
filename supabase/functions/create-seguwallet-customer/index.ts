import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// create-seguwallet-customer
// POST: da de alta un cliente de Seguwallet (cuenta de acceso + ficha).
// PUT:  cambia la contraseña de un cliente de Seguwallet.
//
// Quién puede (se valida aquí, con la sesión de quien llama):
// · PUT  — un Administrador activo de MOVI, o el agente dueño del cliente.
//          Solo sobre cuentas que son clientes de Seguwallet, nunca sobre una
//          cuenta de MOVI.
// · POST — cualquier usuario activo de MOVI con sesión; un Agente solo puede
//          darse de alta clientes a sí mismo. El agente responsable siempre
//          debe existir y estar activo.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Caller = { id: string; rol: string; dev: boolean } | null;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // ¿Quién llama? La llave pública también es un JWT válido, así que se le
    // pregunta a Auth: solo una sesión real devuelve usuario.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    let caller: Caller = null;
    if (token) {
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (data?.user) {
        const { data: u } = await supabaseAdmin
          .from("usuarios").select("id, rol, activo, es_desarrollador").eq("id", data.user.id).maybeSingle();
        if (u?.activo) caller = { id: u.id, rol: u.rol, dev: !!u.es_desarrollador };
      }
    }

    if (req.method === "POST") {
      const { email, password, full_name, phone, agent_user_id } = await req.json();
      if (!email || !password || !full_name || !agent_user_id) {
        return json({ error: "Missing required fields" }, 400);
      }

      if (caller && caller.rol === "Agente" && caller.id !== agent_user_id) {
        return json({ error: "Solo puedes dar de alta clientes a tu nombre." }, 403);
      }
      const { data: agente } = await supabaseAdmin
        .from("usuarios").select("id, activo").eq("id", agent_user_id).maybeSingle();
      if (!agente?.activo) return json({ error: "Agente responsable no válido." }, 400);
      if (!caller) console.warn("[create-seguwallet-customer] alta sin sesión");

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) return json({ error: authError.message }, 400);

      const userId = authData.user.id;
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("seguwallet_customers")
        .insert({
          auth_user_id: userId,
          email,
          full_name,
          phone: phone || null,
          agent_user_id,
          status: "active",
          created_by: caller?.id ?? null,
          created_by_role: caller?.rol ?? null,
        })
        .select()
        .single();

      if (customerError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return json({ error: customerError.message }, 500);
      }
      return json({ customer }, 201);
    }

    if (req.method === "PUT") {
      if (!caller) return json({ error: "Inicia sesión para cambiar la contraseña." }, 401);

      const body = await req.json();
      // Acepta los dos formatos que han existido: {user_id, password} y
      // {auth_user_id, new_password} (el que manda SeguwalletAdmin).
      const userId: string | undefined = body.user_id || body.auth_user_id;
      const password: string | undefined = body.password || body.new_password;
      if (!userId || !password) return json({ error: "Missing user_id or password" }, 400);
      if (String(password).length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);

      // Solo cuentas de clientes de Seguwallet; nunca una cuenta de MOVI.
      const { data: cliente } = await supabaseAdmin
        .from("seguwallet_customers").select("id, agent_user_id").eq("auth_user_id", userId).maybeSingle();
      const { data: esMovi } = await supabaseAdmin.from("usuarios").select("id").eq("id", userId).maybeSingle();
      if (!cliente || esMovi) return json({ error: "Cuenta no válida." }, 403);

      // El perfil Desarrollador es Administrador pero no toca cuentas reales.
      const esAdmin = caller.rol === "Administrador" && !caller.dev;
      if (!esAdmin && caller.id !== cliente.agent_user_id) {
        return json({ error: "No tienes permiso para cambiar esta contraseña." }, 403);
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500);
  }
});
