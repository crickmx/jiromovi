import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createSicasRestClientWithDbAuth } from "../_shared/sicasRestClient.ts";

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
    const client = await createSicasRestClientWithDbAuth();
    const baseUrl =
      Deno.env.get("SICAS_REST_API_URL") ||
      "https://security-services.sicasonline.info/api";

    const allIds = new Set<string>();
    const pageResults: Record<string, any> = {};

    // Test specific pages: 1, 2, 3, 10, 50, 100, 500, 1000, 2000, 3992
    for (const pageNum of [1, 2, 3, 10, 50, 100, 500, 1000, 2000, 3992]) {
      const tkn = await client.getValidToken();
      const resp = await fetch(`${baseUrl}/Report/ReadData`, {
        method: "POST",
        headers: {
          Authorization: tkn,
          "Content-Type": "application/json",
          Prop_KeyCode: "HWS_DOCTOS",
        },
        body: JSON.stringify({
          PageRequested: pageNum,
          ItemsForPage: 100,
          FormatResponse: 0,
          SortFields: "IDDocto",
        }),
      });

      const rawText = await resp.text();
      let parsed: any = null;
      try { parsed = JSON.parse(rawText); } catch { /* */ }

      if (parsed && typeof parsed.Response === "string") {
        const xml: string = parsed.Response;
        const idRegex = /<IDDocto>(\d+)<\/IDDocto>/g;
        const ids: string[] = [];
        let m;
        while ((m = idRegex.exec(xml)) !== null) ids.push(m[1]);

        const before = allIds.size;
        ids.forEach(id => allIds.add(id));

        pageResults[`page_${pageNum}`] = {
          returned: ids.length,
          newIds: allIds.size - before,
          cumulativeUnique: allIds.size,
          first3: ids.slice(0, 3),
          last3: ids.slice(-3),
        };
      } else {
        pageResults[`page_${pageNum}`] = {
          error: "unexpected format",
          raw: String(rawText).substring(0, 200),
        };
      }
    }

    return new Response(JSON.stringify({
      totalUniqueAcrossAllPages: allIds.size,
      pages: pageResults,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
