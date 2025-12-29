import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SicasAuthConfig {
  UserName: string;
  Password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('SICAS credentials not configured in environment variables');
    }

    const authConfig: SicasAuthConfig = {
      UserName: sicasUsername,
      Password: sicasPassword,
    };

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>${authConfig.UserName}</UserName>
        <Password>${authConfig.Password}</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>`;

    console.log('[SICAS Auth] Probando autenticación...');
    console.log('[SICAS Auth] Endpoint:', sicasEndpoint);
    console.log('[SICAS Auth] Username:', authConfig.UserName);

    const response = await fetch(sicasEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/AutentificarWS',
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();
    console.log('[SICAS Auth] HTTP Status:', response.status);
    console.log('[SICAS Auth] Response Preview:', responseText.substring(0, 500));

    let success = false;
    let message = 'Unknown response';
    let parsedResponse = null;
    let responseTxt = '';

    const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/i);
    if (faultMatch) {
      message = `SOAP Error: ${faultMatch[1]}`;
      success = false;
      console.log('[SICAS Auth] ❌ SOAP Fault:', faultMatch[1]);
    } else if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
      message = 'Received HTML response instead of SOAP XML (possible endpoint error)';
      success = false;
      console.log('[SICAS Auth] ❌ HTML Response (not SOAP)');
    } else if (responseText.trim() === '') {
      message = 'Empty response from SICAS server';
      success = false;
      console.log('[SICAS Auth] ❌ Empty Response');
    } else {
      const authResultMatch = responseText.match(/<AutentificarWSResult>(.*?)<\/AutentificarWSResult>/is);
      if (authResultMatch) {
        let authResult = authResultMatch[1];

        authResult = authResult
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&amp;/g, '&');

        parsedResponse = authResult;

        const responseMatch = authResult.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i);
        const messageMatch = authResult.match(/<MESSAGE>(.*?)<\/MESSAGE>/i);

        if (responseMatch) {
          responseTxt = responseMatch[1].toUpperCase();
          console.log('[SICAS Auth] RESPONSETXT:', responseTxt);

          if (responseTxt === 'SUCESS' || responseTxt === 'SUCCESS' || responseTxt === 'OK') {
            success = true;
            const rawMessage = messageMatch ? messageMatch[1] : 'Autenticación exitosa';

            if (rawMessage.toLowerCase().includes('error') ||
                rawMessage.toLowerCase().includes('variable de objeto') ||
                rawMessage.toLowerCase().includes('proceso interno')) {
              message = `Conexión establecida correctamente. Mensaje del servidor: ${rawMessage}`;
              console.log('[SICAS Auth] ✅ Autenticación EXITOSA con mensaje informativo del servidor:', rawMessage);
            } else {
              message = rawMessage;
              console.log('[SICAS Auth] ✅ Autenticación EXITOSA');
            }
          } else if (responseTxt === 'DENIED' || responseTxt.includes('DENIED')) {
            success = false;
            message = messageMatch ? messageMatch[1] : 'Acceso denegado - Credenciales inválidas';
            console.log('[SICAS Auth] ❌ Acceso DENEGADO');
          } else {
            success = false;
            message = `RESPONSETXT inesperado: ${responseTxt}`;
            console.log('[SICAS Auth] ⚠️ RESPONSETXT no reconocido:', responseTxt);
          }
        } else {
          if (authResult.toLowerCase().includes('sucess') ||
              authResult.toLowerCase().includes('success') ||
              authResult.toLowerCase().includes('autenticado')) {
            success = true;
            message = 'Autenticación exitosa (sin RESPONSETXT)';
            console.log('[SICAS Auth] ✅ Autenticación detectada como exitosa (fallback)');
          } else if (authResult.toLowerCase().includes('denied') ||
                     authResult.toLowerCase().includes('invalid') ||
                     authResult.toLowerCase().includes('error')) {
            success = false;
            message = 'Autenticación fallida (sin RESPONSETXT)';
            console.log('[SICAS Auth] ❌ Autenticación fallida (fallback)');
          } else {
            success = false;
            message = `No se encontró RESPONSETXT. Response: ${authResult.substring(0, 100)}`;
            console.log('[SICAS Auth] ⚠️ Sin RESPONSETXT en respuesta');
          }
        }
      } else {
        message = `Unable to find AutentificarWSResult in response. HTTP Status: ${response.status}`;
        success = false;
        console.log('[SICAS Auth] ❌ No se encontró AutentificarWSResult');
      }
    }

    const { error: updateError } = await supabase
      .from('sicas_config')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_success: success,
        last_test_message: message,
      })
      .eq('endpoint', sicasEndpoint);

    if (updateError) {
      console.error('[SICAS Auth] Error actualizando config:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        connectionSuccess: success,
        message,
        responseTxt,
        httpStatus: response.status,
        parsedResponse: parsedResponse?.substring(0, 300),
        responsePreview: responseText.substring(0, 500),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SICAS Auth] Exception:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});