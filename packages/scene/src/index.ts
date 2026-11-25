// @aleeforoughi/feather-scene: 3D and WebGL scenes as World renderers (docs/scene.md). Raw WebGL, no dependency.
//
// Every renderer runs inside the World (`<World renderer={…} still={…}>` from @aleeforoughi/feather-expression), which
// keeps the floors: the capped pixel ratio, the quality ladder, the capability gate, render on demand, pausing off
// screen and in a hidden tab, and the still under reduced motion. The meaning stays in the DOM: a scene is decoration.

export { shaderBackground, SHADER_PRESETS, SHADER_LEVELS, LOOP_SECONDS, GRAIN_FPS, type ShaderBackground, type ShaderBackgroundOptions, type ShaderPreset } from "./raw/shader-background"
export { depthImage, DEPTH_LEVELS, MAX_TEXTURE, type DepthImage, type DepthImageOptions } from "./raw/depth-image"

// The pieces both entries share, public for a brand that writes its own renderer.
export { useScene, type SceneProps } from "./shared/use-scene"
export { sceneLink, type SceneHooks, type SceneLink, type SceneRenderer, type SceneState, type SceneStop } from "./shared/scene"
export { createSurface, watchContextLoss, type Surface, type SurfaceOptions } from "./shared/surface"
export {
  compileShader,
  createProgram,
  createTexture,
  fullScreenTriangle,
  getContext,
  uniforms,
  FULLSCREEN_VERTEX,
  POSITION_ATTRIBUTE,
  SCENE_CONTEXT,
  ShaderError,
  type FullScreenTriangle,
  type GL,
  type SceneContext,
  type ShaderStage,
  type Uniforms,
} from "./shared/gl"
export { linearToOklab, linearToSrgb, paletteUniform, parseColor, resolvePalette, srgbToLinear, themePalette, THEME_COLORS, type LinearRGB } from "./shared/palette"
export { damp, trackPointer, type PointerTrack } from "./shared/pointer"
