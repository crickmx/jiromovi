import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const IVA_RATE = 0.16;

const PACKAGE_RATES: Record<string, number> = {
  Amplia: 0.0245,
  Limitada: 0.0155,
  RC: 0.0072,
};

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
  configuracion: Record<string, string>;
  disponible: boolean;
}

interface VehicleRequest {
  valorReferencia: number;
  anio: number;
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

function calculateForInsurer(
  insurer: InsurerRow,
  vehicle: VehicleRequest,
  formaPago: string,
  edad: number,
  genero: string,
  codigoPostal: string
) {
  const valor = vehicle.valorReferencia;
  const packageRate = PACKAGE_RATES[vehicle.paquete] || 0.0245;
  const driverFactor = getDriverFactor(edad, genero);
  const vehicleAgeFactor = getVehicleAgeFactor(vehicle.anio);
  const zoneFactor = getZoneRiskFactor(codigoPostal);

  let primaNeta = valor * packageRate * insurer.factor_base * driverFactor * vehicleAgeFactor * zoneFactor;

  if (vehicle.coberturas.gastosMedicos) primaNeta += 850;
  if (vehicle.coberturas.asistenciaVial) primaNeta += 520;
  if (vehicle.coberturas.autoSustituto) primaNeta += 1350;
  if (vehicle.coberturas.defensa_legal) primaNeta += 680;

  const variance = 0.97 + Math.random() * 0.06;
  primaNeta = Math.round(primaNeta * variance);

  const derechoPoliza = Number(insurer.derecho_poliza);
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
    modo: "simulado",
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

    // Fetch insurer configs from database
    const { data: insurers, error: dbError } = await supabase
      .from("multi_autos_aseguradoras")
      .select("nombre, derecho_poliza, factor_base, tipo_api, configuracion, disponible")
      .eq("disponible", true);

    if (dbError || !insurers?.length) {
      return new Response(JSON.stringify({ error: "No insurers configured", detail: dbError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate quotes for each vehicle across all insurers
    const results = vehiculos.map((vehicle, vIdx) => {
      const vehicleResults = insurers.map((insurer) => {
        try {
          return calculateForInsurer(insurer as InsurerRow, vehicle, formaPago, edad, genero, codigoPostal);
        } catch (e) {
          return {
            aseguradora: insurer.nombre,
            primaNeta: 0,
            disponible: false,
            error: (e as Error).message,
            modo: "error",
          };
        }
      });

      return {
        vehicleIndex: vIdx,
        quotes: vehicleResults,
      };
    });

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
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
