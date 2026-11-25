import { useMemo, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DisplayTitle } from "../../../../../packages/expression/src/components/display-title"
import "./docs.css"
import { useThemeTick } from "./theme-runtime"

const Sample = () => (
  <div>
    <DisplayTitle as="p" size="s" effect="mask" trigger="load">
      Real text, in every tier
    </DisplayTitle>
    <p className="type-body-sm" style={{ margin: "8px 0 0", opacity: 0.8 }}>The same words, the same layout, the same action.</p>
    <button type="button" className="fd-btn" style={{ marginTop: 12 }}>A real button</button>
  </div>
)

/** One component in its three tiers: the server's HTML with no script, reduced motion, and the full tier. */
export function TierViewer() {
  const [run, setRun] = useState(0)
  useThemeTick()
  // The no-script tier is what the server writes: the component rendered to plain HTML, never hydrated.
  const html = useMemo(() => renderToStaticMarkup(<Sample />), [])
  const tiers = [
    { key: "noscript", title: "No script", note: "The server's HTML, never hydrated. Everything is there." },
    { key: "reduced", title: "Reduced motion", note: 'Rendered under data-motion="reduced": a short cross-fade or nothing.' },
    { key: "full", title: "Full", note: "The brand's signature curve and pace." },
  ]
  return (
    <div className="fd">
      <button type="button" className="fd-btn" onClick={() => setRun((n) => n + 1)}>Replay</button>
      <div className="fd-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {tiers.map((t) => (
          <section key={`${t.key}-${run}`} aria-label={t.title} className="fd-panel" style={{ margin: 0 }}>
            <p className="type-caps" style={{ margin: "0 0 8px", opacity: 0.7 }}>{t.title}</p>
            {t.key === "noscript" ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <div {...(t.key === "reduced" ? { "data-motion": "reduced" } : {})}>
                <Sample />
              </div>
            )}
            <p style={{ fontSize: 12, opacity: 0.75, margin: "12px 0 0" }}>{t.note}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
