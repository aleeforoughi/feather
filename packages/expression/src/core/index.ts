// @aleeforoughi/feather-expression/core: the framework-free core of Feather's website layer. No React, no DOM at import
// time, no dependencies. The React components are thin bodies over this.
export { clock, createClock, type Clock, type Tick, type Ticker } from "./clock"
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
export { DPR_CAP, cappedPixelRatio, createWorld, deviceHints, pickQuality, type DeviceHints, type Quality, type WorldController, type WorldFrame, type WorldRenderer } from "./world"
export { PERSISTENT_SLOT, createTransitions, type Transitions } from "./transition"
export { COUNTER_MS, countTo, formatCount, type CountOptions } from "./counter"
export { MAGNETIC_STRENGTH, follow, magnetic, pointerEffectsAllowed } from "./pointer"
