import Anthropic from "@anthropic-ai/sdk";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { SecretsService } from "../secrets/secrets.service.js";
import { type AdapterRequest, type AdapterResponse, LlmAdapter } from "./llm-adapter.js";
import { LLM_CONFIG, type LlmConfig } from "./llm.config.js";

/**
 * The production LlmAdapter, and the only file that imports
 * `@anthropic-ai/sdk`; features go through LlmService.
 *
 * ANTHROPIC_API_KEY is resolved once, at startup (env first, then Secrets
 * Manager, ADR-018). Without a key the API still starts: one warning is
 * logged and every call returns `unconfigured`. Tests that replace this
 * adapter with FakeLlmAdapter never look the key up.
 */
@Injectable()
export class AnthropicAdapter extends LlmAdapter implements OnModuleInit {
  private readonly logger = new Logger("llm");
  private client: Anthropic | null = null;

  constructor(
    private readonly secrets: SecretsService,
    @Inject(LLM_CONFIG) private readonly config: LlmConfig
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const apiKey = await this.secrets.get("ANTHROPIC_API_KEY", "freshcast/anthropic-api-key");
    if (!apiKey) {
      this.logger.warn("No Anthropic API key resolved; LLM calls will return unconfigured");
      return;
    }
    this.client = new Anthropic({ apiKey, maxRetries: this.config.maxRetries });
  }

  async complete(request: AdapterRequest): Promise<AdapterResponse> {
    if (!this.client) return { kind: "unconfigured" };

    // Errors (APIError, connection errors, the abort) propagate; LlmService
    // reports them as `upstream`. The SDK retries inside the deadline.
    const message = await this.client.messages.create(
      {
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: request.messages,
      },
      { signal: request.signal, timeout: request.timeoutMs }
    );

    const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
    if (message.stop_reason === "refusal") return { kind: "refused", usage };

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    return { kind: "text", text, usage };
  }
}
