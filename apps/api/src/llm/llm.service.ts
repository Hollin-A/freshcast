import { Inject, Injectable, Logger } from "@nestjs/common";
import type { z } from "zod";
import { extractJson } from "./json-output.js";
import { type AdapterResponse, LlmAdapter } from "./llm-adapter.js";
import { LLM_CONFIG, type LlmConfig } from "./llm.config.js";
import type { LlmFailureReason, LlmRequest, LlmResult, LlmUsage } from "./llm.types.js";

class DeadlineExceeded extends Error {
  constructor(ms: number) {
    super(`LLM call passed its ${ms} ms deadline`);
  }
}

/**
 * The port every feature calls Claude through. One call:
 * 1. runs under the deadline (retries included) and aborts the adapter
 *    when it passes;
 * 2. turns the reply into a typed result: the text, or the JSON pulled
 *    from it and checked against `schema`;
 * 3. writes one `llm.call` log line, which the request context tags with
 *    the Business.
 *
 * Expected failures come back as `{ ok: false, reason }` and are never
 * thrown; the feature module decides the fallback.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger("llm");

  constructor(
    private readonly adapter: LlmAdapter,
    @Inject(LLM_CONFIG) private readonly config: LlmConfig
  ) {}

  generate<S extends z.ZodType>(request: LlmRequest<S> & { schema: S }): Promise<LlmResult<z.output<S>>>;
  generate(request: LlmRequest & { schema?: undefined }): Promise<LlmResult<string>>;
  async generate(request: LlmRequest): Promise<LlmResult<unknown>> {
    const started = performance.now();
    let usage: LlmUsage | undefined;
    let result: LlmResult<unknown>;
    let error: unknown;

    try {
      const response = await this.complete(request);
      if (response.kind === "unconfigured") {
        result = fail("unconfigured");
      } else {
        usage = response.usage;
        result = response.kind === "refused" ? fail("refused") : this.read(response.text, request.schema, usage);
      }
    } catch (err) {
      error = err;
      result = fail("upstream");
    }

    this.log(request, result, usage, Math.round(performance.now() - started), error);
    return result;
  }

  /** The adapter's reply, or a throw once the deadline passes. */
  private async complete(request: LlmRequest): Promise<AdapterResponse> {
    const { deadlineMs, model } = this.config;
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        const reason = new DeadlineExceeded(deadlineMs);
        controller.abort(reason);
        reject(reason);
      }, deadlineMs);
    });

    try {
      // Race as well as abort, so an adapter that ignores the signal still
      // can't hold the request past the deadline.
      return await Promise.race([
        this.adapter.complete({
          model,
          system: request.system,
          messages: request.messages,
          maxTokens: request.maxTokens,
          signal: controller.signal,
          timeoutMs: deadlineMs,
        }),
        deadline,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private read(text: string, schema: z.ZodType | undefined, usage: LlmUsage): LlmResult<unknown> {
    if (!text.trim()) return fail("invalid_output");
    if (!schema) return { ok: true, value: text, usage };

    const extracted = extractJson(text);
    if (!extracted) return fail("invalid_output");
    const parsed = schema.safeParse(extracted.json);
    return parsed.success ? { ok: true, value: parsed.data, usage } : fail("invalid_output");
  }

  private log(
    request: LlmRequest,
    result: LlmResult<unknown>,
    usage: LlmUsage | undefined,
    latencyMs: number,
    err: unknown
  ): void {
    // Never the prompt or the reply: both hold the Business's sales.
    const data = {
      feature: request.feature,
      model: this.config.model,
      outcome: result.ok ? "ok" : result.reason,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      latencyMs,
    };
    if (result.ok) this.logger.log({ data }, "llm.call");
    else this.logger.warn(err === undefined ? { data } : { data, err }, "llm.call");
  }
}

function fail(reason: LlmFailureReason): LlmResult<never> {
  return { ok: false, reason };
}
