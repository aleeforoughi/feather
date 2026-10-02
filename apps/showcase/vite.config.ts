import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The showcase consumes the built packages exactly as an outside product would: no aliases into
// packages/*/src, only "@aleeforoughi/feather-react" and its styles.css.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
})
