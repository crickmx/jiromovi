import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createSicasRestClientWithDbAuth } from "../_shared/sicasRestClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function parseXmlRecords(xmlString: string): Record<string, string>[] {
  const records: Record<string, string>[] = [];
  const rowRegex = /<Table_WS_Documentos>([\s\S]*?)<\/Table_WS_Documentos>/g;
  let match;
  while ((match = rowRegex.exec(xmlString)) !== null) {
    const rowXml = match[1];
    const record: Record<string, string> = {};
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(rowXml)) !== null) {
      record[fieldMatch[1]] = fieldMatch[2].trim();
    }
    // Also capture self-closing empty tags
    const emptyRegex = /<(\w+)\s*\/>/g;
    let emptyMatch;
    while ((emptyMatch = emptyRegex.exec(rowXml)) !== null) {
      if (!record[emptyMatch[1]]) {
        record[emptyMatch[1]] = "";
      }
    }
    records.push(record);
  }
  return records;
}

function parseXmlControl(xmlString: string): { maxRecords: number; pages: number; page: number } | null {
  const controlMatch = xmlString.match(/<Table_Paginacion>([\s\S]*?)<\/Table_Paginacion>/);
  if (!controlMatch) return null;
  const xml = controlMatch[1];
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
    const vendorId = body.vendorId || "37";

    const client = await createSicasRestClientWithDbAuth();
    const token = await client.getValidToken();
    const baseUrl = Deno.env.get("SICAS_REST_API_URL") || "https://security-services.sicasonline.info/api";

    const results: Record<string, unknown> = { vendorId, baseUrl };

    // Test A: HWS_DOCTOS with vendor filter - parse XML response
    try {
      const url = `${baseUrl}/Report/ReadData`;
      const rawBody = {
        PageRequested: 1,
        ItemsForPage: 5,
        FormatResponse: 2,
        ConditionsDirect: `DatDocumentos.VendId IN (${vendorId})`,
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Prop_KeyCode: "HWS_DOCTOS",
        },
        body: JSON.stringify(rawBody),
      });

      const rawText = await resp.text();
      let parsed: any = null;
      try { parsed = JSON.parse(rawText); } catch { /* ignore */ }

      if (parsed) {
        const responseField = parsed.Response;
        const responseType = typeof responseField;

        if (responseType === "string") {
          // XML response - parse it
          const records = parseXmlRecords(responseField);
          const control = parseXmlControl(responseField);
          results.testA_HWS_DOCTOS_vendor = {
            responseType: "XML_STRING",
            xmlLength: responseField.length,
            parsedRecords: records.length,
            control,
            fieldNames: records[0] ? Object.keys(records[0]) : [],
            sample: records.slice(0, 2),
            success: parsed.Sucess,
            error: parsed.Error,
          };
        } else if (Array.isArray(responseField)) {
          // JSON array response
          const recs = responseField[0]?.TableInfo || [];
          const ctrl = responseField[0]?.TableControl?.[0];
          results.testA_HWS_DOCTOS_vendor = {
            responseType: "JSON_ARRAY",
            records: recs.length,
            maxRecords: ctrl?.MaxRecords || 0,
            fieldNames: recs[0] ? Object.keys(recs[0]) : [],
            sample: recs.slice(0, 2),
          };
        } else {
          results.testA_HWS_DOCTOS_vendor = {
            responseType: responseType,
            preview: String(responseField).substring(0, 300),
          };
        }
      } else {
        results.testA_HWS_DOCTOS_vendor = {
          error: "Could not parse JSON",
          rawPreview: rawText.substring(0, 500),
        };
      }
    } catch (e: unknown) {
      results.testA_HWS_DOCTOS_vendor = { error: String(e) };
    }

    // Test B: HWSDOC with vendor filter - parse XML response
    try {
      const url = `${baseUrl}/Report/ReadData`;
      const rawBody = {
        PageRequested: 1,
        ItemsForPage: 5,
        FormatResponse: 2,
        ConditionsDirect: `DatDocumentos.VendId IN (${vendorId})`,
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Prop_KeyCode: "HWSDOC",
        },
        body: JSON.stringify(rawBody),
      });

      const rawText = await resp.text();
      let parsed: any = null;
      try { parsed = JSON.parse(rawText); } catch { /* ignore */ }

      if (parsed) {
        const responseField = parsed.Response;
        if (typeof responseField === "string") {
          const records = parseXmlRecords(responseField);
          const control = parseXmlControl(responseField);
          results.testB_HWSDOC_vendor = {
            responseType: "XML_STRING",
            xmlLength: responseField.length,
            parsedRecords: records.length,
            control,
            fieldNames: records[0] ? Object.keys(records[0]) : [],
            sample: records.slice(0, 2),
          };
        } else if (Array.isArray(responseField)) {
          const recs = responseField[0]?.TableInfo || [];
          results.testB_HWSDOC_vendor = {
            responseType: "JSON_ARRAY",
            records: recs.length,
            fieldNames: recs[0] ? Object.keys(recs[0]) : [],
          };
        }
      }
    } catch (e: unknown) {
      results.testB_HWSDOC_vendor = { error: String(e) };
    }

    // Test C: HWS_DOCTOS no vendor filter (just to confirm data exists)
    try {
      const url = `${baseUrl}/Report/ReadData`;
      const rawBody = {
        PageRequested: 1,
        ItemsForPage: 3,
        FormatResponse: 2,
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Prop_KeyCode: "HWS_DOCTOS",
        },
        body: JSON.stringify(rawBody),
      });

      const rawText = await resp.text();
      let parsed: any = null;
      try { parsed = JSON.parse(rawText); } catch { /* ignore */ }

      if (parsed) {
        const responseField = parsed.Response;
        if (typeof responseField === "string") {
          const records = parseXmlRecords(responseField);
          const control = parseXmlControl(responseField);
          results.testC_HWS_DOCTOS_no_filter = {
            responseType: "XML_STRING",
            parsedRecords: records.length,
            control,
            fieldNames: records[0] ? Object.keys(records[0]) : [],
            vendorIdField: records[0]?.VendId || records[0]?.IDVend || "NOT_FOUND",
            sample: records[0] || null,
          };
        }
      }
    } catch (e: unknown) {
      results.testC_HWS_DOCTOS_no_filter = { error: String(e) };
    }

    // Test D: Try FormatResponse=0 (XML) to see if that changes anything
    try {
      const url = `${baseUrl}/Report/ReadData`;
      const rawBody = {
        PageRequested: 1,
        ItemsForPage: 3,
        FormatResponse: 0,
        ConditionsDirect: `DatDocumentos.VendId IN (${vendorId})`,
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Prop_KeyCode: "HWS_DOCTOS",
        },
        body: JSON.stringify(rawBody),
      });

      const rawText = await resp.text();
      results.testD_FormatResponse_0 = {
        status: resp.status,
        bodyLength: rawText.length,
        bodyPreview: rawText.substring(0, 300),
        isXml: rawText.trim().startsWith("<") || rawText.includes("<DATAINFO"),
      };
    } catch (e: unknown) {
      results.testD_FormatResponse_0 = { error: String(e) };
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
