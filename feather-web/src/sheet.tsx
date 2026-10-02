import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import { BranchSheet } from "@/foundation/BranchSheet"
import { FoundationProviders } from "@/foundation/providers"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FoundationProviders>
      <BranchSheet />
    </FoundationProviders>
  </StrictMode>
)
