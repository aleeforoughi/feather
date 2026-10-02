import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App"
import { FeatherProvider } from "@aleeforoughi/feather-react"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FeatherProvider>
      <App />
    </FeatherProvider>
  </StrictMode>
)
