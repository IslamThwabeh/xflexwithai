import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  EPISODE_PROGRESS_WATCH_SYNC_MIN_ADVANCE_SECONDS,
  shouldSkipEpisodeProgressWatchUpdate,
} from "../backend/db";

const backendSource = readFileSync(
  fileURLToPath(new URL("../backend/db.ts", import.meta.url)),
  "utf8",
);

const courseWatchSource = readFileSync(
  fileURLToPath(new URL("../frontend/src/pages/CourseWatch.tsx", import.meta.url)),
  "utf8",
);

describe("episode progress write throttling", () => {
  it("keeps completion transitions immediate", () => {
    expect(shouldSkipEpisodeProgressWatchUpdate(
      { watchedDuration: 12, isCompleted: false },
      { watchedDuration: 30, isCompleted: true },
    )).toBe(false);
  });

  it("allows the first non-zero watch progress update", () => {
    expect(shouldSkipEpisodeProgressWatchUpdate(
      { watchedDuration: 0, isCompleted: false },
      { watchedDuration: 5, isCompleted: false },
    )).toBe(false);
  });

  it("skips tiny non-completion watch-duration advances", () => {
    expect(shouldSkipEpisodeProgressWatchUpdate(
      { watchedDuration: 30, isCompleted: false },
      { watchedDuration: 30 + EPISODE_PROGRESS_WATCH_SYNC_MIN_ADVANCE_SECONDS - 1, isCompleted: false },
    )).toBe(true);
  });

  it("allows non-completion updates after the sync window", () => {
    expect(shouldSkipEpisodeProgressWatchUpdate(
      { watchedDuration: 30, isCompleted: false },
      { watchedDuration: 30 + EPISODE_PROGRESS_WATCH_SYNC_MIN_ADVANCE_SECONDS, isCompleted: false },
    )).toBe(false);
  });

  it("does not rewrite completed episodes during replay progress pings", () => {
    expect(shouldSkipEpisodeProgressWatchUpdate(
      { watchedDuration: 30, isCompleted: true },
      { watchedDuration: 45, isCompleted: false },
    )).toBe(true);
  });

  it("wires the guard into the write path and keeps the frontend cadence aligned", () => {
    const progressSection = backendSource.slice(
      backendSource.indexOf("export async function createOrUpdateEpisodeProgress"),
      backendSource.indexOf("// ============================================================================\n// Admin Quiz Management"),
    );

    expect(progressSection).toContain("shouldSkipEpisodeProgressWatchUpdate(existing, progress)");
    expect(courseWatchSource).toContain("const EPISODE_PROGRESS_SYNC_INTERVAL_SECONDS = 15");
    expect(courseWatchSource).toContain(
      "second - lastSyncedSecondRef.current < EPISODE_PROGRESS_SYNC_INTERVAL_SECONDS",
    );
    expect(courseWatchSource).not.toContain("second - lastSyncedSecondRef.current < 5");
  });
});
