// Sonda desechable: contesta si las llaves nuevas de Supabase sirven para
// hablar con la base desde una edge function. No la usa nadie más, no toca
// datos (solo cuenta filas) y NUNCA devuelve el valor de una llave — solo su
// nombre, su prefijo y su largo.
//
// Para qué: la documentación de Supabase advierte que muchos clientes mandan la
// llave en `Authorization: Bearer`, y que con una `sb_secret_…` —que NO es un
// JWT— la plataforma responde "Invalid JWT". Si eso pasa con supabase-js, el
// cambio de las ~189 funciones que leen SUPABASE_SERVICE_ROLE_KEY no es
// reemplazar un `Deno.env.get` y ya. Mejor saberlo con una función de juguete
// que descubrirlo con el dispatcher de notificaciones.
//
// Se despliega, se llama una vez, se lee la respuesta y se borra.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/** Las secret keys llegan como JSON {nombre: valor}. Solo se reporta la forma. */
function llavesSecretas(): Record<string, string> {
  try {
    const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const salida: Record<string, string> = {};
    for (const [nombre, valor] of Object.entries(parsed)) {
      if (typeof valor === 'string' && valor.length > 0) salida[nombre] = valor;
    }
    return salida;
  } catch (e) {
    console.error('SUPABASE_SECRET_KEYS no se pudo leer:', e);
    return {};
  }
}

/** Huella de una llave: suficiente para identificarla, inútil para usarla. */
function huella(llave: string | undefined) {
  if (!llave) return null;
  return { prefijo: llave.slice(0, 11), largo: llave.length, esJwt: llave.split('.').length === 3 };
}

/** Una consulta mínima contra una tabla con RLS: si la llave no manda, falla. */
async function probarLlave(url: string, llave: string, headersExtra?: Record<string, string>) {
  try {
    const client = createClient(url, llave, headersExtra ? { global: { headers: headersExtra } } : undefined);
    const { count, error } = await client.from('usuarios').select('id', { count: 'exact', head: true });
    if (error) return { ok: false, error: error.message, code: (error as { code?: string }).code ?? null };
    return { ok: true, filas: count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), code: null };
  }
}

/**
 * ¿El gateway de edge functions deja pasar una llave nueva?
 *
 * Nueve funciones llaman a otra con `Authorization: Bearer ${service key}`, y
 * esa variable ahora trae una `sb_secret_…` que NO es un JWT. Si el gateway la
 * rechaza, esas nueve llamadas ya están fallando. Se prueba llamándose a sí
 * misma con `?ping=1` (que corta de inmediato, sin recursión).
 */
async function probarGateway(url: string, llave: string) {
  const destino = `${url}/functions/v1/probar-llaves-nuevas?ping=1`;
  const intento = async (headers: Record<string, string>) => {
    try {
      const r = await fetch(destino, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}' });
      return { status: r.status, cuerpo: (await r.text()).slice(0, 120) };
    } catch (e) {
      return { status: null, cuerpo: e instanceof Error ? e.message : String(e) };
    }
  };
  return {
    como_bearer: await intento({ Authorization: `Bearer ${llave}` }),
    como_apikey: await intento({ apikey: llave }),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  // Corta la llamada que se hace a sí misma: sin esto, cada prueba dispararía
  // otra ronda de pruebas.
  if (new URL(req.url).searchParams.get('ping')) {
    return new Response(JSON.stringify({ pong: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secretas = llavesSecretas();
  const nombreSecreta = 'default' in secretas ? 'default' : Object.keys(secretas)[0];
  const secreta = nombreSecreta ? secretas[nombreSecreta] : undefined;

  const resultado: Record<string, unknown> = {
    variables: {
      SUPABASE_SERVICE_ROLE_KEY: huella(legacy),
      SUPABASE_SECRET_KEYS: Object.keys(secretas),
      SUPABASE_PUBLISHABLE_KEYS: (() => {
        try { return Object.keys(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}')); } catch { return null; }
      })(),
      llaveSecretaElegida: nombreSecreta ? { nombre: nombreSecreta, ...huella(secreta) } : null,
    },
    pruebas: {},
  };

  const pruebas = resultado.pruebas as Record<string, unknown>;

  // Control: lo que hacen hoy las 189 funciones.
  pruebas.legacy = legacy ? await probarLlave(url, legacy) : 'SUPABASE_SERVICE_ROLE_KEY no está';

  if (secreta) {
    // A: el cambio ingenuo — pasar la secret key donde iba la service_role.
    pruebas.secreta_directa = await probarLlave(url, secreta);
    // B: forzando la llave en el header `apikey`, que es lo que pide la doc.
    pruebas.secreta_con_apikey = await probarLlave(url, secreta, { apikey: secreta });
  } else {
    pruebas.secreta_directa = 'no hay SUPABASE_SECRET_KEYS en este proyecto';
  }

  // La pregunta que decide si hay un incendio: esas 9 llamadas entre funciones.
  pruebas.gateway = secreta ? await probarGateway(url, secreta) : 'sin llave secreta';

  return new Response(JSON.stringify(resultado, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
