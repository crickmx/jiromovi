import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MessageSquare, Users, PhoneOff, Monitor, X } from 'lucide-react';
import { VideoGrid } from '../components/meeting/VideoGrid';
import { MeetingChat } from '../components/meeting/MeetingChat';
import { ParticipantsList } from '../components/meeting/ParticipantsList';
import type { Database } from '../lib/database.types';

type Meeting = Database['public']['Tables']['meetings']['Row'];

interface Participant {
  id: string;
  name: string;
  role: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export function MeetingRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState<string>('');

  useEffect(() => {
    if (code) {
      loadMeeting();
    }
  }, [code]);

  useEffect(() => {
    if (usuario && meeting) {
      setJoinName(`${usuario.nombre} ${usuario.apellidos}`);
    }
  }, [usuario, meeting]);

  const loadMeeting = async () => {
    if (!code) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        alert('Reunión no encontrada');
        navigate('/movi-meet');
        return;
      }

      setMeeting(data);
      setIsHost(usuario?.id === data.creator_id);

      if (data.status === 'ended' || data.status === 'cancelled') {
        alert('Esta reunión ha finalizado');
        navigate('/movi-meet');
        return;
      }

      if (data.status === 'scheduled') {
        await supabase
          .from('meetings')
          .update({ status: 'active' })
          .eq('id', data.id);
      }
    } catch (error) {
      console.error('Error loading meeting:', error);
      alert('Error al cargar la reunión');
      navigate('/movi-meet');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinName.trim() || !meeting) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setLocalStream(stream);

      const participantRole = isHost ? 'host' : 'participant';

      const { data: participantData, error } = await supabase
        .from('meeting_participants')
        .insert({
          meeting_id: meeting.id,
          user_id: usuario?.id || null,
          name: joinName,
          role: participantRole,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentParticipantId(participantData.id);

      const newParticipant: Participant = {
        id: participantData.id,
        name: joinName,
        role: participantRole,
        stream,
        audioEnabled: true,
        videoEnabled: true,
      };

      setParticipants([newParticipant]);
      setHasJoined(true);

      subscribeToParticipants();
    } catch (error) {
      console.error('Error joining meeting:', error);
      alert('Error al acceder a la cámara/micrófono. Por favor verifica los permisos.');
    }
  };

  const subscribeToParticipants = () => {
    if (!meeting) return;

    const channel = supabase
      .channel(`meeting-participants-${meeting.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_participants',
          filter: `meeting_id=eq.${meeting.id}`,
        },
        async () => {
          const { data } = await supabase
            .from('meeting_participants')
            .select('*')
            .eq('meeting_id', meeting.id)
            .is('left_at', null);

          if (data) {
            setParticipants((current) =>
              data.map((p) => {
                const existing = current.find((c) => c.id === p.id);
                return {
                  id: p.id,
                  name: p.name,
                  role: p.role,
                  stream: existing?.stream,
                  audioEnabled: existing?.audioEnabled ?? true,
                  videoEnabled: existing?.videoEnabled ?? true,
                };
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);

        setParticipants((current) =>
          current.map((p) =>
            p.id === currentParticipantId ? { ...p, audioEnabled: audioTrack.enabled } : p
          )
        );
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);

        setParticipants((current) =>
          current.map((p) =>
            p.id === currentParticipantId ? { ...p, videoEnabled: videoTrack.enabled } : p
          )
        );
      }
    }
  };

  const handleLeaveMeeting = async () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (currentParticipantId) {
      await supabase
        .from('meeting_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('id', currentParticipantId);
    }

    navigate('/movi-meet');
  };

  const handleEndMeeting = async () => {
    if (!meeting || !isHost) return;

    if (!confirm('¿Estás seguro de que deseas finalizar la reunión para todos?')) return;

    try {
      await supabase
        .from('meetings')
        .update({ status: 'ended' })
        .eq('id', meeting.id);

      handleLeaveMeeting();
    } catch (error) {
      console.error('Error ending meeting:', error);
    }
  };

  const handleKickParticipant = async (participantId: string) => {
    if (!isHost) return;

    try {
      await supabase
        .from('meeting_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('id', participantId);
    } catch (error) {
      console.error('Error kicking participant:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-900">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!meeting) {
    return null;
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{meeting.title}</h1>
          <p className="text-slate-600 mb-6">Ingresa tu nombre para unirte</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={!joinName.trim()}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unirse a la reunión
            </button>

            <button
              onClick={() => navigate('/movi-meet')}
              className="w-full text-slate-600 py-3 rounded-lg hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{meeting.title}</h1>
            <p className="text-slate-400 text-sm">Código: {meeting.code}</p>
          </div>
          {isHost && (
            <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
              Anfitrión
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 overflow-y-auto">
          <VideoGrid
            participants={participants}
            localStream={localStream}
            currentUserId={currentParticipantId}
          />
        </div>

        {showChat && (
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
            <button
              onClick={() => setShowChat(false)}
              className="absolute top-2 right-2 p-1 text-slate-600 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <MeetingChat
              meetingId={meeting.id}
              currentUserName={joinName}
              currentUserId={usuario?.id || null}
            />
          </div>
        )}

        {showParticipants && (
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
            <button
              onClick={() => setShowParticipants(false)}
              className="absolute top-2 right-2 p-1 text-slate-600 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <ParticipantsList
              participants={participants}
              isHost={isHost}
              currentUserId={currentParticipantId}
              onKickParticipant={handleKickParticipant}
            />
          </div>
        )}
      </div>

      <div className="bg-slate-800 border-t border-slate-700 px-6 py-4">
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition ${
              audioEnabled
                ? 'bg-slate-700 text-white hover:bg-slate-600'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
            title={audioEnabled ? 'Silenciar' : 'Activar micrófono'}
          >
            {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition ${
              videoEnabled
                ? 'bg-slate-700 text-white hover:bg-slate-600'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
            title={videoEnabled ? 'Desactivar cámara' : 'Activar cámara'}
          >
            {videoEnabled ? <VideoIcon className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-4 rounded-full transition ${
              showChat
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
            title="Chat"
          >
            <MessageSquare className="w-6 h-6" />
          </button>

          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={`p-4 rounded-full transition ${
              showParticipants
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
            title="Participantes"
          >
            <Users className="w-6 h-6" />
          </button>

          <div className="w-px h-12 bg-slate-700" />

          <button
            onClick={handleLeaveMeeting}
            className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
            title="Salir de la reunión"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {isHost && (
            <button
              onClick={handleEndMeeting}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
            >
              Finalizar reunión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
