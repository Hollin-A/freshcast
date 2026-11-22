import { Module } from "@nestjs/common";
import { SecretsModule } from "../secrets/secrets.module.js";
import { AnthropicAdapter } from "./anthropic.adapter.js";
import { LlmAdapter } from "./llm-adapter.js";
import { DEFAULT_LLM_CONFIG, LLM_CONFIG } from "./llm.config.js";
import { LlmService } from "./llm.service.js";

/**
 * Claude for feature modules: import it and inject `LlmService`. Tests
 * replace the adapter with a scripted fake, so nothing touches the network:
 * `overrideProvider(LlmAdapter).useValue(new FakeLlmAdapter())`, or
 * `createE2eApp({ llm })` in e2e tests.
 */
@Module({
  imports: [SecretsModule],
  providers: [
    { provide: LLM_CONFIG, useValue: DEFAULT_LLM_CONFIG },
    { provide: LlmAdapter, useClass: AnthropicAdapter },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
