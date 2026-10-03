import type { StorybookConfig } from "@storybook/react-vite"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** Absolute path of a package, as Storybook needs it inside a pnpm workspace. */
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}

// JetBrains Mono for Storybook's own chrome (the manager), served from the tokens package's Fontsource dependency.
const fontFiles = join(dirname(createRequire(join(getAbsolutePath("@aleeforoughi/feather-tokens"), "package.json")).resolve("@fontsource-variable/jetbrains-mono/index.css")), "files")

// The stories live next to their components in packages/react, and next to the renderers in packages/manifest-web.
const config: StorybookConfig = {
  stories: ["../../../packages/react/src/**/*.mdx", "../../../packages/react/src/**/*.stories.@(js|jsx|mjs|ts|tsx)", "../../../packages/manifest-web/src/**/*.stories.@(ts|tsx)", "../../../packages/manifest-switch/src/**/*.stories.@(ts|tsx)"],
  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-mcp"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
  staticDirs: [{ from: fontFiles, to: "/fonts/jetbrains-mono" }],
  managerHead: (head) => `${head}
<style>
  @font-face {
    font-family: "JetBrains Mono Variable";
    font-style: normal;
    font-display: swap;
    font-weight: 100 800;
    src: url(./fonts/jetbrains-mono/jetbrains-mono-latin-wght-normal.woff2) format("woff2-variations");
  }
</style>`,
}
export default config
