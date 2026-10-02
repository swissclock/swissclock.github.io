/**
 * Shared pieces for the side-projects views: text sprites, the depth fade and
 * the light's warmth, so each view only describes its own picture.
 */

import { CanvasTexture, Sprite, SpriteMaterial } from 'three'

/** Depth fade and warmth, the same rules the shell follows. */
export const glslCommon = /* glsl */ `
uniform float uPixelRatio;
uniform float uDepthRef;
uniform float uSuppression;

float depthFade (float depth) {
  return clamp(1.0 - (depth - uDepthRef * 0.86) / (uDepthRef * 0.5), 0.25, 1.0);
}
`

/** A disc with a soft edge, or a hard core inside a bloom when `glow` is 1. */
export const glslDot = /* glsl */ `
float dot2 (float glow) {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float soft = smoothstep(0.25, 0.04, r);
  float bloom = smoothstep(0.03, 0.0, r) + pow(smoothstep(0.25, 0.0, r), 2.2) * 0.5;
  return mix(soft, bloom, glow);
}
`

/** A mono label drawn once into a texture. */
export function textSprite (text, { colour, height = 0.24, weight = 500 }) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const size = 44
  const font = `${weight} ${size}px "Geist Mono", ui-monospace, Menlo, monospace`
  ctx.font = font
  canvas.width = Math.ceil(ctx.measureText(text).width) + 16
  canvas.height = 64
  ctx.font = font
  ctx.fillStyle = colour
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 8, 34)
  const texture = new CanvasTexture(canvas)
  const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 })
  const sprite = new Sprite(material)
  sprite.scale.set(height * canvas.width / canvas.height, height, 1)
  return sprite
}

/** Frame-rate independent smoothing: the fraction of the gap to close in `dt`. */
export function approach (rate, dt) {
  return 1 - Math.exp(-rate * dt)
}

export const smooth = (x) => x * x * (3 - 2 * x)

/** Two digits, the way the draw is printed. */
export const two = (n) => String(n).padStart(2, '0')

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Days since 1 Jan 2009 to "29 Sep 2026". */
export function dayLabel (days) {
  const d = new Date(Date.UTC(2009, 0, 1) + days * 86400000)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** Watches the signal for the first strong spike after a quiet spell, and for every spike. */
export function spikes () {
  let last = -99
  let previous = 0
  return (state) => {
    const rising = state.burst > 0.45 && previous <= 0.45
    previous = state.burst
    if (!rising) return null
    const run = state.time - last > 0.9
    last = state.time
    return { run }
  }
}
