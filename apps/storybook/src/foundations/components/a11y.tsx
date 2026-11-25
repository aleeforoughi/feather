import { CONTRAST_FLOORS, contrastRatio, FOCUS_FLOOR } from "@aleeforoughi/feather-tokens"
import "./docs.css"
import { cssVar, toHex, useThemeTick } from "./theme-runtime"

const hex = (name: string) => toHex(cssVar(name)).slice(0, 7)

/** The contrast the current brand reaches against its floors, measured on the colors the browser resolved. */
export function ContrastReport() {
  useThemeTick()
  const bg = hex("--background")
  const card = hex("--card")
  const rows: [string, string, number][] = [
    ["Text (--text-primary)", hex("--text-primary"), CONTRAST_FLOORS.textPrimary],
    ["Secondary text", hex("--text-secondary"), CONTRAST_FLOORS.textSecondary],
    ["Tertiary text", hex("--text-tertiary"), CONTRAST_FLOORS.textTertiary],
    ["Control border (--border-primary)", hex("--border-primary"), CONTRAST_FLOORS.borderPrimary],
    ["Destructive as text", hex("--destructive"), CONTRAST_FLOORS.destructive],
    ["Focus ring (--ring)", hex("--ring"), FOCUS_FLOOR],
  ]
  return (
    <table className="fd fd-table">
      <thead>
        <tr>
          <th scope="col">Role</th>
          <th scope="col">Floor</th>
          <th scope="col">On background</th>
          <th scope="col">On surface</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, color, floor]) => {
          const a = contrastRatio(color, bg)
          const b = contrastRatio(color, card)
          const cell = (v: number | null) => (v === null ? "n/a" : `${v.toFixed(2)}:1 ${v >= floor ? "passes" : "FAILS"}`)
          return (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{floor}:1</td>
              <td>{cell(a)}</td>
              <td>{cell(b)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
