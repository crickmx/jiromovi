import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SOAP_NS = "http://tempuri.org/WSQBC/QBCDE/";

function buildSoapEnvelope(operation: string, params: Record<string, string>, soapNs: string): string {
  const paramsXml = Object.entries(params)
    .map(([key, value]) => `<${key}>${value}</${key}>`)
    .join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${soapNs}">
  <soap:Body>
    <tns:${operation}>${paramsXml}</tns:${operation}>
  </soap:Body>
</soap:Envelope>`;
}

async function callQualitasSoap(
  endpoint: string,
  operation: string,
  params: Record<string, string>,
  soapNs: string
): Promise<string> {
  const body = buildSoapEnvelope(operation, params, soapNs);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `${soapNs}${operation}`,
    },
    body,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`SOAP error ${response.status}: ${errText.substring(0, 500)}`);
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

function parseSimpleXmlValues(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, "gi");
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
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

    // If no cached data, attempt live Qualitas SOAP WS call using DB credentials
    const { data: qualitasConfig } = await supabase
      .from("multi_autos_aseguradoras")
      .select("configuracion, endpoint_url")
      .eq("nombre", "Qualitas")
      .single();

    if (qualitasConfig?.configuracion) {
      const config = qualitasConfig.configuracion as Record<string, string>;
      const catalogUrl = config.catalogo_url || qualitasConfig.endpoint_url;
      const noNegocio = config.no_negocio;
      const agente = config.agente;
      const soapNs = config.soap_action_ns || SOAP_NS;

      if (catalogUrl && noNegocio) {
        try {
          if (action === "marcas") {
            const xml = await callQualitasSoap(catalogUrl, "ConsultarMarcas", {
              pv_strNoNegocio: noNegocio,
              pv_strNoAgente: agente,
            }, soapNs);
            const marcas = parseXmlArray(xml, "Marca");
            const marcaNames = marcas.map(m => m.cMarca || m.NombreMarca || m.nombre || m.Descripcion).filter(Boolean);
            if (marcaNames.length === 0) {
              const simple = parseSimpleXmlValues(xml, "cMarca");
              if (simple.length > 0) {
                return new Response(JSON.stringify({ source: "qualitas_ws_live", marcas: simple.sort() }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
            return new Response(JSON.stringify({ source: "qualitas_ws_live", marcas: marcaNames.sort() }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (action === "anios" && marca) {
            const xml = await callQualitasSoap(catalogUrl, "ConsultarAnios", {
              pv_strNoNegocio: noNegocio,
              pv_strNoAgente: agente,
              pv_strMarca: marca,
            }, soapNs);
            const anios = parseXmlArray(xml, "Anio");
            const anioValues = anios.map(a => a.nAnio || a.Anio || a.anio).filter(Boolean);
            if (anioValues.length === 0) {
              const simple = parseSimpleXmlValues(xml, "nAnio");
              return new Response(JSON.stringify({ source: "qualitas_ws_live", marca, anios: simple.sort((a, b) => Number(b) - Number(a)) }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ source: "qualitas_ws_live", marca, anios: anioValues.sort((a, b) => Number(b) - Number(a)) }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (action === "modelos" && marca && anio) {
            const xml = await callQualitasSoap(catalogUrl, "ConsultarModelos", {
              pv_strNoNegocio: noNegocio,
              pv_strNoAgente: agente,
              pv_strMarca: marca,
              pv_strAnio: anio,
            }, soapNs);
            const modelos = parseXmlArray(xml, "Modelo");
            const modelNames = modelos.map(m => m.cModelo || m.NombreModelo || m.Descripcion).filter(Boolean);
            if (modelNames.length === 0) {
              const simple = parseSimpleXmlValues(xml, "cModelo");
              return new Response(JSON.stringify({ source: "qualitas_ws_live", marca, anio, modelos: simple.sort() }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ source: "qualitas_ws_live", marca, anio, modelos: modelNames.sort() }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (action === "versiones" && marca && anio && modelo) {
            const xml = await callQualitasSoap(catalogUrl, "ConsultarVersiones", {
              pv_strNoNegocio: noNegocio,
              pv_strNoAgente: agente,
              pv_strMarca: marca,
              pv_strAnio: anio,
              pv_strModelo: modelo,
            }, soapNs);
            const versiones = parseXmlArray(xml, "Version");
            const versionList = versiones.map(v => ({
              version: v.cVersion || v.Descripcion || v.nombre || "",
              clave: v.nClave || v.clave || "",
              valor: v.nValor || v.valor || "0",
            })).filter(v => v.version);
            return new Response(JSON.stringify({ source: "qualitas_ws_live", marca, anio, modelo, versiones: versionList }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (wsError) {
          console.error("Qualitas WS live error:", wsError);
          return new Response(JSON.stringify({
            error: "Qualitas WS error",
            detail: (wsError as Error).message,
            action, marca, anio, modelo,
            endpoint: catalogUrl,
          }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: "No catalog data available", action, marca, anio, modelo }), {
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
