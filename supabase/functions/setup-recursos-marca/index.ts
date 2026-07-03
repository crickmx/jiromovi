import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que el usuario es Administrador
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: perfil } = await userClient
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (perfil?.rol !== "Administrador") {
      return new Response(JSON.stringify({ error: "Acceso denegado — solo administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Crear bucket con service role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: bucketErr } = await adminClient.storage.createBucket("recursos-marca", {
      public: false,
      fileSizeLimit: 52428800,
      allowedMimeTypes: [
        "image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif",
        "application/pdf", "application/zip", "application/x-zip-compressed",
      ],
    });

    if (bucketErr && !bucketErr.message?.toLowerCase().includes("already exists")) {
      throw new Error(`Error creando bucket: ${bucketErr.message}`);
    }

    // Crear políticas RLS vía conexión directa a Postgres
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (dbUrl) {
      const sql = postgres(dbUrl, { prepare: false });
      try {
        await sql`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies
              WHERE schemaname = 'storage' AND tablename = 'objects'
              AND policyname = 'Usuarios autenticados pueden leer recursos de marca'
            ) THEN
              CREATE POLICY "Usuarios autenticados pueden leer recursos de marca"
                ON storage.objects FOR SELECT
                USING (bucket_id = 'recursos-marca' AND auth.role() = 'authenticated');
            END IF;
          END $$;
        `;
        await sql`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies
              WHERE schemaname = 'storage' AND tablename = 'objects'
              AND policyname = 'Admins pueden subir recursos de marca'
            ) THEN
              CREATE POLICY "Admins pueden subir recursos de marca"
                ON storage.objects FOR INSERT
                WITH CHECK (
                  bucket_id = 'recursos-marca' AND
                  EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
                );
            END IF;
          END $$;
        `;
        await sql`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies
              WHERE schemaname = 'storage' AND tablename = 'objects'
              AND policyname = 'Admins pueden eliminar recursos de marca'
            ) THEN
              CREATE POLICY "Admins pueden eliminar recursos de marca"
                ON storage.objects FOR DELETE
                USING (
                  bucket_id = 'recursos-marca' AND
                  EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador')
                );
            END IF;
          END $$;
        `;
      } finally {
        await sql.end();
      }
    }

    return new Response(
      JSON.stringify({ ok: true, message: "Brand Kit configurado correctamente" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
