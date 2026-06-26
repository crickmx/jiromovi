import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const IVA_RATE = 0.16;

interface InsurerRow {
  nombre: string;
  derecho_poliza: number;
  factor_base: number;
  tipo_api: string;
  endpoint_url: string | null;
  configuracion: Record<string, string>;
  disponible: boolean;
  color: string;
}

interface VehicleRequest {
  valorReferencia: number;
  anio: number;
  marca: string;
  modelo: string;
  version: string;
  paquete: string;
  coberturas: {
    gastosMedicos: boolean;
    asistenciaVial: boolean;
    autoSustituto: boolean;
    defensa_legal: boolean;
  };
}

interface QuoteRequest {
  vehiculos: VehicleRequest[];
  formaPago: string;
  edad: number;
  genero: string;
  codigoPostal: string;
}

// --- SOAP envelope builders ---

function buildWsSecurityHeader(username: string, password: string): string {
  return `
  <soap:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${username}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>`;
}

function buildQualitasSoap(config: Record<string, string>, vehicle: VehicleRequest, _edad: number, cp: string): string {
  const xmlContent = `<COTIZACION><NEGOCIO>${config.no_negocio}</NEGOCIO><AGENTE>${config.agente}</AGENTE><TARIFA>${config.tarifa}</TARIFA><MARCA>${vehicle.marca}</MARCA><ANIO>${vehicle.anio}</ANIO><MODELO>${vehicle.modelo}</MODELO><VERSION>${vehicle.version}</VERSION><VALOR_VEHICULO>${vehicle.valorReferencia}</VALOR_VEHICULO><CODIGO_POSTAL>${cp}</CODIGO_POSTAL><PAQUETE>${vehicle.paquete === "Amplia" ? "1" : vehicle.paquete === "Limitada" ? "2" : "3"}</PAQUETE><BONIFICACION_TECNICA>${config.bonificacion_tecnica || "40"}</BONIFICACION_TECNICA></COTIZACION>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://qualitas.com.mx/">
  <soap:Body>
    <tns:obtenerNuevaEmision>
      <tns:xmlEmision><![CDATA[${xmlContent}]]></tns:xmlEmision>
    </tns:obtenerNuevaEmision>
  </soap:Body>
</soap:Envelope>`;
}

function buildAnaSoap(config: Record<string, string>, vehicle: VehicleRequest, edad: number, cp: string): string {
  const cotizacionXml = `<Cotizacion><NegocioRef>${config.negocio_ref}</NegocioRef><Marca>${vehicle.marca}</Marca><Anio>${vehicle.anio}</Anio><Modelo>${vehicle.modelo}</Modelo><Version>${vehicle.version}</Version><ValorVehiculo>${vehicle.valorReferencia}</ValorVehiculo><CodigoPostal>${cp}</CodigoPostal><EdadConductor>${edad}</EdadConductor><Paquete>${vehicle.paquete}</Paquete></Cotizacion>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
  <soap:Body>
    <tns:Transaccion>
      <tns:XML>${cotizacionXml}</tns:XML>
      <tns:Tipo>Cotizacion</tns:Tipo>
      <tns:Usuario>${config.usuario}</tns:Usuario>
      <tns:Clave>${config.password || config.clave || ""}</tns:Clave>
    </tns:Transaccion>
  </soap:Body>
</soap:Envelope>`;
}

function buildHdiSoap(config: Record<string, string>, vehicle: VehicleRequest, edad: number, cp: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://hdi.com.mx/asmx/">
  <soap:Header>
    <tns:AuthenticateHeader>
      <tns:siteID>${config.usuario}</tns:siteID>
      <tns:sitePwd>${config.password}</tns:sitePwd>
    </tns:AuthenticateHeader>
  </soap:Header>
  <soap:Body>
    <tns:savequote>
      <tns:request>
        <tns:datosCotizacion>
          <tns:CaracteristicasVehiculo>
            <tns:idVehiculo>${vehicle.version}</tns:idVehiculo>
            <tns:idMarca>0</tns:idMarca>
            <tns:idModelo>${vehicle.anio}</tns:idModelo>
            <tns:idTipo>${vehicle.modelo}</tns:idTipo>
            <tns:idVersion>${vehicle.version}</tns:idVersion>
            <tns:idTransmision>0</tns:idTransmision>
            <tns:idUso>1</tns:idUso>
            <tns:tipoVehiculo>1</tns:tipoVehiculo>
            <tns:pasajeros>5</tns:pasajeros>
            <tns:idZonaCirculacion>0</tns:idZonaCirculacion>
            <tns:idTonelaje>0</tns:idTonelaje>
            <tns:idServicio>0</tns:idServicio>
            <tns:idRiesgoCarga>0</tns:idRiesgoCarga>
          </tns:CaracteristicasVehiculo>
          <tns:Cliente>
            <tns:Edad>${edad}</tns:Edad>
            <tns:CodigoPostal>${cp}</tns:CodigoPostal>
          </tns:Cliente>
          <tns:PaqueteCoberturas>
            <tns:Clave>${vehicle.paquete === "Amplia" ? 1 : vehicle.paquete === "Limitada" ? 2 : 3}</tns:Clave>
          </tns:PaqueteCoberturas>
        </tns:datosCotizacion>
        <tns:usuario>${config.usuario}</tns:usuario>
      </tns:request>
    </tns:savequote>
  </soap:Body>
</soap:Envelope>`;
}

function buildZurichSoap(config: Record<string, string>, vehicle: VehicleRequest, edad: number, cp: string): string {
  const wsSecHeader = config.usuario
    ? buildWsSecurityHeader(config.usuario, config.password || "")
    : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:zur="http://zurich.com.mx/ws/autos/">
  ${wsSecHeader}
  <soap:Body>
    <zur:CotizarAuto>
      <zur:usuario>${config.usuario}</zur:usuario>
      <zur:cveAgente>${config.cve_agente}</zur:cveAgente>
      <zur:oficina>${config.oficina}</zur:oficina>
      <zur:programaComercial>${config.programa_comercial}</zur:programaComercial>
      <zur:marca>${vehicle.marca}</zur:marca>
      <zur:anio>${vehicle.anio}</zur:anio>
      <zur:modelo>${vehicle.modelo}</zur:modelo>
      <zur:version>${vehicle.version}</zur:version>
      <zur:valorVehiculo>${vehicle.valorReferencia}</zur:valorVehiculo>
      <zur:codigoPostal>${cp}</zur:codigoPostal>
      <zur:edadConductor>${edad}</zur:edadConductor>
      <zur:paquete>${vehicle.paquete}</zur:paquete>
      <zur:descuento>${config.descuento || "10"}</zur:descuento>
    </zur:CotizarAuto>
  </soap:Body>
</soap:Envelope>`;
}

function buildChubbSoap(config: Record<string, string>, vehicle: VehicleRequest, edad: number, cp: string): string {
  const wsSecHeader = config.usuario
    ? buildWsSecurityHeader(config.usuario || config.agente, config.password || "")
    : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:chb="http://chubb.com.mx/ws/autos/">
  ${wsSecHeader}
  <soap:Body>
    <chb:CotizarVehiculo>
      <chb:agente>${config.agente}</chb:agente>
      <chb:tarifa>${config.tarifa}</chb:tarifa>
      <chb:marca>${vehicle.marca}</chb:marca>
      <chb:anio>${vehicle.anio}</chb:anio>
      <chb:modelo>${vehicle.modelo}</chb:modelo>
      <chb:version>${vehicle.version}</chb:version>
      <chb:valorVehiculo>${vehicle.valorReferencia}</chb:valorVehiculo>
      <chb:codigoPostal>${cp}</chb:codigoPostal>
      <chb:edadConductor>${edad}</chb:edadConductor>
      <chb:paquete>${vehicle.paquete}</chb:paquete>
    </chb:CotizarVehiculo>
  </soap:Body>
</soap:Envelope>`;
}

// --- Response parsers ---

function extractSoapFault(xml: string): string | null {
  const faultMatch = xml.match(/<(?:\w+:)?faultstring[^>]*>([^<]+)/i);
  if (faultMatch) return faultMatch[1];
  const detailMatch = xml.match(/<(?:\w+:)?detail[^>]*>([^<]+)/i);
  if (detailMatch) return detailMatch[1];
  const descMatch = xml.match(/<(?:\w+:)?descripcion[^>]*>([^<]+)/i);
  if (descMatch) return descMatch[1];
  return null;
}

function extractResultString(xml: string): string {
  const patterns = [
    /<(?:\w+:)?obtenerNuevaEmisionResult[^>]*>([\s\S]*?)<\/(?:\w+:)?obtenerNuevaEmisionResult>/i,
    /<(?:\w+:)?TransaccionResult[^>]*>([\s\S]*?)<\/(?:\w+:)?TransaccionResult>/i,
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m && m[1]) {
      let result = m[1].trim();
      result = result.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
      return result;
    }
  }
  return xml;
}

function extractPrimaNeta(xml: string): number | null {
  const patterns = [
    /<(?:\w+:)?PrimaNeta[^>]*>([^<]+)/i,
    /<(?:\w+:)?primaNeta[^>]*>([^<]+)/i,
    /<(?:\w+:)?prima_neta[^>]*>([^<]+)/i,
    /<(?:\w+:)?MontoTotal[^>]*>([^<]+)/i,
    /<(?:\w+:)?TotalPrima[^>]*>([^<]+)/i,
    /<(?:\w+:)?ImportePrimaNeta[^>]*>([^<]+)/i,
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function extractDerechoPoliza(xml: string): number | null {
  const patterns = [
    /<(?:\w+:)?DerechoPoliza[^>]*>([^<]+)/i,
    /<(?:\w+:)?derecho_poliza[^>]*>([^<]+)/i,
    /<(?:\w+:)?GastosExpedicion[^>]*>([^<]+)/i,
    /<(?:\w+:)?DerechoDePoliza[^>]*>([^<]+)/i,
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function extractIva(xml: string): number | null {
  const patterns = [
    /<(?:\w+:)?IVA[^>]*>([^<]+)/i,
    /<(?:\w+:)?Iva[^>]*>([^<]+)/i,
    /<(?:\w+:)?ImporteIVA[^>]*>([^<]+)/i,
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function extractPrimaTotal(xml: string): number | null {
  const patterns = [
    /<(?:\w+:)?PrimaTotal[^>]*>([^<]+)/i,
    /<(?:\w+:)?ImporteTotal[^>]*>([^<]+)/i,
    /<(?:\w+:)?TotalAPagar[^>]*>([^<]+)/i,
    /<(?:\w+:)?prima_total[^>]*>([^<]+)/i,
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

// --- API callers ---

async function callSoapInsurer(
  endpoint: string,
  soapBody: string,
  soapAction: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": soapAction,
      ...extraHeaders,
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: soapBody,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok && !text.includes("soap:Envelope") && !text.includes("Envelope")) {
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 300)}`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callRestInsurer(
  endpoint: string,
  payload: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText.substring(0, 300)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// --- Quote for each insurer (WS only, no fallback) ---

async function quoteInsurer(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  formaPago: string,
  edad: number,
  _genero: string,
  codigoPostal: string
): Promise<{
  aseguradora: string;
  color: string;
  primaNeta: number | null;
  derechoPoliza: number | null;
  iva: number | null;
  primaTotal: number | null;
  disponible: boolean;
  modo: string;
  error: string | null;
  tiempoRespuesta: number;
  debug?: string;
}> {
  const config = insurer.configuracion || {};
  const endpoint = insurer.endpoint_url || config.api_url || "";
  const startTime = Date.now();

  // Try WS first if endpoint is configured
  if (endpoint) {
    try {
      let primaNeta: number | null = null;
      let derechoPoliza: number | null = null;
      let iva: number | null = null;
      let primaTotal: number | null = null;
      let rawResponse = "";

      if (insurer.nombre === "Qualitas") {
        const soapBody = buildQualitasSoap(config, vehicle, edad, codigoPostal);
        const xml = await callSoapInsurer(endpoint, soapBody, "http://qualitas.com.mx/obtenerNuevaEmision");
        rawResponse = xml.substring(0, 500);
        const innerXml = extractResultString(xml);
        primaNeta = extractPrimaNeta(innerXml);
        derechoPoliza = extractDerechoPoliza(innerXml) || Number(insurer.derecho_poliza);
        iva = extractIva(innerXml);
        primaTotal = extractPrimaTotal(innerXml);
      } else if (insurer.nombre === "GNP") {
        const gnpPassword = config.password || Deno.env.get("GNP_PASSWORD") || "";
        const payload = {
          usuario: config.usuario,
          password: gnpPassword,
          unidadOperable: config.unidad_operable,
          intermediario: config.intermediario,
          oficina: config.oficina,
          vehiculo: { marca: vehicle.marca, anio: vehicle.anio, modelo: vehicle.modelo, version: vehicle.version, valorVehiculo: vehicle.valorReferencia },
          conductor: { edad, codigoPostal },
          paquete: vehicle.paquete,
          formaPago,
        };
        const authHeaders: Record<string, string> = {};
        if (gnpPassword) {
          authHeaders["Authorization"] = `Basic ${btoa(`${config.usuario}:${gnpPassword}`)}`;
        }
        const data = await callRestInsurer(endpoint, payload, authHeaders);
        rawResponse = JSON.stringify(data).substring(0, 500);
        primaNeta = (data.primaNeta || data.prima_neta || (data as Record<string, Record<string, number>>).resultado?.primaNeta || null) as number | null;
        derechoPoliza = (data.derechoPoliza || data.derecho_poliza || Number(insurer.derecho_poliza)) as number;
        primaTotal = (data.primaTotal || data.prima_total || (data as Record<string, Record<string, number>>).resultado?.primaTotal || null) as number | null;
      } else if (insurer.nombre === "ANA Seguros") {
        const soapBody = buildAnaSoap(config, vehicle, edad, codigoPostal);
        const xml = await callSoapInsurer(endpoint, soapBody, "http://tempuri.org/Transaccion");
        rawResponse = xml.substring(0, 500);
        const innerXml = extractResultString(xml);
        primaNeta = extractPrimaNeta(innerXml);
        derechoPoliza = extractDerechoPoliza(innerXml) || Number(insurer.derecho_poliza);
        iva = extractIva(innerXml);
        primaTotal = extractPrimaTotal(innerXml);
      } else if (insurer.nombre === "HDI Seguros") {
        const soapBody = buildHdiSoap(config, vehicle, edad, codigoPostal);
        const xml = await callSoapInsurer(endpoint, soapBody, "http://hdi.com.mx/asmx/savequote");
        rawResponse = xml.substring(0, 500);
        const hdiError = xml.match(/<descripcion>([^<]+)/i);
        if (hdiError && hdiError[1].startsWith("ERROR")) {
          throw new Error(`HDI: ${hdiError[1].substring(0, 150)}`);
        }
        primaNeta = extractPrimaNeta(xml);
        derechoPoliza = extractDerechoPoliza(xml) || Number(insurer.derecho_poliza);
        iva = extractIva(xml);
        primaTotal = extractPrimaTotal(xml);
      } else if (insurer.nombre === "Zurich") {
        const soapBody = buildZurichSoap(config, vehicle, edad, codigoPostal);
        const httpAuth = config.password ? { "Authorization": `Basic ${btoa(`${config.usuario}:${config.password}`)}` } : {};
        const xml = await callSoapInsurer(endpoint, soapBody, "http://zurich.com.mx/ws/autos/CotizarAuto", httpAuth);
        rawResponse = xml.substring(0, 500);
        primaNeta = extractPrimaNeta(xml);
        derechoPoliza = extractDerechoPoliza(xml) || Number(insurer.derecho_poliza);
        iva = extractIva(xml);
        primaTotal = extractPrimaTotal(xml);
      } else if (insurer.nombre === "Chubb") {
        const soapBody = buildChubbSoap(config, vehicle, edad, codigoPostal);
        const httpAuth = config.password ? { "Authorization": `Basic ${btoa(`${config.agente}:${config.password}`)}` } : {};
        const xml = await callSoapInsurer(endpoint, soapBody, "http://chubb.com.mx/ws/autos/CotizarVehiculo", httpAuth);
        rawResponse = xml.substring(0, 500);
        primaNeta = extractPrimaNeta(xml);
        derechoPoliza = extractDerechoPoliza(xml) || Number(insurer.derecho_poliza);
        iva = extractIva(xml);
        primaTotal = extractPrimaTotal(xml);
      } else if (insurer.nombre === "Potosi") {
        const bearerToken = config.bearer_token || Deno.env.get("POTOSI_BEARER_TOKEN") || "";
        const payload = {
          usuario: config.usuario,
          vehiculo: { marca: vehicle.marca, anio: vehicle.anio, modelo: vehicle.modelo, version: vehicle.version, valorVehiculo: vehicle.valorReferencia },
          conductor: { edad, codigoPostal },
          paquete: vehicle.paquete,
          formaPago,
        };
        const authHeaders: Record<string, string> = {};
        if (bearerToken) {
          authHeaders["Authorization"] = `Bearer ${bearerToken}`;
        }
        const data = await callRestInsurer(endpoint, payload, authHeaders);
        rawResponse = JSON.stringify(data).substring(0, 500);
        primaNeta = (data.primaNeta || data.prima_neta || null) as number | null;
        derechoPoliza = (data.derechoPoliza || data.derecho_poliza || Number(insurer.derecho_poliza)) as number;
        primaTotal = (data.primaTotal || data.prima_total || null) as number | null;
      }

      if (primaNeta && !primaTotal) {
        const dp = derechoPoliza || Number(insurer.derecho_poliza);
        const subtotal = primaNeta + dp;
        const calculatedIva = Math.round(subtotal * IVA_RATE * 100) / 100;
        primaTotal = Math.round((subtotal + calculatedIva) * 100) / 100;
        iva = calculatedIva;
        derechoPoliza = dp;
      }

      if (primaNeta && primaNeta > 0) {
        return {
          aseguradora: insurer.nombre,
          color: insurer.color || "#666",
          primaNeta,
          derechoPoliza: derechoPoliza || Number(insurer.derecho_poliza),
          iva: iva || Math.round((primaNeta + (derechoPoliza || 0)) * IVA_RATE * 100) / 100,
          primaTotal: primaTotal!,
          disponible: true,
          modo: "web_service",
          error: null,
          tiempoRespuesta: Date.now() - startTime,
          debug: rawResponse,
        };
      }

      const soapFault = extractSoapFault(rawResponse);
      return {
        aseguradora: insurer.nombre,
        color: insurer.color || "#666",
        primaNeta: null,
        derechoPoliza: null,
        iva: null,
        primaTotal: null,
        disponible: false,
        modo: "web_service",
        error: soapFault ? `SOAP Fault: ${soapFault}` : `Sin datos de prima. Respuesta: ${rawResponse.substring(0, 200)}`,
        tiempoRespuesta: Date.now() - startTime,
        debug: rawResponse,
      };
    } catch (err) {
      return {
        aseguradora: insurer.nombre,
        color: insurer.color || "#666",
        primaNeta: null,
        derechoPoliza: null,
        iva: null,
        primaTotal: null,
        disponible: false,
        modo: "web_service",
        error: `${(err as Error).message}. Endpoint: ${endpoint}`,
        tiempoRespuesta: Date.now() - startTime,
        debug: `Error: ${(err as Error).message}`,
      };
    }
  }

  return {
    aseguradora: insurer.nombre,
    color: insurer.color || "#666",
    primaNeta: null,
    derechoPoliza: null,
    iva: null,
    primaTotal: null,
    disponible: false,
    modo: "web_service",
    error: "Endpoint no configurado",
    tiempoRespuesta: Date.now() - startTime,
    debug: "No endpoint URL found",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: QuoteRequest = await req.json();
    const { vehiculos, formaPago, edad, genero, codigoPostal } = body;

    if (!vehiculos?.length) {
      return new Response(JSON.stringify({ error: "No vehicles provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: insurers, error: dbError } = await supabase
      .from("multi_autos_aseguradoras")
      .select("nombre, derecho_poliza, factor_base, tipo_api, endpoint_url, configuracion, disponible, color")
      .eq("disponible", true);

    if (dbError || !insurers?.length) {
      return new Response(JSON.stringify({ error: "No insurers configured", detail: dbError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(
      vehiculos.map(async (vehicle, vIdx) => {
        const vehicleResults = await Promise.all(
          insurers.map((insurer) =>
            quoteInsurer(insurer as InsurerRow, vehicle, formaPago, edad, genero, codigoPostal)
          )
        );
        return { vehicleIndex: vIdx, quotes: vehicleResults };
      })
    );

    const vehicleCount = vehiculos.length;
    let discountRate = 0;
    if (vehicleCount >= 4) discountRate = 0.10;
    else if (vehicleCount >= 2) discountRate = 0.05;

    return new Response(
      JSON.stringify({
        success: true,
        vehicleCount,
        discountRate,
        formaPago,
        results,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
