/** Settings for every LLM call. Tests provide their own under `LLM_CONFIG`. */
export interface LlmConfig {
  /** The Legacy snapshot; the Haiku 5.5 evaluation is #147. */
  model: string;
  /**
   * Wall-clock limit per call, retries included. It leaves time for the
   * feature's fallback before the ALB's 60 s idle timeout.
   */
  deadlineMs: number;
  /** SDK retries (429, 5xx, connection errors) inside the deadline. */
  maxRetries: number;
}

export const LLM_CONFIG = Symbol("LLM_CONFIG");

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  model: "claude-haiku-4-5-20251001",
  deadlineMs: 20_000,
  maxRetries: 2,
};
