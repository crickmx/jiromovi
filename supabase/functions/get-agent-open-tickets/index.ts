import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: caller } = await supabase
      .from("usuarios")
      .select("id, rol")
      .eq("id", user.id)
      .maybeSingle();

    if (!caller || !["Administrador", "Gerente", "Empleado", "Ejecutivo"].includes(caller.rol)) {
      throw new Error("Sin permiso");
    }

    const { agentUserId } = await req.json();
    if (!agentUserId) throw new Error("agentUserId requerido");

    const { data: tickets, error: ticketError } = await supabase
      .from("tickets")
      .select("id, folio, instrucciones, prioridad, tipo_tramite, fecha_creacion, estatus_id, ticket_estatus(nombre)")
      .eq("cerrado", false)
      .or(`agente_usuario_id.eq.${agentUserId},agente_id.eq.${agentUserId}`)
      .order("fecha_creacion", { ascending: false })
      .limit(50);

    if (ticketError) throw new Error(`Error: ${ticketError.message}`);

    const mapped = (tickets || []).map((t: Record<string, unknown>) => ({
      id: t.id,
      folio: t.folio || "",
      instrucciones: t.instrucciones || "",
      prioridad: t.prioridad || "Media",
      tipo_tramite: t.tipo_tramite || "",
      fecha_creacion: t.fecha_creacion || "",
      estatus_nombre: (t.ticket_estatus as Record<string, string>)?.nombre || "",
    }));

    return new Response(
      JSON.stringify({ success: true, tickets: mapped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ success: false, error: errMsg, tickets: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
