import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import LoginPage from "../page";

const auth = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock("next-auth/react", () => ({ signIn: auth.signIn }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("LoginPage", () => {
  beforeEach(() => auth.signIn.mockReset());

  it("shows the app's error for a malformed email and does not sign in", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const email = screen.getByLabelText("Email");
    await user.type(email, "owner@");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    const message = await screen.findByText("Please enter a valid email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Please enter a valid email");
    expect(message).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });
});
