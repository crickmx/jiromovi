import { createClient } from "npm:@supabase/supabase-js@2";

const PAGE_MAX = 5000;

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("BONOS_EXPORT_SECRET");
  if (!secret || req.headers.get("X-Bonos-Secret") !== secret) {
    return json(401, { error: "Unauthorized" });
  }

  const url = new URL(req.url);
  const reportType = url.searchParams.get("report_type") ?? "efectuada";
  if (reportType !== "efectuada" && reportType !== "pendiente") {
    return json(400, { error: "report_type debe ser 'efectuada' o 'pendiente'" });
  }
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "1000"), PAGE_MAX);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error, count } = await supabase
    .from("sicas_ccj_records")
    .select("row_data", { count: "exact" })
    .eq("report_type", reportType)
    .eq("is_active", true)
    .order("source_page")
    .order("source_index")
    .range(offset, offset + limit - 1);

  if (error) return json(500, { error: error.message });

  return json(200, {
    rows:     (data ?? []).map((r: { row_data: unknown }) => r.row_data),
    total:    count ?? 0,
    limit,
    offset,
    has_more: offset + limit < (count ?? 0),
  });
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
