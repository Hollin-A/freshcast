import preview from "#.storybook/preview";
import { FCLogo } from "./fc-logo";

const meta = preview.meta({
  component: FCLogo,
});

export const Default = meta.story();

export const Large = meta.story({ args: { size: 32 } });
