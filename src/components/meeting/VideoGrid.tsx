import { useRef, useEffect } from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, UserCircle } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  role: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface VideoGridProps {
  participants: Participant[];
  localStream: MediaStream | null;
  currentUserId: string;
}

export function VideoGrid({ participants, localStream, currentUserId }: VideoGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
      {participants.map((participant) => (
        <VideoTile
          key={participant.id}
          participant={participant}
          isLocal={participant.id === currentUserId}
          stream={participant.id === currentUserId ? localStream : participant.stream}
        />
      ))}
    </div>
  );
}

interface VideoTileProps {
  participant: Participant;
  isLocal: boolean;
  stream: MediaStream | null | undefined;
}

function VideoTile({ participant, isLocal, stream }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video">
      {participant.videoEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <UserCircle className="w-24 h-24 text-slate-600" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-white font-medium text-sm">
              {participant.name} {isLocal && '(Tú)'}
            </span>
            {participant.role === 'host' && (
              <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-xs font-semibold">
                Anfitrión
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {participant.audioEnabled ? (
              <Mic className="w-4 h-4 text-white" />
            ) : (
              <MicOff className="w-4 h-4 text-red-500" />
            )}
            {!participant.videoEnabled && (
              <VideoOff className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
