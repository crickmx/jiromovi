import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParsedFile {
  id: string;
  nombre_archivo: string;
  extension: string;
  tipo_archivo: string;
  tamanio_bytes: number;
  tamanio_legible: string;
  fecha_subida: string;
  carpeta: string;
  url_descarga?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "No authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { id_docto, poliza } = body;

    if (!id_docto) {
      return new Response(JSON.stringify({ success: false, error: "id_docto requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify this customer owns this document via their SICAS client mapping
    const { data: ownership } = await supabase
      .from("sicas_documents")
      .select("id, id_docto, poliza, cliente")
      .eq("id_docto", id_docto)
      .eq("is_poliza", true)
      .maybeSingle();

    if (!ownership) {
      return new Response(JSON.stringify({ success: false, error: "Documento no encontrado", archivos: [], tiene_archivos: false }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check customer has access to this cliente
    const { data: customerAccess } = await supabase
      .from("seguwallet_customers")
      .select("id, status")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!customerAccess) {
      return new Response(JSON.stringify({ success: false, error: "Acceso denegado", archivos: [], tiene_archivos: false }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: clientMapping } = await supabase
      .from("seguwallet_customer_sicas_clients")
      .select("sicas_client_id")
      .eq("seguwallet_customer_id", customerAccess.id)
      .eq("sicas_client_id", ownership.cliente)
      .maybeSingle();

    if (!clientMapping) {
      return new Response(JSON.stringify({ success: false, error: "No autorizado para este documento", archivos: [], tiene_archivos: false }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cache first
    const { data: cached } = await supabase
      .from("sicas_digital_cache")
      .select("files, cached_at, expires_at")
      .eq("id_docto", id_docto)
      .eq("identity_type", "DOCUMENT")
      .eq("value_pk", id_docto)
      .maybeSingle();

    if (cached && cached.expires_at && new Date(cached.expires_at) > new Date()) {
      const files = Array.isArray(cached.files) ? cached.files : [];
      return new Response(JSON.stringify({
        success: true,
        id_docto,
        archivos: files,
        total_archivos: files.length,
        tiene_archivos: files.length > 0,
        source: "cache",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch live from SICAS
    const sicasRestUrl = Deno.env.get("SICAS_REST_API_URL") || "https://security-services.sicasonline.info/api";
    const sicasUsername = Deno.env.get("SICAS_USERNAME") || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || "";
    const sicasCodeAuth = Deno.env.get("SICAS_CODE_AUTH") || "";

    if (!sicasUsername || !sicasPassword) {
      return new Response(JSON.stringify({
        success: true,
        id_docto,
        archivos: [],
        total_archivos: 0,
        tiene_archivos: false,
        source: "no_credentials",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get auth token
    const tokenParams = new URLSearchParams({ sUserName: sicasUsername, sPassword: sicasPassword });
    if (sicasCodeAuth) tokenParams.append("sCodeAuth", sicasCodeAuth);

    const tokenResponse = await fetch(`${sicasRestUrl}/Security/GetToken?${tokenParams.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });

    if (!tokenResponse.ok) {
      throw new Error(`SICAS auth failed: HTTP ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.Sucess || !tokenData.Token) {
      throw new Error(`SICAS auth failed: ${tokenData.Message || "No token"}`);
    }

    const sicasToken = tokenData.Token;

    // Query Centro Digital
    const cdRequestBody = {
      PageRequested: 1,
      ItemsForPage: 200,
      FormatResponse: 2,
      Conditions: "",
      ConditionsDirect: `ActionCDigital=GETFiles|TypeDestinoCDigital=DOCUMENT|IDValuePK=${id_docto}`,
    };

    const cdResponse = await fetch(`${sicasRestUrl}/Report/ReadData`, {
      method: "POST",
      headers: { Authorization: sicasToken, "Content-Type": "application/json", Prop_KeyCode: "CDIGITAL" },
      body: JSON.stringify(cdRequestBody),
    });

    if (!cdResponse.ok) {
      throw new Error(`SICAS Centro Digital HTTP ${cdResponse.status}`);
    }

    const cdResult = await cdResponse.json();
    const archivos: ParsedFile[] = [];

    if (cdResult.Sucess === false) {
      const errorMsg = cdResult.Error || cdResult.Message || "";
      const isNotFound = /no se localizo|not found|sin archivos|no files/i.test(errorMsg);
      if (!isNotFound) throw new Error(`SICAS error: ${errorMsg}`);
    } else {
      let rawRecords: Record<string, string>[] = [];

      if (typeof cdResult.Response === "string" && cdResult.Response.includes("<")) {
        const rowRegex = /<(Table_\w+)>([\s\S]*?)<\/\1>/g;
        let rowMatch;
        while ((rowMatch = rowRegex.exec(cdResult.Response)) !== null) {
          const tagName = rowMatch[1];
          if (tagName.endsWith("_Control") || tagName === "Table_Paginacion") continue;
          const record: Record<string, string> = {};
          const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
          let fieldMatch;
          while ((fieldMatch = fieldRegex.exec(rowMatch[2])) !== null) {
            record[fieldMatch[1]] = fieldMatch[2].trim();
          }
          rawRecords.push(record);
        }
      } else if (Array.isArray(cdResult.Response)) {
        const tableInfo = cdResult.Response?.[0]?.TableInfo;
        if (Array.isArray(tableInfo)) rawRecords = tableInfo;
      } else if (cdResult.Files && Array.isArray(cdResult.Files)) {
        for (const f of cdResult.Files) {
          rawRecords.push({
            IDFile: f.IDFile || f.Id || "",
            FileName: f.FileName || f.Nombre || "",
            FileExtension: f.FileExtension || f.Extension || "",
            FileSize: String(f.FileSize || f.Tamanio || 0),
            Folder: f.Folder || f.Carpeta || "General",
            UploadDate: f.UploadDate || f.FechaSubida || "",
          });
        }
      }

      for (const record of rawRecords) {
        const fileName = record.FileName || record.NombreArchivo || record.Nombre || record.nombre || "";
        if (!fileName) continue;

        const ext = (record.FileExtension || record.Extension || record.extension || fileName.split(".").pop() || "").toLowerCase().replace(".", "");
        const folder = record.Folder || record.Carpeta || record.carpeta || record.TipoArchivo || "General";
        const sizeBytes = parseInt(record.FileSize || record.Tamanio || record.tamanio || "0", 10);

        archivos.push({
          id: record.IDFile || record.IDArchivo || record.id || `file_${archivos.length}`,
          nombre_archivo: fileName,
          extension: ext,
          tipo_archivo: getMimeType(ext),
          tamanio_bytes: sizeBytes,
          tamanio_legible: formatBytes(sizeBytes),
          fecha_subida: record.UploadDate || record.FechaSubida || record.fecha || "",
          carpeta: folder,
        });
      }

      // Cache the result (24h TTL)
      const now = new Date();
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await supabase.from("sicas_digital_cache").upsert({
        id_docto,
        identity_type: "DOCUMENT",
        value_pk: id_docto,
        files: archivos,
        cached_at: now.toISOString(),
        expires_at: expires.toISOString(),
      }, { onConflict: "id_docto,identity_type,value_pk" });
    }

    return new Response(JSON.stringify({
      success: true,
      id_docto,
      archivos,
      total_archivos: archivos.length,
      tiene_archivos: archivos.length > 0,
      source: "sicas_live",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[seguwallet-get-policy-files] Error:", error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      archivos: [],
      total_archivos: 0,
      tiene_archivos: false,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    pdf: "PDF", jpg: "Imagen", jpeg: "Imagen", png: "Imagen",
    doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel",
    xml: "XML", txt: "Texto", zip: "ZIP",
  };
  return map[ext] || ext.toUpperCase() || "Archivo";
}
