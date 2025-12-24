import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webContentLink?: string;
}

interface FileMatch {
  videoFile: GoogleDriveFile;
  imageFile: GoogleDriveFile | null;
  nombreBase: string;
}

interface ProcessState {
  total_videos_drive: number;
  total_imagenes_drive: number;
  pares_emparejados: number;
  videos_sin_miniatura: number;
  archivos_descargados_exitosos: number;
  archivos_descarga_fallida: number;
  videos_subidos_exitosos: number;
  videos_subida_fallida: number;
  miniaturas_subidas_exitosas: number;
  miniaturas_subida_fallida: number;
  lecciones_creadas_exitosas: number;
  lecciones_creacion_fallida: number;
}

interface ErrorRecord {
  tipo: string;
  archivo: string;
  mensaje: string;
  timestamp: string;
}

function normalizarNombre(nombre: string): string {
  const sinExtension = nombre.replace(/\.(mp4|mov|avi|webm|mkv|jpg|jpeg|png|webp|gif)$/i, '');
  return sinExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function generarTitulo(nombreArchivo: string): string {
  let titulo = nombreArchivo.replace(/\.(mp4|mov|avi|webm|mkv)$/i, '');
  titulo = titulo.replace(/^\d+[-_]\s*/g, '');
  titulo = titulo.replace(/[-_]/g, ' ');
  titulo = titulo.replace(/\b\w/g, (c) => c.toUpperCase());
  return titulo.substring(0, 100);
}

async function leerArchivosDesdeSupabase(supabase: any): Promise<GoogleDriveFile[]> {
  try {
    console.log('[INFO] Leyendo lista de archivos desde Supabase Storage...');

    const { data, error } = await supabase.storage
      .from('seguros-videos')
      .download('lista-archivos-drive.csv');

    if (error) {
      throw new Error(`No se encontró el archivo lista-archivos-drive.csv en el bucket seguros-videos. Por favor, súbelo primero.`);
    }

    const text = await data.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('El archivo CSV está vacío');
    }

    const archivos: GoogleDriveFile[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));

      if (parts.length < 2) {
        console.warn(`[WARNING] Línea ${i + 1} inválida: ${line}`);
        continue;
      }

      const fileName = parts[0];
      const fileId = parts[1];

      if (!fileName || !fileId) {
        console.warn(`[WARNING] Línea ${i + 1} con datos vacíos`);
        continue;
      }

      let mimeType = 'application/octet-stream';
      if (/\.(mp4|mov|avi|webm|mkv)$/i.test(fileName)) {
        mimeType = 'video/mp4';
      } else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(fileName)) {
        mimeType = 'image/jpeg';
      }

      archivos.push({
        id: fileId,
        name: fileName,
        mimeType,
        modifiedTime: new Date().toISOString(),
      });
    }

    console.log(`[INFO] Archivos encontrados en CSV: ${archivos.length}`);

    if (archivos.length === 0) {
      throw new Error('No se encontraron archivos válidos en el CSV');
    }

    return archivos;
  } catch (error) {
    console.error('Error leyendo CSV desde Supabase:', error);
    throw error;
  }
}

function emparejarArchivos(archivos: GoogleDriveFile[]): { pares: FileMatch[]; sinPareja: GoogleDriveFile[] } {
  const videos = archivos.filter((f) =>
    /\.(mp4|mov|avi|webm|mkv)$/i.test(f.name)
  );
  const imagenes = archivos.filter((f) =>
    /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name)
  );

  const imagenesMap = new Map<string, GoogleDriveFile>();
  imagenes.forEach((img) => {
    const normalizado = normalizarNombre(img.name);
    imagenesMap.set(normalizado, img);
  });

  const pares: FileMatch[] = [];
  const sinPareja: GoogleDriveFile[] = [];

  videos.forEach((video) => {
    const videoNormalizado = normalizarNombre(video.name);
    const imagenEmparejada = imagenesMap.get(videoNormalizado);

    if (imagenEmparejada) {
      pares.push({
        videoFile: video,
        imageFile: imagenEmparejada,
        nombreBase: video.name.replace(/\.(mp4|mov|avi|webm|mkv)$/i, ''),
      });
    } else {
      sinPareja.push(video);
    }
  });

  return { pares, sinPareja };
}

async function descargarArchivo(fileId: string, nombreArchivo: string): Promise<string> {
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;

  console.log(`[DESCARGA] Iniciando descarga: ${nombreArchivo}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    let response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow'
    });

    if (!response.ok || response.url.includes('confirm')) {
      const text = await response.text();
      const confirmMatch = text.match(/confirm=([^&"]+)/);

      if (confirmMatch) {
        const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
        response = await fetch(confirmUrl, {
          signal: controller.signal,
          redirect: 'follow'
        });
      }
    }

    if (!response.ok) {
      throw new Error(`Error descargando archivo: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const tempPath = `/tmp/${Date.now()}-${nombreArchivo.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    await Deno.writeFile(tempPath, new Uint8Array(arrayBuffer));

    console.log(`[DESCARGA OK] ${nombreArchivo} - ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    return tempPath;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout descargando ${nombreArchivo}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function subirArchivo(
  supabase: any,
  bucket: string,
  tempPath: string,
  nombreDestino: string,
  contentType: string
): Promise<string | null> {
  try {
    const fileData = await Deno.readFile(tempPath);
    const blob = new Blob([fileData], { type: contentType });

    console.log(`[SUBIDA] Subiendo a ${bucket}: ${nombreDestino} - ${(fileData.byteLength / 1024 / 1024).toFixed(2)} MB`);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(nombreDestino, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    console.log(`[SUBIDA OK] ${nombreDestino}`);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`Error subiendo archivo a ${bucket}:`, error);
    return null;
  }
}

async function procesarArchivos(
  supabase: any,
  adminUserId: string,
  categoriaId: string,
  pares: FileMatch[],
  sinPareja: GoogleDriveFile[]
) {
  const state: ProcessState = {
    total_videos_drive: pares.length + sinPareja.length,
    total_imagenes_drive: pares.length,
    pares_emparejados: pares.length,
    videos_sin_miniatura: sinPareja.length,
    archivos_descargados_exitosos: 0,
    archivos_descarga_fallida: 0,
    videos_subidos_exitosos: 0,
    videos_subida_fallida: 0,
    miniaturas_subidas_exitosas: 0,
    miniaturas_subida_fallida: 0,
    lecciones_creadas_exitosas: 0,
    lecciones_creacion_fallida: 0,
  };

  const errores: ErrorRecord[] = [];
  const leccionesCreadas: { id: string; titulo: string }[] = [];

  for (const par of pares) {
    console.log(`[${new Date().toISOString()}] [PROCESANDO] Video: ${par.videoFile.name}`);

    let videoPath: string | null = null;
    let imagenPath: string | null = null;
    let videoUrl: string | null = null;
    let imagenUrl: string | null = null;

    try {
      videoPath = await descargarArchivo(par.videoFile.id, par.videoFile.name);
      state.archivos_descargados_exitosos++;

      if (par.imageFile) {
        try {
          imagenPath = await descargarArchivo(par.imageFile.id, par.imageFile.name);
          state.archivos_descargados_exitosos++;
        } catch (error) {
          console.error(`Error descargando miniatura ${par.imageFile.name}:`, error);
          state.archivos_descarga_fallida++;
          errores.push({
            tipo: 'descarga_miniatura',
            archivo: par.imageFile.name,
            mensaje: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const timestamp = Date.now();
      const videoNombreDestino = `${timestamp}-${par.videoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      const mimeType = par.videoFile.mimeType || 'video/mp4';
      videoUrl = await subirArchivo(supabase, 'seguros-videos', videoPath, videoNombreDestino, mimeType);

      if (videoUrl) {
        state.videos_subidos_exitosos++;

        if (imagenPath && par.imageFile) {
          const imagenNombreDestino = `${timestamp}-${par.imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const imagenMimeType = par.imageFile.mimeType || 'image/jpeg';
          imagenUrl = await subirArchivo(supabase, 'seguros-thumbnails', imagenPath, imagenNombreDestino, imagenMimeType);

          if (imagenUrl) {
            state.miniaturas_subidas_exitosas++;
          } else {
            state.miniaturas_subida_fallida++;
            errores.push({
              tipo: 'subida_miniatura',
              archivo: par.imageFile.name,
              mensaje: 'Fallo al subir a Storage',
              timestamp: new Date().toISOString(),
            });
          }
        }

        const titulo = generarTitulo(par.videoFile.name);
        const { data: leccion, error: leccionError } = await supabase
          .from('seguros_lessons')
          .insert({
            titulo,
            descripcion: '',
            categoria_id: categoriaId,
            miniatura_url: imagenUrl,
            video_url: videoUrl,
            duracion: 0,
            oficinas_asignadas: [],
            es_grabacion: false,
            session_id: null,
            creado_por: adminUserId,
          })
          .select('id, titulo')
          .single();

        if (leccionError) {
          console.error(`Error creando lección para ${par.videoFile.name}:`, leccionError);
          state.lecciones_creacion_fallida++;
          errores.push({
            tipo: 'creacion_leccion',
            archivo: par.videoFile.name,
            mensaje: leccionError.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          state.lecciones_creadas_exitosas++;
          leccionesCreadas.push({ id: leccion.id, titulo: leccion.titulo });
          console.log(`[${new Date().toISOString()}] [EXITO] Lección creada: ${titulo}`);
        }
      } else {
        state.videos_subida_fallida++;
        errores.push({
          tipo: 'subida_video',
          archivo: par.videoFile.name,
          mensaje: 'Fallo al subir a Storage',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`Error procesando ${par.videoFile.name}:`, error);
      state.archivos_descarga_fallida++;
      errores.push({
        tipo: 'procesamiento',
        archivo: par.videoFile.name,
        mensaje: error.message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (videoPath) {
        try {
          await Deno.remove(videoPath);
        } catch {}
      }
      if (imagenPath) {
        try {
          await Deno.remove(imagenPath);
        } catch {}
      }
    }
  }

  for (const video of sinPareja) {
    console.log(`[${new Date().toISOString()}] [PROCESANDO SIN MINIATURA] Video: ${video.name}`);

    let videoPath: string | null = null;
    let videoUrl: string | null = null;

    try {
      videoPath = await descargarArchivo(video.id, video.name);
      state.archivos_descargados_exitosos++;

      const timestamp = Date.now();
      const videoNombreDestino = `${timestamp}-${video.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const mimeType = video.mimeType || 'video/mp4';

      videoUrl = await subirArchivo(supabase, 'seguros-videos', videoPath, videoNombreDestino, mimeType);

      if (videoUrl) {
        state.videos_subidos_exitosos++;

        const titulo = generarTitulo(video.name);
        const { data: leccion, error: leccionError } = await supabase
          .from('seguros_lessons')
          .insert({
            titulo,
            descripcion: '',
            categoria_id: categoriaId,
            miniatura_url: null,
            video_url: videoUrl,
            duracion: 0,
            oficinas_asignadas: [],
            es_grabacion: false,
            session_id: null,
            creado_por: adminUserId,
          })
          .select('id, titulo')
          .single();

        if (leccionError) {
          console.error(`Error creando lección para ${video.name}:`, leccionError);
          state.lecciones_creacion_fallida++;
          errores.push({
            tipo: 'creacion_leccion',
            archivo: video.name,
            mensaje: leccionError.message,
            timestamp: new Date().toISOString(),
          });
        } else {
          state.lecciones_creadas_exitosas++;
          leccionesCreadas.push({ id: leccion.id, titulo: leccion.titulo });
          console.log(`[${new Date().toISOString()}] [EXITO] Lección creada sin miniatura: ${titulo}`);
        }
      } else {
        state.videos_subida_fallida++;
        errores.push({
          tipo: 'subida_video',
          archivo: video.name,
          mensaje: 'Fallo al subir a Storage',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error(`Error procesando ${video.name}:`, error);
      state.archivos_descarga_fallida++;
      errores.push({
        tipo: 'procesamiento',
        archivo: video.name,
        mensaje: error.message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      if (videoPath) {
        try {
          await Deno.remove(videoPath);
        } catch {}
      }
    }
  }

  return { state, errores, leccionesCreadas };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, rol')
      .eq('id', user.id)
      .single();

    if (usuarioError || !usuario || usuario.rol !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Solo administradores pueden ejecutar esta función' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestampInicio = new Date().toISOString();

    console.log(`[${timestampInicio}] [INICIO] Iniciando carga masiva desde lista CSV en Supabase`);

    const archivos = await leerArchivosDesdeSupabase(supabase);
    console.log(`[${new Date().toISOString()}] [INFO] Archivos encontrados: ${archivos.length}`);

    const { pares, sinPareja } = emparejarArchivos(archivos);
    console.log(`[${new Date().toISOString()}] [INFO] Pares emparejados: ${pares.length}, Sin pareja: ${sinPareja.length}`);

    let { data: categoria, error: categoriaError } = await supabase
      .from('seguros_categories')
      .select('id')
      .eq('nombre', 'Academia de Negocios 2025')
      .maybeSingle();

    if (!categoria) {
      const { data: nuevaCategoria, error: crearError } = await supabase
        .from('seguros_categories')
        .insert({
          nombre: 'Academia de Negocios 2025',
          descripcion: 'Contenido educativo de la Academia de Negocios 2025',
          creado_por: usuario.id,
        })
        .select('id')
        .single();

      if (crearError) {
        throw new Error(`Error creando categoría: ${crearError.message}`);
      }

      categoria = nuevaCategoria;
      console.log(`[${new Date().toISOString()}] [INFO] Categoría creada: Academia de Negocios 2025`);
    } else {
      console.log(`[${new Date().toISOString()}] [INFO] Categoría existente encontrada`);
    }

    const respuestaInmediata = {
      success: true,
      mensaje: `Proceso iniciado. Se procesarán ${pares.length + sinPareja.length} videos`,
      total_videos: pares.length + sinPareja.length,
      con_miniatura: pares.length,
      sin_miniatura: sinPareja.length,
    };

    const backgroundTask = async () => {
      try {
        const { state, errores, leccionesCreadas } = await procesarArchivos(
          supabase,
          usuario.id,
          categoria.id,
          pares,
          sinPareja
        );

        const timestampFin = new Date().toISOString();
        const duracionMs = new Date(timestampFin).getTime() - new Date(timestampInicio).getTime();

        const reporte = {
          success: state.lecciones_creadas_exitosas > 0,
          timestamp_inicio: timestampInicio,
          timestamp_fin: timestampFin,
          duracion_total_segundos: Math.round(duracionMs / 1000),
          estadisticas: state,
          errores,
          lecciones_creadas: leccionesCreadas,
        };

        console.log(`[${timestampFin}] [FIN] Proceso completado`);
        console.log(`Estadísticas finales:`, JSON.stringify(state, null, 2));

        await supabase.functions.invoke('send-internal-notification', {
          body: {
            usuario_id: usuario.id,
            titulo: 'Carga Masiva Completada',
            mensaje: `Se procesaron ${state.total_videos_drive} videos. ${state.lecciones_creadas_exitosas} lecciones creadas exitosamente.`,
            tipo: 'sistema',
            url: '/seguros-education/on-demand',
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
        for await (const entry of Deno.readDir('/tmp')) {
          if (entry.isFile) {
            const filePath = `/tmp/${entry.name}`;
            try {
              const stat = await Deno.stat(filePath);
              const now = Date.now();
              const fileAge = now - stat.mtime!.getTime();
              if (fileAge > 5 * 60 * 1000) {
                await Deno.remove(filePath);
              }
            } catch {}
          }
        }
      } catch (error) {
        console.error('[ERROR CRITICO]', error);
      }
    };

    EdgeRuntime.waitUntil(backgroundTask());

    return new Response(JSON.stringify(respuestaInmediata), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ERROR]', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});