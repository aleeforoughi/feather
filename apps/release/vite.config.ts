import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The browser runtime: one ES module with React and the Feather packages bundled in. Its stylesheet is
// vite.css.config.ts (feather-page.css with its fonts as files); the CLI bundle is vite.cli.config.ts.
//
// Three.js never enters the runtime. A page's Three.js scenes (particles, a model, a camera rail) load
// @aleeforoughi/feather-scene/three with a dynamic import, which becomes one chunk beside the runtime,
// feather-page-three.js, with three bundled into it. The runtime imports it by a relative URL, so it loads from wherever
// the runtime was loaded from (`feather-page build --runtime <href>`), and only on a page whose scene runs.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: { entry: "src/runtime.tsx", formats: ["es"], fileName: () => "feather-page-runtime.js" },
    rolldownOptions: {
      // The modules both the runtime and the Three.js chunk use (the scene's palette, the clock) stay in the runtime,
      // which may then export a little more than mount, hydrate and validatePage: still one runtime file, one chunk.
      preserveEntrySignatures: "allow-extension",
      output: {
        // One stable name per release (the zip lists it); the version is in the release, not the file name.
        chunkFileNames: (chunk) => (chunk.moduleIds.some((id) => /[\\/]feather-scene[\\/]|[\\/]scene[\\/](?:dist|src)[\\/]three[\\/]/.test(id)) ? "feather-page-three.js" : "feather-page-[name].js"),
      },
    },
  },
})
