import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Plus, AlertCircle } from 'lucide-react';

interface TramiteItem {
  id: string;
  folio: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  instrucciones: string;
  estatus: {
    nombre: string;
    color: string;
  } | null;
}

export function TramitesWidget() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [tramites, setTramites] = useState<TramiteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTramites();
  }, []);

  const loadTramites = async () => {
    if (!usuario) return;

    const { data } = await supabase
      .from('tickets')
      .select(`
        id,
        folio,
        prioridad,
        instrucciones,
        estatus:estatus_id(nombre, color)
      `)
      .is('cerrado_en', null)
      .or(`agente_id.eq.${usuario.id},creado_por.eq.${usuario.id}`)
      .order('fecha_creacion', { ascending: false })
      .limit(5);

    if (data) setTramites(data as TramiteItem[]);
    setLoading(false);
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta': return 'text-red-600';
      case 'Media': return 'text-yellow-600';
      case 'Baja': return 'text-green-600';
      default: return 'text-neutral-600';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <ClipboardList className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-display font-bold text-neutral-900">
            Mis Trámites Activos
          </h2>
        </div>
        <button
          onClick={() => navigate('/tramites')}
          className="text-primary-600 hover:text-primary-700 text-sm font-semibold"
        >
          Ver todos
        </button>
      </div>

      {tramites.length === 0 ? (
        <div className="text-center py-8">
          <ClipboardList className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-600 text-sm mb-4">No tienes trámites activos</p>
          <button
            onClick={() => navigate('/tramites')}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all font-semibold text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Trámite</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tramites.map((tramite) => (
            <div
              key={tramite.id}
              onClick={() => navigate(`/tramites/${tramite.id}`)}
              className="p-4 border border-neutral-200 rounded-xl hover:shadow-medium transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-bold text-primary-600">
                  {tramite.folio}
                </span>
                <div className="flex items-center space-x-2">
                  {tramite.estatus && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: tramite.estatus.color + '20',
                        color: tramite.estatus.color
                      }}
                    >
                      {tramite.estatus.nombre}
                    </span>
                  )}
                  <AlertCircle className={`w-4 h-4 ${getPrioridadColor(tramite.prioridad)}`} />
                </div>
              </div>
              <p className="text-sm text-neutral-700 line-clamp-2">
                {tramite.instrucciones}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
