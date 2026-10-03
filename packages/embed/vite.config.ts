import { createHash } from "node:crypto"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { scopeBundleCss } from "./build/scope-css.ts"

// One ES module with everything inside (React, Base UI, Feather) and one stylesheet, scoped to `.feather-root`. Library
// mode inlines the font files into the CSS as data URLs; they are written out again as files and referenced relatively
// (`./fonts/...`), so the folder can be served from any path and the fonts are fetched only when a page needs them.
function scopeFeatherCss(): Plugin {
  return {
    name: "feather-embed:scope-css",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".css")) continue
        const withFiles = String(file.source).replace(/url\(\s*["']?data:font\/(woff2|woff);base64,([A-Za-z0-9+/=]+)["']?\s*\)/g, (_all, ext: string, data: string) => {
          const source = Buffer.from(data, "base64")
          const name = `fonts/jetbrains-mono-${createHash("sha256").update(source).digest("hex").slice(0, 8)}.${ext}`
          this.emitFile({ type: "asset", fileName: name, source })
          return `url(./${name})`
        })
        file.source = scopeBundleCss(withFiles)
      }
    },
  }
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), scopeFeatherCss()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    target: "es2022",
    lib: { entry: resolve(import.meta.dirname, "src/index.ts"), formats: ["es"], fileName: () => "feather-embed.js", cssFileName: "feather-embed" },
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    emptyOutDir: true,
    rolldownOptions: { output: { codeSplitting: false, assetFileNames: (info) => (info.names.some((n) => n.endsWith(".css")) ? "feather-embed.css" : "fonts/[name]-[hash][extname]") } },
  },
})
