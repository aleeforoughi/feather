// The fragment shaders of the shader backgrounds, GLSL ES 1.00 (WebGL1 and WebGL2 both run it), mediump.
//
// Time never enters a shader as a growing number: on a GPU whose mediump float is 16-bit, a clock in seconds loses
// its precision within minutes and motion starts to step. The CPU keeps time in double precision and hands over only
// cos and sin of one loop phase and its multiples (u_loop, u_loop2), so every value stays within -1..1 and the motion
// loops without a seam. Colour ramps mix in OKLab (even lightness between stops) and leave in sRGB with a 1/255
// dither against banding.

const HEADER = `precision mediump float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform vec4 u_loop;
uniform vec4 u_loop2;
uniform float u_scale;
uniform float u_intensity;
uniform float u_octaves;
uniform float u_stops;
uniform vec3 u_lab[5];
uniform vec3 u_rgb[5];
`

const NOISE = `
float hash(vec2 p) {
  vec2 q = fract(p * vec2(0.1371, 0.2617) + vec2(0.417, 0.239));
  q += dot(q, q.yx + 21.73);
  return fract((q.x + 0.371) * (q.y + 0.613) * 9.17);
}

vec2 gradient(vec2 cell) {
  float a = hash(cell) * 6.2831853;
  return vec2(cos(a), sin(a));
}

// Gradient noise with a quintic fade, about -1..1.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradient(i), f);
  float b = dot(gradient(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(gradient(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(gradient(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.41;
}

// Octaves set by the quality level through u_octaves (at most 6), each turned so the lattice never lines up.
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= u_octaves) break;
    sum += amp * noise(p);
    norm += amp;
    p = turn * p * 2.02 + vec2(3.7, 1.3);
    amp *= 0.45;
  }
  return sum / max(norm, 0.001);
}
`

const COLOR = `
vec3 labToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// The palette as a ramp: 0 is the ground (the first stop), 1 the last stop, each segment eased.
vec3 ramp(float t) {
  float seg = clamp(t, 0.0, 1.0) * (u_stops - 1.0);
  vec3 c = u_lab[0];
  for (int i = 0; i < 4; i++) {
    if (float(i) >= u_stops - 1.0) break;
    c = mix(c, u_lab[i + 1], smoothstep(float(i), float(i) + 1.0, seg));
  }
  return c;
}

vec4 finish(vec3 linear) {
  vec3 srgb = toSrgb(linear) + (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  return vec4(srgb, 1.0);
}
`

const COMMON = HEADER + NOISE + COLOR

/** The field every gradient preset shares: domain-warped fbm whose sampling point travels a loop in noise space. */
const FIELD = `
float field(vec2 uv) {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * (0.85 * u_scale);
  vec2 orbit = u_loop.xy * 0.7;
  vec2 warp = vec2(fbm(p * 0.7 + orbit), fbm(p * 0.7 + vec2(4.7, 1.9) + u_loop.zw * 0.45));
  return fbm(p + 0.95 * warp - u_loop2.xy * 0.25);
}
`

/** fbm noise flowing over the palette stops. */
export const GRADIENT_NOISE = `${COMMON}${FIELD}
void main() {
  float t = smoothstep(-0.55, 0.6, field(v_uv));
  vec3 lab = mix(u_lab[0], ramp(t), u_intensity);
  gl_FragColor = finish(labToLinear(lab));
}
`

/** Soft layered ribbons. On a dark ground the light adds; on a light ground (where adding light shows nothing) the
 * ribbons tint the ground instead, so the preset reads in either theme. */
export const AURORA = `${COMMON}
uniform float u_bands;
void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2((v_uv.x - 0.5) * aspect, v_uv.y);
  vec3 ground = u_rgb[0];
  vec3 light = vec3(0.0);
  float cover = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    if (fi >= u_bands) break;
    float x = p.x * u_scale * (1.1 + 0.4 * fi);
    float wander = fbm(vec2(x * 0.7 + fi * 3.1, fi * 1.7) + u_loop.xy * (0.45 + 0.2 * fi));
    float fold = 0.035 * sin(x * 3.1 + fi * 2.0 + 1.7 * wander);
    float centre = 0.64 - 0.13 * fi + 0.16 * wander + fold;
    float d = p.y - centre;
    float edge = exp(-d * d / (0.0009 + 0.0006 * fi));
    float curtain = smoothstep(-0.012, 0.01, d) * exp(-max(d, 0.0) * (5.5 + 1.5 * fi));
    // Rays: fine noise across the ribbon, carried by its wander so they bend with it, never a regular comb.
    float rx = x * 13.0 + wander * 6.0 + fi * 11.0;
    float ray = 0.5 + 0.5 * (0.65 * noise(vec2(rx, fi * 5.0) + u_loop.zw * 0.6) + 0.35 * noise(vec2(rx * 2.3, d * 3.0 + fi) + u_loop2.xy * 0.5));
    ray = ray * ray;
    float glow = (0.5 * edge + 0.9 * curtain * (0.35 + 0.65 * ray)) * (0.9 - 0.2 * fi);
    light += u_rgb[i + 1] * glow;
    cover += glow;
  }
  light *= u_intensity;
  cover = clamp(cover * u_intensity, 0.0, 1.0);
  vec3 added = ground + (1.0 - exp(-light * 1.6));
  vec3 tinted = mix(ground, light / max(cover, 0.001), cover * 0.8);
  float lum = dot(ground, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = finish(mix(added, tinted, smoothstep(0.3, 0.6, lum)));
}
`

/** A quiet grain over a two-colour ground; u_seed steps a few times a second, so the grain flickers like film. */
export const GRAIN_FIELD = `${COMMON}
uniform float u_seed;
void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (v_uv - 0.5) * vec2(aspect, 1.0) * u_scale;
  float broad = fbm(p * 0.9 + u_loop.xy * 0.3) * 0.5 + 0.5;
  float t = smoothstep(0.1, 0.9, mix(1.0 - v_uv.y, broad, 0.55));
  vec3 lab = mix(u_lab[0], u_lab[1], t);
  vec3 srgb = toSrgb(labToLinear(lab));
  vec2 cell = floor(gl_FragCoord.xy);
  float g = hash(cell + u_seed * vec2(17.0, 29.0)) + hash(cell.yx + u_seed * vec2(31.0, 7.0)) - 1.0;
  float amount = (0.025 + 0.085 * u_intensity) * (0.6 + 1.6 * srgb.g * (1.0 - srgb.g));
  gl_FragColor = vec4(srgb + g * amount, 1.0);
}
`

/** The gradient field, its uv pushed by the pointer's flowmap. */
export const FLOW = `${COMMON}${FIELD}
uniform sampler2D u_flow;
const float CENTRE = 128.0 / 255.0;
const float RANGE = 255.0 / 127.0;
void main() {
  vec2 flow = (texture2D(u_flow, v_uv).xy - CENTRE) * RANGE;
  vec2 uv = v_uv - flow * 0.14;
  float t = smoothstep(-0.55, 0.6, field(uv));
  vec3 lab = mix(u_lab[0], ramp(t), u_intensity);
  lab.x += length(flow) * 0.035 * u_intensity;
  gl_FragColor = finish(labToLinear(lab));
}
`

/** The flowmap's own pass: last frame's velocities fade (with a floor so 8-bit values always reach zero) and the
 * pointer splats its velocity with a soft falloff. Velocity is stored around 128/255, so zero is exact in a byte. */
export const FLOWMAP = `precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_prev;
uniform vec2 u_point;
uniform vec2 u_velocity;
uniform float u_aspect;
uniform float u_radius;
uniform float u_dissipation;
const float CENTRE = 128.0 / 255.0;
const float RANGE = 255.0 / 127.0;
void main() {
  vec2 v = (texture2D(u_prev, v_uv).xy - CENTRE) * RANGE;
  v *= u_dissipation;
  v = sign(v) * max(abs(v) - 1.0 / 127.0, 0.0);
  vec2 d = (v_uv - u_point) * vec2(u_aspect, 1.0);
  float falloff = 1.0 - smoothstep(0.0, u_radius, length(d));
  v = clamp(v + u_velocity * falloff * falloff, -1.0, 1.0);
  gl_FragColor = vec4(v / RANGE + CENTRE, CENTRE, 1.0);
}
`

/** The depth image: the photo cover-fitted, each pixel's uv shifted by its depth against the focus, refined by a few
 * fixed-point steps (the level sets how many) so edges hold instead of smearing. */
export const DEPTH = `precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform sampler2D u_depth;
uniform vec2 u_cover;
uniform vec2 u_shift;
uniform float u_focus;
uniform float u_invert;
uniform float u_steps;
float depthAt(vec2 uv) {
  float d = texture2D(u_depth, uv).r;
  return mix(d, 1.0 - d, u_invert);
}
void main() {
  vec2 base = (v_uv - 0.5) * u_cover + 0.5;
  vec2 uv = base;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= u_steps) break;
    uv = base + (depthAt(uv) - u_focus) * u_shift;
  }
  gl_FragColor = vec4(texture2D(u_image, clamp(uv, 0.0, 1.0)).rgb, 1.0);
}
`
