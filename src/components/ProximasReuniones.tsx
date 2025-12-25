import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Video, Calendar, Clock, ArrowRight } from 'lucide-react';
import { formatMeetingDateTime } from '../lib/meetingUtils';
import type { Database } from '../lib/database.types';

type Meeting = Database['public']['Tables']['meetings']['Row'];

export function ProximasReuniones() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUpcomingMeetings();
  }, [usuario]);

  const loadUpcomingMeetings = async () => {
    if (!usuario) return;

    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('creator_id', usuario.id)
        .in('status', ['scheduled', 'active'])
        .gte('scheduled_datetime', now)
        .order('scheduled_datetime', { ascending: true })
        .limit(5);

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading upcoming meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Video className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Próximas Reuniones</h2>
            <p className="text-sm text-slate-600">No hay reuniones programadas</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-slate-500 mb-4">No tienes reuniones próximas</p>
          <button
            onClick={() => navigate('/movi-meet')}
            className="text-purple-600 hover:text-purple-700 font-medium text-sm"
          >
            Crear una reunión →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Video className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Próximas Reuniones</h2>
            <p className="text-sm text-slate-600">
              {meetings.length} {meetings.length === 1 ? 'reunión programada' : 'reuniones programadas'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/movi-meet')}
          className="text-purple-600 hover:text-purple-700 text-sm font-medium"
        >
          Ver todas →
        </button>
      </div>

      <div className="space-y-3">
        {meetings.map((meeting) => {
          const { date, time } = formatMeetingDateTime(meeting.scheduled_datetime);
          return (
            <div
              key={meeting.id}
              className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    {meeting.title}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-slate-600">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {date}
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {time}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    meeting.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-primary-100 text-primary-800'
                  }`}
                >
                  {meeting.status === 'active' ? 'Activa' : 'Programada'}
                </span>
              </div>

              <button
                onClick={() => navigate(`/m/${meeting.code}`)}
                className="w-full flex items-center justify-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition font-medium"
              >
                <span>Unirse</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {meetings.length >= 5 && (
        <button
          onClick={() => navigate('/movi-meet')}
          className="w-full mt-4 text-center text-sm text-purple-600 hover:text-purple-700 font-medium py-2 hover:bg-purple-50 rounded-lg transition"
        >
          Ver más reuniones
        </button>
      )}
    </div>
  );
}
