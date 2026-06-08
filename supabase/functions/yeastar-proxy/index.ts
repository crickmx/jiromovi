import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    if (usuario.rol !== "Administrador") {
      return jsonError("Insufficient permissions", 403);
    }

    const { action, payload } = await req.json();
    if (!action) {
      return jsonError("Missing action parameter", 400);
    }

    const { data: configRow } = await adminClient
      .from("telefonia_config")
      .select("api_mode")
      .limit(1)
      .maybeSingle();

    const apiMode = configRow?.api_mode || "mock";

    if (apiMode === "mock") {
      return jsonOk(getMockResponse(action, payload));
    }

    const pbxUrl = Deno.env.get("YEASTAR_PBX_URL");
    const pbxUsername = Deno.env.get("YEASTAR_PBX_USERNAME");
    const pbxPassword = Deno.env.get("YEASTAR_PBX_PASSWORD");

    if (!pbxUrl || !pbxUsername || !pbxPassword) {
      return jsonError(
        "PBX credentials not configured. Set YEASTAR_PBX_URL, YEASTAR_PBX_USERNAME, YEASTAR_PBX_PASSWORD as Edge Function secrets.",
        500
      );
    }

    const token = await authenticatePbx(pbxUrl, pbxUsername, pbxPassword);
    const result = await executePbxAction(pbxUrl, token, action, payload);
    return jsonOk(result);
  } catch (err: any) {
    return jsonError(err.message || "Internal error", 500);
  }
});

// ── PBX Authentication ──────────────────────────────────────────────────────

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

// ── PBX Action Execution ────────────────────────────────────────────────────

async function executePbxAction(
  url: string,
  token: string,
  action: string,
  payload?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const headers = {
    "Content-Type": "application/json",
    "X-Auth-Token": token,
  };

  switch (action) {
    case "test_connection": {
      const res = await fetch(`${url}/api/v2.0.0/extension/list`, {
        method: "POST",
        headers,
        body: JSON.stringify({ page: 1, page_size: 1 }),
      });
      if (!res.ok) throw new Error(`PBX test failed: HTTP ${res.status}`);
      return { success: true, message: "Conexion exitosa con el PBX" };
    }

    case "create_extension": {
      if (!payload?.number) throw new Error("Missing extension number");
      const res = await fetch(`${url}/api/v2.0.0/extension/create`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          `Create extension failed: ${(err as any).message || res.status}`
        );
      }
      const data = await res.json();
      return {
        success: true,
        message: `Extension ${payload.number} created`,
        yeastarId: data.id || null,
      };
    }

    case "update_extension": {
      if (!payload?.number) throw new Error("Missing extension number");
      const res = await fetch(`${url}/api/v2.0.0/extension/update`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          `Update extension failed: ${(err as any).message || res.status}`
        );
      }
      return { success: true, message: `Extension ${payload.number} updated` };
    }

    case "delete_extension": {
      if (!payload?.number) throw new Error("Missing extension number");
      const res = await fetch(`${url}/api/v2.0.0/extension/delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ number: payload.number }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          `Delete extension failed: ${(err as any).message || res.status}`
        );
      }
      return { success: true, message: `Extension ${payload.number} deleted` };
    }

    case "list_extensions": {
      const res = await fetch(`${url}/api/v2.0.0/extension/list`, {
        method: "POST",
        headers,
        body: JSON.stringify({ page: 1, page_size: 500 }),
      });
      if (!res.ok) throw new Error(`List extensions failed: HTTP ${res.status}`);
      const data = await res.json();
      return {
        success: true,
        extensions: data.extension_list || data.data || [],
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ── Mock Responses ──────────────────────────────────────────────────────────

function getMockResponse(
  action: string,
  payload?: Record<string, unknown>
): Record<string, unknown> {
  switch (action) {
    case "test_connection":
      return {
        success: true,
        message: "[MOCK] Conexion simulada exitosa con el PBX",
      };
    case "create_extension":
      return {
        success: true,
        message: `[MOCK] Extension ${payload?.number || "?"} creada`,
        yeastarId: `mock-${Date.now()}`,
      };
    case "update_extension":
      return {
        success: true,
        message: `[MOCK] Extension ${payload?.number || "?"} actualizada`,
      };
    case "delete_extension":
      return {
        success: true,
        message: `[MOCK] Extension ${payload?.number || "?"} eliminada`,
      };
    case "list_extensions":
      return {
        success: true,
        extensions: [
          { number: "100", name: "Mock User 1", status: "registered" },
          { number: "101", name: "Mock User 2", status: "idle" },
        ],
      };
    default:
      return { success: false, message: `[MOCK] Unknown action: ${action}` };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
