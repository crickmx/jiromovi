import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug, ToggleLeft, ToggleRight, ExternalLink, Download, Loader2, Save, Copy, Check, CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { supabase } from '../lib/supabase';
import { BUG_REPORT_SISTEMA_AUTOMATICO, PLACEHOLDERS_BUG_REPORT } from '../lib/bugReportTemplate';

interface ConfigRow {
  boton_activo: boolean;
  ia_automatica_activo: boolean;
  tipo_tramite_id: string | null;
  estatus_inicial_slug: string | null;
  estatus_post_diagnostico_slug: string | null;
}

interface EstatusOpcion {
  slug: string;
  label: string;
}

interface TipoOption {
  id: string;
  label: string;
  value: string;
}

interface CampoTipo {
  id: string;
  label: string;
  tipo: string;
  sistema_key: string | null;
}

type Mapeo = { fuente: 'vacio' | 'template'; valor_template: string };

interface ReporteRow {
  id: string;
  folio: string;
  instrucciones: string | null;
  custom_estatus_label: string | null;
  created_at: string;
  grupo_nombre: string | null;
  diagnostico_ia: string | null;
  errores_consola: any[];
  peticiones_fallidas: any[];
  rutas_visitadas: any[];
  user_agent: string | null;
  viewport: string | null;
}

export function AdminReportesBugs() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ConfigRow | null>(null);
  const [tipos, setTipos] = useState<TipoOption[]>([]);
  const [camposTipo, setCamposTipo] = useState<CampoTipo[]>([]);
  const [mapeoCampos, setMapeoCampos] = useState<Record<string, Mapeo>>({});
  const [estatusOpciones, setEstatusOpciones] = useState<EstatusOpcion[]>([]);
  const [guardandoMapeo, setGuardandoMapeo] = useState(false);
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [reporteSeleccionadoId, setReporteSeleccionadoId] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [descargandoDigest, setDescargandoDigest] = useState(false);

  const cargarCamposYMapeo = async (tipoId: string) => {
    const { data: campos, error } = await supabase
      .from('tramite_tipo_campos')
      .select('id, label, tipo, sistema_key, config')
      .eq('tramite_tipo_id', tipoId)
      .eq('activo', true)
      .order('display_order');
    if (error) console.error('Error cargando campos del tipo:', error);

    const estatusCampo = (campos || []).find((c: any) => c.tipo === 'estatus');
    setEstatusOpciones((estatusCampo?.config?.opciones || []).map((o: any) => ({ slug: o.slug, label: o.label })));

    const camposFiltrados = (campos || []).filter((c: any) => !BUG_REPORT_SISTEMA_AUTOMATICO.includes(c.sistema_key ?? '') && c.tipo !== 'estatus');
    setCamposTipo(camposFiltrados);

    if (camposFiltrados.length === 0) { setMapeoCampos({}); return; }
    const { data: mapeo } = await supabase
      .from('bug_report_campo_mapeo')
      .select('campo_id, fuente, valor_template')
      .in('campo_id', camposFiltrados.map(c => c.id));
    const record: Record<string, Mapeo> = {};
    (mapeo || []).forEach((m: any) => { record[m.campo_id] = { fuente: m.fuente, valor_template: m.valor_template ?? '' }; });
    setMapeoCampos(record);
  };

  const cargar = async () => {
    setLoading(true);
    const [{ data: configData }, { data: tiposData }, { data: reportesData }] = await Promise.all([
      supabase.from('bug_report_config').select('boton_activo, ia_automatica_activo, tipo_tramite_id, estatus_inicial_slug, estatus_post_diagnostico_slug').eq('id', 1).maybeSingle(),
      supabase.from('ticket_tipos').select('id, label, value').eq('activo', true).order('label'),
      supabase
        .from('bug_reportes')
        .select('ticket_id, created_at, diagnostico_ia, errores_consola, peticiones_fallidas, rutas_visitadas, user_agent, viewport, tickets!inner(id, folio, instrucciones, custom_estatus_label, grupo_asignado:tramites_grupos_visualizacion!grupo_asignado_id(nombre))')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    const configRow = configData ?? { boton_activo: false, ia_automatica_activo: false, tipo_tramite_id: null, estatus_inicial_slug: null, estatus_post_diagnostico_slug: null };
    setConfig(configRow);
    setTipos(tiposData || []);
    setReportes(
      (reportesData || []).map((r: any) => ({
        id: r.tickets.id,
        folio: r.tickets.folio,
        instrucciones: r.tickets.instrucciones,
        custom_estatus_label: r.tickets.custom_estatus_label,
        created_at: r.created_at,
        grupo_nombre: r.tickets.grupo_asignado?.nombre ?? null,
        diagnostico_ia: r.diagnostico_ia,
        errores_consola: r.errores_consola ?? [],
        peticiones_fallidas: r.peticiones_fallidas ?? [],
        rutas_visitadas: r.rutas_visitadas ?? [],
        user_agent: r.user_agent,
        viewport: r.viewport,
      }))
    );
    if (configRow.tipo_tramite_id) await cargarCamposYMapeo(configRow.tipo_tramite_id);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const toggleConfig = async (campo: 'boton_activo' | 'ia_automatica_activo') => {
    if (!config) return;
    const nuevoValor = !config[campo];
    setConfig({ ...config, [campo]: nuevoValor });
    await supabase.from('bug_report_config').update({ [campo]: nuevoValor }).eq('id', 1);
  };

  const handleTipoChange = async (nuevoTipoId: string) => {
    if (!config) return;
    const valorFinal = nuevoTipoId || null;
    // Al cambiar de tipo, los slugs de estatus del tipo anterior ya no aplican.
    const nuevoConfig = { ...config, tipo_tramite_id: valorFinal, estatus_inicial_slug: null, estatus_post_diagnostico_slug: null };
    setConfig(nuevoConfig);
    await supabase.from('bug_report_config').update({
      tipo_tramite_id: valorFinal,
      estatus_inicial_slug: null,
      estatus_post_diagnostico_slug: null,
    }).eq('id', 1);
    if (valorFinal) await cargarCamposYMapeo(valorFinal);
    else { setCamposTipo([]); setMapeoCampos({}); setEstatusOpciones([]); }
  };

  const handleEstatusConfigChange = async (campo: 'estatus_inicial_slug' | 'estatus_post_diagnostico_slug', slug: string) => {
    if (!config) return;
    const valorFinal = slug || null;
    setConfig({ ...config, [campo]: valorFinal });
    await supabase.from('bug_report_config').update({ [campo]: valorFinal }).eq('id', 1);
  };

  const handleGuardarMapeo = async () => {
    setGuardandoMapeo(true);
    try {
      for (const campo of camposTipo) {
        const m = mapeoCampos[campo.id] ?? { fuente: 'vacio' as const, valor_template: '' };
        await supabase.from('bug_report_campo_mapeo').upsert(
          { campo_id: campo.id, fuente: m.fuente, valor_template: m.valor_template || null },
          { onConflict: 'campo_id' }
        );
      }
    } finally {
      setGuardandoMapeo(false);
    }
  };

  const construirSeccionReporte = (r: ReporteRow): string => {
    const ultimaRuta = r.rutas_visitadas[r.rutas_visitadas.length - 1]?.ruta || 'desconocida';
    return `## Reporte ${r.folio}

- Fecha: ${new Date(r.created_at).toLocaleString('es-MX')}
- Estatus: ${r.custom_estatus_label || 'Sin estatus'}
- Equipo asignado: ${r.grupo_nombre || 'Sin asignar'}
- Ruta donde ocurrió: ${ultimaRuta}

**Descripción del usuario:**
${r.instrucciones || 'Sin descripción'}

**Diagnóstico IA (preliminar, verificar contra el código real antes de aplicar un fix):**
${r.diagnostico_ia || 'No generado'}

**Rutas visitadas antes del error (más reciente al final):**
\`\`\`json
${JSON.stringify(r.rutas_visitadas, null, 2)}
\`\`\`

**Errores de consola:**
\`\`\`json
${JSON.stringify(r.errores_consola, null, 2)}
\`\`\`

**Peticiones de red fallidas:**
\`\`\`json
${JSON.stringify(r.peticiones_fallidas, null, 2)}
\`\`\`

Navegador: ${r.user_agent || 'desconocido'} · Viewport: ${r.viewport || 'desconocido'}

---
`;
  };

  const handleDescargarReporte = () => {
    setDescargando(true);
    try {
      const secciones = reportes.map(construirSeccionReporte).join('\n');

      const contenido = `# Reporte de Bugs — jiromovi
Generado: ${new Date().toLocaleString('es-MX')}
Total de reportes: ${reportes.length}

Instrucciones para el agente de IA: cada sección "## Reporte <folio>" es un bug reportado por un usuario real dentro de la plataforma jiromovi (React + TypeScript + Supabase). El "Diagnóstico IA" es solo una hipótesis preliminar generada sin ver el código — revisa el repo real antes de confirmar una causa o aplicar un fix. Prioriza los reportes por folio más reciente si hay muchos.

---

${secciones}`;

      const blob = new Blob([contenido], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reportes-bugs-jiromovi-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando(false);
    }
  };

  const handleCopiarReporte = async () => {
    const r = reportes.find(x => x.id === reporteSeleccionadoId);
    if (!r) return;
    const contenido = `Instrucciones para el agente de IA: este es un bug reportado por un usuario real dentro de la plataforma jiromovi (React + TypeScript + Supabase). El "Diagnóstico IA" es solo una hipótesis preliminar generada sin ver el código — revisa el repo real antes de confirmar una causa o aplicar un fix.

---

${construirSeccionReporte(r)}`;
    try {
      await navigator.clipboard.writeText(contenido);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      alert('No se pudo copiar al portapapeles.');
    }
  };

  const handleDescargarDigestDiario = async () => {
    setDescargandoDigest(true);
    try {
      const { data, error } = await supabase.storage.from('bug-reports-digest').createSignedUrl('latest.md', 60);
      if (error || !data?.signedUrl) {
        alert('Todavía no se ha generado el reporte diario automático (corre una vez al día).');
        return;
      }
      window.open(data.signedUrl, '_blank');
    } finally {
      setDescargandoDigest(false);
    }
  };

  if (loading) {
    return <div className="p-6 sm:p-8 max-w-5xl mx-auto text-sm text-neutral-500">Cargando…</div>;
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        icon={Bug}
        title="Admin › Reportes de Bugs"
        description="Configura el botón de reporte de problemas y revisa lo reportado."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleDescargarDigestDiario}
              disabled={descargandoDigest}
              title="El más reciente generado automáticamente una vez al día"
              className="px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-xl text-sm font-semibold hover:bg-neutral-50 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {descargandoDigest ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              Reporte diario automático
            </button>
            <button
              onClick={handleDescargarReporte}
              disabled={descargando || reportes.length === 0}
              className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Descargar reporte para IA
            </button>
          </div>
        }
      />

      <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Copiar un solo reporte</p>
          <p className="text-xs text-neutral-500">Elige un trámite y copia solo su información para pegarla en Claude u otra IA.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={reporteSeleccionadoId}
            onChange={(e) => setReporteSeleccionadoId(e.target.value)}
            className="flex-1 px-3 py-2 border border-neutral-300 rounded-xl text-sm bg-white"
          >
            <option value="">Selecciona un trámite…</option>
            {reportes.map(r => (
              <option key={r.id} value={r.id}>
                {r.folio} — {(r.instrucciones || 'Sin descripción').slice(0, 80)}
              </option>
            ))}
          </select>
          <button
            onClick={handleCopiarReporte}
            disabled={!reporteSeleccionadoId}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Botón flotante activo</p>
            <p className="text-xs text-neutral-500">Muestra "Reportar un problema" a todos los usuarios logueados.</p>
          </div>
          <button onClick={() => toggleConfig('boton_activo')}>
            {config?.boton_activo
              ? <ToggleRight className="w-9 h-9 text-emerald-500" />
              : <ToggleLeft className="w-9 h-9 text-neutral-300" />}
          </button>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Diagnóstico automático con IA</p>
            <p className="text-xs text-neutral-500">Genera un diagnóstico preliminar con IA al recibir cada reporte.</p>
          </div>
          <button onClick={() => toggleConfig('ia_automatica_activo')}>
            {config?.ia_automatica_activo
              ? <ToggleRight className="w-9 h-9 text-emerald-500" />
              : <ToggleLeft className="w-9 h-9 text-neutral-300" />}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900 mb-1">Trámite que se crea al reportar</p>
          <select
            value={config?.tipo_tramite_id ?? ''}
            onChange={e => handleTipoChange(e.target.value)}
            className="w-full sm:w-96 px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Selecciona un tipo de trámite…</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <p className="text-xs text-neutral-400 mt-2">
            La asignación a equipo (¿quién atiende los reportes?) se configura como cualquier otro tipo de trámite, desde Admin › Trámites → Equipos habilitados / Asignación por Trámites, para el tipo elegido aquí.
          </p>
        </div>

        {config?.tipo_tramite_id && estatusOpciones.length > 0 && (
          <div className="pt-4 border-t border-neutral-100 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Estatus con el que se crea</label>
              <select
                value={config.estatus_inicial_slug ?? ''}
                onChange={e => handleEstatusConfigChange('estatus_inicial_slug', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Usar el primero definido en el tipo</option>
                {estatusOpciones.map(o => <option key={o.slug} value={o.slug}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Estatus tras el diagnóstico IA</label>
              <select
                value={config.estatus_post_diagnostico_slug ?? ''}
                onChange={e => handleEstatusConfigChange('estatus_post_diagnostico_slug', e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">No cambiar de estatus</option>
                {estatusOpciones.map(o => <option key={o.slug} value={o.slug}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {config?.tipo_tramite_id && (
          <div className="pt-4 border-t border-neutral-100 space-y-3">
            <p className="text-sm font-semibold text-neutral-900">Autollenado de campos del formulario</p>
            <p className="text-xs text-neutral-500">
              Área, Equipo, Asignar a, Creado Por, Fechas y Estatus se autollenan solos. Configura aquí solo los campos propios de este tipo (ej. "Descripción", "Navegador").
            </p>
            {camposTipo.length === 0 ? (
              <p className="text-xs text-neutral-400">Este tipo no tiene campos propios que mapear.</p>
            ) : (
              <>
                {camposTipo.map(campo => {
                  const m = mapeoCampos[campo.id] ?? { fuente: 'vacio' as const, valor_template: '' };
                  return (
                    <div key={campo.id} className="border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-800 flex-1 min-w-0 truncate">{campo.label}</span>
                        <select
                          value={m.fuente}
                          onChange={e => setMapeoCampos(prev => ({
                            ...prev,
                            [campo.id]: { fuente: e.target.value as 'vacio' | 'template', valor_template: prev[campo.id]?.valor_template ?? '' },
                          }))}
                          className="px-2.5 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white text-neutral-900 shrink-0"
                        >
                          <option value="vacio">No autollenar</option>
                          <option value="template">Plantilla de texto</option>
                        </select>
                      </div>
                      {m.fuente === 'template' && (
                        <div className="mt-2 space-y-1.5">
                          <input
                            type="text"
                            value={m.valor_template}
                            onChange={e => setMapeoCampos(prev => ({ ...prev, [campo.id]: { fuente: 'template', valor_template: e.target.value } }))}
                            placeholder="Ej: {{descripcion}} — ocurrió en {{url}}"
                            className="w-full px-2.5 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white text-neutral-900"
                          />
                          <div className="flex flex-wrap gap-1">
                            {PLACEHOLDERS_BUG_REPORT.map(p => (
                              <button
                                key={p.key}
                                type="button"
                                title={p.label}
                                onClick={() => setMapeoCampos(prev => ({
                                  ...prev,
                                  [campo.id]: { fuente: 'template', valor_template: `${prev[campo.id]?.valor_template ?? ''}${p.key}` },
                                }))}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                              >
                                {p.key}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  onClick={handleGuardarMapeo}
                  disabled={guardandoMapeo}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {guardandoMapeo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar mapeo
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-900">Reportes recibidos ({reportes.length})</p>
        </div>
        {reportes.length === 0 ? (
          <p className="p-5 text-sm text-neutral-500">Sin reportes todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-100">
                <th className="px-5 py-2">Folio</th>
                <th className="px-5 py-2">Descripción</th>
                <th className="px-5 py-2">Equipo</th>
                <th className="px-5 py-2">Estatus</th>
                <th className="px-5 py-2">Fecha</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {reportes.map(r => (
                <tr key={r.id} className="border-b border-neutral-50 hover:bg-neutral-50 cursor-pointer" onClick={() => navigate(`/tramites/${r.id}`)}>
                  <td className="px-5 py-3 font-medium text-neutral-900">{r.folio}</td>
                  <td className="px-5 py-3 text-neutral-600 max-w-xs truncate">{r.instrucciones}</td>
                  <td className="px-5 py-3 text-neutral-600">{r.grupo_nombre || 'Sin asignar'}</td>
                  <td className="px-5 py-3 text-neutral-600">{r.custom_estatus_label || '—'}</td>
                  <td className="px-5 py-3 text-neutral-500">{new Date(r.created_at).toLocaleDateString('es-MX')}</td>
                  <td className="px-5 py-3"><ExternalLink className="w-4 h-4 text-neutral-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminReportesBugs;
