import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

// feather-page.css and its fonts. Built as an app, not a library: library mode inlines every asset a stylesheet
// references, which would put all fifteen font families into the CSS as data URLs. Here each font stays a file and
// loads only when a brand uses it.
export default defineConfig({
  // Every url() relative to the stylesheet (./fonts/…), so a host can serve the bundle under any path.
  base: "./",
  plugins: [tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: { "feather-page": "src/page.css" },
      output: { assetFileNames: (a) => (a.names?.some((n) => n.endsWith(".css")) ? "feather-page.css" : "fonts/[name]-[hash][extname]") },
    },
  },
})
