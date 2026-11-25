import { defineConfig } from "vite"

// The feather-page CLI as one self-contained Node file (ESM): the page package, React's server renderer and the
// token engine bundled in, so a caller runs `node feather-page.mjs build page.json --out site` with nothing installed.
export default defineConfig({
  plugins: [
    {
      // The CLI renders on the server, where no scene ever runs: Three.js (a page's dynamic import, only ever reached in
      // a browser effect) stays out of it instead of being inlined.
      name: "feather-no-three-on-the-server",
      enforce: "pre",
      resolveId: (id) => (id === "@aleeforoughi/feather-scene/three" ? "\0feather-no-three" : null),
      load: (id) => (id === "\0feather-no-three" ? "export {}" : null),
    },
  ],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  ssr: { noExternal: true, target: "node" },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    ssr: "../../packages/page/bin/feather-page.mjs",
    target: "node22",
    rolldownOptions: {
      // The page package is marked side-effect free (right for a library); the CLI is a script, so keep it whole.
      treeshake: { moduleSideEffects: (id) => id.endsWith("/bin/feather-page.mjs") || !id.includes("/packages/") },
      output: { entryFileNames: "feather-page.mjs", codeSplitting: false },
    },
  },
})
