import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  duration?: number;
  isOwn?: boolean;
}

export default function AudioPlayer({ src, duration, isOwn }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !isFinite(audio.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audio.currentTime = pct * audio.duration;
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayDuration = totalDuration || duration || 0;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition ${
          isOwn
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
        }`}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ms-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={`h-1.5 rounded-full cursor-pointer ${isOwn ? 'bg-white/20' : 'bg-gray-200'}`}
          onClick={handleBarClick}
        >
          <div
            className={`h-full rounded-full transition-all ${isOwn ? 'bg-white/70' : 'bg-blue-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={`text-[10px] mt-0.5 tabular-nums ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
          {playing ? formatTime(currentTime) : formatTime(displayDuration)}
        </p>
      </div>
    </div>
  );
}
