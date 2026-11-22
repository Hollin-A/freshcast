import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FakeLlmAdapter } from "./fake-llm.adapter.js";
import type { AdapterRequest, AdapterResponse } from "./llm-adapter.js";
import { LlmAdapter } from "./llm-adapter.js";
import { DEFAULT_LLM_CONFIG, type LlmConfig } from "./llm.config.js";
import { LlmService } from "./llm.service.js";
import type { LlmRequest } from "./llm.types.js";

const CONFIG: LlmConfig = { ...DEFAULT_LLM_CONFIG, deadlineMs: 50 };

const Items = z.array(z.object({ product: z.string(), quantity: z.number() }));

const BASE: Omit<LlmRequest, "schema"> = {
  feature: "natural_language",
  system: "Extract sales items.",
  messages: [{ role: "user", content: "sold 20 eggs" }],
  maxTokens: 1024,
};

const request = <T extends Partial<LlmRequest> = Record<never, never>>(overrides: T = {} as T) => ({ ...BASE, ...overrides });

describe("LlmService", () => {
  let fake: FakeLlmAdapter;
  let service: LlmService;
  let info: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;

  const logged = () => [...info.mock.calls, ...warn.mock.calls].filter(([, message]) => message === "llm.call");

  beforeEach(() => {
    fake = new FakeLlmAdapter();
    service = new LlmService(fake, CONFIG);
    info = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("with a schema", () => {
    it("returns the validated JSON and the token usage", async () => {
      fake.replyJson([{ product: "Eggs", quantity: 20 }], { inputTokens: 120, outputTokens: 30 });

      const result = await service.generate(request({ schema: Items }));

      expect(result).toEqual({
        ok: true,
        value: [{ product: "Eggs", quantity: 20 }],
        usage: { inputTokens: 120, outputTokens: 30 },
      });
    });

    it("sends the configured model with the feature's prompt", async () => {
      fake.replyJson([]);

      await service.generate(request({ schema: Items, maxTokens: 256 }));

      expect(fake.calls).toEqual([
        {
          model: "claude-haiku-4-5-20251001",
          system: "Extract sales items.",
          messages: [{ role: "user", content: "sold 20 eggs" }],
          maxTokens: 256,
          timeoutMs: expect.any(Number),
        },
      ]);
    });

    it("reads JSON from a code fence", async () => {
      fake.reply('Here you go:\n```json\n[{"product":"Eggs","quantity":20}]\n```');

      const result = await service.generate(request({ schema: Items }));

      expect(result).toMatchObject({ ok: true, value: [{ product: "Eggs", quantity: 20 }] });
    });

    it("returns the schema's output, so a feature's transforms apply", async () => {
      fake.replyJson({ count: "3" });

      const result = await service.generate(request({ schema: z.object({ count: z.coerce.number() }) }));

      expect(result).toMatchObject({ ok: true, value: { count: 3 } });
    });

    it.each([
      ["a reply that isn't JSON", "Sorry, I can't read that."],
      ["JSON that breaks the schema", '[{"product":"Eggs","quantity":"twenty"}]'],
      ["an empty reply", ""],
    ])("returns invalid_output for %s", async (_name, text) => {
      fake.reply(text);

      await expect(service.generate(request({ schema: Items }))).resolves.toEqual({ ok: false, reason: "invalid_output" });
    });
  });

  describe("without a schema", () => {
    it("returns the reply text", async () => {
      fake.reply("Friday is your strongest day.");

      const result = await service.generate(request({ feature: "chat" }));

      expect(result).toMatchObject({ ok: true, value: "Friday is your strongest day." });
    });

    it("returns invalid_output for an empty reply", async () => {
      fake.reply("");

      await expect(service.generate(request({ feature: "chat" }))).resolves.toEqual({ ok: false, reason: "invalid_output" });
    });
  });

  it("returns unconfigured without an API key", async () => {
    fake.unconfigured();

    await expect(service.generate(request({ schema: Items }))).resolves.toEqual({ ok: false, reason: "unconfigured" });
  });

  it("returns refused when Claude declines", async () => {
    fake.refuse();

    await expect(service.generate(request({ schema: Items }))).resolves.toEqual({ ok: false, reason: "refused" });
  });

  it("returns upstream when the API fails, without throwing", async () => {
    fake.fail(new Error("529 overloaded"));

    await expect(service.generate(request({ schema: Items }))).resolves.toEqual({ ok: false, reason: "upstream" });
  });

  describe("deadline", () => {
    it("aborts a call that hangs and returns upstream within the deadline", async () => {
      fake.hang();
      const started = performance.now();

      const result = await service.generate(request({ schema: Items }));

      expect(result).toEqual({ ok: false, reason: "upstream" });
      expect(performance.now() - started).toBeLessThan(CONFIG.deadlineMs + 100);
    });

    it("returns upstream even when the adapter ignores the abort signal", async () => {
      let signal: AbortSignal | undefined;
      class DeafAdapter extends LlmAdapter {
        complete(req: AdapterRequest): Promise<AdapterResponse> {
          signal = req.signal;
          return new Promise(() => undefined);
        }
      }
      service = new LlmService(new DeafAdapter(), CONFIG);

      await expect(service.generate(request())).resolves.toEqual({ ok: false, reason: "upstream" });
      expect(signal?.aborted).toBe(true);
    });

    it("gives the adapter the deadline as its request timeout", async () => {
      fake.reply("ok");

      await service.generate(request());

      expect(fake.calls[0].timeoutMs).toBe(CONFIG.deadlineMs);
    });
  });

  describe("llm.call log line", () => {
    it("logs one line per call with feature, model, tokens, outcome and latency", async () => {
      fake.replyJson([], { inputTokens: 120, outputTokens: 30 });

      await service.generate(request({ schema: Items }));

      expect(logged()).toEqual([
        [
          {
            data: {
              feature: "natural_language",
              model: "claude-haiku-4-5-20251001",
              outcome: "ok",
              inputTokens: 120,
              outputTokens: 30,
              latencyMs: expect.any(Number),
            },
          },
          "llm.call",
        ],
      ]);
      expect(info).toHaveBeenCalledTimes(1);
    });

    it("logs failures at warn, with the tokens spent when there was a reply", async () => {
      fake.reply("not json", { inputTokens: 80, outputTokens: 12 });

      await service.generate(request({ feature: "insights", schema: Items }));

      expect(warn).toHaveBeenCalledWith(
        { data: expect.objectContaining({ feature: "insights", outcome: "invalid_output", inputTokens: 80, outputTokens: 12 }) },
        "llm.call"
      );
      expect(logged()).toHaveLength(1);
    });

    it("logs null tokens when no reply came back", async () => {
      fake.fail();

      await service.generate(request({ feature: "receipt_photo" }));

      expect(warn).toHaveBeenCalledWith(
        {
          data: expect.objectContaining({ feature: "receipt_photo", outcome: "upstream", inputTokens: null, outputTokens: null }),
          err: expect.any(Error),
        },
        "llm.call"
      );
    });

    it("never logs the prompt or the reply", async () => {
      fake.reply("sold 20 eggs to Alice");

      await service.generate(request({ feature: "chat", system: "SECRET-PROMPT" }));

      expect(JSON.stringify(logged())).not.toMatch(/SECRET-PROMPT|Alice|sold 20 eggs/);
    });
  });
});
