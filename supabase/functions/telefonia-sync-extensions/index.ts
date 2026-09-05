import { createClient } from "jsr:@supabase/supabase-js@2";

// ATENCION 2026-08-05: servidor Yeastar migrado de 74.208.52.157 a 159.54.138.29.
// Este certificado (UCCPBX_CA) esta pineado al servidor VIEJO -- si el nuevo PBX
// genero un certificado self-signed distinto (lo normal en una instalacion nueva),
// el handshake TLS va a fallar aunque el host/IP ya este actualizado abajo.
// Para obtener el cert real del servidor nuevo, correr desde una maquina que
// tenga alcance de red al PBX:
//   openssl s_client -connect 159.54.138.29:8088 -servername www.UCCPBX.com </dev/null 2>/dev/null | openssl x509
// y reemplazar el bloque completo de abajo con ese output.
const UCCPBX_CA = `-----BEGIN CERTIFICATE-----
MIIFHjCCAwYCCQDigYY7NhwbazANBgkqhkiG9w0BAQsFADBQMQswCQYDVQQGEwJD
TjEPMA0GA1UECAwGRnVKaWFuMQ8wDQYDVQQHDAZYaWFNZW4xETAPBgNVBAoMCFNv
ZnR3YXJlMQwwCgYDVQQDDANQQlgwIBcNMjEwODEzMDc1NDU1WhgPMjEyMTA3MjAw
NzU0NTVaMFAxCzAJBgNVBAYTAkNOMQ8wDQYDVQQIDAZGdUppYW4xDzANBgNVBAcM
BlhpYU1lbjERMA8GA1UECgwIU29mdHdhcmUxDDAKBgNVBAMMA1BCWDCCAiIwDQYJ
KoZIhvcNAQEBBQADggIPADCCAgoCggIBAJQq4Yo2FHcPerQDhw7pk594T8ZmxHdR
GX7kYYy3shKPA5yjQxzmP2Ka45XB/mw8Uvktu8pA7ueqllCIlpGSjubT+7YpaO6B
k05Tx+TUYHro1udmkdhgaZ4uH2V6cYFNpy3nQbwlqdb8SkEVuUiaiOBpjjn679TK
Mz3dkDrGZRJpLSyVJy7ur858yHv0C+Nt9BOJa23K7YFxgrWwSCjsk3SMthhhMubp
fOcTvNhF/ahEKJxndoSltrH6VIvimteH/U5goHs67YACZPKbvje7u4YIXSR0KUrs
WHuCYQkANcZGOXIdnrfrviU4JmW92lfdS3L6KyT6xG644MBUFhB3zBWy1garlMFv
auH+Ek76S1/AuBYBwZGZQP5Xxxdu4JVYAmK6LDwKO7YYapjBbD0AOOIaa5fTsesq
PhqCgNCHLqb2KqD8pKZynpQ2Gcbz/Y4oW6zCZ8zTQ6VWEpeBWSmifAIW7aYW2qbY
fI22ErRjQv5ES+2zYRQk5EJQPQNDZhfDDt32WksRcKgt5qQnB31FTk6AZxPxQyJ/
sYRGpTZFqHRaolky2e1BtCONT7HTZMxpbp5hsu2QE1XyZGB5rDs62hgibP4eYMvx
ImrAHWOiJ2eY5ZK2DpddyQ0tTrtO1GPkrVraNR7rToS/z/W/QsQO6h2rNSOgyhFn
CW00H2XkchlxAgMBAAEwDQYJKoZIhvcNAQELBQADggIBAFo4t47IGfW2IUc5CXKp
r598z7giRWgNH2dnL/anox3smlXDU1qXrVS2IbtHsmCniRw+iIVUOlCayONYwsxN
BBGDYYpQT4Djm1fcKQvO+ftIwGhSnpW9MssA4CzUIhTnqb/xdoCkAP+p0QkSMdD/
6dX0Cpdje/434sbmZ/9k3g6cNZ+OhI9A5n0RFeVccX/AccJBJ1q09h1FogofmqZd
6RnU99P4jhT1EJF4IHqyAjplFA10jadsWEWzvVSe2q2GcYwTa8Rkm4xSOlHpQCqd
ziMo69rxgrYzL7OPV0tO43y1wMdaQ8wBio6zO7ZL5Q3rUkcvi60sYD2yxvsbq4zT
6Ov0CjXmx8xx5trkMvCaAqr78/zdJ2CtSkOYKle6TKbwLZ18TxjA1qI6xFg/rHU+
hYNM1aqGH6OOyK1lOXjHvDAz/2YT2TYGh9kzeNuZbFG59zMgR+FNetI9QFoizTbx
c1hAQl+LULUuyyxytUoEmiKTck6lcqTTUWyEYcNZNgROUEruf3/kM5axN8L4Dmxb
KWVGvccdF/RBXDR0fFDPGbpwae/LHjqut62z9c2NJmgOgZBaZhi3CHd4BQLgb21X
x+jvOfAzyAdqFmBaP4JXDWxzTEiiCD2iDY4EbYMASLORbmnwLGFV6ES8cp5F5PHX
6LZwwpBN27UOUY29cNCFNZsF
-----END CERTIFICATE-----`;

const PBX_HOST = "159.54.138.29";
const PBX_PORT = 8088;
const UA = "Mozilla/5.0 (compatible; MOVI-Sync/1.0)";
const ENCODED_FALLBACK = "MGVlZjM5OGZkYWFjZmUxNjk4ODcyMmVkZTU5NjQzNGM=";
const SKIP_EXTS = new Set(["6200","7000","7001","7002","7003","8000","8001"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,Apikey",
};

function buildRequest(method: string, path: string, bodyStr: string, extra: string[]): Uint8Array {
  const bodyBytes = new TextEncoder().encode(bodyStr);
  const headers = [
    `${method} ${path} HTTP/1.0`,
    `Host: ${PBX_HOST}:${PBX_PORT}`,
    `User-Agent: ${UA}`,
    `Content-Type: application/json`,
    `Content-Length: ${bodyBytes.length}`,
    ...extra, "", "",
  ].join("\r\n");
  const hBytes = new TextEncoder().encode(headers);
  const out = new Uint8Array(hBytes.length + bodyBytes.length);
  out.set(hBytes); out.set(bodyBytes, hBytes.length);
  return out;
}

async function pbxRequest(path: string, opts: { method?: string; body?: string; websession?: string }): Promise<{ bodyText: string }> {
  const method = (opts.method ?? "GET").toUpperCase();
  const extra: string[] = [];
  if (opts.websession) extra.push(`Cookie: websession=${opts.websession}`);
  const packet = buildRequest(method, path, opts.body ?? "", extra);
  const tcp = await Deno.connect({ hostname: PBX_HOST, port: PBX_PORT });
  const tls = await Deno.startTls(tcp, { hostname: "www.UCCPBX.com", caCerts: [UCCPBX_CA] });
  try {
    let sent = 0;
    while (sent < packet.length) sent += await tls.write(packet.subarray(sent));
    const chunks: Uint8Array[] = [];
    const buf = new Uint8Array(32768);
    while (true) {
      let n: number | null;
      try { n = await tls.read(buf); } catch { break; }
      if (n === null) break;
      chunks.push(buf.slice(0, n));
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    const text = new TextDecoder().decode(all);
    const sep = text.indexOf("\r\n\r\n");
    return { bodyText: sep >= 0 ? text.slice(sep + 4) : "" };
  } finally { try { tls.close(); } catch { /**/ } }
}

async function pbxLoginWithCookie(user: string, encodedPass: string): Promise<string> {
  const bodyStr = JSON.stringify({ username: user, password: encodedPass, language: "es", supportcrx: true });
  const packet = buildRequest("POST", "/api/v1.0/login", bodyStr, []);
  const tcp = await Deno.connect({ hostname: PBX_HOST, port: PBX_PORT });
  const tls = await Deno.startTls(tcp, { hostname: "www.UCCPBX.com", caCerts: [UCCPBX_CA] });
  try {
    let sent = 0;
    while (sent < packet.length) sent += await tls.write(packet.subarray(sent));
    const chunks: Uint8Array[] = [];
    const buf = new Uint8Array(32768);
    while (true) {
      let n: number | null;
      try { n = await tls.read(buf); } catch { break; }
      if (n === null) break;
      chunks.push(buf.slice(0, n));
    }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    const text = new TextDecoder().decode(all);
    const sep = text.indexOf("\r\n\r\n");
    const rawHeaders = sep >= 0 ? text.slice(0, sep) : text;
    const bodyText = sep >= 0 ? text.slice(sep + 4) : "";
    const cookieLine = rawHeaders.split("\r\n").find(l =>
      l.toLowerCase().startsWith("set-cookie:") && l.includes("websession=")
    );
    let ws = "";
    if (cookieLine) { const m = cookieLine.match(/websession=([^;]+)/i); if (m) ws = m[1]; }
    if (!ws) { const d = JSON.parse(bodyText); if (d.errcode !== 0) throw new Error(`PBX login: ${JSON.stringify(d)}`); ws = d.websession ?? ""; }
    return ws;
  } finally { try { tls.close(); } catch { /**/ } }
}

async function pbxLogout(ws: string) {
  try { await pbxRequest("/api/v1.0/logout", { method: "POST", websession: ws }); } catch { /**/ }
}

function norm(s: string): string {
  return s.toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const pbxUser = (Deno.env.get("YEASTAR_PBX_USERNAME") || "").trim() || "admin";
  const pbxPass = (Deno.env.get("YEASTAR_PBX_PASSWORD_ENCODED") || "").trim() || ENCODED_FALLBACK;
  const sbUrl = Deno.env.get("SUPABASE_URL") || "";
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const db = createClient(sbUrl, sbKey);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /**/ }
  const dryRun = body.dry_run === true;
  const debug = body.debug === true;

  let ws = "";
  try {
    ws = await pbxLoginWithCookie(pbxUser, pbxPass);

    const all: Record<string, unknown>[] = [];
    let page = 1;
    while (true) {
      const qs = `page=${page}&page_size=300&sort_by=number&order_by=asc&search_value=`;
      const { bodyText } = await pbxRequest(`/api/v1.0/extension/searchsummary?${qs}`, { websession: ws });
      let d: Record<string, unknown>;
      try { d = JSON.parse(bodyText); } catch { break; }
      if ((d.errcode as number) !== 0) break;
      const recs = (d.extension_list as Record<string, unknown>[]) ?? [];
      all.push(...recs);
      if (recs.length < 300) break;
      page++;
    }

    await pbxLogout(ws); ws = "";

    if (debug) {
      return new Response(JSON.stringify({ success: true, raw: all }, null, 2), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const pbxExts = all.filter(e => {
      const n = String(e.number ?? "").trim();
      return /^\d{3,4}$/.test(n) && !SKIP_EXTS.has(n);
    }).map(e => ({
      number: String(e.number).trim(),
      name:   String(e.caller_id_name ?? "").trim(),
      email:  String(e.email_addr ?? "").trim().toLowerCase(),
    }));

    const { data: rows } = await db.from("usuarios").select("id,nombre,apellidos,nombre_completo,email,extension_telefonica");
    const users = (rows || []) as {
      id: string; nombre: string; apellidos: string; nombre_completo: string | null;
      email: string | null; extension_telefonica: string | null;
    }[];

    const assigned: { ext: string; user: string; method: string }[] = [];
    const skipped: { ext: string; name: string; reason: string }[] = [];
    const unmatched: { ext: string; pbx_name: string }[] = [];

    for (const ext of pbxExts) {
      const alreadyOwned = users.find(u => u.extension_telefonica?.trim() === ext.number);
      if (alreadyOwned) {
        skipped.push({ ext: ext.number, name: ext.name, reason: `ya asignada a ${alreadyOwned.nombre}` });
        continue;
      }

      let matched: typeof users[0] | null = null;
      let method = "";

      if (ext.email) {
        const found = users.find(u =>
          !u.extension_telefonica?.trim() && u.email?.toLowerCase() === ext.email
        );
        if (found) { matched = found; method = "email"; }
      }

      if (!matched && ext.name) {
        const nPbx = norm(ext.name);
        const found = users.find(u => {
          if (u.extension_telefonica?.trim()) return false;
          const nc = norm(u.nombre_completo ?? `${u.nombre} ${u.apellidos}`);
          return nc === nPbx;
        });
        if (found) { matched = found; method = "nombre_completo"; }
      }

      if (!matched && ext.name) {
        const nPbx = norm(ext.name);
        const found = users.find(u => {
          if (u.extension_telefonica?.trim()) return false;
          const nc = norm(u.nombre_completo ?? `${u.nombre} ${u.apellidos}`);
          return nc.includes(nPbx) || nPbx.includes(nc);
        });
        if (found) { matched = found; method = "nombre_parcial"; }
      }

      if (!matched) { unmatched.push({ ext: ext.number, pbx_name: ext.name }); continue; }

      if (!dryRun) {
        await db.from("usuarios").update({ extension_telefonica: ext.number }).eq("id", matched.id);
        matched.extension_telefonica = ext.number;
      }
      assigned.push({ ext: ext.number, user: matched.nombre_completo ?? `${matched.nombre} ${matched.apellidos}`, method });
    }

    return new Response(JSON.stringify({ success: true, dry_run: dryRun, pbx_total: pbxExts.length, assigned, skipped, unmatched }, null, 2), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    if (ws) await pbxLogout(ws).catch(() => {});
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
