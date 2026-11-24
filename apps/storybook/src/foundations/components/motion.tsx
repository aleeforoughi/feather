import { useEffect, useState, type CSSProperties } from "react"
import { EXPRESSION_ROLES, SIGNATURES } from "@aleeforoughi/feather-tokens"
import "./docs.css"
import { cssVar, useReducedMotion, useThemeTick } from "./theme-runtime"

function Note({ reduced }: { reduced: boolean }) {
  return (
    <p className="fd" style={{ fontSize: 13, opacity: 0.8 }} role="status">
      {reduced ? "Reduced motion is on: every demo here ends at once or cross-fades, as the components do." : "Play the demo. With prefers-reduced-motion on, every demo ends at once or cross-fades."}
    </p>
  )
}

const PRODUCT: { role: string; use: string; move: CSSProperties }[] = [
  { role: "press", use: "pressed feedback", move: { transform: "scale(0.985)" } },
  { role: "hover", use: "surface, border and color on hover", move: { transform: "translateY(-1px)", background: "var(--surface-hover)" } },
  { role: "state", use: "selection, errors, success", move: { background: "var(--surface-selected)" } },
  { role: "switch", use: "switch thumb and track", move: { transform: "translateX(24px)" } },
  { role: "popover", use: "menus, popovers, selects", move: { transform: "translateY(8px) scale(0.99)", opacity: 0.6 } },
  { role: "dialog", use: "dialog and sheet", move: { transform: "translateY(16px) scale(0.985)", opacity: 0.5 } },
  { role: "page", use: "route and workflow changes", move: { transform: "translateY(24px)", opacity: 0.4 } },
]

/** The product motion roles (docs/visual-system.md section 10): one curve, six durations, a role per use. */
export function ProductMotion() {
  const [on, setOn] = useState(false)
  const reduced = useReducedMotion()
  useThemeTick()
  return (
    <div className="fd">
      <Note reduced={reduced} />
      <button type="button" className="fd-btn" aria-pressed={on} onClick={() => setOn((v) => !v)}>
        {on ? "Reset" : "Play"} all roles
      </button>
      <table className="fd-table">
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col">Used for</th>
            <th scope="col">Demo</th>
          </tr>
        </thead>
        <tbody>
          {PRODUCT.map(({ role, use, move }) => (
            <tr key={role}>
              <th scope="row"><code>motion-{role}</code></th>
              <td>{use}</td>
              <td>
                <div className={`motion-${role}`} aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "var(--radius-control)", background: "var(--primary)", ...(on ? move : null), ...(on && role === "hover" ? { background: "var(--accent)" } : null) }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function parseBezier(value: string): [number, number, number, number] | null {
  const m = /cubic-bezier\(([^)]+)\)/.exec(value)
  const parts = m?.[1]?.split(",").map((n) => parseFloat(n))
  return parts && parts.length === 4 && parts.every(Number.isFinite) ? (parts as [number, number, number, number]) : null
}

function Curve({ p, label, active }: { p: readonly number[]; label: string; active?: boolean }) {
  const [x1, y1, x2, y2] = p as [number, number, number, number]
  // 100x100 plot, y up; y may overshoot, so the viewBox has room.
  const X = (v: number) => 10 + v * 80
  const Y = (v: number) => 90 - v * 80
  return (
    <figure style={{ margin: 0, textAlign: "center", fontSize: 12 }}>
      <svg viewBox="0 0 100 100" width="120" height="120" role="img" aria-label={`${label}: cubic-bezier ${p.join(", ")}`} style={{ border: `1px solid var(--border-${active ? "primary" : "secondary"})`, borderRadius: 8, background: "var(--card)" }}>
        <path d={`M${X(0)} ${Y(0)} L${X(1)} ${Y(1)}`} stroke="var(--border-tertiary)" strokeDasharray="2 3" fill="none" />
        <path d={`M${X(0)} ${Y(0)} C${X(x1)} ${Y(y1)} ${X(x2)} ${Y(y2)} ${X(1)} ${Y(1)}`} stroke={active ? "var(--accent-strong, var(--primary))" : "var(--text-primary)"} strokeWidth={active ? 3 : 2} fill="none" />
      </svg>
      <figcaption>
        <code>{label}</code>
      </figcaption>
    </figure>
  )
}

/** The six signature curves, and the one the current brand uses. */
export function SignatureCurves() {
  const tick = useThemeTick()
  void tick
  const own = parseBezier(cssVar("--ease-signature"))
  const ownName = own ? Object.entries(SIGNATURES).find(([, v]) => v.every((n, i) => n === own[i]))?.[0] : undefined
  return (
    <div className="fd">
      <div className="fd-panel fd-row" style={{ gap: 20 }}>
        {Object.entries(SIGNATURES).map(([name, p]) => (
          <Curve key={name} p={p} label={name} active={name === ownName} />
        ))}
      </div>
      <p style={{ fontSize: 13 }}>
        The current brand&apos;s <code>--ease-signature</code> is <code>{cssVar("--ease-signature") || "not set (a /2 brand: expression roles use the house default)"}</code>
        {ownName ? <> (<code>{ownName}</code>)</> : own ? " (a custom curve)" : ""}.
      </p>
    </div>
  )
}

/** The expression roles (feather-tokens/3 and later): reveal, media and scene, in the brand's signature curve and pace. */
export function ExpressionMotion() {
  const [run, setRun] = useState(0)
  const [shown, setShown] = useState(false)
  const reduced = useReducedMotion()
  const tick = useThemeTick()
  useEffect(() => {
    // Two frames: the hidden state paints first, then the brand's transition plays to the shown one.
    const id = requestAnimationFrame(() => {
      setShown(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
    })
    return () => cancelAnimationFrame(id)
  }, [run, tick])
  const dist = cssVar("--distance-reveal") || "32px"
  const enter = (role: "reveal" | "media" | "scene", i: number): CSSProperties => ({
    transitionDelay: shown && !reduced ? `calc(var(--stagger-block, 100ms) * ${i})` : "0ms",
    opacity: shown ? 1 : 0,
    transform: shown || reduced ? "none" : role === "media" ? "scale(var(--scale-media, 1.03))" : role === "scene" ? "scale(0.96)" : `translateY(${dist})`,
    transitionDuration: reduced ? "var(--duration-reduced, 150ms)" : undefined,
  })
  return (
    <div className="fd">
      <Note reduced={reduced} />
      <button type="button" className="fd-btn" onClick={() => setRun((n) => n + 1)}>
        Replay
      </button>
      <div className="fd-panel fd-row" style={{ alignItems: "stretch" }}>
        {(["reveal", "media", "scene"] as const).map((role, i) => (
          <div key={role} className={`motion-${role}`} style={{ ...enter(role, i), flex: "1 1 160px", minHeight: 96, padding: 14, border: "1px solid var(--border-secondary)", borderRadius: "var(--radius-card)", background: "var(--card)" }}>
            <code>motion-{role}</code>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>{cssVar(`--duration-${role}`) || "not set in this brand"}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The expression roles per pace, read from the engine. */
export function PaceTable() {
  const paces = Object.keys(EXPRESSION_ROLES) as (keyof typeof EXPRESSION_ROLES)[]
  const rows: [string, (p: (typeof EXPRESSION_ROLES)[keyof typeof EXPRESSION_ROLES]) => string][] = [
    ["reveal", (p) => `${p.reveal}ms, ${p.revealDistance}px`],
    ["media", (p) => `${p.media}ms, scale ${p.mediaScale}`],
    ["scene", (p) => `${p.scene}ms`],
    ["stagger (word / block)", (p) => `${p.staggerWord} / ${p.staggerBlock}ms`],
    ["hover-out", (p) => `${p.hoverOut}ms`],
    ["spring bounce", (p) => String(p.bounce)],
  ]
  return (
    <table className="fd fd-table">
      <thead>
        <tr>
          <th scope="col">Role</th>
          {paces.map((p) => (
            <th key={p} scope="col">{p}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, f]) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            {paces.map((p) => (
              <td key={p}>{f(EXPRESSION_ROLES[p])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
