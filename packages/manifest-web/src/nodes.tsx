// One plan node on the web: its wrapper, then the organism (a decision) or atom (content) that renders it.
import * as React from "react"
import type { IRNode, PersonNode, TradeoffNode } from "@aleeforoughi/feather-intent"
import type { PlanNode } from "@aleeforoughi/feather-liquid"
import {
  Approval,
  AlternativeList,
  CorrectionInput,
  ExploreMore,
  IrreversibleAction,
  PredictedChoice,
  Recommendation,
  Tradeoff,
  type AlternativeItem,
} from "@aleeforoughi/feather-react"
import {
  ActionAtom,
  AutopickAtom,
  ChoiceAtom,
  ComparisonAtom,
  ConfirmationAtom,
  DateAtom,
  Detail,
  InputAtom,
  LocationAtom,
  MediaAtom,
  PersonAtom,
  PreferenceAtom,
  PredictionNoteAtom,
  PriceAtom,
  ProgressAtom,
  StatusAtom,
  TextAtom,
  WarningAtom,
} from "./atoms"
import { useRendering } from "./rendering"

/** The organisms that show "Why?" themselves, and so open it from `defaultExpanded`. */
const OWN_DETAIL = new Set<IRNode["type"]>(["Recommendation", "IrreversibleAction", "Approval"])

/** Marks an element a host organism rendered as the plan node it stands for, since it cannot wrap it. */
function mark(el: Element | null | undefined, node: PlanNode) {
  if (!el) return
  el.setAttribute("data-feather-node", node.id)
  el.setAttribute("data-organism", node.organism)
  el.setAttribute("data-emphasis", node.emphasis)
}

/** The wrapper every plan node sits in: its id, the organism that renders it and how strongly it stands out. */
export function NodeFrame({ node, children }: { node: PlanNode; children: React.ReactNode }) {
  return (
    <div
      data-slot="experience-node"
      data-variant={node.emphasis}
      data-feather-node={node.id}
      data-organism={node.organism}
      data-emphasis={node.emphasis}
      className="min-w-0"
    >
      {children}
    </div>
  )
}

/** A plan node, wrapped, with its attachments and its "Why?". */
export function NodeView({ node }: { node: PlanNode }) {
  const ir = node.node
  // A Person attached to an Approval is the requester the organism shows. What else is attached (a Tradeoff on an
  // option, a note on a prediction) renders after the node; the members of an AlternativeList render inside it.
  const attached = (node.attached ?? []).filter((a) => a.node?.type === "Tradeoff" || a.organism === "PredictionNote")
  return (
    <NodeFrame node={node}>
      <div className="flex flex-col gap-3">
        {node.type === "AlternativeGroup" ? <Alternatives group={node} /> : ir && <Body node={node} ir={ir} />}
        {ir?.expandable && !OWN_DETAIL.has(ir.type) && <Detail expandable={ir.expandable} expanded={node.expanded} importance={ir.importance} />}
        {attached.map((a) => (
          <NodeView key={a.id} node={a} />
        ))}
      </div>
    </NodeFrame>
  )
}

function Body({ node, ir }: { node: PlanNode; ir: IRNode }) {
  const { emit, plan } = useRendering()
  const ref = React.useRef<HTMLDivElement>(null)
  const requester = ir.type === "Approval" ? node.attached?.find((a) => a.node?.type === "Person") : undefined
  const merged = ir.type === "Choice" ? node.merged?.find((m) => m.node?.type === "PredictedChoice") : undefined
  // An organism draws what is merged into or attached to it inside itself, so that element is marked as the plan node
  // it stands for: the requester in an Approval, the prediction in its Choice.
  React.useLayoutEffect(() => {
    if (requester) mark(ref.current?.querySelector('[data-slot="approval-requester"]'), requester)
    if (merged) mark(ref.current?.querySelector('[data-slot="predicted-choice"]'), merged)
  }, [requester, merged])
  switch (ir.type) {
    case "Text":
      return <TextAtom ir={ir} />
    case "Action":
      return <ActionAtom ir={ir} emphasis={node.emphasis} />
    case "Choice": {
      const prediction = merged?.node
      if (prediction?.type === "PredictedChoice") {
        return (
          <div ref={ref}>
            <PredictedChoice
              intent={ir.intent}
              prompt={ir.prompt}
              options={ir.options}
              predicted={{ option: prediction.option, summary: prediction.summary, confidence: prediction.confidence }}
              // The acts accept and change belong to the PredictedChoice node, which the Choice merged.
              onAct={(act, option) => void emit(prediction.id, act, option)}
            />
          </div>
        )
      }
      return <ChoiceAtom ir={ir} preselected={node.preselected} />
    }
    case "Input":
      return <InputAtom ir={ir} />
    case "Price":
      return <PriceAtom ir={ir} />
    case "Person":
      return <PersonAtom ir={ir} />
    case "Date":
      return <DateAtom ir={ir} />
    case "Location":
      return <LocationAtom ir={ir} />
    case "Status":
      return <StatusAtom ir={ir} />
    case "Progress":
      return <ProgressAtom ir={ir} />
    case "Media":
      return <MediaAtom ir={ir} textEquivalent={node.textEquivalent === true} />
    case "Confirmation":
      return <ConfirmationAtom ir={ir} />
    case "Warning":
      return <WarningAtom ir={ir} />
    case "Approval": {
      const person = requester?.node as PersonNode | undefined
      return (
        <div ref={ref}>
          <Approval
            intent={ir.intent}
            request={ir.request}
            requester={person && { name: person.name, role: person.role, kind: person.kind === "agent" ? "agent" : undefined }}
            scope={ir.scope}
            consequence={ir.consequence}
            arm={node.confirm !== undefined}
            reversible={ir.reversible}
            importance={ir.importance}
            expandable={ir.expandable}
            locale={plan.locale}
            defaultExpanded={node.expanded}
            onAct={(act, reason) => void emit(ir.id, act, reason)}
          />
        </div>
      )
    }
    case "Recommendation":
      return (
        <Recommendation
          intent={ir.intent}
          summary={ir.summary}
          confidence={ir.confidence}
          consequence={ir.consequence}
          arm={node.confirm !== undefined}
          reversible={ir.reversible}
          importance={ir.importance}
          expandable={ir.expandable}
          primary={node.emphasis === "primary"}
          locale={plan.locale}
          defaultExpanded={node.expanded}
          onAct={() => void emit(ir.id, "accept")}
        />
      )
    case "PredictedChoice":
      // Merged into its Choice (reversible), the Choice's organism draws it. Beside an irreversible Choice, which is
      // never preselected, it is a note.
      return node.organism === "PredictionNote" ? <PredictionNoteAtom ir={ir} node={node} /> : null
    case "Alternative":
      // Alternatives render together, as one list, in the group the composer builds.
      return null
    case "Tradeoff":
      return <Tradeoff summary={ir.summary} gains={ir.gains} costs={ir.costs} importance={ir.importance} />
    case "Autopick":
      return <AutopickAtom ir={ir} />
    case "Correction":
      return <CorrectionInput intent={ir.intent} prompt={ir.prompt} original={ir.original} onAct={(_act, value) => void emit(ir.id, "submit", value)} />
    case "Preference":
      return <PreferenceAtom ir={ir} />
    case "Comparison":
      return <ComparisonAtom ir={ir} />
    case "IrreversibleAction":
      return (
        <IrreversibleAction
          intent={ir.intent}
          label={ir.label}
          consequence={ir.consequence}
          importance={ir.importance}
          expandable={ir.expandable}
          locale={plan.locale}
          // The plan's `confirm` is "confirm" on the web (two deliberate presses); spoken and typed keywords belong to
          // the voice and text manifestations, which render a summary here.
          mode="confirm"
          defaultExpanded={node.expanded}
          onAct={(act) => void emit(ir.id, act)}
        />
      )
    case "ExploreMore":
      return <ExploreMore intent={ir.intent} label={ir.label} topics={ir.topics} onAct={(_act, topic) => void emit(ir.id, "expand", topic)} />
    default:
      return unrenderable(ir)
  }
}

/** A node type a later IR adds: render nothing rather than break the page, and tell the developer. */
function unrenderable(ir: never): null {
  console.warn(`@aleeforoughi/feather-manifest-web does not render ${JSON.stringify((ir as { type?: string }).type)} yet.`)
  return null
}

/** The alternatives, as one AlternativeList. Each item and its tradeoff is marked as the plan node it stands for. */
function Alternatives({ group }: { group: PlanNode }) {
  const { emit, currency } = useRendering()
  const ref = React.useRef<HTMLDivElement>(null)
  const items = group.items ?? []
  const alternatives: AlternativeItem[] = items.flatMap((item) => {
    const ir = item.node
    if (ir?.type !== "Alternative") return []
    const tradeoff = item.attached?.map((a) => a.node).find((n): n is TradeoffNode => n?.type === "Tradeoff")
    return [{ id: ir.id, intent: ir.intent, label: ir.label, input: ir.input, currency, tradeoff: tradeoff && { gains: tradeoff.gains, costs: tradeoff.costs, summary: tradeoff.summary } }]
  })
  // AlternativeList draws its own rows, so each row and tradeoff is marked rather than wrapped.
  React.useLayoutEffect(() => {
    const rows = ref.current?.querySelectorAll('[data-slot="alternative-list-item"]')
    items.forEach((item, i) => {
      const row = rows?.[i]
      mark(row, item)
      const tradeoff = item.attached?.find((a) => a.node?.type === "Tradeoff")
      if (tradeoff) mark(row?.querySelector('[data-slot="tradeoff"]'), tradeoff)
    })
  })
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <AlternativeList alternatives={alternatives} onAct={(id, act, value) => void emit(id, act, value)} />
    </div>
  )
}
