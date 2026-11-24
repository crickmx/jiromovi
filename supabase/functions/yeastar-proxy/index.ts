import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Skip TLS verification for self-signed PBX certificate
// @ts-ignore Deno unstable API
const unsafeHttpClient = Deno.createHttpClient({
  caCerts: [],
  // @ts-ignore required for self-signed cert on PBX IP
  unsafelyIgnoreCertificateErrors: true,
});

function pbxFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, // @ts-ignore Deno client option
    client: unsafeHttpClient } as RequestInit);
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

    const { data: configRow } = await adminClient
      .from("telefonia_config")
      .select("pbx_url, api_mode, oauth_token, oauth_token_expires_at")
      .limit(1)
      .maybeSingle();

    const apiMode = configRow?.api_mode || "mock";
    const pbxUrl = configRow?.pbx_url || Deno.env.get("YEASTAR_PBX_URL");

    const body = await req.json();
    const { action, endpoint, method, payload } = body;

    // --- Action-based routing (frontend uses action field) ---

    if (action === "test_connection") {
      return await handleTestConnection(pbxUrl, apiMode, adminClient, configRow);
    }

    if (action === "probe_api_versions") {
      if (!pbxUrl) return jsonError("PBX URL not configured", 500);
      const results = await probeApiVersions(pbxUrl);
      return jsonOk({ success: true, results });
    }

    if (action === "diagnose_connection") {
      return await handleDiagnoseConnection(pbxUrl, apiMode);
    }

    if (action === "get_pbx_info") {
      return await handleGetPbxInfo(pbxUrl, apiMode, adminClient, configRow);
    }

    if (action === "probe_endpoints") {
      return await handleProbeEndpoints(pbxUrl, apiMode, adminClient, configRow);
    }

    if (action === "list_extensions") {
      return await handleListExtensions(pbxUrl, apiMode, adminClient, configRow);
    }

    if (action === "create_extension" || action === "update_extension") {
      return await handleManageExtension(action, pbxUrl, apiMode, adminClient, configRow, payload);
    }

    if (action === "delete_extension") {
      return await handleDeleteExtension(pbxUrl, apiMode, adminClient, configRow, payload);
    }

    // --- Endpoint-based routing (raw proxy mode) ---
    if (!endpoint) {
      return jsonError(`Unknown action: ${action || "(none)"}`, 400);
    }

    if (!pbxUrl) {
      return jsonError("PBX URL not configured", 500);
    }

    if (apiMode === "mock") {
      return jsonOk({
        mock: true,
        message: `[MOCK] ${method || "GET"} ${endpoint}`,
        data: {},
      });
    }

    const username = Deno.env.get("YEASTAR_USERNAME");
    const password = Deno.env.get("YEASTAR_PASSWORD");

    if (!username || !password) {
      return jsonError("PBX credentials not configured", 500);
    }

    const accessToken = await getCachedPbxToken(
      adminClient,
      pbxUrl,
      username,
      password,
      configRow
    );

    const targetUrl = `${pbxUrl}${endpoint}`;
    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: {
        "Content-Type": "application/json",
        "Access-token": accessToken,
      },
    };

    if (payload && method !== "GET") {
      fetchOptions.body = JSON.stringify(payload);
    }

    const res = await pbxFetch(targetUrl, fetchOptions);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return jsonError(
        `PBX returned ${res.status}: ${JSON.stringify(data)}`,
        res.status
      );
    }

    return jsonOk(data);
  } catch (err: any) {
    return jsonError(err.message || "Internal error", 500);
  }
});

// ── Action Handlers ──────────────────────────────────────────────────────────

async function handleTestConnection(
  pbxUrl: string | undefined,
  apiMode: string,
  adminClient: any,
  configRow: any
) {
  if (!pbxUrl) {
    return jsonOk({ success: false, message: "PBX URL not configured" });
  }

  if (apiMode === "mock") {
    return jsonOk({ success: true, message: "[MOCK] Connection successful" });
  }

  const username = Deno.env.get("YEASTAR_USERNAME");
  const password = Deno.env.get("YEASTAR_PASSWORD");

  if (!username || !password) {
    return jsonOk({ success: false, message: "PBX credentials not configured" });
  }

  try {
    const token = await getCachedPbxToken(adminClient, pbxUrl, username, password, configRow);
    return jsonOk({ success: true, message: "Connection successful", token_obtained: !!token });
  } catch (e: any) {
    return jsonOk({ success: false, message: e.message });
  }
}

async function handleDiagnoseConnection(pbxUrl: string | undefined, apiMode: string) {
  if (!pbxUrl) {
    return jsonOk({ success: false, reachable: false, message: "PBX URL not configured", timestamp: new Date().toISOString() });
  }

  if (apiMode === "mock") {
    return jsonOk({ success: true, reachable: true, message: "[MOCK] PBX reachable", timestamp: new Date().toISOString() });
  }

  try {
    const res = await pbxFetch(pbxUrl, { method: "GET" });
    return jsonOk({
      success: true,
      reachable: true,
      http_status: res.status,
      message: `PBX responded with HTTP ${res.status}`,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return jsonOk({
      success: false,
      reachable: false,
      message: e.message,
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleGetPbxInfo(
  pbxUrl: string | undefined,
  apiMode: string,
  adminClient: any,
  configRow: any
) {
  if (!pbxUrl) return jsonOk({ success: false, message: "PBX URL not configured" });

  if (apiMode === "mock") {
    return jsonOk({ success: true, mock: true, info: { model: "Mock PBX", firmware: "1.0.0" } });
  }

  const username = Deno.env.get("YEASTAR_USERNAME");
  const password = Deno.env.get("YEASTAR_PASSWORD");
  if (!username || !password) return jsonOk({ success: false, message: "PBX credentials not configured" });

  try {
    const token = await getCachedPbxToken(adminClient, pbxUrl, username, password, configRow);
    const res = await pbxFetch(`${pbxUrl}/api/v2.0.0/system/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-token": token },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    return jsonOk({ success: res.ok, info: data });
  } catch (e: any) {
    return jsonOk({ success: false, message: e.message });
  }
}

async function handleProbeEndpoints(
  pbxUrl: string | undefined,
  apiMode: string,
  adminClient: any,
  configRow: any
) {
  if (!pbxUrl) return jsonOk({ success: false, endpoints: [], summary: { total: 0, available: 0, unavailable: 0 } });

  if (apiMode === "mock") {
    return jsonOk({
      success: true,
      endpoints: [{ endpoint: "/api/v2.0.0/extension/list", status: 200, available: true }],
      summary: { total: 1, available: 1, unavailable: 0 },
      timestamp: new Date().toISOString(),
    });
  }

  const username = Deno.env.get("YEASTAR_USERNAME");
  const password = Deno.env.get("YEASTAR_PASSWORD");
  if (!username || !password) return jsonOk({ success: false, message: "Credentials not configured" });

  const token = await getCachedPbxToken(adminClient, pbxUrl, username, password, configRow);

  const endpointsList = [
    "/api/v2.0.0/extension/list",
    "/api/v2.0.0/extension/query",
    "/api/v2.0.0/system/get",
    "/api/v2.0.0/cdr/get",
  ];

  const results = [];
  for (const ep of endpointsList) {
    try {
      const res = await pbxFetch(`${pbxUrl}${ep}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Access-token": token },
        body: JSON.stringify({}),
      });
      results.push({ endpoint: ep, status: res.status, available: res.status < 500 });
    } catch (e: any) {
      results.push({ endpoint: ep, status: null, available: false, error: e.message });
    }
  }

  const available = results.filter((r) => r.available).length;
  return jsonOk({
    success: true,
    endpoints: results,
    summary: { total: results.length, available, unavailable: results.length - available },
    timestamp: new Date().toISOString(),
  });
}

async function handleListExtensions(
  pbxUrl: string | undefined,
  apiMode: string,
  adminClient: any,
  configRow: any
) {
  if (!pbxUrl) return jsonOk({ success: false, message: "PBX URL not configured" });

  if (apiMode === "mock") {
    return jsonOk({ success: true, mock: true, extensions: [] });
  }

  const username = Deno.env.get("YEASTAR_USERNAME");
  const password = Deno.env.get("YEASTAR_PASSWORD");
  if (!username || !password) return jsonOk({ success: false, message: "Credentials not configured" });

  try {
    const token = await getCachedPbxToken(adminClient, pbxUrl, username, password, configRow);
    const res = await pbxFetch(`${pbxUrl}/api/v2.0.0/extension/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-token": token },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    return jsonOk({ success: res.ok, extensions: data.data || data.extension_list || [], raw: data });
  } catch (e: any) {
    return jsonOk({ success: false, message: e.message });
  }
}

async function handleManageExtension(
  action: string,
  pbxUrl: string | undefined,
  apiMode: string,
  adminClient: any,
  configRow: any,
  payload: any
) {
  if (!pbxUrl) return jsonOk({ success: false, message: "PBX URL not configured" });

  if (apiMode === "mock") {
    return jsonOk({ success: true, mock: true, message: `[MOCK] ${action} completed` });
  }

  const username = Deno.env.get("YEASTAR_USERNAME");
  const password = Deno.env.get("YEASTAR_PASSWORD");
  if (!username || !password) return jsonOk({ success: false, message: "Credentials not configured" });

  const token = await getCachedPbxToken(adminClient, pbxUrl, username, password, configRow);
  const ep = action === "create_extension"
    ? "/api/v2.0.0/extension/create"
    : "/api/v2.0.0/extension/update";

  const res = await pbxFetch(`${pbxUrl}${ep}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-token": token },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => ({}));
  return jsonOk({ success: res.ok, message: res.ok ? `${action} successful` : `Failed: ${res.status}`, data });
}

async function handleDeleteExtension(
  pbxUrl: string | undefined,
  apiMode: string,
  adminClient: any,
  configRow: any,
  payload: any
) {
  if (!pbxUrl) return jsonOk({ success: false, message: "PBX URL not configured" });

  if (apiMode === "mock") {
    return jsonOk({ success: true, mock: true, message: "[MOCK] Extension deleted" });
  }

  const username = Deno.env.get("YEASTAR_USERNAME");
  const password = Deno.env.get("YEASTAR_PASSWORD");
  if (!username || !password) return jsonOk({ success: false, message: "Credentials not configured" });

  const token = await getCachedPbxToken(adminClient, pbxUrl, username, password, configRow);
  const res = await pbxFetch(`${pbxUrl}/api/v2.0.0/extension/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-token": token },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => ({}));
  return jsonOk({ success: res.ok, message: res.ok ? "Extension deleted" : `Failed: ${res.status}`, data });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function probeApiVersions(pbxUrl: string) {
  const endpoints = [
    { version: "v2.0.0", path: "/api/v2.0.0/login" },
    { version: "v1.0 (OpenAPI)", path: "/openapi/v1.0/get_token" },
  ];

  const results: Record<string, string> = {};

  for (const ep of endpoints) {
    try {
      const res = await pbxFetch(`${pbxUrl}${ep.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      results[ep.version] = `HTTP ${res.status}`;
    } catch (e: any) {
      results[ep.version] = `Error: ${e.message}`;
    }
  }

  return results;
}

async function getCachedPbxToken(
  adminClient: any,
  url: string,
  username: string,
  password: string,
  configRow: any
): Promise<string> {
  const now = new Date();
  const bufferMs = 60_000;

  if (configRow?.oauth_token && configRow?.oauth_token_expires_at) {
    const expiresAt = new Date(configRow.oauth_token_expires_at);
    if (expiresAt.getTime() - bufferMs > now.getTime()) {
      return configRow.oauth_token;
    }
  }

  const res = await pbxFetch(`${url}/api/v2.0.0/login`, {
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

  const expiresInSeconds = data.expires_in || 1800;
  const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);

  await adminClient
    .from("telefonia_config")
    .update({
      oauth_token: data.token,
      oauth_token_expires_at: expiresAt.toISOString(),
    })
    .not("id", "is", null);

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
