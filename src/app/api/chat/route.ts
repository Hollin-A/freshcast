import { NextResponse } from "next/server";
import * as z from "zod";
import { errorResponse, getBusinessContext } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { generateText } from "@/lib/claude";
import { buildChatContext } from "@/services/chat-context";

const SYSTEM_PROMPT = `You are Freshcast AI, a helpful business assistant for a small retail business owner. You answer questions about their sales data, trends, and predictions.

Rules:
- Only answer based on the data provided in the context. Never make up numbers or assume data you don't have.
- Keep answers concise and actionable — 2-3 sentences max unless the user asks for detail.
- Use specific numbers from the data when relevant.
- If the data doesn't contain enough information to answer, say so honestly.
- Be warm and supportive — these are small business owners who are busy.
- When giving predictions or suggestions, frame them as guidance, not certainty ("Based on your data, you might want to..." not "You will sell...").
- Format numbers nicely (round to whole numbers for quantities).`;

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

    // Build data context
    const dataContext = await buildChatContext(ctx.businessId, ctx.timezone);

    // Build the full user message with context
    const contextMessage = `Here is the current business data:\n\n${dataContext}\n\nConversation so far:\n${history.map((h) => `${h.role}: ${h.content}`).join("\n")}\n\nUser question: ${message}`;

    const response = await generateText(SYSTEM_PROMPT, contextMessage, 512);

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
