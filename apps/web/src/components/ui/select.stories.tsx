import { expect, screen, waitFor } from "storybook/test";
import preview from "#.storybook/preview";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const units = [
  { label: "Portions", value: "portions" },
  { label: "Kilograms", value: "kg" },
  { label: "Loaves", value: "loaves" },
];

const meta = preview.meta({
  component: Select,
  args: { items: units, defaultValue: "portions" },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="Unit" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Units</SelectLabel>
          <SelectItem value="portions">Portions</SelectItem>
          <SelectItem value="kg">Kilograms</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectItem value="loaves">Loaves</SelectItem>
      </SelectContent>
    </Select>
  ),
});

export const Default = meta.story({
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole("combobox", { name: "Unit" });
    await expect(trigger).toHaveTextContent("Portions");

    await userEvent.click(trigger);
    // The popup is portalled into <body>, outside the story canvas. Base UI
    // ignores pointer input for a moment after opening, so retry the click.
    const option = await screen.findByRole("option", { name: "Loaves" });
    await waitFor(() => userEvent.click(option));

    await expect(trigger).toHaveTextContent("Loaves");
  },
});

export const Disabled = meta.story({ args: { disabled: true } });
