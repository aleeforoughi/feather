import * as React from "react"
import { Section, allows, loudnessOf, prefersSaveData, useReducedMotion } from "@aleeforoughi/feather-expression"
import { useHydrated } from "./hydration"
import { EDGE_START, KnobBody, KnobTitle, useKnobs } from "./knobs"
import { mediaProps, mediaSrc } from "./media"
import { BUTTON_QUIET, join, useRegion, type BlockProps } from "./shared"

/** Shows or hides a video's captions tracks. */
function captionsOn(video: HTMLVideoElement | null, on: boolean) {
  const list = video?.textTracks
  if (list) for (let i = 0; i < list.length; i++) if (list[i].kind === "captions") list[i].mode = on ? "showing" : "hidden"
}

/**
 * A film with its own controls. The poster is what shows first, and what stays under reduced motion, on data saver and
 * below loudness 1, until the visitor presses Play; otherwise it starts muted and loops. Play and pause, sound and
 * captions are real buttons (sound and captions say whether they are on with aria-pressed), always visible, so it can
 * always be stopped. A film with speech carries its captions (`captions`, a WebVTT track, on by default). With no
 * script it is the browser's own player, with the same track.
 */
export function ShowreelBlock({ block }: BlockProps<"showreel">) {
  const { id, titleId, labelled } = useRegion(block, "Showreel")
  const knobs = useKnobs<"player">("showreel", block, { space: "l" })
  const hydrated = useHydrated()
  const box = React.useRef<HTMLDivElement>(null)
  const player = React.useRef<HTMLVideoElement>(null)
  const reduced = useReducedMotion(box)
  const [auto, setAuto] = React.useState(false)
  const [playing, setPlaying] = React.useState(false)
  const [muted, setMuted] = React.useState(true)
  const [captions, setCaptions] = React.useState(true)
  const p = mediaProps(block.media, block.title)
  const poster = typeof block.media === "object" ? block.media.poster : undefined
  const track = block.captions ? mediaSrc(block.captions) : undefined
  const cropped = knobs.crop !== "none"

  React.useEffect(() => {
    const el = box.current
    setAuto(!!el && !reduced && !prefersSaveData() && allows(loudnessOf(el), "reveal"))
  }, [reduced])
  React.useEffect(() => {
    const v = player.current
    if (!v || !auto) return
    void v.play?.()?.catch?.(() => {})
  }, [auto])

  const toggle = () => {
    const v = player.current
    if (!v) return
    if (v.paused) void v.play?.()?.catch?.(() => {})
    else v.pause?.()
  }
  const showCaptions = () => {
    const next = !captions
    captionsOn(player.current, next)
    setCaptions(next)
  }
  const sound = () => {
    const v = player.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }
  const title = block.title || block.body ? (
    <>
      {block.title ? (
        <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
          {block.title}
        </KnobTitle>
      ) : null}
      {block.body ? (
        <p data-slot="showreel-body" className="col-span-full mb-12 max-w-prose type-body-lg text-prose text-fg-secondary">
          {block.body}
        </p>
      ) : null}
    </>
  ) : null
  const film = (
    <div ref={box} data-slot="showreel" className="flex flex-col gap-4">
      <div data-slot="showreel-frame" className={join("relative aspect-video w-full overflow-hidden bg-surface-subtle media-edge", !cropped && "rounded-card")}>
        <video
          ref={player}
          data-slot="showreel-media"
          className="block size-full object-cover"
          poster={poster}
          muted
          loop={auto}
          playsInline
          controls={!hydrated}
          preload={hydrated && auto ? "metadata" : "none"}
          aria-label={p.alt}
          src={p.sources?.length ? undefined : p.src}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        >
          {p.sources?.map((s) => (
            <source key={s.src + s.type} data-slot="showreel-source" src={s.src} type={s.type} />
          ))}
          {track ? <track data-slot="showreel-captions" kind="captions" src={track} srcLang="en" label="Captions" default /> : null}
        </video>
      </div>
      {hydrated ? (
        <div data-slot="showreel-controls" className="flex flex-wrap gap-2">
          <button type="button" data-slot="showreel-play" data-variant={playing ? "pause" : "play"} className={BUTTON_QUIET} onClick={toggle}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" data-slot="showreel-sound" aria-pressed={!muted} className={BUTTON_QUIET} onClick={sound}>
            Sound
          </button>
          {track ? (
            <button type="button" data-slot="showreel-captions-toggle" aria-pressed={captions} className={BUTTON_QUIET} onClick={showCaptions}>
              Captions
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
  if (cropped) {
    return (
      <Section id={id} data-block="showreel" {...labelled} grid={false} {...knobs.section}>
        {title ? <div data-slot="showreel-head" className="page-grid">{title}</div> : null}
        <div data-slot="showreel-media-row" data-crop={knobs.crop} style={knobs.crop === "edge" ? EDGE_START : undefined}>
          {film}
        </div>
      </Section>
    )
  }
  return (
    <Section id={id} data-block="showreel" {...labelled} {...knobs.section}>
      {title}
      <KnobBody knobs={knobs}>
        <div data-slot="showreel-box" className={knobs.align === "center" ? "col-span-full lg:col-span-10 lg:col-start-2" : "col-span-full"}>
          {film}
        </div>
      </KnobBody>
    </Section>
  )
}
