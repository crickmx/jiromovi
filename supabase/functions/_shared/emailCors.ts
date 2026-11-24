const DEFAULT_ALLOWED_ORIGINS = [
  "https://app.movi.digital",
  "https://beta.movi.digital",
];

export function emailCorsHeaders(req: Request): Record<string, string> | null {
  const configured = (Deno.env.get("MOVI_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowed = new Set(configured.length ? configured : DEFAULT_ALLOWED_ORIGINS);
  const origin = req.headers.get("Origin");

  if (origin && !allowed.has(origin)) return null;

  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Max-Age": "600",
  };
}

export function forbiddenOriginResponse(): Response {
  return new Response(JSON.stringify({ error: "ORIGIN_NOT_ALLOWED" }), {
    status: 403,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
