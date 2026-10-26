import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import ForgotPasswordPage from "../page";

function mockFetch() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
}

describe("ForgotPasswordPage", () => {
  // A malformed address is stopped by the browser's own type="email" check
  // before zod runs, so the empty field is what reaches the schema.
  it("shows a validation error and does not submit an empty email", async () => {
    const fetchMock = mockFetch();
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Please enter a valid email")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the email and confirms the link was sent", async () => {
    const fetchMock = mockFetch();
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "owner@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "owner@example.com" }),
      }),
    );
  });
});
