// @aleeforoughi/feather-scene/three: the Three.js scenes (three is an optional peer: a site that uses them installs it).
// Each is a factory returning a World renderer (feather-expression's `WorldRenderer`): pass it to `<World renderer>`,
// and hand the World's controller back with `onWorld={(w) => scene.bind(w)}` so input can ask for frames.
export {
  objectViewer,
  attachKeys,
  projectHotspots,
  fitObject,
  contactShadowTexture,
  DEFAULT_PRESETS,
  TURNTABLE_RESUME,
  type ObjectViewer,
  type ObjectViewerOptions,
  type Hotspot,
  type ScreenHotspot,
  type ViewPreset,
  type Variant,
  type OrbitOptions,
} from "./object-viewer"
export { particleField, particleCount, spherePoints, surfacePoints, PARTICLE_COUNTS, type ParticleField, type ParticleFieldOptions, type ParticleMode, type ShapeSource } from "./particle-field"
export { cameraRail, railPose, RAIL_DAMPING, RAIL_COLUMNS, DEFAULT_WAYPOINTS, type CameraRail, type CameraRailOptions } from "./camera-rail"
export { studioPost, resolvePost, POST_RANGES, type StudioPost, type StudioPostOptions, type ResolvedPost } from "./post"
export { fitDistance, smoothDamp, settled, tierOf, falloff, TIERS, REST, type Spring, type Tier } from "./maths"
export { readTheme, parseColor, themeColor, type Theme } from "./theme"
