import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The playground consumes the built packages like an outside product: no aliases into packages/*/src. Relative base,
// so the build can be served from any folder.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
})
