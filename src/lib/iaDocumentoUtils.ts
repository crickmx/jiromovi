import { supabase } from './supabase';

export interface IADocumentoResult {
  titulo: string;
  contenido_html: string;
  imagen_url: string;
  bajada?: string;
  resumen_ejecutivo?: string;
  puntos_clave?: string[];
  tiempo_lectura?: string;
}

export async function subirDocumentosTemporales(files: File[]): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const fileName = `temp-ia/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('comunicados')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading file:', file.name, error);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from('comunicados')
      .getPublicUrl(fileName);

    if (urlData?.publicUrl) {
      urls.push(urlData.publicUrl);
    }
  }

  return urls;
}

export async function procesarDocumentoConIA(
  fileUrls: string[],
  rawText: string,
  tituloSugerido?: string,
): Promise<IADocumentoResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const resp = await fetch(`${supabaseUrl}/functions/v1/ia-process-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      file_urls: fileUrls,
      raw_text: rawText,
      titulo_sugerido: tituloSugerido || undefined,
    }),
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(errData.error || `Error ${resp.status}`);
  }

  const data = await resp.json();

  if (!data.success) {
    throw new Error(data.error || 'Error procesando documento');
  }

  return {
    titulo: data.titulo,
    contenido_html: data.contenido_html,
    imagen_url: data.imagen_url,
    bajada: data.bajada,
    resumen_ejecutivo: data.resumen_ejecutivo,
    puntos_clave: data.puntos_clave,
    tiempo_lectura: data.tiempo_lectura,
  };
}
