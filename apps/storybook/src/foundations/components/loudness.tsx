import { useState } from "react"
import { DisplayTitle } from "../../../../../packages/expression/src/components/display-title"
import { allows, type Loudness } from "../../../../../packages/expression/src/core/loudness"
import "./docs.css"
import { useThemeTick } from "./theme-runtime"

const LEVELS: { level: Loudness; name: string; example: string }[] = [
  { level: 0, name: "quiet", example: "a form, a docs page" },
  { level: 1, name: "composed", example: "a company site" },
  { level: 2, name: "expressive", example: "an agency site" },
  { level: 3, name: "spectacle", example: "a launch, a world" },
]
const WHAT = [
  ["reveal", "Reveals"],
  ["kinetic", "Kinetic type"],
  ["scroll", "Scroll choreography (pins, parallax)"],
  ["scene", "Scenes (WebGL)"],
] as const

/** What each loudness allows, asked of the same `allows` the components use. */
export function LoudnessMatrix() {
  return (
    <table className="fd fd-table fd-matrix">
      <thead>
        <tr>
          <th scope="col">Allows</th>
          {LEVELS.map(({ level, name }) => (
            <th key={level} scope="col">{level} {name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {WHAT.map(([key, label]) => (
          <tr key={key}>
            <th scope="row">{label}</th>
            {LEVELS.map(({ level }) => (
              <td key={level} className={allows(level, key) ? "fd-yes" : "fd-no"}>
                {allows(level, key) ? "yes" : "no"}
              </td>
            ))}
          </tr>
        ))}
        <tr>
          <th scope="row">Example</th>
          {LEVELS.map(({ level, example }) => (
            <td key={level}>{example}</td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}

/** The same block at each loudness: the title enters only as the level allows. Same layout, type, colour and spacing at
 * every level: only how much moves changes. */
export function LoudnessBlocks() {
  const [run, setRun] = useState(0)
  useThemeTick()
  return (
    <div className="fd">
      <button type="button" className="fd-btn" onClick={() => setRun((n) => n + 1)}>
        Replay all four
      </button>
      <div className="fd-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {LEVELS.map(({ level, name }) => (
          <section key={`${level}-${run}`} data-loudness={level} aria-label={`Loudness ${level}, ${name}`} className="fd-panel" style={{ margin: 0, overflow: "hidden" }}>
            <p className="type-caps" style={{ margin: "0 0 8px", opacity: 0.7 }}>{level} {name}</p>
            {allows(level, "reveal") ? (
              <DisplayTitle as="p" size="s" trigger="load" {...(allows(level, "kinetic") ? { effect: level === 3 ? "oval" : "mask" } : {})}>
                A quiet studio for loud ideas
              </DisplayTitle>
            ) : (
              <p className="type-display-s" style={{ margin: 0 }}>A quiet studio for loud ideas</p>
            )}
            <p className="type-body-sm" style={{ margin: "12px 0 0", opacity: 0.8 }}>
              {allows(level, "scene") ? "Enters with the full sequence." : allows(level, "kinetic") ? "Enters line by line." : allows(level, "reveal") ? "Rises in place." : "Already there: micro-motion only."}
            </p>
            <button type="button" className="fd-btn motion-press" style={{ marginTop: 12 }}>Start a project</button>
          </section>
        ))}
      </div>
    </div>
  )
}
