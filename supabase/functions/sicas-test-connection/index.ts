import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SicasAuthConfig {
  UserName: string;
  Password: string;
  ServerMgr?: string;
  TipoBD?: string;
  Version?: string;
  CodeAuth?: string;
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

    if (Deno.env.get('SICAS_SERVERMGR')) authConfig.ServerMgr = Deno.env.get('SICAS_SERVERMGR');
    if (Deno.env.get('SICAS_TIPOBD')) authConfig.TipoBD = Deno.env.get('SICAS_TIPOBD');
    if (Deno.env.get('SICAS_VERSION')) authConfig.Version = Deno.env.get('SICAS_VERSION');
    if (Deno.env.get('SICAS_CODEAUTH')) authConfig.CodeAuth = Deno.env.get('SICAS_CODEAUTH');

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>${authConfig.UserName}</UserName>
        <Password>${authConfig.Password}</Password>
        ${authConfig.ServerMgr ? `<ServerMgr>${authConfig.ServerMgr}</ServerMgr>` : ''}
        ${authConfig.TipoBD ? `<TipoBD>${authConfig.TipoBD}</TipoBD>` : ''}
        ${authConfig.Version ? `<Version>${authConfig.Version}</Version>` : ''}
        ${authConfig.CodeAuth ? `<CodeAuth>${authConfig.CodeAuth}</CodeAuth>` : ''}
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(sicasEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/AutentificarWS',
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();
    console.log('SICAS Response:', responseText.substring(0, 1000));

    let success = false;
    let message = 'Unknown response';
    let parsedResponse = null;

    const responseMatch = responseText.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i);
    const messageMatch = responseText.match(/<MESSAGE>(.*?)<\/MESSAGE>/i);

    if (responseMatch) {
      const responseTxt = responseMatch[1];
      parsedResponse = responseTxt;
      success = responseTxt === 'OK' || responseTxt.toLowerCase().includes('éxito') || responseTxt.toLowerCase().includes('exitoso');
    }

    if (messageMatch) {
      message = messageMatch[1];
    } else if (!responseMatch) {
      // If no structured response found, check for common SOAP error patterns
      const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/i);
      if (faultMatch) {
        message = `SOAP Error: ${faultMatch[1]}`;
      } else if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
        message = 'Received HTML response instead of SOAP XML (possible endpoint error)';
      } else if (responseText.trim() === '') {
        message = 'Empty response from SICAS server';
      } else {
        message = `Unable to parse SICAS response. HTTP Status: ${response.status}`;
      }
    }

    await supabase
      .from('sicas_config')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_success: success,
        last_test_message: message,
      })
      .eq('endpoint', sicasEndpoint);

    return new Response(
      JSON.stringify({
        success: true,
        connectionSuccess: success,
        message,
        httpStatus: response.status,
        parsedResponse,
        responsePreview: responseText.substring(0, 500),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error testing SICAS connection:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});