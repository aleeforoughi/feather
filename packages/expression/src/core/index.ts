// @aleeforoughi/feather-expression/core: the framework-free core of Feather's website layer. No React, no DOM at import
// time, no dependencies. The React components are thin bodies over this.
export { clock, createClock, MAX_DELTA, type Clock, type Tick, type Ticker } from "./clock"
export { bezierEasing } from "./easing"
export {
  HOUSE,
  ms,
  parseBezier,
  prefersReducedMotion,
  roleMotion,
  staggerStep,
  sequenceCap,
  staggerDelays,
  revealDistance,
  mediaScale,
  springBounce,
  onReducedMotionChange,
  type Bezier,
  type ExpressionRole,
  type ReducedMapping,
  type RoleMotion,
} from "./motion"
export { reveal, revealKeyframes, type RevealFrom, type RevealOptions } from "./reveal"
export { splitWords, splitChars, groupLines, fontsReady, type SplitBy } from "./split"
export { FIT_MEASURE, fitChars, fitParts, isLongRun, joinUnit, longestRun, runLength, runs, unitSpace } from "./fit"
export { LENIS_OPTIONS, connectScroll, scrollProgress, scrub, supportsScrollTimeline, type GsapLike, type LenisLike, type ScrollConnection, type ScrollEngine } from "./scroll"
export { DPR_CAP, LADDER_RATIO, MIN_PIXEL_RATIO, PIXEL_BUDGET, cappedPixelRatio, createWorld, deviceHints, pickQuality, type DeviceHints, type Quality, type WorldController, type WorldFrame, type WorldOptions, type WorldRenderer } from "./world"
export { CURTAIN, PERSISTENT_SLOT, POINTER_WINDOW, arrive, createTransitions, type GoOptions, type RouteVariant, type Transitions } from "./transition"
export { COUNTER_MS, DEFAULT_LOCALE, countTo, formatCount, type CountOptions } from "./counter"
export { MAGNETIC_STRENGTH, follow, magnetic, pointerEffectsAllowed } from "./pointer"
export { ENTRANCE_STALL_MS, guardEntrance, isHidden, onVisibilityChange } from "./visibility"
export { perFrame, type FrameTask, type PerFrameOptions, type PerFrameRun } from "./frames"
export { createQualityLadder, type LadderOptions, type QualityLadder } from "./ladder"
export { capabilityGate, retire, type GateOptions, type GateReason, type GateVerdict } from "./gate"
export { LOADER_MS, honestProgress, type HonestProgress, type HonestProgressOptions } from "./loader"
export { createSoundPreference, playBed, sound, type SoundBed, type SoundPreference, type SoundPreferenceOptions, type SoundState } from "./sound"
export { SEQUENCE_LERP, SEQUENCE_CONCURRENCY, loadOrder, nearestLoaded, stepToward, fitRect, loadImage, loadSequence, type FitRect, type FrameLoad, type SequenceLoad, type SequenceLoadOptions } from "./sequence"
export { PRESETS, EFFECT_CAP, OVAL_CAP, SKEW_MIN_WIDTH, resolveEffect, effectUnit, createScramble, type DisplayEffect, type EffectPreset, type EffectUnit, type ScrambleOptions } from "./text"
export { DEFAULT_LOUDNESS, allows, loudnessOf, type Loudness } from "./loudness"
export { pointerAllowedAt, POINTER_FIELDS } from "./pointer"
export { cursorStates, cursorFor, CURSOR_LABELS, type CursorKind } from "./pointer-cursor"
export { pointerTilt, tiltAngles, TILT_MAX, TILT_LIMIT, TILT_PERSPECTIVE } from "./pointer-tilt"
export { pointerField, fieldFalloff, fieldOffset, FIELD_RADIUS, FIELD_STEPS } from "./pointer-field"
export { pointerTrail, trailPoolSize, TRAIL_SPACING, TRAIL_LIFETIME, TRAIL_POOL_MIN, TRAIL_POOL_MAX } from "./pointer-trail"
export { BUSES, createMixer, getMixer, MIXER, type AudioSource, type Bus, type LoopHandle, type LoopOptions, type Mixer, type MixerOptions, type PlayOptions } from "./audio"
