import type { LlmMessage, LlmUsage } from "./llm.types.js";

export interface AdapterRequest {
  model: string;
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  /** Aborted when the call's deadline passes. */
  signal: AbortSignal;
  /**
   * The whole deadline, as the SDK's per-attempt timeout. The SDK applies
   * it to each attempt; LlmService's abort ends the call overall.
   */
  timeoutMs: number;
}

export type AdapterResponse =
  | { kind: "text"; text: string; usage: LlmUsage }
  | { kind: "refused"; usage: LlmUsage }
  | { kind: "unconfigured" };

/**
 * The provider behind `LlmService`: `AnthropicAdapter` in the app,
 * `FakeLlmAdapter` in tests. It sends one request and reports the raw
 * reply; `LlmService` owns the deadline, JSON checks and logging.
 * Upstream failures are thrown, and `LlmService` turns them into
 * `upstream`.
 *
 * An abstract class so it is also the injection token.
 */
export abstract class LlmAdapter {
  abstract complete(request: AdapterRequest): Promise<AdapterResponse>;
}
