import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Storybook's builder reads this file.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
