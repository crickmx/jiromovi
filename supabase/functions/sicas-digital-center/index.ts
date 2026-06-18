import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Entity type → SICAS TypeDestinoCDigital string mapping
// Values from SICAS API spec for ConditionsDirect param
const CD_TYPE_MAP: Record<string, string> = {
  document: "DOCUMENT",
  contact: "CONTACT",
  client: "CLIENT",
  endorsement: "ENDORSEMENT",
  claim: "CLAIM",
  receipt: "RECEIPT",
  company: "COMPANY",
  agent: "AGENT",
  vendor: "VENDOR",
  office: "OFFICE",
  despacho: "DESPACHO",
};

// Which ID field each entity type requires
const REQUIRED_ID: Record<string, string> = {
  document: "idDocto",
  contact: "idCont",
  client: "idCont",
  endorsement: "idEnd",
  claim: "idClaim",
  receipt: "idRecibo",
  company: "idCont",
  agent: "idCont",
  vendor: "idCont",
  office: "idCont",
  despacho: "idCont",
};

interface DigitalCenterRequest {
  entityType: string;
  idCont?: string | number;
  idDocto?: string | number;
  idEnd?: string | number;
  idRecibo?: string | number;
  idClaim?: string | number;
  onlyFolderWithData?: boolean;
  recursive?: boolean;
  forceRefresh?: boolean;
  source?: string;
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
  can_preview: boolean;
  can_download: boolean;
}

interface ParsedFolder {
  id: string;
  name: string;
  path: string;
  level: number;
  has_files: boolean;
  files: ParsedFile[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("No authorization header", 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonError("Usuario no autenticado", 401);
    }

    // ── Parse request ─────────────────────────────────────────────────────────
    const body: DigitalCenterRequest = await req.json();
    const {
      entityType,
      idCont,
      idDocto,
      idEnd,
      idRecibo,
      idClaim,
      onlyFolderWithData = false,
      recursive = true,
      forceRefresh = false,
    } = body;

    if (!entityType || !CD_TYPE_MAP[entityType]) {
      return jsonError(
        `entityType inválido: "${entityType}". Valores permitidos: ${Object.keys(CD_TYPE_MAP).join(", ")}`,
        400
      );
    }

    // Resolve the entity ID to use
    const requiredField = REQUIRED_ID[entityType];
    const entityIdMap: Record<string, string | number | undefined> = {
      idDocto, idCont, idEnd, idRecibo, idClaim,
    };
    const entityId = entityIdMap[requiredField];

    if (!entityId && entityId !== 0) {
      return jsonError(
        `No se puede consultar el Centro Digital porque este registro no tiene el identificador SICAS requerido (${requiredField}).`,
        400
      );
    }

    const entityIdStr = String(entityId);
    const typeDestino = CD_TYPE_MAP[entityType];

    console.log(`[SICAS-DC] User=${user.id}, entityType=${entityType}, entityId=${entityIdStr}`);

    // ── Permission check ──────────────────────────────────────────────────────
    const { data: usuarioData } = await supabase
      .from("usuarios")
      .select("id, rol, oficina_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuarioData) {
      await logQuery(supabase, user.id, entityType, entityIdStr, "unauthorized", "Usuario no encontrado", Date.now() - startTime);
      return jsonError("Usuario no encontrado en sistema", 403);
    }

    const esAdmin = ["Administrador", "administrador", "admin"].includes(usuarioData.rol || "");

    // For document type: validate ownership via sicas_documents
    if (entityType === "document" && !esAdmin) {
      const { data: documento } = await supabase
        .from("sicas_documents")
        .select("id, usuario_id, oficina_id, vend_id")
        .eq("id_docto", entityIdStr)
        .maybeSingle();

      if (documento) {
        const esGerente = usuarioData.rol === "Gerente" && documento.oficina_id === usuarioData.oficina_id;
        const esPropietario = documento.usuario_id === user.id;
        let esVendedorAsignado = false;

        if (!esGerente && !esPropietario && documento.vend_id) {
          const { data: mapping } = await supabase
            .from("vendor_mappings")
            .select("id")
            .eq("usuario_id", user.id)
            .eq("vendor_sicas_id", documento.vend_id)
            .maybeSingle();
          esVendedorAsignado = !!mapping;
        }

        if (!esGerente && !esPropietario && !esVendedorAsignado) {
          await logQuery(supabase, user.id, entityType, entityIdStr, "unauthorized", "Sin permisos sobre este documento", Date.now() - startTime);
          return jsonError("No tienes permisos para ver archivos de este documento", 403);
        }
      }
      // If not in sicas_documents, allow (may not be synced yet)
    }

    // ── Cache check ───────────────────────────────────────────────────────────
    const cacheKey = `${entityType}:${entityIdStr}`;
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("sicas_digital_center_cache")
        .select("response_json, expires_at")
        .eq("request_hash", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        console.log(`[SICAS-DC] Cache hit for ${cacheKey}`);
        const resp = cached.response_json as any;
        return new Response(
          JSON.stringify({ ...resp, source: "cache" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── SICAS credentials ─────────────────────────────────────────────────────
    const sicasRestUrl = Deno.env.get("SICAS_REST_API_URL") || "https://security-services.sicasonline.info/api";
    const sicasUsername = Deno.env.get("SICAS_USERNAME") || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || "";
    const sicasCodeAuth = Deno.env.get("SICAS_CODE_AUTH") || "";

    if (!sicasUsername || !sicasPassword) {
      await logQuery(supabase, user.id, entityType, entityIdStr, "error", "Credenciales SICAS no configuradas", Date.now() - startTime);
      return jsonError("Credenciales SICAS no configuradas en el servidor", 500);
    }

    // ── SICAS Auth ────────────────────────────────────────────────────────────
    const tokenParams = new URLSearchParams({ sUserName: sicasUsername, sPassword: sicasPassword });
    if (sicasCodeAuth) tokenParams.append("sCodeAuth", sicasCodeAuth);

    const tokenResponse = await fetch(`${sicasRestUrl}/Security/GetToken?${tokenParams.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    });

    if (!tokenResponse.ok) {
      throw new Error(`SICAS auth HTTP ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.Sucess || !tokenData.Token) {
      throw new Error(`SICAS auth failed: ${tokenData.Message || "No token returned"}`);
    }
    const sicasToken = tokenData.Token;

    // ── Centro Digital query ──────────────────────────────────────────────────
    const cdRequestBody = {
      PageRequested: 1,
      ItemsForPage: 500,
      FormatResponse: 2,
      Conditions: "",
      ConditionsDirect: `ActionCDigital=GETFiles|TypeDestinoCDigital=${typeDestino}|IDValuePK=${entityIdStr}`,
    };

    console.log(`[SICAS-DC] POST /Report/ReadData CDIGITAL, Type=${typeDestino}, ID=${entityIdStr}`);

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

    // ── Handle not-found gracefully ───────────────────────────────────────────
    if (cdResult.Sucess === false) {
      const errorMsg = cdResult.Error || cdResult.Message || "";
      const isNotFound = /no se localizo|not found|sin archivos|no files|vacio|empty/i.test(errorMsg);

      if (isNotFound) {
        const emptyResponse = buildResponse(entityType, entityIdStr, [], []);
        await cacheResponse(supabase, cacheKey, emptyResponse);
        await logQuery(supabase, user.id, entityType, entityIdStr, "empty", null, Date.now() - startTime);
        return new Response(
          JSON.stringify({ ...emptyResponse, source: "sicas_live" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`SICAS error: ${errorMsg}`);
    }

    // ── Parse records ─────────────────────────────────────────────────────────
    const rawRecords = parseRecords(cdResult);
    console.log(`[SICAS-DC] Raw records: ${rawRecords.length}`);

    // ── Normalize files ───────────────────────────────────────────────────────
    const files: ParsedFile[] = [];
    const folderMap: Map<string, ParsedFile[]> = new Map();

    for (let i = 0; i < rawRecords.length; i++) {
      const record = rawRecords[i];
      const fileName = record.FileName || record.NombreArchivo || record.Nombre || record.nombre || "";
      if (!fileName) continue;

      const ext = (record.FileExtension || record.Extension || record.extension || fileName.split(".").pop() || "")
        .toLowerCase().replace(".", "");
      const folder = record.Folder || record.Carpeta || record.carpeta || record.TipoArchivo || "General";
      const sizeBytes = parseInt(record.FileSize || record.Tamanio || record.tamanio || "0", 10);
      const canPreview = ["pdf", "jpg", "jpeg", "png", "gif", "webp", "txt", "xml"].includes(ext);
      const canDownload = true;

      const file: ParsedFile = {
        id: record.IDFile || record.IDArchivo || record.id || `file_${i}`,
        nombre: fileName.replace(/\.[^.]+$/, ""),
        nombre_archivo: fileName,
        tipo_archivo: getMimeType(ext),
        extension: ext,
        tamanio_bytes: sizeBytes,
        tamanio_legible: formatBytes(sizeBytes),
        fecha_subida: record.UploadDate || record.FechaSubida || record.fecha || "",
        carpeta: folder,
        can_preview: canPreview,
        can_download: canDownload,
      };

      files.push(file);
      if (!folderMap.has(folder)) folderMap.set(folder, []);
      folderMap.get(folder)!.push(file);
    }

    // Build folder list
    const folders: ParsedFolder[] = [];
    let folderIdx = 0;
    for (const [folderName, folderFiles] of folderMap.entries()) {
      folders.push({
        id: `folder_${folderIdx++}`,
        name: folderName,
        path: folderName,
        level: 0,
        has_files: folderFiles.length > 0,
        files: folderFiles,
      });
    }

    const responseData = buildResponse(entityType, entityIdStr, files, folders);

    // ── Cache result ──────────────────────────────────────────────────────────
    await cacheResponse(supabase, cacheKey, responseData);
    await logQuery(supabase, user.id, entityType, entityIdStr, files.length > 0 ? "success" : "empty", null, Date.now() - startTime);

    console.log(`[SICAS-DC] Done: ${files.length} files in ${folders.length} folders`);

    return new Response(
      JSON.stringify({ ...responseData, source: "sicas_live" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[SICAS-DC] Error:", error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: "No pudimos consultar el Centro Digital en este momento.",
        technical_message: error.message,
        files: [],
        folders: [],
        total_files: 0,
        has_files: false,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message, files: [], folders: [], total_files: 0, has_files: false }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function buildResponse(entityType: string, entityId: string, files: ParsedFile[], folders: ParsedFolder[]) {
  return {
    success: true,
    entity_type: entityType,
    entity_id: entityId,
    files,
    folders,
    total_files: files.length,
    has_files: files.length > 0,
  };
}

async function cacheResponse(supabase: any, key: string, data: any) {
  try {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min TTL
    await supabase.from("sicas_digital_center_cache").upsert(
      { request_hash: key, entity_type: data.entity_type, entity_id: data.entity_id, response_json: data, expires_at: expiresAt },
      { onConflict: "request_hash" }
    );
  } catch (e) {
    console.warn("[SICAS-DC] Cache write failed:", e);
  }
}

async function logQuery(supabase: any, userId: string, entityType: string, entityId: string, status: string, errorMessage: string | null, responseTimeMs: number) {
  try {
    await supabase.from("sicas_digital_center_logs").insert({
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      status,
      error_message: errorMessage,
      response_time_ms: responseTimeMs,
      source: "sicas",
    });
  } catch (e) {
    console.warn("[SICAS-DC] Log write failed:", e);
  }
}

function parseRecords(cdResult: any): Record<string, string>[] {
  if (typeof cdResult.Response === "string" && cdResult.Response.includes("<")) {
    const rawRecords: Record<string, string>[] = [];
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
      if (Object.keys(record).length > 0) rawRecords.push(record);
    }
    return rawRecords;
  }

  if (Array.isArray(cdResult.Response)) {
    const tableInfo = cdResult.Response?.[0]?.TableInfo;
    return Array.isArray(tableInfo) ? tableInfo : [];
  }

  if (cdResult.Files && Array.isArray(cdResult.Files)) {
    return cdResult.Files.map((f: any) => ({
      IDFile: f.IDFile || f.Id || "",
      FileName: f.FileName || f.Nombre || "",
      FileExtension: f.FileExtension || f.Extension || "",
      FileSize: String(f.FileSize || f.Tamanio || 0),
      Folder: f.Folder || f.Carpeta || "General",
      UploadDate: f.UploadDate || f.FechaSubida || "",
      Description: f.Description || "",
    }));
  }

  return [];
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", gif: "image/gif", webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xml: "application/xml", txt: "text/plain",
    zip: "application/zip", rar: "application/x-rar-compressed",
  };
  return map[ext] || "application/octet-stream";
}
