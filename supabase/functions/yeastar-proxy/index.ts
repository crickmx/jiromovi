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

    if (!pbxUrl) {
      return jsonError("PBX URL not configured", 500);
    }

    const body = await req.json();
    const { action, endpoint, method, payload } = body;

    if (action === "probe_api_versions") {
      const results = await probeApiVersions(pbxUrl);
      return jsonOk({ results });
    }

    if (!endpoint) {
      return jsonError("Missing endpoint", 400);
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
