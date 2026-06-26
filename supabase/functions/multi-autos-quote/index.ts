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

function buildQualitasSoap(config: Record<string, string>, vehicle: VehicleRequest, _edad: number, cp: string): string {
  const ns = config.soap_action_ns || "http://tempuri.org/WSQBC/QBCDE/";
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${ns}">
  <soap:Body>
    <tns:obtenerNuevaEmision>
      <tns:pv_strNoNegocio>${config.no_negocio}</tns:pv_strNoNegocio>
      <tns:pv_strNoAgente>${config.agente}</tns:pv_strNoAgente>
      <tns:pv_strTarifa>${config.tarifa}</tns:pv_strTarifa>
      <tns:pv_strMarca>${vehicle.marca}</tns:pv_strMarca>
      <tns:pv_strAnio>${vehicle.anio}</tns:pv_strAnio>
      <tns:pv_strModelo>${vehicle.modelo}</tns:pv_strModelo>
      <tns:pv_strVersion>${vehicle.version}</tns:pv_strVersion>
      <tns:pv_strValorVehiculo>${vehicle.valorReferencia}</tns:pv_strValorVehiculo>
      <tns:pv_strCodigoPostal>${cp}</tns:pv_strCodigoPostal>
      <tns:pv_strBonificacionTecnica>${config.bonificacion_tecnica || "40"}</tns:pv_strBonificacionTecnica>
      <tns:pv_strPaquete>${vehicle.paquete === "Amplia" ? "1" : vehicle.paquete === "Limitada" ? "2" : "3"}</tns:pv_strPaquete>
    </tns:obtenerNuevaEmision>
  </soap:Body>
</soap:Envelope>`;
}

function buildAnaSoap(config: Record<string, string>, vehicle: VehicleRequest, edad: number, cp: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ana="http://anaseguros.com.mx/ws/">
  <soap:Body>
    <ana:CotizaSencilla>
      <ana:usuario>${config.usuario}</ana:usuario>
      <ana:negocioRef>${config.negocio_ref}</ana:negocioRef>
      <ana:marca>${vehicle.marca}</ana:marca>
      <ana:anio>${vehicle.anio}</ana:anio>
      <ana:modelo>${vehicle.modelo}</ana:modelo>
      <ana:version>${vehicle.version}</ana:version>
      <ana:valorVehiculo>${vehicle.valorReferencia}</ana:valorVehiculo>
      <ana:codigoPostal>${cp}</ana:codigoPostal>
      <ana:edadConductor>${edad}</ana:edadConductor>
      <ana:paquete>${vehicle.paquete}</ana:paquete>
    </ana:CotizaSencilla>
  </soap:Body>
</soap:Envelope>`;
}

function buildHdiSoap(config: Record<string, string>, vehicle: VehicleRequest, edad: number, cp: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hdi="http://hdi.com.mx/autos/ws/">
  <soap:Body>
    <hdi:CotizarAuto>
      <hdi:usuario>${config.usuario}</hdi:usuario>
      <hdi:password>${config.password}</hdi:password>
      <hdi:oficina>${config.oficina}</hdi:oficina>
      <hdi:marca>${vehicle.marca}</hdi:marca>
      <hdi:anio>${vehicle.anio}</hdi:anio>
      <hdi:modelo>${vehicle.modelo}</hdi:modelo>
      <hdi:version>${vehicle.version}</hdi:version>
      <hdi:valorVehiculo>${vehicle.valorReferencia}</hdi:valorVehiculo>
      <hdi:codigoPostal>${cp}</hdi:codigoPostal>
      <hdi:edadConductor>${edad}</hdi:edadConductor>
      <hdi:paquete>${vehicle.paquete}</hdi:paquete>
    </hdi:CotizarAuto>
  </soap:Body>
</soap:Envelope>`;
}

function buildZurichSoap(config: Record<string, string>, vehicle: VehicleRequest, edad: number, cp: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:zur="http://zurich.com.mx/ws/autos/">
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
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:chb="http://chubb.com.mx/ws/autos/">
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

async function callSoapInsurer(endpoint: string, soapBody: string, soapAction: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": soapAction,
      },
      body: soapBody,
      signal: controller.signal,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function callRestInsurer(endpoint: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
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
}> {
  const config = insurer.configuracion || {};
  const endpoint = insurer.endpoint_url || config.api_url || "";
  const startTime = Date.now();

  if (!endpoint) {
    return {
      aseguradora: insurer.nombre,
      color: insurer.color || "#666",
      primaNeta: null,
      derechoPoliza: null,
      iva: null,
      primaTotal: null,
      disponible: false,
      modo: "sin_endpoint",
      error: "Endpoint no configurado",
      tiempoRespuesta: 0,
    };
  }

  try {
    let primaNeta: number | null = null;
    let derechoPoliza: number | null = null;
    let iva: number | null = null;
    let primaTotal: number | null = null;

    if (insurer.nombre === "Qualitas") {
      const soapBody = buildQualitasSoap(config, vehicle, edad, codigoPostal);
      const soapNs = config.soap_action_ns || "http://tempuri.org/WSQBC/QBCDE/";
      const xml = await callSoapInsurer(endpoint, soapBody, `${soapNs}obtenerNuevaEmision`);
      primaNeta = extractPrimaNeta(xml);
      derechoPoliza = extractDerechoPoliza(xml) || Number(insurer.derecho_poliza);
      iva = extractIva(xml);
      primaTotal = extractPrimaTotal(xml);
    } else if (insurer.nombre === "GNP") {
      const payload = {
        usuario: config.usuario,
        unidadOperable: config.unidad_operable,
        intermediario: config.intermediario,
        oficina: config.oficina,
        vehiculo: { marca: vehicle.marca, anio: vehicle.anio, modelo: vehicle.modelo, version: vehicle.version, valorVehiculo: vehicle.valorReferencia },
        conductor: { edad, codigoPostal },
        paquete: vehicle.paquete,
        formaPago,
      };
      const data = await callRestInsurer(endpoint, payload);
      primaNeta = (data.primaNeta || data.prima_neta || (data as Record<string, Record<string, number>>).resultado?.primaNeta || null) as number | null;
      derechoPoliza = (data.derechoPoliza || data.derecho_poliza || Number(insurer.derecho_poliza)) as number;
      primaTotal = (data.primaTotal || data.prima_total || (data as Record<string, Record<string, number>>).resultado?.primaTotal || null) as number | null;
    } else if (insurer.nombre === "ANA Seguros") {
      const soapBody = buildAnaSoap(config, vehicle, edad, codigoPostal);
      const xml = await callSoapInsurer(endpoint, soapBody, "http://anaseguros.com.mx/ws/CotizaSencilla");
      primaNeta = extractPrimaNeta(xml);
      derechoPoliza = extractDerechoPoliza(xml) || Number(insurer.derecho_poliza);
      iva = extractIva(xml);
      primaTotal = extractPrimaTotal(xml);
    } else if (insurer.nombre === "HDI Seguros") {
      const soapBody = buildHdiSoap(config, vehicle, edad, codigoPostal);
      const xml = await callSoapInsurer(endpoint, soapBody, "http://hdi.com.mx/autos/ws/CotizarAuto");
      primaNeta = extractPrimaNeta(xml);
      derechoPoliza = extractDerechoPoliza(xml) || Number(insurer.derecho_poliza);
      iva = extractIva(xml);
      primaTotal = extractPrimaTotal(xml);
    } else if (insurer.nombre === "Zurich") {
      const soapBody = buildZurichSoap(config, vehicle, edad, codigoPostal);
      const xml = await callSoapInsurer(endpoint, soapBody, "http://zurich.com.mx/ws/autos/CotizarAuto");
      primaNeta = extractPrimaNeta(xml);
      derechoPoliza = extractDerechoPoliza(xml) || Number(insurer.derecho_poliza);
      iva = extractIva(xml);
      primaTotal = extractPrimaTotal(xml);
    } else if (insurer.nombre === "Chubb") {
      const soapBody = buildChubbSoap(config, vehicle, edad, codigoPostal);
      const xml = await callSoapInsurer(endpoint, soapBody, "http://chubb.com.mx/ws/autos/CotizarVehiculo");
      primaNeta = extractPrimaNeta(xml);
      derechoPoliza = extractDerechoPoliza(xml) || Number(insurer.derecho_poliza);
      iva = extractIva(xml);
      primaTotal = extractPrimaTotal(xml);
    } else if (insurer.nombre === "Potosi") {
      const payload = {
        usuario: config.usuario,
        vehiculo: { marca: vehicle.marca, anio: vehicle.anio, modelo: vehicle.modelo, version: vehicle.version, valorVehiculo: vehicle.valorReferencia },
        conductor: { edad, codigoPostal },
        paquete: vehicle.paquete,
        formaPago,
      };
      const data = await callRestInsurer(endpoint, payload);
      primaNeta = (data.primaNeta || data.prima_neta || null) as number | null;
      derechoPoliza = (data.derechoPoliza || data.derecho_poliza || Number(insurer.derecho_poliza)) as number;
      primaTotal = (data.primaTotal || data.prima_total || null) as number | null;
    }

    // If we got primaNeta but no primaTotal, calculate it (standard MX formula)
    if (primaNeta && !primaTotal) {
      const dp = derechoPoliza || Number(insurer.derecho_poliza);
      const subtotal = primaNeta + dp;
      const calculatedIva = Math.round(subtotal * IVA_RATE * 100) / 100;
      primaTotal = Math.round((subtotal + calculatedIva) * 100) / 100;
      iva = calculatedIva;
      derechoPoliza = dp;
    }

    const elapsed = Date.now() - startTime;

    if (!primaNeta || primaNeta <= 0) {
      return {
        aseguradora: insurer.nombre,
        color: insurer.color || "#666",
        primaNeta: null,
        derechoPoliza: null,
        iva: null,
        primaTotal: null,
        disponible: false,
        modo: "ws_sin_respuesta",
        error: "El web service no devolvio datos de cotizacion",
        tiempoRespuesta: elapsed,
      };
    }

    return {
      aseguradora: insurer.nombre,
      color: insurer.color || "#666",
      primaNeta,
      derechoPoliza: derechoPoliza || Number(insurer.derecho_poliza),
      iva: iva || Math.round((primaNeta + (derechoPoliza || 0)) * IVA_RATE * 100) / 100,
      primaTotal,
      disponible: true,
      modo: "web_service",
      error: null,
      tiempoRespuesta: elapsed,
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const errorMsg = (err as Error).message;
    const isTimeout = errorMsg.includes("abort") || errorMsg.includes("timeout");
    return {
      aseguradora: insurer.nombre,
      color: insurer.color || "#666",
      primaNeta: null,
      derechoPoliza: null,
      iva: null,
      primaTotal: null,
      disponible: false,
      modo: isTimeout ? "timeout" : "error_ws",
      error: isTimeout ? "Tiempo de espera agotado (15s)" : errorMsg.substring(0, 200),
      tiempoRespuesta: elapsed,
    };
  }
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

    // Call all insurer WS in parallel for each vehicle
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

    // Volume discount
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
