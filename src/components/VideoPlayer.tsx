import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  onProgressUpdate: (progress: number, currentTime: number) => void;
  initialTime?: number;
  onComplete?: () => void;
}

export function VideoPlayer({
  videoUrl,
  onProgressUpdate,
  initialTime = 0,
  onComplete
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isGoogleDriveUrl = videoUrl.includes('drive.google.com');

  const getEmbedUrl = (url: string): string => {
    if (!url.includes('drive.google.com')) return url;

    // Extract file ID from various Google Drive URL formats
    let fileId: string | null = null;

    // Format: https://drive.google.com/uc?export=download&id=FILE_ID
    const ucMatch = url.match(/[?&]id=([^&]+)/);
    if (ucMatch) {
      fileId = ucMatch[1];
    }

    // Format: https://drive.google.com/file/d/FILE_ID/...
    const fileMatch = url.match(/\/file\/d\/([^\/]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    }

    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }

    return url;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (initialTime > 0) {
        video.currentTime = initialTime;
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (onComplete) {
        onComplete();
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [initialTime, onComplete]);

  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = setInterval(() => {
        const video = videoRef.current;
        if (video && duration > 0) {
          const progress = (video.currentTime / duration) * 100;
          onProgressUpdate(progress, video.currentTime);
        }
      }, 5000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, duration, onProgressUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isGoogleDriveUrl) {
    const embedUrl = getEmbedUrl(videoUrl);

    return (
      <div
        ref={containerRef}
        className="relative bg-black w-full h-full overflow-hidden"
      >
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title="Video Player"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-black w-full h-full overflow-hidden group flex items-center justify-center"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        controls
        controlsList="nodownload"
        preload="metadata"
        playsInline
      />

    </div>
  );
}
