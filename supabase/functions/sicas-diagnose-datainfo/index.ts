import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Función de diagnóstico: prueba HWS_DOCTOS variante F con múltiples
 * valores de ItemForPage y devuelve el XML completo sanitizado para
 * analizar la estructura real de la respuesta SICAS.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const username = Deno.env.get("SICAS_USERNAME") || "";
    const password = Deno.env.get("SICAS_PASSWORD") || "";

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Credenciales SICAS no configuradas" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: sicasConfig } = await supabase
      .from("sicas_config")
      .select("endpoint")
      .limit(1)
      .maybeSingle();

    const endpoint = sicasConfig?.endpoint || "https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx";
    const body = await req.json().catch(() => ({}));
    const pageSizes: number[] = body.pageSizes || [1, 5, 10, 25, 100];
    const keycode: string = body.keycode || "HWS_DOCTOS";

    const results = [];

    for (const itemsPerPage of pageSizes) {
      const startMs = Date.now();

      // Variante F: sin CredentialsUserSICAS
      const soapEnvelope = buildSoapEnvelope(username, password, keycode, itemsPerPage);

      let httpStatus = 0;
      let responseText = "";
      let timedOut = false;

      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 50000);
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "http://tempuri.org/ProcesarWS",
          },
          body: soapEnvelope,
          signal: controller.signal,
        });
        clearTimeout(tid);
        httpStatus = resp.status;
        responseText = await resp.text();
      } catch (e: unknown) {
        timedOut = (e as Error).name === "AbortError";
        responseText = timedOut ? "TIMEOUT" : (e as Error).message;
      }

      const durationMs = Date.now() - startMs;
      const responseLength = responseText.length;

      // Analizar estructura del XML
      const analysis = analyzeResponse(responseText);

      // XML sanitizado: eliminar info de credenciales, mantener estructura
      const sanitizedXml = sanitizeXml(responseText);

      results.push({
        itemsPerPage,
        keycode,
        variant: "F_no_credsicas_xml",
        durationMs,
        httpStatus,
        responseLength,
        timedOut,
        ...analysis,
        // Solo los primeros 3000 chars del XML sanitizado para no saturar
        rawXmlSample: sanitizedXml.substring(0, 3000),
      });

      // Si hay timeout, no seguir probando páginas más grandes
      if (timedOut) break;

      // Pausa entre llamadas para no saturar SICAS
      await sleep(1500);
    }

    return new Response(JSON.stringify({ ok: true, endpoint, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

function buildSoapEnvelope(username: string, password: string, keyCode: string, itemsPerPage: number): string {
  const encodedPassword = password.replace(/ /g, "%20");
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>${username}</tem:UserName>
          <tem:Password>${encodedPassword}</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>XML</tem:TypeFormat>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>${keyCode}</tem:KeyCode>
        <tem:Page>1</tem:Page>
        <tem:ItemForPage>${itemsPerPage}</tem:ItemForPage>
        <tem:InfoSort>DatDocumentos.FCaptura DESC</tem:InfoSort>
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>`;
}

interface AnalysisResult {
  hasDatainfo: boolean;
  datainfoNodeCount: number;
  hasRecord: boolean;
  recordNodeCount: boolean;
  hasProcesarWSResult: boolean;
  hasNewDataSet: boolean;
  hasProcessData: boolean;
  detectedTopLevelTags: string[];
  datainfoFieldNames: string[];
  recordFieldNames: string[];
  totalRegistrosField: string | null;
  totalPaginasField: string | null;
  paginaActualField: string | null;
  isPolicyRecord: boolean;
  policyFieldsFound: string[];
  metadataRows: number;
  policyRows: number;
  errorMessage: string | null;
  isAuthError: boolean;
  structureSummary: string;
}

const POLICY_FIELDS = [
  "Documento", "IDDocto", "Poliza", "Serie", "FDesde", "FHasta", "Cliente",
  "VendNombre", "IDVend", "CiaNombre", "Ramo", "PrimaNeta", "PrimaTotal",
  "Status", "TipoDocto", "NoPoliza", "FechaDesde", "FechaHasta", "Asegurado",
  "NombreCliente", "Aseguradora", "FCaptura", "Prima", "Moneda"
];

const METADATA_FIELDS = [
  "TotalRegistros", "TotalPaginas", "RegistrosPagina", "PaginaActual",
  "TotalReg", "TotPag", "RegPag", "PagAct", "Registros", "Paginas",
  "Total", "Sucess", "MsgError", "RESPONSETXT", "RESPONSENBR", "MESSAGE",
  "T", "P", "R", "S" // short metadata field names SICAS sometimes uses
];

function analyzeResponse(xml: string): AnalysisResult {
  if (xml === "TIMEOUT") {
    return {
      hasDatainfo: false, datainfoNodeCount: 0, hasRecord: false, recordNodeCount: false,
      hasProcesarWSResult: false, hasNewDataSet: false, hasProcessData: false,
      detectedTopLevelTags: [], datainfoFieldNames: [], recordFieldNames: [],
      totalRegistrosField: null, totalPaginasField: null, paginaActualField: null,
      isPolicyRecord: false, policyFieldsFound: [], metadataRows: 0, policyRows: 0,
      errorMessage: "TIMEOUT — el servidor no respondió en 50 segundos",
      isAuthError: false, structureSummary: "TIMEOUT"
    };
  }

  // Decode XML entities
  const decoded = xml
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"');

  const result: AnalysisResult = {
    hasDatainfo: false, datainfoNodeCount: 0, hasRecord: false, recordNodeCount: false,
    hasProcesarWSResult: false, hasNewDataSet: false, hasProcessData: false,
    detectedTopLevelTags: [], datainfoFieldNames: [], recordFieldNames: [],
    totalRegistrosField: null, totalPaginasField: null, paginaActualField: null,
    isPolicyRecord: false, policyFieldsFound: [], metadataRows: 0, policyRows: 0,
    errorMessage: null, isAuthError: false, structureSummary: ""
  };

  // Check structural markers
  result.hasProcesarWSResult = decoded.includes("<ProcesarWSResult>");
  result.hasNewDataSet = decoded.includes("<NewDataSet>");
  result.hasProcessData = decoded.includes("<PROCESSDATA>");

  // Check DATAINFO
  const datainfoMatches = [...decoded.matchAll(/<DATAINFO>([\s\S]*?)<\/DATAINFO>/gi)];
  result.hasDatainfo = datainfoMatches.length > 0;
  result.datainfoNodeCount = datainfoMatches.length;

  // Check RECORD
  const recordMatches = [...decoded.matchAll(/<RECORD>([\s\S]*?)<\/RECORD>/gi)];
  result.hasRecord = recordMatches.length > 0;
  result.recordNodeCount = recordMatches.length > 0;

  // Extract top-level tags inside ProcesarWSResult
  const resultContent = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/i)?.[1] || decoded;
  const topTags = new Set<string>();
  for (const m of resultContent.matchAll(/<([A-Za-z][A-Za-z0-9_]*)[^>\/]*>/g)) {
    topTags.add(m[1]);
  }
  result.detectedTopLevelTags = [...topTags].slice(0, 30);

  // Analyze DATAINFO nodes
  for (const diMatch of datainfoMatches) {
    const diContent = diMatch[1];
    const fields: string[] = [];
    for (const fm of diContent.matchAll(/<([A-Za-z][A-Za-z0-9_]*)[^>\/]*>([^<]*)<\/\1>/g)) {
      fields.push(fm[1]);
    }

    // Check if it's metadata or policy
    const hasPolicyFields = fields.some(f => POLICY_FIELDS.some(pf => pf.toLowerCase() === f.toLowerCase()));
    const hasMetaFields = fields.some(f => METADATA_FIELDS.some(mf => mf.toLowerCase() === f.toLowerCase()));

    if (hasPolicyFields) {
      result.policyRows++;
      result.policyFieldsFound.push(...fields.filter(f => POLICY_FIELDS.some(pf => pf.toLowerCase() === f.toLowerCase())));
      if (result.recordFieldNames.length === 0) result.recordFieldNames = fields;
    } else if (hasMetaFields || fields.length <= 8) {
      result.metadataRows++;
      if (result.datainfoFieldNames.length === 0) result.datainfoFieldNames = fields;

      // Try to find pagination fields
      for (const f of fields) {
        const lower = f.toLowerCase();
        if (lower.includes("totalreg") || lower === "t" || lower === "totalregistros") {
          result.totalRegistrosField = f;
        }
        if (lower.includes("totalpag") || lower === "p" || lower === "totalpaginas") {
          result.totalPaginasField = f;
        }
        if (lower.includes("paginaactual") || lower === "s" || lower === "paginaact") {
          result.paginaActualField = f;
        }
      }
    }
  }

  // Analyze RECORD nodes
  for (const rMatch of recordMatches) {
    const rContent = rMatch[1];
    const fields: string[] = [];
    for (const fm of rContent.matchAll(/<([A-Za-z][A-Za-z0-9_]*)[^>\/]*>([^<]*)<\/\1>/g)) {
      fields.push(fm[1]);
    }
    const hasPolicyFields = fields.some(f => POLICY_FIELDS.some(pf => pf.toLowerCase() === f.toLowerCase()));
    if (hasPolicyFields) {
      result.policyRows++;
      result.policyFieldsFound.push(...fields.filter(f => POLICY_FIELDS.some(pf => pf.toLowerCase() === f.toLowerCase())));
    }
    if (result.recordFieldNames.length === 0) result.recordFieldNames = fields;
  }

  result.isPolicyRecord = result.policyRows > 0;

  // Check auth error
  const authErrorMatch = decoded.match(/Usuario.*Contraseña.*Incorrecta|Error.*autenticaci|access.*denied|login.*failed/i);
  result.isAuthError = !!authErrorMatch;
  if (result.isAuthError) {
    result.errorMessage = authErrorMatch?.[0] || "Error de autenticación";
  }

  // Check internal SICAS error
  const internalErrorMatch = decoded.match(/Variable de objeto.*no establecida|Error en Ejecución/i);
  if (internalErrorMatch && !result.isAuthError) {
    result.errorMessage = internalErrorMatch[0];
  }

  // Deduplicate policy fields
  result.policyFieldsFound = [...new Set(result.policyFieldsFound)];

  // Build summary
  if (result.isAuthError) {
    result.structureSummary = "AUTH_ERROR";
  } else if (result.metadataRows > 0 && result.policyRows === 0) {
    result.structureSummary = "METADATA_ONLY — servidor responde pero sin pólizas útiles";
  } else if (result.policyRows > 0) {
    result.structureSummary = `HAS_POLICY_RECORDS — ${result.policyRows} registros útiles`;
  } else if (result.errorMessage) {
    result.structureSummary = `INTERNAL_ERROR: ${result.errorMessage.substring(0, 100)}`;
  } else {
    result.structureSummary = "EMPTY — sin datos ni error reconocido";
  }

  return result;
}

function sanitizeXml(xml: string): string {
  // Remove password values but keep structure
  return xml
    .replace(/<tem:Password>[^<]*<\/tem:Password>/g, "<tem:Password>***</tem:Password>")
    .replace(/<Password>[^<]*<\/Password>/g, "<Password>***</Password>");
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
