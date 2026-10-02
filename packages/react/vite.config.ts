import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import pkg from "./package.json" with { type: "json" }

// The library build: one ES module per source file (so products tree-shake per component), every dependency
// external. Types come from tsc (tsconfig.build.json); the CSS ships as source (styles.css), since products
// compile it with their own Tailwind.
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
  test: { environment: "node", include: ["src/**/*.test.ts"] },
})
