import * as React from "react"
import { cn } from "../cn"
import { matchPrepared, type PreparedScene } from "../core/prepared"
import type { Speaker } from "../core/disclosure"
import type { Registry } from "../core/registry"
import type { BlockRenderer } from "./turn"

export interface PreparedSceneViewProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  scene: PreparedScene
  speaker: Speaker
  registry: Registry<BlockRenderer>
  /** The other scenes: a next ask that matches one becomes a link to its route. */
  scenes?: PreparedScene[]
  /** The route of an intent. Default `/<intent>`. */
  href?: (intent: string) => string
  /** The heading level of the ask (1 for a route of its own). */
  headingLevel?: 1 | 2
}

/**
 * PreparedSceneView: one prepared scene as a finished, static page: the ask as its heading, the spoken line, the
 * blocks and the next asks as links. It needs no script to read, so search engines and a model that is off both see it.
 */
export function PreparedSceneView({ scene, speaker, registry, scenes = [], href = (intent) => `/${intent}`, headingLevel = 1, className, ...props }: PreparedSceneViewProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2"
  const next = (scene.asks ?? []).map((ask) => ({ ask, target: matchPrepared(scenes, ask) })).filter((n): n is { ask: string; target: PreparedScene } => n.target !== null)
  return (
    <article data-slot="prepared-scene" data-intent={scene.intent} aria-labelledby={`prepared-${scene.intent}`} className={cn("flex w-full flex-col gap-4 py-8", className)} {...props}>
      <Heading id={`prepared-${scene.intent}`} data-slot="prepared-ask" className="type-display-s text-fg-primary">
        {scene.ask}
      </Heading>
      <p data-slot="prepared-byline" className="type-label text-fg-primary">
        {speaker.name}
      </p>
      <p data-slot="prepared-line" className="font-voice type-body text-fg-primary">
        {scene.line}
      </p>
      <div data-slot="prepared-blocks" className="flex flex-col gap-8">
        {scene.blocks.slice(0, 3).map((b, i) => {
          const Render = registry.renderer(b.block)
          return (
            <div key={b.id ?? i} data-slot="prepared-block">
              <Render block={b} />
            </div>
          )
        })}
      </div>
      {next.length > 0 ? (
        <nav data-slot="prepared-next" aria-label="Next" className="flex flex-wrap gap-2">
          {next.map((n) => (
            <a key={n.target.intent} href={href(n.target.intent)} data-slot="prepared-link" className="type-label rounded-control min-h-control focus-ring inline-flex items-center border border-line-secondary px-4 text-fg-primary">
              {n.ask}
            </a>
          ))}
        </nav>
      ) : null}
    </article>
  )
}
