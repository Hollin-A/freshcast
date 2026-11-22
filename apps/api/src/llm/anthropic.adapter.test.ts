import Anthropic from "@anthropic-ai/sdk";
import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SecretsService } from "../secrets/secrets.service.js";
import { AnthropicAdapter } from "./anthropic.adapter.js";
import type { AdapterRequest } from "./llm-adapter.js";
import { DEFAULT_LLM_CONFIG } from "./llm.config.js";

// The real SDK client with `messages.create` stubbed: checks what the
// adapter sends and how it reads the reply, without the network.

const request = (signal = new AbortController().signal): AdapterRequest => ({
  model: "claude-haiku-4-5-20251001",
  system: "Extract sales items.",
  messages: [{ role: "user", content: "sold 20 eggs" }],
  maxTokens: 512,
  signal,
  timeoutMs: 20_000,
});

function message(overrides: Partial<Anthropic.Message>): Anthropic.Message {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    content: [],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 120, output_tokens: 30 } as Anthropic.Usage,
    ...overrides,
  } as Anthropic.Message;
}

async function adapterWithKey(apiKey: string | null): Promise<AnthropicAdapter> {
  const secrets = { get: vi.fn(async () => apiKey) } as unknown as SecretsService;
  const adapter = new AnthropicAdapter(secrets, DEFAULT_LLM_CONFIG);
  await adapter.onModuleInit();
  return adapter;
}

describe("AnthropicAdapter", () => {
  let create: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    create = vi.spyOn(Anthropic.Messages.prototype, "create");
    warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("without an API key", () => {
    it("returns unconfigured without calling the API, and warns once at startup", async () => {
      const adapter = await adapterWithKey(null);

      await expect(adapter.complete(request())).resolves.toEqual({ kind: "unconfigured" });
      await expect(adapter.complete(request())).resolves.toEqual({ kind: "unconfigured" });
      expect(create).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
    });
  });

  describe("with an API key", () => {
    it("resolves the key once, from ANTHROPIC_API_KEY or Secrets Manager", async () => {
      const get = vi.fn(async () => "sk-test");
      const adapter = new AnthropicAdapter({ get } as unknown as SecretsService, DEFAULT_LLM_CONFIG);
      await adapter.onModuleInit();
      create.mockResolvedValue(message({ content: [{ type: "text", text: "ok", citations: null }] }));

      await adapter.complete(request());
      await adapter.complete(request());

      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith("ANTHROPIC_API_KEY", "freshcast/anthropic-api-key");
    });

    it("sends the request with the deadline's signal and timeout", async () => {
      const adapter = await adapterWithKey("sk-test");
      const { signal } = new AbortController();
      create.mockResolvedValue(message({ content: [{ type: "text", text: "ok", citations: null }] }));

      await adapter.complete(request(signal));

      expect(create).toHaveBeenCalledWith(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system: "Extract sales items.",
          messages: [{ role: "user", content: "sold 20 eggs" }],
        },
        { signal, timeout: 20_000 }
      );
    });

    it("joins the text blocks and reports the token usage", async () => {
      const adapter = await adapterWithKey("sk-test");
      create.mockResolvedValue(
        message({
          content: [
            { type: "text", text: '[{"product":', citations: null },
            { type: "text", text: '"Eggs"}]', citations: null },
          ],
        })
      );

      await expect(adapter.complete(request())).resolves.toEqual({
        kind: "text",
        text: '[{"product":"Eggs"}]',
        usage: { inputTokens: 120, outputTokens: 30 },
      });
    });

    it("reports a refusal, with the tokens it cost", async () => {
      const adapter = await adapterWithKey("sk-test");
      create.mockResolvedValue(message({ stop_reason: "refusal" }));

      await expect(adapter.complete(request())).resolves.toEqual({
        kind: "refused",
        usage: { inputTokens: 120, outputTokens: 30 },
      });
    });

    it("lets API errors through for LlmService to report as upstream", async () => {
      const adapter = await adapterWithKey("sk-test");
      const error = new Anthropic.InternalServerError(529, undefined, "Overloaded", new Headers());
      create.mockRejectedValue(error);

      await expect(adapter.complete(request())).rejects.toBe(error);
    });
  });
});
