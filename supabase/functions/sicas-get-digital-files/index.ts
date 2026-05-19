import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GetDigitalFilesRequest {
  idDocto: string;
  identity?: string;
  valuePK?: string;
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

    const body: GetDigitalFilesRequest = await req.json();

    if (!body.idDocto) {
      return new Response(
        JSON.stringify({ success: false, error: "idDocto es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { idDocto } = body;
    const actualValuePK = body.valuePK || idDocto;

    console.log(`[Digital Files] User=${user.id}, IDDocto=${idDocto}, ValuePK=${actualValuePK}`);

    // Permission check
    const { data: usuarioData } = await supabase
      .from("usuarios")
      .select("id, rol, oficina_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuarioData) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuario no encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: documento } = await supabase
      .from("sicas_documents")
      .select("id, usuario_id, oficina_id, vend_id")
      .eq("id_docto", idDocto)
      .maybeSingle();

    if (documento) {
      const esAdmin = usuarioData.rol === "Administrador";
      const esGerente = usuarioData.rol === "Gerente" && documento.oficina_id === usuarioData.oficina_id;
      const esPropietario = documento.usuario_id === user.id;

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

    // Get auth token
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

    // Query Centro Digital: KeyProcess=CDIGITAL, ActionCDigital=GETFiles, TypeDestinoCDigital=DOCUMENT
    const cdRequestBody = {
      PageRequested: 1,
      ItemsForPage: 200,
      FormatResponse: 2,
      Conditions: "",
      ConditionsDirect: `ActionCDigital=GETFiles|TypeDestinoCDigital=DOCUMENT|IDValuePK=${actualValuePK}`,
    };

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
      throw new Error(`SICAS Centro Digital HTTP ${cdResponse.status}`);
    }

    const cdResult = await cdResponse.json();

    if (cdResult.Sucess === false) {
      const errorMsg = cdResult.Error || cdResult.Message || "";
      const isNotFound = /no se localizo|not found|sin archivos|no files/i.test(errorMsg);

      if (isNotFound) {
        return new Response(
          JSON.stringify({ success: true, files: [], cached: false, sicas_message: errorMsg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`SICAS error: ${errorMsg}`);
    }

    // Parse records from response
    let rawRecords: Record<string, string>[] = [];

    if (typeof cdResult.Response === "string" && cdResult.Response.includes("<")) {
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
      rawRecords = cdResult.Files.map((f: any) => ({
        IDFile: f.IDFile || f.Id || "",
        FileName: f.FileName || f.Nombre || "",
        FileExtension: f.FileExtension || f.Extension || "",
        FileSize: String(f.FileSize || f.Tamanio || 0),
        Folder: f.Folder || f.Carpeta || "General",
        UploadDate: f.UploadDate || f.FechaSubida || "",
        Description: f.Description || "",
      }));
    }

    // Normalize into files array (compatible with DocumentoModal expectations)
    const files = rawRecords.map((record, idx) => {
      const fileName = record.FileName || record.NombreArchivo || record.Nombre || record.nombre || "";
      if (!fileName) return null;
      const ext = (record.FileExtension || record.Extension || fileName.split(".").pop() || "").replace(".", "");
      return {
        IDFile: record.IDFile || record.IDArchivo || `file_${idx}`,
        FileName: fileName,
        FileExtension: ext,
        FileSize: parseInt(record.FileSize || record.Tamanio || "0", 10),
        Folder: record.Folder || record.Carpeta || "General",
        UploadDate: record.UploadDate || record.FechaSubida || "",
        Description: record.Description || record.Descripcion || "",
      };
    }).filter(Boolean);

    console.log(`[Digital Files] Returning ${files.length} files`);

    return new Response(
      JSON.stringify({ success: true, files, cached: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Digital Files] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
