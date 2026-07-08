import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ManageExtensionPayload {
  action: "create" | "update";
  usuario_id: string;
  extension: string;
  first_name: string;
  last_name: string;
  email_addr?: string;
  mobile_number?: string;
  user_password?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("No authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonError("Invalid token", 401);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: usuario, error: userError } = await adminClient
      .from("usuarios")
      .select("id, rol")
      .eq("id", user.id)
      .single();

    if (userError || !usuario) {
      return jsonError("User not found in system", 403);
    }
    if (!["admin", "administrador"].includes(usuario.rol?.toLowerCase())) {
      return jsonError("Insufficient permissions", 403);
    }

    const payload: ManageExtensionPayload = await req.json();
    if (!payload.action || !payload.usuario_id || !payload.extension) {
      return jsonError("Missing required fields: action, usuario_id, extension", 400);
    }
    if (!payload.first_name || !payload.last_name) {
      return jsonError("Missing required fields: first_name, last_name", 400);
    }

    const { data: configRow } = await adminClient
      .from("telefonia_config")
      .select("api_mode")
      .limit(1)
      .maybeSingle();

    const apiMode = configRow?.api_mode || "mock";

    let pbxResult: { success: boolean; yeastarId?: string; message: string };

    if (apiMode === "mock") {
      pbxResult = {
        success: true,
        yeastarId: `mock-${Date.now()}`,
        message: `[MOCK] Extension ${payload.extension} ${payload.action === "create" ? "created" : "updated"}`,
      };
    } else {
      const pbxUrl = Deno.env.get("YEASTAR_PBX_URL");
      const pbxUsername = Deno.env.get("YEASTAR_PBX_USERNAME");
      const pbxPassword = Deno.env.get("YEASTAR_PBX_PASSWORD");

      if (!pbxUrl || !pbxUsername || !pbxPassword) {
        return jsonError("PBX credentials not configured", 500);
      }

      const token = await authenticatePbx(pbxUrl, pbxUsername, pbxPassword);

      const pbxPayload: Record<string, unknown> = {
        number: payload.extension,
        first_name: payload.first_name,
        last_name: payload.last_name,
      };
      if (payload.email_addr) pbxPayload.email_addr = payload.email_addr;
      if (payload.mobile_number) pbxPayload.mobile_number = payload.mobile_number;
      if (payload.user_password) pbxPayload.user_password = payload.user_password;

      const endpoint = payload.action === "create"
        ? `${pbxUrl}/api/v2.0.0/extension/create`
        : `${pbxUrl}/api/v2.0.0/extension/update`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": token,
        },
        body: JSON.stringify(pbxPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          `PBX ${payload.action} failed: ${(err as any).message || res.status}`
        );
      }

      const data = await res.json();
      pbxResult = {
        success: true,
        yeastarId: data.id || undefined,
        message: `Extension ${payload.extension} ${payload.action === "create" ? "created" : "updated"} in PBX`,
      };
    }

    // Upsert telefonia_usuarios
    const { data: existingAssignment } = await adminClient
      .from("telefonia_usuarios")
      .select("id")
      .eq("usuario_id", payload.usuario_id)
      .eq("extension", payload.extension)
      .maybeSingle();

    if (existingAssignment) {
      await adminClient
        .from("telefonia_usuarios")
        .update({
          estado: "activo",
          yeastar_extension_id: pbxResult.yeastarId || null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAssignment.id);
    } else {
      await adminClient.from("telefonia_usuarios").insert({
        usuario_id: payload.usuario_id,
        extension: payload.extension,
        tipo: "sip",
        estado: "activo",
        yeastar_extension_id: pbxResult.yeastarId || null,
        last_synced_at: new Date().toISOString(),
      });
    }

    // Update telefonia_extensiones state
    await adminClient
      .from("telefonia_extensiones")
      .update({
        estado: "asignada",
        usuario_asignado_id: payload.usuario_id,
        updated_at: new Date().toISOString(),
      })
      .eq("extension", payload.extension);

    // Update usuarios.extension_telefonica
    await adminClient
      .from("usuarios")
      .update({ extension_telefonica: payload.extension })
      .eq("id", payload.usuario_id);

    return jsonOk({
      success: true,
      message: pbxResult.message,
      yeastar_id: pbxResult.yeastarId || null,
    });
  } catch (err: any) {
    return jsonError(err.message || "Internal error", 500);
  }
});

async function authenticatePbx(
  url: string,
  username: string,
  password: string
): Promise<string> {
  const res = await fetch(`${url}/api/v2.0.0/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`PBX authentication failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.token) {
    throw new Error("PBX authentication failed: no token returned");
  }
  return data.token;
}

function jsonOk(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
