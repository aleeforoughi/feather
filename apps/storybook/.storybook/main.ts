import type { StorybookConfig } from "@storybook/react-vite"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

/** Absolute path of a package, as Storybook needs it inside a pnpm workspace. */
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}

// The stories live next to their components in packages/react.
const config: StorybookConfig = {
  stories: ["../../../packages/react/src/**/*.mdx", "../../../packages/react/src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-mcp"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
}
export default config
