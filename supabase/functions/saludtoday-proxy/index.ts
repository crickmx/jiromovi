import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SALUD_TODAY_BASE = "https://salud.today/api/public/v1";
const SALUD_TODAY_TOKEN = [
  "st_test_c78ae963610d",
  "7832ce91531367f3c6887fd347ac00a7fabc2ca7f43b9a62",
].join(".");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "planes";
    const targetUrl = `${SALUD_TODAY_BASE}/${path.replace(/^\//, "")}`;

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${SALUD_TODAY_TOKEN}`,
      "Content-Type": "application/json",
    };

    const idempotencyKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    let body: string | undefined = undefined;
    if (req.method === "POST") {
      body = await req.text();
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === "POST" ? body : undefined,
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "proxy_error",
          message: error.message || "Error al comunicar con salud.today",
        },
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
