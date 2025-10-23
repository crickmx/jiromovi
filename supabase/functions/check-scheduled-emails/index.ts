import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const diaActual = hoy.getDate();

    const resultados = {
      cumpleanos: 0,
      aniversarios: 0,
      errores: 0,
    };

    const { data: plantillaCumpleanos } = await supabaseAdmin
      .from('plantillas_correo')
      .select('*')
      .eq('tipo', 'cumpleanos')
      .eq('activo', true)
      .eq('envio_automatico', true)
      .maybeSingle();

    if (plantillaCumpleanos) {
      const { data: usuariosCumpleanos } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre, apellidos, email_laboral, email_personal, puesto, fecha_nacimiento')
        .not('fecha_nacimiento', 'is', null);

      if (usuariosCumpleanos) {
        for (const usuario of usuariosCumpleanos) {
          const fechaNac = new Date(usuario.fecha_nacimiento);
          const mesCumple = fechaNac.getMonth() + 1;
          const diaCumple = fechaNac.getDate();

          if (mesCumple === mesActual && diaCumple === diaActual) {
            const { data: yaEnviado } = await supabaseAdmin
              .from('envios_automaticos_log')
              .select('id')
              .eq('usuario_id', usuario.id)
              .eq('tipo', 'cumpleanos')
              .eq('anio', anioActual)
              .maybeSingle();

            if (!yaEnviado) {
              const email = usuario.email_laboral || usuario.email_personal;
              if (email) {
                try {
                  const variables = {
                    nombre: usuario.nombre,
                    apellidos: usuario.apellidos,
                    puesto: usuario.puesto || '',
                    empresa: 'Nuestra Empresa',
                  };

                  const asunto = reemplazarPlaceholders(plantillaCumpleanos.asunto, variables);
                  const cuerpo = reemplazarPlaceholders(plantillaCumpleanos.cuerpo_html, variables);

                  await supabaseAdmin.from('historial_correos').insert({
                    plantilla_id: plantillaCumpleanos.id,
                    destinatario_id: usuario.id,
                    destinatario_email: email,
                    asunto: asunto,
                    cuerpo_html: cuerpo,
                    tipo_envio: 'automatico',
                    estado: 'enviado',
                    fecha_envio: new Date().toISOString(),
                  });

                  await supabaseAdmin.from('envios_automaticos_log').insert({
                    usuario_id: usuario.id,
                    tipo: 'cumpleanos',
                    anio: anioActual,
                    fecha_envio: hoy.toISOString().split('T')[0],
                  });

                  resultados.cumpleanos++;
                } catch (error) {
                  resultados.errores++;
                  console.error(`Error sending birthday email to ${email}:`, error);
                }
              }
            }
          }
        }
      }
    }

    const { data: plantillaAniversario } = await supabaseAdmin
      .from('plantillas_correo')
      .select('*')
      .eq('tipo', 'aniversario')
      .eq('activo', true)
      .eq('envio_automatico', true)
      .maybeSingle();

    if (plantillaAniversario) {
      const { data: usuariosAniversario } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombre, apellidos, email_laboral, email_personal, puesto, fecha_ingreso')
        .not('fecha_ingreso', 'is', null);

      if (usuariosAniversario) {
        for (const usuario of usuariosAniversario) {
          const fechaIng = new Date(usuario.fecha_ingreso);
          const mesIng = fechaIng.getMonth() + 1;
          const diaIng = fechaIng.getDate();
          const anioIng = fechaIng.getFullYear();

          if (mesIng === mesActual && diaIng === diaActual && anioIng < anioActual) {
            const { data: yaEnviado } = await supabaseAdmin
              .from('envios_automaticos_log')
              .select('id')
              .eq('usuario_id', usuario.id)
              .eq('tipo', 'aniversario')
              .eq('anio', anioActual)
              .maybeSingle();

            if (!yaEnviado) {
              const email = usuario.email_laboral || usuario.email_personal;
              if (email) {
                try {
                  const anios = anioActual - anioIng;
                  const variables = {
                    nombre: usuario.nombre,
                    apellidos: usuario.apellidos,
                    puesto: usuario.puesto || '',
                    empresa: 'Nuestra Empresa',
                    anios: anios.toString(),
                  };

                  const asunto = reemplazarPlaceholders(plantillaAniversario.asunto, variables);
                  const cuerpo = reemplazarPlaceholders(plantillaAniversario.cuerpo_html, variables);

                  await supabaseAdmin.from('historial_correos').insert({
                    plantilla_id: plantillaAniversario.id,
                    destinatario_id: usuario.id,
                    destinatario_email: email,
                    asunto: asunto,
                    cuerpo_html: cuerpo,
                    tipo_envio: 'automatico',
                    estado: 'enviado',
                    fecha_envio: new Date().toISOString(),
                  });

                  await supabaseAdmin.from('envios_automaticos_log').insert({
                    usuario_id: usuario.id,
                    tipo: 'aniversario',
                    anio: anioActual,
                    fecha_envio: hoy.toISOString().split('T')[0],
                  });

                  resultados.aniversarios++;
                } catch (error) {
                  resultados.errores++;
                  console.error(`Error sending anniversary email to ${email}:`, error);
                }
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        fecha: hoy.toISOString(),
        resultados,
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