import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";
import { getSecret } from "./secrets";

const MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
let initialized = false;

async function getClient(): Promise<Anthropic | null> {
  if (initialized) return client;
  initialized = true;

  const apiKey = await getSecret("ANTHROPIC_API_KEY", "freshcast/anthropic-api-key");
  if (!apiKey) return null;

  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Generate text using Claude. Returns null if the API key is missing or the call fails.
 */
export async function generateText(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024
): Promise<string | null> {
  const anthropic = await getClient();
  if (!anthropic) {
    logger.debug("claude", "No Anthropic API key resolved, skipping LLM call");
    return null;
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    logger.debug("claude", "LLM response received", {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    return text;
  } catch (err) {
    logger.error("claude", "Claude API call failed", err);
    return null;
  }
}

/**
 * Generate structured JSON from Claude. Parses the response and returns null on failure.
 */
export async function generateJSON<T>(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024
): Promise<T | null> {
  const text = await generateText(systemPrompt, userMessage, maxTokens);
  if (!text) return null;

  try {
    // Extract JSON from the response (Claude sometimes wraps in markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonStr = jsonMatch[1]?.trim() || text.trim();
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    logger.error("claude", "Failed to parse LLM JSON response", { text, err });
    return null;
  }
}
