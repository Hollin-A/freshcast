import preview from "#.storybook/preview";
import { SectionLabel } from "./section-label";

const meta = preview.meta({
  component: SectionLabel,
  args: { children: "Tomorrow's prep" },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
});

export const Default = meta.story();

export const WithTrailing = meta.story({ args: { trailing: "See all" } });
