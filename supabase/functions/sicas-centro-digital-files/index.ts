import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CentroDigitalRequest {
  id_docto: string;
  id_cont?: string;
  identity_type?: string; // H02 (Póliza) por defecto
  force_refresh?: boolean;
}

interface Archivo {
  id: string;
  nombre: string;
  nombre_archivo: string;
  tipo_archivo: string;
  extension: string;
  tamanio_bytes: number;
  tamanio_legible: string;
  fecha_subida: string;
  es_descargable: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[Centro Digital] Iniciando consulta de archivos');

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Usuario no autenticado');
    }

    console.log('[Centro Digital] Usuario autenticado:', user.id);

    // Parsear request
    const requestBody: CentroDigitalRequest = await req.json();
    const { id_docto, id_cont, identity_type = 'H02', force_refresh = false } = requestBody;

    if (!id_docto) {
      throw new Error('id_docto es requerido');
    }

    console.log('[Centro Digital] Consultando archivos para:', { id_docto, id_cont, identity_type });

    // Verificar permisos: el usuario debe poder ver este documento
    const { data: documento } = await supabase
      .from('sicas_documents')
      .select('id, usuario_id, oficina_id')
      .eq('id_docto', id_docto)
      .maybeSingle();

    if (!documento) {
      console.warn('[Centro Digital] Documento no encontrado en cache:', id_docto);
      // Continuar de todos modos, podría ser un documento nuevo no sincronizado
    }

    // Verificar permisos del usuario
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('id, rol, oficina_id')
      .eq('id', user.id)
      .single();

    if (!usuarioData) {
      throw new Error('Usuario no encontrado');
    }

    // Validar permisos
    if (documento) {
      const esAdmin = usuarioData.rol === 'admin';
      const esGerente = usuarioData.rol === 'gerente' && documento.oficina_id === usuarioData.oficina_id;
      const esPropietario = documento.usuario_id === user.id;

      if (!esAdmin && !esGerente && !esPropietario) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No tienes permisos para ver los archivos de este documento',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Verificar cache si no se fuerza refresh
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('sicas_centro_digital_cache')
        .select('*')
        .eq('id_docto', id_docto)
        .eq('identity_type', identity_type)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached) {
        console.log('[Centro Digital] Usando cache válido');
        return new Response(
          JSON.stringify({
            success: true,
            id_docto,
            id_cont: cached.id_cont,
            identity_type,
            archivos: cached.archivos || [],
            total_archivos: cached.total_archivos || 0,
            tiene_archivos: cached.tiene_archivos || false,
            source: 'cache',
            cached_at: cached.cached_at,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    console.log('[Centro Digital] Cache no válido o refresh forzado, consultando SICAS...');

    // Obtener credenciales de SICAS
    const sicasRestUrl = Deno.env.get('SICAS_REST_API_URL');
    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');

    if (!sicasRestUrl || !sicasUsername || !sicasPassword) {
      throw new Error('Credenciales SICAS no configuradas');
    }

    // Construir request al Centro Digital de SICAS
    // La estructura depende de si es REST o SOAP
    // Por ahora implementaremos REST con /DigitalCenter/GetFiles
    const centroDigitalUrl = `${sicasRestUrl}/DigitalCenter/GetFiles`;

    // Preparar payload (ajustar según documentación de SICAS)
    const payload = {
      Identity: identity_type,
      IDDocto: id_docto,
      ...(id_cont && { IDCont: id_cont }),
    };

    console.log('[Centro Digital] Llamando a SICAS:', centroDigitalUrl);

    const response = await fetch(centroDigitalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${sicasUsername}:${sicasPassword}`)}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`SICAS error: ${response.status} ${response.statusText}`);
    }

    const sicasResult = await response.json();
    console.log('[Centro Digital] Respuesta de SICAS:', JSON.stringify(sicasResult).substring(0, 500));

    // Parsear archivos (ajustar según estructura real de SICAS)
    const archivos: Archivo[] = [];

    if (sicasResult.Files && Array.isArray(sicasResult.Files)) {
      for (const file of sicasResult.Files) {
        archivos.push({
          id: file.IDFile || file.Id || `file_${Date.now()}_${Math.random()}`,
          nombre: file.FileName || file.Nombre || 'Sin nombre',
          nombre_archivo: file.FileName || file.Nombre || 'Sin nombre',
          tipo_archivo: file.FileType || file.Tipo || 'application/octet-stream',
          extension: file.Extension || (file.FileName ? file.FileName.split('.').pop() : '') || 'bin',
          tamanio_bytes: file.FileSize || file.Tamanio || 0,
          tamanio_legible: formatBytes(file.FileSize || file.Tamanio || 0),
          fecha_subida: file.UploadDate || file.FechaSubida || new Date().toISOString(),
          es_descargable: file.IsDownloadable !== false,
        });
      }
    } else if (sicasResult.Archivos && Array.isArray(sicasResult.Archivos)) {
      // Formato alternativo
      for (const file of sicasResult.Archivos) {
        archivos.push({
          id: file.id || `file_${Date.now()}_${Math.random()}`,
          nombre: file.nombre || 'Sin nombre',
          nombre_archivo: file.nombre_archivo || file.nombre || 'Sin nombre',
          tipo_archivo: file.tipo || 'application/octet-stream',
          extension: file.extension || 'bin',
          tamanio_bytes: file.tamanio || 0,
          tamanio_legible: formatBytes(file.tamanio || 0),
          fecha_subida: file.fecha || new Date().toISOString(),
          es_descargable: file.descargable !== false,
        });
      }
    }

    console.log('[Centro Digital] Archivos parseados:', archivos.length);

    // Guardar en cache
    const cacheData = {
      id_docto,
      id_cont: id_cont || null,
      identity_type,
      archivos: archivos,
      total_archivos: archivos.length,
      tiene_archivos: archivos.length > 0,
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutos
    };

    await supabase
      .from('sicas_centro_digital_cache')
      .upsert(cacheData, {
        onConflict: 'id_docto,identity_type'
      });

    console.log('[Centro Digital] Cache actualizado');

    // Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        id_docto,
        id_cont,
        identity_type,
        archivos,
        total_archivos: archivos.length,
        tiene_archivos: archivos.length > 0,
        source: 'sicas',
        cached_at: cacheData.cached_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Centro Digital] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        archivos: [],
        total_archivos: 0,
        tiene_archivos: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
