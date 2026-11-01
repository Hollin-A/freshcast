import preview from "#.storybook/preview";
import { BigNumber } from "./big-number";

const meta = preview.meta({
  component: BigNumber,
  args: { value: 42, unit: "portions" },
});

export const Default = meta.story();

export const TrendUp = meta.story({ args: { trend: "+12%" } });

export const TrendDown = meta.story({ args: { trend: "-8%" } });
