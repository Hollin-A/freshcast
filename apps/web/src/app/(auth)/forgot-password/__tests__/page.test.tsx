import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ok } from "@/test/msw/envelope";
import { server } from "@/test/msw/server";
import ForgotPasswordPage from "../page";

/** Records the bodies posted to /api/auth/forgot-password. */
function captureRequests() {
  const bodies: unknown[] = [];
  server.use(
    http.post("/api/auth/forgot-password", async ({ request }) => {
      bodies.push(await request.json());
      return ok({ message: "If an account exists, a reset link has been sent." });
    }),
  );
  return bodies;
}

describe("ForgotPasswordPage", () => {
  it("shows a validation error and does not submit an empty email", async () => {
    const bodies = captureRequests();
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Please enter a valid email")).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  // The form opts out of the browser's type="email" check, so zod's message
  // shows instead of the native tooltip.
  it("shows the app's error for a malformed email and does not submit", async () => {
    const bodies = captureRequests();
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    const email = screen.getByLabelText("Email");
    await user.type(email, "owner@");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Please enter a valid email")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Please enter a valid email");
    expect(bodies).toEqual([]);
  });

  it("posts the email and confirms the link was sent", async () => {
    const bodies = captureRequests();
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ email: "owner@example.com" }]);
  });
});
