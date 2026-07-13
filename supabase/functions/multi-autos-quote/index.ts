import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const IVA_RATE = 0.16;
const WS_TIMEOUT_MS = 20000;

// ============================================================
// Types
// ============================================================

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

interface CatalogVehicle {
  id: string;
  marca: string;
  modelo: string;
  anio: number;
  version: string;
  descripcion_completa: string;
  clave_amis: string | null;
  valor_referencia: number;
  carroceria: string | null;
  metadata_aseguradoras: Record<string, string>;
}

interface VehicleRequest {
  valorReferencia: number;
  anio: number;
  marca: string;
  modelo: string;
  version: string;
  descripcionCompleta?: string;
  claveAmis?: string;
  paquete: string;
  coberturas: {
    deducibleDanosMateriales?: string;
    deducibleRoboTotal?: string;
    sumaAseguradaRC?: string;
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

interface QuoteResult {
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
  credentialStatus?: string;
  debug?: string;
}

// ============================================================
// Vehicle Catalog Lookup
// ============================================================

async function lookupVehicleInCatalog(
  supabase: ReturnType<typeof createClient>,
  vehicle: VehicleRequest
): Promise<CatalogVehicle | null> {
  // Try exact match first by descripcion_completa
  if (vehicle.descripcionCompleta) {
    const { data } = await supabase
      .from("multi_autos_catalogo_vehiculos")
      .select("*")
      .eq("descripcion_completa", vehicle.descripcionCompleta)
      .limit(1)
      .maybeSingle();
    if (data) return data as CatalogVehicle;
  }

  // Try by marca + modelo + anio + version
  const { data: exactMatch } = await supabase
    .from("multi_autos_catalogo_vehiculos")
    .select("*")
    .eq("marca", vehicle.marca.toUpperCase())
    .eq("modelo", vehicle.modelo.toUpperCase())
    .eq("anio", vehicle.anio)
    .eq("version", vehicle.version.toUpperCase())
    .limit(1)
    .maybeSingle();
  if (exactMatch) return exactMatch as CatalogVehicle;

  // Fuzzy: marca + modelo + anio (ignore version differences)
  const { data: fuzzyMatch } = await supabase
    .from("multi_autos_catalogo_vehiculos")
    .select("*")
    .eq("marca", vehicle.marca.toUpperCase())
    .eq("modelo", vehicle.modelo.toUpperCase())
    .eq("anio", vehicle.anio)
    .limit(1)
    .maybeSingle();
  if (fuzzyMatch) return fuzzyMatch as CatalogVehicle;

  return null;
}

// ============================================================
// Credential Resolution
// ============================================================

interface ResolvedCredentials {
  qualitas: { noNegocio: string; agente: string; tarifa: string };
  gnp: { usuario: string; password: string; unidadOperable: string; intermediario: string; oficina: string };
  ana: { usuario: string; clave: string; negocioRef: string };
  hdi: { usuario: string; password: string; oficina: string };
  zurich: { usuario: string; password: string; cveAgente: string; oficina: string; programaComercial: string };
  chubb: { agente: string; password: string; tarifa: string };
  potosi: { usuario: string; bearerToken: string };
}

function resolveCredentials(insurerConfigs: Record<string, Record<string, string>>): ResolvedCredentials {
  const qc = insurerConfigs["Qualitas"] || {};
  const gc = insurerConfigs["GNP"] || {};
  const ac = insurerConfigs["ANA Seguros"] || {};
  const hc = insurerConfigs["HDI Seguros"] || {};
  const zc = insurerConfigs["Zurich"] || {};
  const cc = insurerConfigs["Chubb"] || {};
  const pc = insurerConfigs["Potosi"] || {};

  return {
    qualitas: {
      noNegocio: Deno.env.get("QUALITAS_NO_NEGOCIO") || qc.no_negocio || "",
      agente: Deno.env.get("QUALITAS_AGENTE") || qc.agente || "",
      tarifa: Deno.env.get("QUALITAS_TARIFA") || qc.tarifa || "",
    },
    gnp: {
      usuario: Deno.env.get("GNP_USUARIO") || gc.usuario || "",
      password: Deno.env.get("GNP_PASSWORD") || gc.password || "",
      unidadOperable: Deno.env.get("GNP_UNIDAD_OPERABLE") || gc.unidad_operable || "",
      intermediario: Deno.env.get("GNP_INTERMEDIARIO") || gc.intermediario || "",
      oficina: Deno.env.get("GNP_OFICINA") || gc.oficina || "",
    },
    ana: {
      usuario: Deno.env.get("ANA_USUARIO") || ac.usuario || "",
      clave: Deno.env.get("ANA_CLAVE") || ac.password || ac.clave || "",
      negocioRef: Deno.env.get("ANA_NEGOCIO_REF") || ac.negocio_ref || "",
    },
    hdi: {
      usuario: Deno.env.get("HDI_USUARIO") || hc.usuario || "",
      password: Deno.env.get("HDI_PASSWORD") || hc.password || "",
      oficina: Deno.env.get("HDI_OFICINA") || hc.oficina || "",
    },
    zurich: {
      usuario: Deno.env.get("ZURICH_USUARIO") || zc.usuario || "",
      password: Deno.env.get("ZURICH_PASSWORD") || zc.password || "",
      cveAgente: Deno.env.get("ZURICH_CVE_AGENTE") || zc.cve_agente || "",
      oficina: Deno.env.get("ZURICH_OFICINA") || zc.oficina || "",
      programaComercial: Deno.env.get("ZURICH_PROGRAMA_COMERCIAL") || zc.programa_comercial || "",
    },
    chubb: {
      agente: Deno.env.get("CHUBB_AGENTE") || cc.agente || "",
      password: Deno.env.get("CHUBB_PASSWORD") || cc.password || "",
      tarifa: Deno.env.get("CHUBB_TARIFA") || cc.tarifa || "",
    },
    potosi: {
      usuario: Deno.env.get("POTOSI_USUARIO") || pc.usuario || "",
      bearerToken: Deno.env.get("POTOSI_BEARER_TOKEN") || pc.bearer_token || "",
    },
  };
}

function getCredentialStatus(insurerName: string, creds: ResolvedCredentials): string {
  switch (insurerName) {
    case "Qualitas":
      return creds.qualitas.noNegocio && creds.qualitas.agente ? "configured" : "missing";
    case "GNP":
      return creds.gnp.usuario && creds.gnp.password ? "configured" : "missing";
    case "ANA Seguros":
      return creds.ana.usuario && creds.ana.clave ? "configured" : "missing";
    case "HDI Seguros":
      return creds.hdi.usuario && creds.hdi.password ? "configured" : "missing";
    case "Zurich":
      return creds.zurich.usuario && creds.zurich.password ? "configured" : "missing";
    case "Chubb":
      return creds.chubb.agente ? "configured" : "missing";
    case "Potosi":
      return creds.potosi.usuario && creds.potosi.bearerToken ? "configured" : "missing";
    default:
      return "unknown";
  }
}

// ============================================================
// SOAP Envelope Builders (WSDL-compliant)
// ============================================================

function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildQualitasSoap(
  creds: ResolvedCredentials["qualitas"],
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  cp: string,
  paquete: string
): string {
  // Qualitas requires the AMIS code for proper vehicle identification
  const claveAmis = catalogVehicle?.clave_amis || vehicle.claveAmis || "";

  // Raiz real confirmada contra el WSDL de qa.qualitas.com.mx:
  // <Movimientos><Movimiento TipoMovimiento="2" NoNegocio="..."> (2 = cotizacion),
  // no <COTIZACION> como antes. El resto de <Movimiento> (Anexo 4 completo)
  // sigue siendo best-effort -- ver MULTIAUTOS_CONFIGURACION_ENV.md.
  const xmlContent = [
    "<Movimientos>",
    `<Movimiento TipoMovimiento="2" NoNegocio="${creds.noNegocio}">`,
    `<Agente>${creds.agente}</Agente>`,
    `<Tarifa>${creds.tarifa}</Tarifa>`,
    claveAmis ? `<ClaveAmis>${claveAmis}</ClaveAmis>` : "",
    `<Marca>${vehicle.marca}</Marca>`,
    `<Anio>${vehicle.anio}</Anio>`,
    `<Modelo>${vehicle.modelo}</Modelo>`,
    `<Version>${vehicle.version}</Version>`,
    `<ValorVehiculo>${vehicle.valorReferencia}</ValorVehiculo>`,
    `<CodigoPostal>${cp}</CodigoPostal>`,
    `<Paquete>${paquete === "Amplia" ? "1" : paquete === "Limitada" ? "2" : "3"}</Paquete>`,
    "<BonificacionTecnica>40</BonificacionTecnica>",
    "</Movimiento>",
    "</Movimientos>",
  ].join("");

  // xmlEmision es un string plano segun el WSDL real -- se escapa con
  // entidades en vez de envolver en CDATA.
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://qualitas.com.mx/">
  <soap:Body>
    <tns:obtenerNuevaEmision>
      <tns:xmlEmision>${escapeXml(xmlContent)}</tns:xmlEmision>
    </tns:obtenerNuevaEmision>
  </soap:Body>
</soap:Envelope>`;
}

function buildGnpXml(
  creds: ResolvedCredentials["gnp"],
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  edad: number,
  cp: string,
  formaPago: string
): string {
  // GNP no publica WSDL (es un WS REST que recibe XML plano, no JSON) --
  // schema tomado del Kit GNP - Multicotizador JIRO.xlsx.
  const meta = catalogVehicle?.metadata_aseguradoras || {};
  return [
    "<COTIZACION>",
    `<UNIDAD_OPERABLE>${creds.unidadOperable}</UNIDAD_OPERABLE>`,
    `<INTERMEDIARIO>${creds.intermediario}</INTERMEDIARIO>`,
    `<OFICINA>${creds.oficina}</OFICINA>`,
    "<VEHICULO>",
    `<MARCA>${meta.armadora_gnp || vehicle.marca}</MARCA>`,
    `<ANIO>${vehicle.anio}</ANIO>`,
    `<MODELO>${vehicle.modelo}</MODELO>`,
    `<VERSION>${meta.version_gnp || vehicle.version}</VERSION>`,
    `<CARROCERIA>${meta.carroceria_gnp || catalogVehicle?.carroceria || "SEDAN"}</CARROCERIA>`,
    `<VALOR_VEHICULO>${vehicle.valorReferencia}</VALOR_VEHICULO>`,
    "</VEHICULO>",
    "<CONDUCTOR>",
    `<EDAD>${edad}</EDAD>`,
    `<CODIGO_POSTAL>${cp}</CODIGO_POSTAL>`,
    "</CONDUCTOR>",
    `<PAQUETE>${vehicle.paquete}</PAQUETE>`,
    `<FORMA_PAGO>${formaPago}</FORMA_PAGO>`,
    "</COTIZACION>",
  ].join("");
}

function buildAnaSoap(
  creds: ResolvedCredentials["ana"],
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  edad: number,
  cp: string,
  paquete: string
): string {
  const meta = catalogVehicle?.metadata_aseguradoras || {};
  const claveAna = meta.clave_ana || catalogVehicle?.clave_amis || "";

  const cotizacionXml = [
    "<Cotizacion>",
    `<NegocioRef>${creds.negocioRef}</NegocioRef>`,
    claveAna ? `<ClaveVehiculo>${claveAna}</ClaveVehiculo>` : "",
    `<Marca>${vehicle.marca}</Marca>`,
    `<Anio>${vehicle.anio}</Anio>`,
    `<Modelo>${vehicle.modelo}</Modelo>`,
    `<Version>${vehicle.version}</Version>`,
    `<ValorVehiculo>${vehicle.valorReferencia}</ValorVehiculo>`,
    `<CodigoPostal>${cp}</CodigoPostal>`,
    `<EdadConductor>${edad}</EdadConductor>`,
    `<Paquete>${paquete}</Paquete>`,
    "</Cotizacion>",
  ].join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">
  <soap:Body>
    <tns:Transaccion>
      <tns:XML>${cotizacionXml}</tns:XML>
      <tns:Tipo>Cotizacion</tns:Tipo>
      <tns:Usuario>${creds.usuario}</tns:Usuario>
      <tns:Clave>${creds.clave}</tns:Clave>
    </tns:Transaccion>
  </soap:Body>
</soap:Envelope>`;
}

function buildHdiSoap(
  creds: ResolvedCredentials["hdi"],
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  edad: number,
  cp: string,
  paquete: string
): string {
  const meta = catalogVehicle?.metadata_aseguradoras || {};
  const claveHdi = meta.clave_hdi || "";

  // savequote no existe en el WSDL real de HDI (PublicServicesAutos.asmx) --
  // el metodo real es ObtenerMultiPaquetesExpress. idMarca/idModelo/
  // idTransmision/idZonaCirculacion/idTonelaje/idServicio/idRiesgoCarga son
  // catalogos internos de HDI (no el codigo AMIS) -- van en 0 como placeholder
  // hasta resolverlos via ObtenerMarcas/ObtenerModelos/ObtenerClaveVehiculo
  // del mismo WSDL (ver MULTIAUTOS_CONFIGURACION_ENV.md, pendiente #6).
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://hdi.com.mx/asmx/">
  <soap:Header>
    <tns:AuthenticateHeader>
      <tns:siteID>${creds.usuario}</tns:siteID>
      <tns:sitePwd>${creds.password}</tns:sitePwd>
    </tns:AuthenticateHeader>
  </soap:Header>
  <soap:Body>
    <tns:ObtenerMultiPaquetesExpress>
      <tns:request>
        <tns:datosCotizacion>
          <tns:CaracteristicasVehiculo>
            <tns:idVehiculo>${claveHdi || "0"}</tns:idVehiculo>
            <tns:idMarca>0</tns:idMarca>
            <tns:idModelo>0</tns:idModelo>
            <tns:idTransmision>0</tns:idTransmision>
            <tns:idZonaCirculacion>0</tns:idZonaCirculacion>
            <tns:idTonelaje>0</tns:idTonelaje>
            <tns:idServicio>0</tns:idServicio>
            <tns:idRiesgoCarga>0</tns:idRiesgoCarga>
            <tns:idUso>1</tns:idUso>
            <tns:tipoVehiculo>1</tns:tipoVehiculo>
            <tns:anioVehiculo>${vehicle.anio}</tns:anioVehiculo>
            <tns:pasajeros>5</tns:pasajeros>
            <tns:valorVehiculo>${vehicle.valorReferencia}</tns:valorVehiculo>
            <tns:claveAmis>${catalogVehicle?.clave_amis || ""}</tns:claveAmis>
            <tns:descripcion>${vehicle.marca} ${vehicle.modelo} ${vehicle.version}</tns:descripcion>
          </tns:CaracteristicasVehiculo>
          <tns:Cliente>
            <tns:Edad>${edad}</tns:Edad>
            <tns:CodigoPostal>${cp}</tns:CodigoPostal>
          </tns:Cliente>
          <tns:PaqueteCoberturas>
            <tns:Clave>${paquete === "Amplia" ? "1" : paquete === "Limitada" ? "2" : "3"}</tns:Clave>
          </tns:PaqueteCoberturas>
        </tns:datosCotizacion>
        <tns:usuario>${creds.usuario}</tns:usuario>
        <tns:oficina>${creds.oficina}</tns:oficina>
      </tns:request>
    </tns:ObtenerMultiPaquetesExpress>
  </soap:Body>
</soap:Envelope>`;
}

// DESACTIVADO: sin schema/endpoint real confirmado para Zurich (no hay WSDL
// ni doc de credenciales validado) -- disponible=false en la BD, este builder
// queda de referencia por si se retoma con documentacion real.
function buildZurichSoap(
  creds: ResolvedCredentials["zurich"],
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  edad: number,
  cp: string,
  paquete: string
): string {
  const meta = catalogVehicle?.metadata_aseguradoras || {};
  const claveZurich = meta.clave_zurich || catalogVehicle?.clave_amis || "";

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:zur="http://zurich.com.mx/ws/autos/">
  <soap:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${creds.usuario}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${creds.password}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <zur:CotizarAuto>
      <zur:usuario>${creds.usuario}</zur:usuario>
      <zur:cveAgente>${creds.cveAgente}</zur:cveAgente>
      <zur:oficina>${creds.oficina}</zur:oficina>
      <zur:programaComercial>${creds.programaComercial}</zur:programaComercial>
      ${claveZurich ? `<zur:claveVehiculo>${claveZurich}</zur:claveVehiculo>` : ""}
      <zur:marca>${vehicle.marca}</zur:marca>
      <zur:anio>${vehicle.anio}</zur:anio>
      <zur:modelo>${vehicle.modelo}</zur:modelo>
      <zur:version>${vehicle.version}</zur:version>
      <zur:valorVehiculo>${vehicle.valorReferencia}</zur:valorVehiculo>
      <zur:codigoPostal>${cp}</zur:codigoPostal>
      <zur:edadConductor>${edad}</zur:edadConductor>
      <zur:paquete>${paquete}</zur:paquete>
      <zur:descuento>10</zur:descuento>
    </zur:CotizarAuto>
  </soap:Body>
</soap:Envelope>`;
}

// DESACTIVADO: sin schema/endpoint real confirmado para Chubb -- ver nota de
// Zurich arriba, mismo motivo.
function buildChubbSoap(
  creds: ResolvedCredentials["chubb"],
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  edad: number,
  cp: string,
  paquete: string
): string {
  const meta = catalogVehicle?.metadata_aseguradoras || {};
  const claveChubb = meta.clave_chubb || catalogVehicle?.clave_amis || "";

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:chb="http://chubb.com.mx/ws/autos/">
  <soap:Body>
    <chb:CotizarVehiculo>
      <chb:agente>${creds.agente}</chb:agente>
      <chb:tarifa>${creds.tarifa}</chb:tarifa>
      ${claveChubb ? `<chb:claveVehiculo>${claveChubb}</chb:claveVehiculo>` : ""}
      <chb:marca>${vehicle.marca}</chb:marca>
      <chb:anio>${vehicle.anio}</chb:anio>
      <chb:modelo>${vehicle.modelo}</chb:modelo>
      <chb:version>${vehicle.version}</chb:version>
      <chb:valorVehiculo>${vehicle.valorReferencia}</chb:valorVehiculo>
      <chb:codigoPostal>${cp}</chb:codigoPostal>
      <chb:edadConductor>${edad}</chb:edadConductor>
      <chb:paquete>${paquete}</chb:paquete>
    </chb:CotizarVehiculo>
  </soap:Body>
</soap:Envelope>`;
}

// DESACTIVADO: sin schema/endpoint real confirmado para Potosi -- ver nota de
// Zurich arriba, mismo motivo.
function buildPotosiPayload(
  creds: ResolvedCredentials["potosi"],
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  edad: number,
  cp: string,
  formaPago: string
): Record<string, unknown> {
  return {
    usuario: creds.usuario,
    claveAmis: catalogVehicle?.clave_amis || "",
    vehiculo: {
      marca: vehicle.marca,
      anio: vehicle.anio,
      modelo: vehicle.modelo,
      version: vehicle.version,
      valorVehiculo: vehicle.valorReferencia,
    },
    conductor: { edad, codigoPostal: cp },
    paquete: vehicle.paquete,
    formaPago,
  };
}

// ============================================================
// Response Parsing
// ============================================================

function extractSoapFault(xml: string): string | null {
  const faultMatch = xml.match(/<(?:\w+:)?faultstring[^>]*>([^<]+)/i);
  if (faultMatch) return faultMatch[1];
  const detailMatch = xml.match(/<(?:\w+:)?detail[^>]*>([^<]+)/i);
  if (detailMatch) return detailMatch[1];
  const descMatch = xml.match(/<(?:\w+:)?descripcion[^>]*>([^<]+)/i);
  if (descMatch) return descMatch[1];
  const msgMatch = xml.match(/<(?:\w+:)?Message[^>]*>([^<]+)/i);
  if (msgMatch) return msgMatch[1];
  return null;
}

function extractResultString(xml: string): string {
  const patterns = [
    /<(?:\w+:)?obtenerNuevaEmisionResult[^>]*>([\s\S]*?)<\/(?:\w+:)?obtenerNuevaEmisionResult>/i,
    /<(?:\w+:)?TransaccionResult[^>]*>([\s\S]*?)<\/(?:\w+:)?TransaccionResult>/i,
    /<(?:\w+:)?ObtenerMultiPaquetesExpressResult[^>]*>([\s\S]*?)<\/(?:\w+:)?ObtenerMultiPaquetesExpressResult>/i,
    /<(?:\w+:)?CotizarAutoResult[^>]*>([\s\S]*?)<\/(?:\w+:)?CotizarAutoResult>/i,
    /<(?:\w+:)?CotizarVehiculoResult[^>]*>([\s\S]*?)<\/(?:\w+:)?CotizarVehiculoResult>/i,
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

function extractNumericValue(xml: string, fieldNames: string[]): number | null {
  for (const name of fieldNames) {
    const pattern = new RegExp(`<(?:\\w+:)?${name}[^>]*>([^<]+)`, "i");
    const match = xml.match(pattern);
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function extractPrimaNeta(xml: string): number | null {
  return extractNumericValue(xml, [
    "PrimaNeta", "primaNeta", "prima_neta", "ImportePrimaNeta",
    "PrimaNetaAnual", "NetPremium", "MontoNetoPrima",
  ]);
}

function extractDerechoPoliza(xml: string): number | null {
  return extractNumericValue(xml, [
    "DerechoPoliza", "derecho_poliza", "GastosExpedicion",
    "DerechoDePoliza", "PolicyFee", "GastoExpedicion",
  ]);
}

function extractIva(xml: string): number | null {
  return extractNumericValue(xml, [
    "IVA", "Iva", "ImporteIVA", "MontoIVA", "Tax",
  ]);
}

function extractPrimaTotal(xml: string): number | null {
  return extractNumericValue(xml, [
    "PrimaTotal", "ImporteTotal", "TotalAPagar", "prima_total",
    "MontoTotal", "TotalPrima", "GrandTotal", "PrimaTotalAnual",
  ]);
}

// ============================================================
// HTTP Callers
// ============================================================

async function callSoapInsurer(
  endpoint: string,
  soapBody: string,
  soapAction: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WS_TIMEOUT_MS);
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
    const text = await response.text();
    if (!response.ok && !text.includes("Envelope")) {
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 300)}`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callXmlInsurer(
  endpoint: string,
  xmlBody: string,
  headers?: Record<string, string>
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WS_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", ...(headers || {}) },
      body: xmlBody,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
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
  headers?: Record<string, string>
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WS_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(headers || {}) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 300)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// Per-Insurer Quote Adapters
// ============================================================

async function quoteQualitas(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  creds: ResolvedCredentials,
  cp: string
): Promise<QuoteResult> {
  const startTime = Date.now();
  const endpoint = insurer.endpoint_url || "";
  const credStatus = getCredentialStatus("Qualitas", creds);

  if (!creds.qualitas.noNegocio || !creds.qualitas.agente) {
    return makeError(insurer, startTime, "Credenciales no configuradas (QUALITAS_NO_NEGOCIO, QUALITAS_AGENTE)", credStatus);
  }

  if (!catalogVehicle?.clave_amis && !vehicle.claveAmis) {
    return makeError(insurer, startTime, `Vehiculo sin clave AMIS: ${vehicle.marca} ${vehicle.modelo} ${vehicle.anio} ${vehicle.version}. Registre la clave AMIS en el catalogo.`, credStatus);
  }

  try {
    const soapBody = buildQualitasSoap(creds.qualitas, vehicle, catalogVehicle, cp, vehicle.paquete);
    const xml = await callSoapInsurer(endpoint, soapBody, "http://qualitas.com.mx/obtenerNuevaEmision");
    const fault = extractSoapFault(xml);
    if (fault) {
      const isCredIssue = fault.toLowerCase().includes("credencial") || fault.toLowerCase().includes("autenticacion");
      return makeError(insurer, startTime, `Qualitas: ${fault}`, isCredIssue ? "invalid" : credStatus);
    }
    const innerXml = extractResultString(xml);
    return parseQuoteResponse(insurer, innerXml, startTime, credStatus);
  } catch (err) {
    return makeError(insurer, startTime, `${(err as Error).message}`, credStatus);
  }
}

async function quoteGnp(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  creds: ResolvedCredentials,
  edad: number,
  cp: string,
  formaPago: string
): Promise<QuoteResult> {
  const startTime = Date.now();
  const endpoint = insurer.endpoint_url || "";
  const credStatus = getCredentialStatus("GNP", creds);

  if (!creds.gnp.usuario || !creds.gnp.password) {
    return makeError(insurer, startTime, "Credenciales no configuradas (GNP_USUARIO, GNP_PASSWORD). Configure las variables de entorno.", credStatus);
  }

  try {
    const xmlBody = buildGnpXml(creds.gnp, vehicle, catalogVehicle, edad, cp, formaPago);
    const authHeader = { "Authorization": `Basic ${btoa(`${creds.gnp.usuario}:${creds.gnp.password}`)}` };
    const xml = await callXmlInsurer(endpoint, xmlBody, authHeader);
    const fault = extractSoapFault(xml);
    if (fault) {
      return makeError(insurer, startTime, `GNP: ${fault}`, credStatus);
    }
    return parseQuoteResponse(insurer, xml, startTime, credStatus);
  } catch (err) {
    const msg = (err as Error).message;
    const isCredIssue = msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("unauthorized");
    return makeError(insurer, startTime, msg, isCredIssue ? "invalid" : credStatus);
  }
}

async function quoteAna(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  creds: ResolvedCredentials,
  edad: number,
  cp: string
): Promise<QuoteResult> {
  const startTime = Date.now();
  const endpoint = insurer.endpoint_url || "";
  const credStatus = getCredentialStatus("ANA Seguros", creds);

  if (!creds.ana.usuario || !creds.ana.clave) {
    return makeError(insurer, startTime, "Credenciales no configuradas (ANA_USUARIO, ANA_CLAVE). Configure las variables de entorno.", credStatus);
  }

  try {
    const soapBody = buildAnaSoap(creds.ana, vehicle, catalogVehicle, edad, cp, vehicle.paquete);
    const xml = await callSoapInsurer(endpoint, soapBody, "http://tempuri.org/Transaccion");
    const fault = extractSoapFault(xml);
    if (fault) {
      return makeError(insurer, startTime, `ANA: ${fault}`, credStatus);
    }
    const innerXml = extractResultString(xml);
    if (!innerXml || innerXml.trim().length < 10) {
      return makeError(insurer, startTime, "ANA: Respuesta vacia - verifique credenciales (ANA_CLAVE)", "invalid");
    }
    return parseQuoteResponse(insurer, innerXml, startTime, credStatus);
  } catch (err) {
    return makeError(insurer, startTime, `${(err as Error).message}`, credStatus);
  }
}

async function quoteHdi(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  creds: ResolvedCredentials,
  edad: number,
  cp: string
): Promise<QuoteResult> {
  const startTime = Date.now();
  const endpoint = insurer.endpoint_url || "";
  const credStatus = getCredentialStatus("HDI Seguros", creds);

  if (!creds.hdi.usuario || !creds.hdi.password) {
    return makeError(insurer, startTime, "Credenciales no configuradas (HDI_USUARIO, HDI_PASSWORD). Configure las variables de entorno.", credStatus);
  }

  try {
    const soapBody = buildHdiSoap(creds.hdi, vehicle, catalogVehicle, edad, cp, vehicle.paquete);
    const xml = await callSoapInsurer(endpoint, soapBody, "http://hdi.com.mx/asmx/ObtenerMultiPaquetesExpress");

    const credError = xml.match(/credenciales?\s+no\s+son\s+v[aá]lidas/i);
    if (credError) {
      return makeError(insurer, startTime, "HDI: Credenciales no son validas - requiere renovacion (HDI_USUARIO/HDI_PASSWORD)", "expired");
    }

    const fault = extractSoapFault(xml);
    if (fault) {
      return makeError(insurer, startTime, `HDI: ${fault}`, credStatus);
    }

    return parseQuoteResponse(insurer, xml, startTime, credStatus);
  } catch (err) {
    return makeError(insurer, startTime, `${(err as Error).message}`, credStatus);
  }
}

async function quoteZurich(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  creds: ResolvedCredentials,
  edad: number,
  cp: string
): Promise<QuoteResult> {
  const startTime = Date.now();
  const endpoint = insurer.endpoint_url || "";
  const credStatus = getCredentialStatus("Zurich", creds);

  if (!creds.zurich.usuario || !creds.zurich.password) {
    return makeError(insurer, startTime, "Credenciales no configuradas (ZURICH_USUARIO, ZURICH_PASSWORD). Configure las variables de entorno.", credStatus);
  }

  try {
    const soapBody = buildZurichSoap(creds.zurich, vehicle, catalogVehicle, edad, cp, vehicle.paquete);
    const xml = await callSoapInsurer(endpoint, soapBody, "http://zurich.com.mx/ws/autos/CotizarAuto");
    const fault = extractSoapFault(xml);
    if (fault) return makeError(insurer, startTime, `Zurich: ${fault}`, credStatus);
    return parseQuoteResponse(insurer, xml, startTime, credStatus);
  } catch (err) {
    const msg = (err as Error).message;
    const isDns = msg.includes("dns") || msg.includes("ENOTFOUND") || msg.includes("resolve");
    return makeError(insurer, startTime, isDns ? "Zurich: Endpoint no alcanzable (DNS). Requiere endpoint alternativo o VPN." : msg, isDns ? "configured" : credStatus);
  }
}

async function quoteChubb(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  creds: ResolvedCredentials,
  edad: number,
  cp: string
): Promise<QuoteResult> {
  const startTime = Date.now();
  const endpoint = insurer.endpoint_url || "";
  const credStatus = getCredentialStatus("Chubb", creds);

  if (!creds.chubb.agente) {
    return makeError(insurer, startTime, "Credenciales no configuradas (CHUBB_AGENTE). Configure las variables de entorno.", credStatus);
  }

  try {
    const soapBody = buildChubbSoap(creds.chubb, vehicle, catalogVehicle, edad, cp, vehicle.paquete);
    const xml = await callSoapInsurer(endpoint, soapBody, "http://chubb.com.mx/ws/autos/CotizarVehiculo");
    const fault = extractSoapFault(xml);
    if (fault) return makeError(insurer, startTime, `Chubb: ${fault}`, credStatus);
    return parseQuoteResponse(insurer, xml, startTime, credStatus);
  } catch (err) {
    const msg = (err as Error).message;
    const isDns = msg.includes("dns") || msg.includes("ENOTFOUND") || msg.includes("resolve");
    return makeError(insurer, startTime, isDns ? "Chubb: Endpoint no alcanzable (DNS). Requiere endpoint alternativo o VPN." : msg, isDns ? "configured" : credStatus);
  }
}

async function quotePotosi(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  creds: ResolvedCredentials,
  edad: number,
  cp: string,
  formaPago: string
): Promise<QuoteResult> {
  const startTime = Date.now();
  const endpoint = insurer.endpoint_url || "";
  const credStatus = getCredentialStatus("Potosi", creds);

  if (!creds.potosi.usuario || !creds.potosi.bearerToken) {
    return makeError(insurer, startTime, "Credenciales no configuradas (POTOSI_USUARIO, POTOSI_BEARER_TOKEN). Configure las variables de entorno.", credStatus);
  }

  try {
    const payload = buildPotosiPayload(creds.potosi, vehicle, catalogVehicle, edad, cp, formaPago);
    const headers = { "Authorization": `Bearer ${creds.potosi.bearerToken}` };
    const data = await callRestInsurer(endpoint, payload, headers);
    const primaNeta = (data.primaNeta || data.prima_neta || null) as number | null;
    const primaTotal = (data.primaTotal || data.prima_total || null) as number | null;
    const derechoPoliza = (data.derechoPoliza || data.derecho_poliza || Number(insurer.derecho_poliza)) as number;

    if (primaNeta && primaNeta > 0) {
      const dp = derechoPoliza || Number(insurer.derecho_poliza);
      const iva = Math.round((primaNeta + dp) * IVA_RATE * 100) / 100;
      const total = primaTotal || Math.round((primaNeta + dp + iva) * 100) / 100;
      return makeSuccess(insurer, startTime, primaNeta, dp, iva, total, credStatus);
    }

    return makeError(insurer, startTime, `Potosi: Sin datos de prima`, credStatus);
  } catch (err) {
    const msg = (err as Error).message;
    const isDns = msg.includes("dns") || msg.includes("ENOTFOUND") || msg.includes("resolve");
    return makeError(insurer, startTime, isDns ? "Potosi: Endpoint no alcanzable (DNS). Requiere endpoint alternativo o VPN." : msg, isDns ? "configured" : credStatus);
  }
}

// ============================================================
// Helpers
// ============================================================

function makeSuccess(
  insurer: InsurerRow,
  startTime: number,
  primaNeta: number,
  derechoPoliza: number,
  iva: number,
  primaTotal: number,
  credentialStatus: string
): QuoteResult {
  return {
    aseguradora: insurer.nombre,
    color: insurer.color || "#666",
    primaNeta,
    derechoPoliza,
    iva,
    primaTotal,
    disponible: true,
    modo: "web_service",
    error: null,
    tiempoRespuesta: Date.now() - startTime,
    credentialStatus,
  };
}

function makeError(
  insurer: InsurerRow,
  startTime: number,
  error: string,
  credentialStatus: string
): QuoteResult {
  return {
    aseguradora: insurer.nombre,
    color: insurer.color || "#666",
    primaNeta: null,
    derechoPoliza: null,
    iva: null,
    primaTotal: null,
    disponible: false,
    modo: "web_service",
    error,
    tiempoRespuesta: Date.now() - startTime,
    credentialStatus,
  };
}

function parseQuoteResponse(
  insurer: InsurerRow,
  xml: string,
  startTime: number,
  credentialStatus: string
): QuoteResult {
  const primaNeta = extractPrimaNeta(xml);
  const derechoPolizaFromXml = extractDerechoPoliza(xml);
  const ivaFromXml = extractIva(xml);
  const primaTotalFromXml = extractPrimaTotal(xml);

  if (primaNeta && primaNeta > 0) {
    const dp = derechoPolizaFromXml || Number(insurer.derecho_poliza);
    const subtotal = primaNeta + dp;
    const iva = ivaFromXml || Math.round(subtotal * IVA_RATE * 100) / 100;
    const primaTotal = primaTotalFromXml || Math.round((subtotal + iva) * 100) / 100;
    return makeSuccess(insurer, startTime, primaNeta, dp, iva, primaTotal, credentialStatus);
  }

  const fault = extractSoapFault(xml);
  return makeError(
    insurer,
    startTime,
    fault || `Sin datos de prima en respuesta del web service`,
    credentialStatus
  );
}

// ============================================================
// Main Router
// ============================================================

async function quoteInsurer(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  catalogVehicle: CatalogVehicle | null,
  creds: ResolvedCredentials,
  formaPago: string,
  edad: number,
  cp: string
): Promise<QuoteResult> {
  const endpoint = insurer.endpoint_url || insurer.configuracion?.api_url || "";
  if (!endpoint) {
    return makeError(insurer, Date.now(), "Endpoint no configurado", "unknown");
  }

  switch (insurer.nombre) {
    case "Qualitas":
      return quoteQualitas(insurer, vehicle, catalogVehicle, creds, cp);
    case "GNP":
      return quoteGnp(insurer, vehicle, catalogVehicle, creds, edad, cp, formaPago);
    case "ANA Seguros":
      return quoteAna(insurer, vehicle, catalogVehicle, creds, edad, cp);
    case "HDI Seguros":
      return quoteHdi(insurer, vehicle, catalogVehicle, creds, edad, cp);
    case "Zurich":
      return quoteZurich(insurer, vehicle, catalogVehicle, creds, edad, cp);
    case "Chubb":
      return quoteChubb(insurer, vehicle, catalogVehicle, creds, edad, cp);
    case "Potosi":
      return quotePotosi(insurer, vehicle, catalogVehicle, creds, edad, cp, formaPago);
    default:
      return makeError(insurer, Date.now(), `Adaptador no implementado para: ${insurer.nombre}`, "unknown");
  }
}

// ============================================================
// Status Update (async, non-blocking)
// ============================================================

async function updateInsurerStatus(
  supabase: ReturnType<typeof createClient>,
  results: QuoteResult[]
): Promise<void> {
  try {
    for (const r of results) {
      const isSuccess = r.disponible;
      const errorCategory = classifyErrorCategory(r);
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        latency_ms: r.tiempoRespuesta,
        error_category: errorCategory,
      };
      if (isSuccess) {
        updateData.last_success_at = new Date().toISOString();
        updateData.consecutive_failures = 0;
        updateData.credential_status = "valid";
        updateData.endpoint_reachable = true;
        updateData.last_error = null;
      } else {
        updateData.last_failure_at = new Date().toISOString();
        updateData.last_error = r.error?.substring(0, 500) || "Unknown error";
        if (r.credentialStatus === "expired" || r.credentialStatus === "invalid") {
          updateData.credential_status = r.credentialStatus;
        } else if (r.credentialStatus === "missing") {
          updateData.credential_status = "missing";
        }
        if (r.error?.includes("DNS") || r.error?.includes("alcanzable")) {
          updateData.endpoint_reachable = false;
        }
      }
      await supabase
        .from("multi_autos_insurer_status")
        .update(updateData)
        .eq("insurer_name", r.aseguradora);
    }
  } catch {
    // Non-blocking
  }
}

function classifyErrorCategory(r: QuoteResult): string {
  if (r.disponible) return "OK";
  const err = r.error || "";
  if (r.credentialStatus === "missing" || err.includes("no configuradas")) return "CREDENTIAL_ERROR";
  if (r.credentialStatus === "expired" || r.credentialStatus === "invalid" || err.includes("no son validas")) return "CREDENTIAL_ERROR";
  if (err.includes("DNS") || err.includes("alcanzable") || err.includes("ENOTFOUND")) return "DNS_UNREACHABLE";
  if (err.includes("AMIS") || err.includes("catalogo")) return "MISSING_AMIS";
  if (err.includes("SOAP Fault") || err.includes("faultstring")) return "SOAP_FAULT";
  if (err.includes("abort") || err.includes("timeout") || err.includes("Timeout")) return "TIMEOUT";
  return "UNKNOWN";
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: QuoteRequest = await req.json();
    const { vehiculos, formaPago, edad, genero: _genero, codigoPostal } = body;

    if (!vehiculos?.length) {
      return new Response(JSON.stringify({ error: "No vehicles provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load insurer configs
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

    // Build credential config map
    const configMap: Record<string, Record<string, string>> = {};
    for (const ins of insurers) {
      configMap[ins.nombre] = (ins as InsurerRow).configuracion || {};
    }
    const creds = resolveCredentials(configMap);

    // Process each vehicle
    const results = await Promise.all(
      vehiculos.map(async (vehicle, vIdx) => {
        // Catalog lookup for vehicle codes
        const catalogVehicle = await lookupVehicleInCatalog(supabase, vehicle);

        // Quote all insurers in parallel
        const vehicleResults = await Promise.all(
          insurers.map((insurer) =>
            quoteInsurer(insurer as InsurerRow, vehicle, catalogVehicle, creds, formaPago, edad, codigoPostal)
          )
        );

        // Update status asynchronously
        updateInsurerStatus(supabase, vehicleResults);

        return {
          vehicleIndex: vIdx,
          catalogMatch: catalogVehicle ? {
            id: catalogVehicle.id,
            claveAmis: catalogVehicle.clave_amis,
            descripcion: catalogVehicle.descripcion_completa,
          } : null,
          quotes: vehicleResults,
        };
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
