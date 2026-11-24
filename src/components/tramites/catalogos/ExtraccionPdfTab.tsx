import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Info } from 'lucide-react';

interface Props {
  tipoId: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

interface Grupo {
  id: string;
  nombre: string;
}

const TOKENS_AGENTE = ['{folio}', '{numero_poliza}', '{aseguradora}', '{cliente}', '{desde}', '{hasta}', '{prima_total}', '{placas}'];
const TOKENS_EQUIPO = [...TOKENS_AGENTE, '{agente_nombre}'];

export function ExtraccionPdfTab({ tipoId, showToast }: Props) {
  const [categoriaPolizaId, setCategoriaPolizaId] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [activo, setActivo] = useState(false);
  const [notificarAgente, setNotificarAgente] = useState(true);
  const [notificarGrupos, setNotificarGrupos] = useState<string[]>([]);
  const [plantillaAgente, setPlantillaAgente] = useState('');
  const [plantillaEquipo, setPlantillaEquipo] = useState('');
  const [configId, setConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('maestro_adjunto_categorias').select('id').eq('nombre', 'Póliza PDF').maybeSingle(),
      supabase.from('tramites_grupos_visualizacion').select('id, nombre').eq('activo', true).order('nombre'),
    ]).then(([{ data: cat }, { data: grps }]) => {
      const catId = cat?.id ?? null;
      setCategoriaPolizaId(catId);
      setGrupos((grps as Grupo[]) ?? []);

      if (catId) {
        supabase
          .from('poliza_pdf_extraccion_config')
          .select('*')
          .eq('ticket_tipo_id', tipoId)
          .eq('categoria_id', catId)
          .maybeSingle()
          .then(({ data: cfg }) => {
            if (cfg) {
              setConfigId(cfg.id);
              setActivo(cfg.activo);
              setNotificarAgente(cfg.notificar_agente);
              setNotificarGrupos(cfg.notificar_grupos ?? []);
              setPlantillaAgente(cfg.plantilla_agente ?? '');
              setPlantillaEquipo(cfg.plantilla_equipo ?? '');
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, [tipoId]);

  const handleSave = async () => {
    if (!categoriaPolizaId) {
      showToast('La categoría "Póliza PDF" no existe. Corre la migración primero.', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      ticket_tipo_id: tipoId,
      categoria_id: categoriaPolizaId,
      activo,
      notificar_agente: notificarAgente,
      notificar_grupos: notificarGrupos,
      plantilla_agente: plantillaAgente.trim() || null,
      plantilla_equipo: plantillaEquipo.trim() || null,
    };
    const { error } = configId
      ? await supabase.from('poliza_pdf_extraccion_config').update(payload).eq('id', configId)
      : await supabase.from('poliza_pdf_extraccion_config').insert(payload).select('id').single()
          .then(async (res) => {
            if (res.data) setConfigId((res.data as any).id);
            return res;
          });
    setSaving(false);
    if (error) showToast('Error al guardar: ' + error.message, 'error');
    else showToast('Configuración guardada');
  };

  const toggleGrupo = (id: string) => {
    setNotificarGrupos(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  if (loading) {
    return <div className="p-6 text-sm text-neutral-500">Cargando configuración...</div>;
  }

  return (
    <div className="p-5 space-y-6 overflow-auto">
      {/* Activar */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={activo}
            onChange={e => setActivo(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-neutral-700">
            Activar extracción automática de PDF de póliza
          </span>
        </label>
        <p className="text-xs text-neutral-400 mt-1 ml-7">
          Cuando está activo, al adjuntar un archivo con categoría "Póliza PDF" se extraen
          los datos automáticamente y se guardan para consulta.
        </p>
      </div>

      {activo && (
        <>
          {/* Notificar agente */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notificarAgente}
                onChange={e => setNotificarAgente(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-neutral-700">Notificar al agente del trámite</span>
            </label>
          </div>

          {/* Notificar grupos */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Notificar equipos
            </label>
            {grupos.length === 0 ? (
              <p className="text-xs text-neutral-400">No hay equipos disponibles.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-neutral-200 rounded-lg p-3">
                {grupos.map(g => (
                  <label key={g.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={notificarGrupos.includes(g.id)}
                      onChange={() => toggleGrupo(g.id)}
                      className="w-3.5 h-3.5 rounded border-neutral-300 text-blue-600"
                    />
                    {g.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Plantilla agente */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Mensaje al agente (opcional)
            </label>
            <textarea
              value={plantillaAgente}
              onChange={e => setPlantillaAgente(e.target.value)}
              rows={4}
              placeholder="Deja vacío para usar el mensaje predeterminado."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none"
            />
            <div className="flex items-start gap-1 mt-1 text-xs text-neutral-400">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Tokens disponibles: {TOKENS_AGENTE.join(', ')}</span>
            </div>
          </div>

          {/* Plantilla equipo */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Mensaje al equipo (opcional)
            </label>
            <textarea
              value={plantillaEquipo}
              onChange={e => setPlantillaEquipo(e.target.value)}
              rows={4}
              placeholder="Deja vacío para usar el mensaje predeterminado."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none"
            />
            <div className="flex items-start gap-1 mt-1 text-xs text-neutral-400">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Tokens disponibles: {TOKENS_EQUIPO.join(', ')}</span>
            </div>
          </div>
        </>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );
}
