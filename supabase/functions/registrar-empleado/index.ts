import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RegistroEmpleadoRequest {
  nombre: string;
  apellidos: string;
  puesto: string;
  oficina_id: string;
  fecha_nacimiento: string;
  fecha_ingreso_jiro: string;
  celular_laboral: string;
  email_laboral: string;
  extension_telefonica?: string;
  foto_perfil_url?: string;
  equipo_computo_marca: string;
  equipo_computo_modelo: string;
  equipo_celular_marca: string;
  equipo_celular_modelo: string;
}

function generarPasswordSegura(): string {
  const mayusculas = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const minusculas = 'abcdefghijklmnopqrstuvwxyz';
  const numeros = '0123456789';
  const especiales = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const todos = mayusculas + minusculas + numeros + especiales;

  let password = '';
  password += mayusculas[Math.floor(Math.random() * mayusculas.length)];
  password += minusculas[Math.floor(Math.random() * minusculas.length)];
  password += numeros[Math.floor(Math.random() * numeros.length)];
  password += especiales[Math.floor(Math.random() * especiales.length)];

  for (let i = 4; i < 16; i++) {
    password += todos[Math.floor(Math.random() * todos.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: usuarioActual, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("rol, activo")
      .eq("id", user.id)
      .single();

    if (usuarioError || !usuarioActual || usuarioActual.rol !== "Administrador" || !usuarioActual.activo) {
      return new Response(
        JSON.stringify({ error: "No tiene permisos para realizar esta operación" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const datosEmpleado: RegistroEmpleadoRequest = await req.json();

    const {
      nombre,
      apellidos,
      puesto,
      oficina_id,
      fecha_nacimiento,
      fecha_ingreso_jiro,
      celular_laboral,
      email_laboral,
      extension_telefonica,
      foto_perfil_url,
      equipo_computo_marca,
      equipo_computo_modelo,
      equipo_celular_marca,
      equipo_celular_modelo,
    } = datosEmpleado;

    if (!nombre || !apellidos || !puesto || !oficina_id || !fecha_nacimiento ||
        !fecha_ingreso_jiro || !celular_laboral || !email_laboral ||
        !equipo_computo_marca || !equipo_computo_modelo ||
        !equipo_celular_marca || !equipo_celular_modelo) {
      return new Response(
        JSON.stringify({ error: "Faltan campos obligatorios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailNormalizado = email_laboral.toLowerCase().trim();

    const { data: emailExistente } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("email_laboral", emailNormalizado)
      .maybeSingle();

    if (emailExistente) {
      return new Response(
        JSON.stringify({ error: "El email laboral ya está registrado" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const passwordGenerada = generarPasswordSegura();

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailNormalizado,
      password: passwordGenerada,
      email_confirm: true,
    });

    if (authError || !authUser.user) {
      console.error("Error creando usuario de auth:", authError);
      return new Response(
        JSON.stringify({ error: "Error al crear usuario de autenticación" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: insertUsuarioError } = await supabaseAdmin
      .from("usuarios")
      .insert({
        id: authUser.user.id,
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        puesto: puesto.trim(),
        oficina_id,
        fecha_nacimiento,
        fecha_ingreso_jiro,
        celular_laboral: celular_laboral.trim(),
        email_laboral: emailNormalizado,
        extension_telefonica: extension_telefonica?.trim() || null,
        imagen_perfil_url: foto_perfil_url || null,
        equipo_computo_marca: equipo_computo_marca.trim(),
        equipo_computo_modelo: equipo_computo_modelo.trim(),
        equipo_celular_marca: equipo_celular_marca.trim(),
        equipo_celular_modelo: equipo_celular_modelo.trim(),
        rol: "Empleado",
        activo: false,
        status: "pendiente_activacion",
        created_by: user.id,
        password_generated_at: new Date().toISOString(),
        nombre_completo: `${nombre.trim()} ${apellidos.trim()}`,
      });

    if (insertUsuarioError) {
      console.error("Error insertando usuario:", insertUsuarioError);

      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);

      return new Response(
        JSON.stringify({ error: "Error al crear perfil de usuario" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabaseAdmin
      .from("auditoria_usuarios")
      .insert({
        usuario_id: authUser.user.id,
        accion: "crear_empleado",
        realizado_por: user.id,
        detalles: {
          nombre,
          apellidos,
          email_laboral: emailNormalizado,
          puesto,
          oficina_id,
          rol: "Empleado",
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Empleado registrado correctamente",
        usuario_id: authUser.user.id,
        email: emailNormalizado,
        status: "pendiente_activacion",
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error en registrar-empleado:", error);
    return new Response(
      JSON.stringify({
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
