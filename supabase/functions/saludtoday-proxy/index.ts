import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, Idempotency-Key",
};

const SALUD_TODAY_BASE = "https://salud.today/api/public/v1";

// Este proxy NO es un relay abierto: sólo reenvía las rutas que usa el módulo de
// MOVI. Si el módulo necesita otra, hay que agregarla aquí a propósito.
const RUTAS_PERMITIDAS = /^(planes|membresias|ventas)(\/[A-Za-z0-9_-]+)?$/;

const responder = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const error = (code: string, message: string, status: number) =>
  responder({ ok: false, error: { code, message } }, status);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // El token de salud.today vive en el secreto SALUD_TODAY_TOKEN (nunca en el
  // frontend ni en el repo): esta función es lo único que lo usa.
  const saludTodayToken = Deno.env.get("SALUD_TODAY_TOKEN");
  if (!saludTodayToken) {
    return error(
      "configuracion",
      "Falta configurar el secreto SALUD_TODAY_TOKEN en Supabase.",
      500,
    );
  }

  try {
    // ── 1. Exigir una sesión de MOVI válida antes de gastar el token ────────
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!jwt) {
      return error("no_autorizado", "Falta la sesión de MOVI.", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
    });
    if (!userRes.ok) {
      return error(
        "no_autorizado",
        "La sesión de MOVI no es válida o ya expiró.",
        401,
      );
    }
    const user = await userRes.json();
    if (!user?.id) {
      return error("no_autorizado", "La sesión de MOVI no es válida.", 401);
    }

    // ── 2. Sólo las rutas y métodos que el módulo usa ───────────────────────
    const url = new URL(req.url);
    const path = (url.searchParams.get("path") || "planes").replace(/^\//, "");
    if (!RUTAS_PERMITIDAS.test(path)) {
      return error(
        "ruta_no_permitida",
        `La ruta "${path}" no está permitida en el proxy de salud.today.`,
        400,
      );
    }

    const method = req.method.toUpperCase();
    if (method !== "GET" && method !== "POST") {
      return error("metodo_no_permitido", `Método ${method} no permitido.`, 405);
    }
    if (method === "POST" && !path.startsWith("ventas")) {
      return error(
        "metodo_no_permitido",
        "Sólo la emisión de ventas admite POST.",
        405,
      );
    }

    // ── 3. Reenviar a salud.today ───────────────────────────────────────────
    const headers: Record<string, string> = {
      Authorization: `Bearer ${saludTodayToken}`,
      "Content-Type": "application/json",
    };
    const idempotencyKey = req.headers.get("Idempotency-Key") ||
      req.headers.get("idempotency-key");
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const body = method === "POST" ? await req.text() : undefined;

    const response = await fetch(`${SALUD_TODAY_BASE}/${path}`, {
      method,
      headers,
      body,
    });

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return error(
      "proxy_error",
      `Error al comunicar con salud.today: ${message}`,
      502,
    );
  }
});
