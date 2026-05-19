import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "POST" ? (await req.json().catch(() => ({}))).action : null);

    // Handle GET actions via query params
    if (req.method === "GET") {
      const getAction = url.searchParams.get("action");

      if (getAction === "health_report") {
        const { data, error } = await supabase.rpc("sicas_get_health_report");
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (getAction === "list_mappings") {
        const status = url.searchParams.get("status");
        const match_type = url.searchParams.get("match_type");
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = (page - 1) * limit;
        const search = url.searchParams.get("search");

        let query = supabase
          .from("sicas_vendor_user_mappings")
          .select(`
            *,
            usuario:movi_user_id (
              id,
              nombre,
              apellidos,
              email,
              oficina_id,
              oficina:oficina_id (nombre)
            )
          `, { count: "exact" });

        if (status) query = query.eq("status", status);
        if (match_type) query = query.eq("match_type", match_type);
        if (search) {
          query = query.or(`vend_nombre.ilike.%${search}%,vend_id.ilike.%${search}%`);
        }

        query = query.order("total_docs", { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, data, total: count, page, limit }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (getAction === "stats") {
        const { data: stats, error: statsError } = await supabase
          .from("sicas_vendor_user_mappings")
          .select("status, match_type")
          .then(async (res) => {
            if (res.error) return res;
            const grouped: Record<string, number> = {};
            const byType: Record<string, number> = {};
            let total = 0;
            for (const r of res.data || []) {
              grouped[r.status] = (grouped[r.status] || 0) + 1;
              if (r.match_type) byType[r.match_type] = (byType[r.match_type] || 0) + 1;
              total++;
            }
            return { data: { total, by_status: grouped, by_match_type: byType }, error: null };
          });
        if (statsError) throw statsError;

        const { data: docStats } = await supabase
          .from("sicas_documents")
          .select("usuario_id")
          .then(async (res) => {
            if (res.error) return res;
            let withUser = 0;
            let total = 0;
            for (const r of res.data || []) {
              total++;
              if (r.usuario_id) withUser++;
            }
            return { data: { total_docs: total, docs_with_user: withUser }, error: null };
          });

        return new Response(JSON.stringify({ success: true, mapping_stats: stats, doc_stats: docStats }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (getAction === "search_users") {
        const q = url.searchParams.get("q") || "";
        const { data, error } = await supabase
          .from("usuarios")
          .select("id, nombre, apellidos, email, oficina_id, oficina:oficina_id(nombre)")
          .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%,email.ilike.%${q}%`)
          .eq("activo", true)
          .limit(20);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown GET action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST actions
    const body = await req.json().catch(() => ({}));
    const postAction = body.action;

    if (postAction === "auto_map") {
      const dry_run = body.dry_run === true;
      const { data, error } = await supabase.rpc("sicas_auto_map_vendors", { p_dry_run: dry_run });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (postAction === "fix_expired_vigentes") {
      const apply = body.apply === true;
      const { data, error } = await supabase.rpc("sicas_fix_expired_vigentes", { p_apply: apply });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (postAction === "build_aseguradoras") {
      const { data, error } = await supabase.rpc("sicas_build_derived_aseguradoras");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (postAction === "sync_mapping_stats") {
      const { data, error } = await supabase.rpc("sicas_sync_mapping_stats");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (postAction === "manual_link") {
      const { vend_id, user_id } = body;
      if (!vend_id || !user_id) {
        return new Response(JSON.stringify({ error: "vend_id and user_id are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get vendor info
      const { data: vendor } = await supabase
        .from("sicas_vendor_user_mappings")
        .select("vend_nombre, total_docs, prima_neta_total")
        .eq("vend_id", vend_id)
        .maybeSingle();

      const { data, error } = await supabase
        .from("sicas_vendor_user_mappings")
        .upsert({
          vend_id,
          vend_nombre: vendor?.vend_nombre || vend_id,
          movi_user_id: user_id,
          status: "active",
          match_type: "manual",
          confidence_score: 100,
          matched_by: "manual",
          total_docs: vendor?.total_docs || 0,
          prima_neta_total: vendor?.prima_neta_total || 0,
        }, { onConflict: "vend_id" });

      if (error) throw error;

      // Update sicas_documents
      const { error: updateError } = await supabase
        .from("sicas_documents")
        .update({ usuario_id: user_id })
        .eq("vendedor_id", vend_id);

      if (updateError) console.error("Error updating documents:", updateError);

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (postAction === "manual_unlink") {
      const { vend_id } = body;
      if (!vend_id) {
        return new Response(JSON.stringify({ error: "vend_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("sicas_vendor_user_mappings")
        .update({ status: "pending_review", movi_user_id: null, match_type: "no_match", confidence_score: 0 })
        .eq("vend_id", vend_id);

      if (error) throw error;

      // Clear usuario_id from documents
      const { error: updateError } = await supabase
        .from("sicas_documents")
        .update({ usuario_id: null })
        .eq("vendedor_id", vend_id);

      if (updateError) console.error("Error clearing documents:", updateError);

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("sicas-map-vendors error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
