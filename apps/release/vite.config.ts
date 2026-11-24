import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The browser runtime: one ES module with React and the Feather packages bundled in. Its stylesheet is
// vite.css.config.ts (feather-page.css with its fonts as files); the CLI bundle is vite.cli.config.ts.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: { entry: "src/runtime.tsx", formats: ["es"], fileName: () => "feather-page-runtime.js" },
  },
})
