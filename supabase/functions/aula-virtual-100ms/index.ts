import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT } from "npm:jose@5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const HMS_API = "https://api.100ms.live/v2";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { data } = await admin.auth.getUser(auth.slice(7));
  return data.user ?? null;
}

function hmsCredentials() {
  const accessKey = Deno.env.get("HMS_ACCESS_KEY");
  const secret = Deno.env.get("HMS_SECRET");
  if (!accessKey || !secret) throw new Error("100ms no está configurado");
  return { accessKey, key: new TextEncoder().encode(secret) };
}

async function managementToken() {
  const { accessKey, key } = hmsCredentials();
  return await new SignJWT({ access_key: accessKey, type: "management", version: 2 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime("5m")
    .sign(key);
}

async function hmsApi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${HMS_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await managementToken()}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`100ms ${path}: ${res.status} ${body?.message ?? ""}`.trim());
  return body;
}

/** Devuelve la URL Prebuilt de la sesión con el rol decidido en el servidor. */
async function roomUrl(sesion: string, userId: string, name: string) {
  const subdomain = Deno.env.get("HMS_SUBDOMAIN");
  if (!subdomain) throw new Error("Falta configurar HMS_SUBDOMAIN");

  const cols = "id, titulo, room_id, hms_room_id, instructor_id, estado";
  const query = admin.from("aula_virtual_sesiones").select(cols);
  const { data: session, error } = UUID_RE.test(sesion)
    ? await query.eq("id", sesion).maybeSingle()
    : await query.or(`room_id.eq."${sesion.replace(/"/g, "")}",hms_room_id.eq."${sesion.replace(/"/g, "")}"`).maybeSingle();
  if (error) throw error;
  if (!session) return { status: 404, body: { error: "Sesión no encontrada" } };
  if (session.estado === "finalizada" || session.estado === "cancelada") {
    return { status: 410, body: { error: "Esta sesión ya finalizó" } };
  }

  // Las sesiones antiguas no tienen sala real en 100ms: se crea la primera vez.
  let hmsRoomId = session.hms_room_id as string | null;
  if (!hmsRoomId) {
    const room = await hmsApi("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: `aula-${session.id}`,
        description: session.titulo ?? undefined,
        ...(Deno.env.get("HMS_TEMPLATE_ID") ? { template_id: Deno.env.get("HMS_TEMPLATE_ID") } : {}),
      }),
    });
    hmsRoomId = room.id as string;
    await admin.from("aula_virtual_sesiones").update({ hms_room_id: hmsRoomId }).eq("id", session.id);
  }

  const role = userId === session.instructor_id
    ? (Deno.env.get("HMS_ROLE_HOST") || "instructor")
    : (Deno.env.get("HMS_ROLE_GUEST") || "estudiante");

  const codes = await hmsApi(`/room-codes/room/${hmsRoomId}`);
  let code = (codes?.data ?? []).find((c: { role: string; enabled: boolean }) => c.role === role && c.enabled)?.code;
  if (!code) code = (await hmsApi(`/room-codes/room/${hmsRoomId}/role/${role}`, { method: "POST" })).code;

  const url = new URL(`https://${subdomain}.app.100ms.live/meeting/${code}`);
  url.searchParams.set("name", name);
  url.searchParams.set("userId", userId);
  return { status: 200, body: { url: url.toString(), role } };
}

async function hmsToken(roomId: string, userId: string, role: string, name: string) {
  const { accessKey, key } = hmsCredentials();
  return await new SignJWT({ access_key: accessKey, room_id: roomId, user_id: userId, role, type: "app", user_name: name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const user = await getUser(req);
  if (!user) return json({ error: "No autenticado" }, 401);
  try {
    const body = await req.json();
    if (body.action === "room_url") {
      if (!body.sesion) return json({ error: "sesion es obligatoria" }, 400);
      const result = await roomUrl(String(body.sesion), user.id, String(body.name || user.email || user.id).slice(0, 80));
      return json(result.body, result.status);
    }
    if (body.action !== "token") return json({ error: "Acción no soportada" }, 400);
    if (!body.room_id || !body.role) return json({ error: "room_id y role son obligatorios" }, 400);
    const allowed = ["instructor", "ponente", "estudiante", "observador", "recorder"];
    if (!allowed.includes(body.role)) return json({ error: "Rol inválido" }, 400);
    const token = await hmsToken(body.room_id, user.id, body.role, body.name || user.email || user.id);
    return json({ token, room_id: body.room_id, role: body.role, expires_in: 600 });
  } catch (error) {
    console.error("aula-virtual-100ms", error);
    return json({ error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});
