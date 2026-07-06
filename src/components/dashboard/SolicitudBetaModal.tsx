import { useState } from 'react';
import { X, Rocket, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Usuario } from '../../contexts/MoviAuthContext';

interface Props {
  usuario: Usuario;
  onClose: () => void;
  onSuccess: () => void;
}

const TIPO_VALUE = 'alta_usuario_beta';

// Crea el tramite "Alta Usuario Beta" con los campos sistema autocompletados.
// No reusa NuevoTramiteModal.tsx (pensado para que staff cree tramites de
// cualquier tipo con seleccion de agente) -- este es un flujo de autoservicio
// de un solo campo real (Comentarios), asi que replica solo el subconjunto de
// su logica de creacion que aplica aqui.
export function SolicitudBetaModal({ usuario, onClose, onSuccess }: Props) {
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const handleEnviar = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: tipo }, { data: estatusIniciado }] = await Promise.all([
        supabase.from('ticket_tipos').select('id, area').eq('value', TIPO_VALUE).single(),
        supabase.from('ticket_estatus').select('id').eq('nombre', 'Iniciado').single(),
      ]);
      if (!tipo) throw new Error('No se encontró el tipo de trámite "Alta Usuario Beta"');
      if (!estatusIniciado) throw new Error('No se encontró el estatus "Iniciado"');

      const { data: grupoData } = await supabase.rpc('get_grupo_para_ticket', {
        p_agente_id: usuario.id,
        p_tipo_tramite: TIPO_VALUE,
      });
      const grupoRow = Array.isArray(grupoData) && grupoData.length > 0
        ? (grupoData[0] as { grupo_id: string; ejecutivo_id: string | null })
        : null;
      const grupoAsignadoId = grupoRow?.grupo_id ?? null;
      const responsableId = grupoRow?.ejecutivo_id ?? null;

      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          tipo_tramite: TIPO_VALUE,
          estatus_id: estatusIniciado.id,
          prioridad: 'Media',
          instrucciones: comentario.trim() || 'Sin comentarios',
          creado_por: usuario.id,
          modificado_por: usuario.id,
          agente_id: usuario.id,
          assigned_to_user_id: responsableId,
          grupo_asignado_id: grupoAsignadoId,
        })
        .select()
        .single();
      if (ticketError) throw ticketError;

      if (comentario.trim()) {
        await supabase.from('ticket_comentarios').insert({
          ticket_id: ticket.id,
          usuario_id: usuario.id,
          mensaje: comentario.trim(),
        });
      }

      const { data: campos } = await supabase
        .from('tramite_tipo_campos')
        .select('id, key, tipo, sistema_key, config')
        .eq('tramite_tipo_id', tipo.id)
        .eq('activo', true);

      const campoPorSistemaKey = (sistemaKey: string) => campos?.find(c => c.sistema_key === sistemaKey);
      const respuestas: { tramite_id: string; campo_id: string; valor_texto?: string; valor_json?: unknown }[] = [];

      const areaCampo = campoPorSistemaKey('area');
      if (areaCampo && tipo.area) respuestas.push({ tramite_id: ticket.id, campo_id: areaCampo.id, valor_texto: tipo.area });

      const fechaCreCampo = campoPorSistemaKey('fecha_creacion');
      if (fechaCreCampo) respuestas.push({ tramite_id: ticket.id, campo_id: fechaCreCampo.id, valor_texto: new Date().toISOString() });

      const creadoPorCampo = campoPorSistemaKey('creado_por');
      if (creadoPorCampo) respuestas.push({ tramite_id: ticket.id, campo_id: creadoPorCampo.id, valor_texto: usuario.nombre_completo || usuario.nombre || '' });

      const oficinaCampo = campoPorSistemaKey('oficina_jiro');
      if (oficinaCampo && usuario.oficina?.nombre) respuestas.push({ tramite_id: ticket.id, campo_id: oficinaCampo.id, valor_texto: usuario.oficina.nombre });

      const equipoCampo = campoPorSistemaKey('equipo');
      if (equipoCampo && grupoAsignadoId) {
        const { data: grupo } = await supabase.from('tramites_grupos_visualizacion').select('nombre').eq('id', grupoAsignadoId).single();
        if (grupo) respuestas.push({ tramite_id: ticket.id, campo_id: equipoCampo.id, valor_texto: grupo.nombre });
      }

      const estatusCampo = campos?.find(c => c.tipo === 'estatus');
      if (estatusCampo) {
        respuestas.push({ tramite_id: ticket.id, campo_id: estatusCampo.id, valor_json: 'iniciado' });
        const opcion = (estatusCampo.config?.opciones || []).find((o: { slug: string }) => o.slug === 'iniciado');
        if (opcion) {
          const color = opcion.clasificacion === 'inicio' ? '#3B82F6' : opcion.clasificacion === 'terminacion' ? '#059669' : '#6B7280';
          await supabase.from('tickets').update({ custom_estatus_label: opcion.label, custom_estatus_color: color }).eq('id', ticket.id);
        }
      }

      const comentarioCampo = campos?.find(c => c.key === 'texto_corto_13');
      if (comentarioCampo && comentario.trim()) {
        respuestas.push({ tramite_id: ticket.id, campo_id: comentarioCampo.id, valor_texto: comentario.trim() });
      }

      if (respuestas.length > 0) await supabase.from('tramite_respuestas').insert(respuestas);

      setEnviado(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {enviado ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-base font-semibold text-neutral-900 dark:text-white">¡Solicitud enviada!</p>
            <p className="text-sm text-neutral-500 dark:text-white/60">
              Un administrador la revisará pronto — te avisaremos cuando tu acceso Beta esté listo.
            </p>
            <button
              onClick={onSuccess}
              className="w-full px-4 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-accent" />
                <p className="text-base font-semibold text-neutral-900 dark:text-white">Únete a la Beta</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-neutral-500 dark:text-white/60">
                Se creará el trámite "Alta Usuario Beta" con tus datos. Un administrador revisará tu solicitud.
              </p>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-white/70 mb-1">
                  Comentarios <span className="text-neutral-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value.slice(0, 255))}
                  rows={3}
                  maxLength={255}
                  placeholder="¿Qué te gustaría probar?"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-accent focus:outline-none resize-none bg-white dark:bg-white/5 text-neutral-900 dark:text-white"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={handleEnviar}
                disabled={loading}
                className="w-full px-4 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
