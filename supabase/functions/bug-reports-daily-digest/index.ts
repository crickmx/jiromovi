import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Corre una vez al día (cron, ver migracion) - barre todos los reportes de bug,
// anota cuales ya estan cerrados (con fecha + ultimo comentario) para que un
// agente de IA no pierda tiempo en trabajo ya resuelto, y sube el .md resultante
// a Storage para descargarlo despues desde Admin > Reportes de Bugs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: reportes, error } = await supabase
      .from("bug_reportes")
      .select(`
        created_at, diagnostico_ia, errores_consola, peticiones_fallidas, rutas_visitadas, user_agent, viewport,
        tickets!inner (
          id, folio, instrucciones, custom_estatus_label, cerrado_en,
          grupo_asignado:tramites_grupos_visualizacion!grupo_asignado_id(nombre)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const rows = reportes || [];

    const secciones = await Promise.all(rows.map(async (r: any) => {
      const t = r.tickets;
      const ultimaRuta = r.rutas_visitadas?.[r.rutas_visitadas.length - 1]?.ruta || "desconocida";

      if (t?.cerrado_en) {
        const { data: ultimoComentario } = await supabase
          .from("ticket_comentarios")
          .select("mensaje, created_at")
          .eq("ticket_id", t.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          atendido: true,
          md: `## Reporte ${t.folio} — ✅ YA ATENDIDO

- Cerrado el: ${new Date(t.cerrado_en).toLocaleString("es-MX")}
- Último comentario: ${ultimoComentario?.mensaje || "Sin comentarios registrados"}

Este trámite ya fue revisado y cerrado — no requiere más atención de Claude ni de ninguna otra IA.

---
`,
        };
      }

      return {
        atendido: false,
        md: `## Reporte ${t?.folio ?? "?"}

- Fecha: ${new Date(r.created_at).toLocaleString("es-MX")}
- Estatus: ${t?.custom_estatus_label || "Sin estatus"}
- Equipo asignado: ${t?.grupo_asignado?.nombre || "Sin asignar"}
- Ruta donde ocurrió: ${ultimaRuta}

**Descripción del usuario:**
${t?.instrucciones || "Sin descripción"}

**Diagnóstico IA (preliminar, verificar contra el código real antes de aplicar un fix):**
${r.diagnostico_ia || "No generado"}

**Rutas visitadas antes del error (más reciente al final):**
\`\`\`json
${JSON.stringify(r.rutas_visitadas, null, 2)}
\`\`\`

**Errores de consola:**
\`\`\`json
${JSON.stringify(r.errores_consola, null, 2)}
\`\`\`

**Peticiones de red fallidas:**
\`\`\`json
${JSON.stringify(r.peticiones_fallidas, null, 2)}
\`\`\`

Navegador: ${r.user_agent || "desconocido"} · Viewport: ${r.viewport || "desconocido"}

---
`,
      };
    }));

    const abiertos = secciones.filter((s) => !s.atendido).length;
    const atendidos = secciones.length - abiertos;

    const contenido = `# Reporte de Bugs — jiromovi (generado automáticamente)
Generado: ${new Date().toLocaleString("es-MX")}
Total de reportes: ${secciones.length} (${abiertos} abiertos, ${atendidos} ya atendidos)

Instrucciones para el agente de IA: cada sección "## Reporte <folio>" es un bug reportado por un usuario real dentro de la plataforma jiromovi (React + TypeScript + Supabase). El "Diagnóstico IA" es solo una hipótesis preliminar generada sin ver el código — revisa el repo real antes de confirmar una causa o aplicar un fix. Los reportes marcados "✅ YA ATENDIDO" ya fueron resueltos y cerrados — ignóralos por completo, no requieren trabajo. Prioriza los reportes abiertos por folio más reciente si hay muchos.

---

${secciones.map((s) => s.md).join("\n")}`;

    const fecha = new Date().toISOString().slice(0, 10);
    const fileOptions = { upsert: true, contentType: "text/markdown" };

    const [fechado, latest] = await Promise.all([
      supabase.storage.from("bug-reports-digest").upload(`reportes-bugs-${fecha}.md`, contenido, fileOptions),
      supabase.storage.from("bug-reports-digest").upload("latest.md", contenido, fileOptions),
    ]);
    if (fechado.error) throw fechado.error;
    if (latest.error) throw latest.error;

    return new Response(JSON.stringify({ ok: true, total: secciones.length, abiertos, atendidos }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
