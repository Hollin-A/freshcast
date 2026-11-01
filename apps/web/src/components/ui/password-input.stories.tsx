import { expect } from "storybook/test";
import preview from "#.storybook/preview";
import { PasswordInput } from "./password-input";

const meta = preview.meta({
  component: PasswordInput,
  args: { "aria-label": "Password", defaultValue: "hunter22" },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
});

export const Default = meta.story({
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByLabelText("Password");
    await expect(input).toHaveAttribute("type", "password");

    await userEvent.click(canvas.getByRole("button", { name: "Show password" }));
    await expect(input).toHaveAttribute("type", "text");

    await userEvent.click(canvas.getByRole("button", { name: "Hide password" }));
    await expect(input).toHaveAttribute("type", "password");
  },
});
