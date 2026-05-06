import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type EngagementMetadata = string | Record<string, unknown> | undefined;

export type EngagementTrackInput = {
  eventType: string;
  entityType?: string;
  entityId?: number;
  metadata?: EngagementMetadata;
};

function serializeMetadata(metadata: EngagementMetadata): string | undefined {
  if (!metadata) return undefined;

  if (typeof metadata === "string") {
    return metadata.slice(0, 2000);
  }

  try {
    return JSON.stringify(metadata).slice(0, 2000);
  } catch {
    return undefined;
  }
}

export function useEngagementTracker() {
  const { user } = useAuth();
  const trackMutation = trpc.engagement.track.useMutation();
  const mutateRef = useRef(trackMutation.mutate);

  useEffect(() => {
    mutateRef.current = trackMutation.mutate;
  }, [trackMutation.mutate]);

  const track = useCallback((input: EngagementTrackInput) => {
    if (!user?.id) return;

    mutateRef.current({
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: serializeMetadata(input.metadata),
    });
  }, [user?.id]);

  return { track };
}