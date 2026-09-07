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

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await client.auth.getUser(auth.slice(7));
  return data.user ?? null;
}

async function hmsToken(roomId: string, userId: string, role: string, name: string) {
  const accessKey = Deno.env.get("HMS_ACCESS_KEY");
  const secret = Deno.env.get("HMS_SECRET");
  if (!accessKey || !secret) throw new Error("100ms no está configurado");
  const key = new TextEncoder().encode(secret);
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
