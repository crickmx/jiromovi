import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SyncRequest {
  configuracionId: string;
  carpeta?: string;
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

    const body: SyncRequest = await req.json();
    const carpeta = body.carpeta || 'INBOX';

    // Obtener configuración del usuario
    const { data: config, error: configError } = await supabase
      .from('email_configuraciones')
      .select('*')
      .eq('id', body.configuracionId)
      .eq('usuario_id', user.id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Configuración no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Simular sincronización IMAP
    // En producción, aquí se usaría una librería IMAP real
    // Por ahora, devolvemos mensajes simulados para demostración
    const mensajesSimulados = [
      {
        message_uid: `msg_${Date.now()}_1`,
        message_id: `<${Date.now()}.1@example.com>`,
        remitente: 'Juan Pérez',
        remitente_email: 'juan@example.com',
        destinatarios: [config.email],
        cc: [],
        bcc: [],
        asunto: 'Bienvenido al Gestor de E-Mails',
        cuerpo_texto: 'Este es un correo de ejemplo para demostrar el funcionamiento del gestor.',
        cuerpo_html: '<p>Este es un correo de ejemplo para demostrar el funcionamiento del gestor.</p>',
        fecha: new Date(Date.now() - 3600000).toISOString(),
        leido: false,
        marcado: false,
        tiene_adjuntos: false,
        size_bytes: 1024,
        etiquetas: []
      },
      {
        message_uid: `msg_${Date.now()}_2`,
        message_id: `<${Date.now()}.2@example.com>`,
        remitente: 'María García',
        remitente_email: 'maria@example.com',
        destinatarios: [config.email],
        cc: [],
        bcc: [],
        asunto: 'Reunión importante',
        cuerpo_texto: 'Te recuerdo la reunión de mañana a las 10:00 AM.',
        cuerpo_html: '<p>Te recuerdo la reunión de mañana a las <strong>10:00 AM</strong>.</p>',
        fecha: new Date(Date.now() - 7200000).toISOString(),
        leido: false,
        marcado: true,
        tiene_adjuntos: true,
        size_bytes: 2048,
        etiquetas: ['importante']
      }
    ];

    // Guardar mensajes en caché
    for (const msg of mensajesSimulados) {
      await supabase
        .from('email_mensajes_cache')
        .upsert({
          usuario_id: user.id,
          configuracion_id: config.id,
          carpeta: carpeta,
          ...msg
        }, {
          onConflict: 'usuario_id,message_uid,carpeta'
        });
    }

    // Actualizar última sincronización
    await supabase
      .from('email_configuraciones')
      .update({
        ultima_sincronizacion: new Date().toISOString(),
        estado_conexion: 'conectado'
      })
      .eq('id', config.id);

    return new Response(
      JSON.stringify({
        success: true,
        mensajes: mensajesSimulados.length,
        ultimaSincronizacion: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error en sincronización:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al sincronizar' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});