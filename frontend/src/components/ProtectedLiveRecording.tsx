import { trpc } from '@/lib/trpc';

type Props = {
  recordingId: number;
  className?: string;
  preload?: 'none' | 'metadata';
};

export default function ProtectedLiveRecording({ recordingId, className, preload = 'metadata' }: Props) {
  const playback = trpc.livePackage.recordingPlayback.useQuery(
    { recordingId },
    { staleTime: 3 * 60 * 60 * 1000, retry: 1 },
  );

  if (!playback.data) {
    return <div className={`${className ?? ''} flex min-h-48 items-center justify-center bg-black text-sm text-white/70`}>Loading video…</div>;
  }

  return (
    <video
      className={className}
      controls
      controlsList="nodownload"
      preload={preload}
      src={playback.data.streamPath}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
