import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Yeastar-Token",
};

/** Normaliza un número telefónico a solo dígitos para comparación. */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Intenta distintas variaciones del número para buscar en la DB:
 * - Número completo (e.g. 5215511223344)
 * - Sin prefijo 52 (e.g. 5511223344)
 * - Sin prefijo 521 (e.g. 5511223344, cuando viene como 5215511223344)
 * - Últimos 10 dígitos
 */
function phoneVariants(raw: string): string[] {
  const digits = normalizePhone(raw);
  const variants = new Set<string>();
  variants.add(digits);
  if (digits.startsWith("521") && digits.length === 13) {
    variants.add("52" + digits.slice(3));   // 52 + 10 dígitos locales
    variants.add(digits.slice(3));           // 10 dígitos locales
    variants.add(digits.slice(2));           // 1 + 10 dígitos
  } else if (digits.startsWith("52") && digits.length === 12) {
    variants.add(digits.slice(2));           // 10 dígitos locales
  }
  if (digits.length > 10) {
    variants.add(digits.slice(-10));         // Últimos 10 dígitos
  }
  return Array.from(variants);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Yeastar webhook received:", JSON.stringify(body));

    const msg = body.msg || body;

    const extension =
      msg.callee || msg.extension || msg.to ||
      body.callee || body.extension || body.to;

    const callerNumber =
      msg.caller || msg.from || msg.callernum ||
      body.caller || body.from || "Desconocido";

    const rawTime = msg.starttime || msg.start_time || body.starttime;
    const callTime = rawTime
      ? new Date(rawTime).toISOString()
      : new Date().toISOString();

    if (!extension) {
      console.log("No extension in payload. Body:", JSON.stringify(body));
      return new Response(
        JSON.stringify({ error: "No extension in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Buscar el dueño de la extensión
    const { data: usuarioRows } = await adminClient
      .from("usuarios")
      .select("id, nombre, nombre_completo")
      .eq("extension_telefonica", extension)
      .limit(1);

    const usuario = usuarioRows?.[0] || null;
    const usuarioId = usuario?.id || null;

    // 2. Resolver nombre del caller — buscar en usuarios y contactos
    let callerName: string | null = null;
    if (callerNumber !== "Desconocido") {
      const variants = phoneVariants(callerNumber);

      // 2a. Buscar en usuarios (celular_laboral, celular_personal)
      for (const variant of variants) {
        const { data: userMatches } = await adminClient
          .from("usuarios")
          .select("nombre_completo, nombre, apellido")
          .or(`celular_laboral.eq.${variant},celular_personal.eq.${variant}`)
          .limit(1);

        if (userMatches?.[0]) {
          const u = userMatches[0];
          callerName = u.nombre_completo || [u.nombre, u.apellido].filter(Boolean).join(" ");
          console.log("Caller found in usuarios:", callerName, "for variant:", variant);
          break;
        }
      }

      // 2b. Si no se encontró en usuarios, buscar en contactos
      if (!callerName) {
        for (const variant of variants) {
          const { data: contactMatches } = await adminClient
            .from("contactos")
            .select("nombre, apellido")
            .eq("telefono", variant)
            .limit(1);

          if (contactMatches?.[0]) {
            const c = contactMatches[0];
            callerName = [c.nombre, c.apellido].filter(Boolean).join(" ");
            console.log("Caller found in contactos:", callerName, "for variant:", variant);
            break;
          }
        }
      }
    }

    const callerDisplay = callerName
      ? `${callerName} (${callerNumber})`
      : callerNumber;

    console.log("callerDisplay:", callerDisplay, "| callerName:", callerName);

    // 3. Insertar en llamadas_perdidas
    const { error: insertError } = await adminClient.from("llamadas_perdidas").insert({
      extension,
      caller_number: callerNumber,
      call_time: callTime,
      usuario_id: usuarioId,
      notificado: false,
      leido: false,
    });

    if (insertError) {
      console.error("llamadas_perdidas insert error:", insertError);
    } else {
      console.log("llamada_perdida inserted for extension:", extension);
    }

    // 4. Insertar notificación in-app (solo si hay usuario dueño de la extensión)
    if (usuarioId) {
      const { error: notifError } = await adminClient.from("notificaciones").insert({
        tipo: "llamada_perdida",
        titulo: "Llamada perdida",
        mensaje: `Llamada perdida de ${callerDisplay}`,
        accion_url: "/admin/telefonia",
        leida: false,
        usuario_id: usuarioId,
        metadata: {
          caller_number: callerNumber,
          caller_name: callerName || null,
        },
      });

      if (notifError) {
        console.error("notificaciones insert error:", notifError);
      } else {
        console.log("notificacion inserted for usuario_id:", usuarioId);
      }

      // 5. Intentar push notification (best-effort)
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            usuario_id: usuarioId,
            title: "Llamada perdida",
            body: `Llamada perdida de ${callerDisplay}`,
            url: "/admin/telefonia",
            tag: "missed-call",
          }),
        });
      } catch (pushErr: any) {
        console.error("Push notification error:", pushErr.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, extension, caller: callerNumber, callerName }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
