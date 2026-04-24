import { NextResponse } from "next/server";
import * as z from "zod";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { generateText } from "@/lib/claude";
import { buildChatContext } from "@/services/chat-context";
import { CHAT_SYSTEM_PROMPT } from "@/prompts/chat";

const chatSchema = z.object({
  message: z.string().min(1).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(10)
    .optional()
    .default([]),
});

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await request.json();
    const result = chatSchema.safeParse(body);

    if (!result.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", 400);
    }

    const { message, history } = result.data;

    // Rate limit: 20 messages per user per hour
    const { success: rateLimitOk } = rateLimit(`chat:${ctx.businessId}`, 20, 60 * 60 * 1000);
    if (!rateLimitOk) {
      return errorResponse("RATE_LIMITED", "You've sent too many messages. Try again in a few minutes.", 429);
    }

    // Build data context
    const dataContext = await buildChatContext(ctx.businessId, ctx.timezone);

    // Build the full user message with context
    const contextMessage = `Here is the current business data:\n\n${dataContext}\n\nConversation so far:\n${history.map((h) => `${h.role}: ${h.content}`).join("\n")}\n\nUser question: ${message}`;

    const response = await generateText(CHAT_SYSTEM_PROMPT, contextMessage, 512);

    if (!response) {
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "AI chat is temporarily unavailable. Please try again later.",
        503
      );
    }

    logger.info("chat", "Chat response generated", {
      businessId: ctx.businessId,
      messageLength: message.length,
    });

    return NextResponse.json({ response });
  } catch (err) {
    logger.error("chat", "POST /api/chat failed", err);
    return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
