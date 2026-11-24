import { useEffect, useRef, useState } from "react"
import "./docs.css"
import { cssVar, toHex, useThemeTick } from "./theme-runtime"

/** One color role: a block painted with the variable, its name, and the resolved color of the current brand. */
function Swatch({ name, tick }: { name: string; tick: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [hex, setHex] = useState("")
  useEffect(() => {
    const value = box.current ? getComputedStyle(box.current).backgroundColor : ""
    setHex(cssVar(name) ? toHex(value) : "not set")
  }, [name, tick])
  return (
    <div className="fd-swatch">
      <div ref={box} style={{ background: `var(${name}, transparent)` }} />
      <div>
        <code>{name}</code>
        <span>{hex || "…"}</span>
      </div>
    </div>
  )
}

const COLOR_GROUPS: [string, string[]][] = [
  ["Surfaces", ["--background", "--card", "--surface-subtle", "--surface-hover", "--surface-pressed", "--surface-selected", "--surface-inverse"]],
  ["Text and icons", ["--text-primary", "--text-secondary", "--text-tertiary", "--text-disabled", "--text-inverse"]],
  ["Lines", ["--border-primary", "--border-secondary", "--border-tertiary", "--border-disabled", "--ring"]],
  ["Brand", ["--primary", "--primary-foreground", "--accent", "--muted", "--secondary"]],
  ["Status", ["--destructive", "--destructive-muted", "--success", "--success-muted", "--warning", "--warning-muted", "--info", "--info-muted"]],
  ["Charts", ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"]],
]

/** The semantic color roles, painted live from the current brand. */
export function ColorRoles({ groups = COLOR_GROUPS }: { groups?: [string, string[]][] }) {
  const tick = useThemeTick()
  return (
    <div className="fd">
      {groups.map(([title, names]) => (
        <section key={title} aria-label={title}>
          <h4 className="fd-group">{title}</h4>
          <div className="fd-grid">
            {names.map((name) => (
              <Swatch key={name} name={name} tick={tick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** The roles feather-tokens/4 adds, when the current brand's engine defines them: colour blocks, scrim, layers, opacity. */
export function ExtendedRoles() {
  const tick = useThemeTick()
  void tick
  return (
    <div className="fd">
      <ColorRoles
        groups={[
          ["Colour blocks (feather-tokens/4)", ["--block-1", "--block-1-ink", "--block-2", "--block-2-ink", "--block-3", "--block-3-ink", "--block-4", "--block-4-ink"]],
          ["Scrims", ["--scrim", "--media-scrim", "--ink-on-media"]],
        ]}
      />
      <table className="fd-table">
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col">Values</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Layers</th>
            <td>{["base", "raised", "sticky", "overlay", "modal", "toast", "cursor"].map((n) => `${n} ${cssVar(`--layer-${n}`) || "-"}`).join(", ")}</td>
          </tr>
          <tr>
            <th scope="row">Opacity</th>
            <td>{["dim", "muted", "disabled"].map((n) => `${n} ${cssVar(`--opacity-${n}`) || "-"}`).join(", ")}</td>
          </tr>
          <tr>
            <th scope="row">Loudness</th>
            <td>{cssVar("--loudness") || "-"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Radius tiers, each as the box a surface of that tier gets. */
export function RadiusScale() {
  useThemeTick()
  const tiers = ["--radius-xs", "--radius-control", "--radius-card", "--radius-dialog"]
  return (
    <div className="fd fd-panel">
      <div className="fd-row">
        {tiers.map((name) => (
          <div key={name} style={{ textAlign: "center", fontSize: 12 }}>
            <div style={{ width: 88, height: 64, background: "var(--surface-subtle)", border: "1px solid var(--border-primary)", borderRadius: `var(${name})` }} />
            <code>{name.replace("--radius-", "")}</code>
            <span style={{ display: "block", opacity: 0.7 }}>{cssVar(name)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Elevation levels 1 to 3 as the shadow a raised card gets. */
export function ElevationScale() {
  useThemeTick()
  return (
    <div className="fd fd-panel">
      <div className="fd-row" style={{ gap: 28 }}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={{ textAlign: "center", fontSize: 12 }}>
            <div style={{ width: 96, height: 64, background: "var(--card)", borderRadius: "var(--radius-card)", boxShadow: `var(--elevation-${n})` }} />
            <code>shadow-{n}</code>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Density: the sizes the brand's density axis sets, as bars on a 4px grid. */
export function DensityScale() {
  const tick = useThemeTick()
  const names = ["--control-height", "--control-px", "--card-pad", "--dialog-pad", "--gap", "--group-gap", "--gap-field"]
  void tick
  const rem = (v: string) => (v.endsWith("rem") ? parseFloat(v) * 16 : parseFloat(v) || 0)
  return (
    <table className="fd fd-table">
      <thead>
        <tr>
          <th scope="col">Variable</th>
          <th scope="col">Value</th>
          <th scope="col">Size</th>
        </tr>
      </thead>
      <tbody>
        {names.map((n) => (
          <tr key={n}>
            <th scope="row"><code>{n}</code></th>
            <td>{cssVar(n)} ({rem(cssVar(n))}px)</td>
            <td><div aria-hidden="true" style={{ height: 8, width: rem(cssVar(n)), background: "var(--primary)", borderRadius: 2 }} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const ROLES: [string, string][] = [
  ["type-display", "Display"],
  ["type-heading-1", "Heading 1"],
  ["type-heading-2", "Heading 2"],
  ["type-heading-3", "Heading 3"],
  ["type-title", "Title"],
  ["type-body-lg", "Body large: the quick brown fox"],
  ["type-body", "Body: the quick brown fox jumps over the lazy dog"],
  ["type-body-sm", "Body small: the quick brown fox jumps over the lazy dog"],
  ["type-label", "Label"],
  ["type-caption", "Caption: the quick brown fox"],
  ["type-caps", "Eyebrow"],
]

/** The product type roles in the brand's fonts. */
export function TypeRoles() {
  useThemeTick()
  return (
    <div className="fd fd-panel">
      {ROLES.map(([role, sample]) => (
        <div key={role} style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "6px 0", borderBottom: "1px solid var(--border-tertiary)" }}>
          <code style={{ flex: "0 0 120px", fontSize: 12 }}>{role}</code>
          <span className={role} style={{ minWidth: 0 }}>{sample}</span>
        </div>
      ))}
    </div>
  )
}

/** The fluid display scale (feather-tokens/3). Resize the window to watch each step move between 360px and 1440px. */
export function DisplayScale() {
  useThemeTick()
  return (
    <div className="fd fd-panel">
      {["xl", "l", "m", "s"].map((step) => (
        <div key={step} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-tertiary)", overflow: "hidden" }}>
          <code style={{ fontSize: 12 }}>type-display-{step}</code>
          <div className={`type-display-${step}`}>Quiet type</div>
        </div>
      ))}
    </div>
  )
}

/** The six product durations and the one curve, as the brand's motion axis sets them. */
export function DurationTable() {
  const tick = useThemeTick()
  void tick
  return (
    <table className="fd fd-table">
      <thead>
        <tr>
          <th scope="col">Primitive</th>
          <th scope="col">Duration</th>
        </tr>
      </thead>
      <tbody>
        {["micro", "fast", "base", "medium", "slow", "large"].map((n) => (
          <tr key={n}>
            <th scope="row"><code>--duration-{n}</code></th>
            <td>{cssVar(`--duration-${n}`)}</td>
          </tr>
        ))}
        <tr>
          <th scope="row"><code>--ease-standard</code></th>
          <td><code>{cssVar("--ease-standard")}</code></td>
        </tr>
      </tbody>
    </table>
  )
}
