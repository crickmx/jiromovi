import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CentroDigitalRequest {
  id_docto: string;
}

interface ParsedFile {
  id: string;
  nombre: string;
  nombre_archivo: string;
  tipo_archivo: string;
  extension: string;
  tamanio_bytes: number;
  tamanio_legible: string;
  fecha_subida: string;
  carpeta: string;
}

interface ParsedFolder {
  nombre: string;
  archivos: ParsedFile[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuario no autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body: CentroDigitalRequest = await req.json();
    const { id_docto } = body;

    if (!id_docto || !String(id_docto).trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "id_docto es requerido (IDDocto numerico de SICAS)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Centro Digital] User=${user.id}, IDDocto=${id_docto}`);

    // Validate permissions: get user role and office
    const { data: usuarioData } = await supabase
      .from("usuarios")
      .select("id, rol, oficina_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuarioData) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuario no encontrado en sistema" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Permission check: verify user can access this document
    const { data: documento } = await supabase
      .from("sicas_documents")
      .select("id, usuario_id, oficina_id, vend_id")
      .eq("id_docto", id_docto)
      .maybeSingle();

    if (documento) {
      const esAdmin = usuarioData.rol === "Administrador";
      const esGerente = usuarioData.rol === "Gerente" && documento.oficina_id === usuarioData.oficina_id;
      const esPropietario = documento.usuario_id === user.id;

      // For agents: check if they own the document via vendor mapping
      let esVendedorAsignado = false;
      if (!esAdmin && !esGerente && !esPropietario && documento.vend_id) {
        const { data: mapping } = await supabase
          .from("vendor_mappings")
          .select("id")
          .eq("usuario_id", user.id)
          .eq("vendor_sicas_id", documento.vend_id)
          .maybeSingle();
        esVendedorAsignado = !!mapping;
      }

      if (!esAdmin && !esGerente && !esPropietario && !esVendedorAsignado) {
        return new Response(
          JSON.stringify({ success: false, error: "No tienes permisos para ver archivos de este documento" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // If document not in local cache, allow query anyway (document might not be synced yet)

    // Query SICAS live using REST API with CDIGITAL KeyProcess
    const sicasRestUrl = Deno.env.get("SICAS_REST_API_URL") || "https://security-services.sicasonline.info/api";
    const sicasUsername = Deno.env.get("SICAS_USERNAME") || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || "";
    const sicasCodeAuth = Deno.env.get("SICAS_CODE_AUTH") || "";

    if (!sicasUsername || !sicasPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciales SICAS no configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get auth token
    // IMPORTANT: Do NOT use URLSearchParams for sicasUsername because it may contain
    // literal '%' characters (e.g. j1r0%25$). URLSearchParams would double-encode
    // the '%' to '%25', turning j1r0%25$ into j1r0%2525$. We pass the username as-is
    // and only encode the password which does not contain reserved characters.
    const tokenQuery = `sUserName=${sicasUsername}&sPassword=${encodeURIComponent(sicasPassword)}${sicasCodeAuth ? `&sCodeAuth=${encodeURIComponent(sicasCodeAuth)}` : ""}`;

    const tokenResponse = await fetch(`${sicasRestUrl}/Security/GetToken?${tokenQuery}`, {
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
    console.log("[Centro Digital] SICAS token obtained");

    // Step 2: Query Centro Digital using ReadData with CDIGITAL KeyProcess
    // Parameters per spec: KeyProcess=CDIGITAL, ActionCDigital=GETFiles, TypeDestinoCDigital=DOCUMENT, IDValuePK=IDDocto
    const cdRequestBody = {
      PageRequested: 1,
      ItemsForPage: 200,
      FormatResponse: 2,
      Conditions: "",
      ConditionsDirect: `ActionCDigital=GETFiles|TypeDestinoCDigital=DOCUMENT|IDValuePK=${id_docto}`,
    };

    console.log(`[Centro Digital] POST /Report/ReadData with CDIGITAL, IDValuePK=${id_docto}`);

    const cdResponse = await fetch(`${sicasRestUrl}/Report/ReadData`, {
      method: "POST",
      headers: {
        Authorization: sicasToken,
        "Content-Type": "application/json",
        Prop_KeyCode: "CDIGITAL",
      },
      body: JSON.stringify(cdRequestBody),
    });

    if (!cdResponse.ok) {
      throw new Error(`SICAS Centro Digital HTTP ${cdResponse.status}: ${cdResponse.statusText}`);
    }

    const cdResult = await cdResponse.json();
    console.log(`[Centro Digital] Response Sucess=${cdResult.Sucess}, keys=${Object.keys(cdResult).join(",")}`);

    // Parse the response
    const archivos: ParsedFile[] = [];
    const carpetas: Record<string, ParsedFile[]> = {};

    if (cdResult.Sucess === false) {
      const errorMsg = cdResult.Error || cdResult.Message || "";
      const isNotFound = /no se localizo|not found|sin archivos|no files/i.test(errorMsg);

      if (isNotFound) {
        return new Response(
          JSON.stringify({
            success: true,
            id_docto,
            archivos: [],
            carpetas: [],
            total_archivos: 0,
            tiene_archivos: false,
            source: "sicas_live",
            sicas_message: errorMsg,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`SICAS Centro Digital error: ${errorMsg}`);
    }

    // Parse response - handle both XML string and JSON array formats
    let rawRecords: Record<string, string>[] = [];

    if (typeof cdResult.Response === "string" && cdResult.Response.includes("<")) {
      // XML format - parse manually
      const xmlStr = cdResult.Response;
      const rowRegex = /<(Table_\w+)>([\s\S]*?)<\/\1>/g;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(xmlStr)) !== null) {
        const tagName = rowMatch[1];
        if (tagName.endsWith("_Control") || tagName === "Table_Paginacion") continue;
        const rowXml = rowMatch[2];
        const record: Record<string, string> = {};
        const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
        let fieldMatch;
        while ((fieldMatch = fieldRegex.exec(rowXml)) !== null) {
          record[fieldMatch[1]] = fieldMatch[2].trim();
        }
        rawRecords.push(record);
      }
    } else if (Array.isArray(cdResult.Response)) {
      const tableInfo = cdResult.Response?.[0]?.TableInfo;
      if (Array.isArray(tableInfo)) {
        rawRecords = tableInfo;
      }
    } else if (cdResult.Files && Array.isArray(cdResult.Files)) {
      // Direct Files array format (from /DigitalCenter/GetFiles endpoint)
      for (const f of cdResult.Files) {
        rawRecords.push({
          IDFile: f.IDFile || f.Id || "",
          FileName: f.FileName || f.Nombre || "",
          FileExtension: f.FileExtension || f.Extension || "",
          FileSize: String(f.FileSize || f.Tamanio || 0),
          Folder: f.Folder || f.Carpeta || "General",
          UploadDate: f.UploadDate || f.FechaSubida || "",
          Description: f.Description || "",
        });
      }
    }

    console.log(`[Centro Digital] Raw records parsed: ${rawRecords.length}`);

    // Normalize records into structured files
    for (const record of rawRecords) {
      const fileName = record.FileName || record.NombreArchivo || record.Nombre || record.nombre || "";
      if (!fileName) continue;

      const ext = (record.FileExtension || record.Extension || record.extension || fileName.split(".").pop() || "").toLowerCase().replace(".", "");
      const folder = record.Folder || record.Carpeta || record.carpeta || record.TipoArchivo || "General";
      const sizeBytes = parseInt(record.FileSize || record.Tamanio || record.tamanio || "0", 10);

      const file: ParsedFile = {
        id: record.IDFile || record.IDArchivo || record.id || `file_${archivos.length}`,
        nombre: fileName.replace(/\.[^.]+$/, ""),
        nombre_archivo: fileName,
        tipo_archivo: getMimeType(ext),
        extension: ext,
        tamanio_bytes: sizeBytes,
        tamanio_legible: formatBytes(sizeBytes),
        fecha_subida: record.UploadDate || record.FechaSubida || record.fecha || "",
        carpeta: folder,
      };

      archivos.push(file);
      if (!carpetas[folder]) carpetas[folder] = [];
      carpetas[folder].push(file);
    }

    // Build folder structure
    const folderList: ParsedFolder[] = Object.entries(carpetas).map(([nombre, files]) => ({
      nombre,
      archivos: files,
    }));

    console.log(`[Centro Digital] Result: ${archivos.length} archivos in ${folderList.length} carpetas`);

    return new Response(
      JSON.stringify({
        success: true,
        id_docto,
        archivos,
        carpetas: folderList,
        total_archivos: archivos.length,
        tiene_archivos: archivos.length > 0,
        source: "sicas_live",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Centro Digital] Error:", error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        archivos: [],
        carpetas: [],
        total_archivos: 0,
        tiene_archivos: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xml: "application/xml",
    txt: "text/plain",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
  };
  return mimeMap[ext] || "application/octet-stream";
}
