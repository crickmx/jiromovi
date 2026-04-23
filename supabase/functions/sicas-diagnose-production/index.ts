import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SicasRestClient } from "../_shared/sicasRestClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function parseXmlAllRows(xmlString: string): Record<string, string>[] {
  const records: Record<string, string>[] = [];
  const rowRegex = /<(Table_WS_\w+)>([\s\S]*?)<\/\1>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(xmlString)) !== null) {
    const rowXml = rowMatch[2];
    const record: Record<string, string> = {};
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(rowXml)) !== null) {
      record[fieldMatch[1]] = fieldMatch[2].trim();
    }
    records.push(record);
  }
  return records;
}

function parseXmlPagination(xmlString: string): { maxRecords: number; pages: number; page: number } | null {
  const match = xmlString.match(/<Table_Paginacion>([\s\S]*?)<\/Table_Paginacion>/);
  if (!match) return null;
  const xml = match[1];
  const getVal = (tag: string): number => {
    const m = xml.match(new RegExp(`<${tag}>(\\d+)</${tag}>`));
    return m ? parseInt(m[1], 10) : 0;
  };
  return {
    maxRecords: getVal("MaxRecords") || getVal("TotalRegistros"),
    pages: getVal("Pages") || getVal("TotalPaginas"),
    page: getVal("Page") || getVal("PaginaActual"),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "format-compare";

    const client = new SicasRestClient();
    const token = await client.getValidToken();
    const baseUrl = Deno.env.get("SICAS_REST_API_URL") || "https://security-services.sicasonline.info/api";
    const results: Record<string, unknown> = { mode };

    if (mode === "format-compare") {
      // Test FormatResponse=0 (XML native) vs FormatResponse=2 (JSON)
      // Also test with different ItemsForPage values

      for (const format of [0, 2]) {
        for (const itemsPerPage of [50, 100, 200, 500, 1000]) {
          const key = `format_${format}_items_${itemsPerPage}`;
          try {
            const resp = await fetch(`${baseUrl}/Report/ReadData`, {
              method: "POST",
              headers: {
                Authorization: token,
                "Content-Type": "application/json",
                Prop_KeyCode: "HWS_DOCTOS",
              },
              body: JSON.stringify({
                PageRequested: 1,
                ItemsForPage: itemsPerPage,
                FormatResponse: format,
              }),
            });
            const rawText = await resp.text();

            if (format === 0) {
              // Pure XML response
              const records = parseXmlAllRows(rawText);
              const pagination = parseXmlPagination(rawText);
              const ids = new Set(records.map(r => r.IDDocto || r.Id_Docto || ""));
              (results as any)[key] = {
                format: "XML(0)",
                rawLength: rawText.length,
                recordsParsed: records.length,
                uniqueIds: ids.size,
                pagination,
                sampleFields: records[0] ? Object.keys(records[0]).slice(0, 10) : [],
              };
            } else {
              // JSON response - may be wrapped
              let parsed: any;
              try { parsed = JSON.parse(rawText); } catch { parsed = null; }
              if (parsed) {
                const responseField = parsed.Response;
                if (typeof responseField === "string" && responseField.includes("<")) {
                  const records = parseXmlAllRows(responseField);
                  const pagination = parseXmlPagination(responseField);
                  const ids = new Set(records.map(r => r.IDDocto || r.Id_Docto || ""));
                  (results as any)[key] = {
                    format: "JSON(2)->XML_STRING",
                    xmlLength: responseField.length,
                    recordsParsed: records.length,
                    uniqueIds: ids.size,
                    pagination,
                  };
                } else if (Array.isArray(responseField)) {
                  const recs = responseField[0]?.TableInfo || [];
                  const ctrl = responseField[0]?.TableControl?.[0];
                  const ids = new Set(recs.map((r: any) => r.IDDocto || r.Id_Docto || ""));
                  (results as any)[key] = {
                    format: "JSON(2)->ARRAY",
                    records: recs.length,
                    uniqueIds: ids.size,
                    maxRecords: ctrl?.MaxRecords,
                    pages: ctrl?.Pages,
                  };
                } else {
                  (results as any)[key] = {
                    format: "JSON(2)->OTHER",
                    type: typeof responseField,
                    preview: String(responseField).substring(0, 200),
                  };
                }
              } else {
                (results as any)[key] = { format: "UNPARSEABLE", preview: rawText.substring(0, 200) };
              }
            }
          } catch (e: unknown) {
            (results as any)[key] = { error: String(e) };
          }
        }
      }

    } else if (mode === "xml-paginated") {
      // Test XML format with actual pagination across pages
      const itemsPerPage = body.itemsPerPage || 50;
      const maxPagesToTest = body.maxPages || 3;
      const condition = body.condition || "";

      const allIds = new Set<string>();
      const pageResults: Array<{ page: number; fetched: number; newIds: number; totalUnique: number; pagination: any }> = [];

      for (let p = 1; p <= maxPagesToTest; p++) {
        try {
          const reqBody: any = {
            PageRequested: p,
            ItemsForPage: itemsPerPage,
            FormatResponse: 0,
          };
          if (condition) reqBody.ConditionsDirect = condition;

          const resp = await fetch(`${baseUrl}/Report/ReadData`, {
            method: "POST",
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
              Prop_KeyCode: "HWS_DOCTOS",
            },
            body: JSON.stringify(reqBody),
          });
          const rawText = await resp.text();
          const records = parseXmlAllRows(rawText);
          const pagination = parseXmlPagination(rawText);

          const prevSize = allIds.size;
          for (const rec of records) {
            const id = rec.IDDocto || rec.Id_Docto || "";
            if (id) allIds.add(id);
          }

          pageResults.push({
            page: p,
            fetched: records.length,
            newIds: allIds.size - prevSize,
            totalUnique: allIds.size,
            pagination,
          });

          if (records.length === 0) break;
          if (pagination && p >= pagination.pages) break;
        } catch (e: unknown) {
          pageResults.push({ page: p, fetched: 0, newIds: 0, totalUnique: allIds.size, pagination: null });
          break;
        }
      }

      results.itemsPerPage = itemsPerPage;
      results.condition = condition || "none";
      results.pages = pageResults;
      results.totalUniqueIds = allIds.size;
    }

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: String(error), stack: (error as Error).stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
