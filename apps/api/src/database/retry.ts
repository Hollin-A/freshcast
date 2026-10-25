import { setTimeout as sleep } from "node:timers/promises";

export interface RetryOptions {
  attempts: number;
  /** Delay before the second attempt; it doubles after each failure. */
  initialDelayMs: number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Runs `fn` until it succeeds or `attempts` runs out, waiting with
 * exponential backoff in between. Rethrows the last error.
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let delayMs = options.initialDelayMs;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= options.attempts) throw error;
      options.onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
}
