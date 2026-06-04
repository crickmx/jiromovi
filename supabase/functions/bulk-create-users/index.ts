import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VALID_ROLES = ["Administrador", "Gerente", "Empleado", "Agente", "Ejecutivo"];

function parseCSV(text: string): Record<string, string>[] {
  // Normalize line endings
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse (handles quoted fields)
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    if (values.length < 2) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").replace(/^"|"$/g, "").trim();
    });
    rows.push(row);
  }

  return rows;
}

function generateSecurePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: callerData } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", caller.id)
      .maybeSingle();

    if (!callerData || callerData.rol !== "Administrador") {
      return new Response(
        JSON.stringify({ error: "Solo administradores pueden realizar carga masiva" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV from FormData
    const contentType = req.headers.get("content-type") || "";
    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "No se recibió archivo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      csvText = await file.text();
    } else {
      // Raw text body fallback
      csvText = await req.text();
    }

    if (!csvText.trim()) {
      return new Response(
        JSON.stringify({ error: "El archivo está vacío" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "El CSV no contiene filas de datos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cache oficinas and regimenes fiscales to avoid repeated DB calls
    const { data: oficinas } = await supabase
      .from("oficinas")
      .select("id, nombre")
      .eq("activa", true);

    const { data: regimenes } = await supabase
      .from("commission_fiscal_regimes")
      .select("id, nombre, codigo");

    const oficinasMap = new Map<string, string>();
    (oficinas || []).forEach((o) => {
      oficinasMap.set(o.nombre.toLowerCase().trim(), o.id);
    });

    const regimenesMap = new Map<string, string>();
    (regimenes || []).forEach((r) => {
      if (r.nombre) regimenesMap.set(r.nombre.toLowerCase().trim(), r.id);
      if (r.codigo) regimenesMap.set(r.codigo.toLowerCase().trim(), r.id);
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; email: string; error: string }>,
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 porque fila 1 es header
      const email = row.email || row.email_laboral || "";

      try {
        // Validar campos obligatorios
        if (!email) {
          results.failed++;
          results.errors.push({ row: rowNum, email: "(vacío)", error: "Email es obligatorio" });
          continue;
        }
        if (!row.nombre) {
          results.failed++;
          results.errors.push({ row: rowNum, email, error: "Nombre es obligatorio" });
          continue;
        }
        if (!row.apellidos) {
          results.failed++;
          results.errors.push({ row: rowNum, email, error: "Apellidos son obligatorios" });
          continue;
        }

        const rol = row.rol || "Agente";
        if (!VALID_ROLES.includes(rol)) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            email,
            error: `Rol inválido: "${rol}". Válidos: ${VALID_ROLES.join(", ")}`,
          });
          continue;
        }

        // Resolver oficina_id
        let oficina_id: string | null = null;
        if (row.oficina_nombre) {
          oficina_id = oficinasMap.get(row.oficina_nombre.toLowerCase().trim()) || null;
          if (!oficina_id) {
            results.failed++;
            results.errors.push({
              row: rowNum,
              email,
              error: `Oficina no encontrada: "${row.oficina_nombre}"`,
            });
            continue;
          }
        }

        // Resolver regimen_fiscal_id
        let regimen_fiscal_id: string | null = null;
        if (row.regimen_fiscal) {
          regimen_fiscal_id = regimenesMap.get(row.regimen_fiscal.toLowerCase().trim()) || null;
          // Si no se encuentra, continúa sin régimen (no es bloqueante)
        }

        // Determinar estado
        const estadoRaw = (row.estado || "").toLowerCase().trim();
        const activoRaw = (row.activo || "").toLowerCase().trim();
        let estado = "activo";
        if (estadoRaw === "pendiente" || activoRaw === "false" || activoRaw === "0") {
          estado = "pendiente";
        }

        // Usar password del CSV o generar uno seguro
        const password = row.password && row.password.length >= 6
          ? row.password
          : generateSecurePassword();

        // Crear usuario en auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            email,
            error: authError.message,
          });
          continue;
        }

        if (!authData.user) {
          results.failed++;
          results.errors.push({ row: rowNum, email, error: "No se pudo crear usuario en auth" });
          continue;
        }

        // Preparar datos del perfil
        const insertData: Record<string, unknown> = {
          id: authData.user.id,
          nombre: row.nombre,
          apellidos: row.apellidos,
          rol,
          email_laboral: email,
          puesto: row.puesto || "",
          oficina_id,
          fecha_nacimiento: row.fecha_nacimiento || null,
          fecha_ingreso: row.fecha_ingreso || null,
          celular_personal: row.celular_personal || "",
          email_personal: row.email_personal || "",
          celular_laboral: row.celular_laboral || "",
          extension_telefonica: row.extension_telefonica || "",
          regimen_fiscal_id,
          banco: row.banco || "",
          clabe: row.clabe || "",
          dias_vacaciones_disponibles: parseInt(row.dias_vacaciones_disponibles || "0") || 0,
          equipo_computo: row.equipo_computo || null,
          equipo_celular: row.equipo_celular || null,
          estado,
        };

        // Campos opcionales
        if (row.web_slug) insertData.web_slug = row.web_slug;
        if (row.url_web_jiro) insertData.url_web_jiro = row.url_web_jiro;
        if (row.url_web_multicotizador) insertData.url_web_multicotizador = row.url_web_multicotizador;
        if (row.mi_logotipo_url) insertData.mi_logotipo_url = row.mi_logotipo_url;
        if (row.id_sicas) insertData.id_sicas = row.id_sicas;
        if (row.nombre_sicas) insertData.nombre_sicas = row.nombre_sicas;
        if (row.plan_mkt_premium) {
          insertData.plan_mkt_premium = row.plan_mkt_premium.toLowerCase() === "true";
        }

        const { error: insertError } = await supabase
          .from("usuarios")
          .insert(insertData);

        if (insertError) {
          // Rollback auth user
          await supabase.auth.admin.deleteUser(authData.user.id);
          results.failed++;
          results.errors.push({
            row: rowNum,
            email,
            error: insertError.message,
          });
          continue;
        }

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          row: rowNum,
          email,
          error: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[bulk-create-users] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
