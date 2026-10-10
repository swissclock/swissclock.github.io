/**
 * The showcase scape of Aquascape Studio, the "Iwagumi Study", as the game
 * builds it (Game.loadExample), and the parts of its ecosystem model
 * (sim/Ecosystem.ts) that tank.js runs. All lengths are in cm.
 */

// 60 × 30 × 36 outside, 6 mm glass, filled to 1.5 cm under the top.
export const W = 58.8
export const D = 28.8
export const TANK_H = 36
export const WATER = 34.5

/** Where the grey sand band begins, across the tank (fz: 0 back, 1 front). */
export const sandEdge = (fx) => 0.84 - 0.07 * Math.sin(fx * Math.PI * 1.15 + 0.4)

/** Substrate height, as presetSlope('soil-dark', 2.5, 10, 3.5) and the sand overlay build it. */
export function ground (fx, fz) {
  const base = 10 + (2.5 - 10) * Math.pow(fz, 0.9)
  const mound = 3.5 * Math.exp(-Math.pow((fx - 0.62) / 0.22, 2) - Math.pow((fz - 0.4) / 0.35, 2))
  const sand = fz > sandEdge(fx) ? 0.6 * Math.min(1, (fz - sandEdge(fx)) * 30) : 0
  return base + mound + sand
}

// Sanzon iwagumi: the main stone on the golden-ratio line, companions leaning
// the same way, smaller ones scattered. Positions and seeds are the game's;
// heights are picked from its size classes.
const gx = W * 0.618
export const STONES = [
  { size: 'L', x: gx, fz: 0.5 - 2.5 / 30, lean: -0.16, h: 22, seed: 902766 },
  { size: 'M', x: gx - 10.5, fz: 0.5 - 1 / 30, lean: -0.14, h: 14, seed: 134623 },
  { size: 'M', x: gx + 10, fz: 0.5 + 2 / 30, lean: -0.2, h: 12, seed: 395950 },
  { size: 'S', x: W * 0.22, fz: 0.5 + 0.5 / 30, lean: -0.1, h: 8, seed: 348436 },
  { size: 'S', x: gx - 3, fz: 0.5 + 5.5 / 30, lean: -0.12, h: 6.5, seed: 261327 },
  { size: 'XS', x: W * 0.12, fz: 0.5 - 4 / 30, lean: 0.1, h: 3.2, seed: 11 },
  { size: 'XS', x: gx + 17, fz: 0.5 - 6 / 30, lean: -0.3, h: 2.8, seed: 12 },
  { size: 'XS', x: W * 0.4, fz: 0.5 + 7 / 30, lean: 0.2, h: 3, seed: 13 }
]
/** Width over height for each size class: seiryu is tall and narrow. */
export const WIDTH = { L: 0.62, M: 0.66, S: 0.8, XS: 1.3 }

/**
 * The planting: one portion every 2.6 cm, none on the sand or at a stone's
 * foot; hairgrass in a band at the back, thickening behind the main stone,
 * and HC everywhere else.
 */
export function portions (rng) {
  const out = []
  for (let x = 1.8; x < W - 1.2; x += 2.6) {
    for (let zc = 1.8; zc < D - 1.2; zc += 2.6) {
      const jx = x + (rng() - 0.5) * 1.4
      const jz = zc + (rng() - 0.5) * 1.4
      const fx = jx / W
      const fz = jz / D
      if (fz > sandEdge(fx) - 0.03) continue
      if (STONES.some((s) => s.size !== 'XS' && Math.abs(jx - s.x) < s.h * WIDTH[s.size] * 0.42 && Math.abs(fz - s.fz) < 0.09)) continue
      const back = fz < 0.32 + 0.12 * Math.exp(-Math.pow((fx - 0.62) / 0.15, 2))
      const kind = back && rng() < 0.8 ? (fz < 0.18 && rng() < 0.5 ? 'hairgrass' : 'mini') : 'hc'
      out.push({ x: jx, fz, kind })
    }
  }
  return out
}

// Ecosystem defaults: 70% on the slim light from 13:00 for 7 h, 1 bubble/s of
// CO₂, KH 2, a lily outflow at the default turnover.
const LIGHTS_ON = 13
const PHOTOPERIOD = 7
export const BPS = 1
export const KH = 2
const OUTGAS = 0.5 + 0.06 * 8 * 1

const span = (h, from) => ((h - from) % 24 + 24) % 24
/** 0..1: the lights fade over about 20 minutes, like a controller's sunrise. */
export const lightLevel = (h) => (span(h, LIGHTS_ON) >= PHOTOPERIOD ? 0 : Math.min(1, Math.min(span(h, LIGHTS_ON), PHOTOPERIOD - span(h, LIGHTS_ON)) / 0.35))
/** The solenoid opens two hours before the lights and closes half an hour before they go off. */
export const co2Running = (h) => span(h, LIGHTS_ON - 2) < PHOTOPERIOD + 1.5

// Water volume as the game reckons it: the glass, less the soil and the stone.
let soil = 0
for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) soil += ground((i + 0.5) / 40, (j + 0.5) / 40)
export const litres = (W * D * WATER - (soil / 1600) * W * D - 1800) / 1000
/** Steady-state CO₂ added per bubble a second, in ppm. */
export const perBubble = 1500 / litres / OUTGAS
