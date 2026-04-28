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
    const token = await client.getValidToken();
    const baseUrl = Deno.env.get("SICAS_REST_API_URL") || "https://security-services.sicasonline.info/api";

    const results: Record<string, unknown> = {};

    // Helper: extract IDDocto values from XML
    const extractIDs = (xml: string): string[] => {
      const ids: string[] = [];
      const regex = /<IDDocto>(\d+)<\/IDDocto>/g;
      let m;
      while ((m = regex.exec(xml)) !== null) ids.push(m[1]);
      return ids;
    };

    // Helper: extract control block from XML
    const extractControl = (xml: string): Record<string, string> => {
      const control: Record<string, string> = {};
      const controlMatch = xml.match(/<Table_WS_Documentos_Control>([\s\S]*?)<\/Table_WS_Documentos_Control>/);
      if (controlMatch) {
        const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
        let fm;
        while ((fm = fieldRegex.exec(controlMatch[1])) !== null) {
          control[fm[1]] = fm[2].trim();
        }
      }
      return control;
    };

    // Test pages 1, 2, and 5 with raw API calls to compare IDDocto values
    for (const pageNum of [1, 2, 5]) {
      try {
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
            ItemsForPage: 10,
            FormatResponse: 2,
            SortFields: "IDDocto",
          }),
        });

        const rawText = await resp.text();
        let parsed: any = null;
        try { parsed = JSON.parse(rawText); } catch { /* ignore */ }

        if (parsed && typeof parsed.Response === "string") {
          const xml = parsed.Response;
          const ids = extractIDs(xml);
          const control = extractControl(xml);

          results[`page_${pageNum}`] = {
            format: "XML",
            recordCount: ids.length,
            ids: ids,
            control,
            success: parsed.Sucess,
          };
        } else if (parsed && Array.isArray(parsed.Response)) {
          const tableInfo = parsed.Response[0]?.TableInfo || [];
          const ids = tableInfo.map((r: any) => r.IDDocto).filter(Boolean);

          results[`page_${pageNum}`] = {
            format: "JSON_ARRAY",
            recordCount: ids.length,
            ids: ids,
          };
        } else {
          results[`page_${pageNum}`] = {
            format: "unknown",
            raw: String(rawText).substring(0, 500),
          };
        }
      } catch (e: unknown) {
        results[`page_${pageNum}`] = { error: String(e) };
      }
    }

    // Test with readReport client (normalized) to see what Page comes back
    for (const pageNum of [1, 2, 3]) {
      try {
        const normalized = await client.readReport({
          keyCode: "HWS_DOCTOS",
          pageRequested: pageNum,
          itemsForPage: 5,
          sortFields: "IDDocto",
        });

        const records = normalized.Response?.[0]?.TableInfo || [];
        const control = normalized.Response?.[1]?.TableControl?.[0]
          || normalized.Response?.[0]?.TableControl?.[0];

        const ids = records.map((r: any) => r.IDDocto || r.Id_Docto || "?");

        results[`normalized_page_${pageNum}`] = {
          recordCount: records.length,
          ids,
          control: control || "NO_CONTROL",
        };
      } catch (e: unknown) {
        results[`normalized_page_${pageNum}`] = { error: String(e) };
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: String(error), stack: (error as Error).stack }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
