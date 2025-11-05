import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MessageSquare, Users, PhoneOff, X } from 'lucide-react';
import { VideoGrid } from '../components/meeting/VideoGrid';
import { MeetingChat } from '../components/meeting/MeetingChat';
import { ParticipantsList } from '../components/meeting/ParticipantsList';

interface AulaSession {
  id: string;
  titulo: string;
  descripcion: string | null;
  room_id: string;
  esta_activa: boolean;
  estado: string;
  instructor_id: string;
}

interface Participant {
  id: string;
  name: string;
  role: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export function AulaVirtualSala() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [session, setSession] = useState<AulaSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isInstructor, setIsInstructor] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState<string>('');

  useEffect(() => {
    if (roomId) {
      loadSession();
    }
  }, [roomId]);

  useEffect(() => {
    if (usuario && session && !hasJoined) {
      const name = usuario.nombre_completo || `${usuario.nombre} ${usuario.apellidos}`;
      setJoinName(name);
      handleAutoJoin(name);
    }
  }, [usuario, session]);

  const handleAutoJoin = async (name: string) => {
    if (!session || hasJoined) return;
    await handleJoinWithName(name);
  };

  const loadSession = async () => {
    if (!roomId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('aula_virtual_sesiones')
        .select('*')
        .eq('room_id', roomId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        alert('Sesión no encontrada');
        navigate('/seguros-education/aula-virtual');
        return;
      }

      setSession(data);
      setIsInstructor(usuario?.id === data.instructor_id);

      if (data.estado === 'finalizada' || data.estado === 'cancelada') {
        alert('Esta sesión ha finalizado');
        navigate('/seguros-education/aula-virtual');
        return;
      }

      if (!data.esta_activa && data.estado === 'programada') {
        if (usuario?.id === data.instructor_id) {
          await supabase
            .from('aula_virtual_sesiones')
            .update({
              esta_activa: true,
              estado: 'en_vivo',
              iniciada_at: new Date().toISOString()
            })
            .eq('id', data.id);

          setSession({ ...data, esta_activa: true, estado: 'en_vivo' });
        } else {
          alert('La sesión aún no ha comenzado. Por favor espera a que el instructor inicie la clase.');
          navigate('/seguros-education/aula-virtual');
          return;
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
      alert('Error al cargar la sesión');
      navigate('/seguros-education/aula-virtual');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinName.trim()) return;
    await handleJoinWithName(joinName);
  };

  const handleJoinWithName = async (name: string) => {
    if (!session || hasJoined) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setLocalStream(stream);

      const participantRole = isInstructor ? 'instructor' : 'participante';

      const { data: participantData, error } = await supabase
        .from('aula_virtual_participantes')
        .insert({
          sesion_id: session.id,
          usuario_id: usuario?.id || null,
          rol_participante: participantRole,
          puede_compartir_pantalla: isInstructor,
          puede_hablar: true,
          puede_video: true,
          estado_conexion: 'conectado',
          ingreso_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentParticipantId(participantData.id);

      const newParticipant: Participant = {
        id: participantData.id,
        name: name,
        role: participantRole,
        stream,
        audioEnabled: true,
        videoEnabled: true,
      };

      setParticipants([newParticipant]);
      setHasJoined(true);

      subscribeToParticipants();
    } catch (error) {
      console.error('Error joining session:', error);
      alert('Error al acceder a la cámara/micrófono. Por favor verifica los permisos.');
    }
  };

  const subscribeToParticipants = () => {
    if (!session) return;

    const channel = supabase
      .channel(`aula-participants-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aula_virtual_participantes',
          filter: `sesion_id=eq.${session.id}`,
        },
        async () => {
          const { data } = await supabase
            .from('aula_virtual_participantes')
            .select('*, usuario:usuarios(nombre_completo)')
            .eq('sesion_id', session.id)
            .eq('estado_conexion', 'conectado');

          if (data) {
            setParticipants((current) =>
              data.map((p) => {
                const existing = current.find((c) => c.id === p.id);
                return {
                  id: p.id,
                  name: p.usuario?.nombre_completo || p.nombre_invitado || 'Participante',
                  role: p.rol_participante,
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

  const handleLeaveSession = async () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (currentParticipantId) {
      await supabase
        .from('aula_virtual_participantes')
        .update({
          estado_conexion: 'desconectado',
          salida_at: new Date().toISOString()
        })
        .eq('id', currentParticipantId);
    }

    navigate('/seguros-education/aula-virtual');
  };

  const handleEndSession = async () => {
    if (!session || !isInstructor) return;

    if (!confirm('¿Estás seguro de que deseas finalizar la sesión para todos?')) return;

    try {
      await supabase
        .from('aula_virtual_sesiones')
        .update({
          esta_activa: false,
          estado: 'finalizada',
          finalizada_at: new Date().toISOString()
        })
        .eq('id', session.id);

      await supabase
        .from('aula_virtual_participantes')
        .update({
          estado_conexion: 'desconectado',
          salida_at: new Date().toISOString()
        })
        .eq('sesion_id', session.id)
        .eq('estado_conexion', 'conectado');

      handleLeaveSession();
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  const handleKickParticipant = async (participantId: string) => {
    if (!isInstructor) return;

    try {
      await supabase
        .from('aula_virtual_participantes')
        .update({
          estado_conexion: 'expulsado',
          salida_at: new Date().toISOString()
        })
        .eq('id', participantId);
    } catch (error) {
      console.error('Error kicking participant:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-900">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{session.titulo}</h1>
          {session.descripcion && (
            <p className="text-slate-600 mb-6">{session.descripcion}</p>
          )}

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
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={!joinName.trim()}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unirse a la sesión
            </button>

            <button
              onClick={() => navigate('/seguros-education/aula-virtual')}
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
            <h1 className="text-xl font-bold text-white">{session.titulo}</h1>
            <p className="text-slate-400 text-sm">Aula Virtual - Seguros Education</p>
          </div>
          {isInstructor && (
            <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
              Instructor
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
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col relative">
            <button
              onClick={() => setShowChat(false)}
              className="absolute top-2 right-2 p-1 text-slate-600 hover:text-slate-800 z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <MeetingChat
              meetingId={session.id}
              currentUserName={joinName}
              currentUserId={usuario?.id || null}
            />
          </div>
        )}

        {showParticipants && (
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col relative">
            <button
              onClick={() => setShowParticipants(false)}
              className="absolute top-2 right-2 p-1 text-slate-600 hover:text-slate-800 z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <ParticipantsList
              participants={participants}
              isHost={isInstructor}
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
                ? 'bg-emerald-600 text-white'
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
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
            title="Participantes"
          >
            <Users className="w-6 h-6" />
          </button>

          <div className="w-px h-12 bg-slate-700" />

          <button
            onClick={handleLeaveSession}
            className="p-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
            title="Salir de la sesión"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {isInstructor && (
            <button
              onClick={handleEndSession}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
            >
              Finalizar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
