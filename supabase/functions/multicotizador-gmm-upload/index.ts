import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const product = formData.get("product") as string;
    const versionName = formData.get("version_name") as string;

    if (!file || !product || !versionName) {
      return new Response(JSON.stringify({ error: "Missing file, product, or version_name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["BNV", "BNP"].includes(product)) {
      return new Response(JSON.stringify({ error: "Product must be BNV or BNP" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Compute hash
    const hashBuffer = await crypto.subtle.digest("SHA-256", uint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sourceHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Check for duplicate
    const { data: existing } = await supabase
      .from("multicotizador_gmm_packages")
      .select("id")
      .eq("source_hash", sourceHash)
      .eq("product", product)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Este archivo ya fue cargado anteriormente", duplicate_id: existing[0].id }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse Excel
    const workbook = XLSX.read(uint8, { type: "array", bookVBA: true });
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      return new Response(JSON.stringify({ error: "El archivo no contiene hojas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse rates from all sheets
    const rates: Array<{ lookup_key: string; plan_name: string; region: string; age: number; rate: number; rate_type: string }> = [];
    const detectedSumas: Set<number> = new Set();
    const detectedDeducibles: Set<number> = new Set();
    const detectedCoaseguros: Set<number> = new Set();
    const detectedRegions: Set<string> = new Set();
    let derechoPoliza = 1600;
    let asistenciaExtranjero = 1632;
    let costoCatastrofica = 5800;

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

      if (jsonData.length < 2) continue;

      // Try to detect if this is a rate sheet by looking for age column
      const headers = jsonData[0] as any[];
      if (!headers) continue;

      // Try to find config values (derecho_poliza, asistencia, etc.)
      const lowerSheet = sheetName.toLowerCase();
      if (lowerSheet.includes("config") || lowerSheet.includes("param")) {
        for (const row of jsonData) {
          if (!Array.isArray(row)) continue;
          const label = String(row[0] || "").toLowerCase();
          const val = Number(row[1]);
          if (label.includes("derecho") && !isNaN(val)) derechoPoliza = val;
          if (label.includes("asistencia") && !isNaN(val)) asistenciaExtranjero = val;
          if (label.includes("catastro") && !isNaN(val)) costoCatastrofica = val;
        }
        continue;
      }

      // Parse rate tables - detect format
      // Format: First column = age, subsequent columns = rates for different plans/regions
      const ageColIdx = headers.findIndex((h: any) => {
        const s = String(h || "").toLowerCase();
        return s === "age" || s === "edad" || s === "edades";
      });

      if (ageColIdx === -1) {
        // Try alternate format: rows have lookup_key, region, age, rate columns
        const lookupIdx = headers.findIndex((h: any) => String(h || "").toLowerCase().includes("lookup"));
        const regionIdx = headers.findIndex((h: any) => String(h || "").toLowerCase().includes("region"));
        const ageIdx2 = headers.findIndex((h: any) => String(h || "").toLowerCase() === "age" || String(h || "").toLowerCase() === "edad");
        const rateIdx = headers.findIndex((h: any) => String(h || "").toLowerCase().includes("rate") || String(h || "").toLowerCase().includes("prima") || String(h || "").toLowerCase().includes("tarifa"));
        const typeIdx = headers.findIndex((h: any) => String(h || "").toLowerCase().includes("type") || String(h || "").toLowerCase().includes("sexo") || String(h || "").toLowerCase().includes("genero"));

        if (rateIdx !== -1) {
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row) continue;
            const age = Number(row[ageIdx2 !== -1 ? ageIdx2 : 0]);
            const rate = Number(row[rateIdx]);
            if (isNaN(age) || isNaN(rate) || rate <= 0) continue;

            const lookupKey = lookupIdx !== -1 ? String(row[lookupIdx] || "") : sheetName;
            const region = regionIdx !== -1 ? String(row[regionIdx] || "Mexico Region 1") : "Mexico Region 1";
            const rateType = typeIdx !== -1 ? (String(row[typeIdx] || "").toLowerCase().includes("fem") || String(row[typeIdx] || "").toLowerCase().includes("mujer") ? "Female" : "Male") : "Unisex";

            detectedRegions.add(region);

            rates.push({
              lookup_key: lookupKey,
              plan_name: lookupKey.replace(/Mexico Region \d.*$/, "").trim() || lookupKey,
              region,
              age,
              rate,
              rate_type: product === "BNP" ? rateType : "Unisex",
            });
          }
        }
        continue;
      }

      // Standard format: age in first col, plan codes as column headers
      for (let colIdx = 1; colIdx < headers.length; colIdx++) {
        const colHeader = String(headers[colIdx] || "");
        if (!colHeader) continue;

        // Try to detect region from sheet name or header
        let region = "Mexico Region 1";
        if (sheetName.toLowerCase().includes("region 2") || sheetName.toLowerCase().includes("zona 2") || colHeader.toLowerCase().includes("region 2")) {
          region = "Mexico Region 2";
        }
        detectedRegions.add(region);

        // Parse plan code from header for SA/DED/COAS detection
        const saMatch = colHeader.match(/S(\d+)/i) || colHeader.match(/(\d{2,3})(?=D)/);
        const dedMatch = colHeader.match(/D(\d+)/i);
        const coasMatch = colHeader.match(/C(\d+)/i);
        if (saMatch) detectedSumas.add(Number(saMatch[1]));
        if (dedMatch) detectedDeducibles.add(Number(dedMatch[1]));
        if (coasMatch) detectedCoaseguros.add(Number(coasMatch[1]));

        // Detect gender from column header for BNP
        let rateType = "Unisex";
        if (product === "BNP") {
          if (colHeader.toLowerCase().includes("female") || colHeader.toLowerCase().includes("mujer") || colHeader.toLowerCase().includes("fem")) {
            rateType = "Female";
          } else if (colHeader.toLowerCase().includes("male") || colHeader.toLowerCase().includes("hombre") || colHeader.toLowerCase().includes("masc")) {
            rateType = "Male";
          }
        }

        for (let rowIdx = 1; rowIdx < jsonData.length; rowIdx++) {
          const row = jsonData[rowIdx] as any[];
          if (!row) continue;
          const age = Number(row[ageColIdx]);
          const rate = Number(row[colIdx]);
          if (isNaN(age) || isNaN(rate) || rate <= 0) continue;

          const lookupKey = `${colHeader}${region}${age}${rateType !== "Unisex" ? rateType : ""}`;
          rates.push({
            lookup_key: lookupKey,
            plan_name: colHeader,
            region,
            age,
            rate,
            rate_type: rateType,
          });
        }
      }
    }

    if (rates.length === 0) {
      return new Response(JSON.stringify({ error: "No se pudieron extraer tarifas del archivo. Verifique el formato." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create package record
    const { data: pkg, error: pkgError } = await supabase
      .from("multicotizador_gmm_packages")
      .insert({
        product,
        version_name: versionName,
        source_filename: file.name,
        source_hash: sourceHash,
        status: "draft",
        derecho_poliza: derechoPoliza,
        asistencia_extranjero: asistenciaExtranjero,
        costo_catastrofica_extranjero: costoCatastrofica,
        sumas_aseguradas: Array.from(detectedSumas).sort((a, b) => a - b),
        deducibles: Array.from(detectedDeducibles).sort((a, b) => a - b),
        coaseguros: Array.from(detectedCoaseguros).sort((a, b) => a - b),
        rates_count: rates.length,
        created_by: null,
      })
      .select("id")
      .single();

    if (pkgError) {
      return new Response(JSON.stringify({ error: "Error creating package: " + pkgError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert rates in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < rates.length; i += batchSize) {
      const batch = rates.slice(i, i + batchSize).map(r => ({
        package_id: pkg.id,
        ...r,
      }));
      const { error: rateError } = await supabase
        .from("multicotizador_gmm_rates")
        .insert(batch);
      if (rateError) {
        await supabase.from("multicotizador_gmm_packages").update({ status: "failed", validation_errors: { message: rateError.message } }).eq("id", pkg.id);
        return new Response(JSON.stringify({ error: "Error inserting rates: " + rateError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      package_id: pkg.id,
      rates_loaded: rates.length,
      detected: {
        sumas_aseguradas: Array.from(detectedSumas),
        deducibles: Array.from(detectedDeducibles),
        coaseguros: Array.from(detectedCoaseguros),
        regions: Array.from(detectedRegions),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
