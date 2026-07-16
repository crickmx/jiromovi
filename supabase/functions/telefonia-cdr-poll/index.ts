import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── UCCPBX built-in CA cert (CN=PBX, valid until 2121-07-20) ────────────────
// Yeastar P-Series fallback cert when configured cert fails to load.
// SAN: DNS:www.UCCPBX.com — TCP to real IP, TLS SNI as "www.UCCPBX.com"
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

const PBX_HOST = "74.208.52.157";
const PBX_PORT = 8088;
// User-Agent sent with every PBX request — the PBX validates this HTTP header
const UA = "Mozilla/5.0 (compatible; MOVI-CDR/1.0)";

// Fallback encoded password in case the secret has whitespace issues
// btoa(md5hex("Marsella14$")) = "MGVlZjM5OGZkYWFjZmUxNjk4ODcyMmVkZTU5NjQzNGM="
const ENCODED_FALLBACK = "MGVlZjM5OGZkYWFjZmUxNjk4ODcyMmVkZTU5NjQzNGM=";

const MISSED = new Set([
  "NO ANSWERED", "NO ANSWER", "NOANSWER", "NO_ANSWER",
  "VOICEMAIL", "BUSY", "FAILED", "CANCEL", "MISSED",
]);
const IVR = new Set(["6200", "7000", "7001", "7002", "7003", "8000", "8001"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,Apikey",
};

// Build a single contiguous HTTP/1.0 request packet (headers + body in one buffer)
function buildRequest(
  method: string,
  path: string,
  bodyStr: string,
  extra: string[],
): Uint8Array {
  const bodyBytes = new TextEncoder().encode(bodyStr);
  const headers = [
    `${method} ${path} HTTP/1.0`,
    `Host: ${PBX_HOST}:${PBX_PORT}`,
    `User-Agent: ${UA}`,          // ← required by Yeastar P-Series
    `Content-Type: application/json`,
    `Content-Length: ${bodyBytes.length}`,
    ...extra,
    "",
    "",
  ].join("\r\n");
  const hBytes = new TextEncoder().encode(headers);
  const out = new Uint8Array(hBytes.length + bodyBytes.length);
  out.set(hBytes);
  out.set(bodyBytes, hBytes.length);
  return out;
}

// TCP connect → startTls with UCCPBX CA (SNI = "www.UCCPBX.com")
async function pbxRequest(
  path: string,
  opts: { method?: string; body?: string; websession?: string },
): Promise<{ bodyText: string; setCookie?: string }> {
  const method = (opts.method ?? "GET").toUpperCase();
  const extra: string[] = [];
  if (opts.websession) extra.push(`Cookie: websession=${opts.websession}`);
  const packet = buildRequest(method, path, opts.body ?? "", extra);

  const tcp = await Deno.connect({ hostname: PBX_HOST, port: PBX_PORT });
  const tls = await Deno.startTls(tcp, {
    hostname: "www.UCCPBX.com",
    caCerts: [UCCPBX_CA],
  });

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

    const cookieLine = rawHeaders.split("\r\n").find(
      (l) => l.toLowerCase().startsWith("set-cookie:") && l.includes("websession="),
    );
    let setCookie: string | undefined;
    if (cookieLine) {
      const m = cookieLine.match(/websession=([^;]+)/i);
      if (m) setCookie = m[1];
    }

    return { bodyText, setCookie };
  } finally {
    try { tls.close(); } catch { /* ignore */ }
  }
}

// Login — password encoding: btoa(md5_hex(plaintext))
async function pbxLogin(user: string, encodedPass: string): Promise<string> {
  // Debug: log credentials info (not the actual value)
  console.log(`LOGIN: user="${user}" pass_len=${encodedPass.length} pass_match=${encodedPass === ENCODED_FALLBACK}`);
  const { bodyText, setCookie } = await pbxRequest("/api/v1.0/login", {
    method: "POST",
    body: JSON.stringify({
      username: user,
      password: encodedPass,
      language: "es",
      supportcrx: true,
      linkus_devicemark: "movi-cdr-poll",
      login_link_type: "all",
    }),
  });
  console.log(`LOGIN response: ${bodyText.slice(0, 200)}`);
  const data = JSON.parse(bodyText);
  if (data.errcode !== 0) throw new Error(`PBX login: ${JSON.stringify(data)}`);
  const session = setCookie ?? data.websession ?? data.token;
  if (!session) throw new Error("No websession in login response");
  return session as string;
}

async function pbxLogout(websession: string): Promise<void> {
  try { await pbxRequest("/api/v1.0/logout", { method: "POST", websession }); }
  catch (_) { /* ignore */ }
}

async function getCdr(
  websession: string, start: string, end: string,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const qs = new URLSearchParams({
      page: String(page), pagesize: "100",
      start_time: start, end_time: end,
    });
    const { bodyText } = await pbxRequest(`/api/v1.0/cdr/list?${qs}`, { websession });
    let d: Record<string, unknown>;
    try { d = JSON.parse(bodyText); } catch { break; }
    console.log(`CDR page=${page} errcode=${d.errcode} total=${d.total_number}`);
    if (d.errcode !== 0) { console.error("CDR err:", bodyText.slice(0, 200)); break; }
    const recs = (d.cdr_list ?? d.data ?? []) as Record<string, unknown>[];
    all.push(...recs);
    if (recs.length < 100 || all.length >= Number(d.total_number ?? 0)) break;
    page++;
  }
  return all;
}

// Mexico City permanently UTC-6 (no DST since 2023)
function mxDate(d: Date): string {
  const l = new Date(d.getTime() + -6 * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${l.getUTCFullYear()}-${p(l.getUTCMonth()+1)}-${p(l.getUTCDate())} ${p(l.getUTCHours())}:${p(l.getUTCMinutes())}:${p(l.getUTCSeconds())}`;
}

// PBX timestamps are MX local → UTC ISO
function parseMx(raw: string): string {
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return new Date().toISOString();
  return new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4]+6, +m[5], +m[6])).toISOString();
}

function norm(p: string): string { return (p || "").replace(/\D/g, ""); }

function variants(raw: string): string[] {
  const d = norm(raw);
  const s = new Set([d]);
  if (d.startsWith("521") && d.length === 13) {
    s.add("52" + d.slice(3)); s.add(d.slice(3)); s.add(d.slice(2));
  } else if (d.startsWith("52") && d.length === 12) {
    s.add(d.slice(2));
  }
  if (d.length > 10) s.add(d.slice(-10));
  return Array.from(s).filter(Boolean);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const pbxUser = (Deno.env.get("YEASTAR_PBX_USERNAME") || "").trim();
  const pbxPassRaw = (Deno.env.get("YEASTAR_PBX_PASSWORD_ENCODED") || "").trim();
  // Use fallback if secret is missing or empty
  const pbxPass = pbxPassRaw || ENCODED_FALLBACK;
  const sbUrl   = Deno.env.get("SUPABASE_URL") || "";
  const sbKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  console.log(`INIT: user="${pbxUser}" pass_from_secret=${pbxPassRaw.length > 0} pass_len=${pbxPass.length}`);

  if (!pbxUser) {
    return new Response(JSON.stringify({ error: "Missing PBX username" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* no body */ }
  const mins = parseInt(String(body.lookback_minutes ?? 3), 10);

  const db = createClient(sbUrl, sbKey);
  const results: unknown[] = [];
  let session: string | null = null;

  try {
    session = await pbxLogin(pbxUser, pbxPass);
    const now  = new Date();
    const from = new Date(now.getTime() - mins * 60000);
    const s = mxDate(from);
    const e = mxDate(now);
    console.log(`Poll: ${s} → ${e} (${mins}m)`);

    const recs = await getCdr(session, s, e);
    console.log(`CDR fetched: ${recs.length}`);
    if (recs.length > 0) {
      console.log("CDR keys:", Object.keys(recs[0]).join(","));
      console.log("CDR[0]:", JSON.stringify(recs[0]).slice(0, 300));
    }

    for (const rec of recs) {
      const caller = norm(String(
        rec.call_from ?? rec.call_from_number ?? rec.callernum ?? rec.caller ?? rec.src ?? ""
      )) || "Desconocido";
      const ext = norm(String(
        rec.call_to ?? rec.call_to_number ?? rec.last_participant_number ??
        rec.second_participant_number ?? rec.callee ?? ""
      ));
      const status = String(
        rec.call_status ?? rec.last_status ?? rec.status ?? rec.disposition ?? ""
      ).toUpperCase().trim();

      if (!MISSED.has(status)) { console.log(`Skip status=${status}`); continue; }
      if (!ext || !/^\d{3,4}$/.test(ext) || IVR.has(ext)) {
        console.log(`Skip IVR/invalid ext=${ext}`); continue;
      }

      const tRaw = String(rec.start_time ?? rec.starttime ?? rec.time ?? "");
      const callTime = tRaw ? parseMx(tRaw) : now.toISOString();

      // Dedup ±60s
      const ws = new Date(new Date(callTime).getTime() - 60000).toISOString();
      const we = new Date(new Date(callTime).getTime() + 60000).toISOString();
      const { data: ex } = await db.from("llamadas_perdidas").select("id")
        .eq("extension", ext).eq("caller_number", caller)
        .gte("call_time", ws).lte("call_time", we).limit(1);
      if (ex && ex.length > 0) { console.log(`Dedup: ${caller}→${ext}`); continue; }

      const { data: ur } = await db.from("usuarios").select("id,nombre,nombre_completo")
        .eq("extension_telefonica", ext).limit(1);
      const uid: string | null = (ur?.[0] as any)?.id ?? null;

      let callerName: string | null = null;
      if (caller !== "Desconocido") {
        for (const v of variants(caller)) {
          const { data: um } = await db.from("usuarios")
            .select("nombre_completo,nombre,apellido")
            .or(`celular_laboral.eq.${v},celular_personal.eq.${v}`).limit(1);
          if (um?.[0]) {
            const u = um[0] as any;
            callerName = u.nombre_completo || [u.nombre, u.apellido].filter(Boolean).join(" ");
            break;
          }
        }
        if (!callerName) {
          for (const v of variants(caller)) {
            const { data: cm } = await db.from("contactos")
              .select("nombre,apellido").eq("telefono", v).limit(1);
            if (cm?.[0]) {
              const c = cm[0] as any;
              callerName = [c.nombre, c.apellido].filter(Boolean).join(" ");
              break;
            }
          }
        }
      }

      const disp = callerName ? `${callerName} (${caller})` : caller;

      await db.from("llamadas_perdidas").insert({
        extension: ext, caller_number: caller, call_time: callTime,
        usuario_id: uid, notificado: false, leido: false,
      });

      if (uid) {
        await db.from("notificaciones").insert({
          tipo: "llamada_perdida", titulo: "Llamada perdida",
          mensaje: `Llamada perdida de ${disp}`,
          accion_url: "/admin/telefonia", leida: false, usuario_id: uid,
          metadata: { caller_number: caller, caller_name: callerName, extension: ext },
        });
        try {
          await fetch(`${sbUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sbKey}` },
            body: JSON.stringify({
              usuario_id: uid, title: "Llamada perdida",
              body: `Llamada perdida de ${disp}`,
              url: "/admin/telefonia", tag: "missed-call",
            }),
          });
        } catch (pe) { console.error("Push:", (pe as Error).message); }
      }

      results.push({ extension: ext, caller, callerName, status, callTime, uid });
      console.log(`Inserted: ${caller}→${ext} uid=${uid}`);
    }

    await pbxLogout(session);
    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    if (session) await pbxLogout(session).catch(() => {});
    console.error("Fatal:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
