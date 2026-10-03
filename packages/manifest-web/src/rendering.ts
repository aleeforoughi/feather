// What every node renderer needs from the plan being rendered: how to turn an act into a reply, the IR nodes by id,
// and the plan itself. One context, provided by PlanView.
import * as React from "react"
import type { IRNode, ReplyEvent } from "@aleeforoughi/feather-intent"
import type { LayoutPlan } from "@aleeforoughi/feather-liquid"

/** Whether the reply went out; when it did not, why, in words for the person. */
export type EmitResult = { ok: true } | { ok: false; message: string }

/** An act, as an organism or atom reports it. The renderer completes it into a reply and checks it. */
export type Emit = (node: string, act: string, value?: ReplyEvent["value"]) => EmitResult

export interface Rendering {
  plan: LayoutPlan
  emit: Emit
  /** Every IR node the plan renders, by id. */
  nodes: Map<string, IRNode>
  /** The currency the experience speaks in, for inputs that ask for a price. */
  currency: string | undefined
}

export const RenderingContext = React.createContext<Rendering | null>(null)

/** The plan being rendered. Only valid below a PlanView. */
export function useRendering(): Rendering {
  const rendering = React.useContext(RenderingContext)
  if (!rendering) throw new Error("A Feather node rendered outside a <PlanView>.")
  return rendering
}
