export class TimedServiceRepairRetryError extends Error {
  readonly attempts: number;
  readonly originalError: unknown;

  constructor(attempts: number, originalError: unknown) {
    const message = originalError instanceof Error ? originalError.message : String(originalError);
    super(`Timed-service repair failed after ${attempts} attempt(s): ${message}`);
    this.name = "TimedServiceRepairRetryError";
    this.attempts = attempts;
    this.originalError = originalError;
  }
}

type RetryOptions = {
  maxAttempts?: number;
  delayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  wait?: (delayMs: number) => Promise<void>;
};

const defaultWait = (delayMs: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, delayMs);
});

export async function runTimedServiceRepairWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<{ value: T; attempts: number }> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const delayMs = Math.max(0, Math.floor(options.delayMs ?? 100));
  const shouldRetry = options.shouldRetry ?? (() => true);
  const wait = options.wait ?? defaultWait;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { value: await operation(), attempts: attempt };
    } catch (error) {
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw new TimedServiceRepairRetryError(attempt, error);
      }
      await wait(delayMs * attempt);
    }
  }

  throw new TimedServiceRepairRetryError(maxAttempts, new Error("Unexpected retry state"));
}
