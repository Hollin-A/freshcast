import { expect } from "storybook/test";
import preview from "#.storybook/preview";
import { Input } from "./input";

const meta = preview.meta({
  component: Input,
  args: { "aria-label": "Business name", placeholder: "Corner Bakery" },
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
    const input = canvas.getByRole("textbox", { name: "Business name" });
    await userEvent.type(input, "Sunrise Café");
    await expect(input).toHaveValue("Sunrise Café");
  },
});

export const Invalid = meta.story({ args: { "aria-invalid": true, defaultValue: "x" } });

export const Disabled = meta.story({ args: { disabled: true, defaultValue: "Corner Bakery" } });
