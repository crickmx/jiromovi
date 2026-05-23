import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MonitorResult {
  url: string;
  http_code: number | null;
  response_time: number | null;
  ssl_status: string | null;
  status: "OK" | "ADVERTENCIA" | "CRITICO";
  diagnosis: string;
  error: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let urls: string[] = [];

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.urls && Array.isArray(body.urls)) {
        urls = body.urls;
      }
    }

    if (urls.length === 0) {
      const { data: sites } = await supabase
        .from("monitored_sites")
        .select("url");
      urls = (sites || []).map((s: { url: string }) => s.url);
    }

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ message: "No URLs to monitor", results: [] }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const results: MonitorResult[] = await Promise.all(urls.map(checkUrl));

    for (const result of results) {
      const { data: site } = await supabase
        .from("monitored_sites")
        .select("id, last_status, last_ssl_status")
        .eq("url", result.url)
        .maybeSingle();

      if (!site) {
        const { data: newSite } = await supabase
          .from("monitored_sites")
          .insert({
            url: result.url,
            last_check: new Date().toISOString(),
            last_status: result.status,
            last_http_code: result.http_code,
            last_response_time: result.response_time,
            last_ssl_status: result.ssl_status,
            last_diagnosis: result.diagnosis,
          })
          .select("id")
          .maybeSingle();

        if (newSite) {
          await supabase.from("site_history").insert({
            site_id: newSite.id,
            status: result.status,
            http_code: result.http_code,
            response_time: result.response_time,
            ssl_status: result.ssl_status,
            diagnosis: result.diagnosis,
          });
        }
        continue;
      }

      const previousStatus = site.last_status;
      const previousSsl = site.last_ssl_status;

      const updateData: Record<string, unknown> = {
        last_check: new Date().toISOString(),
        last_status: result.status,
        last_http_code: result.http_code,
        last_response_time: result.response_time,
        last_ssl_status: result.ssl_status,
        last_diagnosis: result.diagnosis,
      };

      if (previousStatus && previousStatus !== result.status) {
        updateData.previous_status = previousStatus;
        updateData.status_changed_at = new Date().toISOString();
      }
      if (previousSsl && previousSsl !== result.ssl_status) {
        updateData.previous_ssl_status = previousSsl;
        updateData.ssl_changed_at = new Date().toISOString();
      }

      await supabase
        .from("monitored_sites")
        .update(updateData)
        .eq("id", site.id);

      if (previousStatus && previousStatus !== result.status) {
        await supabase.from("status_changes").insert({
          site_id: site.id,
          url: result.url,
          change_type: "status",
          old_value: previousStatus,
          new_value: result.status,
        });
      }

      if (previousSsl && previousSsl !== result.ssl_status) {
        await supabase.from("status_changes").insert({
          site_id: site.id,
          url: result.url,
          change_type: "ssl",
          old_value: previousSsl,
          new_value: result.ssl_status,
        });
      }

      await supabase.from("site_history").insert({
        site_id: site.id,
        status: result.status,
        http_code: result.http_code,
        response_time: result.response_time,
        ssl_status: result.ssl_status,
        diagnosis: result.diagnosis,
      });
    }

    const summary = {
      total: results.length,
      ok: results.filter((r) => r.status === "OK").length,
      warning: results.filter((r) => r.status === "ADVERTENCIA").length,
      critical: results.filter((r) => r.status === "CRITICO").length,
    };

    return new Response(
      JSON.stringify({ summary, results }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

async function checkUrl(url: string): Promise<MonitorResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    const httpCode = response.status;

    const sslStatus = url.startsWith("https://") ? "VALIDO" : "NO_HTTPS";
    let status: "OK" | "ADVERTENCIA" | "CRITICO";
    let diagnosis: string;

    if (httpCode >= 200 && httpCode < 300) {
      if (responseTime > 3000) {
        status = "ADVERTENCIA";
        diagnosis = `Respuesta lenta (${responseTime}ms)`;
      } else {
        status = "OK";
        diagnosis = `Funcionando correctamente (${responseTime}ms)`;
      }
    } else if (httpCode >= 300 && httpCode < 400) {
      status = "ADVERTENCIA";
      diagnosis = `Redireccion ${httpCode}`;
    } else {
      status = "CRITICO";
      diagnosis = `Error HTTP ${httpCode}`;
    }

    return { url, http_code: httpCode, response_time: responseTime, ssl_status: sslStatus, status, diagnosis, error: null };
  } catch (err) {
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    const errorMsg = err instanceof Error
      ? (err.name === "AbortError" ? "Timeout (15s)" : err.message)
      : "Error desconocido";

    return { url, http_code: null, response_time: responseTime, ssl_status: null, status: "CRITICO", diagnosis: errorMsg, error: errorMsg };
  }
}
