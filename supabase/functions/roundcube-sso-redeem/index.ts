import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getMailboxPassword } from "../_shared/emailCredentials.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, private",
  "Pragma": "no-cache",
};

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const [providedHash, expectedHash] = await Promise.all([sha256(provided), sha256(expected)]);
  const a = new TextEncoder().encode(providedHash);
  const b = new TextEncoder().encode(expectedHash);
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(value: unknown): string {
  const url = String(value ?? "").trim();
  return /^(https?:|mailto:|tel:)/i.test(url) ? url : "";
}

function renderSignature(template: string, context: Record<string, unknown>): string {
  let html = template;
  let previous = "";

  while (previous !== html) {
    previous = html;
    html = html.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_match, key: string, content: string) => String(context[key] ?? "").trim() ? content : "",
    );
  }

  html = html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = context[key];
    if (/link|logo|imagen|sitio_web/i.test(key)) return safeUrl(value);
    if (/color/i.test(key)) {
      const color = String(value ?? "").trim();
      return /^#[0-9a-f]{3,8}$/i.test(color) ? color : "";
    }
    return escapeHtml(value);
  });

  return `<div data-movi-email-signature="true">${html}</div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { error: "METHOD_NOT_ALLOWED" });

  try {
    const expectedSecret = Deno.env.get("ROUNDCUBE_SSO_SHARED_SECRET") ?? "";
    const providedSecret = req.headers.get("X-Movi-Roundcube-Secret") ?? "";
    if (!await secretsMatch(providedSecret, expectedSecret)) {
      return response(401, { error: "UNAUTHORIZED" });
    }

    const body = await req.json() as { token?: string };
    if (!body.token || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) {
      return response(400, { error: "INVALID_TOKEN" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const tokenHash = await sha256(body.token);
    const now = new Date().toISOString();

    // UPDATE condicional: exactamente una petición puede reclamar el token.
    const { data: claimed, error: claimError } = await admin
      .from("roundcube_sso_tokens")
      .update({ used_at: now })
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("usuario_id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed?.usuario_id) return response(401, { error: "TOKEN_EXPIRED_OR_USED" });

    const { data: mailbox, error: mailboxError } = await admin
      .from("email_configuraciones")
      .select("email")
      .eq("usuario_id", claimed.usuario_id)
      .eq("activa", true)
      .maybeSingle();
    if (mailboxError || !mailbox?.email) return response(409, { error: "MAILBOX_NOT_CONFIGURED" });

    const password = await getMailboxPassword(admin, claimed.usuario_id);
    if (!password) return response(409, { error: "MAILBOX_CREDENTIAL_MISSING" });

    const { data: profile } = await admin
      .from("usuarios")
      .select(`
        nombre,
        apellidos,
        nombre_completo,
        puesto,
        email_laboral,
        celular_laboral,
        extension_telefonica,
        imagen_perfil_url,
        rol,
        oficina:oficinas!oficina_id(
          nombre,
          domicilio,
          telefono,
          logo_url,
          accent_color,
          color_secundario,
          extension,
          whatsapp,
          sitio_web
        )
      `)
      .eq("id", claimed.usuario_id)
      .maybeSingle();

    const office = Array.isArray(profile?.oficina) ? profile?.oficina[0] : profile?.oficina;
    const fullName = profile?.nombre_completo?.trim()
      || `${profile?.nombre ?? ""} ${profile?.apellidos ?? ""}`.trim()
      || mailbox.email;
    const mobile = String(profile?.celular_laboral ?? "");
    const mobileDigits = mobile.replace(/\D/g, "");
    const whatsappDigits = mobileDigits.length === 10
      ? `521${mobileDigits}`
      : mobileDigits.startsWith("52") && mobileDigits.length === 12
      ? `521${mobileDigits.slice(2)}`
      : mobileDigits;

    const signatureContext: Record<string, unknown> = {
      nombre: profile?.nombre,
      apellidos: profile?.apellidos,
      nombre_completo: fullName,
      puesto: profile?.puesto,
      email_laboral: profile?.email_laboral || mailbox.email,
      celular_laboral: mobile,
      celular_laboral_sin_formato: mobileDigits,
      whatsapp_link: whatsappDigits ? `https://wa.me/${whatsappDigits}` : "",
      imagen_perfil: profile?.imagen_perfil_url,
      extension_telefonica: profile?.extension_telefonica,
      rol: profile?.rol,
      oficina_logo: office?.logo_url,
      oficina_nombre: office?.nombre,
      oficina_color_primario: office?.accent_color || "#0E23E2",
      oficina_color_secundario: office?.color_secundario,
      oficina_telefono: office?.telefono,
      oficina_domicilio: office?.domicilio,
      oficina_extension: office?.extension,
      oficina_whatsapp: office?.whatsapp,
      oficina_sitio_web: office?.sitio_web,
    };

    const { data: assignedSignatures } = await admin.rpc("get_firma_asignada", {
      p_usuario_id: claimed.usuario_id,
    });
    const template = assignedSignatures?.[0]?.template_html;
    const signature = typeof template === "string" && template.trim()
      ? renderSignature(template, signatureContext)
      : "";

    return response(200, {
      username: mailbox.email,
      password,
      host: Deno.env.get("IONOS_IMAP_HOST") ?? "ssl://imap.ionos.mx",
      identity: {
        name: fullName,
        organization: office?.nombre ?? "",
        signature,
      },
    });
  } catch (error) {
    console.error("roundcube-sso-redeem:", error instanceof Error ? error.message : "unknown");
    return response(500, { error: "INTERNAL_ERROR" });
  }
});
