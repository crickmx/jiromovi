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
      if (!res.ok)
        throw new Error(`List extensions failed: HTTP ${res.status}`);
      const data = await res.json();
      return {
        success: true,
        extensions: data.extension_list || data.data || [],
      };
    }

    // ── Diagnostic Actions (read-only) ─────────────────────────────────────

    case "diagnose_connection": {
      const testRes = await fetch(`${url}/api/v2.0.0/extension/list`, {
        method: "POST",
        headers,
        body: JSON.stringify({ page: 1, page_size: 1 }),
      });
      const testOk = testRes.ok;
      const testBody = await testRes.json().catch(() => ({}));

      return {
        success: true,
        connection: {
          reachable: true,
          authenticated: testOk,
          api_response: testBody,
          timestamp: new Date().toISOString(),
        },
      };
    }

    case "get_pbx_info": {
      const endpoints = [
        { path: "/api/v2.0.0/system/get", label: "system_info" },
        { path: "/api/v2.0.0/deviceinfo/get", label: "device_info" },
        { path: "/api/v2.0.0/system/status", label: "system_status" },
      ];

      const results: Record<string, unknown> = {};
      for (const ep of endpoints) {
        try {
          const res = await fetch(`${url}${ep.path}`, {
            method: "POST",
            headers,
            body: JSON.stringify({}),
          });
          results[ep.label] = {
            status: res.status,
            ok: res.ok,
            data: await res.json().catch(() => null),
          };
        } catch (e: any) {
          results[ep.label] = { status: 0, ok: false, error: e.message };
        }
      }

      return {
        success: true,
        pbx_info: results,
        timestamp: new Date().toISOString(),
      };
    }

    case "probe_api_versions": {
      const pbxUsername = Deno.env.get("YEASTAR_PBX_USERNAME")!;
      const pbxPassword = Deno.env.get("YEASTAR_PBX_PASSWORD")!;
      const versions = ["v2", "v2.0", "v2.0.0", "v1.0", "api"];
      const probeResults: Array<{
        version: string;
        login_status: number | null;
        login_ok: boolean;
        list_status: number | null;
        list_ok: boolean;
        error?: string;
      }> = [];

      for (const ver of versions) {
        const loginPath = `${url}/api/${ver}/login`;
        const listPath = `${url}/api/${ver}/extension/list`;
        let loginStatus: number | null = null;
        let loginOk = false;
        let listStatus: number | null = null;
        let listOk = false;
        let error: string | undefined;

        try {
          const loginRes = await fetch(loginPath, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: pbxUsername,
              password: pbxPassword,
            }),
          });
          loginStatus = loginRes.status;
          loginOk = loginRes.ok;

          if (loginOk) {
            const loginData = await loginRes.json().catch(() => ({}));
            const verToken = (loginData as any).token;
            if (verToken) {
              const listRes = await fetch(listPath, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Auth-Token": verToken,
                },
                body: JSON.stringify({ page: 1, page_size: 1 }),
              });
              listStatus = listRes.status;
              listOk = listRes.ok;
            }
          }
        } catch (e: any) {
          error = e.message;
        }

        probeResults.push({
          version: ver,
          login_status: loginStatus,
          login_ok: loginOk,
          list_status: listStatus,
          list_ok: listOk,
          ...(error ? { error } : {}),
        });
      }

      return {
        success: true,
        api_versions: probeResults,
        timestamp: new Date().toISOString(),
      };
    }

    case "probe_endpoints": {
      const endpointList = [
        "/api/v2.0.0/extension/list",
        "/api/v2.0.0/trunk/list",
        "/api/v2.0.0/inroute/list",
        "/api/v2.0.0/outroute/list",
        "/api/v2.0.0/ivr/list",
        "/api/v2.0.0/queue/list",
        "/api/v2.0.0/ringgroup/list",
        "/api/v2.0.0/paginggroup/list",
        "/api/v2.0.0/conference/list",
        "/api/v2.0.0/voicemail/list",
        "/api/v2.0.0/firewall/list",
        "/api/v2.0.0/sip/get",
        "/api/v2.0.0/system/get",
        "/api/v2.0.0/deviceinfo/get",
        "/api/v2.0.0/cdr/list",
        "/api/v2.0.0/recording/list",
      ];

      const probeResults: Array<{
        endpoint: string;
        status: number | null;
        available: boolean;
        error?: string;
      }> = [];

      for (const ep of endpointList) {
        try {
          const res = await fetch(`${url}${ep}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ page: 1, page_size: 1 }),
          });
          probeResults.push({
            endpoint: ep,
            status: res.status,
            available: res.ok,
          });
        } catch (e: any) {
          probeResults.push({
            endpoint: ep,
            status: null,
            available: false,
            error: e.message,
          });
        }
      }

      return {
        success: true,
        endpoints: probeResults,
        summary: {
          total: probeResults.length,
          available: probeResults.filter((r) => r.available).length,
          unavailable: probeResults.filter((r) => !r.available).length,
        },
        timestamp: new Date().toISOString(),
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
    case "diagnose_connection":
      return {
        success: true,
        connection: {
          reachable: true,
          authenticated: true,
          api_response: { mock: true },
          timestamp: new Date().toISOString(),
        },
      };
    case "get_pbx_info":
      return {
        success: true,
        pbx_info: {
          system_info: {
            status: 200,
            ok: true,
            data: {
              model: "P-Series (Mock)",
              firmware: "83.14.0.50",
              serial: "MOCK-SERIAL-001",
              uptime: "7 days",
            },
          },
          device_info: {
            status: 200,
            ok: true,
            data: {
              product_name: "Yeastar P570",
              hardware_version: "1.0",
              max_extensions: 500,
              max_concurrent_calls: 120,
            },
          },
          system_status: {
            status: 200,
            ok: true,
            data: {
              cpu_usage: "12%",
              memory_usage: "34%",
              disk_usage: "21%",
              active_calls: 3,
            },
          },
        },
        timestamp: new Date().toISOString(),
      };
    case "probe_api_versions":
      return {
        success: true,
        api_versions: [
          {
            version: "v2",
            login_status: 404,
            login_ok: false,
            list_status: null,
            list_ok: false,
          },
          {
            version: "v2.0",
            login_status: 404,
            login_ok: false,
            list_status: null,
            list_ok: false,
          },
          {
            version: "v2.0.0",
            login_status: 200,
            login_ok: true,
            list_status: 200,
            list_ok: true,
          },
          {
            version: "v1.0",
            login_status: 404,
            login_ok: false,
            list_status: null,
            list_ok: false,
          },
          {
            version: "api",
            login_status: 404,
            login_ok: false,
            list_status: null,
            list_ok: false,
          },
        ],
        timestamp: new Date().toISOString(),
      };
    case "probe_endpoints":
      return {
        success: true,
        endpoints: [
          { endpoint: "/api/v2.0.0/extension/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/trunk/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/inroute/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/outroute/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/ivr/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/queue/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/ringgroup/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/paginggroup/list", status: 403, available: false },
          { endpoint: "/api/v2.0.0/conference/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/voicemail/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/firewall/list", status: 403, available: false },
          { endpoint: "/api/v2.0.0/sip/get", status: 200, available: true },
          { endpoint: "/api/v2.0.0/system/get", status: 200, available: true },
          { endpoint: "/api/v2.0.0/deviceinfo/get", status: 200, available: true },
          { endpoint: "/api/v2.0.0/cdr/list", status: 200, available: true },
          { endpoint: "/api/v2.0.0/recording/list", status: 403, available: false },
        ],
        summary: { total: 16, available: 13, unavailable: 3 },
        timestamp: new Date().toISOString(),
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
