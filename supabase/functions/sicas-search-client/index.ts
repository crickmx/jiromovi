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
  delivery_id?: string;
}

interface ClientResult {
  id_sicas: string;
  nombre: string;
  rfc?: string;
  raw?: Record<string, any>;
  source: "local" | "sicas_soap";
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

    const sicasUsername = Deno.env.get("SICAS_USERNAME") || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || "";
    const sicasEndpoint = Deno.env.get("SICAS_SOAP_ENDPOINT") || Deno.env.get("SICAS_ENDPOINT") || "";

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

    // === Search locally first ===
    if (effectiveSearchBy === "rfc") {
      const { data } = await supabase
        .from("sicas_catalogos")
        .select("id_sicas, nombre, raw")
        .eq("catalog_type_id", 17)
        .ilike("raw->>RFC", `%${trimmedQuery}%`)
        .limit(limit);

      if (data) {
        for (const row of data) {
          results.push({
            id_sicas: row.id_sicas,
            nombre: row.nombre,
            rfc: row.raw?.RFC || row.raw?.rfc || undefined,
            raw: row.raw,
            source: "local",
          });
        }
      }
    } else {
      const { data } = await supabase
        .from("sicas_catalogos")
        .select("id_sicas, nombre, raw")
        .eq("catalog_type_id", 17)
        .ilike("nombre", `%${trimmedQuery}%`)
        .limit(limit);

      if (data) {
        for (const row of data) {
          results.push({
            id_sicas: row.id_sicas,
            nombre: row.nombre,
            rfc: row.raw?.RFC || row.raw?.rfc || undefined,
            raw: row.raw,
            source: "local",
          });
        }
      }

      // Normalized fallback search
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
              source: "local",
            });
          }
        }
      }
    }

    // === If no local results and SICAS endpoint is configured, search via SOAP ===
    if (results.length === 0 && sicasUsername && sicasPassword && sicasEndpoint) {
      console.log(`[sicas-search-client] No local results. Searching SICAS SOAP for "${trimmedQuery}"...`);

      try {
        const soapResults = await searchClientViaSoap(
          trimmedQuery,
          effectiveSearchBy,
          sicasEndpoint,
          sicasUsername,
          sicasPassword,
          limit
        );

        for (const r of soapResults) {
          results.push({ ...r, source: "sicas_soap" });
        }
      } catch (soapError: any) {
        console.error(`[sicas-search-client] SOAP search failed:`, soapError.message);
        // Don't fail the entire request - just return empty
      }
    }

    // Sort: exact matches first, then partial
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

async function searchClientViaSoap(
  query: string,
  searchBy: string,
  endpoint: string,
  username: string,
  password: string,
  limit: number
): Promise<Array<{ id_sicas: string; nombre: string; rfc?: string }>> {
  // Use ReadInfoData with eContactos or a search-compatible method
  const searchField = searchBy === "rfc" ? "RFC" : "Nombre";

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:ReadInfoData>
      <tem:oConfigData>
        <tem:PropertyTypeReadData>eContactos</tem:PropertyTypeReadData>
        <tem:PropertyData_TypeDataReturn>Data_XML</tem:PropertyData_TypeDataReturn>
        <tem:PropertyFilter>${searchField}|${query}</tem:PropertyFilter>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${username}</tem:UserName>
        <tem:Password>${password}</tem:Password>
      </tem:oConfigAuth>
    </tem:ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/ReadInfoData",
      },
      body: soapEnvelope,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const responseText = await response.text();
    const decoded = responseText
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    // Parse contacts from response
    const results: Array<{ id_sicas: string; nombre: string; rfc?: string }> = [];
    const recordRegex = /<Table_\w+>([\s\S]*?)<\/Table_\w+>/g;
    let match;

    while ((match = recordRegex.exec(decoded)) !== null) {
      const recordXml = match[1];
      const idMatch = recordXml.match(/<IDContacto>(\d+)<\/IDContacto>/i) ||
                      recordXml.match(/<IDCli>(\d+)<\/IDCli>/i);
      const nameMatch = recordXml.match(/<(?:CliNombre|Nombre|ContactoNombre)>(.*?)<\/(?:CliNombre|Nombre|ContactoNombre)>/i);
      const rfcMatch = recordXml.match(/<(?:CliRFC|RFC)>(.*?)<\/(?:CliRFC|RFC)>/i);

      if (idMatch && nameMatch) {
        results.push({
          id_sicas: idMatch[1],
          nombre: nameMatch[1].trim(),
          rfc: rfcMatch?.[1]?.trim() || undefined,
        });
      }

      if (results.length >= limit) break;
    }

    console.log(`[sicas-search-client] SOAP returned ${results.length} contacts`);
    return results;
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}
