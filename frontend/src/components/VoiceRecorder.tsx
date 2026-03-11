import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, durationSec: number) => void;
  disabled?: boolean;
  isRTL?: boolean;
}

export default function VoiceRecorder({ onRecordingComplete, disabled, isRTL }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startTimeRef = useRef(0);

  const MAX_DURATION = 120; // 2 minutes max

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorder.current?.state === 'recording') {
        mediaRecorder.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (chunks.current.length > 0 && duration >= 1) {
          const blob = new Blob(chunks.current, { type: mimeType });
          onRecordingComplete(blob, duration);
        }
        setRecording(false);
        setElapsed(0);
      };

      recorder.start(250); // collect chunks every 250ms
      startTimeRef.current = Date.now();
      setRecording(true);

      timerRef.current = setInterval(() => {
        const sec = Math.round((Date.now() - startTimeRef.current) / 1000);
        setElapsed(sec);
        if (sec >= MAX_DURATION) {
          recorder.stop();
        }
      }, 500);
    } catch {
      // Permission denied or no microphone
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const remaining = MAX_DURATION - elapsed;
  const pct = (elapsed / MAX_DURATION) * 100;
  const isNearEnd = remaining <= 15;

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <div className={`flex flex-col gap-1 border rounded-xl px-3 py-1.5 text-sm min-w-[120px] ${
          isNearEnd ? 'bg-red-100 border-red-300' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className={`font-mono tabular-nums ${isNearEnd ? 'text-red-700 font-semibold' : 'text-red-600'}`}>
              {formatTime(elapsed)}
            </span>
            <span className="text-gray-400 text-xs">/ {formatTime(MAX_DURATION)}</span>
          </div>
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isNearEnd ? 'bg-red-500' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <Button
          variant="destructive"
          size="icon"
          className="rounded-xl h-[42px] w-[42px] shrink-0"
          onClick={stopRecording}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-xl h-[42px] w-[42px] shrink-0"
      onClick={startRecording}
      disabled={disabled}
      title={isRTL ? 'تسجيل صوتي' : 'Voice note'}
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}
