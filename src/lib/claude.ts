import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

const MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
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
  const anthropic = getClient();
  if (!anthropic) {
    logger.debug("claude", "No ANTHROPIC_API_KEY set, skipping LLM call");
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
