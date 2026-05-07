import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SearchRequest {
  query: string;
  search_by?: "nombre" | "rfc" | "auto";
  limit?: number;
}

interface ClientResult {
  id_sicas: string;
  nombre: string;
  rfc?: string;
  raw?: Record<string, any>;
}

function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SearchRequest = await req.json();
    const { query, search_by = "auto", limit = 20 } = body;

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: "Query must be at least 2 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trimmedQuery = query.trim();
    const normalizedQuery = normalizeText(trimmedQuery);
    const results: ClientResult[] = [];

    // Determine search strategy
    const isRfcLike = /^[A-Z]{3,4}[0-9]{6}/.test(trimmedQuery.toUpperCase());
    const effectiveSearchBy = search_by === "auto"
      ? (isRfcLike ? "rfc" : "nombre")
      : search_by;

    if (effectiveSearchBy === "rfc") {
      // Search by RFC in raw JSONB field
      const { data, error } = await supabase
        .from("sicas_catalogos")
        .select("id_sicas, nombre, raw")
        .eq("catalog_type_id", 17)
        .ilike("raw->>RFC", `%${trimmedQuery}%`)
        .limit(limit);

      if (!error && data) {
        for (const row of data) {
          results.push({
            id_sicas: row.id_sicas,
            nombre: row.nombre,
            rfc: row.raw?.RFC || row.raw?.rfc || undefined,
            raw: row.raw,
          });
        }
      }
    } else {
      // Search by nombre using ilike for partial match
      const { data, error } = await supabase
        .from("sicas_catalogos")
        .select("id_sicas, nombre, raw")
        .eq("catalog_type_id", 17)
        .ilike("nombre", `%${trimmedQuery}%`)
        .limit(limit);

      if (!error && data) {
        for (const row of data) {
          results.push({
            id_sicas: row.id_sicas,
            nombre: row.nombre,
            rfc: row.raw?.RFC || row.raw?.rfc || undefined,
            raw: row.raw,
          });
        }
      }

      // If no results by ilike, try normalized comparison on all records (more expensive)
      if (results.length === 0 && normalizedQuery.length >= 3) {
        const { data: allContacts } = await supabase
          .from("sicas_catalogos")
          .select("id_sicas, nombre, raw")
          .eq("catalog_type_id", 17)
          .limit(500);

        if (allContacts) {
          const matches = allContacts.filter((r: any) => {
            const normalizedNombre = normalizeText(r.nombre);
            return normalizedNombre.includes(normalizedQuery) || normalizedQuery.includes(normalizedNombre);
          });

          for (const row of matches.slice(0, limit)) {
            results.push({
              id_sicas: row.id_sicas,
              nombre: row.nombre,
              rfc: row.raw?.RFC || row.raw?.rfc || undefined,
              raw: row.raw,
            });
          }
        }
      }
    }

    // Sort results: exact matches first, then partial
    results.sort((a, b) => {
      const aNorm = normalizeText(a.nombre);
      const bNorm = normalizeText(b.nombre);
      const aExact = aNorm === normalizedQuery ? 0 : 1;
      const bExact = bNorm === normalizedQuery ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aStarts = aNorm.startsWith(normalizedQuery) ? 0 : 1;
      const bStarts = bNorm.startsWith(normalizedQuery) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.nombre.localeCompare(b.nombre);
    });

    return new Response(
      JSON.stringify({
        success: true,
        search_by: effectiveSearchBy,
        query: trimmedQuery,
        total: results.length,
        results: results.slice(0, limit),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sicas-search-client] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
