import { defineMain } from "@storybook/nextjs-vite/node";

export default defineMain({
  framework: "@storybook/nextjs-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: [
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
    "msw-storybook-addon",
  ],
  // public/ serves the App's static assets; .storybook/public holds the MSW
  // worker, which stays out of the deployed App.
  staticDirs: ["../public", "./public"],
  core: { disableTelemetry: true },
});
