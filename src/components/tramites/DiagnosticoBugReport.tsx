import { useEffect, useState } from 'react';
import { Sparkles, ClipboardCopy, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  ticketId: string;
  folio: string;
  descripcionUsuario: string;
}

interface BugReporte {
  errores_consola: { nivel: string; mensaje: string; timestamp: string }[];
  peticiones_fallidas: { metodo: string; ruta: string; status: number | null; timestamp: string }[];
  rutas_visitadas: { ruta: string; timestamp: string }[];
  user_agent: string | null;
  viewport: string | null;
  diagnostico_ia: string | null;
}

export function DiagnosticoBugReport({ ticketId, folio, descripcionUsuario }: Props) {
  const [reporte, setReporte] = useState<BugReporte | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = async () => {
    const { data } = await supabase
      .from('bug_reportes')
      .select('errores_consola, peticiones_fallidas, rutas_visitadas, user_agent, viewport, diagnostico_ia')
      .eq('ticket_id', ticketId)
      .maybeSingle();
    setReporte(data as BugReporte | null);

    const { data: archivo } = await supabase
      .from('ticket_archivos')
      .select('url')
      .eq('ticket_id', ticketId)
      .ilike('nombre', 'Captura de pantalla%')
      .order('fecha_subida', { ascending: false })
      .limit(1)
      .maybeSingle();
    setScreenshotUrl(archivo?.url ?? null);
  };

  useEffect(() => { cargar(); }, [ticketId]);

  const handleGenerarDiagnostico = async () => {
    setGenerando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('diagnosticar-bug-report', {
        body: { ticket_id: ticketId },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      await cargar();
    } finally {
      setGenerando(false);
    }
  };

  const handleCopiarPrompt = async () => {
    const prompt = `Diagnostica y propón la solución para este bug reportado en jiromovi (folio ${folio}).

Descripción del usuario: ${descripcionUsuario}

Diagnóstico preliminar (IA): ${reporte?.diagnostico_ia || 'No generado'}

Ruta donde ocurrió: ${reporte?.rutas_visitadas?.[reporte.rutas_visitadas.length - 1]?.ruta || 'desconocida'}
Rutas visitadas antes (más reciente al final): ${JSON.stringify(reporte?.rutas_visitadas || [])}

Errores de consola:
${JSON.stringify(reporte?.errores_consola || [], null, 2)}

Peticiones de red fallidas:
${JSON.stringify(reporte?.peticiones_fallidas || [], null, 2)}

Navegador: ${reporte?.user_agent || 'desconocido'} · Viewport: ${reporte?.viewport || 'desconocido'}

Revisa el código real del repo para confirmar la causa antes de aplicar un fix.`;

    await navigator.clipboard.writeText(prompt);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="space-y-5">
      {screenshotUrl && (
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Captura de pantalla</p>
          <img src={screenshotUrl} alt="Captura del error" className="rounded-xl border border-neutral-200 max-w-full" />
        </div>
      )}

      <div className="p-4 rounded-xl border border-violet-200 bg-violet-50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Diagnóstico IA (preliminar)
          </p>
          <button
            onClick={handleGenerarDiagnostico}
            disabled={generando}
            className="text-xs font-semibold text-violet-600 hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${generando ? 'animate-spin' : ''}`} />
            {reporte?.diagnostico_ia ? 'Regenerar' : 'Generar'}
          </button>
        </div>
        <p className="text-sm text-violet-900 whitespace-pre-wrap">
          {reporte?.diagnostico_ia || 'Aún no se ha generado un diagnóstico automático.'}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Log técnico</p>
        <div className="space-y-2 text-xs">
          <details className="rounded-lg border border-neutral-200 p-2">
            <summary className="cursor-pointer font-medium text-neutral-700">
              Rutas visitadas ({reporte?.rutas_visitadas?.length ?? 0})
            </summary>
            <pre className="mt-2 overflow-x-auto text-neutral-600">{JSON.stringify(reporte?.rutas_visitadas ?? [], null, 2)}</pre>
          </details>
          <details className="rounded-lg border border-neutral-200 p-2">
            <summary className="cursor-pointer font-medium text-neutral-700">
              Errores de consola ({reporte?.errores_consola?.length ?? 0})
            </summary>
            <pre className="mt-2 overflow-x-auto text-neutral-600">{JSON.stringify(reporte?.errores_consola ?? [], null, 2)}</pre>
          </details>
          <details className="rounded-lg border border-neutral-200 p-2">
            <summary className="cursor-pointer font-medium text-neutral-700">
              Peticiones fallidas ({reporte?.peticiones_fallidas?.length ?? 0})
            </summary>
            <pre className="mt-2 overflow-x-auto text-neutral-600">{JSON.stringify(reporte?.peticiones_fallidas ?? [], null, 2)}</pre>
          </details>
          <p className="text-neutral-500">Navegador: {reporte?.user_agent || '—'} · Viewport: {reporte?.viewport || '—'}</p>
        </div>
      </div>

      <button
        onClick={handleCopiarPrompt}
        className="w-full px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
      >
        <ClipboardCopy className="w-4 h-4" />
        {copiado ? 'Prompt copiado' : 'Copiar prompt para Claude Code'}
      </button>
    </div>
  );
}
