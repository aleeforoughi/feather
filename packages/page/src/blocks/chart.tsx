import * as React from "react"
import { Section, allows, loudnessOf, roleMotion } from "@aleeforoughi/feather-expression"
import { formatAmount, niceScale } from "../core/flows"
import type { ChartVariant } from "../core/types"
import { KnobBody, KnobTitle, alignClass, useKnobs } from "./knobs"
import { join, useRegion, type BlockProps } from "./shared"

/** The plot's own coordinates. The SVG stretches to its box (the marks are lines and bands, so nothing distorts that
 * matters, and every stroke keeps its width); the words around it are HTML, at the type scale on every screen. */
const W = 600
const H = 300
/** Each series has its own mark, so no series is told apart by colour alone (WCAG 1.4.1): a solid fill or line, a
 * hatch or a dash, dots, a cross-hatch or a dash-dot. Every mark is in the text ink, which the theme engine holds at 7:1
 * on the ground (CONTRAST_FLOORS.textPrimary), so a chart reads in any brand and on any tone. */
const DASHES = [undefined, "6 4", "1.5 4", "10 3 2 3"] as const
const FILLS = (base: string) => ["", `url(#${base}-hatch)`, `url(#${base}-dots)`, `url(#${base}-cross)`] as const

const unitOf = (unit?: string) => (!unit ? "" : /^[%°×‰]/.test(unit) ? unit : ` ${unit}`)

/**
 * A chart (feather.page/1, wave 5): bar, line or area from the page's rows, in SVG, in the theme's text ink with a
 * distinct mark per series. Its summary sentence is the caption and its data is a real table behind a disclosure, so
 * the meaning never lives in the drawing. The end state is the markup; it draws in as it enters the view (bars rise
 * from the baseline, lines and areas wipe in), never at loudness 0 or under reduced motion, and never when it is
 * already on screen at load.
 */
export function ChartBlock({ block }: BlockProps<"chart">) {
  const { id, titleId, labelled } = useRegion(block, "Chart")
  const knobs = useKnobs<ChartVariant>("chart", block, { space: "l" })
  const base = id ?? titleId.replace(/-title$/, "")
  const variant = knobs.variant
  const series = block.series
  const rows = block.rows
  const all = rows.flatMap((r) => r.values)
  const scale = niceScale(Math.min(...all), Math.max(...all))
  const y = (v: number) => H * (1 - (v - scale.min) / (scale.max - scale.min))
  const band = W / rows.length
  const cx = (i: number) => (i + 0.5) * band
  const fmt = (v: number) => `${formatAmount(v, { prefix: block.prefix, decimals: block.decimals ?? 0 })}${unitOf(block.unit)}`
  const fills = FILLS(base)
  const marks = React.useRef<SVGGElement>(null)
  useDrawIn(marks, variant)

  const legend = series.length > 1 ? (
    <ul data-slot="chart-legend" role="list" className="flex flex-wrap gap-x-6 gap-y-2">
      {series.map((s, si) => (
        <li key={s.label} data-slot="chart-legend-item" className="inline-flex items-center gap-2 type-caption text-fg-secondary">
          <svg data-slot="chart-swatch" aria-hidden="true" viewBox="0 0 24 12" className="h-3 w-6 overflow-visible">
            {variant === "bar" ? (
              <rect data-slot="chart-swatch-mark" x="0" y="0" width="24" height="12" className={si === 0 ? "fill-fg-primary" : "stroke-fg-primary"} fill={si === 0 ? undefined : fills[si]} strokeWidth={si === 0 ? 0 : 1} />
            ) : (
              <line data-slot="chart-swatch-mark" x1="0" y1="6" x2="24" y2="6" className="stroke-fg-primary" strokeWidth="2" strokeDasharray={DASHES[si]} strokeLinecap="round" />
            )}
          </svg>
          {s.label}
        </li>
      ))}
    </ul>
  ) : null

  return (
    <Section id={id} data-block="chart" {...labelled} {...knobs.section}>
      <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
        {block.title}
      </KnobTitle>
      <KnobBody knobs={knobs}>
        <figure data-slot="chart" className={join(alignClass(knobs.align, "col-span-full"), "flex w-full flex-col gap-6 text-start")}>
          <figcaption data-slot="chart-caption" className="flex flex-col gap-2">
            <span data-slot="chart-summary" className="max-w-prose type-body-lg text-prose text-fg-primary">
              {block.summary}
            </span>
            {block.source ? (
              <span data-slot="chart-source" className="type-caption text-fg-secondary">
                {block.source}
              </span>
            ) : null}
          </figcaption>
          {legend}
          {/* The drawing repeats the summary and the table: assistive tech reads those instead. */}
          <div data-slot="chart-frame" aria-hidden="true" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
            <div data-slot="chart-y" className="relative w-16">
              {scale.ticks.map((t) => (
                <span key={t} data-slot="chart-y-label" className="absolute end-0 -translate-y-1/2 type-caption numeric whitespace-nowrap text-fg-secondary" style={{ top: `${(y(t) / H) * 100}%` }}>
                  {fmt(t)}
                </span>
              ))}
            </div>
            <div data-slot="chart-plot" className="relative aspect-4/3 sm:aspect-2/1">
              <svg data-slot="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
                <defs>
                  <pattern id={`${base}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line data-slot="chart-hatch" x1="0" y1="0" x2="0" y2="6" className="stroke-fg-primary" strokeWidth="2.5" />
                  </pattern>
                  <pattern id={`${base}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
                    <circle data-slot="chart-dot" cx="3" cy="3" r="1.4" className="fill-fg-primary" />
                  </pattern>
                  <pattern id={`${base}-cross`} width="7" height="7" patternUnits="userSpaceOnUse">
                    <path data-slot="chart-cross" d="M0 0L7 7M7 0L0 7" className="stroke-fg-primary" strokeWidth="1.2" />
                  </pattern>
                </defs>
                {scale.ticks.map((t) => (
                  <line key={t} data-slot="chart-grid" x1="0" x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-fg-secondary" : "stroke-line-primary"} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                ))}
                <g ref={marks} data-slot="chart-marks" style={variant === "bar" ? { transformBox: "view-box", transformOrigin: `0 ${y(0)}px` } : undefined}>
                  {variant === "bar"
                    ? rows.map((r, i) => {
                        const group = band * 0.72
                        const w = group / series.length
                        return r.values.map((v, si) => {
                          const x = cx(i) - group / 2 + si * w
                          const top = Math.min(y(v), y(0))
                          return <rect key={`${i}-${si}`} data-slot="chart-bar" x={x + w * 0.06} y={top} width={w * 0.88} height={Math.max(0.5, Math.abs(y(v) - y(0)))} className={si === 0 ? "fill-fg-primary" : "stroke-fg-primary"} fill={si === 0 ? undefined : fills[si]} strokeWidth={si === 0 ? 0 : 1} vectorEffect="non-scaling-stroke" />
                        })
                      })
                    : series.map((s, si) => {
                        const points = rows.map((r, i) => `${cx(i).toFixed(2)} ${y(r.values[si]).toFixed(2)}`)
                        const line = `M${points.join(" L")}`
                        const area = `${line} L${cx(rows.length - 1).toFixed(2)} ${y(0).toFixed(2)} L${cx(0).toFixed(2)} ${y(0).toFixed(2)} Z`
                        return (
                          <g key={s.label} data-slot="chart-series">
                            {variant === "area" ? <path data-slot="chart-area" d={area} className="fill-fg-primary" fillOpacity={series.length > 1 ? 0.08 : 0.14} /> : null}
                            <path data-slot="chart-line" d={line} fill="none" className="stroke-fg-primary" strokeWidth="2.5" strokeDasharray={DASHES[si]} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                          </g>
                        )
                      })}
                </g>
              </svg>
            </div>
            <div data-slot="chart-x-gap" />
            <div data-slot="chart-x" className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
              {rows.map((r, i) => (
                <span key={i} data-slot="chart-x-label" className={join("truncate text-center type-caption numeric text-fg-secondary", rows.length > 8 && i % 2 === 1 && "max-sm:invisible", rows.length > 16 && i % 3 !== 0 && "max-lg:invisible")}>
                  {r.label}
                </span>
              ))}
            </div>
          </div>
          <details data-slot="chart-data" className="border-t border-line-primary pt-4">
            <summary data-slot="chart-data-summary" className="flex min-h-12 cursor-pointer items-center type-title text-fg-primary focus-ring">
              The data as a table
            </summary>
            <div data-slot="chart-table-box" className="overflow-x-auto pt-2">
              <table data-slot="chart-table" className="w-full border-collapse text-start">
                <caption data-slot="chart-table-caption" className="sr-only">
                  {block.title}
                </caption>
                <thead data-slot="chart-table-head">
                  <tr data-slot="chart-table-row" className="border-b border-line-primary">
                    <th scope="col" data-slot="chart-table-th" className="py-3 pe-6 text-start type-caps text-fg-secondary">
                      {block.axis ?? "Item"}
                    </th>
                    {series.map((s) => (
                      <th key={s.label} scope="col" data-slot="chart-table-th" className="py-3 pe-6 text-end type-caps text-fg-secondary">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody data-slot="chart-table-body">
                  {rows.map((r, i) => (
                    <tr key={i} data-slot="chart-table-row" className="border-b border-line-primary">
                      <th scope="row" data-slot="chart-table-label" className="py-3 pe-6 text-start type-body font-normal text-fg-primary">
                        {r.label}
                      </th>
                      {r.values.map((v, si) => (
                        <td key={si} data-slot="chart-table-value" className="py-3 pe-6 text-end type-body numeric text-fg-primary">
                          {fmt(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </figure>
      </KnobBody>
    </Section>
  )
}

/** Draws the marks in as they enter the view: bars rise from the baseline, lines and areas wipe in from the start. Only
 * where a reveal is allowed (loudness 1 and up) and at full motion; a chart already on screen at load simply shows. */
function useDrawIn(ref: React.RefObject<SVGGElement | null>, variant: ChartVariant) {
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined" || typeof el.animate !== "function") return
    if (!allows(loudnessOf(el), "reveal")) return
    const motion = roleMotion("reveal", el)
    if (motion.mode !== "full") return
    const box = el.getBoundingClientRect()
    if (box.bottom > 0 && box.top < window.innerHeight) return
    const frames: Keyframe[] = variant === "bar" ? [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }] : [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }]
    const hidden = frames[0]
    const style = el.style as CSSStyleDeclaration & Record<string, string>
    const key = variant === "bar" ? "transform" : "clipPath"
    style[key] = String(hidden[key as keyof Keyframe])
    let animation: Animation | null = null
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        style[key] = ""
        animation = el.animate(frames, { duration: motion.duration * 1.5, easing: motion.easing, fill: "backwards" })
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      animation?.cancel()
      style[key] = ""
    }
  }, [ref, variant])
}
