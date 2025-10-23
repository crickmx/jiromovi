import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SendEmailRequest {
  plantillaId: string | null;
  destinatarios: Array<{
    id: string;
    email: string;
    nombre: string;
    [key: string]: any;
  }>;
  asuntoPersonalizado?: string;
  cuerpoPersonalizado?: string;
  tipoEnvio: 'manual' | 'automatico';
}

function reemplazarPlaceholders(texto: string, variables: Record<string, any>): string {
  let resultado = texto;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    resultado = resultado.replace(regex, String(value || ''));
  }
  return resultado;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      plantillaId,
      destinatarios,
      asuntoPersonalizado,
      cuerpoPersonalizado,
      tipoEnvio,
    }: SendEmailRequest = await req.json();

    if (!destinatarios || destinatarios.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Recipients are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let plantilla = null;
    if (plantillaId) {
      const { data: plantillaData, error: plantillaError } = await supabaseAdmin
        .from('plantillas_correo')
        .select('*')
        .eq('id', plantillaId)
        .single();

      if (plantillaError || !plantillaData) {
        return new Response(
          JSON.stringify({ error: 'Template not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      plantilla = plantillaData;
    }

    if (!plantilla && (!asuntoPersonalizado || !cuerpoPersonalizado)) {
      return new Response(
        JSON.stringify({ error: 'Subject and body are required when not using a template' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resultados = [];

    for (const destinatario of destinatarios) {
      try {
        const variables = {
          nombre: destinatario.nombre,
          email: destinatario.email,
          empresa: 'Nuestra Empresa',
          ...destinatario,
        };

        let asunto: string;
        let cuerpo: string;

        if (plantilla) {
          asunto = asuntoPersonalizado || reemplazarPlaceholders(plantilla.asunto, variables);
          cuerpo = cuerpoPersonalizado || reemplazarPlaceholders(plantilla.cuerpo_html, variables);
        } else {
          asunto = asuntoPersonalizado!;
          cuerpo = cuerpoPersonalizado!;
        }

        console.log(`Sending email to ${destinatario.email}: ${asunto}`);

        const { error: historialError } = await supabaseAdmin
          .from('historial_correos')
          .insert({
            plantilla_id: plantillaId,
            destinatario_id: destinatario.id,
            destinatario_email: destinatario.email,
            asunto: asunto,
            cuerpo_html: cuerpo,
            tipo_envio: tipoEnvio,
            estado: 'enviado',
            enviado_por_id: tipoEnvio === 'manual' ? user.id : null,
            fecha_envio: new Date().toISOString(),
          });

        if (historialError) {
          throw historialError;
        }

        resultados.push({
          email: destinatario.email,
          estado: 'enviado',
          mensaje: 'Email sent successfully',
        });
      } catch (error) {
        await supabaseAdmin.from('historial_correos').insert({
          plantilla_id: plantillaId,
          destinatario_id: destinatario.id,
          destinatario_email: destinatario.email,
          asunto: asuntoPersonalizado || plantilla.asunto,
          cuerpo_html: cuerpoPersonalizado || plantilla.cuerpo_html,
          tipo_envio: tipoEnvio,
          estado: 'fallido',
          error_mensaje: error.message,
          enviado_por_id: tipoEnvio === 'manual' ? user.id : null,
          fecha_envio: new Date().toISOString(),
        });

        resultados.push({
          email: destinatario.email,
          estado: 'fallido',
          mensaje: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        resultados,
        total: destinatarios.length,
        enviados: resultados.filter(r => r.estado === 'enviado').length,
        fallidos: resultados.filter(r => r.estado === 'fallido').length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});