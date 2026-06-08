import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, durationSec: number) => void;
  disabled?: boolean;
  isRTL?: boolean;
}

export default function VoiceRecorder({ onRecordingComplete, disabled, isRTL }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Float32Array[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startTimeRef = useRef(0);
  const shouldDiscardRef = useRef(false);

  const MAX_DURATION = 120; // 2 minutes max
  const TARGET_SAMPLE_RATE = 16000;

  const cleanupRecorder = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = undefined;

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
    }

    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
  }, []);

  const encodeWav = useCallback((samples: Float32Array[], inputSampleRate: number, outputSampleRate: number) => {
    const inputLength = samples.reduce((sum, sample) => sum + sample.length, 0);
    const input = new Float32Array(inputLength);
    let writeOffset = 0;
    for (const sample of samples) {
      input.set(sample, writeOffset);
      writeOffset += sample.length;
    }

    const ratio = inputSampleRate / outputSampleRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const start = Math.floor(i * ratio);
      const end = Math.min(Math.floor((i + 1) * ratio), input.length);
      let sum = 0;
      for (let j = start; j < end; j += 1) sum += input[j];
      output[i] = sum / Math.max(end - start, 1);
    }

    const buffer = new ArrayBuffer(44 + output.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + output.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, outputSampleRate, true);
    view.setUint32(28, outputSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, output.length * 2, true);

    let offset = 44;
    for (const sample of output) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }, []);

  const finishRecording = useCallback(async (discard: boolean) => {
    setFinalizing(true);
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const audioContext = audioContextRef.current;
    const recordedChunks = chunks.current;
    await cleanupRecorder();

    if (!discard && audioContext && recordedChunks.length > 0 && duration >= 1) {
      const blob = encodeWav(recordedChunks, audioContext.sampleRate, TARGET_SAMPLE_RATE);
      onRecordingComplete(blob, duration);
    }

    chunks.current = [];
    startTimeRef.current = 0;
    shouldDiscardRef.current = false;
    setFinalizing(false);
    setRecording(false);
    setElapsed(0);
  }, [cleanupRecorder, encodeWav, onRecordingComplete]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current || streamRef.current) {
        chunks.current = [];
        void cleanupRecorder();
      }
    };
  }, [cleanupRecorder]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
        },
      });
      chunks.current = [];
      streamRef.current = stream;

      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error('AudioContext unavailable');
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        if (startTimeRef.current === 0) return;
        chunks.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;

      startTimeRef.current = Date.now();
      setRecording(true);

      timerRef.current = setInterval(() => {
        const sec = Math.round((Date.now() - startTimeRef.current) / 1000);
        setElapsed(sec);
        if (sec >= MAX_DURATION) {
          void finishRecording(false);
        }
      }, 500);
    } catch {
      // Permission denied or no microphone
    }
  }, [finishRecording, recording]);

  const sendRecording = useCallback(() => {
    if (recording) {
      shouldDiscardRef.current = false;
      setFinalizing(true);
      void finishRecording(false);
    }
  }, [finishRecording, recording]);

  const cancelRecording = useCallback(() => {
    if (recording) {
      shouldDiscardRef.current = true;
      setFinalizing(true);
      void finishRecording(true);
    }
  }, [finishRecording, recording]);

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
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl h-[42px] w-[42px] shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={cancelRecording}
          disabled={finalizing}
          title={isRTL ? 'إلغاء التسجيل' : 'Cancel recording'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          className="rounded-xl h-[42px] w-[42px] shrink-0"
          onClick={sendRecording}
          disabled={finalizing}
          title={isRTL ? 'إرسال التسجيل' : 'Send recording'}
        >
          <Send className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
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
