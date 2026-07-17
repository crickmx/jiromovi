import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { setIaMailboxPassword } from "../_shared/emailCredentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Crea o actualiza una cuenta de correo del módulo de Automatización IA.
// La contraseña viaja solo en este request (HTTPS) y se cifra server-side
// antes de guardarse — nunca se escribe en texto plano desde el navegador.
// Sustituye los inserts/updates directos que hacía AutomatizacionIA.tsx
// (CuentaForm.handleSave) contra `ia_cuentas_correo.password_encrypted`.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token invalido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const ADMIN_ROLES = ["Administrador", "admin", "Admin"];
    if (!usuario || !ADMIN_ROLES.includes(usuario.rol)) {
      return new Response(JSON.stringify({ error: "Solo administradores pueden configurar cuentas de correo." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      cuenta_id?: string;
      nombre: string;
      email: string;
      password?: string;
      imap_host?: string;
      imap_port?: number;
      smtp_host?: string;
      smtp_port?: number;
      carpetas_incluidas?: string[];
    };

    if (!body.nombre || !body.email || (!body.cuenta_id && !body.password)) {
      return new Response(JSON.stringify({ error: "Nombre, correo y contraseña (para cuentas nuevas) son requeridos." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = {
      nombre: body.nombre,
      email: body.email,
      imap_host: body.imap_host || "imap.ionos.mx",
      imap_port: body.imap_port || 993,
      smtp_host: body.smtp_host || "smtp.ionos.mx",
      smtp_port: body.smtp_port || 587,
      carpetas_incluidas: body.carpetas_incluidas || ["INBOX"],
    };

    let cuentaId = body.cuenta_id;

    if (cuentaId) {
      const { error: updateErr } = await supabase.from("ia_cuentas_correo").update(metadata).eq("id", cuentaId);
      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("ia_cuentas_correo")
        .insert(metadata)
        .select("id")
        .single();
      if (insertErr || !inserted) {
        return new Response(JSON.stringify({ error: insertErr?.message || "No se pudo crear la cuenta." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      cuentaId = inserted.id;
    }

    if (body.password) {
      await setIaMailboxPassword(supabase, cuentaId!, body.password);
    }

    return new Response(JSON.stringify({ success: true, cuenta_id: cuentaId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ia-cuentas-correo-save error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor.", detail: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
