import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import "@aleeforoughi/feather-tokens/fonts/jetbrains-mono.css"
import { FeatherProvider } from "@aleeforoughi/feather-react"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FeatherProvider>
      <App />
    </FeatherProvider>
  </StrictMode>,
)
