import { expect } from "storybook/test";
import preview from "#.storybook/preview";
import { MobileNav } from "./mobile-nav";

const meta = preview.meta({
  component: MobileNav,
  parameters: { layout: "fullscreen" },
});

export const Today = meta.story({
  parameters: { nextjs: { navigation: { pathname: "/dashboard" } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
  },
});

export const NestedRoute = meta.story({
  parameters: { nextjs: { navigation: { pathname: "/products/prod_lamb" } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: "Products" })).toHaveAttribute("aria-current", "page");
  },
});
