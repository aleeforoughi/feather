import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import "@aleeforoughi/feather-tokens/fonts/sora.css"
import "@aleeforoughi/feather-tokens/fonts/inter.css"
import "@aleeforoughi/feather-tokens/fonts/fraunces.css"
import "@aleeforoughi/feather-tokens/fonts/dm-sans.css"
import { FeatherProvider } from "@aleeforoughi/feather-react"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FeatherProvider>
      <App />
    </FeatherProvider>
  </StrictMode>,
)
