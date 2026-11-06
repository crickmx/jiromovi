// Reporte SEMANAL de actividad: lo que cada persona entrega en GitHub y lo que
// hace dentro de MOVI, en un PDF que se guarda y se manda por correo.
//
// Pedido de Ricardo (06/11): "las dos cosas", semanal, "tanto tenerlo en MOVI
// para Admins como recibirlo por correo, desde MOVI en un PDF".
//
// ── Lo que se midió antes de escribir esto, y que define el diseño ────────
//
// 🔑 El trabajo NO se ve en los commits. Froilán entra por PULL REQUESTS desde
//    ramas propias, así que en `main` solo quedan los merges: 1 commit suyo en
//    30 días contra 20 PRs. Un reporte por commits lo dejaría como si no
//    trabajara. Por eso se cuentan PRs (`reportes_repos.contar_por`).
//
// 🔑 Dentro de MOVI ya existe `user_activity_logs`, con su pantalla y sus
//    RPCs. NO se inventa una bitácora nueva: se lee esa.
//
// 🔑 Los repos de hoy son públicos, así que GitHub se lee sin token. Si alguno
//    se vuelve privado, el reporte lo DICE. Un reporte que informa cero cuando
//    en realidad no pudo mirar es peor que no tener reporte.
//
// ── Dos reglas de robustez ────────────────────────────────────────────────
//
// 1. Si una fuente falla, el reporte sale igual y nombra la que falló.
// 2. Si el PDF no se puede generar, NO se pierde el reporte: se guarda el
//    texto y el correo lleva el contenido en el cuerpo. El PDF es una forma
//    de presentar el dato, no el dato.
//
// Todo en un solo archivo a propósito: el dashboard de Supabase empaqueta
// ÚNICAMENTE la carpeta de la función, así que un import a `../_shared/` no
// viaja (pasó el 09/10 con process-poliza-pdf).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BUCKET = "reportes-semanales";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 1), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** `2026-11-06` */
const soloFecha = (d: Date) => d.toISOString().slice(0, 10);

/** "6 nov 2026" — para que el PDF no hable en ISO. */
function diaLegible(iso: string): string {
  const M = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const d = new Date(iso);
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ── Tipos de lo que se junta ────────────────────────────────────────────────

interface Persona {
  usuario_id: string;
  nombre: string;
  github: string | null;
}

interface AporteRepo {
  repo: string;
  prs: Array<{ numero: number; titulo: string; estado: string; fecha: string }>;
  /** Si no se pudo leer el repo, aquí va el porqué — y el PDF lo enseña. */
  problema?: string;
}

interface ActividadMovi {
  total: number;
  porModulo: Array<{ modulo: string; n: number }>;
  ultimas: Array<{ cuando: string; modulo: string; resumen: string }>;
}

// ── GitHub ──────────────────────────────────────────────────────────────────

/**
 * Los PRs de un repo tocados dentro de la ventana.
 *
 * Una sola llamada por repo, ordenada por actualización: para una semana, los
 * 100 más recientes sobran. Sin token porque los repos son públicos; si deja
 * de serlo, GitHub responde 404 y eso se reporta como problema, no como cero.
 */
async function prsDelRepo(owner: string, nombre: string, desde: string, hasta: string): Promise<AporteRepo> {
  const repo = `${owner}/${nombre}`;
  const url = `https://api.github.com/repos/${owner}/${nombre}/pulls`
    + `?state=all&sort=updated&direction=desc&per_page=100`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "movi-reporte-semanal" },
    });
    if (!res.ok) {
      const pista = res.status === 404
        ? "no existe o dejó de ser público"
        : res.status === 403
          ? "GitHub limitó las consultas por ahora"
          : `GitHub respondió ${res.status}`;
      return { repo, prs: [], problema: pista };
    }
    const lista = await res.json() as Array<Record<string, any>>;
    const dentro = (iso: string | null) => !!iso && iso >= desde && iso <= hasta;
    const prs = lista
      .filter(p => dentro(p.created_at) || dentro(p.merged_at) || dentro(p.closed_at))
      .map(p => ({
        numero: p.number as number,
        titulo: String(p.title ?? "").slice(0, 110),
        estado: p.merged_at ? "integrado" : p.state === "closed" ? "cerrado" : "abierto",
        fecha: String(p.merged_at ?? p.created_at ?? "").slice(0, 10),
        autor: String(p.user?.login ?? "").toLowerCase(),
      })) as Array<{ numero: number; titulo: string; estado: string; fecha: string; autor: string }>;
    return { repo, prs: prs as any };
  } catch (e) {
    return { repo, prs: [], problema: `no se pudo consultar (${(e as Error).message})` };
  }
}

// ── El contenido del reporte, en texto ──────────────────────────────────────

function armarTexto(
  desde: string, hasta: string,
  filas: Array<{ persona: Persona; repos: AporteRepo[]; movi: ActividadMovi }>,
  problemas: string[],
): string {
  const L: string[] = [];
  L.push(`REPORTE SEMANAL DE ACTIVIDAD`);
  L.push(`Del ${diaLegible(desde)} al ${diaLegible(hasta)}`);
  L.push("");

  if (problemas.length) {
    L.push(`AVISO — el reporte está incompleto:`);
    for (const p of problemas) L.push(`  · ${p}`);
    L.push("");
  }

  if (!filas.length) {
    L.push("No hay nadie configurado en `reportes_personas`.");
    return L.join("\n");
  }

  for (const { persona, repos, movi } of filas) {
    L.push(`${persona.nombre}`);
    L.push("-".repeat(Math.min(persona.nombre.length, 60)));

    // GitHub
    const conPr = repos.filter(r => r.prs.length);
    const totalPrs = repos.reduce((n, r) => n + r.prs.length, 0);
    if (!persona.github) {
      L.push(`  GitHub: sin cuenta ligada (se liga en reportes_personas).`);
    } else if (totalPrs === 0) {
      const rotos = repos.filter(r => r.problema);
      L.push(rotos.length
        ? `  GitHub: sin pull requests esta semana en los repos que sí se pudieron leer.`
        : `  GitHub: sin pull requests esta semana.`);
    } else {
      L.push(`  GitHub: ${totalPrs} pull request${totalPrs === 1 ? "" : "s"}.`);
      for (const r of conPr) {
        L.push(`    ${r.repo}`);
        for (const pr of r.prs) L.push(`      #${pr.numero} (${pr.estado}, ${pr.fecha}) ${pr.titulo}`);
      }
    }
    for (const r of repos.filter(x => x.problema)) {
      L.push(`    ⚠ ${r.repo}: ${r.problema}`);
    }

    // MOVI
    L.push("");
    if (movi.total === 0) {
      L.push(`  En MOVI: sin actividad registrada esta semana.`);
    } else {
      L.push(`  En MOVI: ${movi.total} acciones registradas.`);
      for (const m of movi.porModulo.slice(0, 8)) L.push(`    ${m.modulo}: ${m.n}`);
      if (movi.ultimas.length) {
        L.push(`    Lo último:`);
        for (const u of movi.ultimas.slice(0, 6)) L.push(`      ${u.cuando} · ${u.modulo} · ${u.resumen}`);
      }
    }
    L.push("");
  }

  L.push("");
  L.push(`Lo de MOVI sale de user_activity_logs, la misma bitácora que enseña`);
  L.push(`Admin → Actividad. Lo de GitHub, de los pull requests de los repos`);
  L.push(`configurados en reportes_repos.`);
  return L.join("\n");
}

// ── PDF ─────────────────────────────────────────────────────────────────────

/**
 * Devuelve el PDF en base64, o null si no se pudo generar.
 *
 * Que falle NO cancela el reporte: arriba se guarda el texto igual y el correo
 * lleva el contenido en el cuerpo. El PDF presenta el dato, no es el dato.
 */
async function hacerPdf(texto: string): Promise<string | null> {
  try {
    const mod: any = await import("npm:jspdf@2.5.2");
    const JsPDF = mod.jsPDF ?? mod.default?.jsPDF ?? mod.default;
    const doc = new JsPDF({ unit: "pt", format: "letter" });

    const MARGEN = 48;
    const ANCHO = 612 - MARGEN * 2;
    const ALTO = 792 - MARGEN;
    let y = MARGEN;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    for (const linea of texto.split("\n")) {
      // Los títulos (sin sangría y en mayúsculas) van en negritas.
      const esTitulo = linea === linea.toUpperCase() && linea.trim().length > 3 && !linea.startsWith(" ");
      doc.setFont("helvetica", esTitulo ? "bold" : "normal");
      const trozos: string[] = doc.splitTextToSize(linea || " ", ANCHO);
      for (const t of trozos) {
        if (y > ALTO) { doc.addPage(); y = MARGEN; }
        doc.text(t, MARGEN, y);
        y += 13;
      }
    }
    return doc.output("datauristring").split(",")[1] ?? null;
  } catch (e) {
    console.error("[resumen-semanal] no se pudo generar el PDF:", (e as Error).message);
    return null;
  }
}

// ── Correo ──────────────────────────────────────────────────────────────────

async function mandarCorreo(
  para: string[], asunto: string, texto: string, pdfBase64: string | null, nombreArchivo: string,
): Promise<{ ok: boolean; detalle: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, detalle: "falta RESEND_API_KEY" };
  try {
    const cuerpo: Record<string, unknown> = {
      from: "MOVI Digital <notificaciones@movi.digital>",
      to: para,
      subject: asunto,
      // El contenido va SIEMPRE en el cuerpo, haya PDF o no: si el adjunto
      // falla, el correo sigue sirviendo para algo.
      html: `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap">${
        texto.replace(/&/g, "&amp;").replace(/</g, "&lt;")
      }</pre>`,
    };
    if (pdfBase64) cuerpo.attachments = [{ filename: nombreArchivo, content: pdfBase64 }];

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) return { ok: false, detalle: `Resend ${res.status}: ${(await res.text()).slice(0, 160)}` };
    return { ok: true, detalle: pdfBase64 ? "enviado con PDF" : "enviado sin PDF (no se pudo generar)" };
  } catch (e) {
    return { ok: false, detalle: (e as Error).message };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // ── Quién puede dispararlo ───────────────────────────────────────────
    //
    // El cron entra con la llave de servicio; una persona, con su sesión y
    // siendo Administrador. La comparación de la llave es EXACTA: un
    // `includes()` con la variable vacía daría siempre verdadero y cualquiera
    // con la URL podría dispararlo (fue un hueco real el 15/10).
    const auth = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    let permitido = !!serviceKey && auth === serviceKey;
    if (!permitido && auth) {
      const { data: { user } } = await supabase.auth.getUser(auth);
      if (user) {
        const { data: quien } = await supabase
          .from("usuarios").select("rol, activo").eq("id", user.id).maybeSingle();
        permitido = !!quien && quien.activo !== false && quien.rol === "Administrador";
      }
    }
    if (!permitido) return json({ error: "No autorizado" }, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const hastaD = body.hasta ? new Date(body.hasta) : new Date();
    const desdeD = body.desde ? new Date(body.desde) : new Date(hastaD.getTime() - 7 * 24 * 3600 * 1000);
    const desde = desdeD.toISOString();
    const hasta = hastaD.toISOString();
    /** Sin destinatarios NO se manda correo. Evita un envío masivo por descuido. */
    const para: string[] = Array.isArray(body.para) ? body.para.filter(Boolean) : [];

    const problemas: string[] = [];

    // ── A quién se sigue ─────────────────────────────────────────────────
    const { data: personasRaw, error: errPersonas } = await supabase
      .from("reportes_personas")
      .select("usuario_id, github_usuario, usuario:usuarios(nombre_completo)")
      .eq("activo", true);
    if (errPersonas) return json({ error: `No se pudo leer reportes_personas: ${errPersonas.message}` }, 500);

    const personas: Persona[] = (personasRaw ?? []).map((p: any) => ({
      usuario_id: p.usuario_id,
      nombre: p.usuario?.nombre_completo ?? "(sin nombre)",
      github: p.github_usuario ? String(p.github_usuario).toLowerCase() : null,
    }));

    // ── Qué repos ────────────────────────────────────────────────────────
    const { data: reposRaw, error: errRepos } = await supabase
      .from("reportes_repos").select("owner, nombre").eq("activo", true);
    if (errRepos) problemas.push(`no se pudo leer la lista de repos: ${errRepos.message}`);

    const aportes: AporteRepo[] = [];
    for (const r of (reposRaw ?? [])) {
      const a = await prsDelRepo(r.owner, r.nombre, desde, hasta);
      if (a.problema) problemas.push(`${a.repo}: ${a.problema}`);
      aportes.push(a);
    }

    // ── Armar una fila por persona ───────────────────────────────────────
    const filas = [];
    for (const persona of personas) {
      const repos: AporteRepo[] = aportes.map(a => ({
        repo: a.repo,
        problema: a.problema,
        prs: persona.github ? (a.prs as any[]).filter(p => p.autor === persona.github) : [],
      }));

      const { data: logs, error: errLogs } = await supabase
        .from("user_activity_logs")
        .select("module, summary, created_at")
        .eq("user_id", persona.usuario_id)
        .gte("created_at", desde).lte("created_at", hasta)
        .order("created_at", { ascending: false })
        .limit(500);
      if (errLogs) problemas.push(`actividad de ${persona.nombre}: ${errLogs.message}`);

      const porModulo = new Map<string, number>();
      for (const l of (logs ?? [])) porModulo.set(l.module, (porModulo.get(l.module) ?? 0) + 1);

      const movi: ActividadMovi = {
        total: (logs ?? []).length,
        porModulo: [...porModulo.entries()].map(([modulo, n]) => ({ modulo, n })).sort((a, b) => b.n - a.n),
        ultimas: (logs ?? []).slice(0, 6).map((l: any) => ({
          cuando: String(l.created_at).slice(5, 16).replace("T", " "),
          modulo: l.module,
          resumen: String(l.summary ?? "").slice(0, 70),
        })),
      };
      filas.push({ persona, repos, movi });
    }

    // ── Texto, PDF, Storage, correo ──────────────────────────────────────
    const texto = armarTexto(desde, hasta, filas, problemas);
    const pdf = await hacerPdf(texto);
    if (!pdf) problemas.push("no se pudo generar el PDF; el reporte va en texto");

    const base = `reporte-semanal-${soloFecha(hastaD)}`;
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => { /* ya existía */ });

    const subidas: string[] = [];
    const guardar = async (nombre: string, contenido: Uint8Array | string, tipo: string) => {
      const { error } = await supabase.storage.from(BUCKET)
        .upload(nombre, contenido, { contentType: tipo, upsert: true });
      if (error) problemas.push(`no se pudo guardar ${nombre}: ${error.message}`);
      else subidas.push(nombre);
    };
    await guardar(`${base}.txt`, texto, "text/plain; charset=utf-8");
    await guardar("ultimo.txt", texto, "text/plain; charset=utf-8");
    if (pdf) {
      const bytes = Uint8Array.from(atob(pdf), c => c.charCodeAt(0));
      await guardar(`${base}.pdf`, bytes, "application/pdf");
      await guardar("ultimo.pdf", bytes, "application/pdf");
    }

    let correo = { ok: false, detalle: "sin destinatarios: no se mandó correo" };
    if (para.length) {
      correo = await mandarCorreo(
        para,
        `Reporte semanal de actividad — ${diaLegible(desde)} al ${diaLegible(hasta)}`,
        texto, pdf, `${base}.pdf`,
      );
      if (!correo.ok) problemas.push(`correo: ${correo.detalle}`);
    }

    return json({
      ok: true,
      ventana: { desde, hasta },
      personas: filas.length,
      repos: aportes.map(a => ({ repo: a.repo, prs: a.prs.length, problema: a.problema })),
      archivos: subidas,
      correo,
      // Siempre se dice qué quedó cojo. Un reporte que informa cero cuando en
      // realidad no pudo mirar es peor que no tener reporte.
      problemas,
      vistaPrevia: texto.slice(0, 1200),
    });
  } catch (e) {
    console.error("[resumen-semanal] error:", (e as Error).message);
    return json({ error: "No se pudo generar el reporte", detalle: (e as Error).message }, 500);
  }
});
