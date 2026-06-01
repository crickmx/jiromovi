import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
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
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is admin
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!usuario || usuario.rol !== "admin") {
      return new Response(JSON.stringify({ error: "Solo administradores pueden validar conexiones." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      email: string;
      password: string;
      imap_host?: string;
      imap_port?: number;
      smtp_host?: string;
      smtp_port?: number;
      cuenta_id?: string;
    };

    const { email, password, cuenta_id } = body;
    const imapHost = body.imap_host || "imap.ionos.mx";
    const imapPort = body.imap_port || 993;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email y password son requeridos." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test IMAP connection using raw TLS socket
    const imapResult = await testImapConnection(email, password, imapHost, imapPort);

    // Update the account record if cuenta_id provided
    if (cuenta_id && imapResult.success) {
      await supabase
        .from("ia_cuentas_correo")
        .update({
          estado: "activa",
          ultima_sincronizacion: new Date().toISOString(),
        })
        .eq("id", cuenta_id);
    } else if (cuenta_id && !imapResult.success) {
      await supabase
        .from("ia_cuentas_correo")
        .update({
          estado: "error",
          ultima_sincronizacion: new Date().toISOString(),
          ultimo_error: imapResult.message,
        })
        .eq("id", cuenta_id);
    }

    return new Response(JSON.stringify({
      success: imapResult.success,
      imap: imapResult,
      email,
      host: imapHost,
      port: imapPort,
    }), {
      status: imapResult.success ? 200 : 422,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("ia-validate-ionos-connection error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor.", detail: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function testImapConnection(
  email: string,
  password: string,
  host: string,
  port: number,
): Promise<{ success: boolean; message: string; mailboxes?: string[] }> {
  try {
    // Use Deno's built-in TLS to connect to IMAP server
    const conn = await Deno.connectTls({ hostname: host, port });

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // Read greeting
    const greetBuf = new Uint8Array(4096);
    const greetN = await conn.read(greetBuf);
    if (!greetN) {
      conn.close();
      return { success: false, message: "No se recibió respuesta del servidor IMAP." };
    }
    const greeting = decoder.decode(greetBuf.subarray(0, greetN));
    if (!greeting.includes("OK")) {
      conn.close();
      return { success: false, message: `Servidor no disponible: ${greeting.trim()}` };
    }

    // Send LOGIN command
    const loginCmd = `A1 LOGIN "${email}" "${password.replace(/"/g, '\\"')}"\r\n`;
    await conn.write(encoder.encode(loginCmd));

    // Read login response
    const loginBuf = new Uint8Array(4096);
    const loginN = await conn.read(loginBuf);
    if (!loginN) {
      conn.close();
      return { success: false, message: "No se recibió respuesta al login." };
    }
    const loginResp = decoder.decode(loginBuf.subarray(0, loginN));

    if (!loginResp.includes("A1 OK")) {
      conn.close();
      const isAuthFail = loginResp.includes("NO") || loginResp.includes("AUTHENTICATIONFAILED");
      return {
        success: false,
        message: isAuthFail
          ? "Credenciales incorrectas. Verifica email y contraseña."
          : `Error de autenticación: ${loginResp.trim()}`,
      };
    }

    // List mailboxes
    const listCmd = `A2 LIST "" "*"\r\n`;
    await conn.write(encoder.encode(listCmd));

    let listResp = "";
    const listBuf = new Uint8Array(8192);
    // Read with timeout
    const timeoutId = setTimeout(() => conn.close(), 5000);
    try {
      while (!listResp.includes("A2 OK")) {
        const n = await conn.read(listBuf);
        if (!n) break;
        listResp += decoder.decode(listBuf.subarray(0, n));
      }
    } catch {
      // timeout or closed
    }
    clearTimeout(timeoutId);

    const mailboxes: string[] = [];
    const lines = listResp.split("\r\n");
    for (const line of lines) {
      const match = line.match(/\* LIST .+ "(.+)"$/);
      if (match) mailboxes.push(match[1]);
    }

    // Logout
    try {
      await conn.write(encoder.encode("A3 LOGOUT\r\n"));
      conn.close();
    } catch {
      // ignore close errors
    }

    return {
      success: true,
      message: `Conexión exitosa. ${mailboxes.length} buzones encontrados.`,
      mailboxes,
    };

  } catch (err: any) {
    const msg = err.message || String(err);
    if (msg.includes("ConnectionRefused") || msg.includes("connection refused")) {
      return { success: false, message: "No se pudo conectar al servidor IMAP. Verifica host y puerto." };
    }
    if (msg.includes("timed out") || msg.includes("timeout")) {
      return { success: false, message: "Timeout al conectar. El servidor no responde." };
    }
    return { success: false, message: `Error de conexión: ${msg}` };
  }
}
