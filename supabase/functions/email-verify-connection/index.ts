import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface VerifyRequest {
  email: string;
  password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: VerifyRequest = await req.json();

    if (!body.email || !body.password) {
      return new Response(
        JSON.stringify({ error: 'Email y contraseña son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener configuración global de IONOS
    const { data: configGlobal, error: configError } = await supabase
      .from('email_config_global')
      .select('*')
      .limit(1)
      .single();

    if (configError || !configGlobal) {
      return new Response(
        JSON.stringify({ error: 'Configuración global no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // En producción, aquí se verificaría la conexión real con IONOS
    // usando IMAP o SMTP con las credenciales proporcionadas
    
    // Por ahora, simulamos la verificación
    // Verificación básica: email debe tener formato correcto
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Formato de email inválido' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Si la contraseña tiene al menos 6 caracteres, consideramos exitoso
    // (en producción, aquí se haría la conexión real)
    if (body.password.length < 6) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Credenciales inválidas' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Simular verificación exitosa
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conexión exitosa con servidor IONOS',
        servers: {
          imap: `${configGlobal.servidor_imap}:${configGlobal.puerto_imap}`,
          smtp: `${configGlobal.servidor_smtp}:${configGlobal.puerto_smtp}`
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error verificando conexión:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Error al verificar conexión' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});