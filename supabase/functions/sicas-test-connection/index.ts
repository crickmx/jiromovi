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

    // SICAS Online no requiere AutentificarWS explícito
    // La autenticación se valida en cada llamada a ReadInfoData
    // Probamos la conexión intentando leer el catálogo de despachos (PropertyTypeReadData = 11)
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>11</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>${authConfig.UserName}</UserName>
        <Password>${authConfig.Password}</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

    console.log('SICAS Request SOAP Envelope:', soapEnvelope);

    const response = await fetch(sicasEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ReadInfoData',
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();
    console.log('SICAS HTTP Status:', response.status);
    console.log('SICAS Response:', responseText.substring(0, 1000));

    let success = false;
    let message = 'Unknown response';
    let parsedResponse = null;

    // Check for SOAP fault first
    const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/i);
    if (faultMatch) {
      message = `SOAP Error: ${faultMatch[1]}`;
      success = false;
    } else if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html')) {
      message = 'Received HTML response instead of SOAP XML (possible endpoint error)';
      success = false;
    } else if (responseText.trim() === '') {
      message = 'Empty response from SICAS server';
      success = false;
    } else {
      // Try to parse ReadInfoDataResult
      const resultMatch = responseText.match(/<ReadInfoDataResult>(.*?)<\/ReadInfoDataResult>/is);
      if (resultMatch) {
        let dataResult = resultMatch[1];

        // Decode HTML entities
        dataResult = dataResult.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

        parsedResponse = dataResult.substring(0, 200);

        // Si contiene datos (JSON o XML), la conexión es exitosa
        if (dataResult.trim().length > 0 &&
            (dataResult.trim().startsWith('{') ||
             dataResult.trim().startsWith('[') ||
             dataResult.trim().startsWith('<'))) {
          success = true;
          message = 'Conexión exitosa - Credenciales válidas';
        } else if (dataResult.toLowerCase().includes('error') ||
                   dataResult.toLowerCase().includes('invalid') ||
                   dataResult.toLowerCase().includes('denied')) {
          success = false;
          message = `Error de autenticación: ${dataResult.substring(0, 100)}`;
        } else {
          success = false;
          message = `Respuesta inesperada: ${dataResult.substring(0, 100)}`;
        }
      } else {
        message = `Unable to find ReadInfoDataResult in response. HTTP Status: ${response.status}`;
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
        requestSent: soapEnvelope,
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