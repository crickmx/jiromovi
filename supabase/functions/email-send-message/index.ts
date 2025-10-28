import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SendEmailRequest {
  configuracionId: string;
  destinatarios: string[];
  cc?: string[];
  bcc?: string[];
  asunto: string;
  cuerpoHtml: string;
  adjuntos?: any[];
  programado?: boolean;
  fechaProgramada?: string;
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

    const body: SendEmailRequest = await req.json();

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

    // Si es programado, guardar en tabla de programados
    if (body.programado && body.fechaProgramada) {
      const { data: programado, error: progError } = await supabase
        .from('email_programados')
        .insert({
          usuario_id: user.id,
          configuracion_id: config.id,
          destinatarios: body.destinatarios,
          cc: body.cc || [],
          bcc: body.bcc || [],
          asunto: body.asunto,
          cuerpo_html: body.cuerpoHtml,
          adjuntos: body.adjuntos || [],
          fecha_programada: body.fechaProgramada,
          estado: 'pendiente'
        })
        .select()
        .single();

      if (progError) {
        throw new Error('Error al programar envío');
      }

      return new Response(
        JSON.stringify({
          success: true,
          programado: true,
          id: programado.id,
          fechaProgramada: body.fechaProgramada
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar inmediatamente
    // En producción, aquí se usaría SMTP real (nodemailer u otra librería)
    // Por ahora simulamos el envío
    const messageId = `<${Date.now()}.${Math.random().toString(36)}@${config.servidor_salida}>`;

    // Guardar en enviados (caché)
    await supabase
      .from('email_mensajes_cache')
      .insert({
        usuario_id: user.id,
        configuracion_id: config.id,
        carpeta: 'SENT',
        message_uid: `sent_${Date.now()}`,
        message_id: messageId,
        remitente: config.nombre_remitente || user.email,
        remitente_email: config.email,
        destinatarios: body.destinatarios,
        cc: body.cc || [],
        bcc: body.bcc || [],
        asunto: body.asunto,
        cuerpo_texto: body.cuerpoHtml.replace(/<[^>]*>/g, ''),
        cuerpo_html: body.cuerpoHtml,
        fecha: new Date().toISOString(),
        leido: true,
        marcado: false,
        tiene_adjuntos: (body.adjuntos?.length || 0) > 0,
        size_bytes: body.cuerpoHtml.length,
        etiquetas: []
      });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: messageId,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error al enviar correo:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al enviar correo' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});