import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createSicasRestClientWithDbAuth } from "../_shared/sicasRestClient.ts";
import { SicasSoapReportClient } from "../_shared/sicasSoapReportClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractIds(records: any[]): string[] {
  return records.map(
    (r: any) =>
      String(r.IDDocto ?? r.IdDocto ?? r.iddocto ?? r.Id ?? r.id ?? "")
  );
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

interface PruebaResult {
  viable: boolean;
  error?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const globalStart = Date.now();

  try {
    const soapEndpoint =
      "https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx";
    const soapUser = Deno.env.get("SICAS_USERNAME") || "";
    const soapPass = Deno.env.get("SICAS_PASSWORD") || "";

    if (!soapUser || !soapPass) {
      return json(500, {
        error: "Credenciales SICAS no configuradas (SICAS_USERNAME / SICAS_PASSWORD)",
      });
    }

    const restClient = await createSicasRestClientWithDbAuth();
    const soapClient = new SicasSoapReportClient({
      endpoint: soapEndpoint,
      username: soapUser,
      password: soapPass,
    });

    const results: Record<string, PruebaResult> = {};

    // =============================================
    // PRUEBA 1: SOAP con HWS_DOCTOS paginado
    // =============================================
    results.prueba1_soap_hwsdoctos = await runWithTimeout(
      "PRUEBA 1: SOAP HWS_DOCTOS",
      60000,
      async (): Promise<PruebaResult> => {
        const t0 = Date.now();
        let page1Records: any[] = [];
        let page2Records: any[] = [];
        let totalIndicated: number | null = null;

        const res1 = await soapClient.executeReport({
          keyCode: "HWS_DOCTOS",
          page: 1,
          itemsPerPage: 100,
          sortField: "DatDocumentos.FCaptura DESC",
        });
        page1Records = res1.records || [];
        totalIndicated = res1.totalRecords ?? null;

        let page1Ids = extractIds(page1Records);

        let page2Identical = true;
        if (page1Records.length > 0) {
          const res2 = await soapClient.executeReport({
            keyCode: "HWS_DOCTOS",
            page: 2,
            itemsPerPage: 100,
            sortField: "DatDocumentos.FCaptura DESC",
          });
          page2Records = res2.records || [];
          const page2Ids = extractIds(page2Records);
          page2Identical = setsEqual(page1Ids, page2Ids);
        }

        const sampleFields =
          page1Records.length > 0 ? Object.keys(page1Records[0]) : [];
        const hasPagination = !page2Identical && page2Records.length > 0;

        return {
          viable: hasPagination,
          page1_records: page1Records.length,
          page2_records: page2Records.length,
          page1_equals_page2: page2Identical,
          total_indicated: totalIndicated,
          sample_fields: sampleFields.slice(0, 30),
          has_IDDocto: sampleFields.includes("IDDocto") || sampleFields.includes("IdDocumento"),
          duration_ms: Date.now() - t0,
        };
      }
    );

    // =============================================
    // PRUEBA 2: REST filtro por vendedor 307
    // =============================================
    results.prueba2_rest_filtro_vendedor = await runWithTimeout(
      "PRUEBA 2: REST filtro vendedor",
      30000,
      async (): Promise<PruebaResult> => {
        const t0 = Date.now();

        const res = await restClient.readReport({
          keyCode: "HWS_DOCTOS",
          pageRequested: 1,
          itemsForPage: 200,
          conditions: ";0;0;307;Vendedor;0;0;DatDocumentos.IDVend",
        });

        const records = res.Response?.[0]?.TableInfo || [];
        const control = res.Response?.[1]?.TableControl?.[0] ||
          res.Response?.[0]?.TableControl?.[0];

        const baselineIds = extractIds(records);
        const hasVend307Only =
          records.length > 0 &&
          records.every(
            (r: any) => String(r.IDVend ?? r.VendId ?? "") === "307"
          );

        return {
          viable: records.length !== 101 && records.length > 0,
          records_returned: records.length,
          max_records_reported: control?.MaxRecords ?? null,
          pages_reported: control?.Pages ?? null,
          all_vendor_307: hasVend307Only,
          same_as_baseline_count: records.length === 101,
          sample_vend_ids: [
            ...new Set(
              records
                .slice(0, 20)
                .map((r: any) => String(r.IDVend ?? r.VendId ?? "?"))
            ),
          ],
          duration_ms: Date.now() - t0,
        };
      }
    );

    // =============================================
    // PRUEBA 3: REST filtro por despacho
    // =============================================
    results.prueba3_rest_filtro_despacho = await runWithTimeout(
      "PRUEBA 3: REST filtro despacho",
      30000,
      async (): Promise<PruebaResult> => {
        const t0 = Date.now();

        // 3a: filtro por IDDesp
        let res3a_records = 0;
        let res3a_error: string | null = null;
        try {
          const res3a = await restClient.readReport({
            keyCode: "HWS_DOCTOS",
            pageRequested: 1,
            itemsForPage: 200,
            conditions: ";0;0;9;Despacho;0;0;DatDocumentos.IDDesp",
          });
          res3a_records = res3a.Response?.[0]?.TableInfo?.length ?? 0;
        } catch (e: any) {
          res3a_error = e.message;
        }

        // 3b: filtro por ConditionsDirect con DespNombre
        let res3b_records = 0;
        let res3b_error: string | null = null;
        try {
          const res3b = await restClient.readReport({
            keyCode: "HWS_DOCTOS",
            pageRequested: 1,
            itemsForPage: 200,
            conditionsDirect:
              "SAN LUIS POTOSI;0;1;SAN LUIS POTOSI;Despacho;0;DespNombre",
          });
          res3b_records = res3b.Response?.[0]?.TableInfo?.length ?? 0;
        } catch (e: any) {
          res3b_error = e.message;
        }

        const eitherWorked =
          (res3a_records > 0 && res3a_records !== 101) ||
          (res3b_records > 0 && res3b_records !== 101);

        return {
          viable: eitherWorked,
          by_IDDesp: {
            records_returned: res3a_records,
            same_as_baseline: res3a_records === 101,
            error: res3a_error,
          },
          by_DespNombre: {
            records_returned: res3b_records,
            same_as_baseline: res3b_records === 101,
            error: res3b_error,
          },
          duration_ms: Date.now() - t0,
        };
      }
    );

    // =============================================
    // PRUEBA 4: Keycode HAPPDATAL_D004
    // =============================================
    results.prueba4_happdatal = await runWithTimeout(
      "PRUEBA 4: HAPPDATAL_D004",
      30000,
      async (): Promise<PruebaResult> => {
        const t0 = Date.now();

        const res = await restClient.readReport({
          keyCode: "HAPPDATAL_D004",
          pageRequested: 1,
          itemsForPage: 100,
        });

        const records = res.Response?.[0]?.TableInfo || [];
        const control = res.Response?.[1]?.TableControl?.[0] ||
          res.Response?.[0]?.TableControl?.[0];

        const sampleFields =
          records.length > 0 ? Object.keys(records[0]) : [];
        const doctoFields = [
          "IDDocto", "IdDocto", "Documento", "NoDocumento",
          "FDesde", "FHasta", "Poliza", "NoPoliza",
        ];
        const foundDoctoFields = doctoFields.filter((f) =>
          sampleFields.includes(f)
        );

        let page2Different = false;
        if (records.length > 0) {
          try {
            const res2 = await restClient.readReport({
              keyCode: "HAPPDATAL_D004",
              pageRequested: 2,
              itemsForPage: 100,
            });
            const records2 = res2.Response?.[0]?.TableInfo || [];
            const ids1 = extractIds(records);
            const ids2 = extractIds(records2);
            page2Different = !setsEqual(ids1, ids2) && records2.length > 0;
          } catch {
            // ignore
          }
        }

        return {
          viable: foundDoctoFields.length >= 2 && records.length > 0,
          records_returned: records.length,
          max_records_reported: control?.MaxRecords ?? null,
          pages_reported: control?.Pages ?? null,
          has_docto_fields: foundDoctoFields.length >= 2,
          found_docto_fields: foundDoctoFields,
          available_fields: sampleFields.slice(0, 40),
          pagination_works: page2Different,
          sample_record:
            records.length > 0
              ? Object.fromEntries(
                  Object.entries(records[0]).slice(0, 15)
                )
              : null,
          duration_ms: Date.now() - t0,
        };
      }
    );

    // =============================================
    // PRUEBA 5: SOAP H03117 con timeout largo
    // =============================================
    results.prueba5_soap_h03117 = await runWithTimeout(
      "PRUEBA 5: SOAP H03117",
      120000,
      async (): Promise<PruebaResult> => {
        const t0 = Date.now();

        const res = await soapClient.executeReport({
          keyCode: "H03117",
          page: 1,
          itemsPerPage: 50,
          sortField: "DatDocumentos.FCaptura DESC",
        });

        const sampleFields =
          res.records.length > 0 ? Object.keys(res.records[0]) : [];

        return {
          viable: res.records.length > 0,
          responded: true,
          records_returned: res.records.length,
          total_records: res.totalRecords ?? null,
          response_nbr: res.responseNbr,
          message: res.message,
          sample_fields: sampleFields.slice(0, 30),
          duration_ms: Date.now() - t0,
        };
      }
    );

    // =============================================
    // RECOMENDACION
    // =============================================
    const recomendacion = determineRecommendation(results);

    return json(200, {
      ok: true,
      timestamp: new Date().toISOString(),
      total_duration_ms: Date.now() - globalStart,
      ...results,
      recomendacion,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: (error as Error).message,
      stack: (error as Error).stack?.substring(0, 500),
    });
  }
});

async function runWithTimeout(
  label: string,
  timeoutMs: number,
  fn: () => Promise<PruebaResult>
): Promise<PruebaResult> {
  console.log(`\n========== ${label} ==========`);
  const t0 = Date.now();
  try {
    const result = await Promise.race([
      fn(),
      new Promise<PruebaResult>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
    console.log(`${label}: completado en ${Date.now() - t0}ms, viable=${result.viable}`);
    return result;
  } catch (error: any) {
    console.error(`${label}: ERROR - ${error.message}`);
    return {
      viable: false,
      error: error.message,
      duration_ms: Date.now() - t0,
    };
  }
}

function determineRecommendation(
  results: Record<string, PruebaResult>
): {
  strategy: string;
  explanation: string;
  priority: string[];
} {
  const viable: string[] = [];

  if (results.prueba1_soap_hwsdoctos?.viable) {
    viable.push("SOAP_HWSDOCTOS");
  }
  if (results.prueba2_rest_filtro_vendedor?.viable) {
    viable.push("REST_VENDOR_FILTER");
  }
  if (results.prueba3_rest_filtro_despacho?.viable) {
    viable.push("REST_DESPACHO_FILTER");
  }
  if (results.prueba4_happdatal?.viable) {
    viable.push("HAPPDATAL_D004");
  }
  if (results.prueba5_soap_h03117?.viable) {
    viable.push("SOAP_H03117");
  }

  if (viable.length === 0) {
    return {
      strategy: "CONTACTAR_SOPORTE",
      explanation:
        "Ninguna alternativa fue viable. La API REST ignora paginacion y filtros para HWS_DOCTOS, " +
        "y las alternativas SOAP y otros keycodes no devolvieron datos utiles. " +
        "Se recomienda contactar al proveedor SICAS para resolver la paginacion.",
      priority: [],
    };
  }

  if (viable.includes("SOAP_HWSDOCTOS")) {
    return {
      strategy: "SOAP_HWSDOCTOS",
      explanation:
        "La API SOAP respeta paginacion para HWS_DOCTOS. Recomendacion: " +
        "reescribir sicas-sync-local-documents para usar SOAP en vez de REST. " +
        "Esta es la solucion mas directa ya que usa el mismo keycode.",
      priority: viable,
    };
  }

  if (viable.includes("REST_VENDOR_FILTER") || viable.includes("REST_DESPACHO_FILTER")) {
    const filterType = viable.includes("REST_VENDOR_FILTER")
      ? "vendedor"
      : "despacho";
    return {
      strategy: "VENDOR_LOOP",
      explanation:
        `La API REST respeta filtros por ${filterType}. Recomendacion: ` +
        "hacer un loop por cada vendedor/despacho conocido y descargar documentos segmentados. " +
        "Esto requiere iterar por los 1,639 vendedores o 37 despachos del catalogo.",
      priority: viable,
    };
  }

  if (viable.includes("HAPPDATAL_D004")) {
    return {
      strategy: "HAPPDATAL_D004",
      explanation:
        "El keycode HAPPDATAL_D004 devuelve datos con campos de poliza y paginacion funcional. " +
        "Recomendacion: cambiar report_keycode_all en sicas_production_config a HAPPDATAL_D004.",
      priority: viable,
    };
  }

  if (viable.includes("SOAP_H03117")) {
    return {
      strategy: "SOAP_H03117",
      explanation:
        "H03117 responde via SOAP (puede ser lento). Se puede usar como alternativa " +
        "si las otras opciones no son viables.",
      priority: viable,
    };
  }

  return {
    strategy: viable[0],
    explanation: `Usar ${viable[0]} como estrategia principal.`,
    priority: viable,
  };
}
