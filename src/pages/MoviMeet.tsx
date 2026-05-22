import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Video, Plus, Calendar, Clock, Copy, ExternalLink, Search, Trash2, Zap } from 'lucide-react';
import { createMeeting, formatMeetingDateTime, getMeetingUrl, getStatusBadgeClass, getStatusLabel } from '../lib/meetingUtils';
import { PageHeader } from '@/components/ui/page-header';
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
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="MOVI Meet"
        description="Sistema de reuniones virtuales integrado"
        icon={Video}
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowExpressModal(true)}
              className="flex items-center space-x-2 bg-amber-400 text-neutral-900 px-4 py-2 rounded-lg font-semibold hover:bg-amber-300 transition"
            >
              <Zap className="w-4 h-4" />
              <span>Reunión Express</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 bg-accent text-white px-4 py-2 rounded-lg font-semibold hover:bg-accent-hover transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Reunión</span>
            </button>
          </div>
        }
      />

      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-accent">Mis Reuniones</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-white/40 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar reunión..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-neutral-300 dark:border-white/10 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
        </div>

        {filteredMeetings.length === 0 ? (
          <div className="text-center py-12">
            <Video className="w-16 h-16 text-neutral-300 dark:text-white/20 mx-auto mb-4" />
            <p className="text-neutral-500 dark:text-white/50 text-lg">
              {searchTerm ? 'No se encontraron reuniones' : 'No tienes reuniones creadas'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-accent hover:text-accent-hover font-medium"
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
                  className="border border-neutral-200/60 dark:border-white/8 rounded-lg p-5 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-neutral-800 dark:text-white mb-2">
                        {meeting.title}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-neutral-600 dark:text-white/60">
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
                    <code className="flex-1 bg-neutral-100 dark:bg-neutral-700/50 px-3 py-2 rounded text-sm font-mono text-neutral-700 dark:text-white/70">
                      {getMeetingUrl(meeting.code)}
                    </code>
                    <button
                      onClick={() => handleCopyLink(meeting.code)}
                      className="p-2 text-neutral-600 dark:text-white/60 hover:text-accent hover:bg-neutral-100 dark:hover:bg-white/5 rounded transition"
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
                      className="flex items-center space-x-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition font-medium"
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
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl max-w-md w-full my-8 flex flex-col max-h-[85vh]">
            <div className="flex-shrink-0 border-b border-neutral-200 dark:border-white/8 px-6 py-4">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Nueva Reunión</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form id="create-meeting-form" onSubmit={handleCreateMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Título de la reunión
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-white/10 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="Ej: Reunión de equipo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-white/10 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Hora
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-white/10 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              </form>
            </div>
            <div className="flex-shrink-0 border-t border-neutral-200 dark:border-white/8 px-6 py-4">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setTitle('');
                    setDate('');
                    setTime('');
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-white/10 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="create-meeting-form"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl max-w-md w-full my-8 flex flex-col max-h-[85vh]">
            <div className="flex-shrink-0 border-b border-neutral-200 dark:border-white/8 px-6 py-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-500/15 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-600" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Reunión Express</h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-neutral-600 dark:text-white/60 mb-4">
                Crea una reunión instantánea y únete inmediatamente
              </p>
              <form id="express-meeting-form" onSubmit={handleCreateExpressMeeting} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Nombre de la reunión
                </label>
                <input
                  type="text"
                  value={expressTitle}
                  onChange={(e) => setExpressTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-white/10 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="Ej: Reunión rápida de equipo"
                />
              </div>
              </form>
            </div>
            <div className="flex-shrink-0 border-t border-neutral-200 dark:border-white/8 px-6 py-4">
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpressModal(false);
                    setExpressTitle('');
                  }}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-white/10 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="express-meeting-form"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-amber-400 text-neutral-900 rounded-lg hover:bg-amber-300 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
