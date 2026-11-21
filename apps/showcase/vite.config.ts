import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The showcase consumes the built packages exactly as an outside product would: no aliases into
// packages/*/src, only the published entries of the Feather packages.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  // index.html is the product showcase; sites.html is the website layer (one page schema, three brands).
  build: { rolldownOptions: { input: { index: "index.html", sites: "sites.html" } } },
})
