import { UserCircle, Mic, MicOff, Video as VideoIcon, VideoOff, Crown, UserX, UserPlus, UserMinus, Monitor } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  role: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isCohost: boolean;
  isScreenSharing: boolean;
}

interface ParticipantsListProps {
  participants: Participant[];
  isHost: boolean;
  currentUserId: string;
  onKickParticipant?: (participantId: string) => void;
  onToggleCohost?: (participantId: string, currentIsCohost: boolean) => void;
}

export function ParticipantsList({
  participants,
  isHost,
  currentUserId,
  onKickParticipant,
  onToggleCohost
}: ParticipantsListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800">
          Participantes ({participants.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <UserCircle className="w-8 h-8 text-slate-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="font-medium text-slate-800 truncate">
                    {participant.name}
                    {participant.id === currentUserId && ' (Tú)'}
                  </p>
                  {participant.role === 'host' && (
                    <Crown className="w-4 h-4 text-purple-600 flex-shrink-0" title="Anfitrión" />
                  )}
                  {participant.isCohost && participant.role !== 'host' && (
                    <Crown className="w-4 h-4 text-accent flex-shrink-0" title="Co-anfitrión" />
                  )}
                  {participant.isScreenSharing && (
                    <Monitor className="w-4 h-4 text-green-600 flex-shrink-0" title="Compartiendo pantalla" />
                  )}
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  {participant.audioEnabled ? (
                    <Mic className="w-3 h-3 text-green-600" />
                  ) : (
                    <MicOff className="w-3 h-3 text-red-500" />
                  )}
                  {participant.videoEnabled ? (
                    <VideoIcon className="w-3 h-3 text-green-600" />
                  ) : (
                    <VideoOff className="w-3 h-3 text-red-500" />
                  )}
                </div>
              </div>
            </div>

            {isHost && participant.id !== currentUserId && participant.role !== 'host' && (
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={() => onToggleCohost?.(participant.id, participant.isCohost)}
                  className={`p-2 rounded-lg transition ${
                    participant.isCohost
                      ? 'text-accent hover:bg-primary-50'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                  title={participant.isCohost ? 'Quitar co-anfitrión' : 'Hacer co-anfitrión'}
                >
                  {participant.isCohost ? (
                    <UserMinus className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => onKickParticipant?.(participant.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Expulsar participante"
                >
                  <UserX className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
