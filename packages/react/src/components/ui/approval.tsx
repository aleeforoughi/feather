import * as React from "react"
import { ShieldCheckIcon, TriangleAlertIcon } from "lucide-react"

import { AttentionCard } from "./attention-card"
import { Button } from "./button"
import { ConsequenceStatement, type Consequence } from "./consequence-statement"
import { Label } from "./label"
import { RoleChip } from "./role-avatar"
import { Textarea } from "./textarea"
import { WhyDisclosure, type Expandable } from "./why-disclosure"

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s
}

/** The reason to send: trimmed, and nothing when blank. */
function rejectionReason(text: string): string | undefined {
  const t = text.trim()
  return t === "" ? undefined : t
}

/** The outcome once decided: "Approved.", "Rejection sent." and the reason when one was given. */
function approvalOutcome(act: "approve" | "reject", reason?: string): string {
  if (act === "approve") return "Approved."
  return reason ? `Rejection sent. Reason: ${reason}` : "Rejection sent."
}

/** Tag for the requester chip: "Finance lead · agent". */
function requesterTag(requester: { role?: string; kind?: string }): string | undefined {
  const tag = [requester.role, requester.kind].filter(Boolean).join(" · ")
  return tag === "" ? undefined : tag
}

type Mode = "idle" | "armed" | "rejecting" | "done"

/**
 * A request for the person's authority (IR node Approval), built on AttentionCard. Approve performs `approve`;
 * when the act is irreversible and has a consequence, approve arms first (confirm pattern). Reject opens an
 * optional reason field.
 */
function Approval({ intent, request, requester, scope, consequence, reversible, importance = "normal", expandable, locale = "en", onAct, className }: {
  intent: string
  request: string
  requester?: { name: string; role?: string; kind?: string }
  scope?: string
  consequence?: Consequence
  reversible?: boolean
  importance?: "low" | "normal" | "high" | "critical"
  expandable?: Expandable
  locale?: string
  onAct: (act: "approve" | "reject", reason?: string) => void
  className?: string
}) {
  const id = React.useId()
  const [mode, setMode] = React.useState<Mode>("idle")
  const [reason, setReason] = React.useState("")
  const [whyOpen, setWhyOpen] = React.useState(false)
  const [status, setStatus] = React.useState("")
  const [outcome, setOutcome] = React.useState("")
  const decided = React.useRef(false)
  const outcomeRef = React.useRef<HTMLParagraphElement>(null)
  const approveRef = React.useRef<HTMLButtonElement>(null)
  const rejectRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)
  const reasonRef = React.useRef<HTMLTextAreaElement>(null)
  const focusOn = React.useRef<"approve" | "reject" | "confirm" | "reason" | "outcome" | null>(null)
  const needsConfirm = reversible === false && consequence !== undefined
  const consequenceId = `${id}-consequence`
  const describedBy = consequence ? consequenceId : undefined

  React.useEffect(() => {
    const target = focusOn.current
    if (!target) return
    focusOn.current = null
    const refs = { approve: approveRef, reject: rejectRef, confirm: confirmRef, reason: reasonRef, outcome: outcomeRef }
    ;(refs[target].current as HTMLElement | null)?.focus()
  })

  // A decision happens once: after it the organism offers nothing that could decide again.
  const decide = (act: "approve" | "reject", value?: string) => {
    if (decided.current) return
    decided.current = true
    setWhyOpen(false)
    setMode("done")
    setReason("")
    setStatus("")
    setOutcome(approvalOutcome(act, value))
    focusOn.current = "outcome"
    if (act === "approve") onAct("approve")
    else onAct("reject", value)
  }
  const approve = () => decide("approve")
  const startApprove = () => {
    if (!needsConfirm) return approve()
    setMode("armed")
    setStatus(`Armed: press Yes, approve to ${lowerFirst(intent)}. Press Escape to go back.`)
    focusOn.current = "confirm"
  }
  const backOut = () => {
    if (mode === "armed") {
      setStatus("Not approved. Nothing was done.")
      focusOn.current = "approve"
    } else if (mode === "rejecting") {
      setStatus("")
      focusOn.current = "reject"
    }
    setMode("idle")
  }
  const sendRejection = () => {
    decide("reject", rejectionReason(reason))
  }

  const content = (
    <div
      className="space-y-3 text-foreground"
      onKeyDown={(e) => {
        if (e.key === "Escape" && (mode === "armed" || mode === "rejecting")) {
          e.preventDefault()
          backOut()
        }
      }}
    >
      {requester && (
        <p data-slot="approval-requester" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          Requested by <RoleChip title={requester.name} tag={requesterTag(requester)} />
        </p>
      )}
      {scope && (
        <p data-slot="approval-scope" className="text-sm">
          <span className="font-medium">Covers: </span>
          {scope}
        </p>
      )}
      {needsConfirm && (
        <p data-slot="approval-warning" className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <TriangleAlertIcon aria-hidden className="size-4 shrink-0 text-destructive" />
          Cannot be undone
        </p>
      )}
      {consequence && <ConsequenceStatement id={consequenceId} consequence={consequence} locale={locale} />}

      {mode === "done" ? (
        <p ref={outcomeRef} tabIndex={-1} role="status" data-slot="approval-outcome" className="rounded-md text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">{outcome}</p>
      ) : mode === "rejecting" ? (
        <div data-slot="approval-reject-form" className="space-y-2">
          <Label htmlFor={`${id}-reason`}>Reason for rejecting (optional)</Label>
          <Textarea ref={reasonRef} id={`${id}-reason`} data-slot="approval-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" data-slot="approval-send-rejection" variant="outline" onClick={sendRejection}>Send rejection</Button>
            <Button type="button" data-slot="approval-back" variant="outline" onClick={backOut}>Back</Button>
          </div>
        </div>
      ) : mode === "armed" ? (
        <div data-slot="approval-confirm-row" className="flex flex-wrap gap-2">
          <Button
            ref={confirmRef}
            type="button"
            data-slot="approval-confirm"
            aria-label={`Yes, approve: ${request}`}
            aria-describedby={describedBy}
            onKeyDown={(e) => {
              if (e.repeat && (e.key === "Enter" || e.key === " ")) e.preventDefault()
            }}
            onClick={approve}
          >
            Yes, approve
          </Button>
          <Button type="button" data-slot="approval-cancel" variant="outline" onClick={backOut}>Cancel</Button>
        </div>
      ) : (
        <div data-slot="approval-actions" className="flex flex-wrap gap-2">
          <Button ref={approveRef} type="button" data-slot="approval-approve" aria-label={`Approve: ${request}`} aria-describedby={describedBy} onClick={startApprove}>
            Approve{needsConfirm ? "…" : ""}
          </Button>
          <Button ref={rejectRef} type="button" data-slot="approval-reject" variant="outline" aria-label={`Reject: ${request}`} onClick={() => { setMode("rejecting"); setStatus(""); focusOn.current = "reason" }}>
            Reject
          </Button>
        </div>
      )}

      <p role="status" data-slot="approval-status" data-variant={mode} className={mode === "armed" ? "text-sm font-medium" : "sr-only"}>{status}</p>

      {expandable && mode !== "done" && <WhyDisclosure expandable={expandable} open={whyOpen} onOpenChange={setWhyOpen} forceOpen={importance === "critical"} />}
    </div>
  )

  return (
    <div data-slot="approval" data-variant={mode} data-importance={importance} className={className}>
      <AttentionCard
        eyebrow={`Approval needed: ${intent}`}
        title={request}
        icon={<ShieldCheckIcon />}
        description={content}
      />
    </div>
  )
}

export { Approval, approvalOutcome, rejectionReason, requesterTag }
