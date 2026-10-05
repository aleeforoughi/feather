import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { docsSource } from "./plugins/docs-source.ts"

// The docs site consumes the built packages like an outside product: no aliases into packages/*/src. Relative base, so
// the build can be served from any folder. The markdown in docs/ is rendered at build time by docsSource.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), docsSource()],
})
