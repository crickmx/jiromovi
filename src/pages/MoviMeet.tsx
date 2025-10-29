import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Video, Plus, Calendar, Clock, Copy, ExternalLink, Search, Trash2, Zap } from 'lucide-react';
import { createMeeting, formatMeetingDateTime, getMeetingUrl, getStatusBadgeClass, getStatusLabel } from '../lib/meetingUtils';
import type { Database } from '../lib/database.types';

type Meeting = Database['public']['Tables']['meetings']['Row'];

export function MoviMeet() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExpressModal, setShowExpressModal] = useState(false);
  const [title, setTitle] = useState('');
  const [expressTitle, setExpressTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    loadMeetings();
  }, [usuario]);

  const loadMeetings = async () => {
    if (!usuario) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('creator_id', usuario.id)
        .order('scheduled_datetime', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !title || !date || !time) return;

    setCreating(true);
    try {
      const dateTimeString = `${date}T${time}`;
      const scheduledDateTime = new Date(dateTimeString);

      const meeting = await createMeeting(title, scheduledDateTime, usuario.id);

      setMeetings([meeting, ...meetings]);
      setShowCreateModal(false);
      setTitle('');
      setDate('');
      setTime('');
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Error al crear la reunión. Por favor intenta de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = (code: string) => {
    const url = getMeetingUrl(code);
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleJoinMeeting = (code: string) => {
    navigate(`/m/${code}`);
  };

  const handleCreateExpressMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || !expressTitle) return;

    setCreating(true);
    try {
      const meeting = await createMeeting(expressTitle, null, usuario.id);

      setMeetings([meeting, ...meetings]);
      setShowExpressModal(false);
      setExpressTitle('');

      navigate(`/m/${meeting.code}`);
    } catch (error) {
      console.error('Error creating express meeting:', error);
      alert('Error al crear la reunión express. Por favor intenta de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta reunión?')) return;

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMeetings(meetings.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting meeting:', error);
      alert('Error al eliminar la reunión.');
    }
  };

  const filteredMeetings = meetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center space-x-4 mb-6">
          <Video className="w-12 h-12" />
          <div>
            <h1 className="text-3xl font-bold">MOVI Meet</h1>
            <p className="text-purple-100">Sistema de reuniones virtuales integrado</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowExpressModal(true)}
            className="flex items-center space-x-2 bg-yellow-400 text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition shadow-md"
          >
            <Zap className="w-5 h-5" />
            <span>Reunión Express</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-purple-50 transition shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva Reunión</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Mis Reuniones</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar reunión..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {filteredMeetings.length === 0 ? (
          <div className="text-center py-12">
            <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">
              {searchTerm ? 'No se encontraron reuniones' : 'No tienes reuniones creadas'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
              >
                Crear tu primera reunión →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMeetings.map((meeting) => {
              const { date: formattedDate, time: formattedTime } = formatMeetingDateTime(meeting.scheduled_datetime);
              return (
                <div
                  key={meeting.id}
                  className="border border-slate-200 rounded-lg p-5 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-slate-800 mb-2">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-slate-600">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formattedDate}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formattedTime}
                        </span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(meeting.status)}`}>
                      {getStatusLabel(meeting.status)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 mb-3">
                    <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm font-mono text-slate-700">
                      {getMeetingUrl(meeting.code)}
                    </code>
                    <button
                      onClick={() => handleCopyLink(meeting.code)}
                      className="p-2 text-slate-600 hover:text-purple-600 hover:bg-slate-100 rounded transition"
                      title="Copiar enlace"
                    >
                      {copiedCode === meeting.code ? (
                        <span className="text-green-600 text-sm font-medium">✓ Copiado</span>
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleJoinMeeting(meeting.code)}
                      className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Unirse</span>
                    </button>
                    {meeting.status === 'scheduled' && (
                      <button
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        className="flex items-center space-x-2 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-8 flex flex-col max-h-[85vh]">
            <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Nueva Reunión</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form id="create-meeting-form" onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Título de la reunión
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ej: Reunión de equipo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Hora
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              </form>
            </div>
            <div className="flex-shrink-0 border-t border-slate-200 px-6 py-4">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setTitle('');
                    setDate('');
                    setTime('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="create-meeting-form"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creando...' : 'Crear Reunión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExpressModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-8 flex flex-col max-h-[85vh]">
            <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Reunión Express</h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-slate-600 mb-4">
                Crea una reunión instantánea y únete inmediatamente
              </p>
              <form id="express-meeting-form" onSubmit={handleCreateExpressMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nombre de la reunión
                </label>
                <input
                  type="text"
                  value={expressTitle}
                  onChange={(e) => setExpressTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Ej: Reunión rápida de equipo"
                />
              </div>
              </form>
            </div>
            <div className="flex-shrink-0 border-t border-slate-200 px-6 py-4">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpressModal(false);
                    setExpressTitle('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="express-meeting-form"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-yellow-400 text-slate-900 rounded-lg hover:bg-yellow-300 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creando...' : 'Iniciar Ahora'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
