import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App"
import { FoundationProviders } from "@/foundation/providers"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FoundationProviders>
      <App />
    </FoundationProviders>
  </StrictMode>
)
