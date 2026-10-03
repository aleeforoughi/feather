import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import pkg from "./package.json" with { type: "json" }

// The library build, as packages/react does it: one ES module per source file, every dependency external. Types
// come from tsc (tsconfig.build.json). There is no stylesheet: the classes in src/ are compiled by the product's
// own Tailwind, which adds this package's src to its sources (@source).
const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)]

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: resolve(import.meta.dirname, "src/index.ts"), formats: ["es"] },
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
