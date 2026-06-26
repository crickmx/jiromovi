import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const QUALITAS_CATALOG_WSDL = "https://servicios.qualitas.com.mx/SICAPCatalogosWS/CatalogosWS?wsdl";
const QUALITAS_TARIFA_URL = "http://qbcenter.qualitas.com.mx/wsTarifa/wsTarifa.asmx";
const SOAP_NS = "http://tempuri.org/WSQBC/QBCDE/";

function buildSoapEnvelope(operation: string, params: Record<string, string>): string {
  const paramsXml = Object.entries(params)
    .map(([key, value]) => `<${key}>${value}</${key}>`)
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${SOAP_NS}">
  <soap:Body>
    <tns:${operation}>${paramsXml}</tns:${operation}>
  </soap:Body>
</soap:Envelope>`;
}

async function callQualitasSoap(operation: string, params: Record<string, string>): Promise<string> {
  const body = buildSoapEnvelope(operation, params);
  const response = await fetch(QUALITAS_TARIFA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `${SOAP_NS}${operation}`,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`SOAP error: ${response.status} ${await response.text()}`);
  }
  return await response.text();
}

function parseXmlArray(xml: string, tagName: string): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const regex = new RegExp(`<${tagName}>(.*?)</${tagName}>`, "gs");
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const item: Record<string, string> = {};
    const innerContent = match[1];
    const fieldRegex = /<(\w+)>(.*?)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(innerContent)) !== null) {
      item[fieldMatch[1]] = fieldMatch[2];
    }
    results.push(item);
  }
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "marcas";
    const marca = url.searchParams.get("marca") || "";
    const anio = url.searchParams.get("anio") || "";
    const modelo = url.searchParams.get("modelo") || "";

    // Try fetching from our cached catalog first
    if (action === "marcas") {
      const { data } = await supabase
        .from("multi_autos_catalogo_vehiculos")
        .select("marca")
        .order("marca");
      if (data && data.length > 0) {
        const uniqueBrands = [...new Set(data.map((r: { marca: string }) => r.marca))].sort();
        return new Response(JSON.stringify({ source: "qualitas_ws", marcas: uniqueBrands }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "anios" && marca) {
      const { data } = await supabase
        .from("multi_autos_catalogo_vehiculos")
        .select("anio")
        .eq("marca", marca)
        .order("anio", { ascending: false });
      if (data && data.length > 0) {
        const uniqueYears = [...new Set(data.map((r: { anio: number }) => r.anio))].sort((a, b) => b - a);
        return new Response(JSON.stringify({ source: "qualitas_ws", marca, anios: uniqueYears }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "modelos" && marca && anio) {
      const { data } = await supabase
        .from("multi_autos_catalogo_vehiculos")
        .select("modelo")
        .eq("marca", marca)
        .eq("anio", parseInt(anio))
        .order("modelo");
      if (data && data.length > 0) {
        const uniqueModels = [...new Set(data.map((r: { modelo: string }) => r.modelo))].sort();
        return new Response(JSON.stringify({ source: "qualitas_ws", marca, anio, modelos: uniqueModels }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "versiones" && marca && anio && modelo) {
      const { data } = await supabase
        .from("multi_autos_catalogo_vehiculos")
        .select("*")
        .eq("marca", marca)
        .eq("anio", parseInt(anio))
        .eq("modelo", modelo)
        .order("version");
      if (data && data.length > 0) {
        return new Response(JSON.stringify({ source: "qualitas_ws", marca, anio, modelo, versiones: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // If no cached data, attempt Qualitas SOAP WS call
    const wsUser = Deno.env.get("QUALITAS_WS_USER") || "";
    const wsPass = Deno.env.get("QUALITAS_WS_PASSWORD") || "";

    if (wsUser && wsPass) {
      try {
        if (action === "marcas") {
          const xml = await callQualitasSoap("listaMarcas", { usuario: wsUser, contrasena: wsPass });
          const marcas = parseXmlArray(xml, "Marca");
          return new Response(JSON.stringify({ source: "qualitas_ws_live", marcas: marcas.map(m => m.NombreMarca || m.nombre).filter(Boolean) }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (action === "modelos" && marca) {
          const xml = await callQualitasSoap("listaSubmarcas", { usuario: wsUser, contrasena: wsPass, codigoMarca: marca });
          const modelos = parseXmlArray(xml, "Submarca");
          return new Response(JSON.stringify({ source: "qualitas_ws_live", modelos: modelos.map(m => m.NombreSubmarca || m.nombre).filter(Boolean) }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (wsError) {
        console.error("Qualitas WS error, falling back to DB:", wsError);
      }
    }

    return new Response(JSON.stringify({ error: "No catalog data available for the given filters", action, marca, anio, modelo }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
