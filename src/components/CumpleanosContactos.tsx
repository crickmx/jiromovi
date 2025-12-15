import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cake, Calendar, Phone, Mail, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ContactoConCumpleanos {
  id: string;
  nombre_completo: string;
  celular: string;
  email?: string;
  fecha_nacimiento: string;
  diasRestantes: number;
  edad: number;
}

export default function CumpleanosContactos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contactos, setContactos] = useState<ContactoConCumpleanos[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'trimestre'>('mes');

  useEffect(() => {
    if (user) {
      cargarCumpleanos();
    }
  }, [user, periodo]);

  const cargarCumpleanos = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('crm_contactos')
        .select('id, nombre_completo, celular, email, fecha_nacimiento')
        .eq('creado_por', user.id)
        .not('fecha_nacimiento', 'is', null)
        .order('fecha_nacimiento');

      if (error) throw error;

      const hoy = new Date();
      const anoActual = hoy.getFullYear();

      const diasLimite = periodo === 'semana' ? 7 : periodo === 'mes' ? 30 : 90;

      const contactosConCumpleanos = (data || [])
        .map((contacto) => {
          const fechaNacimiento = new Date(contacto.fecha_nacimiento!);

          const cumpleanosEsteAno = new Date(
            anoActual,
            fechaNacimiento.getMonth(),
            fechaNacimiento.getDate()
          );

          let diasRestantes = Math.ceil(
            (cumpleanosEsteAno.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diasRestantes < 0) {
            const cumpleanosProximoAno = new Date(
              anoActual + 1,
              fechaNacimiento.getMonth(),
              fechaNacimiento.getDate()
            );
            diasRestantes = Math.ceil(
              (cumpleanosProximoAno.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
            );
          }

          const edadActual = anoActual - fechaNacimiento.getFullYear();
          const edad = hoy > cumpleanosEsteAno ? edadActual + 1 : edadActual;

          return {
            ...contacto,
            diasRestantes,
            edad,
          } as ContactoConCumpleanos;
        })
        .filter((contacto) => contacto.diasRestantes <= diasLimite)
        .sort((a, b) => a.diasRestantes - b.diasRestantes);

      setContactos(contactosConCumpleanos);
    } catch (error) {
      console.error('Error al cargar cumpleaños:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
  };

  const getDiasBadge = (dias: number) => {
    if (dias === 0) {
      return { text: 'Hoy', color: 'bg-red-100 text-red-800 border-red-200' };
    } else if (dias === 1) {
      return { text: 'Mañana', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    } else if (dias <= 7) {
      return { text: `${dias} días`, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    } else if (dias <= 30) {
      return { text: `${dias} días`, color: 'bg-blue-100 text-blue-800 border-blue-200' };
    } else {
      return { text: `${dias} días`, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-pink-100 p-2 rounded-lg">
              <Cake className="h-6 w-6 text-pink-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Cumpleaños de Contactos</h2>
              <p className="text-sm text-gray-500">Próximos cumpleaños en tu CRM</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/mi-crm/contactos')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
          >
            Ver todos
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setPeriodo('semana')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              periodo === 'semana'
                ? 'bg-pink-100 text-pink-800 border border-pink-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Esta semana
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              periodo === 'mes'
                ? 'bg-pink-100 text-pink-800 border border-pink-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Este mes
          </button>
          <button
            onClick={() => setPeriodo('trimestre')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              periodo === 'trimestre'
                ? 'bg-pink-100 text-pink-800 border border-pink-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Próximos 3 meses
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {contactos.length === 0 ? (
          <div className="p-8 text-center">
            <Cake className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-1">No hay cumpleaños próximos</p>
            <p className="text-sm text-gray-400">
              {periodo === 'semana'
                ? 'en los próximos 7 días'
                : periodo === 'mes'
                ? 'este mes'
                : 'en los próximos 3 meses'}
            </p>
          </div>
        ) : (
          contactos.map((contacto) => {
            const badge = getDiasBadge(contacto.diasRestantes);

            return (
              <div
                key={contacto.id}
                onClick={() => navigate(`/mi-crm/contactos/${contacto.id}`)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {contacto.nombre_completo}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${badge.color}`}
                      >
                        {badge.text}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-gray-600 mb-2">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatFecha(contacto.fecha_nacimiento)}</span>
                      </div>
                      <span className="text-gray-400">•</span>
                      <span className="font-medium">{contacto.edad} años</span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Phone className="h-3 w-3" />
                        <span>{contacto.celular}</span>
                      </div>
                      {contacto.email && (
                        <>
                          <span className="text-gray-300">|</span>
                          <div className="flex items-center space-x-1 truncate">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{contacto.email}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="ml-3 flex-shrink-0">
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {contactos.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Mostrando {contactos.length} cumpleaños{' '}
            {periodo === 'semana'
              ? 'en los próximos 7 días'
              : periodo === 'mes'
              ? 'este mes'
              : 'en los próximos 3 meses'}
          </p>
        </div>
      )}
    </div>
  );
}
