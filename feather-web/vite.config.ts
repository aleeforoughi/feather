import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  // index.html is the product; sheet.html is the themed component sheet (design review and QA).
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, "index.html"), sheet: resolve(import.meta.dirname, "sheet.html") } } },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
