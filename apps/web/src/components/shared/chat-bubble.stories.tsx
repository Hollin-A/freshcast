import { http } from "msw";
import { expect } from "storybook/test";
import preview from "#.storybook/preview";
import { fail } from "@/test/msw/envelope";
import { ChatBubble } from "./chat-bubble";

const meta = preview.meta({
  component: ChatBubble,
  parameters: { layout: "fullscreen" },
  args: { businessName: "Corner Bakery" },
});

export const Closed = meta.story();

export const Conversation = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Ask Freshcast" }));
    await userEvent.click(canvas.getByRole("button", { name: "What sold best this week?" }));

    await expect(await canvas.findByText("Lamb chops is selling best this week.")).toBeVisible();
  },
});

export const Unavailable = meta.story({
  beforeEach({ msw }) {
    msw.use(http.post("/api/chat", () => fail(503, "SERVICE_UNAVAILABLE", "Chat is unavailable")));
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Ask Freshcast" }));
    await userEvent.click(canvas.getByRole("button", { name: "Slowest day?" }));

    await expect(
      await canvas.findByText("I'm temporarily unavailable. Please try again in a moment."),
    ).toBeVisible();
  },
});
