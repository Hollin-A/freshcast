import type { z } from "zod";

/** The features that call Claude. Each owns its prompt, schema and fallback. */
export type LlmFeature = "natural_language" | "receipt_photo" | "insights" | "chat";

/** Text-only turns (#63 adds image blocks if its ADR picks vision). */
export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest<S extends z.ZodType = z.ZodType> {
  feature: LlmFeature;
  system: string;
  messages: LlmMessage[];
  /**
   * The JSON the reply must hold, checked after code-fence extraction. Leave
   * it out to get the reply text as-is (Chat).
   */
  schema?: S;
  maxTokens: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Why a call gave no usable value. Expected failures are returned, never
 * thrown, so each feature decides its own fallback.
 * - `unconfigured`: no API key was resolved at startup.
 * - `upstream`: the API failed, or the call ran past the deadline.
 * - `invalid_output`: the reply was empty, wasn't JSON, or broke the schema.
 * - `refused`: Claude declined (`stop_reason: "refusal"`).
 */
export type LlmFailureReason = "unconfigured" | "upstream" | "invalid_output" | "refused";

export type LlmResult<T> =
  | { ok: true; value: T; usage: LlmUsage }
  | { ok: false; reason: LlmFailureReason };
