const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SICAS_REST_BASE_URL = 'https://security-services.sicasonline.info/api';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      endpoint = 'GetToken',
      method = 'GET',
      usuario,
      password
    } = await req.json();

    const config = {
      usuario: usuario || Deno.env.get('SICAS_USUARIO') || '',
      password: password || Deno.env.get('SICAS_PASSWORD') || '',
      sCodeAuth: Deno.env.get('SICAS_CODE_AUTH') || '',
      codeAuthSO: Deno.env.get('SICAS_CODE_AUTH_SO') || ''
    };

    const results: any[] = [];

    // Test 1: GET /Security/GetToken
    if (endpoint === 'GetToken' || endpoint === 'all') {
      try {
        // Use URLSearchParams so that literal '%' in username (e.g. j1r0%25$)
        // gets encoded to %25 → URL contains j1r0%2525%24.
        // SICAS decodes once and receives the original value j1r0%25$.
        const params = new URLSearchParams({
          Usuario: config.usuario,
          Password: config.password,
          ...(config.sCodeAuth && { sCodeAuth: config.sCodeAuth }),
          ...(config.codeAuthSO && { CodeAuthSO: config.codeAuthSO })
        });

        const url = `${SICAS_REST_BASE_URL}/Security/GetToken?${params}`;

        results.push({
          test: 'GET /Security/GetToken',
          request: {
            method: 'GET',
            url: url.replace(config.password, '***'),
            headers: { 'Content-Type': 'application/json' }
          }
        });

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        const responseText = await response.text();

        results[results.length - 1].response = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText,
          bodyParsed: (() => {
            try {
              return JSON.parse(responseText);
            } catch {
              return null;
            }
          })()
        };

        // Si obtuvimos token, intentar validarlo
        if (response.ok) {
          const tokenData = JSON.parse(responseText);
          if (tokenData.Token) {
            // Test 2: GET /Security/ValidateToken
            try {
              const validateUrl = `${SICAS_REST_BASE_URL}/Security/ValidateToken?ReactiveIf=true`;

              results.push({
                test: 'GET /Security/ValidateToken',
                request: {
                  method: 'GET',
                  url: validateUrl,
                  headers: {
                    'Authorization': `Bearer ${tokenData.Token.substring(0, 20)}...`,
                    'Content-Type': 'application/json'
                  }
                }
              });

              const validateResponse = await fetch(validateUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${tokenData.Token}`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                }
              });

              const validateText = await validateResponse.text();

              results[results.length - 1].response = {
                status: validateResponse.status,
                statusText: validateResponse.statusText,
                body: validateText,
                bodyParsed: (() => {
                  try {
                    return JSON.parse(validateText);
                  } catch {
                    return null;
                  }
                })()
              };

              // Test 3: POST /Report/ReadData (reporte de producción)
              if (validateResponse.ok) {
                try {
                  const reportUrl = `${SICAS_REST_BASE_URL}/Report/ReadData`;
                  const reportBody = {
                    FormatResponse: 1,
                    Top: 10
                  };

                  results.push({
                    test: 'POST /Report/ReadData (H03117)',
                    request: {
                      method: 'POST',
                      url: reportUrl,
                      headers: {
                        'Authorization': `Bearer ${tokenData.Token.substring(0, 20)}...`,
                        'Prop_KeyCode': 'H03117',
                        'Content-Type': 'application/json'
                      },
                      body: reportBody
                    }
                  });

                  const reportResponse = await fetch(reportUrl, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${tokenData.Token}`,
                      'Prop_KeyCode': 'H03117',
                      'Content-Type': 'application/json',
                      'Accept': 'application/json'
                    },
                    body: JSON.stringify(reportBody)
                  });

                  const reportText = await reportResponse.text();

                  results[results.length - 1].response = {
                    status: reportResponse.status,
                    statusText: reportResponse.statusText,
                    body: reportText.substring(0, 1000),
                    bodyLength: reportText.length,
                    bodyParsed: (() => {
                      try {
                        return JSON.parse(reportText);
                      } catch {
                        return null;
                      }
                    })()
                  };
                } catch (error: any) {
                  results[results.length - 1].error = error.message;
                }
              }
            } catch (error: any) {
              results[results.length - 1].error = error.message;
            }
          }
        }
      } catch (error: any) {
        results[results.length - 1].error = error.message;
      }
    }

    // Test alternativo: POST /Security/GetToken
    if (endpoint === 'GetTokenPOST' || endpoint === 'all') {
      try {
        const url = `${SICAS_REST_BASE_URL}/Security/GetToken`;
        const body = {
          Usuario: config.usuario,
          Password: config.password,
          ...(config.sCodeAuth && { sCodeAuth: config.sCodeAuth }),
          ...(config.codeAuthSO && { CodeAuthSO: config.codeAuthSO })
        };

        results.push({
          test: 'POST /Security/GetToken',
          request: {
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            body: { ...body, Password: '***' }
          }
        });

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const responseText = await response.text();

        results[results.length - 1].response = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText,
          bodyParsed: (() => {
            try {
              return JSON.parse(responseText);
            } catch {
              return null;
            }
          })()
        };
      } catch (error: any) {
        results[results.length - 1].error = error.message;
      }
    }

    // Test nuevo: POST /readreport (endpoint real de MOVI)
    if (endpoint === 'readreport' || endpoint === 'all') {
      try {
        const url = `${SICAS_REST_BASE_URL}/readreport`;
        const body = {
          keyCode: 'H03117',
          pageRequested: 1,
          itemsForPage: 10,
          formatResponse: 2
        };

        results.push({
          test: 'POST /readreport (sin token)',
          request: {
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            body
          }
        });

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const responseText = await response.text();

        results[results.length - 1].response = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText.substring(0, 1000),
          bodyLength: responseText.length,
          bodyParsed: (() => {
            try {
              return JSON.parse(responseText);
            } catch {
              return null;
            }
          })()
        };
      } catch (error: any) {
        results[results.length - 1].error = error.message;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'SICAS REST API Real Test',
        config: {
          baseUrl: SICAS_REST_BASE_URL,
          usuario: config.usuario,
          hasPassword: !!config.password,
          hasSCodeAuth: !!config.sCodeAuth,
          hasCodeAuthSO: !!config.codeAuthSO
        },
        results
      }, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error en test REST:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
