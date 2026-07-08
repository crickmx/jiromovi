import { useState } from 'react';
import { X, TriangleAlert, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { getBugReportSnapshot } from '../lib/bugReportCapture';
import { resolverTemplateBugReport, construirRespuestaBugReport } from '../lib/bugReportTemplate';
import { crearNotificacion } from '../lib/notificationHelpers';

const CATEGORIA_CAPTURA_NOMBRE = 'Captura de pantalla (Reporte de bug)';

interface Props {
  screenshot: string | null;
  onClose: () => void;
}

// Modal de autoservicio: crea el trámite "Reporte de bug" con captura + log técnico
// adjuntos. No usa NuevoTramiteModal.tsx (mismo motivo que SolicitudBetaModal.tsx:
// flujo de un solo campo real, con captura/log que ese modal no maneja).
export function ReportarBugModal({ screenshot, onClose }: Props) {
  const { usuario } = useMoviAuth();
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const handleEnviar = async () => {
    if (!usuario) return;
    setLoading(true);
    setError('');
    try {
      const { data: bugConfig } = await supabase
        .from('bug_report_config')
        .select('tipo_tramite_id, ia_automatica_activo, estatus_inicial_slug')
        .eq('id', 1)
        .maybeSingle();
      if (!bugConfig?.tipo_tramite_id) {
        throw new Error('El administrador aún no configuró qué trámite se crea al reportar un problema.');
      }

      const [{ data: tipo }, { data: estatusIniciado }] = await Promise.all([
        supabase.from('ticket_tipos').select('id, value, area').eq('id', bugConfig.tipo_tramite_id).maybeSingle(),
        supabase.from('ticket_estatus').select('id').eq('nombre', 'Iniciado').maybeSingle(),
      ]);
      if (!tipo) throw new Error('El tipo de trámite configurado ya no existe.');
      if (!estatusIniciado) throw new Error('No se encontró el estatus "Iniciado"');

      const { data: grupoData } = await supabase.rpc('get_grupo_para_ticket', {
        p_agente_id: usuario.id,
        p_tipo_tramite: tipo.value,
      });
      const grupoRow = Array.isArray(grupoData) && grupoData.length > 0
        ? (grupoData[0] as { grupo_id: string; ejecutivo_id: string | null })
        : null;
      const grupoAsignadoId = grupoRow?.grupo_id ?? null;
      const responsableId = grupoRow?.ejecutivo_id ?? null;

      // agente_id sí se llena (a diferencia de un trámite oculto por completo) porque
      // needsAttentionFn en Tramites.tsx lo necesita para clasificar "Requiere atención"
      // del lado del Admin. Que el creador no vea su propio reporte lo resuelve el RLS
      // (tickets_select_v9 excluye explícitamente los reportes de bug de esa cláusula).
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          tipo_tramite: tipo.value,
          estatus_id: estatusIniciado.id,
          prioridad: 'Media',
          instrucciones: descripcion.trim() || 'Sin descripción adicional',
          creado_por: usuario.id,
          modificado_por: usuario.id,
          agente_id: usuario.id,
          assigned_to_user_id: responsableId,
          grupo_asignado_id: grupoAsignadoId,
        })
        .select()
        .single();
      if (ticketError) throw ticketError;

      // Mismo criterio de aviso que NuevoTramiteModal.tsx: al responsable directo, si no al
      // líder del equipo asignado, y si no hay ni equipo a todos los Administradores.
      if (responsableId) {
        await crearNotificacion({
          user_id: responsableId,
          titulo: 'Nuevo reporte de bug asignado',
          mensaje: `Se te asignó el reporte de bug ${ticket.folio}.`,
          modulo: 'Tramites',
          icono: 'clipboard-list',
          accion_url: `/tramites/${ticket.id}`,
          accion_texto: 'Ver reporte',
        });
      } else if (grupoAsignadoId) {
        const { data: miembros } = await supabase.rpc('get_grupo_miembros_ejecutivos', { p_grupo_id: grupoAsignadoId });
        const lider = (miembros as Array<{ id: string; nombre_completo: string }>)?.[0];
        if (lider) {
          await crearNotificacion({
            user_id: lider.id,
            titulo: 'Nuevo reporte de bug en tu equipo',
            mensaje: `Nuevo reporte de bug ${ticket.folio} asignado a tu equipo.`,
            modulo: 'Tramites',
            icono: 'clipboard-list',
            accion_url: `/tramites/${ticket.id}`,
            accion_texto: 'Ver reporte',
          });
        }
      } else {
        const { data: adminsSinEquipo } = await supabase.from('usuarios').select('id')
          .eq('rol', 'Administrador').eq('activo', true);
        for (const adm of (adminsSinEquipo ?? [])) {
          await crearNotificacion({
            user_id: adm.id,
            titulo: 'Reporte de bug sin equipo asignado',
            mensaje: `El reporte de bug ${ticket.folio} no se pudo asignar automáticamente a ningún equipo. Requiere asignación manual.`,
            modulo: 'Tramites',
            icono: 'alert-triangle',
            accion_url: `/tramites/${ticket.id}`,
            accion_texto: 'Ver reporte',
          });
        }
      }

      const { data: campos } = await supabase
        .from('tramite_tipo_campos')
        .select('id, key, tipo, sistema_key, config')
        .eq('tramite_tipo_id', tipo.id)
        .eq('activo', true);

      const campoPorSistemaKey = (sistemaKey: string) => campos?.find(c => c.sistema_key === sistemaKey);
      const respuestas: ReturnType<typeof construirRespuestaBugReport>[] = [];

      const areaCampo = campoPorSistemaKey('area');
      if (areaCampo && tipo.area) respuestas.push(construirRespuestaBugReport(ticket.id, areaCampo.id, 'area', tipo.area));

      const fechaCreCampo = campoPorSistemaKey('fecha_creacion');
      if (fechaCreCampo) respuestas.push(construirRespuestaBugReport(ticket.id, fechaCreCampo.id, 'fecha_creacion', new Date().toISOString()));

      const creadoPorCampo = campoPorSistemaKey('creado_por');
      if (creadoPorCampo) respuestas.push(construirRespuestaBugReport(ticket.id, creadoPorCampo.id, 'creado_por', usuario.nombre_completo || usuario.nombre || ''));

      const oficinaCampo = campoPorSistemaKey('oficina_jiro');
      if (oficinaCampo && usuario.oficina?.nombre) respuestas.push(construirRespuestaBugReport(ticket.id, oficinaCampo.id, 'oficina_jiro', usuario.oficina.nombre));

      // El Agente de un reporte de bug siempre es quien lo reporta (no aplica un
      // agente/vendedor real como en un trámite comercial).
      const agenteCampo = campoPorSistemaKey('agente_vendedor');
      if (agenteCampo) respuestas.push(construirRespuestaBugReport(ticket.id, agenteCampo.id, 'agente_vendedor', usuario.nombre_completo || usuario.nombre || ''));

      const equipoCampo = campoPorSistemaKey('equipo');
      if (equipoCampo && grupoAsignadoId) {
        const { data: grupo } = await supabase.from('tramites_grupos_visualizacion').select('nombre').eq('id', grupoAsignadoId).single();
        if (grupo) respuestas.push(construirRespuestaBugReport(ticket.id, equipoCampo.id, 'equipo', grupo.nombre));
      }

      const estatusCampo = campos?.find(c => c.tipo === 'estatus');
      if (estatusCampo) {
        const opciones = estatusCampo.config?.opciones || [];
        const slugInicial = bugConfig.estatus_inicial_slug || opciones[0]?.slug;
        const opcion = opciones.find((o: { slug: string }) => o.slug === slugInicial);
        if (opcion) {
          respuestas.push(construirRespuestaBugReport(ticket.id, estatusCampo.id, 'estatus', opcion.slug));
          const color = opcion.clasificacion === 'inicio' ? '#3B82F6'
            : opcion.clasificacion === 'terminacion' ? '#059669'
            : opcion.clasificacion === 'en_espera' ? '#F59E0B'
            : '#6B7280';
          await supabase.from('tickets').update({ custom_estatus_label: opcion.label, custom_estatus_color: color }).eq('id', ticket.id);
        }
      }

      const snapshot = getBugReportSnapshot();

      // Campos que ya se autollenaron arriba — si el admin también configuró un mapeo
      // para alguno de ellos, se ignora aquí (tramite_respuestas tiene UNIQUE por
      // tramite_id+campo_id, insertar los dos rompería con un choque de duplicado).
      const camposAutoRellenados = new Set(respuestas.map(r => r.campo_id));

      if (campos && campos.length > 0) {
        const { data: mapeo } = await supabase
          .from('bug_report_campo_mapeo')
          .select('campo_id, fuente, valor_template')
          .in('campo_id', campos.map(c => c.id));

        (mapeo ?? [])
          .filter(m => m.fuente === 'template' && m.valor_template && !camposAutoRellenados.has(m.campo_id))
          .forEach(m => {
            const campoInfo = campos.find(c => c.id === m.campo_id);
            const valor = resolverTemplateBugReport(m.valor_template as string, { descripcion: descripcion.trim(), snapshot });
            respuestas.push(construirRespuestaBugReport(ticket.id, m.campo_id, campoInfo?.tipo ?? 'texto_corto', valor));
          });
      }

      if (respuestas.length > 0) await supabase.from('tramite_respuestas').insert(respuestas);

      if (screenshot) {
        const { data: categoria } = await supabase
          .from('maestro_adjunto_categorias')
          .select('id')
          .eq('nombre', CATEGORIA_CAPTURA_NOMBRE)
          .maybeSingle();

        const blob = await (await fetch(screenshot)).blob();
        const fileName = `${ticket.id}/${Date.now()}-captura.png`;
        const { error: uploadError } = await supabase.storage.from('ticket-archivos').upload(fileName, blob, { contentType: 'image/png' });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('ticket-archivos').getPublicUrl(fileName);
          await supabase.from('ticket_archivos').insert({
            ticket_id: ticket.id,
            usuario_id: usuario.id,
            nombre: 'Captura de pantalla.png',
            url: publicUrl,
            tipo: 'image/png',
            tamano: blob.size,
            categoria_id: categoria?.id ?? null,
          });
        }
      }

      await supabase.from('bug_reportes').insert({
        ticket_id: ticket.id,
        errores_consola: snapshot.errores_consola,
        peticiones_fallidas: snapshot.peticiones_fallidas,
        rutas_visitadas: snapshot.rutas_visitadas,
        user_agent: snapshot.user_agent,
        viewport: snapshot.viewport,
      });

      if (bugConfig.ia_automatica_activo) {
        supabase.functions.invoke('diagnosticar-bug-report', { body: { ticket_id: ticket.id } }).catch(() => {});
      }

      setEnviado(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el reporte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {enviado ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-base font-semibold text-neutral-900 dark:text-white">¡Gracias por tu reporte!</p>
            <p className="text-sm text-neutral-500 dark:text-white/60">
              Nuestro equipo lo va a revisar.
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <TriangleAlert className="w-5 h-5 text-amber-500" />
                <p className="text-base font-semibold text-neutral-900 dark:text-white">Reportar un problema</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-neutral-500 dark:text-white/60">
                Ya tomamos una captura de tu pantalla y datos técnicos. Solo cuéntanos qué intentabas hacer y qué pasó.
              </p>
              {screenshot && (
                <img src={screenshot} alt="Captura de pantalla" className="w-full rounded-lg border border-neutral-200 dark:border-white/10 max-h-40 object-cover object-top" />
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                  ¿Qué pasó?
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value.slice(0, 500))}
                  rows={4}
                  maxLength={500}
                  placeholder="Ej: Le di clic a Guardar en un trámite y la pantalla se puso en blanco."
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-accent focus:outline-none resize-none bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={handleEnviar}
                disabled={loading}
                className="w-full px-4 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar reporte'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
