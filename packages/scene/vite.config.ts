import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import pkg from "./package.json" with { type: "json" }

// The library build: one ES module per source file, every dependency external (Three.js included: a site that uses
// the /three entry brings its own). Types come from tsc (tsconfig.build.json).
const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)]

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: { index: resolve(import.meta.dirname, "src/index.ts"), "three/index": resolve(import.meta.dirname, "src/three/index.ts") }, formats: ["es"] },
    sourcemap: true,
    emptyOutDir: false,
    rolldownOptions: {
      external: (id) => external.some((dep) => id === dep || id.startsWith(`${dep}/`)),
      output: { preserveModules: true, preserveModulesRoot: "src", entryFileNames: "[name].js" },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
})
