import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (req.method === "PUT") {
      // Reset password
      const { customer_id, auth_user_id, new_password } = await req.json();

      if (!auth_user_id || !new_password) {
        return new Response(
          JSON.stringify({ error: "auth_user_id and new_password required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(
        auth_user_id,
        { password: new_password }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (customer_id) {
        await supabase
          .from("seguwallet_customers")
          .update({ password_updated_at: new Date().toISOString() })
          .eq("id", customer_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - Create customer
    const body = await req.json();
    const { full_name, email, phone, password, agent_user_id, created_by, created_by_role } = body;

    if (!full_name || !email || !password || !agent_user_id) {
      return new Response(
        JSON.stringify({ error: "full_name, email, password, and agent_user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check email uniqueness in seguwallet_customers
    const { data: existing } = await supabase
      .from("seguwallet_customers")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Ya existe un cliente con ese correo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: {
        tipo: "seguwallet_customer",
        full_name,
      },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create seguwallet_customers record
    const { data: customer, error: customerError } = await supabase
      .from("seguwallet_customers")
      .insert({
        auth_user_id: authData.user.id,
        agent_user_id,
        email: email.toLowerCase().trim(),
        full_name,
        phone: phone || "",
        status: "active",
        created_by: created_by || null,
        created_by_role: created_by_role || null,
      })
      .select()
      .single();

    if (customerError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: customerError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, customer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
