import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/msw/server";
import SignupPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("SignupPage", () => {
  it("shows the app's error for a malformed email and does not sign up", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post("/api/auth/signup", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    const email = screen.getByLabelText("Email");
    await user.type(screen.getByLabelText("Name"), "Owner");
    await user.type(email, "owner@");
    await user.type(screen.getByLabelText("Password"), "Str0ng-password!");
    await user.click(screen.getByRole("button", { name: /Sign up/ }));

    expect(await screen.findByText("Please enter a valid email")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Please enter a valid email");
    expect(bodies).toEqual([]);
  });
});
