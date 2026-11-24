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

async function verifyIMAPConnection(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  let conn: Deno.TlsConn | null = null;
  
  try {
    // Conectar a IMAP IONOS
    const rawConn = await Deno.connect({
      hostname: 'imap.ionos.mx',
      port: 993,
      transport: 'tcp',
    });

    conn = await Deno.startTls(rawConn, { hostname: 'imap.ionos.mx' });

    // Leer banner de bienvenida
    const buffer = new Uint8Array(4096);
    await conn.read(buffer);

    // Enviar comando LOGIN
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const loginCmd = `A001 LOGIN "${email}" "${password}"\r\n`;
    await conn.write(encoder.encode(loginCmd));

    // Leer respuesta
    const responseBuffer = new Uint8Array(4096);
    const n = await conn.read(responseBuffer);
    
    if (n === null) {
      throw new Error('No se recibió respuesta del servidor');
    }

    const response = decoder.decode(responseBuffer.subarray(0, n));
    
    // Verificar si el login fue exitoso
    if (response.includes('A001 OK')) {
      // Enviar LOGOUT antes de cerrar
      await conn.write(encoder.encode('A002 LOGOUT\r\n'));
      await conn.read(responseBuffer);
      return { success: true };
    } else if (response.includes('NO') || response.includes('BAD')) {
      return { success: false, error: 'Credenciales inválidas' };
    } else {
      return { success: false, error: 'Respuesta inesperada del servidor' };
    }

  } catch (error: any) {
    console.error('Error en conexión IMAP:', error);
    return { 
      success: false, 
      error: error.message.includes('connection refused') 
        ? 'No se pudo conectar al servidor'
        : error.message
    };
  } finally {
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        console.error('Error cerrando conexión:', e);
      }
    }
  }
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

    // Verificar formato de email
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

    // Intentar conexión real a IMAP
    const result = await verifyIMAPConnection(body.email, body.password);

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Conexión exitosa con servidor IONOS IMAP',
          servers: {
            imap: 'imap.ionos.mx:993',
            smtp: 'smtp.ionos.mx:465'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: result.error || 'Error al verificar conexión'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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