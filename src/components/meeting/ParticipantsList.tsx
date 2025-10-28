import { UserCircle, Mic, MicOff, Video as VideoIcon, VideoOff, Crown, UserX } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  role: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface ParticipantsListProps {
  participants: Participant[];
  isHost: boolean;
  currentUserId: string;
  onKickParticipant?: (participantId: string) => void;
}

export function ParticipantsList({ participants, isHost, currentUserId, onKickParticipant }: ParticipantsListProps) {
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
                    <Crown className="w-4 h-4 text-purple-600 flex-shrink-0" />
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

            {isHost && participant.id !== currentUserId && (
              <button
                onClick={() => onKickParticipant?.(participant.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                title="Expulsar participante"
              >
                <UserX className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
