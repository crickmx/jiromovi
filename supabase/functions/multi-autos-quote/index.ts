import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const IVA_RATE = 0.16;

const PAYMENT_SURCHARGES: Record<string, Record<string, number>> = {
  Qualitas: { Anual: 0, Semestral: 0.05, Trimestral: 0.08, Mensual: 0.12 },
  GNP: { Anual: 0, Semestral: 0.04, Trimestral: 0.07, Mensual: 0.10 },
  "ANA Seguros": { Anual: 0, Semestral: 0.06, Trimestral: 0.09, Mensual: 0.13 },
  "HDI Seguros": { Anual: 0, Semestral: 0.05, Trimestral: 0.08, Mensual: 0.11 },
  Zurich: { Anual: 0, Semestral: 0.04, Trimestral: 0.07, Mensual: 0.10 },
  Chubb: { Anual: 0, Semestral: 0.05, Trimestral: 0.09, Mensual: 0.14 },
  Potosi: { Anual: 0, Semestral: 0.06, Trimestral: 0.10, Mensual: 0.15 },
};

interface InsurerRow {
  nombre: string;
  derecho_poliza: number;
  factor_base: number;
  tipo_api: string;
  endpoint_url: string | null;
  configuracion: Record<string, string>;
  disponible: boolean;
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

// --- SOAP builders for each insurer ---

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

// --- Parsers ---

function extractPrimaNeta(xml: string): number | null {
  const patterns = [
    /<(?:\w+:)?PrimaNeta[^>]*>([^<]+)/i,
    /<(?:\w+:)?primaNeta[^>]*>([^<]+)/i,
    /<(?:\w+:)?prima_neta[^>]*>([^<]+)/i,
    /<(?:\w+:)?MontoTotal[^>]*>([^<]+)/i,
    /<(?:\w+:)?TotalPrima[^>]*>([^<]+)/i,
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

// --- Real API callers ---

async function callSoapInsurer(
  endpoint: string,
  soapBody: string,
  soapAction: string
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": soapAction,
    },
    body: soapBody,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`SOAP ${response.status}: ${errText.substring(0, 300)}`);
  }
  return await response.text();
}

async function callGnpRest(
  config: Record<string, string>,
  vehicle: VehicleRequest,
  edad: number,
  cp: string
): Promise<{ primaNeta: number; derechoPoliza: number }> {
  const endpoint = config.api_url;
  const payload = {
    usuario: config.usuario,
    unidadOperable: config.unidad_operable,
    intermediario: config.intermediario,
    oficina: config.oficina,
    vehiculo: {
      marca: vehicle.marca,
      anio: vehicle.anio,
      modelo: vehicle.modelo,
      version: vehicle.version,
      valorVehiculo: vehicle.valorReferencia,
    },
    conductor: { edad, codigoPostal: cp },
    paquete: vehicle.paquete,
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`GNP REST ${response.status}: ${(await response.text()).substring(0, 300)}`);
  }
  const data = await response.json();
  return {
    primaNeta: data.primaNeta || data.prima_neta || data.resultado?.primaNeta || 0,
    derechoPoliza: data.derechoPoliza || data.derecho_poliza || 720,
  };
}

async function callPotosiRest(
  config: Record<string, string>,
  vehicle: VehicleRequest,
  edad: number,
  cp: string
): Promise<{ primaNeta: number; derechoPoliza: number }> {
  const endpoint = config.api_url;
  const payload = {
    usuario: config.usuario,
    vehiculo: {
      marca: vehicle.marca,
      anio: vehicle.anio,
      modelo: vehicle.modelo,
      version: vehicle.version,
      valorVehiculo: vehicle.valorReferencia,
    },
    conductor: { edad, codigoPostal: cp },
    paquete: vehicle.paquete,
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Potosi REST ${response.status}: ${(await response.text()).substring(0, 300)}`);
  }
  const data = await response.json();
  return {
    primaNeta: data.primaNeta || data.prima_neta || 0,
    derechoPoliza: data.derechoPoliza || data.derecho_poliza || 850,
  };
}

// --- Fallback local calculation ---

const PACKAGE_RATES: Record<string, number> = {
  Amplia: 0.0245,
  Limitada: 0.0155,
  RC: 0.0072,
};

function getDriverFactor(edad: number, genero: string): number {
  let factor = 1.0;
  if (edad < 25) factor = 1.18;
  else if (edad < 30) factor = 1.05;
  else if (edad > 60) factor = 1.03;
  else if (edad > 45) factor = 0.95;
  if (genero === "Femenino") factor *= 0.97;
  return factor;
}

function getVehicleAgeFactor(anio: number): number {
  const age = new Date().getFullYear() - anio;
  if (age <= 0) return 1.0;
  if (age <= 2) return 1.0 + age * 0.01;
  if (age <= 5) return 1.02 + (age - 2) * 0.015;
  return 1.065 + (age - 5) * 0.02;
}

function getZoneRiskFactor(cp: string): number {
  const prefix = parseInt(cp.slice(0, 2)) || 0;
  if (prefix >= 1 && prefix <= 16) return 1.12;
  if (prefix >= 44 && prefix <= 45) return 1.08;
  if (prefix >= 64 && prefix <= 67) return 1.06;
  return 1.0;
}

function calculateFallback(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  edad: number,
  genero: string,
  codigoPostal: string
): { primaNeta: number; derechoPoliza: number } {
  const valor = vehicle.valorReferencia;
  const packageRate = PACKAGE_RATES[vehicle.paquete] || 0.0245;
  const driverFactor = getDriverFactor(edad, genero);
  const vehicleAgeFactor = getVehicleAgeFactor(vehicle.anio);
  const zoneFactor = getZoneRiskFactor(codigoPostal);

  let primaNeta = valor * packageRate * insurer.factor_base * driverFactor * vehicleAgeFactor * zoneFactor;

  if (vehicle.coberturas?.gastosMedicos) primaNeta += 850;
  if (vehicle.coberturas?.asistenciaVial) primaNeta += 520;
  if (vehicle.coberturas?.autoSustituto) primaNeta += 1350;
  if (vehicle.coberturas?.defensa_legal) primaNeta += 680;

  return { primaNeta: Math.round(primaNeta), derechoPoliza: Number(insurer.derecho_poliza) };
}

// --- Main quote engine ---

async function quoteInsurer(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  formaPago: string,
  edad: number,
  genero: string,
  codigoPostal: string
) {
  const config = insurer.configuracion || {};
  const endpoint = insurer.endpoint_url || config.api_url || config.wsdl_url || "";
  let primaNeta = 0;
  let derechoPoliza = Number(insurer.derecho_poliza);
  let modo = "simulado";

  if (endpoint) {
    try {
      if (insurer.nombre === "Qualitas") {
        const soapBody = buildQualitasSoap(config, vehicle, edad, codigoPostal);
        const soapNs = config.soap_action_ns || "http://tempuri.org/WSQBC/QBCDE/";
        const xml = await callSoapInsurer(endpoint, soapBody, `${soapNs}obtenerNuevaEmision`);
        const extractedPrima = extractPrimaNeta(xml);
        const extractedDerecho = extractDerechoPoliza(xml);
        if (extractedPrima) {
          primaNeta = extractedPrima;
          if (extractedDerecho) derechoPoliza = extractedDerecho;
          modo = "web_service";
        }
      } else if (insurer.nombre === "GNP") {
        const result = await callGnpRest(config, vehicle, edad, codigoPostal);
        if (result.primaNeta > 0) {
          primaNeta = result.primaNeta;
          derechoPoliza = result.derechoPoliza;
          modo = "web_service";
        }
      } else if (insurer.nombre === "ANA Seguros") {
        const soapBody = buildAnaSoap(config, vehicle, edad, codigoPostal);
        const xml = await callSoapInsurer(endpoint, soapBody, "http://anaseguros.com.mx/ws/CotizaSencilla");
        const extractedPrima = extractPrimaNeta(xml);
        const extractedDerecho = extractDerechoPoliza(xml);
        if (extractedPrima) {
          primaNeta = extractedPrima;
          if (extractedDerecho) derechoPoliza = extractedDerecho;
          modo = "web_service";
        }
      } else if (insurer.nombre === "HDI Seguros") {
        const soapBody = buildHdiSoap(config, vehicle, edad, codigoPostal);
        const xml = await callSoapInsurer(endpoint, soapBody, "http://hdi.com.mx/autos/ws/CotizarAuto");
        const extractedPrima = extractPrimaNeta(xml);
        const extractedDerecho = extractDerechoPoliza(xml);
        if (extractedPrima) {
          primaNeta = extractedPrima;
          if (extractedDerecho) derechoPoliza = extractedDerecho;
          modo = "web_service";
        }
      } else if (insurer.nombre === "Zurich") {
        const soapBody = buildZurichSoap(config, vehicle, edad, codigoPostal);
        const xml = await callSoapInsurer(endpoint, soapBody, "http://zurich.com.mx/ws/autos/CotizarAuto");
        const extractedPrima = extractPrimaNeta(xml);
        const extractedDerecho = extractDerechoPoliza(xml);
        if (extractedPrima) {
          primaNeta = extractedPrima;
          if (extractedDerecho) derechoPoliza = extractedDerecho;
          modo = "web_service";
        }
      } else if (insurer.nombre === "Chubb") {
        const soapBody = buildChubbSoap(config, vehicle, edad, codigoPostal);
        const xml = await callSoapInsurer(endpoint, soapBody, "http://chubb.com.mx/ws/autos/CotizarVehiculo");
        const extractedPrima = extractPrimaNeta(xml);
        const extractedDerecho = extractDerechoPoliza(xml);
        if (extractedPrima) {
          primaNeta = extractedPrima;
          if (extractedDerecho) derechoPoliza = extractedDerecho;
          modo = "web_service";
        }
      } else if (insurer.nombre === "Potosi") {
        const result = await callPotosiRest(config, vehicle, edad, codigoPostal);
        if (result.primaNeta > 0) {
          primaNeta = result.primaNeta;
          derechoPoliza = result.derechoPoliza;
          modo = "web_service";
        }
      }
    } catch (wsErr) {
      console.error(`[${insurer.nombre}] WS error, using fallback:`, (wsErr as Error).message);
      modo = "fallback";
    }
  }

  // Fallback calculation if WS did not return a valid prima
  if (primaNeta <= 0) {
    const fallback = calculateFallback(insurer, vehicle, edad, genero, codigoPostal);
    primaNeta = fallback.primaNeta;
    derechoPoliza = fallback.derechoPoliza;
    if (modo !== "fallback") modo = "simulado";
  }

  const subtotal = primaNeta + derechoPoliza;
  const iva = Math.round(subtotal * IVA_RATE * 100) / 100;
  const primaTotal = Math.round((subtotal + iva) * 100) / 100;

  const surchargeRate = PAYMENT_SURCHARGES[insurer.nombre]?.[formaPago] ?? 0;
  const recargoFraccionamiento = Math.round(primaNeta * surchargeRate * 100) / 100;
  const primaTotalConRecargo = Math.round((primaTotal + recargoFraccionamiento + recargoFraccionamiento * IVA_RATE) * 100) / 100;

  return {
    aseguradora: insurer.nombre,
    primaNeta,
    derechoPoliza,
    subtotal,
    iva,
    primaTotal,
    recargoFraccionamiento,
    primaTotalConRecargo,
    disponible: insurer.disponible,
    tipoApi: insurer.tipo_api,
    modo,
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
      .select("nombre, derecho_poliza, factor_base, tipo_api, endpoint_url, configuracion, disponible")
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
