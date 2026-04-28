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

    // Test 1: Raw API call with 100 items, FormatResponse=2 (JSON) - see exactly what comes back
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
          ItemsForPage: 100,
          FormatResponse: 2,
          SortFields: "Documento",
        }),
      });

      const rawText = await resp.text();
      let parsed: any = null;
      try { parsed = JSON.parse(rawText); } catch { /* ignore */ }

      if (parsed) {
        const responseField = parsed.Response;
        const responseType = typeof responseField;

        if (responseType === "string" && responseField.includes("<")) {
          const xml = responseField as string;
          const rowPatternMatch = xml.match(/<(Table_\w+)>/);
          const rowTag = rowPatternMatch?.[1] || "UNKNOWN";
          const rowCount = (xml.match(new RegExp(`<${rowTag}>`, "g")) || []).length;

          const tableTagCounts: Record<string, number> = {};
          const tagRegex = /<(Table_\w+)>/g;
          let tm;
          while ((tm = tagRegex.exec(xml)) !== null) {
            tableTagCounts[tm[1]] = (tableTagCounts[tm[1]] || 0) + 1;
          }

          results.test1_page1 = {
            format: "XML_STRING",
            xmlLength: xml.length,
            hasPaginacion: xml.includes("Table_Paginacion"),
            hasMaxRecords: xml.includes("MaxRecords"),
            rowTag,
            rowCount,
            tableTagCounts,
            xmlStart: xml.substring(0, 1500),
            xmlEnd: xml.substring(xml.length - 1500),
            success: parsed.Sucess,
            error: parsed.Error,
          };
        } else if (Array.isArray(responseField)) {
          // JSON array response
          const tableInfo = responseField[0]?.TableInfo || [];
          const tableControl = responseField[0]?.TableControl;
          const tableControlR1 = responseField[1]?.TableControl;

          // Check the LAST record to see if it's pagination
          const lastRecord = tableInfo[tableInfo.length - 1];
          const firstRecord = tableInfo[0];

          // Check all records for ones without IDDocto
          const withoutIDDocto = tableInfo.filter((r: any) => r.IDDocto === undefined && r.Documento === undefined);
          const withIDDocto = tableInfo.filter((r: any) => r.IDDocto !== undefined || r.Documento !== undefined);

          results.test1_page1 = {
            format: "JSON_ARRAY",
            responseArrayLength: responseField.length,
            totalRecordsInTableInfo: tableInfo.length,
            recordsWithIDDocto: withIDDocto.length,
            recordsWithoutIDDocto: withoutIDDocto.length,
            paginationRecords: withoutIDDocto,
            tableControlFromR0: tableControl || null,
            tableControlFromR1: tableControlR1 || null,
            firstRecordKeys: firstRecord ? Object.keys(firstRecord) : [],
            lastRecordKeys: lastRecord ? Object.keys(lastRecord) : [],
            lastRecord: lastRecord,
            firstRecordSample: firstRecord ? { IDDocto: firstRecord.IDDocto, Documento: firstRecord.Documento, VendId: firstRecord.VendId } : null,
            success: parsed.Sucess,
            error: parsed.Error,
          };
        } else {
          results.test1_page1 = {
            format: responseType,
            preview: String(responseField).substring(0, 500),
          };
        }
      } else {
        results.test1_page1 = {
          error: "Could not parse JSON",
          rawPreview: rawText.substring(0, 500),
        };
      }
    } catch (e: unknown) {
      results.test1_page1 = { error: String(e) };
    }

    // Test 2: Same but page 2 - does it return data?
    try {
      const token2 = await client.getValidToken();
      const resp = await fetch(`${baseUrl}/Report/ReadData`, {
        method: "POST",
        headers: {
          Authorization: token2,
          "Content-Type": "application/json",
          Prop_KeyCode: "HWS_DOCTOS",
        },
        body: JSON.stringify({
          PageRequested: 2,
          ItemsForPage: 100,
          FormatResponse: 2,
          SortFields: "Documento",
        }),
      });

      const rawText = await resp.text();
      let parsed: any = null;
      try { parsed = JSON.parse(rawText); } catch { /* ignore */ }

      if (parsed) {
        const responseField = parsed.Response;
        if (typeof responseField === "string") {
          results.test2_page2 = {
            format: "XML_STRING",
            xmlLength: responseField.length,
          };
        } else if (Array.isArray(responseField)) {
          const tableInfo = responseField[0]?.TableInfo || [];
          const withoutIDDocto = tableInfo.filter((r: any) => r.IDDocto === undefined && r.Documento === undefined);
          const withIDDocto = tableInfo.filter((r: any) => r.IDDocto !== undefined || r.Documento !== undefined);
          results.test2_page2 = {
            format: "JSON_ARRAY",
            totalRecordsInTableInfo: tableInfo.length,
            recordsWithIDDocto: withIDDocto.length,
            recordsWithoutIDDocto: withoutIDDocto.length,
            paginationRecords: withoutIDDocto,
          };
        }
      }
    } catch (e: unknown) {
      results.test2_page2 = { error: String(e) };
    }

    // Test 3: Use the readReport method from our client to see what it normalizes
    try {
      const normalized = await client.readReport({
        keyCode: "HWS_DOCTOS",
        pageRequested: 1,
        itemsForPage: 100,
        sortFields: "Documento",
      });

      const records = normalized.Response?.[0]?.TableInfo || [];
      const control = normalized.Response?.[1]?.TableControl?.[0]
        || normalized.Response?.[0]?.TableControl?.[0];

      results.test3_normalized = {
        recordCount: records.length,
        control: control || "NO_CONTROL_FOUND",
        firstRecordKeys: records[0] ? Object.keys(records[0]).slice(0, 10) : [],
      };
    } catch (e: unknown) {
      results.test3_normalized = { error: String(e) };
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
