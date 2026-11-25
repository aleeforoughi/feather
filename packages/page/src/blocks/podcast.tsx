import * as React from "react"
import { Section, useMuffleWhile } from "@aleeforoughi/feather-expression"
import { clockTime, spokenTime } from "../core/flows"
import type { PodcastEpisode } from "../core/types"
import { MARK, RANGE } from "./controls"
import { KnobBody, KnobTitle, useKnobs } from "./knobs"
import { mediaSrc } from "./media"
import { BUTTON_PRIMARY, BUTTON_QUIET, join, useRegion, type BlockProps } from "./shared"

/** The speeds the speed control steps through, from the usual one. */
export const PODCAST_SPEEDS = [1, 1.25, 1.5, 2, 0.75] as const
/** How far the skip controls jump, in seconds. */
export const PODCAST_SKIP = 15

/** "45:12" or "1:02:03" as seconds (the episode's stated length, until the file says its own). */
const secondsOf = (text?: string): number => {
  if (!text || !/^\d+(?::\d{1,2}){1,2}$/.test(text)) return 0
  return text.split(":").reduce((sum, part) => sum * 60 + Number(part), 0)
}

/** One episode playing at a time: starting one pauses whichever was playing. */
let playing: HTMLAudioElement | null = null

const PlayIcon = ({ on }: { on: boolean }) => (
  <svg data-slot="podcast-icon" aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
    {on ? <path d="M4 2h3v12H4zM9 2h3v12H9z" /> : <path d="M4 2l10 6-10 6z" />}
  </svg>
)

function Episode({ episode, base }: { episode: PodcastEpisode; base: string }) {
  const audio = React.useRef<HTMLAudioElement>(null)
  const list = React.useRef<HTMLOListElement>(null)
  const [isPlaying, setPlaying] = React.useState(false)
  const [time, setTime] = React.useState(0)
  const [duration, setDuration] = React.useState(() => secondsOf(episode.duration))
  const [speed, setSpeed] = React.useState(0)
  const [follow, setFollow] = React.useState(false)
  useMuffleWhile(isPlaying)
  const at = `${base}-${episode.id}`
  const chapters = episode.chapters ?? []
  const timed = episode.transcript.some((c) => c.at !== undefined)
  const cue = timed ? episode.transcript.reduce((found, c, i) => (c.at !== undefined && c.at <= time ? i : found), -1) : -1
  const chapter = chapters.reduce((found, c, i) => (c.at <= time ? i : found), -1)

  React.useEffect(() => {
    const el = audio.current
    if (!el) return
    const onTime = () => setTime(el.currentTime)
    const onMeta = () => Number.isFinite(el.duration) && el.duration > 0 && setDuration(el.duration)
    const onPlay = () => {
      if (playing && playing !== el) playing.pause()
      playing = el
      setPlaying(true)
    }
    const onPause = () => {
      if (playing === el) playing = null
      setPlaying(false)
    }
    el.addEventListener("timeupdate", onTime)
    el.addEventListener("loadedmetadata", onMeta)
    el.addEventListener("durationchange", onMeta)
    el.addEventListener("play", onPlay)
    el.addEventListener("pause", onPause)
    el.addEventListener("ended", onPause)
    return () => {
      el.removeEventListener("timeupdate", onTime)
      el.removeEventListener("loadedmetadata", onMeta)
      el.removeEventListener("durationchange", onMeta)
      el.removeEventListener("play", onPlay)
      el.removeEventListener("pause", onPause)
      el.removeEventListener("ended", onPause)
      if (playing === el) playing = null
    }
  }, [])

  // Following along: the line being said stays in view inside the transcript, never scrolling the page itself.
  React.useEffect(() => {
    const box = list.current
    if (!follow || !box || cue < 0) return
    const line = box.querySelector<HTMLElement>(`[data-cue="${cue}"]`)
    if (!line) return
    const top = line.offsetTop - box.offsetTop
    if (top < box.scrollTop || top + line.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, top - box.clientHeight / 3)
  }, [cue, follow])

  const seek = (t: number) => {
    const el = audio.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(duration || Infinity, t))
    setTime(el.currentTime)
  }
  const toggle = () => {
    const el = audio.current
    if (!el) return
    if (el.paused) void el.play().catch(() => setPlaying(false))
    else el.pause()
  }
  const rate = PODCAST_SPEEDS[speed]
  const nextSpeed = () => {
    const i = (speed + 1) % PODCAST_SPEEDS.length
    setSpeed(i)
    if (audio.current) audio.current.playbackRate = PODCAST_SPEEDS[i]
  }
  const meta = [episode.date, episode.duration].filter(Boolean).join(" · ")
  return (
    <article data-slot="podcast-episode" data-state={isPlaying ? "playing" : "paused"} aria-labelledby={`${at}-title`} className="flex flex-col gap-6 rounded-card border border-line-primary bg-surface-raised p-6">
      <div data-slot="podcast-head" className="flex flex-col gap-2">
        {meta ? (
          <p data-slot="podcast-meta" className="type-caps numeric text-fg-secondary">
            {meta}
          </p>
        ) : null}
        <h3 id={`${at}-title`} data-slot="podcast-title" className="type-heading-2 text-fg-primary">
          {episode.title}
        </h3>
        {episode.summary ? (
          <p data-slot="podcast-summary" className="max-w-prose type-body text-prose text-fg-secondary">
            {episode.summary}
          </p>
        ) : null}
      </div>
      {/* Without script, the browser's own controls; with it, the same audio under the page's own buttons. Never
          autoplays, and loads nothing until the person presses play. */}
      <audio ref={audio} data-slot="podcast-audio" src={mediaSrc(episode.audio)} preload="none" controls aria-label={`${episode.title}, audio`} className="w-full scripting:hidden" />
      <div data-slot="podcast-player" role="group" aria-label={`Player: ${episode.title}`} className="flex flex-col gap-4 noscript:hidden">
        <div data-slot="podcast-controls" className="flex flex-wrap items-center gap-3">
          <button type="button" data-slot="podcast-play" data-state={isPlaying ? "playing" : "paused"} onClick={toggle} aria-label={`${isPlaying ? "Pause" : "Play"} ${episode.title}`} className={join(BUTTON_PRIMARY, "gap-2")}>
            <PlayIcon on={isPlaying} />
            <span data-slot="podcast-play-label" aria-hidden="true">
              {isPlaying ? "Pause" : "Play"}
            </span>
          </button>
          <button type="button" data-slot="podcast-back" onClick={() => seek(time - PODCAST_SKIP)} aria-label={`Back ${PODCAST_SKIP} seconds`} className={join(BUTTON_QUIET, "px-4 numeric")}>
            {`−${PODCAST_SKIP}s`}
          </button>
          <button type="button" data-slot="podcast-forward" onClick={() => seek(time + PODCAST_SKIP)} aria-label={`Forward ${PODCAST_SKIP} seconds`} className={join(BUTTON_QUIET, "px-4 numeric")}>
            {`+${PODCAST_SKIP}s`}
          </button>
          <button type="button" data-slot="podcast-speed" onClick={nextSpeed} aria-label={`Playback speed ${rate} times; change`} className={join(BUTTON_QUIET, "px-4 numeric")}>
            {`${rate}×`}
          </button>
        </div>
        <div data-slot="podcast-scrub" className="flex items-center gap-4">
          <span data-slot="podcast-time" aria-hidden="true" className="w-16 type-caption numeric text-fg-secondary">
            {clockTime(time)}
          </span>
          <input
            type="range"
            data-slot="podcast-position"
            min={0}
            max={Math.max(1, Math.round(duration))}
            step={1}
            value={Math.min(Math.round(time), Math.max(1, Math.round(duration)))}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Position"
            aria-valuetext={`${spokenTime(time)}${duration ? ` of ${spokenTime(duration)}` : ""}`}
            className={join(RANGE, "flex-1")}
          />
          <span data-slot="podcast-duration" aria-hidden="true" className="w-16 text-end type-caption numeric text-fg-secondary">
            {duration ? clockTime(duration) : "—"}
          </span>
        </div>
      </div>
      {chapters.length ? (
        <div data-slot="podcast-chapters" className="flex flex-col gap-3">
          <h4 data-slot="podcast-chapters-title" className="type-label text-fg-primary">
            Chapters
          </h4>
          <ol data-slot="podcast-chapter-list" role="list" className="flex flex-col">
            {chapters.map((c, i) => (
              <li key={`${c.at}-${c.title}`} data-slot="podcast-chapter" data-state={i === chapter ? "current" : "idle"} className="border-t border-line-primary">
                <button type="button" data-slot="podcast-chapter-seek" aria-current={i === chapter && time > 0 ? "true" : undefined} onClick={() => seek(c.at)} className="flex min-h-12 w-full items-center gap-4 text-start type-body text-fg-primary focus-ring noscript:hidden not-disabled:hover:bg-surface-hover motion-hover-out">
                  <span data-slot="podcast-chapter-at" className="w-16 type-caption numeric text-fg-secondary">
                    {clockTime(c.at)}
                  </span>
                  <span data-slot="podcast-chapter-title">{c.title}</span>
                  <span data-slot="podcast-chapter-hint" className="sr-only">{`, play from ${spokenTime(c.at)}`}</span>
                </button>
                <p data-slot="podcast-chapter-static" className="flex min-h-12 items-center gap-4 type-body text-fg-primary scripting:hidden">
                  <span data-slot="podcast-chapter-at" className="w-16 type-caption numeric text-fg-secondary">
                    {clockTime(c.at)}
                  </span>
                  {c.title}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <details data-slot="podcast-transcript" className="border-t border-line-primary pt-4">
        <summary data-slot="podcast-transcript-summary" className="flex min-h-12 cursor-pointer items-center type-title text-fg-primary focus-ring">
          Transcript
        </summary>
        <div data-slot="podcast-transcript-body" className="flex flex-col gap-4 pt-2">
          {timed ? (
            <label data-slot="podcast-follow" className="inline-flex min-h-12 cursor-pointer items-center gap-3 self-start type-body text-fg-primary noscript:hidden">
              <input type="checkbox" role="switch" data-slot="podcast-follow-input" checked={follow} onChange={(e) => setFollow(e.target.checked)} className={MARK} />
              Follow along as it plays
            </label>
          ) : null}
          <ol ref={list} data-slot="podcast-cues" role="list" tabIndex={0} aria-label={`Transcript: ${episode.title}`} className="relative flex max-h-[50svh] flex-col gap-4 overflow-y-auto pe-2 focus-ring">
            {episode.transcript.map((c, i) => (
              <li key={i} data-slot="podcast-cue" data-cue={i} data-state={i === cue ? "current" : "idle"} aria-current={i === cue && time > 0 ? "true" : undefined} className="flex flex-col gap-1 rounded-control border-s border-transparent ps-3 data-[state=current]:border-fg-primary">
                {c.by || c.at !== undefined ? (
                  <p data-slot="podcast-cue-meta" className="type-caption numeric text-fg-secondary">
                    {[c.by, c.at !== undefined ? clockTime(c.at) : undefined].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                <p data-slot="podcast-cue-text" className="max-w-prose type-body text-prose text-fg-primary">
                  {c.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </article>
  )
}

/**
 * A podcast (feather.page/1, wave 5): episodes on native audio with the page's own controls, all real buttons (play
 * and pause, back and forward 15 seconds, the speed) and a scrub slider whose value is spoken as time; chapters are
 * buttons that seek; the transcript, which the spec requires wherever there is audio, sits in a disclosure and can
 * follow playback when the person turns that on. Nothing autoplays and nothing loads before play; one episode plays
 * at a time, and the page's ambient sound is muffled while one does. With no script, the browser's own controls.
 */
export function PodcastBlock({ block }: BlockProps<"podcast">) {
  const { id, titleId, labelled } = useRegion(block, "Podcast")
  const knobs = useKnobs<"list">("podcast", block, { space: "l" })
  const base = id ?? titleId.replace(/-title$/, "")
  return (
    <Section id={id} data-block="podcast" {...labelled} {...knobs.section}>
      <KnobTitle id={titleId} knobs={knobs} motion={block.motion}>
        {block.title}
      </KnobTitle>
      <KnobBody knobs={knobs}>
        <div data-slot="podcast" className="col-span-full flex max-w-3xl flex-col gap-8">
          {block.body ? (
            <p data-slot="podcast-body" className="max-w-prose type-body-lg text-prose text-fg-secondary">
              {block.body}
            </p>
          ) : null}
          {block.episodes.map((e) => (
            <Episode key={e.id} episode={e} base={base} />
          ))}
        </div>
      </KnobBody>
    </Section>
  )
}
