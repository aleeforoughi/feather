// Storybook's own chrome and docs pages in Feather's default theme: black and white, JetBrains Mono throughout.
import { create } from "storybook/theming"

const MONO = '"JetBrains Mono Variable", ui-monospace, monospace'

export const featherTheme = create({
  base: "light",
  brandTitle: "Feather",
  fontBase: MONO,
  fontCode: MONO,
  colorPrimary: "#18181B",
  colorSecondary: "#18181B",
  appBg: "#F7F7F5",
  appContentBg: "#FFFFFF",
  textColor: "#18181B",
})
