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
export { LENIS_OPTIONS, connectScroll, scrollProgress, scrub, supportsScrollTimeline, type GsapLike, type LenisLike, type ScrollConnection, type ScrollEngine } from "./scroll"
export { DPR_CAP, LADDER_RATIO, MIN_PIXEL_RATIO, PIXEL_BUDGET, cappedPixelRatio, createWorld, deviceHints, pickQuality, type DeviceHints, type Quality, type WorldController, type WorldFrame, type WorldOptions, type WorldRenderer } from "./world"
export { CURTAIN, PERSISTENT_SLOT, arrive, createTransitions, type GoOptions, type RouteVariant, type Transitions } from "./transition"
export { COUNTER_MS, countTo, formatCount, type CountOptions } from "./counter"
export { MAGNETIC_STRENGTH, follow, magnetic, pointerEffectsAllowed } from "./pointer"
export { isHidden, onVisibilityChange } from "./visibility"
export { perFrame, type FrameTask, type PerFrameOptions, type PerFrameRun } from "./frames"
export { createQualityLadder, type LadderOptions, type QualityLadder } from "./ladder"
export { capabilityGate, retire, type GateOptions, type GateReason, type GateVerdict } from "./gate"
export { LOADER_MS, honestProgress, type HonestProgress, type HonestProgressOptions } from "./loader"
export { createSoundPreference, playBed, sound, type SoundBed, type SoundPreference, type SoundPreferenceOptions, type SoundState } from "./sound"
