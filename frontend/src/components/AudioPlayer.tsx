import { useState, useRef, useEffect, useMemo } from 'react';
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
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);

  const fallbackWaveform = useMemo(() => {
    let seed = 0;
    for (const char of src) {
      seed = (seed * 31 + char.charCodeAt(0)) % 9973;
    }
    return Array.from({ length: 32 }, (_, index) => {
      const value = Math.abs(Math.sin((seed + index * 17) / 13));
      return 18 + Math.round(value * 70);
    });
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setPlaying(!audio.paused && !audio.ended);
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

    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    let cancelled = false;

    const loadWaveform = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) {
          throw new Error('AudioContext unavailable');
        }

        const audioContext = new AudioContextCtor();
        const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const channelData = decoded.getChannelData(0);
        const samples = 32;
        const blockSize = Math.floor(channelData.length / samples) || 1;
        const bars = Array.from({ length: samples }, (_, index) => {
          let sum = 0;
          const start = index * blockSize;
          const end = Math.min(start + blockSize, channelData.length);
          for (let offset = start; offset < end; offset += 1) {
            sum += Math.abs(channelData[offset]);
          }
          const average = sum / Math.max(end - start, 1);
          return 16 + Math.round(average * 160);
        });

        if (!cancelled) {
          setWaveformBars(bars);
        }
        void audioContext.close();
      } catch {
        if (!cancelled) {
          setWaveformBars(fallbackWaveform);
        }
      }
    };

    void loadWaveform();

    return () => {
      cancelled = true;
    };
  }, [fallbackWaveform, src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
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
  const bars = waveformBars.length ? waveformBars : fallbackWaveform;
  const activeBars = Math.round((progress / 100) * bars.length);
  const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition ${
          isOwn
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-600'
        }`}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ms-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={`flex h-10 items-end gap-[2px] rounded-xl px-2 cursor-pointer ${isOwn ? 'bg-white/10' : 'bg-emerald-50'}`}
          onClick={handleBarClick}
        >
          {bars.map((bar, index) => (
            <div
              key={`${src}-${index}`}
              className={`flex-1 rounded-full transition-colors ${
                index < activeBars
                  ? isOwn
                    ? 'bg-white/85'
                    : 'bg-emerald-500'
                  : isOwn
                    ? 'bg-white/25'
                    : 'bg-emerald-200'
              }`}
              style={{ height: `${Math.max(10, Math.min(bar, 100))}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className={`text-[10px] tabular-nums ${isOwn ? 'text-emerald-200' : 'text-gray-400'}`}>
            {formatTime(currentTime)} / {formatTime(displayDuration)}
          </p>
          <button
            type="button"
            onClick={() => setPlaybackRate(nextRate)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
              isOwn
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            }`}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}
