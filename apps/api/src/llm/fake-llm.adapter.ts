import { type AdapterRequest, type AdapterResponse, LlmAdapter } from "./llm-adapter.js";
import type { LlmUsage } from "./llm.types.js";

type Step =
  | { kind: "respond"; response: AdapterResponse }
  | { kind: "fail"; error: unknown }
  | { kind: "hang" };

const DEFAULT_USAGE: LlmUsage = { inputTokens: 10, outputTokens: 5 };

/**
 * A scripted LlmAdapter for tests: no network, no key. Queue one step per
 * expected call, then read `calls` to check what the feature sent.
 *
 *   const llm = new FakeLlmAdapter().reply('[{"product":"Eggs","quantity":20}]');
 *   moduleRef.overrideProvider(LlmAdapter).useValue(llm);
 *
 * A call with nothing queued throws, so `LlmService` returns `upstream`
 * and the feature falls back; check `calls` to catch unexpected calls.
 */
export class FakeLlmAdapter extends LlmAdapter {
  readonly calls: Omit<AdapterRequest, "signal">[] = [];
  private readonly steps: Step[] = [];

  /** Claude answers with this text. */
  reply(text: string, usage: LlmUsage = DEFAULT_USAGE): this {
    return this.push({ kind: "respond", response: { kind: "text", text, usage } });
  }

  /** Claude answers with this value as JSON. */
  replyJson(value: unknown, usage?: LlmUsage): this {
    return this.reply(JSON.stringify(value), usage);
  }

  /** Claude declines (`stop_reason: "refusal"`). */
  refuse(usage: LlmUsage = DEFAULT_USAGE): this {
    return this.push({ kind: "respond", response: { kind: "refused", usage } });
  }

  /** No API key, as when none resolves at startup. */
  unconfigured(): this {
    return this.push({ kind: "respond", response: { kind: "unconfigured" } });
  }

  /** The API errors. */
  fail(error: unknown = new Error("fake upstream failure")): this {
    return this.push({ kind: "fail", error });
  }

  /** The API never answers; only the deadline ends the call. */
  hang(): this {
    return this.push({ kind: "hang" });
  }

  async complete({ signal, ...request }: AdapterRequest): Promise<AdapterResponse> {
    this.calls.push(request);
    const step = this.steps.shift();
    if (!step) throw new Error(`FakeLlmAdapter: unexpected call (nothing queued): ${request.system.slice(0, 60)}`);
    if (step.kind === "fail") throw step.error;
    if (step.kind === "hang") {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    return step.response;
  }

  private push(step: Step): this {
    this.steps.push(step);
    return this;
  }
}
