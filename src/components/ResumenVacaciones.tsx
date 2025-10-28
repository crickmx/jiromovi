import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { formatearFecha } from '../lib/vacacionesUtils';
import type { Database } from '../lib/database.types';

type SolicitudVacaciones = Database['public']['Tables']['solicitudes_vacaciones']['Row'] & {
  empleado?: { nombre: string; apellidos: string } | null;
  oficinas?: { nombre: string } | null;
};

export function ResumenVacaciones() {
  const navigate = useNavigate();
  const { usuario: currentUser } = useAuth();
  const [solicitudesPendientes, setSolicitudesPendientes] = useState<SolicitudVacaciones[]>([]);
  const [solicitudesPreaprobadas, setSolicitudesPreaprobadas] = useState<SolicitudVacaciones[]>([]);
  const [loading, setLoading] = useState(true);

  const isGerente = currentUser?.rol === 'Gerente';
  const isAdmin = currentUser?.rol === 'Administrador';

  useEffect(() => {
    loadSolicitudes();
  }, []);

  const loadSolicitudes = async () => {
    setLoading(true);
    try {
      if (isGerente) {
        const { data } = await supabase
          .from('solicitudes_vacaciones')
          .select('*, empleado:usuarios!solicitudes_vacaciones_empleado_id_fkey(nombre, apellidos)')
          .eq('oficina_id', currentUser?.oficina_id || '')
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false })
          .limit(5);

        setSolicitudesPendientes(data || []);
      } else if (isAdmin) {
        const { data } = await supabase
          .from('solicitudes_vacaciones')
          .select('*, empleado:usuarios!solicitudes_vacaciones_empleado_id_fkey(nombre, apellidos), oficinas(nombre)')
          .eq('estado', 'preaprobado')
          .order('created_at', { ascending: false })
          .limit(5);

        setSolicitudesPreaprobadas(data || []);
      }
    } catch (error) {
      console.error('Error loading vacation requests:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const solicitudes = isGerente ? solicitudesPendientes : solicitudesPreaprobadas;
  const titulo = isGerente ? 'Solicitudes de Vacaciones Pendientes' : 'Solicitudes Preaprobadas';
  const estadoBadge = isGerente ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800';
  const estadoLabel = isGerente ? 'Pendiente' : 'Preaprobado';

  if (solicitudes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{titulo}</h2>
            <p className="text-sm text-slate-600">
              {solicitudes.length} {solicitudes.length === 1 ? 'solicitud requiere' : 'solicitudes requieren'} tu atención
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/vacaciones')}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          Ver todas →
        </button>
      </div>

      <div className="space-y-3">
        {solicitudes.map((solicitud) => (
          <div
            key={solicitud.id}
            className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition cursor-pointer"
            onClick={() => navigate('/vacaciones')}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {solicitud.empleado?.nombre} {solicitud.empleado?.apellidos}
                </h3>
                {isAdmin && solicitud.oficinas && (
                  <p className="text-sm text-slate-600">{solicitud.oficinas.nombre}</p>
                )}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${estadoBadge}`}>
                {estadoLabel}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-slate-700">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {formatearFecha(solicitud.fecha_inicio)} - {formatearFecha(solicitud.fecha_fin)}
              </span>
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {solicitud.dias_solicitados} días
              </span>
            </div>
          </div>
        ))}
      </div>

      {solicitudes.length >= 5 && (
        <button
          onClick={() => navigate('/vacaciones')}
          className="w-full mt-4 text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded-lg transition"
        >
          Ver más solicitudes
        </button>
      )}
    </div>
  );
}
